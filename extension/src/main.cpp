/**
 * Arma 3 LLM Game Master Extension
 * Main entry point for DLL/SO - ARMA 3 COMPATIBLE
 * 
 * Based on official Bohemia Interactive extension specifications:
 * - https://community.bistudio.com/wiki/Extensions
 * - https://community.bistudio.com/wiki/callExtension
 * 
 * For x64 builds, calling conventions are automatically x64 (not __stdcall)
 * For x86 builds, __stdcall is required
 */

#include <string>
#include <queue>
#include <mutex>
#include <cstring>
#include "bridge_client.hpp"
#include "json_handler.hpp"

// Extension version
#define EXTENSION_VERSION "0.1.0"
#define EXTENSION_NAME "LLMGM"

// Thread-safe queue for responses
std::queue<std::string> responseQueue;
std::mutex queueMutex;

// Bridge client instance
BridgeClient* bridgeClient = nullptr;

// Initialize bridge client
void initializeBridge(const std::string& serverUrl) {
    if (bridgeClient == nullptr) {
        bridgeClient = new BridgeClient(serverUrl);
    }
}

// Define export macro based on platform
#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
    // For x86 (32-bit) use __stdcall, for x64 it's ignored (automatic x64 convention)
    #ifdef _WIN64
        #define CALLCONV
    #else
        #define CALLCONV __stdcall
    #endif
#else
    #define EXPORT
    #define CALLCONV
#endif

extern "C" {
    /**
     * RVExtensionVersion
     * Returns extension version (max 32 bytes)
     * Called by Arma 3 when extension is loaded
     */
    EXPORT void CALLCONV RVExtensionVersion(char* output, int outputSize) {
        strncpy(output, EXTENSION_VERSION, outputSize - 1);
        output[outputSize - 1] = '\0';
    }

    /**
     * RVExtensionArgs
     * Main extension function - handles all commands
     * Introduced in Arma 3 v1.68+ (supports multiple arguments)
     * 
     * Usage from SQF:
     *   "llmgm" callExtension ["send", [_jsonData]];
     *   "llmgm" callExtension ["receive", [""]];
     *   "llmgm" callExtension ["status", [""]];
     *   "llmgm" callExtension ["config", [_configJson]];
     * 
     * Parameters:
     *   output - Buffer for return value (10240 bytes max)
     *   outputSize - Size of output buffer
     *   function - Command name (not used, kept for compatibility)
     *   argv - Array of string arguments
     *   argc - Number of arguments
     * 
     * Returns:
     *   0 = success, extension processed request
     *   1 = error, extension encountered an error
     */
    EXPORT int CALLCONV RVExtensionArgs(char* output, int outputSize, 
                                        const char* function, 
                                        const char** argv, int argc) {
        std::string result;

        try {
            // Initialize bridge if needed (default to localhost:3000)
            if (bridgeClient == nullptr) {
                initializeBridge("http://localhost:3000");
            }

            // Require at least one argument (command name)
            if (argc < 1) {
                result = "error:no_command";
                strncpy(output, result.c_str(), outputSize - 1);
                output[outputSize - 1] = '\0';
                return 1; // Error
            }

            std::string command(argv[0]);

            if (command == "send" && argc > 1) {
                // Send game state to bridge
                // argv[1] contains JSON game state
                std::string jsonData(argv[1]);
                bool success = bridgeClient->sendState(jsonData);
                result = success ? "ok" : "error:send_failed";

            } else if (command == "receive") {
                // Get pending action from bridge
                std::lock_guard<std::mutex> lock(queueMutex);
                if (!responseQueue.empty()) {
                    result = responseQueue.front();
                    responseQueue.pop();
                } else {
                    // Poll bridge for new actions
                    std::string action = bridgeClient->getAction();
                    if (!action.empty()) {
                        result = action;
                    } else {
                        result = ""; // No action available
                    }
                }

            } else if (command == "status") {
                // Get connection status
                bool connected = bridgeClient->isConnected();
                result = connected ? "connected" : "disconnected";

            } else if (command == "config" && argc > 1) {
                // Update configuration
                std::string configJson(argv[1]);
                
                // Parse and apply config
                if (JSONHandler::validate(configJson)) {
                    std::string newUrl = JSONHandler::extractField(configJson, "serverUrl");
                    if (!newUrl.empty()) {
                        // Reinitialize with new URL
                        if (bridgeClient != nullptr) {
                            delete bridgeClient;
                        }
                        initializeBridge(newUrl);
                        result = "ok:config_updated";
                    } else {
                        result = "error:invalid_config";
                    }
                } else {
                    result = "error:invalid_json";
                }

            } else if (command == "version") {
                // Return version info
                result = std::string(EXTENSION_NAME) + " v" + EXTENSION_VERSION;

            } else {
                result = "error:unknown_command";
            }

        } catch (const std::exception& e) {
            result = std::string("error:exception:") + e.what();
        }

        // Copy result to output buffer (Arma 3 max: 10240 bytes)
        strncpy(output, result.c_str(), outputSize - 1);
        output[outputSize - 1] = '\0';

        return 0; // Success
    }

    /**
     * RVExtension (Legacy)
     * Older single-argument interface (pre-v1.68)
     * Kept for backwards compatibility
     */
    EXPORT void CALLCONV RVExtension(char* output, int outputSize, const char* function) {
        const char* msg = "use_callExtension_with_args";
        strncpy(output, msg, outputSize - 1);
        output[outputSize - 1] = '\0';
    }
}

// Cleanup on DLL unload
#ifdef _WIN32
#include <windows.h>
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
        case DLL_PROCESS_ATTACH:
            // Extension loaded
            break;
        case DLL_PROCESS_DETACH:
            // Extension unloaded - cleanup
            if (bridgeClient != nullptr) {
                delete bridgeClient;
                bridgeClient = nullptr;
            }
            break;
        case DLL_THREAD_ATTACH:
        case DLL_THREAD_DETACH:
            break;
    }
    return TRUE;
}
#else
// Linux cleanup using GCC attribute
void __attribute__((constructor)) extension_init() {
    // Extension loaded (optional initialization)
}

void __attribute__((destructor)) extension_cleanup() {
    // Extension unloaded - cleanup
    if (bridgeClient != nullptr) {
        delete bridgeClient;
        bridgeClient = nullptr;
    }
}
#endif
