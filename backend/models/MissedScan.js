const mongoose = require('mongoose');

const missedScanSchema = new mongoose.Schema({
    barcode: {
        type: String,
        required: true,
        unique: true
    },
    year: String,
    size: String,
    sequence: Number,
    detectedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['PENDING', 'RESOLVED', 'DAMAGED', 'IGNORED', 'LOST'],
        default: 'PENDING'
    },
    issueType: {
        type: String,
        enum: ['SEQUENCE_MISSING', 'UNREGISTERED_ROLL', 'STATUS_MISMATCH'],
        default: 'SEQUENCE_MISSING'
    },
    resolutionAction: {
        type: String,
        enum: ['NONE', 'MARK_LOST', 'CREATE_ENTRY', 'IGNORE', 'MARK_DAMAGED'],
        default: 'NONE'
    },
    resolutionNote: {
        type: String,
        default: ''
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('MissedScan', missedScanSchema);
