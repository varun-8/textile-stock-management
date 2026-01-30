# System Architecture Report - Sri Lakshmi Textiles

## 1. Project Overview
**Goal:** To eliminate stock tracking errors and theft in the textile factory by implementing a "Barcode DNA" system where every cloth roll is uniquely tracked from manufacturing to dispatch.

**Target Users:**
*   **Admin/Office (Desktop):** Generates barcodes, monitors stock levels, manages backups, and investigates discrepancies.
*   **Factory Worker (Mobile):** Scans barcodes using a mobile phone to "Inward" (Stock In) or "Dispatch" (Stock Out) rolls.

**Why this Architecture?**
A **Local-First, Hybrid Architecture** was chosen:
1.  **Speed**: LAN communication (<10ms) is essential for rapid scanning workflows in a factory with spotty internet.
2.  **Cost**: Uses existing Android phones and Windows PCs; no expensive proprietary handheld scanners.
3.  **Simplicity**: A single Node.js server manages everything. No complex cloud microservices.

---

## 2. System Architecture (End-to-End)

```mermaid
graph TD
    subgraph Factory Floor
        Mobile[Mobile Scanner (Android)] -->|Socket.io + HTTP| LAN(Local Network Router)
    end

    subgraph Office
        Desktop[Desktop Admin (Electron)] -->|Socket.io + HTTP| LAN
    end

    subgraph Server Room
        LAN --> Server[Node.js Backend]
        Server --> DB[(MongoDB Database)]
    end
```

**Roles:**
*   **Backend Server:** The "Brain". It runs on a dedicated PC (or background process). It holds the Truth (Database) and decides if a scan is valid or a duplicate.
*   **Desktop Application:** The "Controller". Used to create new Barcode identities (Year/Size/Sequence) and print physical stickers. It handles the "Birth" of a roll.
*   **Mobile Scanner:** The "Sensor". It assigns physical properties (Metre/Weight) to the Barcode ID. It handles the "Life" of a roll.

**Real-Time Sync:**
*   **Socket.io** is used to push updates instantly. When a mobile user scans a roll, the Desktop Dashboard counters update immediately without refreshing.

---

## 3. Tech Stack (Exact)

### Backend
*   **Runtime:** Node.js (v20+)
*   **Framework:** Express.js (v5.0) - Chosen for simplicity and middleware support.
*   **Real-time:** Socket.io (v4.8) - chosen for event-based updates.
*   **Utilities:** `node-cron` (Backups), `fs-extra` (File ops).

### Database
*   **Database:** MongoDB (Community Edition).
*   **Rationale:** Flexible schema. A partial roll is just a document; we don't need complex JOINs. Fast writes for audit logs.
*   **ODM:** Mongoose (v8.0) - Enforces schema validation (required fields like `metre`, `weight`).

### Desktop App
*   **Core:** Electron (v28) - Wraps the web app as a native Windows executable.
*   **UI Framework:** React (v18) + Vite (Build Tool).
*   **PDF/Printing:** `jspdf` (Invoice generation), `jsbarcode` (Label generation).
*   **Communication:** `axios` (REST), `socket.io-client`.

### Mobile Scanner
*   **Framework:** React Native (via Expo SDK 50).
*   **Camera:** `expo-camera` - Provides direct access to phone hardware.
*   **Connectivity:** Direct LAN IP connection (HTTP/WS).

---

## 4. Backend Deep Dive

**Folder Structure:**
*   `/models`: Mongoose Schemas (`ClothRoll`, `Barcode`, `AuditLog`).
*   `/routes`: API Logic (`mobileRoutes.js`, `barcodeRoutes.js`).
*   `/services`: Background tasks (`backupService.js`).
*   `/backups`: Physical storage of daily JSON/BSON dumps.

**Key API Endpoints:**
*   `POST /api/barcode/generate`
    *   **Input:** `{ year: 2024, size: 40, quantity: 50 }`
    *   **Logic:** Finds last sequence for Year+Size, generates next 50, inserts into `Barcode` collection.
*   `GET /api/mobile/scan/:barcode`
    *   **Input:** `24-40-0005`
    *   **Logic:** Checks if 0005 exists. **CRITICAL:** Checks if 0004 exists. If 0004 is missing, returns `gapDetected: true`.
*   `POST /api/mobile/transaction`
    *   **Input:** `{ barcode: '...', type: 'IN', metre: 100, weight: 20 }`
    *   **Logic:** Validates data > 0. Updates `ClothRoll` status. Logs to `AuditLog`. Emits `stock_update` socket event.

**Error Handling:**
*   Global Error Middleware in `server.js` catches unhandled promise rejections.
*   Specific Sequence/Duplicate checks return `409 Conflict`.

---

## 5. Database Design

**Collection: `barcodes`** (The Passport Office)
*   Holds the *potential* existence of a roll.
*   Fields: `year`, `size`, `sequence`, `full_barcode` (Unique Index), `status`.

**Collection: `clothrolls`** (The Living Inventory)
*   Holds the *actual* stock.
*   Fields: `barcode` (PK), `status` ('IN'/'OUT'), `metre`, `weight`, `percentage`.
*   `transactionHistory`: Array of `{ status, date, details }` (Ledger style).

