# Multi-Company Startup Guide

## Quick Start (Choose One)

### **Option A: GUI Batch Files (Easiest)**
Double-click either:
- `start-company-a.bat` → Company A starts on port 5050
- `start-company-b.bat` → Company B starts on port 5052

### **Option B: PowerShell Scripts (Recommended)**
```powershell
# Admin terminal (Run as Administrator)
.\start-company-a.ps1   # Company A
# Or in different terminal
.\start-company-b.ps1   # Company B
```

### **Option C: Manual Setup**
```bash
cd backend

# Company A
set WORKSPACE_CODE=company-a
set MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-company-a
set HTTP_PORT=5050
npm start

# Company B (different terminal)
set WORKSPACE_CODE=company-b
set MONGODB_URI=mongodb://127.0.0.1:27018/textile-stock-company-b
set HTTP_PORT=5052
npm start
```

---

## Warehouse Setup

### **Computer 1 (Company A)**
```
Physical Location: Warehouse Section A
System Name: stock-system-a
IP Address: 192.168.1.10
Port: 5050 (HTTP)
Port: 5051 (HTTPS)

Run: start-company-a.bat
Access: https://192.168.1.10:5051
```

### **Computer 2 (Company B)**
```
Physical Location: Warehouse Section B
System Name: stock-system-b
IP Address: 192.168.1.11
Port: 5052 (HTTP)
Port: 5053 (HTTPS)

Run: start-company-b.bat
Access: https://192.168.1.11:5053
```

---

## Mobile App Connection

### **Company A Devices**
1. Open app on mobile
2. Tap "ENTER IP MANUALLY"
3. Enter: `192.168.1.10:5051`
4. Scan QR code from Company A admin panel
5. ✅ Paired with Company A system

### **Company B Devices**
1. Open app on mobile
2. Tap "ENTER IP MANUALLY"
3. Enter: `192.168.1.11:5053`
4. Scan QR code from Company B admin panel
5. ✅ Paired with Company B system

---

## Data Isolation Verification

### **Test 1: Scanner Pairing Isolation**
```
Company A Scanner tries pairing with Company B's QR code
Result: ❌ "Invalid or Expired Link" error
Expected: Scanner can only pair with correct company
```

### **Test 2: User Access Isolation**
```
Company A admin login to http://192.168.1.10:5050
Views: Only Company A scanners and stock
Cannot see: Company B's data

Company B admin login to http://192.168.1.11:5050
Views: Only Company B scanners and stock
Cannot see: Company A's data

Expected: Complete separation ✅
```

### **Test 3: Database Isolation**
```
MongoDB Instance 1: textile-stock-company-a
  └── Contains only company-a data

MongoDB Instance 2: textile-stock-company-b
  └── Contains only company-b data

Expected: Separate databases ✅
```

---

## Port Reference

| Service | Company A | Company B |
|---------|-----------|-----------|
| HTTP Backend | 5050 | 5052 |
| HTTPS Backend | 5051 | 5053 |
| MongoDB | 27017 | 27018 |
| Frontend (if needed) | 5173-A | 5173-B |

---

## Troubleshooting

### **Issue: "Port already in use"**
```powershell
# Company A ports 5050/5051 already running
# Solution: Use different ports for new instance

# Check what's using the port
Get-NetTCPConnection -LocalPort 5050 | Select-Object OwningProcess
```

### **Issue: "MongoDB connection failed"**
```powershell
# Verify MongoDB is accepting connections
Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
Test-NetConnection -ComputerName 127.0.0.1 -Port 27018
```

### **Issue: "Scanner can't find server"**
1. Verify mobile is on same WiFi network
2. Check firewall allows ports 5050-5053
3. Ping from mobile: `ping 192.168.1.10` (should work)
4. Try hostname: `https://stock-system.local:5051`

### **Issue: "Different company data visible"**
```
This should NEVER happen. If it does:
1. Stop all servers
2. Clear browser cache
3. Verify WORKSPACE_CODE environment variable set correctly
4. Restart servers
5. If persists, contact support - data leak detected!
```

---

## Production Checklist

- [ ] Company A configured with unique JWT_SECRET
- [ ] Company B configured with unique JWT_SECRET
- [ ] Each company has separate database
- [ ] Each company accesses different IP/port
- [ ] Scanner pairing tested (cross-company rejection)
- [ ] Mobile app connects only to assigned system
- [ ] User isolation verified (can't see other company)
- [ ] Firewall allows 5050-5053 ports
- [ ] HTTPS certificates valid for both IPs
- [ ] Backup strategy for both databases

---

## Adding More Companies

To add Company C, D, etc:

1. Copy startup script template:
```powershell
# start-company-c.ps1
$env:WORKSPACE_CODE = "company-c"
$env:HTTP_PORT = "5054"
$env:HTTPS_PORT = "5055"
$env:MONGODB_URI = "mongodb://127.0.0.1:27019/textile-stock-company-c"
npm start
```

2. Assign to new computer (IP 192.168.1.12)

3. QR codes generated automatically by each system

4. Deploy to warehouse

---

## Cloud Migration (When Ready)

**No code changes needed!** Just:

1. Deploy to AWS/GCP/Azure
2. Each company gets unique JWT secret
3. Backend extracts `WORKSPACE_CODE` from token
4. All data automatically isolated
5. MongoDB moved to Atlas

See `CLOUD_READY_GUIDE.md` for details.

---

## Support

**Questions?** Check:
- `CLOUD_READY_GUIDE.md` - Full architecture & cloud migration
- `.env` files - Environment variable reference
- `backend/routes/authRoutes.js` - Workspace validation code
- `backend/models/*.js` - Data isolation fields

All scripts ready to deploy! ✅
