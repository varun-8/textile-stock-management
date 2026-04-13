@echo off
echo ============================================================
echo Building Textile Stock Management Installer
echo ============================================================
echo.

cd desktop
node build-desktop-app.cjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed. Please check the output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Build Successful! 
echo The installer can be found in desktop/dist-app/
pause
