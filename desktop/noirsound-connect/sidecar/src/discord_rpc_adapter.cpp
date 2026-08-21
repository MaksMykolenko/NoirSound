#include "discord_rpc_adapter.hpp"
#include <iostream>
#include <sstream>
#include <vector>
#include <chrono>
#include <cstring>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <glob.h>

namespace noirsound {

namespace {

enum class IpcOpcode : uint32_t {
    Handshake = 0,
    Frame = 1,
    Close = 2,
    Ping = 3,
    Pong = 4
};

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
            o << "\\u00" << (c < 16 ? "0" : "") << std::hex << (int)c;
        } else {
            o << c;
        }
    }
    return o.str();
}

std::string FindDiscordIpcSocket() {
    // 1. Check TMPDIR environment variable
    const char* tmp_env = std::getenv("TMPDIR");
    if (tmp_env) {
        for (int i = 0; i < 10; ++i) {
            std::string path = std::string(tmp_env) + "/discord-ipc-" + std::to_string(i);
            if (access(path.c_str(), F_OK) == 0) {
                return path;
            }
        }
    }

    // 2. Check /tmp
    for (int i = 0; i < 10; ++i) {
        std::string path = "/tmp/discord-ipc-" + std::to_string(i);
        if (access(path.c_str(), F_OK) == 0) {
            return path;
        }
    }

    // 3. Check macOS /var/folders glob
    glob_t glob_result;
    if (glob("/var/folders/*/*/*/discord-ipc-*", GLOB_NOSORT, nullptr, &glob_result) == 0) {
        if (glob_result.gl_pathc > 0) {
            std::string path = glob_result.gl_pathv[0];
            globfree(&glob_result);
            return path;
        }
        globfree(&glob_result);
    }

    return "";
}

} // namespace

struct DiscordRpcPresenceAdapter::Impl {
    std::string app_id;
    int socket_fd = -1;
    bool is_ready = false;
    bool discord_available = false;
    std::string socket_path;
    std::string connected_user;
    std::string last_command = "none";
    std::string last_result = "none";
    std::chrono::steady_clock::time_point last_reconnect_attempt;
    std::vector<uint8_t> read_buffer;
    uint64_t nonce_counter = 0;
    std::optional<PresenceData> pending_presence;

    bool Connect() {
        Close();

        socket_path = FindDiscordIpcSocket();
        if (socket_path.empty()) {
            discord_available = false;
            is_ready = false;
            return false;
        }

        socket_fd = socket(AF_UNIX, SOCK_STREAM, 0);
        if (socket_fd < 0) {
            discord_available = false;
            return false;
        }

        // Set non-blocking
        int flags = fcntl(socket_fd, F_GETFL, 0);
        if (flags >= 0) {
            fcntl(socket_fd, F_SETFL, flags | O_NONBLOCK);
        }

        struct sockaddr_un addr{};
        addr.sun_family = AF_UNIX;
        std::strncpy(addr.sun_path, socket_path.c_str(), sizeof(addr.sun_path) - 1);

        int res = connect(socket_fd, (struct sockaddr*)&addr, sizeof(addr));
        if (res < 0 && errno != EINPROGRESS) {
            Close();
            discord_available = false;
            return false;
        }

        // Send Handshake
        std::string handshake_json = "{\"v\":1,\"client_id\":\"" + EscapeJson(app_id) + "\"}";
        if (!SendPacket(IpcOpcode::Handshake, handshake_json)) {
            Close();
            discord_available = false;
            return false;
        }

        discord_available = true;
        return true;
    }

    void Close() {
        if (socket_fd >= 0) {
            close(socket_fd);
            socket_fd = -1;
        }
        is_ready = false;
        read_buffer.clear();
    }

    bool SendPacket(IpcOpcode opcode, const std::string& json) {
        if (socket_fd < 0) return false;

        uint32_t op = static_cast<uint32_t>(opcode);
        uint32_t len = static_cast<uint32_t>(json.size());

        std::vector<uint8_t> packet(8 + len);
        std::memcpy(packet.data(), &op, 4);
        std::memcpy(packet.data() + 4, &len, 4);
        std::memcpy(packet.data() + 8, json.data(), len);

        ssize_t written = write(socket_fd, packet.data(), packet.size());
        return (written == static_cast<ssize_t>(packet.size()));
    }

    void ProcessIncomingData() {
        if (socket_fd < 0) return;

        uint8_t temp[4096];
        while (true) {
            ssize_t n = read(socket_fd, temp, sizeof(temp));
            if (n > 0) {
                read_buffer.insert(read_buffer.end(), temp, temp + n);
            } else {
                if (n == 0) {
                    // Server closed connection
                    Close();
                    discord_available = false;
                }
                break;
            }
        }

        // Parse frames
        while (read_buffer.size() >= 8) {
            uint32_t op = 0;
            uint32_t len = 0;
            std::memcpy(&op, read_buffer.data(), 4);
            std::memcpy(&len, read_buffer.data() + 4, 4);

            if (read_buffer.size() < 8 + len) {
                break; // Incomplete frame
            }

            std::string payload(reinterpret_cast<const char*>(read_buffer.data() + 8), len);
            read_buffer.erase(read_buffer.begin(), read_buffer.begin() + 8 + len);

            HandleFrame(static_cast<IpcOpcode>(op), payload);
        }
    }

