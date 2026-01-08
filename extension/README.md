# C++ Extension Dependencies

The extension requires the following libraries:

## 1. nlohmann/json
JSON for Modern C++

```bash
git clone https://github.com/nlohmann/json.git deps/nlohmann
```

Or download from: https://github.com/nlohmann/json/releases

## 2. cpp-httplib
C++ HTTP/HTTPS library

```bash
git clone https://github.com/yhirose/cpp-httplib.git deps/cpp-httplib
```

Or download from: https://github.com/yhirose/cpp-httplib/releases

## Building

### Windows (Visual Studio)
```bash
mkdir build
cd build
cmake .. -G "Visual Studio 16 2019" -A x64
cmake --build . --config Release
```

### Linux
```bash
mkdir build
cd build
cmake ..
make
```

## Installation

Copy the compiled extension to your Arma 3 directory:
- Windows: `llmgm_x64.dll` → `Arma 3/@LLMGM/`
- Linux: `llmgm_x64.so` → `Arma 3/@LLMGM/`
