const express = require('express');
const router = express.Router();
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');

router.get('/dashboard', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};

        if (startDate || endDate) {
            let dateFilter = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            query.updatedAt = dateFilter;
        }

        // 1. Cloth Roll Stats
        const totalRolls = await ClothRoll.countDocuments(startDate || endDate ? { createdAt: query.updatedAt } : {});
        const stockIn = await ClothRoll.countDocuments({ status: 'IN', ...query });
        const stockOut = await ClothRoll.countDocuments({ status: 'OUT', ...query });

        // 2. Missing Barcodes Calculation (Use Actual Reported Missed Scans)
        const MissedScan = require('../models/MissedScan');
        const missingCount = await MissedScan.countDocuments({
            status: 'PENDING',
            ...(startDate || endDate ? { detectedAt: query.updatedAt } : {})
        });

        res.json({
            totalRolls,
            stockIn,
            stockOut,
            missingCount
        });

    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/list/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;
        let data = [];
        let query = {};

        // Date Filter Logic
        if (startDate || endDate) {
            let dateFilter = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

            // Map date field based on type
            if (type === 'missingCount') {
                query.detectedAt = dateFilter;
            } else if (type === 'totalRolls') {
                query.createdAt = dateFilter;
            } else {
                query.updatedAt = dateFilter;
            }
        }

        if (type === 'stockIn') {
            data = await ClothRoll.find({ status: 'IN', ...query }).sort({ updatedAt: -1 }).limit(100);
        } else if (type === 'stockOut') {
            data = await ClothRoll.find({ status: 'OUT', ...query }).sort({ updatedAt: -1 }).limit(100);
        } else if (type === 'totalRolls') {
            data = await ClothRoll.find({ ...query }).sort({ createdAt: -1 }).limit(100);
        } else if (type === 'missingCount') {
            const MissedScan = require('../models/MissedScan');
            data = await MissedScan.find({ status: 'PENDING', ...query }).sort({ detectedAt: -1 }).limit(100);
        } else if (type === 'recent') {
            data = await ClothRoll.find({ ...query }).sort({ updatedAt: -1 }).limit(50);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
