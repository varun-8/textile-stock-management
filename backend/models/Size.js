const mongoose = require('mongoose');

const SizeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Size', SizeSchema);
