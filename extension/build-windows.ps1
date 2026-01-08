# Build script for Windows
# Run this from PowerShell as Administrator

Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LLM Game Master Extension - Windows Build" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check for CMake
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
    Write-Host "❌ CMake not found" -ForegroundColor Red
    Write-Host "Download from: https://cmake.org/download/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ CMake found: $($cmake.Version)" -ForegroundColor Green

# Check for Visual Studio
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -property installationPath
    if ($vsPath) {
        Write-Host "✓ Visual Studio found: $vsPath" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Visual Studio not detected" -ForegroundColor Yellow
    Write-Host "   Install Visual Studio 2019+ with C++ tools" -ForegroundColor Yellow
}
Write-Host ""

# Clean previous build
if (Test-Path "build") {
    Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force build
}

# Create build directory
New-Item -ItemType Directory -Force -Path build | Out-Null
Set-Location build

Write-Host "⚙️  Configuring with CMake..." -ForegroundColor Cyan
cmake .. -G "Visual Studio 16 2019" -A x64

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ CMake configuration failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔨 Building..." -ForegroundColor Cyan
cmake --build . --config Release

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
if (Test-Path "Release\llmgm_x64.dll") {
    Write-Host "✅ BUILD SUCCESSFUL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Extension location:" -ForegroundColor White
    Write-Host "  $PWD\Release\llmgm_x64.dll" -ForegroundColor Yellow
    Write-Host ""
    $size = (Get-Item "Release\llmgm_x64.dll").Length / 1KB
    Write-Host "File size: $([math]::Round($size, 2)) KB" -ForegroundColor White
    Write-Host ""
    Write-Host "Installation:" -ForegroundColor White
    Write-Host "  Copy to your Arma 3 directory (where arma3_x64.exe is located)" -ForegroundColor Yellow
} else {
    Write-Host "❌ BUILD FAILED" -ForegroundColor Red
    Write-Host "Check error messages above" -ForegroundColor Yellow
    exit 1
}
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
