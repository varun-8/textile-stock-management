# Git Deployment & Setup Guide

## What to Push to Git

### **Include (Safe to commit)**
```
✅ ALL code files
✅ package.json / package-lock.json
✅ Configuration files (.eslintrc, vite.config.js, etc.)
✅ README, documentation
✅ Model schemas
✅ Route definitions
✅ Public assets (logos, APK placeholder)
✅ Docker files (if any)
✅ .gitignore (configured)
```

### **DO NOT Include (Sensitive)**
```
❌ .env (contains passwords & secrets)
❌ node_modules/ (already in .gitignore)
❌ dist/ build folders (already in .gitignore)
❌ TLS certificates (stock-system.local-*.pem)
❌ Database files (already in .gitignore)
❌ Logs (already in .gitignore)
❌ Session data
```

---

## .env Management

### **Current Setup**
```
backend/.env (EXCLUDED from git)
└── Contains: WORKSPACE_CODE, MONGODB_URI, APP_PASSWORD, JWT_SECRET

desktop/resources/backend/.env (EXCLUDED from git)
└── Same as backend/.env for packaged app
```

### **Create .env.example (Template)**
```bash
# backend/.env.example
WORKSPACE_CODE=default
MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-management
HTTP_PORT=5050
HTTPS_PORT=5051
NODE_ENV=production
APP_PASSWORD=your-secure-password-here
JWT_SECRET=your-jwt-secret-key-here
SYSTEM_WIPE_PASSWORD=your-wipe-password-here
```

**Push this to git** ✅ (no sensitive data, just template)

---

## Setup Instructions for Your Friend's System

### **Step 1: Clone Repository**
```bash
git clone <your-repo-url>
cd textile-stock-management
```

### **Step 2: Install Dependencies**
```bash
# Backend
cd backend
npm install

# Desktop
cd ../desktop
npm install

# Mobile Web
cd ../mobile-web
npm install
```

### **Step 3: Create Local .env Files**

**backend/.env:**
```bash
WORKSPACE_CODE=default
MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-management
HTTP_PORT=5050
HTTPS_PORT=5051
NODE_ENV=production
APP_PASSWORD=Company-A-Password@2026
JWT_SECRET=company-a-jwt-secret-textile-2026-v1
SYSTEM_WIPE_PASSWORD=SystemWipe@2026
TLS_KEY_PATH=./stock-system.local-key.pem
TLS_CERT_PATH=./stock-system.local.pem
```

**desktop/resources/backend/.env:** (Copy same as above)

### **Step 4: Generate TLS Certificates**
```bash
cd backend
mkcert -key-file stock-system.local-key.pem -cert-file stock-system.local.pem localhost 127.0.0.1 stock-system.local <your-ip>
# Replace <your-ip> with friend's network IP (e.g., 192.168.1.11)
```

### **Step 5: Copy Certificates to Resources**
```bash
copy stock-system.local-*.pem ../desktop/resources/backend/
```

### **Step 6: Build Mobile PWA (One-time)**
```bash
cd mobile-web
npm run build
# This creates dist/ folder
```

### **Step 7: Copy PWA to Backend**
```bash
copy -r mobile-web/dist/* backend/public/pwa/
copy -r mobile-web/dist/* desktop/resources/backend/public/pwa/
```

### **Step 8: Start System**

**Option A: Electron (Dev)**
```bash
cd desktop
npm run electron:dev
```

**Option B: Production Backend Only**
```bash
cd backend
npm start
```

---

## Common Errors & Solutions

### **Error 1: "ENOENT: Cannot find package.json"**
```
Cause: Didn't run npm install
Fix: cd backend && npm install
     cd desktop && npm install
     cd mobile-web && npm install
```

### **Error 2: "MONGODB_URI is undefined"**
```
Cause: .env file not created
Fix: Create backend/.env using the template above
     Make sure MONGODB_URI is set
```

### **Error 3: "TLS certificate not found"**
```
Cause: Forgot to generate certificates
Fix: cd backend
     mkcert -key-file stock-system.local-key.pem -cert-file stock-system.local.pem localhost 127.0.0.1 stock-system.local 192.168.1.X
```

