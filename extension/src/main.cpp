/**
 * Arma 3 LLM Game Master Extension
 * Main entry point for DLL/SO
 */

#include <string>
#include <queue>
#include <mutex>
#include "bridge_client.hpp"
#include "json_handler.hpp"

// Extension version
#define EXTENSION_VERSION "0.1.0"

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

// Extension entry point
#ifdef _WIN32
#define EXPORT __declspec(dllexport)
#else
#define EXPORT
#endif

extern "C" {
    /**
     * RVExtensionVersion
     * Returns extension version
     */
    EXPORT void RVExtensionVersion(char* output, int outputSize) {
        strncpy(output, EXTENSION_VERSION, outputSize - 1);
        output[outputSize - 1] = '\0';
    }

    /**
     * RVExtensionArgs
     * Main extension function - handles all commands
     * 
     * Commands:
     *   - ["send", jsonData] - Send game state to bridge
     *   - ["receive", ""] - Get pending action from bridge
     *   - ["status", ""] - Get connection status
     *   - ["config", jsonConfig] - Update configuration
     */
    EXPORT int RVExtensionArgs(char* output, int outputSize, const char* function, const char** args, int argsCnt) {
        std::string result;

        try {
            // Initialize bridge if needed
            if (bridgeClient == nullptr) {
                initializeBridge("http://localhost:3000");
            }

            std::string functionName(function);

            if (functionName == "send" && argsCnt > 0) {
                // Send game state to bridge
                std::string jsonData(args[0]);
                bool success = bridgeClient->sendState(jsonData);
                result = success ? "ok" : "error";

            } else if (functionName == "receive") {
                // Get pending action from bridge
                std::lock_guard<std::mutex> lock(queueMutex);
                if (!responseQueue.empty()) {
                    result = responseQueue.front();
                    responseQueue.pop();
                } else {
                    // Check for new actions
                    std::string action = bridgeClient->getAction();
                    if (!action.empty()) {
                        result = action;
                    } else {
                        result = "";
                    }
                }

            } else if (functionName == "status") {
                // Get connection status
                bool connected = bridgeClient->isConnected();
                result = connected ? "connected" : "disconnected";

            } else if (functionName == "config" && argsCnt > 0) {
                // Update configuration
                std::string configJson(args[0]);
                bool success = bridgeClient->updateConfig(configJson);
                result = success ? "ok" : "error";

            } else {
                result = "unknown_command";
            }

        } catch (const std::exception& e) {
            result = std::string("error: ") + e.what();
        }

        // Copy result to output buffer
        strncpy(output, result.c_str(), outputSize - 1);
        output[outputSize - 1] = '\0';

        return 0; // Success
    }

    /**
     * RVExtension
     * Legacy extension function (not used)
     */
    EXPORT void RVExtension(char* output, int outputSize, const char* function) {
        strncpy(output, "use_RVExtensionArgs", outputSize - 1);
        output[outputSize - 1] = '\0';
    }
}

// Cleanup on DLL unload
#ifdef _WIN32
BOOL APIENTRY DllMain(HMODULE hModule, DWORD  ul_reason_for_call, LPVOID lpReserved) {
    if (ul_reason_for_call == DLL_PROCESS_DETACH) {
        if (bridgeClient != nullptr) {
            delete bridgeClient;
            bridgeClient = nullptr;
        }
    }
    return TRUE;
}
#else
void __attribute__((destructor)) cleanup() {
    if (bridgeClient != nullptr) {
        delete bridgeClient;
        bridgeClient = nullptr;
    }
}
#endif
