# Sri Lakshmi Textiles - Deployment Guide

## 1. Backend Server (Machine A)
The backend manages the database and all API requests.

**Setup:**
1. Open terminal in `backend` folder.
2. Run `npm install` (first time only).
3. Start the server:
   ```powershell
   npm run start
   ```
   *The server is now listening on Port 5000 (accessible via LAN)*

## 2. Desktop Application (Windows)
The main control panel for Office/Admin use.

**To Run Source:**
1. Open terminal in `desktop` folder.
2. Run `npm run electron:dev`.

**To Build EXE:**
1. Ensure you are in `desktop` folder.
2. Run:
   ```powershell
   npm run dist
   ```
3. Locate the installer in the `desktop/release` folder (e.g., `Sri Lakshmi Textiles Setup 1.0.0.exe`).
4. Copy this file to any Windows machine and install.

**Troubleshooting Build:**
* If build fails with `winCodeSign` error, check your internet connection and try again.
* Ensure `dist` folder is deleted before rebuilding if errors persist.

## 3. Mobile Scanner (Android/Expo)
The barcode scanner for the factory floor.

**Option A: Native App (Best Performance)**
1. Ensure your PC and Phone are on the **SAME WiFi**.
2. Open terminal in `mobile` folder.
3. Run:
   ```powershell
   npx expo start --android
   ```
   (Press `a` to open in Android Emulator, or scan the QR code with `Expo Go` on your physical device).

*Note: The API IP is currently hardcoded to `http://10.29.168.224:5000`. If your PC IP changes, update `API_URL` in `mobile/App.js`.*

**Option B: Web Scanner (Backup)**
1. Open Chrome on your mobile.
2. Navigate to: `http://10.29.168.224:5173/mobile` (Replace IP with your PC's IP).
3. Note: This requires the Desktop Dev Server (`npm run electron:dev`) to be running on the host.

## 4. Database Backups
* **Automatic:** Occurs daily at 23:00. Saved in `backend/backups`.
* **Manual:** Use the Admin API or simply copy the `backend/backups` folder.

---
**System Status:**
* **Backend:** Ready (LAN Access Enabled)
* **Desktop:** Ready (HashRouter Configured)
* **Mobile:** Ready (Expo Project Initialized)
