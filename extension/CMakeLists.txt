cmake_minimum_required(VERSION 3.15)
project(llmgm_extension VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Fetch dependencies
include(FetchContent)

# nlohmann/json
FetchContent_Declare(
    json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)
FetchContent_MakeAvailable(json)

# cpp-httplib
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.15.3
)
FetchContent_MakeAvailable(httplib)

# Source files
set(SOURCES
    src/main.cpp
    src/bridge_client.cpp
    src/json_handler.cpp
)

set(HEADERS
    src/bridge_client.hpp
    src/json_handler.hpp
)

# Create shared library
add_library(llmgm_x64 SHARED ${SOURCES} ${HEADERS})

# Link dependencies
target_link_libraries(llmgm_x64 PRIVATE 
    nlohmann_json::nlohmann_json
    httplib::httplib
)

# Platform-specific settings
if(WIN32)
    set_target_properties(llmgm_x64 PROPERTIES
        OUTPUT_NAME "llmgm_x64"
        SUFFIX ".dll"
    )
    target_compile_definitions(llmgm_x64 PRIVATE _WIN32 _CRT_SECURE_NO_WARNINGS)
    target_link_libraries(llmgm_x64 PRIVATE ws2_32 wsock32)
    
    # Enable OpenSSL support if available
    find_package(OpenSSL)
    if(OPENSSL_FOUND)
        target_link_libraries(llmgm_x64 PRIVATE OpenSSL::SSL OpenSSL::Crypto)
        target_compile_definitions(llmgm_x64 PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)
    endif()
    
elseif(UNIX AND NOT APPLE)
    set_target_properties(llmgm_x64 PROPERTIES
        OUTPUT_NAME "llmgm_x64"
        PREFIX ""
        SUFFIX ".so"
    )
    target_compile_definitions(llmgm_x64 PRIVATE __linux__)
    target_link_libraries(llmgm_x64 PRIVATE pthread)
    
    # Enable OpenSSL support if available
    find_package(OpenSSL)
    if(OPENSSL_FOUND)
        target_link_libraries(llmgm_x64 PRIVATE OpenSSL::SSL OpenSSL::Crypto)
        target_compile_definitions(llmgm_x64 PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)
    endif()
endif()

# Include directories
target_include_directories(llmgm_x64 PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Compiler warnings
if(MSVC)
    target_compile_options(llmgm_x64 PRIVATE /W4)
else()
    target_compile_options(llmgm_x64 PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Installation
install(TARGETS llmgm_x64
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)

# Build information
message(STATUS "")
message(STATUS "═══════════════════════════════════════════")
message(STATUS "  LLM Game Master Extension Configuration")
message(STATUS "═══════════════════════════════════════════")
message(STATUS "Version: ${PROJECT_VERSION}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "System: ${CMAKE_SYSTEM_NAME}")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
if(OPENSSL_FOUND)
    message(STATUS "OpenSSL: Found (HTTPS enabled)")
else()
    message(STATUS "OpenSSL: Not found (HTTP only)")
endif()
message(STATUS "═══════════════════════════════════════════")
message(STATUS "")
