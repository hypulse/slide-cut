use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

const GIT_CONTENT_MAX_CHARS: usize = 12_000;
const GIT_ANIMATION_CONTEXT_LINES: usize = 90;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitChanges {
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
pub(crate) struct GitCommit {
    hash: String,
    label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCommitList {
    repo_path: String,
    commits: Vec<GitCommit>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitFileList {
    repo_path: String,
    commit_hash: String,
    files: Vec<String>,
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
    if content.chars().count() > GIT_CONTENT_MAX_CHARS {
        format!(
            "{}\n\n... truncated ...",
            content
                .chars()
                .take(GIT_CONTENT_MAX_CHARS)
                .collect::<String>()
        )
    } else {
        content
    }
}

fn joined_line_char_count(lines: &[&str]) -> usize {
    if lines.is_empty() {
        return 0;
    }
    lines.iter().map(|line| line.chars().count()).sum::<usize>() + lines.len() - 1
}

fn join_line_window(lines: &[&str], start: usize, end: usize) -> String {
    lines
        .get(start..end)
        .unwrap_or_default()
        .join("\n")
        .to_string()
}

fn shrink_line_window_to_limit(
    before_lines: &[&str],
    after_lines: &[&str],
    mut start: usize,
    mut before_end: usize,
    mut after_end: usize,
    first_changed_line: usize,
) -> (usize, usize, usize) {
    while (joined_line_char_count(&before_lines[start..before_end]) > GIT_CONTENT_MAX_CHARS
        || joined_line_char_count(&after_lines[start..after_end]) > GIT_CONTENT_MAX_CHARS)
        && (start < first_changed_line
            || before_end > first_changed_line + 1
            || after_end > first_changed_line + 1)
    {
        if start < first_changed_line {
            start += 1;
            continue;
        }
        if before_end > first_changed_line + 1 {
            before_end -= 1;
        }
        if after_end > first_changed_line + 1 {
            after_end -= 1;
        }
    }
    (start, before_end, after_end)
}

fn truncate_git_animation_content(
    before_content: String,
    after_content: String,
) -> (String, String) {
    if before_content.chars().count() <= GIT_CONTENT_MAX_CHARS
        && after_content.chars().count() <= GIT_CONTENT_MAX_CHARS
    {
        return (before_content, after_content);
    }

    let before_lines: Vec<&str> = before_content.lines().collect();
    let after_lines: Vec<&str> = after_content.lines().collect();
    let shared_len = before_lines.len().min(after_lines.len());
    let mut first_changed_line = 0;
    while first_changed_line < shared_len
        && before_lines[first_changed_line] == after_lines[first_changed_line]
    {
        first_changed_line += 1;
    }

    if first_changed_line == shared_len && before_lines.len() == after_lines.len() {
        return (
            truncate_git_content(before_content),
            truncate_git_content(after_content),
        );
    }

    let mut before_tail = before_lines.len();
    let mut after_tail = after_lines.len();
    while before_tail > first_changed_line
        && after_tail > first_changed_line
        && before_lines[before_tail - 1] == after_lines[after_tail - 1]
    {
        before_tail -= 1;
        after_tail -= 1;
    }

    let start = first_changed_line.saturating_sub(GIT_ANIMATION_CONTEXT_LINES);
    let before_end = (before_tail + GIT_ANIMATION_CONTEXT_LINES).min(before_lines.len());
    let after_end = (after_tail + GIT_ANIMATION_CONTEXT_LINES).min(after_lines.len());
    let (start, before_end, after_end) = shrink_line_window_to_limit(
        &before_lines,
        &after_lines,
        start,
        before_end,
        after_end,
        first_changed_line,
    );

    (
        truncate_git_content(join_line_window(&before_lines, start, before_end)),
        truncate_git_content(join_line_window(&after_lines, start, after_end)),
    )
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
pub(crate) fn list_git_commits(repo_path: String) -> Result<GitCommitList, String> {
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
pub(crate) fn list_git_commit_files(
    repo_path: String,
    commit_hash: String,
) -> Result<GitFileList, String> {
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
pub(crate) fn read_git_commit_file_change(
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
            if parts.len() >= 2 {
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

    let (before_content, after_content) =
        truncate_git_animation_content(before_content, after_content);

    Ok(GitChanges {
        repo_path: root.to_string_lossy().to_string(),
        commit_hash: commit,
        file_path: file_path.clone(),
        title: format!("{short_hash} · {file_path}"),
        content: truncate_git_content(content),
        before_content,
        after_content,
        before_path,
    })
}
