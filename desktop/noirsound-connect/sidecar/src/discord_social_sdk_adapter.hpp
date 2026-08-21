#pragma once

#include "discord_adapter.hpp"
#include <memory>

#ifdef DISCORD_SOCIAL_SDK_AVAILABLE
#include "discord.h"
#endif

namespace noirsound {

class DiscordSocialSdkAdapter : public DiscordPresenceAdapter {
public:
    DiscordSocialSdkAdapter();
    ~DiscordSocialSdkAdapter() override;

    bool Initialize(const std::string& application_id) override;
    bool UpdatePresence(const PresenceData& data) override;
    bool ClearPresence() override;
    void RunCallbacks() override;
    bool IsDiscordAvailable() override;
    void Shutdown() override;
    std::string GetAdapterName() const override;

private:
    std::string app_id_;
    bool is_initialized_ = false;
    bool discord_available_ = false;

#ifdef DISCORD_SOCIAL_SDK_AVAILABLE
    struct Impl;
    std::unique_ptr<Impl> impl_;
#endif
};

} // namespace noirsound
