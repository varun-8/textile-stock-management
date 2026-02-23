@echo off
echo =======================================================
echo Prodexa Network Firewall Setup
echo =======================================================
echo Requesting Administrative Privileges to open Port 5000...
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrative rights are required.
    echo Please right-click this file and select "Run as Administrator".
    pause
    exit /b
)

:: Run firewall commands
echo [OK] Administrator rights verified. Adding rules...
netsh advfirewall firewall add rule name="Prodexa Server" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="Prodexa Server" dir=out action=allow protocol=TCP localport=5000

echo.
echo [SUCCESS] Firewall rules added! Your mobile device should now be able to connect!
pause
