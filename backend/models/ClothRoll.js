const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    details: String,
    userId: String, // Legacy Admin ID
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: String, // Snapshot for history
    action: { type: String, enum: ['SCAN', 'BATCH'] }, // Optional context
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' } // Link to Session
});

const clothRollSchema = new mongoose.Schema({
    barcode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true,
        default: 'IN'
    },
    metre: {
        type: Number,
        required: true,
        min: 0
    },
    weight: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        min: 0
    },
    transactionHistory: [transactionSchema]
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes
// Unique barcode index is already created by unique: true option, but being explicit is good.
// Timestamp indexing for reports
clothRollSchema.index({ createdAt: 1 });
clothRollSchema.index({ updatedAt: 1 });
clothRollSchema.index({ status: 1 }); // Useful for filtering by In/Out

module.exports = mongoose.model('ClothRoll', clothRollSchema);
