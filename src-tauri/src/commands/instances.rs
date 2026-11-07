use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::core::{install, launch, modpack};
use crate::error::{AppError, AppResult};
use crate::model::{Instance, LoaderKind};
use crate::state::AppState;
use crate::util::now_ms;

#[tauri::command]
pub async fn instances_list(state: State<'_, AppState>) -> AppResult<Vec<Instance>> {
    let mut list = state.instances.read().await.clone();
    for item in list.iter_mut() {
        item.installed = install::is_installed(&state.paths, &item.version_id);
    }
    list.sort_by(|a, b| {
        let left = a.last_played.unwrap_or(a.created_at);
        let right = b.last_played.unwrap_or(b.created_at);
        right.cmp(&left)
    });
    Ok(list)
}

#[tauri::command]
pub async fn instance_create(
    state: State<'_, AppState>,
    name: String,
    game_version: String,
    loader: LoaderKind,
    loader_version: Option<String>,
) -> AppResult<Instance> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Invalid("实例名称不能为空".to_string()));
    }
    if game_version.trim().is_empty() {
        return Err(AppError::Invalid("请选择游戏版本".to_string()));
    }

    let version_id = match loader {
        LoaderKind::Vanilla => game_version.clone(),
        LoaderKind::Fabric => {
            let lv = loader_version
                .as_deref()
                .filter(|v| !v.trim().is_empty())
                .ok_or_else(|| AppError::Invalid("请选择 Fabric 加载器版本".to_string()))?;
            format!("fabric-loader-{lv}-{game_version}")
        }
        LoaderKind::Forge => {
            let lv = loader_version
                .as_deref()
                .filter(|v| !v.trim().is_empty())
                .ok_or_else(|| AppError::Invalid("请选择 Forge 版本".to_string()))?;
            format!("{game_version}-forge-{lv}")
        }
        LoaderKind::NeoForge => {
            let lv = loader_version
                .as_deref()
                .filter(|v| !v.trim().is_empty())
                .ok_or_else(|| AppError::Invalid("请选择 NeoForge 版本".to_string()))?;
            format!("neoforge-{lv}")
        }
    };

    let id = Uuid::new_v4().simple().to_string()[..10].to_string();
    let instance = Instance {
        id: id.clone(),
        name,
        version_id,
        game_version,
        loader,
        loader_version,
        created_at: now_ms(),
        last_played: None,
        playtime_ms: 0,
        memory_mb: None,
        java_path: None,
        jvm_args: None,
        account_id: None,
        installed: false,
    };

    std::fs::create_dir_all(state.paths.instance_dir(&id))?;
    state.instances.write().await.push(instance.clone());
    state.save_instances().await?;

    let mut result = instance;
    result.installed = install::is_installed(&state.paths, &result.version_id);
    Ok(result)
}

#[tauri::command]
pub async fn instance_update(state: State<'_, AppState>, instance: Instance) -> AppResult<Instance> {
    {
        let mut guard = state.instances.write().await;
        let Some(slot) = guard.iter_mut().find(|item| item.id == instance.id) else {
            return Err(AppError::NotFound(format!("实例 {}", instance.id)));
        };
        *slot = instance.clone();
    }
    state.save_instances().await?;
    Ok(instance)
}

#[tauri::command]
pub async fn instance_delete(state: State<'_, AppState>, instance_id: String) -> AppResult<()> {
    {
        let mut guard = state.instances.write().await;
        let Some(position) = guard.iter().position(|item| item.id == instance_id) else {
            return Err(AppError::NotFound(format!("实例 {instance_id}")));
        };
        guard.remove(position);
    }

    let dir = state.paths.instance_dir(&instance_id);
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    state.save_instances().await?;
    Ok(())
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
    account_id: Option<String>,
) -> AppResult<()> {
    // 实例可以绑定自己的账户；未绑定时回退到全局选中账户
    let chosen = match account_id {
        Some(id) => Some(id),
        None => state
            .instance(&instance_id)
            .await
            .and_then(|i| i.account_id),
    };
    launch::launch(&app, &state, &instance_id, chosen.as_deref()).await
}

#[tauri::command]
pub async fn stop_game(state: State<'_, AppState>, instance_id: String) -> AppResult<()> {
    launch::stop(&state, &instance_id).await
}

/// 导入 Modrinth `.mrpack` 整合包，返回新建的实例。
#[tauri::command]
pub async fn modpack_import(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    name: Option<String>,
) -> AppResult<Instance> {
    modpack::import_mrpack(&app, &state, &path, name.as_deref()).await
}

