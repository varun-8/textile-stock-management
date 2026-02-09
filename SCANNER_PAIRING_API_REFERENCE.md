# Scanner Pairing API Schema

## Complete API Reference

### 1. Pair Scanner Device
**Endpoint:** `POST /api/auth/pair`

**Purpose:** Register a new device or repair an existing device pairing

**Request Body:**
```json
{
  "token": "string (required)",
  "name": "string (optional)",
  "scannerId": "string (optional, for re-pairing)"
}
```

**Token Values:**
- `FACTORY_SETUP_2026` - Factory setup token for new devices
- `<FINGERPRINT>` - Immutable device fingerprint for repairs
- `<UUID>` - Old format (legacy support)

**Request Examples:**

*New Device Pairing:*
```json
{
  "token": "FACTORY_SETUP_2026",
  "name": "AUTO_ASSIGN"
}
```

*Repair Existing Device:*
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "scannerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "AUTO_ASSIGN"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "scannerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fingerprint": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Scanner 1",
  "message": "Paired as Scanner 1",
  "repairQR": {
    "description": "Use this QR to repair/reconnect this scanner in future",
    "token": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Response (409 - Duplicate Device):**
```json
{
  "error": "DEVICE_ALREADY_PAIRED",
  "code": "DUPLICATE_DEVICE",
  "message": "This device is already paired as \"Scanner 1\". Use the repair link to reconnect.",
  "existingId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "existingName": "Scanner 1",
  "fingerprint": "550e8400-e29b-41d4-a716-446655440000",
  "suggestion": "Scan the repair QR code for this scanner from the desktop admin panel"
}
```

**Error Response (401 - Invalid Token):**
```json
{
  "error": "Invalid or Expired Link",
  "message": "This link is no longer valid. Please use the repair QR code or pair as a new device."
}
```

**Error Response (404 - Scanner Deleted):**
```json
{
  "error": "INVALID_LINK",
  "code": "SCANNER_DELETED",
  "message": "This scanner was deleted from the system. Please pair as a new device."
}
```

---

### 2. Check Device Already Paired
**Endpoint:** `POST /api/auth/check-device` (NEW)

**Purpose:** Pre-pairing validation to detect if device is already paired

**Request Body:**
```json
{
  "ip": "string (required)",
  "fingerprint": "string (optional)"
}
```

**Request Examples:**

*With Fingerprint:*
```json
{
  "ip": "192.168.1.100",
  "fingerprint": "550e8400-e29b-41d4-a716-446655440000"
}
```

*With IP Only:*
```json
{
  "ip": "192.168.1.100"
}
```

**Response - Not Paired (200):**
```json
{
  "alreadyPaired": false
}
```

**Response - Already Paired (200):**
```json
{
  "alreadyPaired": true,
  "type": "fingerprint",
  "name": "Scanner 1",
  "scannerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "message": "This device is already paired as \"Scanner 1\""
}
```

**Response - Device on Same Network (200):**
```json
{
  "alreadyPaired": true,
  "type": "ip",
  "name": "Scanner 2",
  "scannerId": "2fb85f64-5717-4562-b3fc-2c963f66afa7",
  "fingerprint": "660e8400-e29b-41d4-a716-446655440001",
  "message": "A device from this network is already paired as \"Scanner 2\". Use repair link if this is the same device."
}
```

---

### 3. Verify Scanner Active
**Endpoint:** `GET /api/auth/check-scanner/:id`

**Purpose:** Verify if a paired scanner is still active (heartbeat check)

**Path Parameters:**
- `id` - Scanner UUID (scannerId)

**Success Response (200):**
```json
{
  "valid": true,
  "fingerprint": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Scanner 1"
}
```

**Error Response (404):**
```json
{
  "valid": false
}
```

**Error Response (403 - Disabled):**
```json
{
  "valid": false,
  "error": "Scanner Disabled by Admin"
}
```

---

### 4. List All Scanners
**Endpoint:** `GET /api/admin/scanners`

**Purpose:** Get list of all paired scanners with status

**Query Parameters:** None

**Success Response (200):**
```json
[
  {
    "scannerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "fingerprint": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Scanner 1",
    "status": "ONLINE",
    "pairedAt": "2026-02-09T10:30:00.000Z",
    "lastSeen": "2026-02-09T10:45:32.123Z",
    "repairCount": 0
  },
  {
    "scannerId": "2fb85f64-5717-4562-b3fc-2c963f66afa7",
    "fingerprint": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Scanner 2",
    "status": "OFFLINE",
    "pairedAt": "2026-02-08T14:20:00.000Z",
    "lastSeen": "2026-02-08T15:10:00.000Z",
    "repairCount": 2
  }
]
```

---

### 5. Delete Scanner
**Endpoint:** `DELETE /api/admin/scanners/:scannerId`

**Purpose:** Remove a scanner from the system

**Path Parameters:**
- `scannerId` - Scanner UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Scanner removed"
}
```

**Error Response (404):**
```json
{
  "error": "Scanner not found"
}
```

---

## QR Code URL Formats

### New Device Pairing QR
```
https://192.168.1.100:5000/pwa/index.html?token=FACTORY_SETUP_2026&server=https%3A%2F%2F192.168.1.100%3A5000
```

**Query Parameters:**
- `token` = FACTORY_SETUP_2026 (factory setup token)
- `server` = URL encoded server address
- `repair` = not set (indicates new pairing)

### Repair/Re-Pair QR
```
https://192.168.1.100:5000/pwa/index.html?token=550e8400-e29b-41d4-a716-446655440000&server=https%3A%2F%2F192.168.1.100%3A5000&scannerId=3fa85f64-5717-4562-b3fc-2c963f66afa6&fingerprint=550e8400-e29b-41d4-a716-446655440000&name=Scanner%201&repair=true
```

**Query Parameters:**
- `token` = FINGERPRINT (immutable device token)
- `server` = URL encoded server address
- `scannerId` = Existing scanner UUID
- `fingerprint` = Same as token (for redundancy)
- `name` = Scanner name for display
- `repair` = true (indicates repair mode)

---

## Data Model

### Scanner Schema
```javascript
{
  _id: ObjectId,
  
  // Session Identity (changes on re-pair)
  uuid: String (unique, required),
  
  // Device Identity (immutable)
  fingerprint: String (unique, required, default: UUID),
  
  // Display
  name: String (default: "New Scanner"),
  
  // Status
  status: String enum ["ACTIVE", "DISABLED"] (default: "ACTIVE"),
  
  // Metadata
  pairedAt: Date (default: now),
  repairCount: Number (default: 0),
  lastSeen: Date,
  lastIp: String,
  
  // Device Info
  deviceInfo: {
    userAgent: String,
    macAddress: String (future use)
  }
}
```

---

## localStorage Keys (Mobile App)

```javascript
SL_SCANNER_ID         // UUID of current scanner session
SL_SCANNER_NAME       // Assigned name for display
SL_SERVER_IP          // Server IP address
SL_FINGERPRINT        // Immutable device fingerprint (NEW)
SL_USER_TOKEN         // User authentication token
SL_USER               // User object (JSON)
```

---

## Error Codes Reference

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| DEVICE_ALREADY_PAIRED | 409 | Device already paired from same IP | Use repair link or clear data |
| DUPLICATE_DEVICE | 409 | Same device already in system | Use repair QR code |
| INVALID_LINK | 401 | Token invalid or expired | Scan new pairing QR |
| SCANNER_DELETED | 404 | Scanner was deleted | Pair as new device |
| Unauthorized | 401 | Invalid token format | Verify QR code |

---

## Flow Diagrams

### New Device Pairing Flow
```
┌─────────┐        ┌──────────┐        ┌──────────┐
│ Desktop │        │  Mobile  │        │ Backend  │
└────┬────┘        └────┬─────┘        └────┬─────┘
     │                   │                   │
     │ Pair New Device   │                   │
     │ (click button)    │                   │
     │───────────────────→ QR Generated      │
     │                   │                   │
     │                   │ Scan QR           │
     │                   │ (new device)      │
     │                   ├──→ Check Device ──→ POST /check-device
     │                   │                   │ Response: NOT paired
     │                   │                   │
     │                   ├──→ Pair ──────────→ POST /auth/pair
     │                   │                   │ Generate: uuid + fingerprint
     │                   │                   │ Save to DB
     │                   │                   │
     │                   │←─── Response ─────┤
     │                   │ {success, uuid,   │
     │                   │  fingerprint}     │
     │                   │                   │
     │                   │ Save to Storage   │
     │                   │ (SL_SCANNER_ID)   │
     │                   │ (SL_FINGERPRINT)  │
     │                   │                   │
     │←────────────────────── Success ───────┤
