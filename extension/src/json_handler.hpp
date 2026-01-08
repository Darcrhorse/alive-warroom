/**
 * JSON Handler - Serialize/deserialize JSON
 */

#ifndef JSON_HANDLER_HPP
#define JSON_HANDLER_HPP

#include <string>

// TODO: Include nlohmann/json
// #include <nlohmann/json.hpp>

class JSONHandler {
public:
    // Parse JSON string
    static bool parseJSON(const std::string& jsonStr, std::string& error);

    // Serialize to JSON string
    static std::string toJSON(const std::string& key, const std::string& value);
};

#endif // JSON_HANDLER_HPP
