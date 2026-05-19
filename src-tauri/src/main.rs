use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const PROJECTS_DIRNAME: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const META_FILE: &str = "meta.json";
const ASSETS_DIR: &str = "assets";
const APP_SETTINGS_FILE: &str = "settings.json";
const DEFAULT_PROJECT_NAME: &str = "Untitled";
const VIDEO_EXPORT_PROGRESS_EVENT: &str = "video-export-progress";
static CANCELLED_EXPORTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectAsset {
    path: String,
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    #[serde(default)]
    open_ai_api_key: String,
    #[serde(default)]
    mini_max_api_key: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            open_ai_api_key: String::new(),
            mini_max_api_key: String::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportPayload {
    export_id: String,
    output_path: String,
    slides: Vec<VideoExportSlide>,
    tts: TtsSettings,
    fps: Option<u32>,
    fallback_duration_seconds: Option<f64>,
    background_music_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportSlide {
    width: u32,
    height: u32,
    notes: String,
    video_path: Option<String>,
    start_sound_path: Option<String>,
    frame_png: String,
    animation_frames: Option<Vec<String>>,
    frame_rate: Option<f64>,
    animation_duration_seconds: Option<f64>,
    end_on_tts_end: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TtsSettings {
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    voice: Option<String>,
    speed: Option<f64>,
    instructions: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportResult {
    output_path: String,
    slide_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChanges {
    repo_path: String,
    commit_hash: String,
    file_path: String,
    title: String,
    content: String,
    before_content: String,
    after_content: String,
    before_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommit {
    hash: String,
    label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitList {
    repo_path: String,
    commits: Vec<GitCommit>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileList {
    repo_path: String,
    commit_hash: String,
    files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportProgress {
    export_id: String,
    phase: String,
    message: String,
    current: usize,
    total: usize,
}

#[derive(Debug)]
struct PreparedSlide {
    frame_path: PathBuf,
    animation_frame_paths: Option<Vec<PathBuf>>,
    frame_rate: f64,
    audio_path: PathBuf,
    video_path: Option<PathBuf>,
    duration_seconds: f64,
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

fn cancelled_exports() -> &'static Mutex<HashSet<String>> {
    CANCELLED_EXPORTS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn mark_export_cancelled(export_id: &str) -> Result<(), String> {
    let mut cancelled = cancelled_exports()
        .lock()
        .map_err(|_| "취소 상태를 잠그지 못했습니다.".to_string())?;
    cancelled.insert(export_id.to_string());
    Ok(())
}

fn clear_export_cancelled(export_id: &str) {
    if let Ok(mut cancelled) = cancelled_exports().lock() {
        cancelled.remove(export_id);
    }
}

fn is_export_cancelled(export_id: &str) -> bool {
    cancelled_exports()
        .lock()
        .map(|cancelled| cancelled.contains(export_id))
        .unwrap_or(false)
}

fn check_export_cancelled(export_id: &str) -> Result<(), String> {
    if is_export_cancelled(export_id) {
        Err("영상 내보내기를 취소했습니다.".to_string())
    } else {
        Ok(())
    }
}

fn emit_export_progress(
    app: &AppHandle,
    export_id: &str,
    phase: &str,
    message: &str,
    current: usize,
    total: usize,
) {
    let _ = app.emit(
        VIDEO_EXPORT_PROGRESS_EVENT,
        VideoExportProgress {
            export_id: export_id.to_string(),
            phase: phase.to_string(),
            message: message.to_string(),
            current,
            total: total.max(1),
        },
    );
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

fn copy_asset_into_project(
    app: &AppHandle,
    project_id: &str,
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

    let assets_dir = project_assets_dir(app, project_id)?;
    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;
    let assets_root = assets_dir
        .canonicalize()
        .unwrap_or_else(|_| assets_dir.clone());
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

fn materialize_project_assets(
    app: &AppHandle,
    project_id: &str,
    mut data: Value,
) -> Result<Value, String> {
    if let Some(settings) = data.get_mut("settings").and_then(Value::as_object_mut) {
        if let Some(music) = settings
            .get_mut("backgroundMusic")
            .and_then(Value::as_object_mut)
        {
            if let Some(path_value) = music.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(copied) = copy_asset_into_project(app, project_id, path, false)? {
                        *path_value = Value::String(copied.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    let Some(slides) = data.get_mut("slides").and_then(Value::as_array_mut) else {
        return Ok(data);
    };

    for slide in slides {
        if let Some(video) = slide.get_mut("video").and_then(Value::as_object_mut) {
            if let Some(path_value) = video.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(copied) = copy_asset_into_project(app, project_id, path, false)? {
                        *path_value = Value::String(copied.to_string_lossy().to_string());
                    }
                }
            }
        }

        if let Some(sound) = slide.get_mut("startSound").and_then(Value::as_object_mut) {
            if let Some(path_value) = sound.get_mut("path") {
                if let Some(path) = path_value.as_str() {
                    if let Some(copied) = copy_asset_into_project(app, project_id, path, false)? {
                        *path_value = Value::String(copied.to_string_lossy().to_string());
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
                        if let Some(copied) = copy_asset_into_project(app, project_id, src, false)?
                        {
                            *src_value = Value::String(copied.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

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
fn list_projects(app: AppHandle) -> Result<Vec<ProjectMeta>, String> {
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
fn save_project(app: AppHandle, payload: SaveProjectPayload) -> Result<ProjectRecord, String> {
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
    let copy_data = materialize_project_assets(&app, &copy_id, source_data)?;
    write_json(dir.join(PROJECT_FILE), &copy_data)?;
    write_json(dir.join(META_FILE), &copy_meta)?;
    Ok(copy_meta)
}

#[tauri::command]
fn import_project_asset(
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
fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let dir = project_dir(&app, &id)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn write_project_file(path: String, data: Value) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("저장 경로를 읽지 못했습니다.".to_string());
    }
    write_json(PathBuf::from(path), &data)
}

#[tauri::command]
fn read_project_file(path: String) -> Result<ProjectRecord, String> {
    if path.trim().is_empty() {
        return Err("파일 경로를 읽지 못했습니다.".to_string());
    }
    let path = PathBuf::from(path);
    let data: Value = read_json(path.clone())?;
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
    Ok(ProjectRecord { meta, data })
}

#[tauri::command]
fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = app_settings_path(&app)?;
    if !path.exists() {
        return Ok(clean_app_settings(&app, AppSettings::default()));
    }
    let settings: AppSettings = read_json(path)?;
    Ok(clean_app_settings(&app, settings))
}

#[tauri::command]
fn get_default_export_dir(app: AppHandle) -> Result<String, String> {
    Ok(default_export_dir(&app))
}

#[tauri::command]
fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let settings = clean_app_settings(&app, settings);
    write_json(app_settings_path(&app)?, &settings)?;
    Ok(settings)
}

#[tauri::command]
fn cancel_video_export(export_id: String) -> Result<(), String> {
    if export_id.trim().is_empty() {
        return Ok(());
    }
    mark_export_cancelled(&export_id)
}

fn app_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|error| error.to_string())
}

fn decode_png_data_url(value: &str) -> Result<Vec<u8>, String> {
    let (_, encoded) = value
        .split_once(',')
        .ok_or_else(|| "PNG 프레임 데이터가 올바르지 않습니다.".to_string())?;
    general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("PNG 프레임을 디코딩하지 못했습니다: {error}"))
}

fn quote_curl_value(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn format_seconds(value: f64) -> String {
    format!("{:.3}", value.max(0.1))
}

fn even_dimension(value: u32) -> u32 {
    let value = value.clamp(2, 8192);
    if value % 2 == 0 {
        value
    } else {
        value - 1
    }
}

fn command_runs(path: &Path, version_arg: &str) -> bool {
    Command::new(path)
        .arg(version_arg)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn command_name_runs(name: &str, version_arg: &str) -> bool {
    Command::new(name)
        .arg(version_arg)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn find_tool(name: &str, env_name: &str, version_arg: &str) -> Result<PathBuf, String> {
    if let Ok(configured) = env::var(env_name) {
        let path = PathBuf::from(configured);
        if command_runs(&path, version_arg) {
            return Ok(path);
        }
    }

    let common_paths = [
        PathBuf::from(format!("/opt/homebrew/bin/{name}")),
        PathBuf::from(format!("/usr/local/bin/{name}")),
        PathBuf::from(format!("/usr/bin/{name}")),
    ];
    for path in common_paths {
        if command_runs(&path, version_arg) {
            return Ok(path);
        }
    }

    if command_name_runs(name, version_arg) {
        return Ok(PathBuf::from(name));
    }

    Err(format!(
        "{name}를 찾지 못했습니다. {env_name} 환경 변수나 PATH에 {name} 실행 파일을 연결해 주세요."
    ))
}

fn run_command(mut command: Command, label: &str, export_id: &str) -> Result<(), String> {
    check_export_cancelled(export_id)?;
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("{label} 실행에 실패했습니다: {error}"))?;
    loop {
        if is_export_cancelled(export_id) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("영상 내보내기를 취소했습니다.".to_string());
        }
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => thread::sleep(Duration::from_millis(120)),
            Err(error) => return Err(format!("{label} 상태를 확인하지 못했습니다: {error}")),
        }
    }
    let output = child
        .wait_with_output()
        .map_err(|error| format!("{label} 결과를 읽지 못했습니다: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("종료 코드 {:?}", output.status.code())
    };
    Err(format!("{label} 실패: {detail}"))
}

fn command_output(mut command: Command, label: &str) -> Result<String, String> {
    let output = command
        .output()
        .map_err(|error| format!("{label} 실행에 실패했습니다: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("{label} 실패")
        } else {
            stderr
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn git_output(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    command.arg("-C").arg(repo_path).args(args);
    command_output(command, "Git")
}

fn truncate_git_content(content: String) -> String {
    if content.chars().count() > 12000 {
        format!(
            "{}\n\n... truncated ...",
            content.chars().take(12000).collect::<String>()
        )
    } else {
        content
    }
}

fn resolve_git_root(repo_path: &str) -> Result<PathBuf, String> {
    if repo_path.trim().is_empty() {
        return Err("Git 저장소 경로가 없습니다.".to_string());
    }
    let input_path = PathBuf::from(repo_path.trim());
    let root = git_output(&input_path, &["rev-parse", "--show-toplevel"])?;
    let root = root.trim();
    if root.is_empty() {
        return Err("Git 저장소 루트를 찾지 못했습니다.".to_string());
    }
    Ok(PathBuf::from(root))
}

fn verify_commit(root: &Path, commit_hash: &str) -> Result<String, String> {
    let trimmed = commit_hash.trim();
    if trimmed.is_empty() {
        return Err("커밋을 선택해 주세요.".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("올바르지 않은 커밋 값입니다.".to_string());
    }
    let spec = format!("{trimmed}^{{commit}}");
    let commit = git_output(root, &["rev-parse", "--verify", &spec])?;
    Ok(commit.trim().to_string())
}

#[tauri::command]
fn list_git_commits(repo_path: String) -> Result<GitCommitList, String> {
    let root = resolve_git_root(&repo_path)?;
    let output = git_output(
        &root,
        &[
            "log",
            "--date=short",
            "--pretty=format:%H%x1f%h%x1f%ad%x1f%s",
            "-n",
            "80",
        ],
    )?;
    let commits = output
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(4, '\u{1f}');
            let hash = parts.next()?.trim();
            let short_hash = parts.next()?.trim();
            let date = parts.next()?.trim();
            let subject = parts.next().unwrap_or("").trim();
            if hash.is_empty() {
                return None;
            }
            Some(GitCommit {
                hash: hash.to_string(),
                label: format!("{short_hash} · {date} · {subject}"),
            })
        })
        .collect();

    Ok(GitCommitList {
        repo_path: root.to_string_lossy().to_string(),
        commits,
    })
}

#[tauri::command]
fn list_git_commit_files(repo_path: String, commit_hash: String) -> Result<GitFileList, String> {
    let root = resolve_git_root(&repo_path)?;
    let commit = verify_commit(&root, &commit_hash)?;
    let output = git_output(
        &root,
        &[
            "diff-tree",
            "--root",
            "--no-commit-id",
            "--name-only",
            "-r",
            &commit,
        ],
    )?;
    let mut files: Vec<String> = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect();
    files.sort();
    files.dedup();

    Ok(GitFileList {
        repo_path: root.to_string_lossy().to_string(),
        commit_hash: commit,
        files,
    })
}

#[tauri::command]
fn read_git_commit_file_change(
    repo_path: String,
    commit_hash: String,
    file_path: String,
) -> Result<GitChanges, String> {
    let root = resolve_git_root(&repo_path)?;
    let commit = verify_commit(&root, &commit_hash)?;
    let file_path = file_path.trim().to_string();
    if file_path.is_empty() {
        return Err("파일을 선택해 주세요.".to_string());
    }

    let short_hash = git_output(&root, &["rev-parse", "--short", &commit])
        .map(|value| value.trim().to_string())
        .unwrap_or_else(|_| commit.chars().take(12).collect());
    let parent_line = git_output(&root, &["rev-list", "--parents", "-n", "1", &commit])?;
    let parent_commit = parent_line
        .split_whitespace()
        .nth(1)
        .map(ToString::to_string);
    let name_status = git_output(
        &root,
        &[
            "diff-tree",
            "--root",
            "--no-commit-id",
            "--name-status",
            "-r",
            "--find-renames",
            &commit,
            "--",
            &file_path,
        ],
    )
    .unwrap_or_default();
    let before_path = name_status
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            let status = parts.first().copied().unwrap_or_default();
            if status.starts_with('R') && parts.len() >= 3 {
                Some(parts[1].to_string())
            } else if parts.len() >= 2 {
                Some(parts[1].to_string())
            } else {
                None
            }
        })
        .next()
        .unwrap_or_else(|| file_path.clone());
    let after_content =
        git_output(&root, &["show", &format!("{commit}:{file_path}")]).unwrap_or_default();
    let before_content = parent_commit
        .as_deref()
        .and_then(|parent| git_output(&root, &["show", &format!("{parent}:{before_path}")]).ok())
        .unwrap_or_default();
    let stat = git_output(
        &root,
        &[
            "show",
            "--no-ext-diff",
            "--format=fuller",
            "--stat",
            "--find-renames",
            &commit,
            "--",
            &file_path,
        ],
    )?;
    let patch = git_output(
        &root,
        &[
            "show",
            "--no-ext-diff",
            "--format=",
            "--find-renames",
            "--patch",
            &commit,
            "--",
            &file_path,
        ],
    )
    .unwrap_or_default();

    let mut content = String::new();
    content.push_str(&format!("$ git show --stat {short_hash} -- {file_path}\n"));
    content.push_str(stat.trim_end());
    content.push_str(&format!(
        "\n\n$ git show --patch {short_hash} -- {file_path}\n"
    ));
    content.push_str(if patch.trim().is_empty() {
        "No textual patch for this file."
    } else {
        patch.trim_end()
    });

    Ok(GitChanges {
        repo_path: root.to_string_lossy().to_string(),
        commit_hash: commit,
        file_path: file_path.clone(),
        title: format!("{short_hash} · {file_path}"),
        content: truncate_git_content(content),
        before_content: truncate_git_content(before_content),
        after_content: truncate_git_content(after_content),
        before_path,
    })
}

fn normalized_tts_provider(settings: &TtsSettings) -> &'static str {
    let provider = settings
        .provider
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if provider == "minimax" {
        "minimax"
    } else {
        "openai"
    }
}

fn openai_tts_value(settings: &TtsSettings, notes: &str) -> Value {
    let model = settings
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("gpt-4o-mini-tts");
    let voice = settings
        .voice
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("sage");
    let speed = settings.speed.unwrap_or(1.0).clamp(0.25, 4.0);
    let mut value = serde_json::json!({
        "model": model,
        "input": notes,
        "voice": voice,
        "response_format": "mp3",
        "speed": speed
    });

    let instructions = settings.instructions.as_deref().unwrap_or("").trim();
    if !instructions.is_empty() && model.starts_with("gpt-4o-mini-tts") {
        value["instructions"] = Value::String(instructions.to_string());
    }
    value
}

fn minimax_tts_value(settings: &TtsSettings, notes: &str) -> Value {
    let model = settings
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("speech-2.8-turbo");
    let voice = settings
        .voice
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Korean_SweetGirl");
    let speed = settings.speed.unwrap_or(1.0).clamp(0.5, 2.0);
    serde_json::json!({
        "model": model,
        "text": notes,
        "stream": false,
        "language_boost": "auto",
        "output_format": "hex",
        "voice_setting": {
            "voice_id": voice,
            "speed": speed,
            "vol": 1,
            "pitch": 0
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1
        }
    })
}

fn tts_value(settings: &TtsSettings, notes: &str) -> Value {
    let provider = normalized_tts_provider(settings);
    let request = if provider == "minimax" {
        minimax_tts_value(settings, notes)
    } else {
        openai_tts_value(settings, notes)
    };
    serde_json::json!({
        "provider": provider,
        "request": request
    })
}

fn tts_cache_path(app: &AppHandle, settings: &TtsSettings, notes: &str) -> Result<PathBuf, String> {
    let cache_root = app_cache_dir(app)?.join("tts-cache");
    fs::create_dir_all(&cache_root).map_err(|error| error.to_string())?;
    let key_source = tts_value(settings, notes).to_string();
    let digest = Sha256::digest(key_source.as_bytes());
    Ok(cache_root.join(format!("{}.mp3", hex::encode(digest))))
}

fn resolve_api_key(
    app: &AppHandle,
    settings: &TtsSettings,
    provider: &str,
) -> Result<String, String> {
    let direct_key = settings.api_key.as_deref().unwrap_or("").trim();
    if !direct_key.is_empty() {
        return Ok(direct_key.to_string());
    }
    if let Ok(app_settings) = get_app_settings(app.clone()) {
        let saved_key = if provider == "minimax" {
            app_settings.mini_max_api_key.trim()
        } else {
            app_settings.open_ai_api_key.trim()
        };
        if !saved_key.is_empty() {
            return Ok(saved_key.to_string());
        }
    }
    let env_key = if provider == "minimax" {
        "MINIMAX_API_KEY"
    } else {
        "OPENAI_API_KEY"
    };
    env::var(env_key)
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            if provider == "minimax" {
                "TTS 생성을 위해 MiniMax API Key가 필요합니다.".to_string()
            } else {
                "TTS 생성을 위해 OpenAI API Key가 필요합니다.".to_string()
            }
        })
}

fn tts_request_id(settings: &TtsSettings, notes: &str) -> String {
    hex::encode(Sha256::digest(
        tts_value(settings, notes).to_string().as_bytes(),
    ))
}

fn run_openai_tts_request(
    curl: &Path,
    work_dir: &Path,
    api_key: &str,
    request_id: &str,
    request_value: &Value,
    cache_path: &Path,
    export_id: &str,
) -> Result<(), String> {
    let request_path = work_dir.join(format!("speech-request-{request_id}.json"));
    let config_path = work_dir.join(format!("speech-curl-{request_id}.conf"));
    write_json(request_path.clone(), request_value)?;
    let config = format!(
        "url = \"https://api.openai.com/v1/audio/speech\"\nrequest = \"POST\"\nheader = \"Authorization: Bearer {}\"\nheader = \"Content-Type: application/json\"\ndata-binary = \"@{}\"\noutput = \"{}\"\nfail\nsilent\nshow-error\nlocation\n",
        quote_curl_value(api_key),
        quote_curl_value(&request_path.to_string_lossy()),
        quote_curl_value(&cache_path.to_string_lossy())
    );
    fs::write(&config_path, config).map_err(|error| error.to_string())?;

    let mut command = Command::new(curl);
    command.arg("-K").arg(&config_path);
    let result = run_command(command, "OpenAI TTS 요청", export_id);
    let _ = fs::remove_file(&config_path);
    let _ = fs::remove_file(&request_path);
    result
}

fn run_minimax_tts_request(
    curl: &Path,
    work_dir: &Path,
    api_key: &str,
    request_id: &str,
    request_value: &Value,
    cache_path: &Path,
    export_id: &str,
) -> Result<(), String> {
    let request_path = work_dir.join(format!("speech-request-{request_id}.json"));
    let response_path = work_dir.join(format!("speech-response-{request_id}.json"));
    let config_path = work_dir.join(format!("speech-curl-{request_id}.conf"));
    write_json(request_path.clone(), request_value)?;
    let config = format!(
        "url = \"https://api.minimax.io/v1/t2a_v2\"\nrequest = \"POST\"\nheader = \"Authorization: Bearer {}\"\nheader = \"Content-Type: application/json\"\ndata-binary = \"@{}\"\noutput = \"{}\"\nfail\nsilent\nshow-error\nlocation\n",
        quote_curl_value(api_key),
        quote_curl_value(&request_path.to_string_lossy()),
        quote_curl_value(&response_path.to_string_lossy())
    );
    fs::write(&config_path, config).map_err(|error| error.to_string())?;

    let mut command = Command::new(curl);
    command.arg("-K").arg(&config_path);
    let result = run_command(command, "MiniMax TTS 요청", export_id);
    let _ = fs::remove_file(&config_path);
    let _ = fs::remove_file(&request_path);
    result?;

    let response_text = fs::read_to_string(&response_path).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&response_path);
    let response: Value = serde_json::from_str(&response_text)
        .map_err(|error| format!("MiniMax TTS 응답을 읽지 못했습니다: {error}"))?;

    let status_code = response
        .pointer("/base_resp/status_code")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    if status_code != 0 {
        let status_msg = response
            .pointer("/base_resp/status_msg")
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        return Err(format!(
            "MiniMax TTS 요청 실패: {status_msg} ({status_code})"
        ));
    }

    let audio_hex = response
        .pointer("/data/audio")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if audio_hex.is_empty() {
        return Err("MiniMax TTS 응답에 오디오 데이터가 없습니다.".to_string());
    }

    let audio_bytes = hex::decode(audio_hex)
        .map_err(|error| format!("MiniMax 오디오를 디코딩하지 못했습니다: {error}"))?;
    fs::write(cache_path, audio_bytes).map_err(|error| error.to_string())
}

fn generate_tts_audio(
    app: &AppHandle,
    curl: &Path,
    work_dir: &Path,
    settings: &TtsSettings,
    notes: &str,
    export_id: &str,
) -> Result<PathBuf, String> {
    check_export_cancelled(export_id)?;
    let notes = notes.trim();
    let provider = normalized_tts_provider(settings);
    let max_chars = if provider == "minimax" { 10_000 } else { 4096 };
    if notes.chars().count() > max_chars {
        return Err(format!(
            "슬라이드 노트는 TTS 한 번당 {max_chars}자 이하여야 합니다."
        ));
    }
    let cache_path = tts_cache_path(app, settings, notes)?;
    if cache_path.exists() {
        return Ok(cache_path);
    }

    let api_key = resolve_api_key(app, settings, provider)?;
    let request_id = tts_request_id(settings, notes);
    if provider == "minimax" {
        run_minimax_tts_request(
            curl,
            work_dir,
            &api_key,
            &request_id,
            &minimax_tts_value(settings, notes),
            &cache_path,
            export_id,
        )?;
    } else {
        run_openai_tts_request(
            curl,
            work_dir,
            &api_key,
            &request_id,
            &openai_tts_value(settings, notes),
            &cache_path,
            export_id,
        )?;
    }

    if !cache_path.exists() {
        return Err("TTS 오디오 파일을 생성하지 못했습니다.".to_string());
    }
    Ok(cache_path)
}

fn create_silence_audio(
    ffmpeg: &Path,
    path: &Path,
    duration_seconds: f64,
    export_id: &str,
) -> Result<(), String> {
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-f", "lavfi"])
        .arg("-i")
        .arg("anullsrc=channel_layout=stereo:sample_rate=44100")
        .arg("-t")
        .arg(format_seconds(duration_seconds))
        .args(["-c:a", "aac", "-b:a", "128k"])
        .arg(path);
    run_command(command, "무음 오디오 생성", export_id)
}

fn mix_start_sound(
    ffmpeg: &Path,
    base_audio_path: &Path,
    sound_path: &Path,
    output_path: &Path,
    duration_seconds: f64,
    export_id: &str,
) -> Result<(), String> {
    let duration = format_seconds(duration_seconds);
    let filter = format!(
        "[0:a]aresample=44100,aformat=channel_layouts=stereo,apad[a0];[1:a]aresample=44100,aformat=channel_layouts=stereo,apad[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:{duration},asetpts=N/SR/TB[a]"
    );
    let mut command = Command::new(ffmpeg);
    command
        .arg("-y")
        .arg("-i")
        .arg(base_audio_path)
        .arg("-i")
        .arg(sound_path)
        .arg("-filter_complex")
        .arg(filter)
        .args(["-map", "[a]", "-t"])
        .arg(duration)
        .args(["-c:a", "aac", "-b:a", "192k"])
        .arg(output_path);
    run_command(command, "슬라이드 시작 효과음 믹스", export_id)
}

fn mix_background_music(
    ffmpeg: &Path,
    video_path: &Path,
    music_path: &Path,
    output_path: &Path,
    export_id: &str,
) -> Result<(), String> {
    let filter = "[0:a]aresample=44100,aformat=channel_layouts=stereo[a0];[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.32[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]";
    let mut command = Command::new(ffmpeg);
    command
        .arg("-y")
        .arg("-i")
        .arg(video_path)
        .args(["-stream_loop", "-1"])
        .arg("-i")
        .arg(music_path)
        .arg("-filter_complex")
        .arg(filter)
        .args(["-map", "0:v", "-map", "[a]", "-c:v", "copy"])
        .args(["-c:a", "aac", "-b:a", "192k", "-shortest"])
        .args(["-movflags", "+faststart"])
        .arg(output_path);
    run_command(command, "프로젝트 배경음 믹스", export_id)
}

fn probe_audio_duration(ffprobe: &Path, path: &Path, fallback: f64) -> Result<f64, String> {
    let output = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(path)
        .output()
        .map_err(|error| format!("오디오 길이를 읽지 못했습니다: {error}"))?;
    if !output.status.success() {
        return Ok(fallback);
    }
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text.trim().parse::<f64>().unwrap_or(fallback).max(0.5))
}

fn create_static_segment(
    ffmpeg: &Path,
    prepared: &PreparedSlide,
    output_path: &Path,
    width: u32,
    height: u32,
    fps: u32,
    export_id: &str,
) -> Result<(), String> {
    let filter = format!(
        "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p"
    );
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-loop", "1"])
        .arg("-i")
        .arg(&prepared.frame_path)
        .arg("-i")
        .arg(&prepared.audio_path)
        .arg("-t")
        .arg(format_seconds(prepared.duration_seconds))
        .arg("-vf")
        .arg(filter)
        .args([
            "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
        ])
        .arg("-r")
        .arg(fps.to_string())
        .args(["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"])
        .args(["-shortest", "-movflags", "+faststart"])
        .arg(output_path);
    run_command(command, "정적 슬라이드 세그먼트 생성", export_id)
}

fn create_video_segment(
    ffmpeg: &Path,
    prepared: &PreparedSlide,
    output_path: &Path,
    width: u32,
    height: u32,
    fps: u32,
    export_id: &str,
) -> Result<(), String> {
    let video_path = prepared
        .video_path
        .as_ref()
        .ok_or_else(|| "영상 소스 경로가 없습니다.".to_string())?;
    let filter = format!(
        "[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1[bg];[1:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba[fg];[bg][fg]overlay=0:0,format=yuv420p[v]"
    );
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-stream_loop", "-1"])
        .arg("-i")
        .arg(video_path)
        .args(["-loop", "1"])
        .arg("-i")
        .arg(&prepared.frame_path)
        .arg("-i")
        .arg(&prepared.audio_path)
        .arg("-t")
        .arg(format_seconds(prepared.duration_seconds))
        .arg("-filter_complex")
        .arg(filter)
        .args([
            "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "veryfast",
        ])
        .arg("-r")
        .arg(fps.to_string())
        .args(["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"])
        .args(["-shortest", "-movflags", "+faststart"])
        .arg(output_path);
    run_command(command, "영상 배경 슬라이드 세그먼트 생성", export_id)
}

fn create_animation_segment(
    ffmpeg: &Path,
    prepared: &PreparedSlide,
    output_path: &Path,
    width: u32,
    height: u32,
    fps: u32,
    export_id: &str,
) -> Result<(), String> {
    let frame_paths = prepared
        .animation_frame_paths
        .as_ref()
        .ok_or_else(|| "애니메이션 프레임이 없습니다.".to_string())?;
    if frame_paths.is_empty() {
        return Err("애니메이션 프레임이 없습니다.".to_string());
    }
    let first_frame = frame_paths
        .first()
        .and_then(|path| path.parent())
        .ok_or_else(|| "애니메이션 프레임 경로가 올바르지 않습니다.".to_string())?
        .join("frame-%05d.png");
    let frame_duration = frame_paths.len() as f64 / prepared.frame_rate.max(1.0);
    let stop_duration = (prepared.duration_seconds - frame_duration).max(0.0);
    let filter = format!(
        "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,tpad=stop_mode=clone:stop_duration={},format=yuv420p",
        format_seconds(stop_duration)
    );
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-framerate"])
        .arg(format_seconds(prepared.frame_rate))
        .arg("-i")
        .arg(first_frame)
        .arg("-i")
        .arg(&prepared.audio_path)
        .arg("-t")
        .arg(format_seconds(prepared.duration_seconds))
        .arg("-vf")
        .arg(filter)
        .arg("-af")
        .arg("apad")
        .args([
            "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
        ])
        .arg("-r")
        .arg(fps.to_string())
        .args(["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"])
        .args(["-movflags", "+faststart"])
        .arg(output_path);
    run_command(command, "타이핑 슬라이드 세그먼트 생성", export_id)
}

fn concat_segments(
    ffmpeg: &Path,
    work_dir: &Path,
    segments: &[PathBuf],
    output_path: &Path,
    export_id: &str,
) -> Result<(), String> {
    let filelist_path = work_dir.join("segments.txt");
    let mut filelist = String::new();
    for segment in segments {
        let path = segment.to_string_lossy().replace('\'', "'\\''");
        filelist.push_str(&format!("file '{}'\n", path));
    }
    fs::write(&filelist_path, filelist).map_err(|error| error.to_string())?;
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-f", "concat", "-safe", "0"])
        .arg("-i")
        .arg(&filelist_path)
        .args(["-c", "copy", "-movflags", "+faststart"])
        .arg(output_path);
    run_command(command, "영상 세그먼트 병합", export_id)
}

#[tauri::command]
fn export_video(app: AppHandle, payload: VideoExportPayload) -> Result<VideoExportResult, String> {
    let export_id = if payload.export_id.trim().is_empty() {
        format!("video-export-{}", now_millis()?)
    } else {
        payload.export_id.clone()
    };
    clear_export_cancelled(&export_id);
    let result = (|| {
        if payload.slides.is_empty() {
            return Err("추출할 슬라이드가 없습니다.".to_string());
        }
        if payload.output_path.trim().is_empty() {
            return Err("영상 저장 경로가 없습니다.".to_string());
        }

        emit_export_progress(
            &app,
            &export_id,
            "Preparing",
            "FFmpeg 도구를 확인하고 있습니다.",
            0,
            1,
        );
        let ffmpeg = find_tool("ffmpeg", "SIMPLE_SLIDE_FFMPEG", "-version")?;
        let ffprobe = find_tool("ffprobe", "SIMPLE_SLIDE_FFPROBE", "-version")?;
        let needs_tts = payload
            .slides
            .iter()
            .any(|slide| !slide.notes.trim().is_empty());
        check_export_cancelled(&export_id)?;
        let curl = if needs_tts {
            Some(find_tool("curl", "SIMPLE_SLIDE_CURL", "--version")?)
        } else {
            None
        };

        let work_dir = app_cache_dir(&app)?
            .join("video-export")
            .join(format!("work-{}", now_millis()?));
        fs::create_dir_all(&work_dir).map_err(|error| error.to_string())?;
        let fps = payload.fps.unwrap_or(30).clamp(1, 60);
        let fallback_duration = payload
            .fallback_duration_seconds
            .unwrap_or(3.0)
            .clamp(1.0, 30.0);
        let width = even_dimension(payload.slides[0].width);
        let height = even_dimension(payload.slides[0].height);

        let mut prepared_slides = Vec::new();
        for (index, slide) in payload.slides.iter().enumerate() {
            check_export_cancelled(&export_id)?;
            emit_export_progress(
                &app,
                &export_id,
                "Audio",
                &format!(
                    "슬라이드 {} / {} 오디오를 준비하고 있습니다.",
                    index + 1,
                    payload.slides.len()
                ),
                index,
                payload.slides.len(),
            );
            let frame_path = work_dir.join(format!("frame-{index:04}.png"));
            fs::write(&frame_path, decode_png_data_url(&slide.frame_png)?)
                .map_err(|error| error.to_string())?;
            let animation_frame_paths = if let Some(frames) = slide.animation_frames.as_ref() {
                if frames.is_empty() {
                    None
                } else {
                    let frame_dir = work_dir.join(format!("animation-{index:04}"));
                    fs::create_dir_all(&frame_dir).map_err(|error| error.to_string())?;
                    let mut paths = Vec::with_capacity(frames.len());
                    for (frame_index, frame_data) in frames.iter().enumerate() {
                        check_export_cancelled(&export_id)?;
                        let path = frame_dir.join(format!("frame-{frame_index:05}.png"));
                        fs::write(&path, decode_png_data_url(frame_data)?)
                            .map_err(|error| error.to_string())?;
                        paths.push(path);
                    }
                    Some(paths)
                }
            } else {
                None
            };

            let trimmed_notes = slide.notes.trim();
            let audio_path = if trimmed_notes.is_empty() {
                let path = work_dir.join(format!("silence-{index:04}.m4a"));
                create_silence_audio(&ffmpeg, &path, fallback_duration, &export_id)?;
                path
            } else {
                generate_tts_audio(
                    &app,
                    curl.as_ref().unwrap(),
                    &work_dir,
                    &payload.tts,
                    trimmed_notes,
                    &export_id,
                )?
            };
            let base_audio_duration = if trimmed_notes.is_empty() {
                fallback_duration
            } else {
                probe_audio_duration(&ffprobe, &audio_path, fallback_duration)?
            };
            let start_sound_path = slide
                .start_sound_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .map(PathBuf::from);
            let start_sound_duration = if let Some(path) = start_sound_path.as_ref() {
                if !path.exists() {
                    return Err(format!(
                        "효과음 파일을 찾지 못했습니다: {}",
                        path.to_string_lossy()
                    ));
                }
                Some(probe_audio_duration(&ffprobe, path, 0.5)?)
            } else {
                None
            };
            let frame_rate = slide.frame_rate.unwrap_or(8.0).clamp(1.0, 30.0);
            let animation_duration = slide
                .animation_duration_seconds
                .filter(|duration| duration.is_finite())
                .map(|duration| duration.clamp(0.5, 120.0))
                .or_else(|| {
                    animation_frame_paths
                        .as_ref()
                        .map(|frames| frames.len() as f64 / frame_rate)
                });
            let duration = if slide.end_on_tts_end.unwrap_or(false) {
                base_audio_duration
            } else {
                base_audio_duration
                    .max(animation_duration.unwrap_or(0.0))
                    .max(start_sound_duration.unwrap_or(0.0))
            };
            let audio_path = if let Some(sound_path) = start_sound_path.as_ref() {
                let mixed_path = work_dir.join(format!("mixed-audio-{index:04}.m4a"));
                mix_start_sound(
                    &ffmpeg,
                    &audio_path,
                    sound_path,
                    &mixed_path,
                    duration,
                    &export_id,
                )?;
                mixed_path
            } else {
                audio_path
            };
            let video_path = slide
                .video_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .map(PathBuf::from);
            if let Some(path) = video_path.as_ref() {
                if !path.exists() {
                    return Err(format!(
                        "영상 파일을 찾지 못했습니다: {}",
                        path.to_string_lossy()
                    ));
                }
            }
            prepared_slides.push(PreparedSlide {
                frame_path,
                animation_frame_paths,
                frame_rate,
                audio_path,
                video_path,
                duration_seconds: duration,
            });
        }

        let mut segments = Vec::new();
        for (index, prepared) in prepared_slides.iter().enumerate() {
            check_export_cancelled(&export_id)?;
            emit_export_progress(
                &app,
                &export_id,
                "Encoding",
                &format!(
                    "슬라이드 {} / {} 영상 세그먼트를 생성하고 있습니다.",
                    index + 1,
                    prepared_slides.len()
                ),
                index,
                prepared_slides.len(),
            );
            let segment_path = work_dir.join(format!("segment-{index:04}.mp4"));
            if prepared.animation_frame_paths.is_some() {
                create_animation_segment(
                    &ffmpeg,
                    prepared,
                    &segment_path,
                    width,
                    height,
                    fps,
                    &export_id,
                )?;
            } else if prepared.video_path.is_some() {
                create_video_segment(
                    &ffmpeg,
                    prepared,
                    &segment_path,
                    width,
                    height,
                    fps,
                    &export_id,
                )?;
            } else {
                create_static_segment(
                    &ffmpeg,
                    prepared,
                    &segment_path,
                    width,
                    height,
                    fps,
                    &export_id,
                )?;
            }
            segments.push(segment_path);
        }

        check_export_cancelled(&export_id)?;
        emit_export_progress(
            &app,
            &export_id,
            "Finalizing",
            "영상 파일을 병합하고 있습니다.",
            0,
            1,
        );
        let output_path = PathBuf::from(payload.output_path);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let background_music_path = payload
            .background_music_path
            .as_deref()
            .filter(|path| !path.trim().is_empty())
            .map(PathBuf::from);
        if let Some(path) = background_music_path.as_ref() {
            if !path.exists() {
                return Err(format!(
                    "배경음 파일을 찾지 못했습니다: {}",
                    path.to_string_lossy()
                ));
            }
        }
        if let Some(music_path) = background_music_path.as_ref() {
            let merged_path = work_dir.join("merged-without-bgm.mp4");
            concat_segments(&ffmpeg, &work_dir, &segments, &merged_path, &export_id)?;
            emit_export_progress(
                &app,
                &export_id,
                "Finalizing",
                "프로젝트 배경음을 영상에 믹스하고 있습니다.",
                1,
                1,
            );
            mix_background_music(&ffmpeg, &merged_path, music_path, &output_path, &export_id)?;
        } else {
            concat_segments(&ffmpeg, &work_dir, &segments, &output_path, &export_id)?;
        }
        emit_export_progress(
            &app,
            &export_id,
            "Complete",
            "영상 내보내기가 완료되었습니다.",
            1,
            1,
        );
        Ok(VideoExportResult {
            output_path: output_path.to_string_lossy().to_string(),
            slide_count: prepared_slides.len(),
        })
    })();
    clear_export_cancelled(&export_id);
    result
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
            import_project_asset,
            write_project_file,
            read_project_file,
            get_app_settings,
            get_default_export_dir,
            save_app_settings,
            cancel_video_export,
            list_git_commits,
            list_git_commit_files,
            read_git_commit_file_change,
            export_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Slide");
}

fn main() {
    run();
}
