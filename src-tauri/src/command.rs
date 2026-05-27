#[tauri::command]
pub fn hide_window(window: tauri::WebviewWindow) {
    window.hide().unwrap();
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    crate::window::close_all_windows(&app);
}

#[tauri::command]
pub fn sync_scene_library(
    app: tauri::AppHandle,
) -> Result<crate::scene::SceneLibraryPayload, String> {
    crate::scene::sync_scene_library(&app)
}

#[tauri::command]
pub fn get_scene_mode(
    app: tauri::AppHandle,
    mode_name: String,
) -> Result<crate::scene::SceneManifest, String> {
    crate::scene::get_scene_mode(&app, mode_name)
}

#[tauri::command]
pub fn save_scene_mode(
    app: tauri::AppHandle,
    mode_name: String,
    text: String,
    items: Vec<crate::scene::SceneItem>,
) -> Result<(), String> {
    crate::scene::save_scene_mode(&app, mode_name, text, items)
}

#[tauri::command]
pub fn delete_scene_mode(
    app: tauri::AppHandle,
    mode_name: String,
) -> Result<(), String> {
    crate::scene::delete_scene_mode(&app, mode_name)
}

#[tauri::command]
pub fn import_scene_asset(
    app: tauri::AppHandle,
    mode_name: String,
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    crate::scene::import_scene_asset(&app, mode_name, file_name, data)
}

#[tauri::command]
pub fn list_scene_assets(
    app: tauri::AppHandle,
    mode_name: String,
) -> Result<Vec<String>, String> {
    crate::scene::list_scene_assets(&app, mode_name)
}

#[tauri::command]
pub fn export_scene_bundle(
    app: tauri::AppHandle,
    mode_name: String,
) -> Result<crate::scene::SceneBundleExport, String> {
    crate::scene::export_scene_bundle(&app, mode_name)
}

#[tauri::command]
pub fn import_scene_bundle(
    app: tauri::AppHandle,
    data: Vec<u8>,
) -> Result<String, String> {
    crate::scene::import_scene_bundle(&app, data)
}
