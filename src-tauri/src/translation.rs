use crate::project_store::get_app_settings;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const DEFAULT_TRANSLATION_MODEL: &str = "gpt-5-mini";
const MAX_TRANSLATION_ITEMS: usize = 80;
const MAX_TRANSLATION_CHARS: usize = 40_000;
const MIN_TRANSLATION_OUTPUT_TOKENS: usize = 4096;
const MAX_TRANSLATION_OUTPUT_TOKENS: usize = 32_768;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslateSlidePayload {
    api_key: Option<String>,
    source_language: String,
    target_language: String,
    items: Vec<TranslateSlideItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslateSlideItem {
    id: String,
    text: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslateSlideResult {
    items: Vec<TranslateSlideItem>,
}

fn now_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn quote_curl_value(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
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

fn write_json<T: Serialize>(path: PathBuf, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, format!("{text}\n")).map_err(|error| error.to_string())
}

fn response_text(response: &Value) -> Option<String> {
    if let Some(text) = response.get("output_text").and_then(Value::as_str) {
        return Some(text.to_string());
    }

    let mut chunks = Vec::new();
    if let Some(output) = response.get("output").and_then(Value::as_array) {
        for item in output {
            if let Some(content) = item.get("content").and_then(Value::as_array) {
                for part in content {
                    if let Some(text) = part.get("text").and_then(Value::as_str) {
                        chunks.push(text);
                    }
                }
            }
        }
    }

    if chunks.is_empty() {
        None
    } else {
        Some(chunks.join(""))
    }
}

fn response_refusal(response: &Value) -> Option<String> {
    let output = response.get("output").and_then(Value::as_array)?;
    for item in output {
        let Some(content) = item.get("content").and_then(Value::as_array) else {
            continue;
        };
        for part in content {
            if let Some(refusal) = part.get("refusal").and_then(Value::as_str) {
                return Some(refusal.to_string());
            }
        }
    }
    None
}

fn response_incomplete_reason(response: &Value) -> Option<String> {
    response
        .get("incomplete_details")
        .and_then(Value::as_object)
        .and_then(|details| details.get("reason"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn resolve_openai_api_key(app: &AppHandle, direct_key: Option<&str>) -> Result<String, String> {
    if let Some(key) = direct_key.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(key.to_string());
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
        .ok_or_else(|| "번역을 위해 OpenAI API Key가 필요합니다.".to_string())
}

fn validate_payload(payload: &TranslateSlidePayload) -> Result<(), String> {
    let source_language = payload.source_language.trim();
    let target_language = payload.target_language.trim();
    if source_language.is_empty() || target_language.is_empty() {
        return Err("현재 언어와 타겟 언어를 선택해 주세요.".to_string());
    }
    if payload.items.is_empty() {
        return Err("번역할 텍스트가 없습니다.".to_string());
    }
    if payload.items.len() > MAX_TRANSLATION_ITEMS {
        return Err(format!(
            "한 번에 번역할 수 있는 텍스트 항목은 {MAX_TRANSLATION_ITEMS}개 이하입니다."
        ));
    }
    let total_chars: usize = payload
        .items
        .iter()
        .map(|item| item.text.chars().count())
        .sum();
    if total_chars > MAX_TRANSLATION_CHARS {
        return Err(format!(
            "한 번에 번역할 수 있는 텍스트는 {MAX_TRANSLATION_CHARS}자 이하입니다."
        ));
    }
    for item in &payload.items {
        if item.id.trim().is_empty() {
            return Err("번역 항목 ID가 비어 있습니다.".to_string());
        }
        if item.text.trim().is_empty() {
            return Err("빈 텍스트 항목은 번역할 수 없습니다.".to_string());
        }
    }
    Ok(())
}

fn build_translation_request(payload: &TranslateSlidePayload) -> Value {
    let model = env::var("SLIDE_CUT_OPENAI_TRANSLATION_MODEL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_TRANSLATION_MODEL.to_string());
    let source_language = payload.source_language.trim();
    let target_language = payload.target_language.trim();
    let input = serde_json::json!({
        "sourceLanguage": source_language,
        "targetLanguage": target_language,
        "items": &payload.items,
    });
    let output_tokens = payload
        .items
        .iter()
        .map(|item| item.text.chars().count())
        .sum::<usize>()
        .saturating_mul(2)
        .clamp(MIN_TRANSLATION_OUTPUT_TOKENS, MAX_TRANSLATION_OUTPUT_TOKENS);

    let mut request = serde_json::json!({
        "model": model,
        "instructions": "You translate slide text. Preserve meaning, line breaks, punctuation style, markdown-like markers, URLs, code identifiers, product names, and numbers. Return only the requested JSON shape. Do not add explanations.",
        "input": format!(
            "Translate each item from {source_language} to {target_language}. Return the same item ids in the same order.\n\n{}",
            input
        ),
        "max_output_tokens": output_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "slide_translation",
                "strict": true,
                "schema": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["items"],
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["id", "text"],
                                "properties": {
                                    "id": { "type": "string" },
                                    "text": { "type": "string" }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if model.starts_with("gpt-5") {
        request["reasoning"] = serde_json::json!({ "effort": "minimal" });
    }

    request
}

fn run_openai_translation_request(
    app: &AppHandle,
    api_key: &str,
    request_value: &Value,
) -> Result<Value, String> {
    let curl = find_tool("curl", "SLIDE_CUT_CURL", "--version")?;
    let work_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("translation");
    fs::create_dir_all(&work_dir).map_err(|error| error.to_string())?;

    let request_id = now_millis()?;
    let request_path = work_dir.join(format!("translation-request-{request_id}.json"));
    let response_path = work_dir.join(format!("translation-response-{request_id}.json"));
    let config_path = work_dir.join(format!("translation-curl-{request_id}.conf"));
    write_json(request_path.clone(), request_value)?;

    let config = format!(
        "url = \"{}\"\nrequest = \"POST\"\nheader = \"Authorization: Bearer {}\"\nheader = \"Content-Type: application/json\"\ndata-binary = \"@{}\"\noutput = \"{}\"\nsilent\nshow-error\nlocation\n",
        OPENAI_RESPONSES_URL,
        quote_curl_value(api_key),
        quote_curl_value(&request_path.to_string_lossy()),
        quote_curl_value(&response_path.to_string_lossy())
    );
    fs::write(&config_path, config).map_err(|error| error.to_string())?;

    let mut command = Command::new(curl);
    command.arg("-K").arg(&config_path);
    let result = run_command(command, "OpenAI 번역 요청");
    let _ = fs::remove_file(&config_path);
    let _ = fs::remove_file(&request_path);
    if let Err(error) = result {
        let _ = fs::remove_file(&response_path);
        return Err(error);
    }

    let response_text = fs::read_to_string(&response_path).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&response_path);
    serde_json::from_str(&response_text)
        .map_err(|error| format!("OpenAI 번역 응답을 읽지 못했습니다: {error}"))
}

fn parse_translation_response(response: &Value) -> Result<TranslateSlideResult, String> {
    if let Some(error) = response.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        return Err(format!("OpenAI 번역 요청 실패: {message}"));
    }

    if let Some(refusal) = response_refusal(response) {
        return Err(format!("OpenAI가 번역 요청을 거절했습니다: {refusal}"));
    }

    if response.get("status").and_then(Value::as_str) == Some("incomplete") {
        let reason = response_incomplete_reason(response).unwrap_or_else(|| "unknown".to_string());
        return Err(format!(
            "OpenAI 번역 응답이 끝까지 생성되지 않았습니다: {reason}"
        ));
    }

    let text = response_text(response)
        .ok_or_else(|| "OpenAI 번역 응답에 텍스트가 없습니다.".to_string())?;
    serde_json::from_str::<TranslateSlideResult>(&text)
        .map_err(|error| format!("OpenAI 번역 JSON을 읽지 못했습니다: {error}"))
}

fn validate_translation_result(
    request_items: &[TranslateSlideItem],
    result: &TranslateSlideResult,
) -> Result<(), String> {
    let request_ids = request_items
        .iter()
        .map(|item| item.id.as_str())
        .collect::<HashSet<_>>();
    let response_ids = result
        .items
        .iter()
        .map(|item| item.id.as_str())
        .collect::<HashSet<_>>();

    if request_ids == response_ids && result.items.len() == request_items.len() {
        return Ok(());
    }

    let missing = request_ids
        .difference(&response_ids)
        .copied()
        .collect::<Vec<_>>();
    let extra = response_ids
        .difference(&request_ids)
        .copied()
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return Err(format!(
            "OpenAI 번역 응답에 누락된 항목이 있습니다: {}",
            missing.join(", ")
        ));
    }
    if !extra.is_empty() {
        return Err(format!(
            "OpenAI 번역 응답에 요청하지 않은 항목이 있습니다: {}",
            extra.join(", ")
        ));
    }
    Err("OpenAI 번역 응답의 항목 수가 요청과 다릅니다.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_responses_output_message_text() {
        let response = serde_json::json!({
            "status": "completed",
            "output": [
                { "type": "reasoning", "content": [] },
                {
                    "type": "message",
                    "status": "completed",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "{\"items\":[{\"id\":\"object-0\",\"text\":\"Hello\"}]}",
                            "refusal": null
                        }
                    ]
                }
            ]
        });

        let parsed = parse_translation_response(&response).expect("response should parse");
        assert_eq!(parsed.items.len(), 1);
        assert_eq!(parsed.items[0].id, "object-0");
        assert_eq!(parsed.items[0].text, "Hello");
    }

    #[test]
    fn surfaces_openai_error_message() {
        let response = serde_json::json!({
            "error": {
                "message": "Invalid API key",
                "type": "invalid_request_error"
            }
        });

        let error = parse_translation_response(&response).expect_err("error should surface");
        assert!(error.contains("Invalid API key"));
    }

    #[test]
    fn reports_incomplete_response_reason() {
        let response = serde_json::json!({
            "status": "incomplete",
            "incomplete_details": { "reason": "max_output_tokens" },
            "output": []
        });

        let error = parse_translation_response(&response).expect_err("incomplete should fail");
        assert!(error.contains("max_output_tokens"));
    }

    #[test]
    fn accepts_translation_items_in_different_order() {
        let request_items = vec![
            TranslateSlideItem {
                id: "object-0".to_string(),
                text: "안녕하세요".to_string(),
            },
            TranslateSlideItem {
                id: "notes".to_string(),
                text: "노트입니다".to_string(),
            },
        ];
        let result = TranslateSlideResult {
            items: vec![
                TranslateSlideItem {
                    id: "notes".to_string(),
                    text: "These are notes.".to_string(),
                },
                TranslateSlideItem {
                    id: "object-0".to_string(),
                    text: "Hello".to_string(),
                },
            ],
        };

        validate_translation_result(&request_items, &result).expect("IDs should match by set");
    }
}

#[tauri::command]
pub(crate) fn translate_slide(
    app: AppHandle,
    payload: TranslateSlidePayload,
) -> Result<TranslateSlideResult, String> {
    validate_payload(&payload)?;
    let api_key = resolve_openai_api_key(&app, payload.api_key.as_deref())?;
    let request_value = build_translation_request(&payload);
    let response = run_openai_translation_request(&app, &api_key, &request_value)?;
    let result = parse_translation_response(&response)?;
    validate_translation_result(&payload.items, &result)?;
    Ok(result)
}
