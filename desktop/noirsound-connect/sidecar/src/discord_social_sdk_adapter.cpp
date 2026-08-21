#ifdef DISCORD_SOCIAL_SDK_AVAILABLE
#define DISCORDPP_IMPLEMENTATION
#include "discordpp.h"
#endif

#include "discord_social_sdk_adapter.hpp"
#include <iostream>
#include <sys/stat.h>

namespace noirsound {

#ifdef DISCORD_SOCIAL_SDK_AVAILABLE

struct DiscordSocialSdkAdapter::Impl {
    std::unique_ptr<discordpp::Client> client;
};

DiscordSocialSdkAdapter::DiscordSocialSdkAdapter() : impl_(std::make_unique<Impl>()) {}

DiscordSocialSdkAdapter::~DiscordSocialSdkAdapter() {
    Shutdown();
}

bool DiscordSocialSdkAdapter::Initialize(const std::string& application_id) {
    app_id_ = application_id;
    uint64_t client_id = 0;
    try {
        client_id = std::stoull(application_id);
    } catch (...) {
        discord_available_ = false;
        return false;
    }

    try {
        impl_->client = std::make_unique<discordpp::Client>();
        impl_->client->SetApplicationId(client_id);
        
        impl_->client->AddLogCallback([](std::string message, discordpp::LoggingSeverity severity) {
            std::cerr << "[DiscordSDK][" << EnumToString(severity) << "] " << message << std::endl;
        }, discordpp::LoggingSeverity::Verbose);

        const char* home = std::getenv("HOME");
        if (home) {
            std::string log_dir = std::string(home) + "/Library/Logs/NoirSoundConnect/DiscordSDK";
            mkdir(log_dir.c_str(), 0755);
            impl_->client->SetLogDir(log_dir, discordpp::LoggingSeverity::Verbose);
        }

        discord_available_ = true;
        is_initialized_ = true;
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Failed to initialize Discord Client: " << e.what() << std::endl;
        discord_available_ = false;
        return false;
    }
}

bool DiscordSocialSdkAdapter::UpdatePresence(const PresenceData& data) {
    if (!impl_->client || !is_initialized_) return false;

    try {
        discordpp::Activity activity{};
        activity.SetType(discordpp::ActivityTypes::Listening);
        activity.SetName("NoirSound");
        activity.SetDetails(data.title);

        std::string state_str = data.artist;
        if (!data.album.empty()) {
            std::string full_state = data.artist + " • " + data.album;
            if (full_state.length() <= 128) {
                state_str = full_state;
            }
        }
        activity.SetState(state_str);

        if (!data.share_url.empty()) {
            activity.SetDetailsUrl(data.share_url);
            activity.SetStateUrl(data.share_url);
        }

        if (data.show_timer && data.end_timestamp > 0) {
            discordpp::ActivityTimestamps timestamps{};
            timestamps.SetStart(static_cast<uint64_t>(data.start_timestamp) * 1000);
            timestamps.SetEnd(static_cast<uint64_t>(data.end_timestamp) * 1000);
            activity.SetTimestamps(timestamps);
        }

        discordpp::ActivityAssets assets{};
        if (data.show_cover && !data.cover_url.empty()) {
            assets.SetLargeImage(data.cover_url);
        } else {
            assets.SetLargeImage("noirsound");
        }

        if (!data.album.empty()) {
            assets.SetLargeText(data.album);
        } else {
            assets.SetLargeText(data.title);
        }

        assets.SetSmallImage("noirsound");
        assets.SetSmallText("NoirSound");
        activity.SetAssets(assets);

        if (!data.share_url.empty()) {
            discordpp::ActivityButton button{};
            button.SetLabel("Слухати в NoirSound");
            button.SetUrl(data.share_url);
            activity.AddButton(button);
        }

        impl_->client->UpdateRichPresence(std::move(activity), [this](discordpp::ClientResult result) {
            if (result.Successful()) {
                discord_available_ = true;
            } else {
                // If RPC error occurs, discord desktop may not be open or accepting RPC
                if (result.Type() == discordpp::ErrorType::RPCError ||
                    result.Type() == discordpp::ErrorType::NetworkError) {
                    discord_available_ = false;
                }
            }
        });

        return true;
    } catch (const std::exception& e) {
        std::cerr << "UpdatePresence exception: " << e.what() << std::endl;
        return false;
    }
}

bool DiscordSocialSdkAdapter::ClearPresence() {
    if (!impl_->client || !is_initialized_) return false;

    try {
        impl_->client->ClearRichPresence();
        return true;
    } catch (...) {
        return false;
    }
}

void DiscordSocialSdkAdapter::RunCallbacks() {
    if (impl_->client && is_initialized_) {
        try {
            discordpp::RunCallbacks();
        } catch (...) {
            // ignore pump exceptions
        }
    }
}

bool DiscordSocialSdkAdapter::IsDiscordAvailable() {
    return discord_available_;
}

void DiscordSocialSdkAdapter::Shutdown() {
    if (impl_->client) {
        ClearPresence();
        impl_->client.reset();
    }
    is_initialized_ = false;
    discord_available_ = false;
}

std::string DiscordSocialSdkAdapter::GetAdapterName() const {
    return "DiscordSocialSdkAdapter (Official Discord Social SDK 1.10.18687)";
}

#else

// Fallback stub when official SDK binary is not linked at compile time
DiscordSocialSdkAdapter::DiscordSocialSdkAdapter() = default;
DiscordSocialSdkAdapter::~DiscordSocialSdkAdapter() = default;

bool DiscordSocialSdkAdapter::Initialize(const std::string& application_id) {
    app_id_ = application_id;
    is_initialized_ = true;
    discord_available_ = true;
    return true;
}

bool DiscordSocialSdkAdapter::UpdatePresence(const PresenceData& /*data*/) {
    return true;
}

bool DiscordSocialSdkAdapter::ClearPresence() {
    return true;
}

void DiscordSocialSdkAdapter::RunCallbacks() {}

bool DiscordSocialSdkAdapter::IsDiscordAvailable() {
    return discord_available_;
}

void DiscordSocialSdkAdapter::Shutdown() {
    is_initialized_ = false;
}

std::string DiscordSocialSdkAdapter::GetAdapterName() const {
    return "DiscordSocialSdkAdapter (Stub / SDK Headers Not Linked)";
}

#endif

} // namespace noirsound
