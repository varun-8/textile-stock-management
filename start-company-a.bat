@echo off
REM ========================================
REM Company A - Textile Stock System Startup
REM ========================================
REM
REM This script starts the complete system for Company A:
REM - MongoDB on port 27017
REM - Backend on port 5050/5051
REM - No frontend (use IP: 192.168.1.X:5050 on mobile)
REM
REM Prerequisites:
REM - MongoDB installed or mongod in PATH
REM - Node.js installed
REM - Run as Administrator (for port binding)
REM
REM ========================================

echo.
echo ========================================
echo COMPANY A - TEXTILE STOCK SYSTEM
echo ========================================
echo.

cd /d "%~dp0backend"

echo Starting Company A Backend System...
echo.
echo Workspace Code: company-a
echo Database: textile-stock-company-a
echo HTTP Port: 5050
echo HTTPS Port: 5051
echo.

REM Set environment variables for Company A
setlocal enabledelayedexpansion
set WORKSPACE_CODE=company-a
set MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-company-a
set HTTP_PORT=5050
set HTTPS_PORT=5051
set NODE_ENV=production
set APP_PASSWORD=Company-A-StockManagement@2026
set JWT_SECRET=company-a-jwt-secret-textile-2026-v1

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
