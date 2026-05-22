mod git;
mod project_store;
mod translation;
mod video_export;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            project_store::list_projects,
            project_store::save_project,
            project_store::load_project,
            project_store::rename_project,
            project_store::duplicate_project,
            project_store::delete_project,
            project_store::import_project_asset,
            project_store::export_project_package,
            project_store::import_project_package,
            project_store::get_app_settings,
            project_store::get_default_export_dir,
            project_store::save_app_settings,
            video_export::cancel_video_export,
            git::list_git_commits,
            git::list_git_commit_files,
            git::read_git_commit_file_change,
            translation::translate_slide,
            video_export::export_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running Slide Cut");
}

fn main() {
    run();
}
