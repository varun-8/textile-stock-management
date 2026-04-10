const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema({
    companyName: { type: String, default: 'LoomTrack' },
    portalTitle: { type: String, default: 'Super Admin Portal' },
    supportEmail: { type: String },
    supportPhone: { type: String },
    billingEmail: { type: String },
    address: { type: String },
    brandColor: { type: String, default: '#6366f1' },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String }
});

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);
