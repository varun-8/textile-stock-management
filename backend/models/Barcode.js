const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema({
    workspaceCode: {
        type: String,
        default: () => process.env.WORKSPACE_CODE || 'default',
        index: true
    },
    year: {
        type: Number,
        required: true
    },
    size: {
        type: String,
        required: true
    },
    sequence: {
        type: Number,
        required: true
    },
    full_barcode: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Unused', 'Used'],
        default: 'Unused'
    },
    lifecycleStatus: {
        type: String,
        enum: ['GENERATED', 'PRINTED', 'REPRINTED', 'USED_IN_STOCK_IN', 'USED_IN_DISPATCH', 'MISSING', 'RESOLVED', 'IGNORED'],
        default: 'GENERATED'
    },
    printCount: {
        type: Number,
        default: 0
    },
    lastPrintedAt: {
        type: Date,
        default: null
    },
    lastPrintedBy: {
        type: String,
        default: ''
    },
    lifecycleHistory: [{
        action: {
            type: String,
            enum: ['GENERATED', 'PRINTED', 'REPRINTED', 'USED_IN_STOCK_IN', 'USED_IN_DISPATCH', 'MISSING', 'RESOLVED', 'IGNORED']
        },
        note: {
            type: String,
            default: ''
        },
        by: {
            type: String,
            default: ''
        },
        at: {
            type: Date,
            default: Date.now
        }
    }],
    paperSize: {
        type: String,
        enum: ['a4', 'a3'],
        default: 'a4'
    },
    batchId: {
        type: String,
        default: null,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index to ensure strict sequence uniqueness per workspace+year+size
barcodeSchema.index({ workspaceCode: 1, year: 1, size: 1, sequence: 1 }, { unique: true });
barcodeSchema.index({ workspaceCode: 1, full_barcode: 1 }, { unique: true });

module.exports = mongoose.model('Barcode', barcodeSchema);
