#include "discord_social_sdk_adapter.hpp"
#include <iostream>

namespace noirsound {

#ifdef DISCORD_SOCIAL_SDK_AVAILABLE

struct DiscordSocialSdkAdapter::Impl {
    discord::Core* core = nullptr;
};

DiscordSocialSdkAdapter::DiscordSocialSdkAdapter() : impl_(std::make_unique<Impl>()) {}

DiscordSocialSdkAdapter::~DiscordSocialSdkAdapter() {
    Shutdown();
}

bool DiscordSocialSdkAdapter::Initialize(const std::string& application_id) {
    app_id_ = application_id;
    int64_t client_id = std::stoll(application_id);

    auto result = discord::Core::Create(client_id, DiscordCreateFlags_NoRequireDiscord, &impl_->core);
    if (result != discord::Result::Ok || !impl_->core) {
        discord_available_ = false;
        return false;
    }

    discord_available_ = true;
    is_initialized_ = true;
    return true;
}

bool DiscordSocialSdkAdapter::UpdatePresence(const PresenceData& data) {
    if (!impl_->core || !is_initialized_) return false;

    discord::Activity activity{};
    activity.SetType(discord::ActivityType::Listening);
    activity.SetDetails(data.title.c_str());

    std::string state_str = data.artist;
    if (!data.album.empty()) {
        std::string full_state = data.artist + " • " + data.album;
        if (full_state.length() <= 128) {
            state_str = full_state;
        }
    }
    activity.SetState(state_str.c_str());

    if (data.show_timer && data.end_timestamp > 0) {
        activity.GetTimestamps().SetStart(data.start_timestamp);
        activity.GetTimestamps().SetEnd(data.end_timestamp);
    }

    if (data.show_cover && !data.cover_url.empty()) {
        activity.GetAssets().SetLargeImage(data.cover_url.c_str());
    } else {
        activity.GetAssets().SetLargeImage("noirsound");
    }

    if (!data.album.empty()) {
        activity.GetAssets().SetLargeText(data.album.c_str());
    } else {
        activity.GetAssets().SetLargeText(data.title.c_str());
    }

    activity.GetAssets().SetSmallImage("noirsound");
    activity.GetAssets().SetSmallText("NoirSound");

    impl_->core->ActivityManager().UpdateActivity(activity, [](discord::Result res) {
        if (res != discord::Result::Ok) {
            // Callback failure handled on next tick
        }
    });

    return true;
}

bool DiscordSocialSdkAdapter::ClearPresence() {
    if (!impl_->core || !is_initialized_) return false;

    impl_->core->ActivityManager().ClearActivity([](discord::Result res) {
        // Activity cleared
    });
    return true;
}

void DiscordSocialSdkAdapter::RunCallbacks() {
    if (impl_->core && is_initialized_) {
        impl_->core->RunCallbacks();
    }
}

bool DiscordSocialSdkAdapter::IsDiscordAvailable() {
    return discord_available_;
}

void DiscordSocialSdkAdapter::Shutdown() {
    if (impl_->core) {
        ClearPresence();
        delete impl_->core;
        impl_->core = nullptr;
    }
    is_initialized_ = false;
    discord_available_ = false;
}

std::string DiscordSocialSdkAdapter::GetAdapterName() const {
    return "DiscordSocialSdkAdapter (Official SDK)";
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
