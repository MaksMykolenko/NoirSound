cmake_minimum_required(VERSION 3.16)
project(noirsound_discord_bridge VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Determine Target Platform
if(APPLE)
    set(CMAKE_MACOSX_RPATH ON)
    set(CMAKE_INSTALL_RPATH "@executable_path;@executable_path/../Frameworks")
endif()

# Source files
set(SOURCES
    src/main.cpp
    src/mock_discord_adapter.cpp
    src/discord_social_sdk_adapter.cpp
)

add_executable(noirsound-discord-bridge ${SOURCES})

# Check for Discord Social SDK root
set(DISCORD_SDK_ROOT $ENV{DISCORD_SOCIAL_SDK_ROOT})

if(DISCORD_SDK_ROOT AND EXISTS "${DISCORD_SDK_ROOT}/include")
    message(STATUS "Found Discord Social SDK at: ${DISCORD_SDK_ROOT}")
    target_include_directories(noirsound-discord-bridge PRIVATE "${DISCORD_SDK_ROOT}/include")
    target_compile_definitions(noirsound-discord-bridge PRIVATE DISCORD_SOCIAL_SDK_AVAILABLE)

    if(APPLE)
        find_library(DISCORD_SDK_LIB
            NAMES discord_game_sdk discord_social_sdk
            PATHS "${DISCORD_SDK_ROOT}/lib/x86_64" "${DISCORD_SDK_ROOT}/lib/arm64" "${DISCORD_SDK_ROOT}/lib"
            NO_DEFAULT_PATH
        )
        if(DISCORD_SDK_LIB)
            target_link_libraries(noirsound-discord-bridge PRIVATE ${DISCORD_SDK_LIB})
            message(STATUS "Linking Discord SDK library: ${DISCORD_SDK_LIB}")
        endif()
    endif()
else()
    message(STATUS "DISCORD_SOCIAL_SDK_ROOT not set or not found. Building with Mock Discord Presence adapter.")
endif()

# Installation target
install(TARGETS noirsound-discord-bridge DESTINATION bin)
