# fix_firewall.ps1
# Run this script as Administrator to allow mobile connections

Write-Host "Configuring Windows Firewall for Port 5000..." -ForegroundColor Cyan

try {
    # 1. Allow Port 5000 TCP
    New-NetFirewallRule -DisplayName "ReactNodeApp Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -ErrorAction Stop
    Write-Host "[OK] Port 5000 allowed." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to add port rule. Are you running as Administrator?" -ForegroundColor Red
}

try {
    # 2. Allow Node.js executable (Dynamic path)
    $nodePath = (Get-Command node).Source
    if ($nodePath) {
        New-NetFirewallRule -DisplayName "Allow Node.js" -Direction Inbound -Program $nodePath -Action Allow -ErrorAction SilentlyContinue
        Write-Host "[OK] Node.js executable allowed." -ForegroundColor Green
    }
} catch {
    # Ignore if already exists
}

Write-Host "`nNetwork Profiles:" -ForegroundColor Yellow
Get-NetConnectionProfile

Write-Host "`nDONE. Please try scanning the QR code again." -ForegroundColor Cyan
Read-Host -Prompt "Press Enter to exit"
