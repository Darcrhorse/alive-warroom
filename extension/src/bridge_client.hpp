/**
 * Bridge Client - HTTP client for communicating with Node.js bridge
 */

#ifndef BRIDGE_CLIENT_HPP
#define BRIDGE_CLIENT_HPP

#include <string>

class BridgeClient {
public:
    BridgeClient(const std::string& serverUrl);
    ~BridgeClient();

    // Send game state to bridge
    bool sendState(const std::string& jsonData);

    // Get pending action from bridge
    std::string getAction();

    // Update configuration
    bool updateConfig(const std::string& configJson);

    // Check connection status
    bool isConnected();

private:
    std::string serverUrl;
    bool connected;

    // HTTP request helper
    std::string httpPost(const std::string& endpoint, const std::string& data);
    std::string httpGet(const std::string& endpoint);
};

#endif // BRIDGE_CLIENT_HPP
