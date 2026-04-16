@echo off
REM ========================================
REM Company B - Textile Stock System Startup
REM ========================================
REM
REM This script starts the complete system for Company B:
REM - MongoDB on port 27018 (different from Company A)
REM - Backend on port 5052/5053 (different from Company A)
REM - No frontend (use IP: 192.168.1.X:5052 on mobile)
REM
REM Prerequisites:
REM - MongoDB installed or mongod in PATH
REM - Node.js installed
REM - Run as Administrator (for port binding)
REM - Company A should NOT be running (uses different port)
REM
REM ========================================

echo.
echo ========================================
echo COMPANY B - TEXTILE STOCK SYSTEM
echo ========================================
echo.

cd /d "%~dp0backend"

echo Starting Company B Backend System...
echo.
echo Workspace Code: company-b
echo Database: textile-stock-company-b
echo HTTP Port: 5052
echo HTTPS Port: 5053
echo.

REM Set environment variables for Company B
setlocal enabledelayedexpansion
set WORKSPACE_CODE=company-b
set MONGODB_URI=mongodb://127.0.0.1:27018/textile-stock-company-b
set HTTP_PORT=5052
set HTTPS_PORT=5053
set NODE_ENV=production
set APP_PASSWORD=Company-B-StockManagement@2026
set JWT_SECRET=company-b-jwt-secret-textile-2026-v1

echo.
echo Environment Configuration:
echo - WORKSPACE_CODE: %WORKSPACE_CODE%
echo - MongoDB: %MONGODB_URI%
echo - HTTP: localhost:%HTTP_PORT%
echo - HTTPS: localhost:%HTTP_PORT+1%
echo.

echo Launching backend server...
npm start

endlocal
pause
