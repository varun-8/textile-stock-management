const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema({
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
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['Unused', 'Used'],
        default: 'Unused'
    },
    paperSize: {
        type: String,
        enum: ['a4', 'a3'],
        default: 'a4'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index to ensure strict sequence uniqueness per year+size
barcodeSchema.index({ year: 1, size: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('Barcode', barcodeSchema);
