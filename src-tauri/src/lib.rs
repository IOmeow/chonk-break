mod command;
mod multi_screen;
mod scene;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(desktop)]
            {
                multi_screen::spawn_all_monitors(&app.handle());
                tray::setup(app)?;
            }
            Ok(())
        })
        .on_tray_icon_event(|app, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle_window(app, "control");
            }
        })
        .invoke_handler(tauri::generate_handler![
            command::hide_window,
            command::quit_app,
            command::sync_scene_library,
            command::get_scene_mode,
            command::save_scene_mode,
            command::delete_scene_mode,
            command::import_scene_asset,
            command::list_scene_assets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
