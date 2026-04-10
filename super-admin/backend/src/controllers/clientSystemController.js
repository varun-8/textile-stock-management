const crypto = require('crypto');
const Client = require('../models/Client');
const System = require('../models/System');
const { audit } = require('./authController');

/**
 * Register a new client and its associated system
 */
const registerClient = async (req, res) => {
    try {
        const { clientName, companyName, companyId, deviceId } = req.body;
        if (!clientName || !companyName || !companyId || !deviceId) {
            return res.status(400).json({ error: 'clientName, companyId, companyName and deviceId are required' });
        }

        const clientId = crypto.randomUUID();
        const systemId = crypto.randomUUID();
        const now = new Date();

        const client = await Client.create({
            clientId,
            companyId,
            systemId,
            clientName,
            companyName,
            deviceId,
            status: 'REGISTERED',
            registeredAt: now,
            registeredBy: req.auth.userId,
            registeredByRole: req.auth.role
        });

        const system = await System.create({
            systemId,
            clientId,
            companyId,
            clientName,
            companyName,
            deviceId,
            status: 'ACTIVE',
            createdAt: now,
            createdBy: req.auth.userId
        });

        await audit(req, {
            action: 'CLIENT_REGISTER',
            targetType: 'CLIENT',
            targetId: clientId,
            metadata: { clientName, companyName, systemId }
        });

        res.json({ success: true, client, system });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const listClients = async (req, res) => {
    const items = await Client.find().sort({ registeredAt: -1 });
    res.json(items);
};

const listSystems = async (req, res) => {
    const items = await System.find().sort({ createdAt: -1 });
    res.json(items);
};

/**
 * Block a system (Super Admin only)
 */
const blockSystem = async (req, res) => {
    try {
        const { systemId } = req.params;
        const { reason } = req.body;

        const system = await System.findOne({ systemId });
        if (!system) return res.status(404).json({ error: 'System not found' });

        system.status = 'BLOCKED';
        system.blockedAt = new Date();
        system.blockedBy = req.auth.userId;
        system.blockReason = reason || 'Manual block by Super Admin';
        await system.save();

        await audit(req, {
            action: 'SYSTEM_BLOCK',
            targetType: 'SYSTEM',
            targetId: systemId,
            metadata: { reason: system.blockReason }
        });

        res.json({ success: true, system });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Deactivate a system (Super Admin only)
 */
const deactivateSystem = async (req, res) => {
    try {
        const { systemId } = req.params;
        const { reason } = req.body;

        const system = await System.findOne({ systemId });
        if (!system) return res.status(404).json({ error: 'System not found' });

        system.status = 'DEACTIVATED';
        system.deactivatedAt = new Date();
        system.deactivatedBy = req.auth.userId;
        system.deactivateReason = reason || 'Manual deactivation by Super Admin';
        await system.save();

        await audit(req, {
            action: 'SYSTEM_DEACTIVATE',
            targetType: 'SYSTEM',
            targetId: systemId,
            metadata: { reason: system.deactivateReason }
        });

        res.json({ success: true, system });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerClient,
    listClients,
    listSystems,
    blockSystem,
    deactivateSystem
};
