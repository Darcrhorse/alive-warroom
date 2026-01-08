#!/bin/bash
# Build script for Linux

set -e

echo "════════════════════════════════════════════"
echo "  LLM Game Master Extension - Linux Build"
echo "════════════════════════════════════════════"
echo ""

# Check dependencies
command -v cmake >/dev/null 2>&1 || { echo "❌ CMake not found. Install with: sudo apt-get install cmake"; exit 1; }
command -v g++ >/dev/null 2>&1 || { echo "❌ G++ not found. Install with: sudo apt-get install build-essential"; exit 1; }

echo "✓ CMake found: $(cmake --version | head -n1)"
echo "✓ G++ found: $(g++ --version | head -n1)"
echo ""

# Check for OpenSSL
if pkg-config --exists openssl; then
    echo "✓ OpenSSL found: $(pkg-config --modversion openssl) (HTTPS enabled)"
else
    echo "⚠️  OpenSSL not found. HTTPS will be disabled."
    echo "   Install with: sudo apt-get install libssl-dev"
fi
echo ""

# Clean previous build
if [ -d "build" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf build
fi

# Create build directory
mkdir -p build
cd build

echo "⚙️  Configuring with CMake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

echo ""
echo "🔨 Building..."
make -j$(nproc)

echo ""
echo "════════════════════════════════════════════"
if [ -f "llmgm_x64.so" ]; then
    echo "✅ BUILD SUCCESSFUL"
    echo ""
    echo "Extension location:"
    echo "  $(pwd)/llmgm_x64.so"
    echo ""
    echo "File size: $(du -h llmgm_x64.so | cut -f1)"
    echo ""
    echo "Installation:"
    echo "  Copy to your Arma 3 server directory"
    echo "  chmod +x llmgm_x64.so"
else
    echo "❌ BUILD FAILED"
    echo "Check error messages above"
    exit 1
fi
echo "════════════════════════════════════════════"
