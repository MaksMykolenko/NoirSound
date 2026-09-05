cmake_minimum_required(VERSION 3.16)
project(noirsound_discord_bridge VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler warnings
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# macOS RPATH configuration
if(APPLE)
    set(CMAKE_MACOSX_RPATH ON)
    set(CMAKE_INSTALL_RPATH "@executable_path;@executable_path/../Frameworks;@loader_path;@loader_path/../Frameworks")
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
endif()

# Optional Discord Social SDK (OFF by default in favor of native Discord local IPC RPC)
option(ENABLE_DISCORD_SOCIAL_SDK "Build with legacy Discord Social SDK adapter" OFF)

set(SOURCES
    src/main.cpp
    src/mock_discord_adapter.cpp
    src/discord_rpc_adapter.cpp
)

if(ENABLE_DISCORD_SOCIAL_SDK)
    list(APPEND SOURCES src/discord_social_sdk_adapter.cpp)
endif()

add_executable(noirsound-discord-bridge ${SOURCES})
target_include_directories(noirsound-discord-bridge PRIVATE src)

if(ENABLE_DISCORD_SOCIAL_SDK)
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
            find_library(DISCORD_FRAMEWORK
                NAMES discord_partner_sdk DiscordPartnerSDK
                PATHS "${SDK_ROOT_DIR}"
                NO_DEFAULT_PATH
            )
            if(DISCORD_FRAMEWORK)
                target_include_directories(noirsound-discord-bridge PRIVATE "${DISCORD_FRAMEWORK}/Headers")
                target_link_libraries(noirsound-discord-bridge PRIVATE "${DISCORD_FRAMEWORK}")
                add_custom_command(TARGET noirsound-discord-bridge POST_BUILD
                    COMMAND ${CMAKE_COMMAND} -E copy_directory
                        "${SDK_ROOT_DIR}/discord_partner_sdk.framework"
                        "$<TARGET_FILE_DIR:noirsound-discord-bridge>/discord_partner_sdk.framework"
                    COMMENT "Copying discord_partner_sdk.framework to build directory"
                )
            endif()
        endif()
    endif()
endif()

# Test target
enable_testing()
add_executable(test_discord_rpc
    tests/test_discord_rpc.cpp
    src/discord_rpc_adapter.cpp
    src/mock_discord_adapter.cpp
)
target_include_directories(test_discord_rpc PRIVATE src)
add_test(NAME DiscordRpcTest COMMAND test_discord_rpc)

# Installation target
install(TARGETS noirsound-discord-bridge DESTINATION bin)
