const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    systemId: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    companyId: { type: String },
    clientName: { type: String },
    companyName: { type: String },
    deviceId: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'BLOCKED', 'DEACTIVATED'], default: 'ACTIVE' },
    blockReason: { type: String },
    blockedAt: { type: Date },
    blockedBy: { type: String },
    deactivateReason: { type: String },
    deactivatedAt: { type: Date },
    deactivatedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String }
});

module.exports = mongoose.model('System', systemSchema);
