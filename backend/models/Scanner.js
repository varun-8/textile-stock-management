const mongoose = require('mongoose');

const scannerSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        unique: true
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
    lastSeen: {
        type: Date
    }
});

module.exports = mongoose.model('Scanner', scannerSchema);
