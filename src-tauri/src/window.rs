use tauri::{AppHandle, Manager};

pub fn close_all_windows(app: &AppHandle) {
    for (_, window) in app.webview_windows() {
        let _ = window.close();
    }
}

pub fn toggle_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}
