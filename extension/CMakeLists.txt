cmake_minimum_required(VERSION 3.15)
project(llmgm_extension)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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

# Create library
add_library(llmgm_x64 SHARED ${SOURCES} ${HEADERS})

# Platform-specific settings
if(WIN32)
    set_target_properties(llmgm_x64 PROPERTIES
        OUTPUT_NAME "llmgm_x64"
        SUFFIX ".dll"
    )
    target_compile_definitions(llmgm_x64 PRIVATE _WIN32)
elseif(UNIX AND NOT APPLE)
    set_target_properties(llmgm_x64 PROPERTIES
        OUTPUT_NAME "llmgm_x64"
        SUFFIX ".so"
    )
    target_compile_definitions(llmgm_x64 PRIVATE __linux__)
endif()

# Include directories
target_include_directories(llmgm_x64 PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/deps/nlohmann/include
    ${CMAKE_CURRENT_SOURCE_DIR}/deps/cpp-httplib
)

# Link libraries
if(WIN32)
    target_link_libraries(llmgm_x64 ws2_32 wsock32)
endif()

# Installation
install(TARGETS llmgm_x64
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)
