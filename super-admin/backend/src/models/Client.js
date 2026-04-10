const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    clientId: { type: String, required: true, unique: true },
    companyId: { type: String, required: true, unique: true }, // Human-readable ID (e.g. SLT-2026)
    systemId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    companyName: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    status: { type: String, enum: ['REGISTERED', 'ACTIVE', 'INACTIVE'], default: 'REGISTERED' },
    registeredAt: { type: Date, default: Date.now },
    registeredBy: { type: String },
    registeredByRole: { type: String }
});

module.exports = mongoose.model('Client', clientSchema);
