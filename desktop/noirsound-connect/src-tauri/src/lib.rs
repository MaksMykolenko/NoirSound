pub mod keychain;
pub mod sidecar;
pub mod state;
pub mod tray;
pub mod websocket;

use std::sync::Arc;
use tauri::{Manager, State, WindowEvent};
use tokio::sync::RwLock;

use keychain::{clear_all_credentials, get_device_id, get_refresh_token, save_device_id, save_refresh_token};
use sidecar::SidecarManager;
use state::{AppState, AppStateDto, ConnectionStatus, SharedState};
use websocket::WebSocketManager;

#[tauri::command]
async fn start_pairing(
    state: State<'_, SharedState>,
    device_name: Option<String>,
    platform: Option<String>,
) -> Result<serde_json::Value, String> {
    let api_base = {
        let s = state.read().await;
        s.api_base_url.clone()
    };

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/desktop-connect/device/start", api_base))
        .json(&serde_json::json!({
            "deviceName": device_name.unwrap_or_else(|| "MacBook Pro".to_string()),
            "platform": platform.unwrap_or_else(|| "macOS".to_string()),
            "appVersion": "0.1.0"
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err("Failed to start pairing".to_string());
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let mut s = state.write().await;
    s.status = ConnectionStatus::WaitingForConfirmation;

    Ok(data)
}

#[tauri::command]
async fn poll_pairing(
    state: State<'_, SharedState>,
    ws_manager: State<'_, Arc<WebSocketManager>>,
    device_code: String,
) -> Result<serde_json::Value, String> {
    let api_base = {
        let s = state.read().await;
        s.api_base_url.clone()
    };

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/desktop-connect/device/token", api_base))
        .json(&serde_json::json!({ "deviceCode": device_code }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status_code = res.status();
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if status_code.as_u16() == 400 {
        let err = data["error"].as_str().unwrap_or("");
        if err == "authorization_pending" {
            return Ok(serde_json::json!({ "success": false, "pending": true }));
        }
        return Err(err.to_string());
    }

    if !status_code.is_success() {
        return Err("Pairing rejected".to_string());
    }

    if let (Some(access_token), Some(refresh_token), Some(device_id)) = (
        data["accessToken"].as_str(),
        data["refreshToken"].as_str(),
        data["deviceId"].as_str(),
    ) {
        let _ = save_refresh_token(refresh_token);
        let _ = save_device_id(device_id);

        {
            let mut s = state.write().await;
            s.access_token = Some(access_token.to_string());
            s.device_id = Some(device_id.to_string());
            s.status = ConnectionStatus::Connected;
        }

        ws_manager.start();

        return Ok(serde_json::json!({ "success": true, "deviceId": device_id }));
    }

    Err("Invalid response format".to_string())
}

#[tauri::command]
async fn get_app_state(state: State<'_, SharedState>) -> Result<AppStateDto, String> {
    let s = state.read().await;
    Ok(s.to_dto())
}

#[tauri::command]
async fn disconnect_device(
    state: State<'_, SharedState>,
    sidecar: State<'_, Arc<SidecarManager>>,
) -> Result<(), String> {
    let _ = clear_all_credentials();
    let _ = sidecar.clear_presence().await;

    let mut s = state.write().await;
    s.status = ConnectionStatus::NotPaired;
    s.access_token = None;
    s.device_id = None;
    s.current_track = None;
    s.server_state = "Disconnected".to_string();

    Ok(())
}

#[tauri::command]
async fn reconnect(ws_manager: State<'_, Arc<WebSocketManager>>) -> Result<(), String> {
    ws_manager.start();
    Ok(())
}

#[tauri::command]
async fn toggle_presence_enabled(
    state: State<'_, SharedState>,
    sidecar: State<'_, Arc<SidecarManager>>,
    enabled: bool,
) -> Result<(), String> {
    {
        let mut s = state.write().await;
        s.settings.enabled = enabled;
    }

    if !enabled {
        let _ = sidecar.clear_presence().await;
    }

    Ok(())
}

#[tauri::command]
fn open_browser(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

pub fn run() {
    let _ = env_logger::try_init();

    let api_base_url = std::env::var("NOIRSOUND_API_URL")
        .unwrap_or_else(|_| "https://noirsound.co".to_string());

    let app_state: SharedState = Arc::new(RwLock::new(AppState::new(api_base_url)));
    let sidecar_manager = Arc::new(SidecarManager::new());

    let sidecar_init = sidecar_manager.clone();
    tokio::spawn(async move {
        let _ = sidecar_init.start().await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup({
            let state_clone = app_state.clone();
            let sidecar_clone = sidecar_manager.clone();
            move |app| {
                let app_handle = app.handle().clone();

                // Setup system tray / menu bar
                if let Err(e) = tray::setup_tray(&app_handle, state_clone.clone(), sidecar_clone.clone()) {
                    log::warn!("Failed to setup system tray: {}", e);
                }

                // Check if already paired with credentials in Keychain
                let has_refresh = get_refresh_token().is_some();
                if has_refresh {
                    let mut s = tokio::runtime::Handle::current().block_on(state_clone.write());
                    s.status = ConnectionStatus::Connecting;
                    s.device_id = get_device_id();
                }

                let ws_manager = Arc::new(WebSocketManager::new(
                    state_clone.clone(),
                    sidecar_clone.clone(),
                    app_handle.clone(),
                ));

                if has_refresh {
                    ws_manager.start();
                }

                app.manage(state_clone);
                app.manage(sidecar_clone);
                app.manage(ws_manager);

                Ok(())
            }
        })
        .on_window_event(|window, event| {
            // Close window hides window instead of quitting (so app lives in menu bar!)
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_pairing,
            poll_pairing,
            get_app_state,
            disconnect_device,
            reconnect,
            toggle_presence_enabled,
            open_browser
        ])
        .run(tauri::generate_context!())
        .expect("Error while running NoirSound Connect");
}

#[cfg(test)]
mod tests {
    use crate::state::{AppState, ConnectionStatus, TrackMetadata};

    #[test]
    fn test_app_state_initialization_and_dto() {
        let mut state = AppState::new("https://noirsound.co".to_string());
        assert_eq!(state.status, ConnectionStatus::NotPaired);
        assert_eq!(state.api_base_url, "https://noirsound.co");

        state.device_id = Some("1234567890abcdef".to_string());
        let dto = state.to_dto();
        assert_eq!(dto.diagnostics.masked_device_id, "1234…cdef");
        assert_eq!(dto.diagnostics.app_version, "0.1.0");
    }

    #[test]
    fn test_track_metadata_json_roundtrip() {
        let track = TrackMetadata {
            id: "track-123".to_string(),
            title: "Midnight Echo".to_string(),
            artist_name: "Shadow".to_string(),
            album_title: Some("Echoes".to_string()),
            duration_ms: 180000,
            position_ms: 45000,
            cover_url: Some("https://noirsound.co/api/public/covers/track-123".to_string()),
            share_url: "https://noirsound.co/track/track-123".to_string(),
        };

        let json = serde_json::to_string(&track).unwrap();
        assert!(json.contains("\"title\":\"Midnight Echo\""));
        assert!(json.contains("\"artistName\":\"Shadow\""));

        let deserialized: TrackMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "track-123");
        assert_eq!(deserialized.duration_ms, 180000);
    }
}
