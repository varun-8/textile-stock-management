const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'LOGIN',
            'LOGOUT',
            'BARCODE_GENERATE',
            'STOCK_IN',
            'STOCK_OUT',
            'BACKUP',
            'RESTORE',
            'DELETE',
            'MARK_DAMAGED',
            'INVENTORY_EDIT',
            'ERROR'
        ]
    },
    user: {
        type: String, // Username or User ID
        default: 'System'
    },
    employeeId: { type: String, ref: 'Employee' },
    employeeName: String,
    details: {
        type: Object
    },
    ipAddress: String,
    timestamp: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 90 // Auto-delete after 90 days (Retention Policy)
    }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
