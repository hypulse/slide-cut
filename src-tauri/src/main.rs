use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;

const PROJECTS_DIRNAME: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const META_FILE: &str = "meta.json";
const DEFAULT_PROJECT_NAME: &str = "Untitled";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMeta {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    thumbnail: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectPayload {
    id: Option<String>,
    name: Option<String>,
    data: Value,
    thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RenameProjectPayload {
    id: String,
    name: String,
}

#[derive(Debug, Serialize)]
struct ProjectRecord {
    meta: ProjectMeta,
    data: Value,
}

fn now_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn now_string() -> Result<String, String> {
    Ok(now_millis()?.to_string())
}

fn clean_project_name(value: Option<&str>) -> String {
    let name = value.unwrap_or("").trim();
    if name.is_empty() {
        DEFAULT_PROJECT_NAME.to_string()
    } else {
        name.to_string()
    }
}

fn is_project_id(value: &str) -> bool {
    value.starts_with("project-")
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

fn projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(PROJECTS_DIRNAME))
}

fn ensure_projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = projects_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    if !is_project_id(project_id) {
        return Err("Invalid project id".to_string());
    }
    Ok(projects_root(app)?.join(project_id))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf) -> Result<T, String> {
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

fn write_json<T: Serialize>(path: PathBuf, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temp_path = path.with_extension("tmp");
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(&temp_path, format!("{text}\n")).map_err(|error| error.to_string())?;
    fs::rename(temp_path, path).map_err(|error| error.to_string())
}

fn create_project_id(app: &AppHandle) -> Result<String, String> {
    ensure_projects_root(app)?;
    for index in 0..10 {
        let id = format!("project-{}-{index}", now_millis()?);
        if !project_dir(app, &id)?.exists() {
            return Ok(id);
        }
    }
    Ok(format!("project-{}", now_millis()?))
}

fn read_project_meta(app: &AppHandle, project_id: &str) -> Result<ProjectMeta, String> {
    let mut meta: ProjectMeta = read_json(project_dir(app, project_id)?.join(META_FILE))?;
    meta.id = project_id.to_string();
    meta.name = clean_project_name(Some(&meta.name));
    Ok(meta)
}

fn project_file_filter<R: Runtime>(
    dialog: tauri_plugin_dialog::FileDialogBuilder<R>,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    dialog.add_filter("Simple Slide Project", &["json"])
}

#[tauri::command]
fn list_projects(app: AppHandle) -> Result<Vec<ProjectMeta>, String> {
    let root = ensure_projects_root(&app)?;
    let mut projects = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        if !is_project_id(&id) {
            continue;
        }
        if let Ok(meta) = read_project_meta(&app, &id) {
            projects.push(meta);
        }
    }
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

#[tauri::command]
fn save_project(app: AppHandle, payload: SaveProjectPayload) -> Result<ProjectMeta, String> {
    ensure_projects_root(&app)?;
    let id = match payload.id.as_deref() {
        Some(id) if is_project_id(id) => id.to_string(),
        _ => create_project_id(&app)?,
    };
    let previous_meta = read_project_meta(&app, &id).ok();
    let timestamp = now_string()?;
    let meta = ProjectMeta {
        id: id.clone(),
        name: clean_project_name(payload.name.as_deref()),
        created_at: previous_meta
            .as_ref()
            .map(|meta| meta.created_at.clone())
            .unwrap_or_else(|| timestamp.clone()),
        updated_at: timestamp,
        thumbnail: payload
            .thumbnail
            .or_else(|| previous_meta.map(|meta| meta.thumbnail))
            .unwrap_or_default(),
    };
    let dir = project_dir(&app, &id)?;
    write_json(dir.join(PROJECT_FILE), &payload.data)?;
    write_json(dir.join(META_FILE), &meta)?;
    Ok(meta)
}

#[tauri::command]
fn load_project(app: AppHandle, id: String) -> Result<ProjectRecord, String> {
    let meta = read_project_meta(&app, &id)?;
    let data = read_json(project_dir(&app, &id)?.join(PROJECT_FILE))?;
    Ok(ProjectRecord { meta, data })
}

#[tauri::command]
fn rename_project(app: AppHandle, payload: RenameProjectPayload) -> Result<ProjectMeta, String> {
    let mut meta = read_project_meta(&app, &payload.id)?;
    meta.name = clean_project_name(Some(&payload.name));
    meta.updated_at = now_string()?;
    write_json(project_dir(&app, &payload.id)?.join(META_FILE), &meta)?;
    Ok(meta)
}

#[tauri::command]
fn duplicate_project(app: AppHandle, id: String) -> Result<ProjectMeta, String> {
    let source_meta = read_project_meta(&app, &id)?;
    let source_data: Value = read_json(project_dir(&app, &id)?.join(PROJECT_FILE))?;
    let copy_id = create_project_id(&app)?;
    let timestamp = now_string()?;
    let copy_meta = ProjectMeta {
        id: copy_id.clone(),
        name: format!("{} Copy", source_meta.name),
        created_at: timestamp.clone(),
        updated_at: timestamp,
        thumbnail: source_meta.thumbnail,
    };
    let dir = project_dir(&app, &copy_id)?;
    write_json(dir.join(PROJECT_FILE), &source_data)?;
    write_json(dir.join(META_FILE), &copy_meta)?;
    Ok(copy_meta)
}

#[tauri::command]
fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let dir = project_dir(&app, &id)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn export_project_file(app: AppHandle, suggested_name: String, data: Value) -> Result<Option<String>, String> {
    let filename = if suggested_name.trim().is_empty() {
        "simple-slide.simpleslide.json".to_string()
    } else {
        suggested_name
    };
    let selected_path = project_file_filter(app.dialog().file())
        .set_file_name(&filename)
        .blocking_save_file();

    let Some(file_path) = selected_path else {
        return Ok(None);
    };
    let Some(path) = file_path.as_path() else {
        return Err("저장 경로를 읽지 못했습니다.".to_string());
    };
    write_json(path.to_path_buf(), &data)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn import_project_file(app: AppHandle) -> Result<Option<ProjectRecord>, String> {
    let selected_path = project_file_filter(app.dialog().file()).blocking_pick_file();
    let Some(file_path) = selected_path else {
        return Ok(None);
    };
    let Some(path) = file_path.as_path() else {
        return Err("파일 경로를 읽지 못했습니다.".to_string());
    };
    let data: Value = read_json(path.to_path_buf())?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported Project")
        .replace(".simpleslide.json", "")
        .replace(".json", "");
    let timestamp = now_string()?;
    let meta = ProjectMeta {
        id: String::new(),
        name: clean_project_name(Some(&name)),
        created_at: timestamp.clone(),
        updated_at: timestamp,
        thumbnail: String::new(),
    };
    Ok(Some(ProjectRecord { meta, data }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            save_project,
            load_project,
            rename_project,
            duplicate_project,
            delete_project,
            export_project_file,
            import_project_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Slide");
}

fn main() {
    run();
}
