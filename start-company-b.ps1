# ========================================
# Company B - Textile Stock System Startup (PowerShell)
# ========================================
#
# This script starts the complete system for Company B:
# - MongoDB embedded (started by backend)
# - Backend on port 5052/5053 (different from Company A)
# - Access from mobile: https://192.168.1.X:5052
#
# Usage:
#   .\start-company-b.ps1
#
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPANY B - TEXTILE STOCK SYSTEM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "Starting Company B Backend System..." -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Workspace Code: company-b" 
Write-Host "  Database: textile-stock-company-b"
Write-Host "  HTTP Port: 5052"
Write-Host "  HTTPS Port: 5053"
Write-Host "  Mobile Access: https://192.168.1.X:5052"
Write-Host ""

# Set environment variables for Company B
$env:WORKSPACE_CODE = "company-b"
$env:MONGODB_URI = "mongodb://127.0.0.1:27018/textile-stock-company-b"
$env:HTTP_PORT = "5052"
$env:HTTPS_PORT = "5053"
$env:NODE_ENV = "production"
$env:APP_PASSWORD = "Company-B-StockManagement@2026"
$env:JWT_SECRET = "company-b-jwt-secret-textile-2026-v1"

Write-Host "Launching backend server..." -ForegroundColor Green
npm start

pause
