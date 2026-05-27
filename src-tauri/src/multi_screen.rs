use tauri::{AppHandle, WebviewWindowBuilder};

pub struct WindowConfig {
    pub label: String,
    pub url: String,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub transparent: bool,
    pub decorations: bool,
    pub always_on_top: bool,
    pub resizable: bool,
    pub skip_taskbar: bool,
    pub visible: bool,
}

pub fn spawn_window(app: &AppHandle, cfg: WindowConfig) {
    let window = WebviewWindowBuilder::new(app, cfg.label, tauri::WebviewUrl::App(cfg.url.into()))
        .title("Chonk Break")
        .inner_size(cfg.width, cfg.height)
        .position(cfg.x, cfg.y)
        .decorations(cfg.decorations)
        .transparent(cfg.transparent)
        .always_on_top(cfg.always_on_top)
        .resizable(cfg.resizable)
        .skip_taskbar(cfg.skip_taskbar)
        .visible(cfg.visible)
        .build();

    if let Ok(win) = window {
        let _ = win.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
        win.maximize().unwrap();
        win.set_ignore_cursor_events(true).unwrap();
        win.show().unwrap();
    }
}

pub fn spawn_all_monitors(app: &AppHandle) {
    let monitors = match app.available_monitors() {
        Ok(m) => m,
        Err(_) => return,
    };

    for (i, m) in monitors.iter().enumerate() {
        let size = m.size();
        let pos = m.position();

        spawn_window(
            app,
            WindowConfig {
                label: format!("chonk-screen-{}", i),
                url: "#/".to_string(),
                width: size.width as f64,
                height: size.height as f64,
                x: pos.x as f64,
                y: pos.y as f64,
                transparent: true,
                decorations: false,
                always_on_top: true,
                resizable: false,
                skip_taskbar: true,
                visible: false,
            },
        );
    }
}
