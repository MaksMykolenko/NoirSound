use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use std::sync::Arc;
use crate::sidecar::SidecarManager;
use crate::state::SharedState;

pub fn setup_tray(
    app: &AppHandle,
    _state: SharedState,
    sidecar: Arc<SidecarManager>,
) -> Result<(), Box<dyn std::error::Error>> {
    let header_item = MenuItem::with_id(app, "header", "NoirSound Connect", false, None::<&str>)?;
    let server_status_item = MenuItem::with_id(app, "server_status", "NoirSound: Підключено", false, None::<&str>)?;
    let discord_status_item = MenuItem::with_id(app, "discord_status", "Discord: Підключено", false, None::<&str>)?;
    let playing_item = MenuItem::with_id(app, "playing", "Зараз грає: —", false, None::<&str>)?;

    let separator1 = PredefinedMenuItem::separator(app)?;
    let presence_toggle = CheckMenuItem::with_id(app, "presence_toggle", "Показувати активність у Discord", true, true, None::<&str>)?;
    let open_web = MenuItem::with_id(app, "open_web", "Відкрити NoirSound", true, None::<&str>)?;
    let open_app = MenuItem::with_id(app, "open_app", "Відкрити NoirSound Connect", true, None::<&str>)?;
    let reconnect = MenuItem::with_id(app, "reconnect", "Перепідключити", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &header_item,
            &server_status_item,
            &discord_status_item,
            &playing_item,
            &separator1,
            &presence_toggle,
            &open_web,
            &open_app,
            &reconnect,
            &separator2,
            &quit,
        ],
    )?;

    let sidecar_clone = sidecar.clone();

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app_handle, event| {
            match event.id.as_ref() {
                "open_app" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "open_web" => {
                    let _ = open::that("https://noirsound.co");
                }
                "reconnect" => {
                    // Trigger reconnect
                }
                "quit" => {
                    let sc = sidecar_clone.clone();
                    let handle = app_handle.clone();
                    tokio::spawn(async move {
                        sc.shutdown().await;
                        handle.exit(0);
                    });
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
