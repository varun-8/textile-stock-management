# MongoDB Bundling Script for Electron Installer
# This script downloads and bundles MongoDB portable into the installer

Write-Host "MongoDB Bundler for Textile Stock Management Installer" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

$mongoDir = Join-Path $PSScriptRoot "..\backend\resources\mongo"
$mongoExe = "$mongoDir\mongod.exe"

# Check if MongoDB is already bundled
if (Test-Path $mongoExe) {
    Write-Host "✓ MongoDB is already bundled at $mongoExe" -ForegroundColor Green
    exit 0
}

# Create directory
Write-Host "Creating MongoDB resources directory..." -ForegroundColor Yellow
$null = New-Item -ItemType Directory -Force -Path $mongoDir

# MongoDB download URL (latest stable portable version for Windows)
$mongoUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.2.2.zip"
$zipPath = "$mongoDir\mongodb.zip"

Write-Host "Downloading MongoDB from: $mongoUrl" -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan

try {
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $mongoUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to download MongoDB: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Extracting MongoDB..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -like "*/bin/*") {
            $fileName = $entry.Name
            if (-not [string]::IsNullOrWhiteSpace($fileName)) {
                $targetPath = Join-Path $mongoDir $fileName
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
            }
        }
    }
    $zip.Dispose()
    Write-Host "✓ Extraction complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to extract MongoDB: $_" -ForegroundColor Red
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    exit 1
}

# Verify mongod.exe exists
if (Test-Path $mongoExe) {
    Write-Host "✓ MongoDB successfully bundled!" -ForegroundColor Green
    Write-Host "  Location: $mongoExe" -ForegroundColor Cyan
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
} else {
    Write-Host "✗ MongoDB bundle verification failed - mongod.exe not found" -ForegroundColor Red
    exit 1
}
