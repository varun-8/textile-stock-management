const mongoose = require('mongoose');

const deliveryChallanSchema = new mongoose.Schema({
    dcNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    companyName: {
        type: String,
        default: 'Prodexa' // Currently 'Prodexa', later 'LoomTrack'
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
    quality: {
        type: String,
        trim: true,
        default: ''
    },
    folding: {
        type: String,
        trim: true,
        default: ''
    },
    lotNo: {
        type: String,
        trim: true,
        default: ''
    },
    billNo: {
        type: String,
        trim: true,
        default: ''
    },
    billPreparedBy: {
        type: String,
        trim: true,
        default: ''
    },
    vehicleNumber: {
        type: String,
        trim: true
    },
    driverName: {
        type: String,
        trim: true
    },
    sourceBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null
    },
    sourceBatchCode: {
        type: String,
        trim: true,
        default: ''
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
    totalRolls: {
        type: Number,
        required: true,
        default: 0
    },
    totalMetre: {
        type: Number,
        required: true,
        default: 0
    },
    appliedPercentage: {
        type: Number,
        default: 0
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

// Indexes for fast lookups
deliveryChallanSchema.index({ dcNumber: 1 }, { unique: true });
deliveryChallanSchema.index({ createdAt: -1 });
deliveryChallanSchema.index({ partyName: 1 });
deliveryChallanSchema.index({ sourceBatchId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DeliveryChallan', deliveryChallanSchema);
