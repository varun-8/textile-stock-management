# Quick Setup Instructions for Friend

After cloning the repository, follow these steps:

## Step 1: Install Dependencies (3 folders)

```bash
# Terminal 1
cd backend
npm install

# Terminal 2
cd desktop
npm install

# Terminal 3
cd mobile-web
npm install
```

## Step 2: Build PWA (Important!)

The PWA files need to be built and copied to backend. Run this:

```bash
cd mobile-web
npm run build:pwa
```

Then manually copy the `dist` folder to `backend/public/pwa`:

**Windows:**
```powershell
xcopy mobile-web\dist backend\public\pwa /E /I /Y
```

**Mac/Linux:**
```bash
cp -r mobile-web/dist backend/public/pwa
```

Or manually:
1. Find `mobile-web/dist` folder
2. Copy all contents
3. Paste into `backend/public/pwa`

## Step 3: Create .env Files

Create these files from `.env.example` templates:

- `backend/.env` (copy from `backend/.env.example`)
- `desktop/resources/backend/.env` (same as backend/.env)

Keep default values if not sure.

## Step 4: Run the System

```bash
cd desktop
npm run electron:dev
```

This will start:
- ✅ Vite dev server (5173)
- ✅ Backend (5050/5051)  
- ✅ MongoDB (27017)
- ✅ Electron desktop app

---

## ⚠️ If PWA/index.html Not Found Error

**This means PWA wasn't built yet. Do Step 2 again!**

```bash
cd mobile-web
npm run build:pwa

# Then copy dist to backend/public/pwa
xcopy mobile-web\dist backend\public\pwa /E /I /Y
```

Then try `npm run electron:dev` again.

---

## 🆘 Common Issues

| Error | Solution |
|-------|----------|
| `pwa/index.html not found` | Run `npm run build:pwa` in mobile-web |
| `Cannot find module` | Run `npm install` in that folder |
| `Port already in use` | Kill process on port (5050/5051/5173) |
| `cert files not found` | Run `npm install` in backend again |

---

Enjoy! 🎉