```

### Already-Paired Detection Flow
```
┌─────────┐        ┌──────────┐        ┌──────────┐
│ Desktop │        │  Mobile  │        │ Backend  │
└────┬────┘        └────┬─────┘        └────┬─────┘
     │                   │                   │
     │                   │ Scan NEW QR       │
     │                   │ (same device)     │
     │                   │                   │
     │                   ├──→ Check Device ──→ POST /check-device
     │                   │    (ip, finger)   │ Check DB:
     │                   │                   │ - fingerprint exists?
     │                   │                   │ - ip matches?
     │                   │                   │
     │                   │←─── Response ─────┤
     │                   │ {alreadyPaired:   │
     │                   │  true, name}      │
     │                   │                   │
     │                   │ Show Error:       │
     │                   │ "Already paired   │
     │                   │  as Scanner A"    │
     │                   │                   │
     │                   │ Guide User:       │
     │                   │ - Use repair link │
     │                   │ - Clear data      │
```

### Repair Device Flow
```
┌─────────┐        ┌──────────┐        ┌──────────┐
│ Desktop │        │  Mobile  │        │ Backend  │
└────┬────┘        └────┬─────┘        └────┬─────┘
     │                   │                   │
     │ RE-PAIR button    │                   │
     │ (on Scanner A)    │                   │
     │───────────────────→ Repair QR Gen    │
     │                   │ (token=fingerprint
     │                   │                   │
     │                   │ Scan Repair QR    │
     │                   │ (same device)     │
     │                   │                   │
     │                   ├──→ Pair ──────────→ POST /auth/pair
     │                   │ {token:finger,    │ Validate:
     │                   │  scannerId:uuid}  │ - fingerprint exists?
     │                   │                   │ - restore identity
     │                   │                   │ - increment repairCount
     │                   │                   │
     │                   │←─── Response ─────┤
     │                   │ {success, same    │
     │                   │  scannerId}       │
     │                   │                   │
     │                   │ Update Storage    │
     │                   │ (confirm uuid)    │
     │                   │                   │
     │←────────────────────── Success ───────┤
```

---

## Testing Commands

### Test New Device Pairing
```bash
curl -X POST http://localhost:5000/api/auth/pair \
  -H "Content-Type: application/json" \
  -d '{"token":"FACTORY_SETUP_2026","name":"Test Scanner"}'
```

### Test Duplicate Detection
```bash
curl -X POST http://localhost:5000/api/auth/check-device \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.1.100"}'
```

### Test Scanner Verification
```bash
curl -X GET "http://localhost:5000/api/auth/check-scanner/3fa85f64-5717-4562-b3fc-2c963f66afa6"
```

### Test List Scanners
```bash
curl -X GET "http://localhost:5000/api/admin/scanners"
```

---

## Version History

- **v1.0** - Initial implementation with fingerprint-based pairing
- **Features:** Immutable fingerprints, duplicate detection, repair QR codes
- **Date:** February 9, 2026

---

**Document Type:** API Reference
**Status:** Complete
**Last Updated:** February 9, 2026
