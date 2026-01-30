const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    pin: {
        type: String, // Stored as string to preserve leading zeros if needed
        required: true
    },
    role: {
        type: String,
        enum: ['WORKER', 'ADMIN'],
        default: 'WORKER'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
