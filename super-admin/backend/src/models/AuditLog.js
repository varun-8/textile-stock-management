const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    auditId: { type: String, required: true, unique: true },
    action: { type: String, required: true },
    outcome: { type: String, default: 'SUCCESS' },
    targetType: { type: String },
    targetId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    actorId: { type: String },
    actorEmail: { type: String },
    actorRole: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
