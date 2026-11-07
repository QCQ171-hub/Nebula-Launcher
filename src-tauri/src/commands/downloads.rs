use tauri::State;

use crate::error::AppResult;
use crate::state::{AppState, DownloadJob};

/// 下载中心轮询入口：返回全部任务（进行中的排在最前）。
#[tauri::command]
pub async fn downloads_list(state: State<'_, AppState>) -> AppResult<Vec<DownloadJob>> {
    Ok(state.list_downloads())
}

/// 清掉已完成 / 已取消 / 失败的记录，进行中的任务不受影响。
#[tauri::command]
pub async fn downloads_clear(state: State<'_, AppState>) -> AppResult<()> {
    state.clear_finished_downloads();
    Ok(())
}