**Collection: `missedscans`** (The Blacklist)
*   Holds barcodes that were skipped.
*   Fields: `barcode`, `detectedAt`, `status` ('PENDING', 'RESOLVED').

**Collection: `auditlogs`** (The Security Camera)
*   Immutable log of every action.
*   Fields: `action` ('STOCK_IN', 'DELETE'), `user`, `ipAddress`, `timestamp`.
*   **TTL Index:** Auto-deletes logs older than 90 days.

---

## 6. Desktop Application (Admin Panel)

**Purpose:**
Strictly for Management. It cannot scan barcodes (unless a USB scanner is attached acting as a keyboard).

**Key Screens:**
1.  **Dashboard:** Live counters (Total, In, Out, Missing).
2.  **Generator:** Creates new barcode sequences. **Limitation:** Hardcoded limit of 65 per batch to fit A4 sticker pages.
3.  **Inventory List:** Searchable table of all stock. Allows manual edits (Audit logged).

**Printing:**
*   HTML-to-Canvas approach. It renders the barcode DOM elements and uses the browser's native Print dialog (`window.print()`) configured for Label Printers (4x6 or A4).

---

## 7. Mobile Scanner Application

**Purpose:**
Dumb terminal for data entry. No local storage logic.

**Scanning Logic:**
1.  Camera detects `Code128` barcode.
2.  App sends GET request to Server.
3.  Server responds: "New Roll", "Existing Roll", or "GAP DETECTED".
4.  **Gap Event:** If Gap Detected, App shows a full-screen RED alert. "You scanned 0005 but 0004 is missing!".
5.  **Stock In Form:** User enters Metre/Weight. Pre-filled Percentage (100%).
6.  **Stock Out:** User clicks "Dispatch". Status flips to 'OUT'.

**Offline Behavior:**
*   **None.** The app requires active Wi-Fi. If connection drops, it shows "Connection Failed" alert and prevents scanning.

---

## 8. Networking & Connectivity

**LAN Assumptions:**
*   The server IP is **Static** (or reserved via Router DHCP).
*   The Mobile App has a "Settings" screen (Gear Icon) to manually enter the Server IP (e.g., `192.168.1.50`) if it changes.
*   Port `5000` must be open on the Server's Windows Firewall.

---

## 9. Security & Theft Prevention

**Gap Detection (Theft Prevention):**
*   The system enforces sequential scanning. You cannot scan #50 without scanning #49.
*   If a worker tries to skip a roll (theft), the next scan triggers a "Gap Alert". The missing roll is immediately logged to the `MissedScan` database visible to Admin.

**Audit Trails:**
*   Every `DELETE` or `MANUAL EDIT` action is logged with IP address.
*   Admin cannot "silently" remove stock.

**Authentication:**
*   **Desktop:** Simple Admin/Password gate.
*   **Mobile:** **Open Access**. Any device on Wi-Fi with the app can scan. Security relies on physical access to the warehouse Wi-Fi.

---

## 10. Deployment & Operations

**Dependencies:**
*   Node.js (v18+)
*   MongoDB Service (must be running as a Windows Service).

**Backup Strategy:**
*   **Auto:** `node-cron` triggers every night at 23:00. Dumps DB to JSON files in `backend/backups/`.
*   **Manual:** Admin can trigger "Backup Now" from Desktop.
*   **Restore:** Admin can restore from JSON files via the Desktop UI.

**Common Failure Points:**
1.  **IP Change:** Server PC reboots and gets a new IP -> Mobile app disconnects.
2.  **Firewall:** Windows Defender blocks Port 5000.
3.  **MongoDB:** Service stops running after a power cut.

---

## 11. Known Limitations (Honest Review)

1.  **No User Accounts:** There is only one "Admin" and generic "Mobile Users". We don't know *which* specific worker scanned a roll.
2.  **No HTTPS:** All traffic is plain HTTP. Passwords send in cleartext (acceptable only for closed LAN).
3.  **No Offline Mode:** If Wi-Fi dies, work stops.
4.  **Reporting:** No complex date-range reports or Excel exports in the UI yet.

---

## 12. Upgrade & Future Roadmap

**Low Hanging Fruit:**
*   [ ] Add "User Accounts" for mobile workers (Pin Code login).
*   [ ] Add "Excel Export" button for stock reports.

**Major Refactor:**
*   **Offline Mode:** Implement `RxDB` or `SQLite` on mobile to allow scanning without Wi-Fi and sync later.
*   **Cloud Sync:** Push daily summaries to a Cloud Dashboard for remote owner viewing.

---

## 13. Architectural Review

**What is Solid:**
*   The **Gap Detection Logic** is robust and solves the core business problem (Theft/Loss).
*   The **Tech Stack** (JS everywhere) makes it very easy to maintain by a single developer.

**What to Change:**
*   hardcoding IPs is fragile. I would implement a UDP Broadcast Discovery service so the mobile app "finds" the server automatically.
*   I would add `Local Authentication` on the mobile app so we know who is scanning.
