const express = require('express');
const router = express.Router();
const ClothRoll = require('../models/ClothRoll');
const AuditLog = require('../models/AuditLog');

// Get Stock Report (Summary or Detailed)
// Query Params: type=IN|OUT, startDate=YYYY-MM-DD, endDate=YYYY-MM-DD, format=SUMMARY|DETAILED
router.get('/', async (req, res) => {
    try {
        const { type, startDate, endDate, format } = req.query;

        console.log('Generating Report:', { type, startDate, endDate, format });

        if (!['IN', 'OUT'].includes(type) && type !== 'ALL') {
            return res.status(400).json({ error: 'Invalid Report Type. Must be IN or OUT or ALL' });
        }

        // Build Date Filter
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter = {
                $gte: startDate ? new Date(startDate) : new Date(0), // Default to beginning of time
                $lte: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date()
            };
        } else {
            // Default to Today if no date provided? Or All Time? 
            // Let's default to Today for "Daily Report" feel, but allow All Time.
            // If query params missing, assume "Today".
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            dateFilter = { $gte: startOfDay, $lte: endOfDay };
        }

        // 1. Fetch Data
        // We need to look at Transaction History for accurate historical reporting
        // OR ClothRoll status for current inventory state.
        // User asked for "Stock In Report" and "Stock Out Report" which implies Flow/History.

        // Aggregation to unwind transaction history and filter by date/type
        const pipeline = [
            { $unwind: "$transactionHistory" },
            {
                $match: {
                    "transactionHistory.status": type === 'ALL' ? { $in: ['IN', 'OUT'] } : type,
                    "transactionHistory.date": dateFilter
                }
            },
            { $sort: { "transactionHistory.date": -1 } }
        ];

        // Ensure we project necessary fields
        pipeline.push({
            $project: {
                barcode: 1,
                metre: 1, // Note: This shows CURRENT metre, might be different at transaction time if edited? 
                // For simplicity, we assume roll metre doesn't change much or we log it in history?
                // The history model has 'details', so we might not have exact metre at that time.
                // But usually Stock In sets the metre. Stock Out takes the whole roll.
                weight: 1,
                percentage: 1,
                status: "$transactionHistory.status",
                date: "$transactionHistory.date",
                details: "$transactionHistory.details"
            }
        });

        const detailedData = await ClothRoll.aggregate(pipeline);

        if (format === 'SUMMARY') {
            const summary = {
                totalRolls: detailedData.length,
                totalMetres: detailedData.reduce((sum, item) => sum + (item.metre || 0), 0),
                totalWeight: detailedData.reduce((sum, item) => sum + (item.weight || 0), 0),
                startDate: startDate || new Date().toISOString().split('T')[0],
                endDate: endDate || new Date().toISOString().split('T')[0],
                type
            };
            return res.json(summary);
        }

        // DETAILED
        // Return list
        res.json(detailedData);

    } catch (err) {
        console.error('Report Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
