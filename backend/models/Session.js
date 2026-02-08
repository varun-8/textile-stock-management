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
    }
});

module.exports = mongoose.model('Session', sessionSchema);
