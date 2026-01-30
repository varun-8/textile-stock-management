@echo off
echo Attempting to open Port 5000 in Windows Firewall...
echo.

:: Check for permissions
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Success: Administrative permissions confirmed.
) else (
    echo Failure: Current permissions inadequate.
    echo Please Right-Click this file and select "Run as Administrator".
    pause
    exit
)

echo Adding Firewall Rule...
netsh advfirewall firewall delete rule name="ReactNodeApp Port 5000" >nul
netsh advfirewall firewall add rule name="ReactNodeApp Port 5000" dir=in action=allow protocol=TCP localport=5000 profile=any
echo.
echo Rule added!
echo.
echo Checking IP Address...
ipconfig | findstr "IPv4"
echo.
echo DONE. You can now scan the QR code.
pause
