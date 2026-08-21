use keyring::Entry;

const SERVICE_NAME: &str = "co.noirsound.connect";
const REFRESH_TOKEN_KEY: &str = "refresh_token";
const DEVICE_ID_KEY: &str = "device_id";

pub fn save_refresh_token(token: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, REFRESH_TOKEN_KEY).map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_refresh_token() -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, REFRESH_TOKEN_KEY).ok()?;
    entry.get_password().ok()
}

pub fn delete_refresh_token() -> Result<(), String> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, REFRESH_TOKEN_KEY) {
        let _ = entry.delete_password();
    }
    Ok(())
}

pub fn save_device_id(device_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, DEVICE_ID_KEY).map_err(|e| e.to_string())?;
    entry.set_password(device_id).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_device_id() -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, DEVICE_ID_KEY).ok()?;
    entry.get_password().ok()
}

pub fn clear_all_credentials() -> Result<(), String> {
    delete_refresh_token()?;
    if let Ok(entry) = Entry::new(SERVICE_NAME, DEVICE_ID_KEY) {
        let _ = entry.delete_password();
    }
    Ok(())
}
