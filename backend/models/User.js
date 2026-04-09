const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    workspaceCode: {
        type: String,
        default: () => process.env.WORKSPACE_CODE || 'default',
        index: true
    },
    username: {
        type: String,
        required: true
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

userSchema.index({ workspaceCode: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
