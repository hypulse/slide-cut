use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const PROJECTS_DIRNAME: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const META_FILE: &str = "meta.json";
const ASSETS_DIR: &str = "assets";
const APP_SETTINGS_FILE: &str = "settings.json";
const DEFAULT_PROJECT_NAME: &str = "Untitled";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMeta {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    thumbnail: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveProjectPayload {
    id: Option<String>,
    name: Option<String>,
    data: Value,
    thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RenameProjectPayload {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportImageBlobPayload {
    project_id: String,
    data_base64: String,
    mime_type: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct ProjectRecord {
    meta: ProjectMeta,
    data: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectAsset {
    path: String,
    name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppSettings {
    #[serde(default)]
    pub(crate) open_ai_api_key: String,
    #[serde(default)]
    pub(crate) mini_max_api_key: String,
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

fn app_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(APP_SETTINGS_FILE))
}

fn ensure_projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = projects_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn default_export_dir(app: &AppHandle) -> String {
    if let Ok(path) = app.path().download_dir() {
        return path.to_string_lossy().to_string();
    }
    if let Ok(path) = app.path().home_dir() {
        return path.join("Downloads").to_string_lossy().to_string();
    }
    app_data_dir(app)
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

fn clean_app_settings(_app: &AppHandle, settings: AppSettings) -> AppSettings {
    AppSettings {
        open_ai_api_key: settings.open_ai_api_key.trim().to_string(),
        mini_max_api_key: settings.mini_max_api_key.trim().to_string(),
    }
}

fn project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    if !is_project_id(project_id) {
        return Err("Invalid project id".to_string());
    }
    Ok(projects_root(app)?.join(project_id))
}

fn project_assets_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(app, project_id)?.join(ASSETS_DIR))
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

fn is_copyable_asset_path(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && !value.starts_with("data:")
        && !value.starts_with("blob:")
        && !value.starts_with("http://")
        && !value.starts_with("https://")
        && !value.starts_with("asset:")
}

fn clean_asset_file_name(path: &Path) -> String {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("asset");
    let cleaned = file_name
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "asset".to_string()
    } else {
        cleaned
    }
}

fn image_extension_for_mime(mime_type: Option<&str>) -> &'static str {
    match mime_type.unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/bmp" => "bmp",
        _ => "png",
    }
}

fn ensure_image_file_extension(name: Option<&str>, extension: &str) -> String {
    let fallback = format!("clipboard-image.{extension}");
    let clean_name = name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| clean_asset_file_name(Path::new(value)))
        .unwrap_or(fallback);
    let has_extension = Path::new(&clean_name).extension().is_some();
    if has_extension {
        clean_name
    } else {
        format!("{clean_name}.{extension}")
    }
}

fn asset_hash_key(source_path: &Path, metadata: &fs::Metadata) -> String {
    let modified_millis = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let key = format!(
        "{}:{}:{}",
        source_path.to_string_lossy(),
        metadata.len(),
        modified_millis
    );
    let hash = hex::encode(Sha256::digest(key.as_bytes()));
    hash.chars().take(16).collect()
}

fn asset_bytes_hash_key(bytes: &[u8]) -> String {
    let hash = hex::encode(Sha256::digest(bytes));
    hash.chars().take(16).collect()
}

fn copy_asset_into_assets_dir(
    assets_dir: &Path,
    source: &str,
    require_existing: bool,
) -> Result<Option<PathBuf>, String> {
    if !is_copyable_asset_path(source) {
        return Ok(None);
    }

    let source_path = PathBuf::from(source.trim());
    if !source_path.is_file() {
        if require_existing {
            return Err(format!(
                "첨부 파일을 찾지 못했습니다: {}",
                source_path.display()
            ));
        }
        return Ok(None);
    }

    fs::create_dir_all(assets_dir).map_err(|error| error.to_string())?;
    let assets_root = assets_dir
        .canonicalize()
        .unwrap_or_else(|_| assets_dir.to_path_buf());
    if let Ok(source_root) = source_path.canonicalize() {
        if source_root.starts_with(&assets_root) {
            return Ok(Some(source_path));
        }
    }

    let metadata = fs::metadata(&source_path).map_err(|error| error.to_string())?;
    let file_name = clean_asset_file_name(&source_path);
    let asset_name = format!("{}-{}", asset_hash_key(&source_path, &metadata), file_name);
    let destination = assets_dir.join(asset_name);
    if !destination.exists() {
        fs::copy(&source_path, &destination).map_err(|error| {
            format!(
                "첨부 파일을 프로젝트 assets로 복사하지 못했습니다: {}",
                error
            )
        })?;
    }
    Ok(Some(destination))
}

fn copy_asset_into_project(
    app: &AppHandle,
    project_id: &str,
    source: &str,
    require_existing: bool,
) -> Result<Option<PathBuf>, String> {
    let assets_dir = project_assets_dir(app, project_id)?;
    copy_asset_into_assets_dir(&assets_dir, source, require_existing)
}

