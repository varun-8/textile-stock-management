# MongoDB Compass Setup Guide

## ✅ Current Setup

Your MongoDB is running at: **mongodb://localhost:27017/**

### Available Databases on Your Local MongoDB:
- **textile-stock-management** ← Your project database (now with 246 restored records)

---

## 🎯 How to Connect in MongoDB Compass

### Method 1: Quick Connection (Recommended)
1. Open **MongoDB Compass**
2. Click **"New Connection"** or **"+"** button
3. Paste this connection string:
   ```
   mongodb://localhost:27017/textile-stock-management
   ```
4. Click **"Connect"**
5. You'll see all your collections with the restored data

### Method 2: Custom Connection
1. Open **MongoDB Compass**
2. Click **"New Connection"** → **"Advanced Connection Settings"**
3. Fill in:
   - **Hostname**: `localhost`
   - **Port**: `27017`
   - **Authentication**: (leave empty - no auth configured)
   - **Default Database**: `textile-stock-management`
4. Click **"Connect"**

---

## 📊 Viewing Your Data

Once connected, you can:
- **Browse Collections**: Click on collections like `barcodes`, `clothRolls`, `sessions`
- **View Documents**: See all 246+ records that were restored
- **Export Data**: Use Compass to export collections as JSON if needed
- **Run Queries**: Use the Query editor to filter/search data

---

## 🔄 For Multiple Projects (Future)

When you set up other projects with their own MongoDB instances:

**Example for another project** (if it has separate MongoDB):
```
mongodb://localhost:27018/project-name
```

Each would be a separate connection in Compass.

---

## 💾 Backup Reminder

Your backup file location:
```
C:\Users\Vishnunandhan\AppData\Roaming\desktop\backend-data\backups\
backup-BOOT-2026-04-30T06-15-36-578Z.json
```

The system creates automatic backups when your app runs. Check this folder for latest backups.

