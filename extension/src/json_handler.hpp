/**
 * JSON Handler - Serialize/deserialize JSON
 */

#ifndef JSON_HANDLER_HPP
#define JSON_HANDLER_HPP

#include <string>
#include <map>

class JSONHandler {
public:
    // Parse JSON string
    static bool parseJSON(const std::string& jsonStr, std::string& error);

    // Serialize to JSON string
    static std::string toJSON(const std::string& key, const std::string& value);
    
    // Serialize map to JSON
    static std::string serialize(const std::map<std::string, std::string>& data);
    
    // Deserialize JSON to map
    static std::map<std::string, std::string> deserialize(const std::string& jsonStr);
    
    // Validate JSON string
    static bool validate(const std::string& jsonStr);
    
    // Extract specific field
    static std::string extractField(const std::string& jsonStr, const std::string& fieldName);
    
    // Check if field exists
    static bool hasField(const std::string& jsonStr, const std::string& fieldName);
};

#endif // JSON_HANDLER_HPP
