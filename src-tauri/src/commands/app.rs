use std::path::PathBuf;

use tauri::State;

use crate::core::java;
use crate::error::AppResult;
use crate::model::{AppInfo, JavaInfo};
use crate::config::Settings;
use crate::state::AppState;

#[tauri::command]
pub async fn app_info(state: State<'_, AppState>) -> AppResult<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: state.paths.root.to_string_lossy().to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> AppResult<Settings> {
    Ok(state.settings_snapshot().await)
}

#[tauri::command]
pub async fn settings_save(
    state: State<'_, AppState>,
    settings: Settings,
) -> AppResult<Settings> {
    let normalized = settings.normalized();
    {
        let mut guard = state.settings.write().await;
        *guard = normalized.clone();
    }
    state.save_settings().await?;
    Ok(normalized)
}

#[tauri::command]
pub async fn java_detect(state: State<'_, AppState>) -> AppResult<Vec<JavaInfo>> {
    let configured = state.settings_snapshot().await.java_path;
    Ok(java::detect_all(&configured).await)
}

#[tauri::command]
pub async fn java_probe(path: String) -> AppResult<JavaInfo> {
    java::probe(&path).await
}

#[tauri::command]
pub async fn open_folder(state: State<'_, AppState>, path: Option<String>) -> AppResult<()> {
    let target = path
        .filter(|p| !p.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| state.paths.root.clone());

    if !target.exists() {
        std::fs::create_dir_all(&target)?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .arg(&target)
            .creation_flags(0)
            .spawn()?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open").arg(&target).spawn()?;
    }
    Ok(())
}

// ───────────────────── 数据目录 ─────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirView {
    /// 当前生效的数据目录
    pub current: String,
    /// 配置文件位置（exe 同级的 nebula.json）
    pub config_path: String,
    /// 是否使用了自定义目录
    pub custom: bool,
    /// 已写入但需重启才生效的目录
    pub pending: Option<String>,
}

#[tauri::command]
pub async fn data_dir_get(state: State<'_, AppState>) -> AppResult<DataDirView> {
    let current = state.paths.root.to_string_lossy().to_string();
    let pending = crate::config::read_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .filter(|p| p != &current);
    Ok(DataDirView {
        custom: crate::config::read_data_dir().is_some(),
        current,
        config_path: crate::config::data_dir_config_path().to_string_lossy().to_string(),
        pending,
    })
}

#[tauri::command]
pub async fn data_dir_set(state: State<'_, AppState>, path: String) -> AppResult<DataDirView> {
    crate::config::write_data_dir(&path)?;
    let current = state.paths.root.to_string_lossy().to_string();
    let pending = crate::config::read_data_dir().map(|p| p.to_string_lossy().to_string());
    Ok(DataDirView {
        custom: true,
        current,
        config_path: crate::config::data_dir_config_path().to_string_lossy().to_string(),
        pending,
    })
}
