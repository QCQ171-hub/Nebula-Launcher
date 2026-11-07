use tauri::State;

use crate::core::ai::{self, ChatMessage};
use crate::error::AppResult;
use crate::state::AppState;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigView {
    pub base_url: String,
    pub model: String,
    /// 只告诉前端「有没有填」，不回传密钥本身
    pub key_set: bool,
}

#[tauri::command]
pub async fn ai_config(state: State<'_, AppState>) -> AppResult<AiConfigView> {
    let settings = state.settings_snapshot().await;
    Ok(AiConfigView {
        base_url: settings.ai_base_url,
        model: settings.ai_model,
        key_set: !settings.ai_api_key.is_empty(),
    })
}

#[tauri::command]
pub async fn ai_chat(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
) -> AppResult<String> {
    ai::chat(&state, messages).await
}

/// 真实调用一次接口，用来验证用户填的配置是否可用
#[tauri::command]
pub async fn ai_test(state: State<'_, AppState>) -> AppResult<String> {
    ai::test(&state).await
}
