#pragma once

#include "discord_adapter.hpp"
#include <iostream>

namespace noirsound {

class MockDiscordPresenceAdapter : public DiscordPresenceAdapter {
public:
    MockDiscordPresenceAdapter() = default;
    ~MockDiscordPresenceAdapter() override = default;

    bool Initialize(const std::string& application_id) override {
        app_id_ = application_id;
        initialized_ = true;
        discord_running_ = true;
        return true;
    }

    bool UpdatePresence(const PresenceData& data) override {
        current_presence_ = data;
        has_presence_ = true;
        return true;
    }

    bool ClearPresence() override {
        has_presence_ = false;
        current_presence_ = PresenceData{};
        return true;
    }

    void RunCallbacks() override {
        // Mock periodic heartbeats or status checks
    }

    bool IsDiscordAvailable() override {
        return discord_running_;
    }

    void Shutdown() override {
        ClearPresence();
        initialized_ = false;
    }

    std::string GetAdapterName() const override {
        return "MockDiscordPresenceAdapter";
    }

    const PresenceData& GetCurrentPresence() const {
        return current_presence_;
    }

    bool HasPresence() const {
        return has_presence_;
    }

private:
    std::string app_id_;
    bool initialized_ = false;
    bool discord_running_ = true;
    bool has_presence_ = false;
    PresenceData current_presence_;
};

} // namespace noirsound
