const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true
    },
    targetSize: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED'],
        default: 'ACTIVE'
    },
    createdBy: {
        type: String, // Username or Admin
        default: 'Admin'
    },
    activeScanners: [{
        type: String // Scanner UUIDs
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    endedAt: {
        type: Date
    },
    // Summary Stats (Stored on Completion)
    totalItems: { type: Number, default: 0 },
    totalMetre: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 }
});

module.exports = mongoose.model('Session', sessionSchema);
