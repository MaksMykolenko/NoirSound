use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

use crate::keychain::{clear_all_credentials, get_device_id, get_refresh_token, save_refresh_token};
use crate::sidecar::SidecarManager;
use crate::state::{ConnectionStatus, SharedState, TrackMetadata};

pub struct WebSocketManager {
    state: SharedState,
    sidecar: Arc<SidecarManager>,
    app_handle: AppHandle,
    is_running: Arc<AtomicBool>,
    pause_cancel_tx: Arc<Mutex<Option<mpsc::Sender<()>>>>,
}

impl WebSocketManager {
    pub fn new(state: SharedState, sidecar: Arc<SidecarManager>, app_handle: AppHandle) -> Self {
        Self {
            state,
            sidecar,
            app_handle,
            is_running: Arc::new(AtomicBool::new(false)),
            pause_cancel_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self) {
        if self.is_running.load(Ordering::SeqCst) {
            return;
        }

        self.is_running.store(true, Ordering::SeqCst);
        let state = self.state.clone();
        let sidecar = self.sidecar.clone();
        let app_handle = self.app_handle.clone();
        let is_running = self.is_running.clone();
        let pause_cancel_tx = self.pause_cancel_tx.clone();

        tauri::async_runtime::spawn(async move {
            let backoff_delays = [1, 2, 4, 8, 15, 30];
            let mut backoff_idx = 0;

            while is_running.load(Ordering::SeqCst) {
                // Ensure we have access token, or refresh it
                let token = match Self::ensure_access_token(&state).await {
                    Ok(t) => t,
                    Err(err) => {
                        log::warn!("Failed to obtain access token: {}", err);
                        if err.contains("revoked") || err.contains("invalid_grant") {
                            let _ = clear_all_credentials();
                            let mut s = state.write().await;
                            s.status = ConnectionStatus::Revoked;
                            s.server_state = "Device Revoked".to_string();
                            let _ = app_handle.emit("connection_status", s.to_dto());
                            break;
                        }
                        tokio::time::sleep(Duration::from_secs(5)).await;
                        continue;
                    }
                };

                let api_base = {
                    let s = state.read().await;
                    s.api_base_url.clone()
                };

                let ws_url = if api_base.starts_with("https://") {
                    format!("wss://{}/api/desktop-connect/presence", &api_base["https://".len()..])
                } else if api_base.starts_with("http://") {
                    format!("ws://{}/api/desktop-connect/presence", &api_base["http://".len()..])
                } else {
                    format!("wss://{}/api/desktop-connect/presence", api_base)
                };

                log::info!("Connecting to WebSocket at {}", ws_url);

                match Self::connect_ws(&ws_url, &token).await {
                    Ok((mut write, mut read)) => {
                        backoff_idx = 0; // reset backoff on successful connect
                        {
                            let mut s = state.write().await;
                            s.status = ConnectionStatus::Connected;
                            s.server_state = "Connected".to_string();
                            let _ = app_handle.emit("connection_status", s.to_dto());
                        }

                        let mut last_activity = tokio::time::Instant::now();

                        loop {
                            tokio::select! {
                                msg = read.next() => {
                                    match msg {
                                        Some(Ok(Message::Text(text))) => {
                                            last_activity = tokio::time::Instant::now();
                                            Self::handle_message(
                                                &text,
                                                &state,
                                                &sidecar,
                                                &app_handle,
                                                &pause_cancel_tx,
                                                &mut write
                                            ).await;
                                        }
                                        Some(Ok(Message::Ping(p))) => {
                                            last_activity = tokio::time::Instant::now();
                                            let _ = write.send(Message::Pong(p)).await;
                                        }
                                        Some(Ok(Message::Close(_))) | None => {
                                            log::info!("WebSocket connection closed by server");
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                                _ = tokio::time::sleep(Duration::from_secs(10)) => {
                                    // Check timeout: if no message for 60s, reconnect
                                    if last_activity.elapsed() > Duration::from_secs(60) {
                                        log::warn!("WebSocket heartbeat timeout, reconnecting...");
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("WebSocket connect failed: {}", e);
                    }
                }

                // Disconnected state
                {
                    let mut s = state.write().await;
                    s.server_state = "Reconnecting...".to_string();
                    let _ = app_handle.emit("connection_status", s.to_dto());
                }

                let delay = backoff_delays[backoff_idx];
                if backoff_idx + 1 < backoff_delays.len() {
                    backoff_idx += 1;
                }
                tokio::time::sleep(Duration::from_secs(delay)).await;
            }
        });
    }

    async fn connect_ws(
        ws_url: &str,
        token: &str,
    ) -> Result<
        (
            futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>,
            futures_util::stream::SplitStream<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>,
        ),
        String,
    > {
        let mut request = ws_url
            .into_client_request()
            .map_err(|e| format!("Invalid WS URL: {}", e))?;

        request.headers_mut().insert(
            "Authorization",
            HeaderValue::from_str(&format!("Bearer {}", token))
                .map_err(|e| format!("Invalid header: {}", e))?,
        );

        let (ws_stream, _) = connect_async(request)
            .await
            .map_err(|e| format!("WS Handshake error: {}", e))?;

        Ok(ws_stream.split())
    }

    async fn ensure_access_token(state: &SharedState) -> Result<String, String> {
        {
            let s = state.read().await;
            if let Some(ref token) = s.access_token {
                return Ok(token.clone());
            }
        }

        // Refresh token from Keychain
        let refresh_token = get_refresh_token()
            .ok_or_else(|| "No refresh token found in Keychain".to_string())?;
        let device_id = get_device_id()
            .ok_or_else(|| "No device ID found in Keychain".to_string())?;

        let api_base = {
            let s = state.read().await;
            s.api_base_url.clone()
        };

        let client = reqwest::Client::new();
        let res = client
            .post(format!("{}/api/desktop-connect/device/refresh", api_base))
            .json(&serde_json::json!({
                "refreshToken": refresh_token,
                "deviceId": device_id
            }))
            .send()
            .await
            .map_err(|e| format!("HTTP refresh failed: {}", e))?;

        if !res.status().is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(format!("Refresh rejected by server: {}", body));
        }

        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))?;

        let new_access = data["accessToken"]
            .as_str()
            .ok_or("Missing accessToken in response")?
            .to_string();

        if let Some(new_refresh) = data["refreshToken"].as_str() {
            let _ = save_refresh_token(new_refresh);
        }

        let mut s = state.write().await;
        s.access_token = Some(new_access.clone());
        s.device_id = Some(device_id);

        Ok(new_access)
    }

    async fn handle_message<S>(
        text: &str,
        state: &SharedState,
        sidecar: &Arc<SidecarManager>,
        app_handle: &AppHandle,
        pause_cancel_tx: &Arc<Mutex<Option<mpsc::Sender<()>>>>,
        write_sink: &mut S,
    ) where
        S: SinkExt<Message> + Unpin,
    {
        let json: serde_json::Value = match serde_json::from_str(text) {
            Ok(j) => j,
            Err(_) => return,
        };

        let msg_type = json.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match msg_type {
            "connection.ready" => {
                log::info!("Connection ready from server: {}", text);
                let mut s = state.write().await;
                s.status = ConnectionStatus::Connected;
                s.server_state = "Connected".to_string();
                if let Some(dev_id) = json.get("deviceId").and_then(|d| d.as_str()) {
                    s.device_id = Some(dev_id.to_string());
                }
                if let Some(settings_json) = json.get("settings") {
                    if let Some(enabled) = settings_json.get("enabled").and_then(|v| v.as_bool()) {
                        s.settings.enabled = enabled;
                    }
                    if let Some(cover) = settings_json.get("showCover").and_then(|v| v.as_bool()) {
                        s.settings.show_cover = cover;
                    }
                    if let Some(timer) = settings_json.get("showTimer").and_then(|v| v.as_bool()) {
                        s.settings.show_timer = timer;
                    }
                }
                let _ = app_handle.emit("connection_status", s.to_dto());
            }
            "ping" => {
                let _ = write_sink
                    .send(Message::Text("{\"type\":\"pong\"}".to_string()))
                    .await;
            }
            "presence.update" => {
                // Cancel any pending pause timer
                {
                    let mut guard = pause_cancel_tx.lock().await;
                    if let Some(tx) = guard.take() {
                        let _ = tx.send(()).await;
                    }
                }

                if let Some(track_json) = json.get("track") {
                    if let Ok(track) = serde_json::from_value::<TrackMetadata>(track_json.clone()) {
                        let (show_cover, show_timer, enabled) = {
                            let s = state.read().await;
                            (s.settings.show_cover, s.settings.show_timer, s.settings.enabled)
                        };

                        if enabled {
                            let _ = sidecar.set_presence(&track, show_cover, show_timer).await;
                        }

                        let mut s = state.write().await;
                        s.status = ConnectionStatus::Connected;
                        s.server_state = "Connected".to_string();
                        s.current_track = Some(track.clone());
                        s.last_update = Some(chrono::Utc::now().to_rfc3339());
                        let _ = app_handle.emit("presence_update", Some(track));
                        let _ = app_handle.emit("connection_status", s.to_dto());
                    }
                }
            }
            "presence.pause" => {
                // Start 10-second pause timer before clearing Discord presence
                let (tx, mut rx) = mpsc::channel::<()>(1);
                {
                    let mut guard = pause_cancel_tx.lock().await;
                    if let Some(old_tx) = guard.take() {
                        let _ = old_tx.send(()).await;
                    }
                    *guard = Some(tx);
                }

                let sidecar_clone = sidecar.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(10)) => {
                            let _ = sidecar_clone.clear_presence().await;
                        }
                        _ = rx.recv() => {
                            // Cancelled by resume event
                        }
                    }
                });
            }
            "presence.clear" => {
                // Cancel any pending pause timer
                {
                    let mut guard = pause_cancel_tx.lock().await;
                    if let Some(tx) = guard.take() {
                        let _ = tx.send(()).await;
                    }
                }

                let clear_track_id = json.get("trackId").and_then(|t| t.as_str());
                let should_clear = {
                    let s = state.read().await;
                    if let (Some(req_id), Some(ref curr)) = (clear_track_id, &s.current_track) {
                        curr.id == req_id
                    } else {
                        true
                    }
                };

                if should_clear {
                    let _ = sidecar.clear_presence().await;
                    let mut s = state.write().await;
                    s.current_track = None;
                    let _ = app_handle.emit("presence_update", Option::<TrackMetadata>::None);
                }
            }
            "settings.updated" => {
                if let Some(settings_json) = json.get("settings") {
                    let mut s = state.write().await;
                    if let Some(enabled) = settings_json.get("enabled").and_then(|v| v.as_bool()) {
                        s.settings.enabled = enabled;
                        if !enabled {
                            let sidecar_clone = sidecar.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = sidecar_clone.clear_presence().await;
                            });
                        }
                    }
                    if let Some(cover) = settings_json.get("showCover").and_then(|v| v.as_bool()) {
                        s.settings.show_cover = cover;
                    }
                    if let Some(timer) = settings_json.get("showTimer").and_then(|v| v.as_bool()) {
                        s.settings.show_timer = timer;
                    }
                }
            }
            "device.revoked" => {
                let _ = sidecar.clear_presence().await;
                let _ = clear_all_credentials();
                let mut s = state.write().await;
                s.status = ConnectionStatus::Revoked;
                s.current_track = None;
                s.access_token = None;
                let _ = app_handle.emit("connection_status", s.to_dto());
            }
            _ => {}
        }
    }
}
