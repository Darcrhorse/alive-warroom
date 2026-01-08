/**
 * JSON Handler Implementation - Full implementation with nlohmann/json
 */

#include "json_handler.hpp"
#include <nlohmann/json.hpp>
#include <sstream>

using json = nlohmann::json;

bool JSONHandler::parseJSON(const std::string& jsonStr, std::string& error) {
    try {
        json::parse(jsonStr);
        return true;
    } catch (const std::exception& e) {
        error = e.what();
        return false;
    }
}

std::string JSONHandler::toJSON(const std::string& key, const std::string& value) {
    try {
        json j;
        j[key] = value;
        return j.dump();
    } catch (const std::exception& e) {
        return "{\"error\":\"serialization_failed\"}";
    }
}

std::string JSONHandler::serialize(const std::map<std::string, std::string>& data) {
    try {
        json j = data;
        return j.dump();
    } catch (const std::exception& e) {
        return "{}";
    }
}

std::map<std::string, std::string> JSONHandler::deserialize(const std::string& jsonStr) {
    std::map<std::string, std::string> result;
    try {
        json j = json::parse(jsonStr);
        if (j.is_object()) {
            for (auto& [key, value] : j.items()) {
                if (value.is_string()) {
                    result[key] = value.get<std::string>();
                } else {
                    result[key] = value.dump();
                }
            }
        }
    } catch (const std::exception& e) {
        // Return empty map on error
    }
    return result;
}

bool JSONHandler::validate(const std::string& jsonStr) {
    try {
        json::parse(jsonStr);
        return true;
    } catch (...) {
        return false;
    }
}

std::string JSONHandler::extractField(const std::string& jsonStr, const std::string& fieldName) {
    try {
        json j = json::parse(jsonStr);
        if (j.contains(fieldName)) {
            if (j[fieldName].is_string()) {
                return j[fieldName].get<std::string>();
            } else {
                return j[fieldName].dump();
            }
        }
    } catch (...) {
        // Return empty on error
    }
    return "";
}

bool JSONHandler::hasField(const std::string& jsonStr, const std::string& fieldName) {
    try {
        json j = json::parse(jsonStr);
        return j.contains(fieldName);
    } catch (...) {
        return false;
    }
}
