const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
    quotationNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    partyName: {
        type: String,
        required: true,
        trim: true
    },
    partyAddress: {
        type: String,
        trim: true,
        default: ''
    },
    validityDate: {
        type: Date,
        default: null
    },
    density: {
        type: String,
        required: true,
        trim: true
    },
    templateId: {
        type: String,
        trim: true,
        default: ''
    },
    templateName: {
        type: String,
        trim: true,
        default: ''
    },
    templateSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    rolls: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClothRoll'
    }],
    rollSnapshots: [{
        barcode: { type: String, trim: true },
        metre: { type: Number, default: 0 },
        weight: { type: Number, default: 0 },
        pieces: { type: Number, default: 1 },
        density: { type: String, trim: true }
    }],
    totalRolls: {
        type: Number,
        required: true,
        default: 0
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    terms: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'CANCELLED'],
        default: 'ACTIVE'
    },
    createdBy: {
        type: String,
        default: 'Admin'
    }
}, {
    timestamps: true
});

quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ partyName: 1 });
quotationSchema.index({ density: 1 });

module.exports = mongoose.model('Quotation', quotationSchema);