### **Error 4: "Port 5050 already in use"**
```
Cause: Another instance is running
Fix: netstat -ano | findstr 5050
     Get PID and kill: taskkill /PID <pid> /F
```

### **Error 5: "Cannot connect to MongoDB"**
```
Cause: MongoDB not running or URI wrong
Fix: Check if MongoDB is installed
     Verify MONGODB_URI in .env
     For local: mongodb://127.0.0.1:27017/textile-stock-management
```

### **Error 6: "PWA assets not found"**
```
Cause: PWA dist/ files not built
Fix: cd mobile-web
     npm run build
     copy dist/* ../backend/public/pwa/
```

---

## Git Push Checklist

Before pushing to git:

```bash
# 1. Check .gitignore is configured
cat .gitignore
# Should exclude: node_modules/, .env, dist/, *.pem, logs/

# 2. Verify .env is NOT staged
git status
# Should NOT show: backend/.env, desktop/resources/backend/.env

# 3. Create .env.example if missing
# (template file provided above)

# 4. Commit everything except .env
git add -A
git reset backend/.env desktop/resources/backend/.env
git commit -m "Add textile stock management system"

# 5. Push
git push origin main
```

---

## Multi-Company Setup After Git Clone

### **For Company A (Primary)**
```bash
# backend/.env
WORKSPACE_CODE=company-a
MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-company-a
HTTP_PORT=5050
HTTPS_PORT=5051
JWT_SECRET=company-a-secret-v1
```

### **For Company B (Friend's System)**
```bash
# backend/.env
WORKSPACE_CODE=company-b
MONGODB_URI=mongodb://127.0.0.1:27018/textile-stock-company-b
HTTP_PORT=5052
HTTPS_PORT=5053
JWT_SECRET=company-b-secret-v1
```

Each friend generates their own TLS certs with their IP!

---

## .gitignore Configuration

Ensure `.gitignore` has:
```
# Dependencies
node_modules/
package-lock.json

# Environment
.env
.env.local
.env.*.local

# Certificates (sensitive)
*.pem
*.key

# Build outputs
dist/
build/
*.tgz

# Logs
*.log
logs/

# System
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Database
database/
*.db
mongo_data/

# Backups
backups/
*.backup

# OS
.env.production
```

---

## First-Time Setup Automation (Optional)

Create `setup.sh` or `setup.bat` for friends:

```bash
#!/bin/bash
# setup.sh - One-command setup

echo "Setting up Textile Stock Management System..."

# Install dependencies
echo "Installing dependencies..."
cd backend && npm install && cd ..
cd desktop && npm install && cd ..
cd mobile-web && npm install && cd ..

# Generate certificates
echo "Generating TLS certificates..."
cd backend
mkcert -key-file stock-system.local-key.pem \
       -cert-file stock-system.local.pem \
       localhost 127.0.0.1 stock-system.local

# Build mobile web
echo "Building mobile web..."
cd ../mobile-web
npm run build

# Copy PWA files
echo "Copying PWA files to backend..."
cp -r dist/* ../backend/public/pwa/
cp -r dist/* ../desktop/resources/backend/public/pwa/

echo "Setup complete! Now create .env files and run:"
echo "  cd backend && npm start"
```

---

## Summary

**What to Push:**
- ✅ All code
- ✅ .env.example (template)
- ✅ package.json
- ❌ .env (never)
- ❌ *.pem certificates (never)

**What Friend Needs to Do:**
1. Clone repo
2. `npm install` in all 3 folders
3. Create `.env` files (from template)
4. Generate TLS certificates with their IP
5. Build mobile web: `npm run build`
6. Copy PWA files to backend
7. Run: `npm start` or `npm run electron:dev`

**Multi-Company Setup:**
- Each company uses different WORKSPACE_CODE
- Each uses different MongoDB port
- Each uses different HTTP/HTTPS ports
- Each generates certs with their IP
- Complete isolation ✅

Your friend should be able to follow this and have it working in 10 minutes! 🚀
