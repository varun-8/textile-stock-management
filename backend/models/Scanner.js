const mongoose = require('mongoose');
const crypto = require('crypto');

const scannerSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Scanner', scannerSchema);
