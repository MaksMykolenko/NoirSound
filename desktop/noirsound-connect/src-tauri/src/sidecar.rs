use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;
use crate::state::TrackMetadata;

pub struct SidecarManager {
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    is_running: Arc<AtomicBool>,
    is_discord_available: Arc<AtomicBool>,
    child_handle: Arc<Mutex<Option<Child>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            stdin: Arc::new(Mutex::new(None)),
            is_running: Arc::new(AtomicBool::new(false)),
            is_discord_available: Arc::new(AtomicBool::new(true)),
            child_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_discord_available(&self) -> bool {
        self.is_discord_available.load(Ordering::Relaxed)
    }

    fn find_sidecar_binary() -> Option<PathBuf> {
        let current_exe = std::env::current_exe().ok()?;
        let exe_dir = current_exe.parent()?;

        let candidates = [
            exe_dir.join("noirsound-discord-bridge"),
            exe_dir.join("../Resources/noirsound-discord-bridge"),
            exe_dir.join("../../../sidecar/build/noirsound-discord-bridge"),
            PathBuf::from("desktop/noirsound-connect/sidecar/build/noirsound-discord-bridge"),
            PathBuf::from("sidecar/build/noirsound-discord-bridge"),
            PathBuf::from("../sidecar/build/noirsound-discord-bridge"),
        ];

        for path in &candidates {
            if path.exists() {
                return Some(path.clone());
            }
        }

        // Search relative to current working directory
        if let Ok(cwd) = std::env::current_dir() {
            let cwd_candidates = [
                cwd.join("desktop/noirsound-connect/sidecar/build/noirsound-discord-bridge"),
                cwd.join("sidecar/build/noirsound-discord-bridge"),
                cwd.join("../sidecar/build/noirsound-discord-bridge"),
            ];
            for path in &cwd_candidates {
                if path.exists() {
                    return Some(path.clone());
                }
            }
        }

        None
    }

    pub async fn start(&self) -> Result<(), String> {
        let binary_path = Self::find_sidecar_binary()
            .ok_or_else(|| "Could not locate noirsound-discord-bridge binary".to_string())?;

        let mut child = Command::new(binary_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn Discord bridge sidecar: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to capture sidecar stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to capture sidecar stdout")?;

        *self.stdin.lock().await = Some(stdin);
        *self.child_handle.lock().await = Some(child);
        self.is_running.store(true, Ordering::SeqCst);

        // Spawn stdout reader loop
        let is_running_clone = self.is_running.clone();
        let is_discord_available_clone = self.is_discord_available.clone();

        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while is_running_clone.load(Ordering::SeqCst) {
                match reader.next_line().await {
                    Ok(Some(line)) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                            if let Some(msg_type) = json.get("type").and_then(|t| t.as_str()) {
                                match msg_type {
                                    "ready" => {
                                        if let Some(avail) = json.get("discord_available").and_then(|a| a.as_bool()) {
                                            is_discord_available_clone.store(avail, Ordering::Relaxed);
                                        }
                                    }
                                    "discord_available" => {
                                        if let Some(avail) = json.get("value").and_then(|v| v.as_bool()) {
                                            is_discord_available_clone.store(avail, Ordering::Relaxed);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
            is_running_clone.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    pub async fn send_command(&self, json_cmd: &str) -> Result<(), String> {
        let mut stdin_guard = self.stdin.lock().await;
        if let Some(stdin) = stdin_guard.as_mut() {
            stdin
                .write_all(format!("{}\n", json_cmd).as_bytes())
                .await
                .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
            stdin.flush().await.map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Sidecar stdin is not available".to_string())
        }
    }

    pub async fn set_presence(
        &self,
        track: &TrackMetadata,
        show_cover: bool,
        show_timer: bool,
    ) -> Result<(), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let start_timestamp = now - (track.position_ms / 1000);
        let remaining_secs = (track.duration_ms - track.position_ms) / 1000;
        let end_timestamp = if remaining_secs > 0 {
            now + remaining_secs
        } else {
            0
        };

        let cmd = serde_json::json!({
            "command": "set_presence",
            "trackId": track.id,
            "title": track.title,
            "artist": track.artist_name,
            "album": track.album_title.as_deref().unwrap_or(""),
            "coverUrl": track.cover_url.as_deref().unwrap_or(""),
            "shareUrl": track.share_url,
            "startTimestamp": start_timestamp,
            "endTimestamp": end_timestamp,
            "showCover": show_cover,
            "showTimer": show_timer,
        });

        self.send_command(&cmd.to_string()).await
    }

    pub async fn clear_presence(&self) -> Result<(), String> {
        let cmd = serde_json::json!({ "command": "clear_presence" });
        self.send_command(&cmd.to_string()).await
    }

    pub async fn shutdown(&self) {
        self.is_running.store(false, Ordering::SeqCst);
        let _ = self.clear_presence().await;
        let _ = self.send_command("{\"command\":\"shutdown\"}").await;

        let mut child_guard = self.child_handle.lock().await;
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
        }
    }
}
