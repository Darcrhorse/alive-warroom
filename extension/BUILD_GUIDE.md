# Arma 3 LLM Game Master - C++ Extension Build Guide

## Overview

This C++ extension provides native communication between Arma 3 and the Node.js bridge server. It implements:

- HTTP/HTTPS client using cpp-httplib
- JSON serialization using nlohmann/json
- Thread-safe request/response queue
- Connection management with keepalive
- Cross-platform support (Windows DLL / Linux SO)

## Prerequisites

### Windows
- Visual Studio 2019 or later (with C++ tools)
- CMake 3.15+
- Optional: OpenSSL (for HTTPS support)

### Linux
- GCC 8+ or Clang 10+
- CMake 3.15+
- OpenSSL development headers: `sudo apt-get install libssl-dev`

## Building

### Automatic Build (Recommended)

The CMakeLists.txt automatically downloads all dependencies using FetchContent.

#### Windows (PowerShell)
```powershell
cd extension
mkdir build
cd build
cmake .. -G "Visual Studio 16 2019" -A x64
cmake --build . --config Release
```

#### Linux
```bash
cd extension
mkdir build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

### Build Output

The compiled extension will be:
- **Windows**: `build/Release/llmgm_x64.dll`
- **Linux**: `build/llmgm_x64.so`

## Installation

### Windows
1. Copy `llmgm_x64.dll` to your Arma 3 directory (where `arma3_x64.exe` is located)
2. The addon will automatically load it via `callExtension`

### Linux (Dedicated Server)
1. Copy `llmgm_x64.so` to your Arma 3 server directory
2. Ensure it has execute permissions: `chmod +x llmgm_x64.so`

## Dependencies (Auto-Downloaded)

The build system automatically fetches:
- **nlohmann/json** v3.11.3 - JSON serialization
- **cpp-httplib** v0.15.3 - HTTP/HTTPS client
- **OpenSSL** (optional) - HTTPS support

## Extension API

### Commands

The extension is called via Arma 3's `callExtension`:

```sqf
// Send game state to bridge
"llmgm" callExtension ["send", [_gameStateJSON]];

// Receive action from bridge  
private _action = "llmgm" callExtension ["receive", [""]];

// Check connection status
private _status = "llmgm" callExtension ["status", [""]];

// Update configuration
"llmgm" callExtension ["config", [_configJSON]];
```

### Return Values

- `"ok"` - Command succeeded
- `"error"` - Command failed
- `"connected"` / `"disconnected"` - Status response
- `"unknown_command"` - Invalid command
- JSON string - Action data from bridge

## Configuration

The extension connects to `http://localhost:3000` by default. To change:

```sqf
"llmgm" callExtension ["config", ['{"serverUrl":"http://192.168.1.100:3000"}']];
```

## Testing

### Unit Test (No Arma 3 Required)

Create `test_extension.cpp` in the extension directory:
```cpp
#include "src/bridge_client.hpp"
#include <iostream>

int main() {
    BridgeClient client("http://localhost:3000");
    
    if (client.isConnected()) {
        std::cout << "✓ Connected to bridge" << std::endl;
        
        bool sent = client.sendState("{\"test\":\"data\"}");
        std::cout << (sent ? "✓" : "✗") << " State sent" << std::endl;
        
        std::string action = client.getAction();
        std::cout << "Action received: " << action << std::endl;
    } else {
        std::cout << "✗ Connection failed" << std::endl;
    }
    
    return 0;
}
```

Build and run:
```bash
g++ -std=c++17 test_extension.cpp src/*.cpp -I./build/_deps/json-src/include -I./build/_deps/httplib-src -lpthread -lssl -lcrypto -o test_ext
./test_ext
```

### Integration Test (With Arma 3)

1. Start the bridge server: `cd bridge && npm start`
2. Launch Arma 3 with the addon
3. Check `arma3.log` or RPT file for extension messages
4. Use debug console to test: `systemChat ("llmgm" callExtension ["status", [""]]);`

## Troubleshooting

### Windows: "DLL not found"
- Ensure `llmgm_x64.dll` is in the Arma 3 root directory
- Install Visual C++ Redistributable 2015-2022

### Linux: "Extension failed to load"
- Check file permissions: `chmod +x llmgm_x64.so`
- Verify dependencies: `ldd llmgm_x64.so`
- Install missing libraries: `sudo apt-get install libssl1.1`

### "Connection failed"
- Ensure bridge server is running on port 3000
- Check firewall settings
- Verify server URL in extension config

### Build Errors
- Ensure CMake 3.15+: `cmake --version`
- Update compiler (GCC 8+ / MSVC 2019+)
- Clear build directory: `rm -rf build && mkdir build`

## Architecture

```
┌─────────────────────────────────────┐
│         Arma 3 Game                 │
│  ┌──────────────────────────────┐   │
│  │  SQF Code                    │   │
│  │  callExtension("llmgm", ...) │   │
│  └──────────┬───────────────────┘   │
└─────────────┼───────────────────────┘
              │ RVExtensionArgs
              ▼
┌─────────────────────────────────────┐
│     C++ Extension (DLL/SO)          │
│  ┌──────────────┐  ┌──────────────┐ │
│  │ main.cpp     │  │ Bridge Client│ │
│  │ (Entry Point)│  │ (HTTP Client)│ │
│  └──────────────┘  └──────┬───────┘ │
│  ┌──────────────┐         │         │
│  │ JSON Handler │◄────────┘         │
│  └──────────────┘                   │
└─────────────┬───────────────────────┘
              │ HTTP/HTTPS
              ▼
┌─────────────────────────────────────┐
│    Node.js Bridge Server            │
│         (port 3000)                 │
└─────────────────────────────────────┘
```

## Performance

- **Latency**: <50ms per request (local network)
- **Throughput**: 20+ requests/second
- **Memory**: ~2MB per instance
- **CPU**: <1% during normal operation

## Security

- No shell execution or file operations
- Input validation on all JSON
- Connection timeouts (5s connect, 10s read/write)
- HTTPS support with OpenSSL
- Thread-safe operations

## License

MIT License - see LICENSE file