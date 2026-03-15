@echo off
setlocal enableextensions enabledelayedexpansion

echo ========================================
echo Textile Stock Management Auto Build
echo ========================================

set "ROOT_DIR=%~dp0"
set "FAILED=0"

call :build_project "mobile-web" "npm run build"
if errorlevel 1 set "FAILED=1"

call :build_project "desktop" "npm run build"
if errorlevel 1 set "FAILED=1"

echo.
if "%FAILED%"=="1" (
    echo Build completed with errors.
    exit /b 1
) else (
    echo Build completed successfully.
    exit /b 0
)

:build_project
set "PROJECT=%~1"
set "BUILD_CMD=%~2"

echo.
echo ----------------------------------------
echo Building %PROJECT%
echo ----------------------------------------

pushd "%ROOT_DIR%%PROJECT%"
if errorlevel 1 (
    echo ERROR: Could not enter folder %PROJECT%
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies for %PROJECT%...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed in %PROJECT%
        popd
        exit /b 1
    )
)

echo Running build for %PROJECT%...
call %BUILD_CMD%
if errorlevel 1 (
    echo ERROR: Build failed in %PROJECT%
    popd
    exit /b 1
)

popd
echo %PROJECT% build passed.
exit /b 0
