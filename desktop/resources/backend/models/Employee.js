const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    pin: {
        type: String, // Stored as string to preserve leading zeros
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'TERMINATED'],
        default: 'ACTIVE'
    },
    lastScanner: String,
    lastActive: Date
}, { timestamps: true });

// Prevent duplicate names? Maybe not strictly required, but good practice.
// User said "alter later", so let's keep it simple.

module.exports = mongoose.model('Employee', EmployeeSchema);
