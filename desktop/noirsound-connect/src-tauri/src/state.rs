use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    NotPaired,
    WaitingForConfirmation,
    Connecting,
    Connected,
    DiscordUnavailable,
    Revoked,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub id: String,
    pub title: String,
    pub artist_name: String,
    pub album_title: Option<String>,
    pub duration_ms: i64,
    pub position_ms: i64,
    pub cover_url: Option<String>,
    pub share_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub enabled: bool,
    pub show_cover: bool,
    pub show_timer: bool,
    pub launch_at_login: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            show_cover: true,
            show_timer: true,
            launch_at_login: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsData {
    pub app_version: String,
    pub api_base_url: String,
    pub masked_device_id: String,
    pub server_state: String,
    pub discord_bridge_state: String,
    pub last_presence_update: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStateDto {
    pub status: ConnectionStatus,
    pub track: Option<TrackMetadata>,
    pub settings: AppSettings,
    pub diagnostics: DiagnosticsData,
    pub is_discord_available: bool,
}

pub struct AppState {
    pub status: ConnectionStatus,
    pub api_base_url: String,
    pub device_id: Option<String>,
    pub access_token: Option<String>,
    pub current_track: Option<TrackMetadata>,
    pub settings: AppSettings,
    pub is_discord_available: bool,
    pub last_update: Option<String>,
    pub server_state: String,
}

impl AppState {
    pub fn new(api_base_url: String) -> Self {
        Self {
            status: ConnectionStatus::NotPaired,
            api_base_url,
            device_id: None,
            access_token: None,
            current_track: None,
            settings: AppSettings::default(),
            is_discord_available: true,
            last_update: None,
            server_state: "Disconnected".to_string(),
        }
    }

    pub fn to_dto(&self) -> AppStateDto {
        let masked_device_id = self.device_id.as_ref().map_or("none".to_string(), |id| {
            if id.len() > 8 {
                format!("{}…{}", &id[0..4], &id[id.len() - 4..])
            } else {
                id.clone()
            }
        });

        AppStateDto {
            status: self.status.clone(),
            track: self.current_track.clone(),
            settings: self.settings.clone(),
            diagnostics: DiagnosticsData {
                app_version: "0.1.0".to_string(),
                api_base_url: self.api_base_url.clone(),
                masked_device_id,
                server_state: self.server_state.clone(),
                discord_bridge_state: if self.is_discord_available {
                    "Connected".to_string()
                } else {
                    "Unavailable".to_string()
                },
                last_presence_update: self.last_update.clone(),
            },
            is_discord_available: self.is_discord_available,
        }
    }
}

pub type SharedState = Arc<RwLock<AppState>>;
