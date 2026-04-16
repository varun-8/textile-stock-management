@echo off
REM Automated Setup Script for Textile Stock Management
REM Run this after cloning to set up everything automatically

echo.
echo ================================
echo Textile Stock Management Setup
echo ================================
echo.

REM Step 1: Install dependencies
echo [1/4] Installing dependencies...
cd backend
call npm install
if errorlevel 1 goto error_backend
cd..

cd desktop
call npm install
if errorlevel 1 goto error_desktop
cd ..

cd mobile-web
call npm install
if errorlevel 1 goto error_mobile
cd ..

echo ✅ Dependencies installed
echo.

REM Step 2: Build PWA
echo [2/4] Building PWA assets...
cd mobile-web
call npm run build:pwa
if errorlevel 1 goto error_pwa
cd ..
echo ✅ PWA built
echo.

REM Step 3: Copy PWA to backend
echo [3/4] Copying PWA to backend...
if not exist "backend\public\pwa" mkdir "backend\public\pwa"
xcopy "mobile-web\dist\*" "backend\public\pwa\" /E /I /Y >nul 2>&1
if errorlevel 1 goto error_copy
echo ✅ PWA copied
echo.

REM Step 4: Setup certs
echo [4/4] Checking certificates...
cd backend
call npm run postinstall
cd ..
echo ✅ Certificates ready
echo.

echo ================================
echo ✨ Setup Complete!
echo ================================
echo.
echo Next steps:
echo   1. Create .env files (use .env.example as template)
echo   2. Run: npm run electron:dev
echo.
pause
exit /b 0

:error_backend
echo ❌ Backend installation failed
exit /b 1

:error_desktop
echo ❌ Desktop installation failed
exit /b 1

:error_mobile
echo ❌ Mobile-web installation failed
exit /b 1

:error_pwa
echo ❌ PWA build failed
exit /b 1

:error_copy
echo ❌ PWA copy failed (but continuing anyway)
exit /b 0
