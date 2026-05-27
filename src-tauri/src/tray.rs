use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    App, Manager,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_opener::OpenerExt;

use crate::window;

pub fn setup(app: &App) -> tauri::Result<()> {
    let toggle_autostart = MenuItemBuilder::new(format!(
        "Auto Start: {}",
        app.autolaunch().is_enabled().unwrap()
    ))
    .id("toggle_autostart")
    .build(app)?;

    let open_app_folder = MenuItemBuilder::new("Open App Folder")
        .id("open_app_folder")
        .build(app)?;

    let quit = MenuItemBuilder::new("Exit").id("quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&toggle_autostart, &open_app_folder, &quit])
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Chonk Break")
        .show_menu_on_left_click(false)
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "toggle_autostart" => {
                let autostart_manager = app.autolaunch();
                let _ = app.plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec!["--flag1", "--flag2"]),
                ));

                if autostart_manager.is_enabled().unwrap() {
                    let _ = autostart_manager.disable();
                    toggle_autostart.set_text("Auto Start: false").unwrap();
                } else {
                    let _ = autostart_manager.enable();
                    toggle_autostart.set_text("Auto Start: true").unwrap();
                }
            }
            "open_app_folder" => {
                if let Ok(app_data_dir) = app.path().app_data_dir() {
                    let _ = app
                        .opener()
                        .open_path(app_data_dir.to_string_lossy().into_owned(), None::<String>);
                }
            }
            "quit" => window::close_all_windows(app),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
