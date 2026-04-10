const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
    licenseId: { type: String, required: true, unique: true },
    typ: { type: String, default: 'LICENSE' }, // 'LICENSE' or 'RESET'
    companyName: { type: String, required: true },
    workspaceCode: { type: String, default: 'default' },
    deviceId: { type: String, required: true },
    features: { type: [String], default: [] },
    activationCode: { type: String, required: true },
    source: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    status: { type: String, enum: ['ISSUED', 'SYNCED', 'REVOKED', 'EXPIRED'], default: 'ISSUED' },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    createdBy: { type: String }, // userId of creator
    createdByRole: { type: String }
});

module.exports = mongoose.model('License', licenseSchema);
