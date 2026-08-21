cmake_minimum_required(VERSION 3.16)
project(noirsound_discord_bridge VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# macOS RPATH configuration
if(APPLE)
    set(CMAKE_MACOSX_RPATH ON)
    set(CMAKE_INSTALL_RPATH "@executable_path;@executable_path/../Frameworks;@loader_path;@loader_path/../Frameworks")
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
endif()

# Source files
set(SOURCES
    src/main.cpp
    src/mock_discord_adapter.cpp
    src/discord_social_sdk_adapter.cpp
)

add_executable(noirsound-discord-bridge ${SOURCES})

# Check for SDK in environment or standard directories
set(SEARCH_PATHS
    "$ENV{DISCORD_SOCIAL_SDK_ROOT}"
    "$ENV{DISCORD_PARTNER_SDK_ROOT}"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../vendor/discord-social-sdk"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../../vendor/discord-social-sdk"
    "$ENV{HOME}/Downloads/discord-social-sdk"
    "$ENV{HOME}/Downloads/discord_partner_sdk"
)

set(SDK_FOUND FALSE)
set(SDK_ROOT_DIR "")

foreach(PATH_CANDIDATE ${SEARCH_PATHS})
    if(PATH_CANDIDATE AND EXISTS "${PATH_CANDIDATE}")
        if(EXISTS "${PATH_CANDIDATE}/include/discordpp.h" OR
           EXISTS "${PATH_CANDIDATE}/include/discord.h" OR
           EXISTS "${PATH_CANDIDATE}/discord_partner_sdk.framework" OR
           EXISTS "${PATH_CANDIDATE}/Headers/discordpp.h")
            set(SDK_FOUND TRUE)
            set(SDK_ROOT_DIR "${PATH_CANDIDATE}")
            break()
        endif()
    endif()
endforeach()

if(SDK_FOUND)
    message(STATUS "Found Discord Social/Partner SDK at: ${SDK_ROOT_DIR}")
    target_compile_definitions(noirsound-discord-bridge PRIVATE DISCORD_SOCIAL_SDK_AVAILABLE)

    if(EXISTS "${SDK_ROOT_DIR}/include")
        target_include_directories(noirsound-discord-bridge PRIVATE "${SDK_ROOT_DIR}/include")
    endif()

    if(APPLE)
        # 1. Search for macOS Framework
        find_library(DISCORD_FRAMEWORK
            NAMES discord_partner_sdk DiscordPartnerSDK
            PATHS "${SDK_ROOT_DIR}"
            NO_DEFAULT_PATH
        )

        # 2. Search for dynamic library
        find_library(DISCORD_DYLIB
            NAMES discord_partner_sdk discord_game_sdk discord_social_sdk
            PATHS "${SDK_ROOT_DIR}/lib/arm64" "${SDK_ROOT_DIR}/lib" "${SDK_ROOT_DIR}/lib/release"
            NO_DEFAULT_PATH
        )

        if(DISCORD_FRAMEWORK)
            target_include_directories(noirsound-discord-bridge PRIVATE "${DISCORD_FRAMEWORK}/Headers")
            target_link_libraries(noirsound-discord-bridge PRIVATE "${DISCORD_FRAMEWORK}")
            message(STATUS "Discord adapter: REAL (macOS Framework: ${DISCORD_FRAMEWORK})")
        elseif(DISCORD_DYLIB)
            target_link_libraries(noirsound-discord-bridge PRIVATE "${DISCORD_DYLIB}")
            message(STATUS "Discord adapter: REAL (Dynamic library: ${DISCORD_DYLIB})")
        else()
            message(STATUS "Discord adapter: REAL (Headers only)")
        endif()
    else()
        find_library(DISCORD_LIB
            NAMES discord_partner_sdk discord_game_sdk discord_social_sdk
            PATHS "${SDK_ROOT_DIR}/lib/arm64" "${SDK_ROOT_DIR}/lib/x86_64" "${SDK_ROOT_DIR}/lib"
            NO_DEFAULT_PATH
        )
        if(DISCORD_LIB)
            target_link_libraries(noirsound-discord-bridge PRIVATE "${DISCORD_LIB}")
            message(STATUS "Discord adapter: REAL (Library: ${DISCORD_LIB})")
        endif()
    endif()
else()
    if(DEFINED ENV{NOIRSOUND_DISCORD_REQUIRE_REAL_SDK} AND "$ENV{NOIRSOUND_DISCORD_REQUIRE_REAL_SDK}" STREQUAL "1")
        message(FATAL_ERROR "NOIRSOUND_DISCORD_REQUIRE_REAL_SDK is enabled but Discord Social SDK was not found! Real SDK is strictly required for production builds.")
    endif()
    message(STATUS "Discord adapter: MOCK (MockDiscordPresenceAdapter)")
endif()

if(APPLE AND DISCORD_FRAMEWORK)
    add_custom_command(TARGET noirsound-discord-bridge POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${SDK_ROOT_DIR}/discord_partner_sdk.framework"
            "$<TARGET_FILE_DIR:noirsound-discord-bridge>/discord_partner_sdk.framework"
        COMMENT "Copying discord_partner_sdk.framework to build directory for direct execution"
    )
endif()

# Installation target
install(TARGETS noirsound-discord-bridge DESTINATION bin)