    void HandleFrame(IpcOpcode op, const std::string& json) {
        if (op == IpcOpcode::Ping) {
            SendPacket(IpcOpcode::Pong, json);
            return;
        }

        if (op == IpcOpcode::Frame) {
            if (json.find("\"evt\":\"READY\"") != std::string::npos) {
                is_ready = true;
                discord_available = true;
                last_result = "READY_ACK";

                // Extract username if present
                size_t u_pos = json.find("\"username\":\"");
                if (u_pos != std::string::npos) {
                    size_t u_end = json.find('"', u_pos + 12);
                    if (u_end != std::string::npos) {
                        connected_user = json.substr(u_pos + 12, u_end - (u_pos + 12));
                    }
                }

                // If we had a pending presence, send it now
                if (pending_presence.has_value()) {
                    SendPresencePayload(pending_presence.value());
                }
            } else if (json.find("\"cmd\":\"SET_ACTIVITY\"") != std::string::npos) {
                last_result = "SET_ACTIVITY_CONFIRMED";
                discord_available = true;
            }
        }
    }

    bool SendPresencePayload(const PresenceData& data) {
        nonce_counter++;
        std::string nonce = "noirsound-" + std::to_string(nonce_counter);

        std::ostringstream json;
        json << "{\"cmd\":\"SET_ACTIVITY\",\"args\":{\"pid\":" << getpid() << ",\"activity\":{";
        json << "\"type\":2,"; // Listening
        json << "\"details\":\"" << EscapeJson(data.title) << "\",";

        std::string state_str = data.artist;
        if (!data.album.empty()) {
            std::string full_state = data.artist + " • " + data.album;
            if (full_state.length() <= 128) {
                state_str = full_state;
            }
        }
        json << "\"state\":\"" << EscapeJson(state_str) << "\"";

        // Timestamps
        if (data.show_timer && data.end_timestamp > 0) {
            json << ",\"timestamps\":{";
            json << "\"start\":" << (data.start_timestamp > 0 ? data.start_timestamp * 1000 : std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count()) << ",";
            json << "\"end\":" << (data.end_timestamp * 1000);
            json << "}";
        }

        // Assets
        json << ",\"assets\":{";
        if (data.show_cover && !data.cover_url.empty()) {
            json << "\"large_image\":\"" << EscapeJson(data.cover_url) << "\",";
        } else {
            json << "\"large_image\":\"noirsound\",";
        }
        json << "\"large_text\":\"" << EscapeJson(!data.album.empty() ? data.album : data.title) << "\",";
        json << "\"small_image\":\"noirsound\",";
        json << "\"small_text\":\"NoirSound\"";
        json << "}";

        // Buttons
        if (!data.share_url.empty()) {
            json << ",\"buttons\":[{\"label\":\"Слухати в NoirSound\",\"url\":\"" << EscapeJson(data.share_url) << "\"}]";
        }

        json << "}},\"nonce\":\"" << nonce << "\"}";

        last_command = "SET_ACTIVITY (Listening)";
        return SendPacket(IpcOpcode::Frame, json.str());
    }

    bool SendClearPayload() {
        nonce_counter++;
        std::string nonce = "noirsound-clear-" + std::to_string(nonce_counter);
        std::string json = "{\"cmd\":\"SET_ACTIVITY\",\"args\":{\"pid\":" + std::to_string(getpid()) + ",\"activity\":null},\"nonce\":\"" + nonce + "\"}";
        last_command = "CLEAR_ACTIVITY";
        return SendPacket(IpcOpcode::Frame, json);
    }
};

DiscordRpcPresenceAdapter::DiscordRpcPresenceAdapter() : impl_(std::make_unique<Impl>()) {}

DiscordRpcPresenceAdapter::~DiscordRpcPresenceAdapter() {
    Shutdown();
}

bool DiscordRpcPresenceAdapter::Initialize(const std::string& application_id) {
    impl_->app_id = application_id;
    return impl_->Connect();
}

bool DiscordRpcPresenceAdapter::UpdatePresence(const PresenceData& data) {
    impl_->pending_presence = data;

    if (impl_->socket_fd < 0 || !impl_->is_ready) {
        impl_->Connect();
    }

    if (impl_->is_ready) {
        return impl_->SendPresencePayload(data);
    }

    return true;
}

bool DiscordRpcPresenceAdapter::ClearPresence() {
    impl_->pending_presence.reset();
    if (impl_->is_ready) {
        return impl_->SendClearPayload();
    }
    return true;
}

void DiscordRpcPresenceAdapter::RunCallbacks() {
    // Process incoming frames
    impl_->ProcessIncomingData();

    // Auto-reconnect if socket closed and 2 seconds passed
    if (impl_->socket_fd < 0) {
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - impl_->last_reconnect_attempt).count() >= 2) {
            impl_->last_reconnect_attempt = now;
            impl_->Connect();
        }
    }
}

bool DiscordRpcPresenceAdapter::IsDiscordAvailable() {
    return impl_->discord_available;
}

void DiscordRpcPresenceAdapter::Shutdown() {
    ClearPresence();
    impl_->Close();
    impl_->discord_available = false;
}

std::string DiscordRpcPresenceAdapter::GetAdapterName() const {
    return "DiscordRpcPresenceAdapter (Official Local IPC Protocol)";
}

std::string DiscordRpcPresenceAdapter::GetLastCommand() const {
    return impl_->last_command;
}

std::string DiscordRpcPresenceAdapter::GetLastResult() const {
    return impl_->last_result;
}

std::string DiscordRpcPresenceAdapter::GetConnectedUser() const {
    return impl_->connected_user;
}

std::string DiscordRpcPresenceAdapter::GetSocketPath() const {
    return impl_->socket_path;
}

} // namespace noirsound
