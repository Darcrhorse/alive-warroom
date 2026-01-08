/**
 * Bridge Client Implementation
 * Full HTTP client using cpp-httplib
 */

#include "bridge_client.hpp"
#include <iostream>
#include <sstream>
#include <chrono>

// Include cpp-httplib (header-only library)
#include "httplib.h"

BridgeClient::BridgeClient(const std::string& serverUrl) 
    : serverUrl(serverUrl), connected(false) {
    
    // Parse server URL
    parseServerUrl(serverUrl);
    
    // Test initial connection
    testConnection();
}

BridgeClient::~BridgeClient() {
    // Cleanup
}

void BridgeClient::parseServerUrl(const std::string& url) {
    // Simple URL parser for http://host:port format
    std::string urlCopy = url;
    
    // Remove protocol
    size_t protocolEnd = urlCopy.find("://");
    if (protocolEnd != std::string::npos) {
        std::string protocol = urlCopy.substr(0, protocolEnd);
        isHttps = (protocol == "https");
        urlCopy = urlCopy.substr(protocolEnd + 3);
    }
    
    // Parse host and port
    size_t portStart = urlCopy.find(":");
    if (portStart != std::string::npos) {
        host = urlCopy.substr(0, portStart);
        port = std::stoi(urlCopy.substr(portStart + 1));
    } else {
        host = urlCopy;
        port = isHttps ? 443 : 80;
    }
}

void BridgeClient::testConnection() {
    try {
        std::string response = httpGet("/api/status");
        connected = !response.empty();
    } catch (...) {
        connected = false;
    }
}

bool BridgeClient::sendState(const std::string& jsonData) {
    try {
        std::string response = httpPost("/api/state", jsonData);
        return !response.empty();
    } catch (const std::exception& e) {
        std::cerr << "Error sending state: " << e.what() << std::endl;
        connected = false;
        return false;
    }
}

std::string BridgeClient::getAction() {
    try {
        std::string response = httpGet("/api/action");
        return response;
    } catch (const std::exception& e) {
        std::cerr << "Error getting action: " << e.what() << std::endl;
        return "";
    }
}

bool BridgeClient::updateConfig(const std::string& configJson) {
    try {
        std::string response = httpPost("/api/config", configJson);
        return !response.empty();
    } catch (const std::exception& e) {
        std::cerr << "Error updating config: " << e.what() << std::endl;
        return false;
    }
}

bool BridgeClient::isConnected() {
    return connected;
}

std::string BridgeClient::httpPost(const std::string& endpoint, const std::string& data) {
    try {
        httplib::Client client(host.c_str(), port);
        client.set_connection_timeout(5, 0); // 5 seconds
        client.set_read_timeout(10, 0);      // 10 seconds
        client.set_write_timeout(10, 0);     // 10 seconds
        
        auto res = client.Post(endpoint.c_str(), data, "application/json");
        
        if (res && res->status == 200) {
            connected = true;
            return res->body;
        } else {
            connected = false;
            return "";
        }
    } catch (const std::exception& e) {
        std::cerr << "HTTP POST error: " << e.what() << std::endl;
        connected = false;
        return "";
    }
}

std::string BridgeClient::httpGet(const std::string& endpoint) {
    try {
        httplib::Client client(host.c_str(), port);
        client.set_connection_timeout(5, 0); // 5 seconds
        client.set_read_timeout(10, 0);      // 10 seconds
        
        auto res = client.Get(endpoint.c_str());
        
        if (res && res->status == 200) {
            connected = true;
            return res->body;
        } else {
            connected = false;
            return "";
        }
    } catch (const std::exception& e) {
        std::cerr << "HTTP GET error: " << e.what() << std::endl;
        connected = false;
        return "";
    }
}
