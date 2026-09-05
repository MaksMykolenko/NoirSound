#pragma once

#include "discord_adapter.hpp"
#include <string>
#include <memory>

namespace noirsound {

class DiscordRpcPresenceAdapter : public DiscordPresenceAdapter {
public:
    DiscordRpcPresenceAdapter();
    ~DiscordRpcPresenceAdapter() override;

    bool Initialize(const std::string& application_id) override;
    bool UpdatePresence(const PresenceData& data) override;
    bool ClearPresence() override;
    void RunCallbacks() override;
    bool IsDiscordAvailable() override;
    void Shutdown() override;
    std::string GetAdapterName() const override;

    // Diagnostics
    std::string GetLastCommand() const;
    std::string GetLastResult() const;
    std::string GetConnectedUser() const;
    std::string GetSocketPath() const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace noirsound
