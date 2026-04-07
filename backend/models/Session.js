const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    batchCode: {
        type: String,
        default: null
    },
    batchYear: {
        type: Number,
        default: null
    },
    batchSequence: {
        type: Number,
        default: null
    },
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

sessionSchema.index({ batchCode: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Session', sessionSchema);
