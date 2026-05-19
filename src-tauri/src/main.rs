use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const PROJECTS_DIRNAME: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const META_FILE: &str = "meta.json";
const APP_SETTINGS_FILE: &str = "settings.json";
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    open_ai_api_key: String,
    tts_preset: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            open_ai_api_key: String::new(),
            tts_preset: "animeCute".to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportPayload {
    output_path: String,
    slides: Vec<VideoExportSlide>,
    tts: TtsSettings,
    fps: Option<u32>,
    fallback_duration_seconds: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoExportSlide {
    width: u32,
    height: u32,
    notes: String,
    video_path: Option<String>,
    frame_png: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TtsSettings {
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

#[derive(Debug)]
struct PreparedSlide {
    frame_path: PathBuf,
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

fn clean_app_settings(settings: AppSettings) -> AppSettings {
    let preset = match settings.tts_preset.as_str() {
        "animeTsundere" => "animeTsundere",
        _ => "animeCute",
    };
    AppSettings {
        open_ai_api_key: settings.open_ai_api_key.trim().to_string(),
        tts_preset: preset.to_string(),
    }
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
        return Ok(AppSettings::default());
    }
    let settings: AppSettings = read_json(path)?;
    Ok(clean_app_settings(settings))
}

#[tauri::command]
fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let settings = clean_app_settings(settings);
    write_json(app_settings_path(&app)?, &settings)?;
    Ok(settings)
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

fn run_command(mut command: Command, label: &str) -> Result<(), String> {
    let output = command
        .output()
        .map_err(|error| format!("{label} 실행에 실패했습니다: {error}"))?;
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

fn tts_value(settings: &TtsSettings, notes: &str) -> Value {
    let model = settings
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("gpt-4o-mini-tts");
    let voice = settings
        .voice
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("nova");
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

fn tts_cache_path(app: &AppHandle, settings: &TtsSettings, notes: &str) -> Result<PathBuf, String> {
    let cache_root = app_cache_dir(app)?.join("tts-cache");
    fs::create_dir_all(&cache_root).map_err(|error| error.to_string())?;
    let key_source = tts_value(settings, notes).to_string();
    let digest = Sha256::digest(key_source.as_bytes());
    Ok(cache_root.join(format!("{}.mp3", hex::encode(digest))))
}

fn resolve_api_key(app: &AppHandle, settings: &TtsSettings) -> Result<String, String> {
    let direct_key = settings.api_key.as_deref().unwrap_or("").trim();
    if !direct_key.is_empty() {
        return Ok(direct_key.to_string());
    }
    if let Ok(app_settings) = get_app_settings(app.clone()) {
        let saved_key = app_settings.open_ai_api_key.trim();
        if !saved_key.is_empty() {
            return Ok(saved_key.to_string());
        }
    }
    env::var("OPENAI_API_KEY")
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "TTS 생성을 위해 OpenAI API Key가 필요합니다.".to_string())
}

fn generate_tts_audio(
    app: &AppHandle,
    curl: &Path,
    work_dir: &Path,
    settings: &TtsSettings,
    notes: &str,
) -> Result<PathBuf, String> {
    let notes = notes.trim();
    if notes.chars().count() > 4096 {
        return Err("슬라이드 노트는 TTS 한 번당 4096자 이하여야 합니다.".to_string());
    }
    let cache_path = tts_cache_path(app, settings, notes)?;
    if cache_path.exists() {
        return Ok(cache_path);
    }

    let api_key = resolve_api_key(app, settings)?;
    let request_path = work_dir.join(format!(
        "speech-request-{}.json",
        hex::encode(Sha256::digest(notes.as_bytes()))
    ));
    let config_path = work_dir.join(format!(
        "speech-curl-{}.conf",
        hex::encode(Sha256::digest(request_path.to_string_lossy().as_bytes()))
    ));
    write_json(request_path.clone(), &tts_value(settings, notes))?;
    let config = format!(
        "url = \"https://api.openai.com/v1/audio/speech\"\nrequest = \"POST\"\nheader = \"Authorization: Bearer {}\"\nheader = \"Content-Type: application/json\"\ndata-binary = \"@{}\"\noutput = \"{}\"\nfail\nsilent\nshow-error\nlocation\n",
        quote_curl_value(&api_key),
        quote_curl_value(&request_path.to_string_lossy()),
        quote_curl_value(&cache_path.to_string_lossy())
    );
    fs::write(&config_path, config).map_err(|error| error.to_string())?;

    let mut command = Command::new(curl);
    command.arg("-K").arg(&config_path);
    let result = run_command(command, "OpenAI TTS 요청");
    let _ = fs::remove_file(&config_path);
    let _ = fs::remove_file(&request_path);
    result?;

    if !cache_path.exists() {
        return Err("TTS 오디오 파일을 생성하지 못했습니다.".to_string());
    }
    Ok(cache_path)
}

fn create_silence_audio(ffmpeg: &Path, path: &Path, duration_seconds: f64) -> Result<(), String> {
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-f", "lavfi"])
        .arg("-i")
        .arg("anullsrc=channel_layout=stereo:sample_rate=44100")
        .arg("-t")
        .arg(format_seconds(duration_seconds))
        .args(["-c:a", "aac", "-b:a", "128k"])
        .arg(path);
    run_command(command, "무음 오디오 생성")
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
    run_command(command, "정적 슬라이드 세그먼트 생성")
}

fn create_video_segment(
    ffmpeg: &Path,
    prepared: &PreparedSlide,
    output_path: &Path,
    width: u32,
    height: u32,
    fps: u32,
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
    run_command(command, "영상 배경 슬라이드 세그먼트 생성")
}

fn concat_segments(
    ffmpeg: &Path,
    work_dir: &Path,
    segments: &[PathBuf],
    output_path: &Path,
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
    run_command(command, "MP4 세그먼트 병합")
}

#[tauri::command]
fn export_video(app: AppHandle, payload: VideoExportPayload) -> Result<VideoExportResult, String> {
    if payload.slides.is_empty() {
        return Err("추출할 슬라이드가 없습니다.".to_string());
    }
    if payload.output_path.trim().is_empty() {
        return Err("MP4 저장 경로가 없습니다.".to_string());
    }

    let ffmpeg = find_tool("ffmpeg", "SIMPLE_SLIDE_FFMPEG", "-version")?;
    let ffprobe = find_tool("ffprobe", "SIMPLE_SLIDE_FFPROBE", "-version")?;
    let needs_tts = payload
        .slides
        .iter()
        .any(|slide| !slide.notes.trim().is_empty());
    let curl = if needs_tts {
        Some(find_tool("curl", "SIMPLE_SLIDE_CURL", "--version")?)
    } else {
        None
    };

    let export_id = format!("video-export-{}", now_millis()?);
    let work_dir = app_cache_dir(&app)?.join("video-export").join(export_id);
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
        let frame_path = work_dir.join(format!("frame-{index:04}.png"));
        fs::write(&frame_path, decode_png_data_url(&slide.frame_png)?)
            .map_err(|error| error.to_string())?;

        let trimmed_notes = slide.notes.trim();
        let audio_path = if trimmed_notes.is_empty() {
            let path = work_dir.join(format!("silence-{index:04}.m4a"));
            create_silence_audio(&ffmpeg, &path, fallback_duration)?;
            path
        } else {
            generate_tts_audio(
                &app,
                curl.as_ref().unwrap(),
                &work_dir,
                &payload.tts,
                trimmed_notes,
            )?
        };
        let duration = if trimmed_notes.is_empty() {
            fallback_duration
        } else {
            probe_audio_duration(&ffprobe, &audio_path, fallback_duration)?
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
            audio_path,
            video_path,
            duration_seconds: duration,
        });
    }

    let mut segments = Vec::new();
    for (index, prepared) in prepared_slides.iter().enumerate() {
        let segment_path = work_dir.join(format!("segment-{index:04}.mp4"));
        if prepared.video_path.is_some() {
            create_video_segment(&ffmpeg, prepared, &segment_path, width, height, fps)?;
        } else {
            create_static_segment(&ffmpeg, prepared, &segment_path, width, height, fps)?;
        }
        segments.push(segment_path);
    }

    let output_path = PathBuf::from(payload.output_path);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    concat_segments(&ffmpeg, &work_dir, &segments, &output_path)?;
    Ok(VideoExportResult {
        output_path: output_path.to_string_lossy().to_string(),
        slide_count: prepared_slides.len(),
    })
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
            write_project_file,
            read_project_file,
            get_app_settings,
            save_app_settings,
            export_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Slide");
}

fn main() {
    run();
}
