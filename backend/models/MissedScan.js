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
        enum: ['PENDING', 'RESOLVED', 'DAMAGED'],
        default: 'PENDING'
    }
});

module.exports = mongoose.model('MissedScan', missedScanSchema);
