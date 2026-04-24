Write-Host "MongoDB Bundler for Textile Stock Management" -ForegroundColor Green

$mongoDir = "$PSScriptRoot\resources\mongodb"
$mongoExe = "$mongoDir\mongod.exe"

if (Test-Path $mongoExe) {
    Write-Host "MongoDB already bundled!" -ForegroundColor Green
    exit 0
}

New-Item -ItemType Directory -Force -Path $mongoDir | Out-Null

$mongoUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.11.zip"
$zipPath = "$mongoDir\mongodb.zip"

Write-Host "Downloading MongoDB (this may take a few minutes)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $mongoUrl -OutFile $zipPath -UseBasicParsing

Write-Host "Extracting MongoDB..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath "$mongoDir\temp" -Force

# Copy bin folder to root
$binSource = Get-ChildItem "$mongoDir\temp\*\bin" -Directory | Select-Object -First 1
if ($binSource) {
    Copy-Item "$($binSource.FullName)\*" -Destination $mongoDir -Force -Recurse
}

# Cleanup
Remove-Item "$mongoDir\temp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

if (Test-Path $mongoExe) {
    Write-Host "MongoDB bundled successfully at $mongoExe" -ForegroundColor Green
} else {
    Write-Host "MongoDB bundling failed" -ForegroundColor Red
    exit 1
}
