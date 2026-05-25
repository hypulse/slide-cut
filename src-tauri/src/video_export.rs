use crate::project_store::get_app_settings;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const VIDEO_EXPORT_PROGRESS_EVENT: &str = "video-export-progress";
static CANCELLED_EXPORTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VideoExportPayload {
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
pub(crate) struct VideoExportSlide {
    width: u32,
    height: u32,
    notes: String,
    video_path: Option<String>,
    video_fit: Option<String>,
    start_sound_path: Option<String>,
    frame_png: String,
    tts_segments: Option<Vec<String>>,
    animation_frames: Option<Vec<String>>,
    frame_rate: Option<f64>,
    animation_duration_seconds: Option<f64>,
    loop_animation_frames: Option<bool>,
    end_on_tts_end: Option<bool>,
    fit_animation_to_duration: Option<bool>,
    animation_affects_duration: Option<bool>,
    subtitle_enabled: Option<bool>,
    subtitle_images: Option<Vec<String>>,
    subtitle_size: Option<f64>,
    subtitle_y: Option<f64>,
    gif_overlays: Option<Vec<GifOverlay>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GifOverlay {
    src: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
    flip_x: Option<bool>,
    flip_y: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TtsSettings {
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    voice: Option<String>,
    speed: Option<f64>,
    instructions: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VideoExportResult {
    output_path: String,
    slide_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VideoExportProgress {
    export_id: String,
    phase: String,
    message: String,
    current: usize,
    total: usize,
}

#[derive(Debug)]
pub(crate) struct PreparedSlide {
    frame_path: PathBuf,
    animation_frame_paths: Option<Vec<PathBuf>>,
    frame_rate: f64,
    audio_path: PathBuf,
    video_path: Option<PathBuf>,
    video_fit: String,
    gif_overlays: Vec<PreparedGifOverlay>,
    subtitle_image_overlays: Vec<PreparedSubtitleImageOverlay>,
    subtitle_filter: Option<String>,
    duration_seconds: f64,
    fit_animation_to_duration: bool,
    loop_animation_frames: bool,
}

#[derive(Debug)]
pub(crate) struct PreparedSubtitleSegment {
    text: String,
    start_seconds: f64,
    end_seconds: f64,
}

#[derive(Debug)]
pub(crate) struct PreparedSubtitleImageOverlay {
    path: PathBuf,
    start_seconds: f64,
    end_seconds: f64,
}

#[derive(Debug)]
pub(crate) struct PreparedGifOverlay {
    path: PathBuf,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
    flip_x: bool,
    flip_y: bool,
}
const EXPORT_AUDIO_SAMPLE_RATE: &str = "44100";
const EXPORT_AUDIO_CHANNELS: &str = "2";

fn now_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
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

#[tauri::command]
pub(crate) fn cancel_video_export(export_id: String) -> Result<(), String> {
    if export_id.trim().is_empty() {
        return Ok(());
    }
    mark_export_cancelled(&export_id)
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

fn write_json<T: Serialize>(path: PathBuf, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temp_path = path.with_extension("tmp");
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(&temp_path, format!("{text}\n")).map_err(|error| error.to_string())?;
    fs::rename(temp_path, path).map_err(|error| error.to_string())
}

fn app_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|error| error.to_string())
}

fn decode_data_url(value: &str, label: &str) -> Result<Vec<u8>, String> {
    let (_, encoded) = value
        .split_once(',')
        .ok_or_else(|| format!("{label} 데이터가 올바르지 않습니다."))?;
    general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("{label} 데이터를 디코딩하지 못했습니다: {error}"))
}

fn decode_png_data_url(value: &str) -> Result<Vec<u8>, String> {
    decode_data_url(value, "PNG 프레임")
}

fn quote_curl_value(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn format_seconds(value: f64) -> String {
    format!("{:.3}", value.max(0.1))
}

fn even_dimension(value: u32) -> u32 {
    let value = value.clamp(2, 8192);
    if value.is_multiple_of(2) {
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

fn command_supports_filter(command_path: &Path, filter_name: &str) -> bool {
    let output = Command::new(command_path)
        .args(["-hide_banner", "-filters"])
        .output();
    let Ok(output) = output else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .any(|line| line.split_whitespace().nth(1) == Some(filter_name))
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
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_thread = stdout.map(|mut output| {
        thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = output.read_to_end(&mut buffer);
            buffer
        })
    });
    let stderr_thread = stderr.map(|mut output| {
        thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = output.read_to_end(&mut buffer);
            buffer
        })
    });
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
    let status = child
        .wait()
        .map_err(|error| format!("{label} 결과를 읽지 못했습니다: {error}"))?;
    let stdout = stdout_thread
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();
    let stderr = stderr_thread
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();
    if status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("종료 코드 {:?}", status.code())
    };
    Err(format!("{label} 실패: {detail}"))
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
        "[0:a]aresample=44100,aformat=channel_layouts=stereo,apad[a0];[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.35,apad[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=0:{duration},asetpts=N/SR/TB[a]"
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

fn split_notes_for_tts(notes: &str) -> Vec<String> {
    notes
        .replace("\r\n", "\n")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn get_slide_tts_segments(slide: &VideoExportSlide) -> Vec<String> {
    let segments = slide
        .tts_segments
        .as_ref()
        .map(|segments| {
            segments
                .iter()
                .map(|segment| segment.trim())
                .filter(|segment| !segment.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if segments.is_empty() {
        split_notes_for_tts(&slide.notes)
    } else {
        segments
    }
}

fn concat_tts_audio_segments(
    ffmpeg: &Path,
    work_dir: &Path,
    slide_index: usize,
    paths: &[PathBuf],
    export_id: &str,
) -> Result<PathBuf, String> {
    if paths.is_empty() {
        return Err("연결할 TTS 오디오가 없습니다.".to_string());
    }
    if paths.len() == 1 {
        return Ok(paths[0].clone());
    }

    let filelist_path = work_dir.join(format!("tts-segments-{slide_index:04}.txt"));
    let output_path = work_dir.join(format!("tts-combined-{slide_index:04}.m4a"));
    let mut filelist = String::new();
    for path in paths {
        let path = path.to_string_lossy().replace('\'', "'\\''");
        filelist.push_str(&format!("file '{}'\n", path));
    }
    fs::write(&filelist_path, filelist).map_err(|error| error.to_string())?;

    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-f", "concat", "-safe", "0"])
        .arg("-i")
        .arg(&filelist_path)
        .args([
            "-vn",
            "-ar",
            EXPORT_AUDIO_SAMPLE_RATE,
            "-ac",
            EXPORT_AUDIO_CHANNELS,
            "-c:a",
            "aac",
            "-b:a",
            "192k",
        ])
        .arg(&output_path);
    run_command(command, "TTS 오디오 조각 병합", export_id)?;
    Ok(output_path)
}

fn ass_timestamp(seconds: f64) -> String {
    let total_centiseconds = (seconds.max(0.0) * 100.0).round() as u64;
    let centiseconds = total_centiseconds % 100;
    let total_seconds = total_centiseconds / 100;
    let seconds = total_seconds % 60;
    let total_minutes = total_seconds / 60;
    let minutes = total_minutes % 60;
    let hours = total_minutes / 60;
    format!("{hours}:{minutes:02}:{seconds:02}.{centiseconds:02}")
}

fn subtitle_font_size(width: u32, size_percent: Option<f64>) -> f64 {
    let base = ((width as f64) * 0.032).round().clamp(22.0, 34.0);
    let scale = size_percent.unwrap_or(100.0).clamp(40.0, 220.0) / 100.0;
    (base * scale).round().clamp(14.0, 72.0)
}

fn subtitle_char_units(character: char) -> f64 {
    if character.is_ascii_whitespace() {
        0.35
    } else if character.is_ascii() {
        0.56
    } else {
        1.0
    }
}

fn escape_ass_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('{', "\\{")
        .replace('}', "\\}")
}

fn wrap_ass_subtitle_text(text: &str, width: u32, font_size: f64) -> String {
    let max_units = ((width as f64) * 0.74 / font_size.max(1.0)).max(8.0);
    let mut lines = Vec::new();
    let mut current = String::new();
    let mut current_units = 0.0;

    for character in text.replace("\r\n", "\n").chars() {
        if character == '\n' {
            if !current.trim().is_empty() {
                lines.push(current.trim().to_string());
            }
            current.clear();
            current_units = 0.0;
            continue;
        }

        let units = subtitle_char_units(character);
        if current_units + units > max_units && !current.trim().is_empty() {
            lines.push(current.trim().to_string());
            current.clear();
            current_units = 0.0;
        }
        current.push(character);
        current_units += units;
    }

    if !current.trim().is_empty() {
        lines.push(current.trim().to_string());
    }
    if lines.is_empty() {
        lines.push(text.trim().to_string());
    }
    if lines.len() > 2 {
        lines.truncate(2);
        if let Some(last) = lines.last_mut() {
            last.push_str("...");
        }
    }
    lines
        .into_iter()
        .map(|line| escape_ass_text(&line))
        .collect::<Vec<_>>()
        .join("\\N")
}

fn write_ass_subtitles(
    path: &Path,
    segments: &[PreparedSubtitleSegment],
    width: u32,
    height: u32,
    size_percent: Option<f64>,
    y_percent: Option<f64>,
) -> Result<(), String> {
    let font_size = subtitle_font_size(width, size_percent);
    let y = ((height as f64) * y_percent.unwrap_or(90.0).clamp(5.0, 95.0) / 100.0)
        .round()
        .clamp(1.0, height as f64);
    let margin_lr = ((width as f64) * 0.11).round() as u32;
    let mut ass = format!(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Pretendard,{font_size:.0},&H00FFFFFF,&H000000FF,&H00000000,&H33000000,-1,0,0,0,100,100,0,0,3,0,0,5,{margin_lr},{margin_lr},0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    );

    for segment in segments {
        if segment.text.trim().is_empty() || segment.end_seconds <= segment.start_seconds {
            continue;
        }
        let text = wrap_ass_subtitle_text(&segment.text, width, font_size);
        ass.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{{\\an5\\pos({:.0},{y:.0})}}{text}\n",
            ass_timestamp(segment.start_seconds),
            ass_timestamp(segment.end_seconds),
            (width as f64) / 2.0
        ));
    }

    fs::write(path, ass).map_err(|error| error.to_string())
}

fn prepare_subtitle_image_overlays(
    work_dir: &Path,
    slide_index: usize,
    images: Option<&Vec<String>>,
    segments: &[PreparedSubtitleSegment],
) -> Result<Vec<PreparedSubtitleImageOverlay>, String> {
    let Some(images) = images else {
        return Ok(Vec::new());
    };
    if images.is_empty() {
        return Ok(Vec::new());
    }
    if images.len() != segments.len() {
        return Err("자막 이미지 수가 TTS 세그먼트 수와 맞지 않습니다.".to_string());
    }

    let mut overlays = Vec::new();
    for (index, (image, segment)) in images.iter().zip(segments.iter()).enumerate() {
        if image.trim().is_empty() || segment.end_seconds <= segment.start_seconds {
            continue;
        }
        let path = work_dir.join(format!("subtitle-{slide_index:04}-{index:04}.png"));
        fs::write(&path, decode_png_data_url(image)?).map_err(|error| error.to_string())?;
        overlays.push(PreparedSubtitleImageOverlay {
            path,
            start_seconds: segment.start_seconds,
            end_seconds: segment.end_seconds,
        });
    }
    Ok(overlays)
}

fn resolve_fonts_dir(app: &AppHandle) -> Option<PathBuf> {
    let resource_fonts = app
        .path()
        .resource_dir()
        .ok()
        .map(|path| path.join("fonts"));
    if let Some(path) = resource_fonts {
        if path.exists() {
            return Some(path);
        }
    }
    let local_fonts = env::current_dir()
        .ok()
        .map(|path| path.join("tauri-dist/fonts"));
    local_fonts.filter(|path| path.exists())
}

fn escape_filter_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
}

fn build_subtitle_filter(subtitle_path: &Path, fonts_dir: Option<&Path>) -> String {
    let mut filter = format!("subtitles=filename='{}'", escape_filter_path(subtitle_path));
    if let Some(fonts_dir) = fonts_dir {
        filter.push_str(&format!(":fontsdir='{}'", escape_filter_path(fonts_dir)));
    }
    filter
}

fn sanitize_video_fit(value: Option<&str>) -> String {
    match value.unwrap_or("").trim() {
        "fit" => "fit".to_string(),
        "stretch" => "stretch".to_string(),
        _ => "fill".to_string(),
    }
}

fn background_video_filter(width: u32, height: u32, fit: &str) -> String {
    match fit {
        "fit" => format!(
            "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
        ),
        "stretch" => format!("scale={width}:{height},setsar=1"),
        _ => format!(
            "scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1"
        ),
    }
}

fn simple_video_filter(base_filter: String, prepared: &PreparedSlide) -> String {
    if let Some(subtitle_filter) = prepared.subtitle_filter.as_ref() {
        format!("{base_filter},{subtitle_filter},format=yuv420p")
    } else {
        format!("{base_filter},format=yuv420p")
    }
}

fn append_final_video_filter(filter: &mut String, input_label: &str, prepared: &PreparedSlide) {
    if let Some(subtitle_filter) = prepared.subtitle_filter.as_ref() {
        filter.push_str(&format!(
            "[{input_label}]{subtitle_filter}[subtitle0];[subtitle0]format=yuv420p[v]"
        ));
    } else {
        filter.push_str(&format!("[{input_label}]format=yuv420p[v]"));
    }
}

fn format_filter_number(value: f64) -> String {
    format!("{:.3}", value)
}

fn overlay_rotated_size(width: f64, height: f64, rotation: f64) -> (f64, f64) {
    let radians = rotation.to_radians();
    let cos = radians.cos().abs();
    let sin = radians.sin().abs();
    (width * cos + height * sin, width * sin + height * cos)
}

fn resolve_gif_overlay_path(
    work_dir: &Path,
    slide_index: usize,
    overlay_index: usize,
    overlay: &GifOverlay,
) -> Result<PathBuf, String> {
    let source = overlay.src.trim();
    if source
        .get(..source.len().min("data:image/gif".len()))
        .unwrap_or("")
        .eq_ignore_ascii_case("data:image/gif")
    {
        let bytes = decode_data_url(source, "GIF")?;
        let path = work_dir.join(format!(
            "gif-overlay-{slide_index:04}-{overlay_index:02}.gif"
        ));
        fs::write(&path, bytes).map_err(|error| error.to_string())?;
        return Ok(path);
    }

    let path = PathBuf::from(source);
    if !path.exists() {
        return Err(format!(
            "GIF 파일을 찾지 못했습니다: {}",
            path.to_string_lossy()
        ));
    }
    Ok(path)
}

fn prepare_gif_overlays(
    work_dir: &Path,
    slide_index: usize,
    overlays: Option<&Vec<GifOverlay>>,
) -> Result<Vec<PreparedGifOverlay>, String> {
    let mut prepared = Vec::new();
    for (overlay_index, overlay) in overlays.into_iter().flatten().enumerate() {
        prepared.push(PreparedGifOverlay {
            path: resolve_gif_overlay_path(work_dir, slide_index, overlay_index, overlay)?,
            x: overlay.x,
            y: overlay.y,
            width: overlay.width.max(1.0),
            height: overlay.height.max(1.0),
            rotation: overlay.rotation,
            flip_x: overlay.flip_x.unwrap_or(false),
            flip_y: overlay.flip_y.unwrap_or(false),
        });
    }
    Ok(prepared)
}

fn append_gif_inputs(command: &mut Command, overlays: &[PreparedGifOverlay]) {
    for overlay in overlays {
        command
            .args(["-stream_loop", "-1"])
            .arg("-i")
            .arg(&overlay.path);
    }
}

fn append_subtitle_image_inputs(command: &mut Command, overlays: &[PreparedSubtitleImageOverlay]) {
    for overlay in overlays {
        command.args(["-loop", "1"]).arg("-i").arg(&overlay.path);
    }
}

fn append_animation_frame_input(
    command: &mut Command,
    prepared: &PreparedSlide,
    input_frame_rate: f64,
    first_frame: &Path,
) {
    if prepared.loop_animation_frames {
        command.args(["-stream_loop", "-1"]);
    }
    command
        .args(["-framerate"])
        .arg(format_seconds(input_frame_rate))
        .arg("-i")
        .arg(first_frame);
}

fn append_gif_overlay_filters(
    filter: &mut String,
    base_label: &str,
    gif_input_start: usize,
    overlays: &[PreparedGifOverlay],
    fps: u32,
) -> String {
    let mut current_label = base_label.to_string();
    for (index, overlay) in overlays.iter().enumerate() {
        let gif_label = format!("gif{index}");
        let next_label = format!("gifbase{index}");
        let width = overlay.width.round().max(1.0);
        let height = overlay.height.round().max(1.0);
        let input_index = gif_input_start + index;
        let mut source_filter = format!("[{input_index}:v]fps={fps}",);
        if overlay.flip_x {
            source_filter.push_str(",hflip");
        }
        if overlay.flip_y {
            source_filter.push_str(",vflip");
        }
        source_filter.push_str(&format!(
            ",scale={}:{}:format=rgba",
            width as u32, height as u32
        ));
        let (overlay_width, overlay_height) = if overlay.rotation.abs() > 0.01 {
            let angle = format_filter_number(overlay.rotation.to_radians());
            source_filter.push_str(&format!(
                ",rotate={angle}:ow=rotw(iw):oh=roth(ih):fillcolor=none"
            ));
            overlay_rotated_size(width, height, overlay.rotation)
        } else {
            (width, height)
        };
        source_filter.push_str(&format!("[{gif_label}];"));
        filter.push_str(&source_filter);

        let x = overlay.x + width / 2.0 - overlay_width / 2.0;
        let y = overlay.y + height / 2.0 - overlay_height / 2.0;
        filter.push_str(&format!(
            "[{current_label}][{gif_label}]overlay={}:{}:shortest=0:format=auto[{next_label}];",
            format_filter_number(x),
            format_filter_number(y)
        ));
        current_label = next_label;
    }
    current_label
}

fn append_subtitle_image_overlay_filters(
    filter: &mut String,
    base_label: &str,
    subtitle_input_start: usize,
    overlays: &[PreparedSubtitleImageOverlay],
) -> String {
    let mut current_label = base_label.to_string();
    for (index, overlay) in overlays.iter().enumerate() {
        let input_index = subtitle_input_start + index;
        let subtitle_label = format!("subtitle{index}");
        let next_label = format!("subtitlebase{index}");
        filter.push_str(&format!("[{input_index}:v]format=rgba[{subtitle_label}];"));
        filter.push_str(&format!(
            "[{current_label}][{subtitle_label}]overlay=0:0:shortest=0:format=auto:enable='between(t,{},{})'[{next_label}];",
            format_filter_number(overlay.start_seconds),
            format_filter_number(overlay.end_seconds)
        ));
        current_label = next_label;
    }
    current_label
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
    if !prepared.gif_overlays.is_empty() || !prepared.subtitle_image_overlays.is_empty() {
        let mut filter = format!(
            "[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,format=rgba[base0];"
        );
        let gif_label = if prepared.gif_overlays.is_empty() {
            "base0".to_string()
        } else {
            append_gif_overlay_filters(&mut filter, "base0", 2, &prepared.gif_overlays, fps)
        };
        let subtitle_label = append_subtitle_image_overlay_filters(
            &mut filter,
            &gif_label,
            2 + prepared.gif_overlays.len(),
            &prepared.subtitle_image_overlays,
        );
        append_final_video_filter(&mut filter, &subtitle_label, prepared);

        let mut command = Command::new(ffmpeg);
        command
            .args(["-y", "-loop", "1"])
            .arg("-i")
            .arg(&prepared.frame_path)
            .arg("-i")
            .arg(&prepared.audio_path);
        append_gif_inputs(&mut command, &prepared.gif_overlays);
        append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
        command
            .arg("-t")
            .arg(format_seconds(prepared.duration_seconds))
            .arg("-filter_complex")
            .arg(filter)
            .args([
                "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
            ])
            .arg("-r")
            .arg(fps.to_string())
            .args([
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                EXPORT_AUDIO_SAMPLE_RATE,
                "-ac",
                EXPORT_AUDIO_CHANNELS,
            ])
            .args(["-shortest", "-movflags", "+faststart"])
            .arg(output_path);
        return run_command(command, "정적 슬라이드 세그먼트 생성", export_id);
    }

    let filter = simple_video_filter(
        format!(
            "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white"
        ),
        prepared,
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
        .args([
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            EXPORT_AUDIO_SAMPLE_RATE,
            "-ac",
            EXPORT_AUDIO_CHANNELS,
        ])
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
    let video_filter = background_video_filter(width, height, &prepared.video_fit);
    let mut filter = format!(
        "[0:v]{video_filter}[bg];[1:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba[fg];[bg][fg]overlay=0:0:format=auto[base0];"
    );
    let subtitle_label = append_subtitle_image_overlay_filters(
        &mut filter,
        "base0",
        3,
        &prepared.subtitle_image_overlays,
    );
    append_final_video_filter(&mut filter, &subtitle_label, prepared);
    let mut command = Command::new(ffmpeg);
    command
        .args(["-y", "-stream_loop", "-1"])
        .arg("-i")
        .arg(video_path)
        .args(["-loop", "1"])
        .arg("-i")
        .arg(&prepared.frame_path)
        .arg("-i")
        .arg(&prepared.audio_path);
    append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
    command
        .arg("-t")
        .arg(format_seconds(prepared.duration_seconds))
        .arg("-filter_complex")
        .arg(filter)
        .args([
            "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "veryfast",
        ])
        .arg("-r")
        .arg(fps.to_string())
        .args([
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            EXPORT_AUDIO_SAMPLE_RATE,
            "-ac",
            EXPORT_AUDIO_CHANNELS,
        ])
        .args(["-shortest", "-movflags", "+faststart"])
        .arg(output_path);
    if !prepared.gif_overlays.is_empty() {
        let video_filter = background_video_filter(width, height, &prepared.video_fit);
        let mut filter = format!(
            "[0:v]{video_filter}[bg];[1:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba[fg];[bg][fg]overlay=0:0:format=auto[base0];"
        );
        let final_label =
            append_gif_overlay_filters(&mut filter, "base0", 3, &prepared.gif_overlays, fps);
        let subtitle_label = append_subtitle_image_overlay_filters(
            &mut filter,
            &final_label,
            3 + prepared.gif_overlays.len(),
            &prepared.subtitle_image_overlays,
        );
        append_final_video_filter(&mut filter, &subtitle_label, prepared);

        let mut command = Command::new(ffmpeg);
        command
            .args(["-y", "-stream_loop", "-1"])
            .arg("-i")
            .arg(video_path)
            .args(["-loop", "1"])
            .arg("-i")
            .arg(&prepared.frame_path)
            .arg("-i")
            .arg(&prepared.audio_path);
        append_gif_inputs(&mut command, &prepared.gif_overlays);
        append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
        command
            .arg("-t")
            .arg(format_seconds(prepared.duration_seconds))
            .arg("-filter_complex")
            .arg(filter)
            .args([
                "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "veryfast",
            ])
            .arg("-r")
            .arg(fps.to_string())
            .args([
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                EXPORT_AUDIO_SAMPLE_RATE,
                "-ac",
                EXPORT_AUDIO_CHANNELS,
            ])
            .args(["-shortest", "-movflags", "+faststart"])
            .arg(output_path);
        return run_command(
            command,
            "GIF 오버레이 영상 배경 슬라이드 세그먼트 생성",
            export_id,
        );
    }
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
    let input_frame_rate = if prepared.fit_animation_to_duration {
        frame_paths.len() as f64 / prepared.duration_seconds.max(0.1)
    } else {
        prepared.frame_rate.max(1.0)
    };
    let frame_duration = if prepared.loop_animation_frames {
        prepared.duration_seconds
    } else {
        frame_paths.len() as f64 / input_frame_rate.max(0.1)
    };
    let stop_duration = if prepared.loop_animation_frames {
        0.0
    } else {
        (prepared.duration_seconds - frame_duration).max(0.0)
    };
    let filter = simple_video_filter(
        format!(
            "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,tpad=stop_mode=clone:stop_duration={}",
            format_seconds(stop_duration)
        ),
        prepared,
    );
    if let Some(video_path) = prepared.video_path.as_ref() {
        let video_filter = background_video_filter(width, height, &prepared.video_fit);
        let mut filter = format!(
            "[0:v]{video_filter}[bg];[1:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black@0,tpad=stop_mode=clone:stop_duration={},format=rgba[fg];[bg][fg]overlay=0:0:format=auto[base0];",
            format_seconds(stop_duration)
        );
        let final_label = if prepared.gif_overlays.is_empty() {
            "base0".to_string()
        } else {
            append_gif_overlay_filters(&mut filter, "base0", 3, &prepared.gif_overlays, fps)
        };
        let subtitle_label = append_subtitle_image_overlay_filters(
            &mut filter,
            &final_label,
            3 + prepared.gif_overlays.len(),
            &prepared.subtitle_image_overlays,
        );
        append_final_video_filter(&mut filter, &subtitle_label, prepared);

        let mut command = Command::new(ffmpeg);
        command
            .args(["-y", "-stream_loop", "-1"])
            .arg("-i")
            .arg(video_path);
        append_animation_frame_input(&mut command, prepared, input_frame_rate, &first_frame);
        command.arg("-i").arg(&prepared.audio_path);
        append_gif_inputs(&mut command, &prepared.gif_overlays);
        append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
        command
            .arg("-t")
            .arg(format_seconds(prepared.duration_seconds))
            .arg("-filter_complex")
            .arg(filter)
            .arg("-af")
            .arg("apad")
            .args([
                "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "veryfast",
            ])
            .arg("-r")
            .arg(fps.to_string())
            .args([
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                EXPORT_AUDIO_SAMPLE_RATE,
                "-ac",
                EXPORT_AUDIO_CHANNELS,
            ])
            .args(["-movflags", "+faststart"])
            .arg(output_path);
        return run_command(
            command,
            "애니메이션 영상 배경 슬라이드 세그먼트 생성",
            export_id,
        );
    }
    if !prepared.gif_overlays.is_empty() {
        let mut filter = format!(
            "[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,tpad=stop_mode=clone:stop_duration={},format=rgba[base0];",
            format_seconds(stop_duration)
        );
        let final_label =
            append_gif_overlay_filters(&mut filter, "base0", 2, &prepared.gif_overlays, fps);
        let subtitle_label = append_subtitle_image_overlay_filters(
            &mut filter,
            &final_label,
            2 + prepared.gif_overlays.len(),
            &prepared.subtitle_image_overlays,
        );
        append_final_video_filter(&mut filter, &subtitle_label, prepared);

        let mut command = Command::new(ffmpeg);
        command.args(["-y"]);
        append_animation_frame_input(&mut command, prepared, input_frame_rate, &first_frame);
        command.arg("-i").arg(&prepared.audio_path);
        append_gif_inputs(&mut command, &prepared.gif_overlays);
        append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
        command
            .arg("-t")
            .arg(format_seconds(prepared.duration_seconds))
            .arg("-filter_complex")
            .arg(filter)
            .arg("-af")
            .arg("apad")
            .args([
                "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
            ])
            .arg("-r")
            .arg(fps.to_string())
            .args([
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                EXPORT_AUDIO_SAMPLE_RATE,
                "-ac",
                EXPORT_AUDIO_CHANNELS,
            ])
            .args(["-movflags", "+faststart"])
            .arg(output_path);
        return run_command(
            command,
            "GIF 오버레이 타이핑 슬라이드 세그먼트 생성",
            export_id,
        );
    }
    if !prepared.subtitle_image_overlays.is_empty() {
        let mut filter = format!(
            "[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,tpad=stop_mode=clone:stop_duration={},format=rgba[base0];",
            format_seconds(stop_duration)
        );
        let subtitle_label = append_subtitle_image_overlay_filters(
            &mut filter,
            "base0",
            2,
            &prepared.subtitle_image_overlays,
        );
        append_final_video_filter(&mut filter, &subtitle_label, prepared);

        let mut command = Command::new(ffmpeg);
        command.args(["-y"]);
        append_animation_frame_input(&mut command, prepared, input_frame_rate, &first_frame);
        command.arg("-i").arg(&prepared.audio_path);
        append_subtitle_image_inputs(&mut command, &prepared.subtitle_image_overlays);
        command
            .arg("-t")
            .arg(format_seconds(prepared.duration_seconds))
            .arg("-filter_complex")
            .arg(filter)
            .arg("-af")
            .arg("apad")
            .args([
                "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
            ])
            .arg("-r")
            .arg(fps.to_string())
            .args([
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                EXPORT_AUDIO_SAMPLE_RATE,
                "-ac",
                EXPORT_AUDIO_CHANNELS,
            ])
            .args(["-movflags", "+faststart"])
            .arg(output_path);
        return run_command(command, "타이핑 슬라이드 세그먼트 생성", export_id);
    }
    let mut command = Command::new(ffmpeg);
    command.args(["-y"]);
    append_animation_frame_input(&mut command, prepared, input_frame_rate, &first_frame);
    command
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
        .args([
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            EXPORT_AUDIO_SAMPLE_RATE,
            "-ac",
            EXPORT_AUDIO_CHANNELS,
        ])
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
pub(crate) fn export_video(
    app: AppHandle,
    payload: VideoExportPayload,
) -> Result<VideoExportResult, String> {
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
        let ffmpeg = find_tool("ffmpeg", "SLIDE_CUT_FFMPEG", "-version")?;
        let ffprobe = find_tool("ffprobe", "SLIDE_CUT_FFPROBE", "-version")?;
        let needs_tts = payload
            .slides
            .iter()
            .any(|slide| !get_slide_tts_segments(slide).is_empty());
        check_export_cancelled(&export_id)?;
        let curl = if needs_tts {
            Some(find_tool("curl", "SLIDE_CUT_CURL", "--version")?)
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
        let fonts_dir = resolve_fonts_dir(&app);
        let subtitles_filter_supported = command_supports_filter(&ffmpeg, "subtitles");

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

            let start_sound_path = slide
                .start_sound_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .map(PathBuf::from);
            if let Some(path) = start_sound_path.as_ref() {
                if !path.exists() {
                    return Err(format!(
                        "효과음 파일을 찾지 못했습니다: {}",
                        path.to_string_lossy()
                    ));
                }
            }
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
            let tts_segments = get_slide_tts_segments(slide);
            let mut tts_audio_paths = Vec::new();
            let mut subtitle_segments = Vec::new();
            let mut tts_duration = 0.0;
            for segment in &tts_segments {
                let path = generate_tts_audio(
                    &app,
                    curl.as_ref().unwrap(),
                    &work_dir,
                    &payload.tts,
                    segment,
                    &export_id,
                )?;
                let segment_duration = probe_audio_duration(&ffprobe, &path, fallback_duration)?;
                subtitle_segments.push(PreparedSubtitleSegment {
                    text: segment.clone(),
                    start_seconds: tts_duration,
                    end_seconds: tts_duration + segment_duration,
                });
                tts_duration += segment_duration;
                tts_audio_paths.push(path);
            }
            let tts_audio_path = if tts_audio_paths.is_empty() {
                None
            } else {
                Some(concat_tts_audio_segments(
                    &ffmpeg,
                    &work_dir,
                    index,
                    &tts_audio_paths,
                    &export_id,
                )?)
            };
            let base_audio_duration = if tts_audio_path.is_some() {
                tts_duration.max(0.5)
            } else {
                fallback_duration
            };
            let animation_affects_duration = slide.animation_affects_duration.unwrap_or(true);
            let duration = if slide.end_on_tts_end.unwrap_or(false) || !animation_affects_duration {
                base_audio_duration
            } else {
                base_audio_duration.max(animation_duration.unwrap_or(0.0))
            };
            let base_audio_path = if let Some(path) = tts_audio_path {
                path
            } else {
                let path = work_dir.join(format!("silence-{index:04}.m4a"));
                create_silence_audio(&ffmpeg, &path, duration, &export_id)?;
                path
            };
            let audio_path = if let Some(sound_path) = start_sound_path.as_ref() {
                let mixed_path = work_dir.join(format!("mixed-audio-{index:04}.m4a"));
                mix_start_sound(
                    &ffmpeg,
                    &base_audio_path,
                    sound_path,
                    &mixed_path,
                    duration,
                    &export_id,
                )?;
                mixed_path
            } else {
                base_audio_path
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
            let gif_overlays = prepare_gif_overlays(&work_dir, index, slide.gif_overlays.as_ref())?;
            let subtitle_image_overlays =
                if slide.subtitle_enabled.unwrap_or(false) && !subtitle_segments.is_empty() {
                    prepare_subtitle_image_overlays(
                        &work_dir,
                        index,
                        slide.subtitle_images.as_ref(),
                        &subtitle_segments,
                    )?
                } else {
                    Vec::new()
                };
            let subtitle_filter = if subtitle_image_overlays.is_empty()
                && subtitles_filter_supported
                && slide.subtitle_enabled.unwrap_or(false)
                && !subtitle_segments.is_empty()
            {
                let subtitle_path = work_dir.join(format!("subtitles-{index:04}.ass"));
                write_ass_subtitles(
                    &subtitle_path,
                    &subtitle_segments,
                    width,
                    height,
                    slide.subtitle_size,
                    slide.subtitle_y,
                )?;
                Some(build_subtitle_filter(&subtitle_path, fonts_dir.as_deref()))
            } else {
                None
            };
            prepared_slides.push(PreparedSlide {
                frame_path,
                animation_frame_paths,
                frame_rate,
                audio_path,
                video_path,
                video_fit: sanitize_video_fit(slide.video_fit.as_deref()),
                gif_overlays,
                subtitle_image_overlays,
                subtitle_filter,
                duration_seconds: duration,
                fit_animation_to_duration: slide.fit_animation_to_duration.unwrap_or(false),
                loop_animation_frames: slide.loop_animation_frames.unwrap_or(false),
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
