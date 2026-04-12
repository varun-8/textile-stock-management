const mongoose = require('mongoose');
const crypto = require('crypto');

const scannerSchema = new mongoose.Schema({
    workspaceCode: {
        type: String,
        default: () => process.env.WORKSPACE_CODE || 'default',
        index: true
    },
    uuid: {
        type: String,
        required: true,
        unique: true
    },
    // FINGERPRINT: Immutable unique identifier like a hardware serial number
    // Generated at creation time and NEVER changes even if scanner is re-paired
    fingerprint: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomUUID()
    },
    name: {
        type: String,
        default: 'New Scanner'
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'DISABLED'],
        default: 'ACTIVE'
    },
    pairedAt: {
        type: Date,
        default: Date.now
    },
    repairCount: {
        type: Number,
        default: 0
    },
    lastSeen: {
        type: Date
    },
    lastIp: {
        type: String
    },
    // Device info for duplicate detection
    deviceInfo: {
        userAgent: String,
        macAddress: String
    },
    // Current employee using this scanner
    currentEmployee: {
        employeeId: String,
        name: String,
        loginAt: Date
    }
});

// Compound indexes for fast lookups and filtering
scannerSchema.index({ workspaceCode: 1, uuid: 1 });
scannerSchema.index({ fingerprint: 1 }, { unique: true }); // Fast pairing token lookup
scannerSchema.index({ status: 1, workspaceCode: 1 }); // Filter by status
scannerSchema.index({ lastSeen: -1, status: 1 }); // Online/offline status + sorting
scannerSchema.index({ lastIp: 1, workspaceCode: 1 }); // IP-based discovery
scannerSchema.index({ pairedAt: -1 }); // Sorting by paired date

module.exports = mongoose.model('Scanner', scannerSchema);