// ───────────────────── 实例管理：截图 / 导出脚本 ─────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotInfo {
    pub file_name: String,
    pub size: u64,
    pub path: String,
}

fn safe_name(name: &str) -> AppResult<&str> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::Invalid("非法的文件名".to_string()));
    }
    Ok(name)
}

#[tauri::command]
pub async fn screenshots_list(
    state: State<'_, AppState>,
    instance_id: String,
) -> AppResult<Vec<ScreenshotInfo>> {
    let dir = state.paths.instance_dir(&instance_id).join("screenshots");
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut list = Vec::new();
    for entry in std::fs::read_dir(&dir)?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.to_lowercase().ends_with(".png") && !name.to_lowercase().ends_with(".jpg") {
            continue;
        }
        let meta = entry.metadata()?;
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        list.push((
            modified,
            ScreenshotInfo {
                file_name: name,
                size: meta.len(),
                path: entry.path().to_string_lossy().to_string(),
            },
        ));
    }
    list.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(list.into_iter().map(|(_, v)| v).collect())
}

#[tauri::command]
pub async fn screenshot_delete(
    state: State<'_, AppState>,
    instance_id: String,
    file_name: String,
) -> AppResult<()> {
    let name = safe_name(&file_name)?;
    let path = state
        .paths
        .instance_dir(&instance_id)
        .join("screenshots")
        .join(name);
    if path.is_file() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// 导出一个可直接双击运行的 Windows 启动脚本（不依赖启动器）。
#[tauri::command]
pub async fn instance_export_script(
    state: State<'_, AppState>,
    instance_id: String,
) -> AppResult<String> {
    let instance = state
        .instance(&instance_id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("实例 {instance_id}")))?;
    let settings = state.settings_snapshot().await;
    let java = crate::core::java::resolve_java(&settings.java_path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "java.exe".to_string());

    let version_json = state.paths.version_json(&instance.version_id);
    let detail: serde_json::Value = if version_json.exists() {
        serde_json::from_slice(&std::fs::read(&version_json)?)?
    } else {
        serde_json::Value::Null
    };
    let main_class = detail
        .get("mainClass")
        .and_then(|v| v.as_str())
        .unwrap_or("net.minecraft.client.main.Main");

    // 简单粗暴但可靠：把共享 libraries 下所有 jar 都列进 classpath
    let mut jars: Vec<String> = Vec::new();
    let mut stack = vec![state.paths.libraries()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("jar") {
                jars.push(path.to_string_lossy().to_string());
            }
        }
    }
    jars.sort();
    let client_jar = state
        .paths
        .version_jar(&instance.version_id)
        .to_string_lossy()
        .to_string();
    jars.push(client_jar);

    let game_dir = state.paths.instance_dir(&instance_id);
    let assets = state.paths.assets();
    let asset_index = detail
        .get("assetIndex")
        .and_then(|v| v["id"].as_str())
        .map(str::to_string)
        .unwrap_or_else(|| instance.game_version.clone());
    let memory = instance.memory_mb.unwrap_or(settings.memory_mb);
    let account_store = state.accounts.read().await;
    let username = account_store
        .accounts
        .iter()
        .find(|a| Some(&a.id) == account_store.selected.as_ref())
        .map(|a| a.username.clone())
        .unwrap_or_else(|| "Player".to_string());
    drop(account_store);

    let cp = jars.join(";");
    let script = format!(
        "@echo off\r\nchcp 65001 >nul\r\ntitle Nebula Launcher - {name}\r\n\r\n\"{java}\" -Xmx{memory}M -Dfile.encoding=UTF-8 -Djava.library.path=\"{natives}\" -cp \"{cp}\" {main} --username \"{user}\" --version \"{ver}\" --gameDir \"{game}\" --assetsDir \"{assets}\" --assetIndex \"{idx}\" --uuid 00000000-0000-0000-0000-000000000000 --accessToken 0 --userType legacy --versionType release\r\npause\r\n",
        name = instance.name,
        java = java,
        memory = memory,
        natives = state.paths.natives_dir(&instance.version_id).to_string_lossy(),
        cp = cp,
        main = main_class,
        user = username,
        ver = instance.version_id,
        game = game_dir.to_string_lossy(),
        assets = assets.to_string_lossy(),
        idx = asset_index,
    );
    let out = game_dir.join("start-game.bat");
    std::fs::create_dir_all(&game_dir)?;
    std::fs::write(&out, script)?;
    Ok(out.to_string_lossy().to_string())
}
