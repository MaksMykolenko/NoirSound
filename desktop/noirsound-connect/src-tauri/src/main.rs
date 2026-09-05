#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    noirsound_connect_lib::run();
}
