#include <iostream>
#include <cassert>
#include <cstring>
#include <string>
#include "discord_rpc_adapter.hpp"
#include "mock_discord_adapter.hpp"

int main() {
    std::cout << "[TEST] Starting Discord RPC Adapter tests..." << std::endl;

    // Test 1: Mock Adapter
    {
        noirsound::MockDiscordPresenceAdapter mock;
        assert(mock.Initialize("1540281435296895066") == true);
        assert(mock.IsDiscordAvailable() == true);
        assert(mock.GetAdapterName() == "MockDiscordPresenceAdapter");

        noirsound::PresenceData data;
        data.track_id = "test-track-1";
        data.title = "Тестовий трек українською";
        data.artist = "Український Виконавець";
        data.album = "Тестовий Альбом";
        data.cover_url = "https://noirsound.co/api/public/covers/test-1";
        data.share_url = "https://noirsound.co/track/test-1";
        data.start_timestamp = 1787308000;
        data.end_timestamp = 1787308240;
        data.show_cover = true;
        data.show_timer = true;

        assert(mock.UpdatePresence(data) == true);
        assert(mock.HasPresence() == true);
        assert(mock.GetCurrentPresence().track_id == "test-track-1");
        assert(mock.GetCurrentPresence().title == "Тестовий трек українською");
        assert(mock.GetCurrentPresence().artist == "Український Виконавець");

        assert(mock.ClearPresence() == true);
        assert(mock.HasPresence() == false);
        mock.Shutdown();
        std::cout << "[PASS] Test 1: Mock Adapter verified" << std::endl;
    }

    // Test 2: DiscordRpcPresenceAdapter initialization & interface
    {
        noirsound::DiscordRpcPresenceAdapter rpc;
        assert(rpc.GetAdapterName() == "DiscordRpcPresenceAdapter (Official Local IPC Protocol)");
        assert(rpc.GetLastCommand() == "none");
        assert(rpc.GetLastResult() == "none");

        // Initialization with Application ID
        rpc.Initialize("1540281435296895066");

        // Update presence with Unicode Ukrainian / Cyrillic / Emojis / Quotes
        noirsound::PresenceData data;
        data.track_id = "d76bc3f6-783a-4bf2-8398-48d96dde6cb7";
        data.title = "Пора домой 🎵 \"Special Edition\" & <Live>";
        data.artist = "LOBODA";
        data.album = "H2LO";
        data.cover_url = "https://noirsound.co/api/public/covers/d76bc3f6-783a-4bf2-8398-48d96dde6cb7";
        data.share_url = "https://noirsound.co/track/d76bc3f6-783a-4bf2-8398-48d96dde6cb7";
        data.start_timestamp = 1787308000;
        data.end_timestamp = 1787308241;
        data.show_cover = true;
        data.show_timer = true;

        bool updated = rpc.UpdatePresence(data);
        assert(updated == true);
        rpc.RunCallbacks();

        // Clear presence
        bool cleared = rpc.ClearPresence();
        assert(cleared == true);
        rpc.RunCallbacks();

        rpc.Shutdown();
        std::cout << "[PASS] Test 2: DiscordRpcPresenceAdapter interface and Unicode handling verified" << std::endl;
    }

    std::cout << "[ALL PASS] All Discord RPC tests passed successfully!" << std::endl;
    return 0;
}
