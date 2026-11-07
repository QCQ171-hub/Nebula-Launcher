use tauri::State;

use crate::core::auth::{authlib, microsoft, offline};
use crate::error::{AppError, AppResult};
use crate::model::{Account, AccountKind, AccountsView, AccountStore, DeviceCodeInfo, MsPollResult};
use crate::state::AppState;

async fn upsert(state: &AppState, account: Account) -> AppResult<Account> {
    {
        let mut store = state.accounts.write().await;
        if let Some(slot) = store.accounts.iter_mut().find(|a| a.id == account.id) {
            *slot = account.clone();
        } else {
            store.accounts.push(account.clone());
        }
        store.selected = Some(account.id.clone());
    }
    state.save_accounts().await?;
    Ok(account)
}

fn view(store: &AccountStore) -> AccountsView {
    AccountsView {
        accounts: store.accounts.clone(),
        selected: store.selected.clone(),
    }
}

fn microsoft_client_id(state: &AppState, configured: &str) -> String {
    let value = configured.trim();
    if value.is_empty() {
        std::env::var("NEBULA_MS_CLIENT_ID").unwrap_or_default()
    } else {
        value.to_string()
    }
}

#[tauri::command]
pub async fn accounts_list(state: State<'_, AppState>) -> AppResult<AccountsView> {
    let store = state.accounts.read().await;
    Ok(view(&store))
}

#[tauri::command]
pub async fn account_select(state: State<'_, AppState>, account_id: String) -> AppResult<()> {
    {
        let mut store = state.accounts.write().await;
        if !store.accounts.iter().any(|a| a.id == account_id) {
            return Err(AppError::NotFound("账户不存在".to_string()));
        }
        store.selected = Some(account_id);
    }
    state.save_accounts().await?;
    Ok(())
}

#[tauri::command]
pub async fn account_delete(state: State<'_, AppState>, account_id: String) -> AppResult<()> {
    {
        let mut store = state.accounts.write().await;
        store.accounts.retain(|a| a.id != account_id);
        if store.selected.as_deref() == Some(account_id.as_str()) {
            store.selected = store.accounts.first().map(|a| a.id.clone());
        }
    }
    state.save_accounts().await?;
    Ok(())
}

#[tauri::command]
pub async fn login_offline(state: State<'_, AppState>, name: String) -> AppResult<Account> {
    let account = offline::create(&name)?;
    upsert(&state, account).await
}

#[tauri::command]
pub async fn ms_device_code(state: State<'_, AppState>) -> AppResult<DeviceCodeInfo> {
    let settings = state.settings_snapshot().await;
    let client_id = microsoft_client_id(&state, &settings.microsoft_client_id);
    microsoft::request_device_code(&state.http, &client_id).await
}

#[tauri::command]
pub async fn ms_poll(state: State<'_, AppState>, device_code: String) -> AppResult<MsPollResult> {
    let settings = state.settings_snapshot().await;
    let client_id = microsoft_client_id(&state, &settings.microsoft_client_id);
    let result = microsoft::poll(&state.http, &client_id, &device_code).await?;
    if let Some(account) = &result.account {
        upsert(&state, account.clone()).await?;
    }
    Ok(result)
}

#[tauri::command]
pub async fn authlib_login(
    state: State<'_, AppState>,
    base: String,
    username: String,
    password: String,
) -> AppResult<Account> {
    let (account, _meta) = authlib::login(&state.http, &base, &username, &password).await?;
    upsert(&state, account).await
}

#[tauri::command]
pub async fn account_refresh(state: State<'_, AppState>, account_id: String) -> AppResult<Account> {
    let account = {
        let store = state.accounts.read().await;
        store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound("账户不存在".to_string()))?
    };

    let updated = match account.kind {
        AccountKind::Microsoft => {
            let settings = state.settings_snapshot().await;
            let client_id = microsoft_client_id(&state, &settings.microsoft_client_id);
            microsoft::refresh(&state.http, &client_id, &account).await?
        }
        AccountKind::Authlib => authlib::refresh(&state.http, &account).await?,
        AccountKind::Offline => account.clone(),
    };

    upsert(&state, updated).await
}
