#include <iostream>
#include <string>
#include <sstream>
#include <memory>
#include <chrono>
#include <thread>
#include <atomic>
#include <csignal>
#include <poll.h>
#include <unistd.h>
#include "discord_adapter.hpp"
#include "mock_discord_adapter.hpp"
#include "discord_social_sdk_adapter.hpp"

namespace {
std::atomic<bool> g_running{true};

void SignalHandler(int /*signal*/) {
    g_running = false;
}

// Safe string escaping for JSON
std::string EscapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ('\x00' <= c && c <= '\x1f') {
            o << "\\u" << std::hex << (int)c;
        } else {
            o << c;
        }
    }
    return o.str();
}

std::string ExtractStringField(const std::string& json, const std::string& field) {
    std::string key = "\"" + field + "\"";
    size_t pos = json.find(key);
    if (pos == std::string::npos) return "";

    pos = json.find(':', pos);
    if (pos == std::string::npos) return "";

    pos = json.find('"', pos);
    if (pos == std::string::npos) return "";

    size_t end = json.find('"', pos + 1);
    if (end == std::string::npos) return "";

    return json.substr(pos + 1, end - (pos + 1));
}

int64_t ExtractInt64Field(const std::string& json, const std::string& field, int64_t default_val = 0) {
    std::string key = "\"" + field + "\"";
    size_t pos = json.find(key);
    if (pos == std::string::npos) return default_val;

    pos = json.find(':', pos);
    if (pos == std::string::npos) return default_val;

    size_t start = json.find_first_of("-0123456789", pos);
    if (start == std::string::npos) return default_val;

    size_t end = json.find_first_not_of("0123456789", start + (json[start] == '-' ? 1 : 0));
    std::string num_str = json.substr(start, end - start);
    try {
        return std::stoll(num_str);
    } catch (...) {
        return default_val;
    }
}

bool ExtractBoolField(const std::string& json, const std::string& field, bool default_val = true) {
    std::string key = "\"" + field + "\"";
    size_t pos = json.find(key);
    if (pos == std::string::npos) return default_val;

    pos = json.find(':', pos);
    if (pos == std::string::npos) return default_val;

    if (json.find("true", pos) != std::string::npos && (json.find("true", pos) < json.find(',', pos))) {
        return true;
    }
    if (json.find("false", pos) != std::string::npos && (json.find("false", pos) < json.find(',', pos))) {
        return false;
    }
    return default_val;
}

void SendJson(const std::string& json) {
    std::cout << json << std::endl;
    std::cout.flush();
}

void ProcessCommand(const std::string& line, noirsound::DiscordPresenceAdapter* adapter) {
    std::string command = ExtractStringField(line, "command");

    if (command == "ping") {
        SendJson("{\"type\":\"pong\",\"timestamp\":" +
                 std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
                     std::chrono::system_clock::now().time_since_epoch()).count()) + "}");
    } else if (command == "get_status") {
        adapter->RunCallbacks();
        SendJson("{\"type\":\"discord_available\",\"value\":" +
                 std::string(adapter->IsDiscordAvailable() ? "true" : "false") + "}");
    } else if (command == "set_presence") {
        noirsound::PresenceData data;
        data.track_id = ExtractStringField(line, "trackId");
        data.title = ExtractStringField(line, "title");
        data.artist = ExtractStringField(line, "artist");
        data.album = ExtractStringField(line, "album");
        data.cover_url = ExtractStringField(line, "coverUrl");
        data.share_url = ExtractStringField(line, "shareUrl");
        data.start_timestamp = ExtractInt64Field(line, "startTimestamp", 0);
        data.end_timestamp = ExtractInt64Field(line, "endTimestamp", 0);
        data.show_cover = ExtractBoolField(line, "showCover", true);
        data.show_timer = ExtractBoolField(line, "showTimer", true);

        bool success = adapter->UpdatePresence(data);
        adapter->RunCallbacks();

        if (success) {
            SendJson("{\"type\":\"presence_updated\",\"trackId\":\"" + EscapeJson(data.track_id) + "\"}");
        } else {
            SendJson("{\"type\":\"error\",\"code\":\"UPDATE_FAILED\",\"message\":\"Failed to update Discord presence.\"}");
        }
    } else if (command == "clear_presence") {
        adapter->ClearPresence();
        adapter->RunCallbacks();
        SendJson("{\"type\":\"presence_cleared\"}");
    } else if (command == "shutdown") {
        adapter->Shutdown();
        SendJson("{\"type\":\"shutdown_acknowledged\"}");
        g_running = false;
    } else {
        SendJson("{\"type\":\"error\",\"code\":\"UNKNOWN_COMMAND\",\"message\":\"Command not recognized.\"}");
    }
}

} // namespace

int main(int argc, char* argv[]) {
    std::signal(SIGINT, SignalHandler);
    std::signal(SIGTERM, SignalHandler);

    std::string application_id = "1540281435296895066";
    bool use_mock = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--mock") {
            use_mock = true;
        } else if (arg.rfind("--app-id=", 0) == 0) {
            application_id = arg.substr(9);
        }
    }

    std::unique_ptr<noirsound::DiscordPresenceAdapter> adapter;

#ifdef DISCORD_SOCIAL_SDK_AVAILABLE
    if (use_mock) {
        adapter = std::make_unique<noirsound::MockDiscordPresenceAdapter>();
    } else {
        adapter = std::make_unique<noirsound::DiscordSocialSdkAdapter>();
    }
#else
    // Fallback to Mock if SDK is not compiled
    adapter = std::make_unique<noirsound::MockDiscordPresenceAdapter>();
#endif

    bool init_ok = adapter->Initialize(application_id);

    SendJson("{\"type\":\"ready\",\"version\":\"0.1.0\",\"adapter\":\"" +
             EscapeJson(adapter->GetAdapterName()) + "\",\"discord_available\":" +
             (init_ok && adapter->IsDiscordAvailable() ? "true" : "false") + "}");

    std::string line_buffer;

    while (g_running) {
        struct pollfd fds[1];
        fds[0].fd = STDIN_FILENO;
        fds[0].events = POLLIN;

        int ret = poll(fds, 1, 50); // 50ms tick for responsive callbacks

        if (ret > 0 && (fds[0].revents & POLLIN)) {
            char buf[1024];
            ssize_t bytes_read = read(STDIN_FILENO, buf, sizeof(buf) - 1);
            if (bytes_read <= 0) {
                // EOF on stdin -> parent exited, trigger clean shutdown
                break;
            }
            buf[bytes_read] = '\0';
            line_buffer.append(buf, bytes_read);

            size_t newline_pos;
            while ((newline_pos = line_buffer.find('\n')) != std::string::npos) {
                std::string line = line_buffer.substr(0, newline_pos);
                line_buffer.erase(0, newline_pos + 1);

                if (!line.empty() && line.back() == '\r') {
                    line.pop_back();
                }

                if (!line.empty()) {
                    ProcessCommand(line, adapter.get());
                }
            }
        } else if (ret > 0 && (fds[0].revents & (POLLERR | POLLHUP | POLLNVAL))) {
            // Error or HUP on stdin
            break;
        }

        // Pump asynchronous Discord callbacks on every tick
        adapter->RunCallbacks();
    }

    adapter->Shutdown();
    return 0;
}
