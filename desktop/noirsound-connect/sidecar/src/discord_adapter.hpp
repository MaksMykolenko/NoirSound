#pragma once

#include <string>
#include <cstdint>

namespace noirsound {

struct PresenceData {
    std::string track_id;
    std::string title;
    std::string artist;
    std::string album;
    int64_t start_timestamp = 0; // Unix seconds
    int64_t end_timestamp = 0;   // Unix seconds
    std::string cover_url;
    std::string share_url;
    bool show_cover = true;
    bool show_timer = true;
};

class DiscordPresenceAdapter {
public:
    virtual ~DiscordPresenceAdapter() = default;
    virtual bool Initialize(const std::string& application_id) = 0;
    virtual bool UpdatePresence(const PresenceData& data) = 0;
    virtual bool ClearPresence() = 0;
    virtual void RunCallbacks() = 0;
    virtual bool IsDiscordAvailable() = 0;
    virtual void Shutdown() = 0;
    virtual std::string GetAdapterName() const = 0;
};

} // namespace noirsound
