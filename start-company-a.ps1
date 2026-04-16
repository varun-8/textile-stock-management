# ========================================
# Company A - Textile Stock System Startup (PowerShell)
# ========================================
#
# This script starts the complete system for Company A:
# - MongoDB embedded (started by backend)
# - Backend on port 5050/5051
# - Access from mobile: https://192.168.1.X:5051
#
# Usage:
#   .\start-company-a.ps1
#
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPANY A - TEXTILE STOCK SYSTEM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "Starting Company A Backend System..." -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Workspace Code: company-a" 
Write-Host "  Database: textile-stock-company-a"
Write-Host "  HTTP Port: 5050"
Write-Host "  HTTPS Port: 5051"
Write-Host "  Mobile Access: https://192.168.1.X:5051"
Write-Host ""

# Set environment variables for Company A
$env:WORKSPACE_CODE = "company-a"
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/textile-stock-company-a"
$env:HTTP_PORT = "5050"
$env:HTTPS_PORT = "5051"
$env:NODE_ENV = "production"
$env:APP_PASSWORD = "Company-A-StockManagement@2026"
$env:JWT_SECRET = "company-a-jwt-secret-textile-2026-v1"

Write-Host "Launching backend server..." -ForegroundColor Green
npm start

pause