fn path_to_project_string(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn rewrite_asset_paths<F>(data: &mut Value, mut rewrite: F) -> Result<(), String>
where
    F: FnMut(&str) -> Result<Option<String>, String>,
{
    if let Some(settings) = data.get_mut("settings").and_then(Value::as_object_mut) {
        if let Some(music) = settings
            .get_mut("backgroundMusic")
            .and_then(Value::as_object_mut)
        {
            if let Some(path_value) = music.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(next_path) = rewrite(path)? {
                        *path_value = Value::String(next_path);
                    }
                }
            }
        }
    }

    let Some(slides) = data.get_mut("slides").and_then(Value::as_array_mut) else {
        return Ok(());
    };

    for slide in slides {
        if let Some(video) = slide.get_mut("video").and_then(Value::as_object_mut) {
            if let Some(path_value) = video.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(next_path) = rewrite(path)? {
                        *path_value = Value::String(next_path);
                    }
                }
            }
        }

        if let Some(sound) = slide.get_mut("startSound").and_then(Value::as_object_mut) {
            if let Some(path_value) = sound.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(next_path) = rewrite(path)? {
                        *path_value = Value::String(next_path);
                    }
                }
            }
        }

        if let Some(objects) = slide.get_mut("objects").and_then(Value::as_array_mut) {
            for object in objects {
                let is_image = object
                    .get("type")
                    .and_then(Value::as_str)
                    .is_some_and(|value| value == "image");
                if !is_image {
                    continue;
                }
                if let Some(src_value) = object.get_mut("src") {
                    if let Some(src) = src_value.as_str() {
                        if let Some(next_src) = rewrite(src)? {
                            *src_value = Value::String(next_src);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn materialize_project_assets(
    app: &AppHandle,
    project_id: &str,
    mut data: Value,
) -> Result<Value, String> {
    rewrite_asset_paths(&mut data, |path| {
        Ok(copy_asset_into_project(app, project_id, path, false)?
            .map(|copied| copied.to_string_lossy().to_string()))
    })?;

    Ok(data)
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

#[tauri::command]
pub(crate) fn list_projects(app: AppHandle) -> Result<Vec<ProjectMeta>, String> {
    let root = ensure_projects_root(&app)?;
    let mut projects = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
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
pub(crate) fn save_project(
    app: AppHandle,
    payload: SaveProjectPayload,
) -> Result<ProjectRecord, String> {
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
    let data = materialize_project_assets(&app, &id, payload.data)?;
    write_json(dir.join(PROJECT_FILE), &data)?;
    write_json(dir.join(META_FILE), &meta)?;
    Ok(ProjectRecord { meta, data })
}

#[tauri::command]
pub(crate) fn load_project(app: AppHandle, id: String) -> Result<ProjectRecord, String> {
    let meta = read_project_meta(&app, &id)?;
    let data = read_json(project_dir(&app, &id)?.join(PROJECT_FILE))?;
    Ok(ProjectRecord { meta, data })
}

#[tauri::command]
pub(crate) fn rename_project(
    app: AppHandle,
    payload: RenameProjectPayload,
) -> Result<ProjectMeta, String> {
    let mut meta = read_project_meta(&app, &payload.id)?;
    meta.name = clean_project_name(Some(&payload.name));
    meta.updated_at = now_string()?;
    write_json(project_dir(&app, &payload.id)?.join(META_FILE), &meta)?;
    Ok(meta)
}

#[tauri::command]
pub(crate) fn duplicate_project(app: AppHandle, id: String) -> Result<ProjectMeta, String> {
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
    let copy_data = materialize_project_assets(&app, &copy_id, source_data)?;
    write_json(dir.join(PROJECT_FILE), &copy_data)?;
    write_json(dir.join(META_FILE), &copy_meta)?;
    Ok(copy_meta)
}

#[tauri::command]
pub(crate) fn import_project_asset(
    app: AppHandle,
    project_id: String,
    path: String,
) -> Result<ProjectAsset, String> {
    let copied = copy_asset_into_project(&app, &project_id, &path, true)?
        .ok_or_else(|| "복사할 첨부 파일 경로가 아닙니다.".to_string())?;
    let name = PathBuf::from(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("asset")
        .to_string();
    Ok(ProjectAsset {
        path: copied.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub(crate) fn import_project_image_blob(
    app: AppHandle,
    payload: ImportImageBlobPayload,
) -> Result<ProjectAsset, String> {
    let assets_dir = project_assets_dir(&app, &payload.project_id)?;
    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;

    let bytes = general_purpose::STANDARD
        .decode(payload.data_base64.trim())
        .map_err(|error| format!("이미지 데이터를 읽지 못했습니다: {error}"))?;
    if bytes.is_empty() {
        return Err("이미지 데이터가 비어 있습니다.".to_string());
    }

    let extension = image_extension_for_mime(payload.mime_type.as_deref());
    let file_name = ensure_image_file_extension(payload.name.as_deref(), extension);
    let asset_name = format!("{}-{}", asset_bytes_hash_key(&bytes), file_name);
    let destination = assets_dir.join(asset_name);
    if !destination.exists() {
        fs::write(&destination, bytes)
            .map_err(|error| format!("이미지를 프로젝트 assets로 저장하지 못했습니다: {error}"))?;
    }

    Ok(ProjectAsset {
        path: destination.to_string_lossy().to_string(),
        name: file_name,
    })
}

#[tauri::command]
pub(crate) fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let dir = project_dir(&app, &id)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn normalize_project_package_path(path: String) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("저장 경로를 읽지 못했습니다.".to_string());
    }
    let mut path = PathBuf::from(trimmed);
    if path.extension().and_then(|value| value.to_str()) != Some("slidecut") {
        path.set_extension("slidecut");
    }
    Ok(path)
}

fn prepare_project_package_dir(path: &Path) -> Result<(), String> {
    if path.exists() {
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
        } else {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    fs::create_dir_all(path).map_err(|error| error.to_string())
}

fn package_asset_relative_path(package_dir: &Path, asset_path: &Path) -> Result<String, String> {
    let relative = asset_path
        .strip_prefix(package_dir)
        .map_err(|error| format!("프로젝트 패키지 asset 경로를 만들지 못했습니다: {error}"))?;
    Ok(path_to_project_string(relative))
}

#[tauri::command]
pub(crate) fn export_project_package(path: String, mut data: Value) -> Result<(), String> {
    let package_dir = normalize_project_package_path(path)?;
    prepare_project_package_dir(&package_dir)?;
    let assets_dir = package_dir.join(ASSETS_DIR);
    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;

    rewrite_asset_paths(&mut data, |path| {
        let Some(copied) = copy_asset_into_assets_dir(&assets_dir, path, true)? else {
            return Ok(None);
        };
        Ok(Some(package_asset_relative_path(&package_dir, &copied)?))
    })?;
    write_json(package_dir.join(PROJECT_FILE), &data)
}

#[tauri::command]
pub(crate) fn import_project_package(path: String) -> Result<ProjectRecord, String> {
    if path.trim().is_empty() {
        return Err("파일 경로를 읽지 못했습니다.".to_string());
    }
    let package_dir = PathBuf::from(path.trim());
    if !package_dir.is_dir() {
        return Err("Slide Cut 프로젝트 패키지 폴더가 아닙니다.".to_string());
    }
    let mut data: Value = read_json(package_dir.join(PROJECT_FILE))?;
    rewrite_asset_paths(&mut data, |path| {
        if !is_copyable_asset_path(path) {
            return Ok(None);
        }
        let asset_path = PathBuf::from(path.trim());
        if asset_path.is_absolute() {
            return Ok(None);
        }
        if asset_path
            .components()
            .next()
            .map(|component| component.as_os_str())
            != Some(std::ffi::OsStr::new(ASSETS_DIR))
        {
            return Ok(None);
        }
        let assets_root = package_dir
            .join(ASSETS_DIR)
            .canonicalize()
            .map_err(|error| format!("프로젝트 패키지 assets 폴더를 읽지 못했습니다: {error}"))?;
        let resolved = package_dir
            .join(asset_path)
            .canonicalize()
            .map_err(|error| format!("프로젝트 패키지 asset을 읽지 못했습니다: {error}"))?;
        if !resolved.starts_with(&assets_root) {
            return Err("프로젝트 패키지 asset 경로가 올바르지 않습니다.".to_string());
        }
        Ok(Some(resolved.to_string_lossy().to_string()))
    })?;
    let name = package_dir
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported Project")
        .trim_end_matches(".slidecut");
    let timestamp = now_string()?;
    let meta = ProjectMeta {
        id: String::new(),
        name: clean_project_name(Some(name)),
        created_at: timestamp.clone(),
        updated_at: timestamp,
        thumbnail: String::new(),
    };
    Ok(ProjectRecord { meta, data })
}

#[tauri::command]
pub(crate) fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = app_settings_path(&app)?;
    if !path.exists() {
        return Ok(clean_app_settings(&app, AppSettings::default()));
    }
    let settings: AppSettings = read_json(path)?;
    Ok(clean_app_settings(&app, settings))
}

#[tauri::command]
pub(crate) fn get_default_export_dir(app: AppHandle) -> Result<String, String> {
    Ok(default_export_dir(&app))
}

#[tauri::command]
pub(crate) fn save_app_settings(
    app: AppHandle,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    let settings = clean_app_settings(&app, settings);
    write_json(app_settings_path(&app)?, &settings)?;
    Ok(settings)
}
