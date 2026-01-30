const express = require('express');
const router = express.Router();
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const AuditLog = require('../models/AuditLog');
const MissedScan = require('../models/MissedScan');

// Check barcode status (Scan Logic)
router.get('/scan/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const validBarcode = await Barcode.findOne({ full_barcode: barcode });
        const clothRoll = await ClothRoll.findOne({ barcode });

        if (!clothRoll) {
            if (!validBarcode) {
                return res.json({ status: 'INVALID', message: 'Barcode unknown to system' });
            }

            // --- SEQUENCE GAP DETECTION FOR PROMPT ---
            const barcodeParts = barcode.split('-');
            if (barcodeParts.length === 3) {
                const currentSeq = parseInt(barcodeParts[2]);
                if (currentSeq > 1) {
                    const prevSeq = String(currentSeq - 1).padStart(4, '0');
                    const prevBarcode = `${barcodeParts[0]}-${barcodeParts[1]}-${prevSeq}`;

                    const prevExists = await ClothRoll.findOne({ barcode: prevBarcode });
                    if (!prevExists) {
                        return res.json({
                            status: 'NEW',
                            gapDetected: true,
                            gapBarcode: prevBarcode,
                            barcode
                        });
                    }
                }
            }

            return res.json({
                status: 'NEW',
                message: 'New Roll Detected',
                details: { barcode }
            });
        }

        res.json({
            status: 'EXISTING',
            data: clothRoll
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Handle Stock In / Stock Out
router.post('/transaction', async (req, res) => {
    try {
        let { barcode, type, details, metre, weight, percentage } = req.body;
        let gapWarning = null;

        // Auto-resolve common legacy/display types to standard 'IN'
        if (type === 'PENDING' || type === 'MISSING') {
            type = 'IN';
        }

        if (!['IN', 'OUT'].includes(type)) {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }

        let clothRoll = await ClothRoll.findOne({ barcode });

        // --- STOCK IN WORKFLOW ---
        if (type === 'IN') {
            // Validation: Check Mandatory Fields (Block Invalid Numeric Values)
            if (metre === undefined || isNaN(metre) || metre <= 0) {
                return res.status(400).json({ error: 'Valid Metre required (Must be > 0)' });
            }
            if (weight === undefined || isNaN(weight) || weight <= 0) {
                return res.status(400).json({ error: 'Valid Weight required (Must be > 0)' });
            }
            // Optional Percentage (Default to 100 if missing from mobile)
            if (percentage === undefined || percentage === null || percentage === '') {
                percentage = 100;
            }

            if (isNaN(percentage) || percentage < 0) {
                return res.status(400).json({ error: 'Valid value required (Must be > 0)' });
            }

            // SEQUENCE ORDER CHECK
            try {
                const barcodeParts = barcode.split('-'); // YY-SZ-XXXX
                if (barcodeParts.length === 3) {
                    const currentSeq = parseInt(barcodeParts[2]);
                    if (currentSeq > 1) {
                        // If checking 0005, check if 0004 exists
                        const prevSeq = String(currentSeq - 1).padStart(4, '0');
                        const prevBarcode = `${barcodeParts[0]}-${barcodeParts[1]}-${prevSeq}`;

                        // Check if previous roll has ever been stocked (exists in ClothRoll collection)
                        const prevRoll = await ClothRoll.findOne({ barcode: prevBarcode });

                        if (!prevRoll) {
                            // GAP DETECTED!
                            console.log(`Gap detected: ${prevBarcode} missing before ${barcode}`);

                            // Log to MissedScan table
                            try {
                                await MissedScan.findOneAndUpdate(
                                    { barcode: prevBarcode },
                                    {
                                        barcode: prevBarcode,
                                        year: barcodeParts[0],
                                        size: barcodeParts[1],
                                        sequence: currentSeq - 1,
                                        status: 'PENDING',
                                        detectedAt: new Date()
                                    },
                                    { upsert: true, new: true }
                                );
                            } catch (e) {
                                console.error("Failed to log missed scan", e);
                            }

                            gapWarning = `Sequence Gap: ${prevBarcode} was skipped and added to Missing List.`;
                        }
                    }
                }
            } catch (seqError) {
                console.error("Sequence check failed", seqError);
            }

            if (clothRoll) {
                if (clothRoll.status === 'IN') {
                    return res.status(400).json({ error: 'data already exists for the barcode' });
                }

                clothRoll.status = 'IN';
                clothRoll.metre = metre;
                clothRoll.weight = weight;
                clothRoll.percentage = percentage;
                clothRoll.transactionHistory.push({
                    status: 'IN',
                    details: details || 'Re-Stock In',
                    date: new Date()
                });
            } else {
                // New Roll Creation
                clothRoll = new ClothRoll({
                    barcode,
                    status: 'IN',
                    metre,
                    weight,
                    percentage,
                    transactionHistory: [{
                        status: 'IN',
                        details: details || 'Initial Stock In',
                        date: new Date()
                    }]
                });
            }
        }

        // --- STOCK OUT WORKFLOW ---
        else if (type === 'OUT') {
            if (!clothRoll) {
                return res.status(404).json({ error: 'Roll not found. Cannot Stock Out.' });
            }

            // Rule: Only allow Stock Out if status = IN
            if (clothRoll.status === 'OUT') {
                return res.status(400).json({ error: 'Roll is already Checked Out' });
            }

            clothRoll.status = 'OUT';
            clothRoll.transactionHistory.push({
                status: 'OUT',
                details: details || 'Stock Out',
                date: new Date()
            });
        }

        if (type === 'IN') {
            // ...
            // Existing Stock In logic is above

            // Remove from Missed/Pending List as it is now found
            await MissedScan.deleteOne({ barcode: barcode });
        }

        await clothRoll.save();

        // AUDIT LOGGING
        await AuditLog.create({
            action: type === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
            user: 'MobileUser', // Ideally req.user if auth existed
            details: { barcode, metre, weight, percentage },
            ipAddress: req.ip
        });

        // Real-time Update
        if (req.io) {
            req.io.emit('stock_update', {
                type: type,
                barcode: barcode,
                details: { metre, weight, percentage }, // Emitting details
                timestamp: new Date()
            });
        }

        res.json({ success: true, clothRoll, gapWarning });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Reported Missed Scans (for Mobile Display)
router.get('/missing-scans', async (req, res) => {
    try {
        const missed = await MissedScan.find({ status: 'PENDING' }).sort({ detectedAt: -1 });
        res.json(missed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INVENTORY MANAGEMENT (DASHBOARD) ---

// Update Roll Details
router.put('/inventory/update', async (req, res) => {
    try {
        const { barcode, metre, weight, percentage, status, type } = req.body;
        const targetStatus = status || type;

        const clothRoll = await ClothRoll.findOne({ barcode });
        if (!clothRoll) {
            return res.status(404).json({ error: 'Roll not found in inventory' });
        }

        clothRoll.metre = metre;
        clothRoll.weight = weight;
        clothRoll.percentage = percentage;

        // Ensure status is valid before assignment
        if (targetStatus && ['IN', 'OUT'].includes(targetStatus)) {
            clothRoll.status = targetStatus;
        }

        // Log history - use valid status for enum or default to current
        clothRoll.transactionHistory.push({
            status: clothRoll.status,
            details: `Desktop Edit: ${metre}m, ${weight}kg, ${percentage}%`,
            date: new Date()
        });

        await clothRoll.save();
        res.json({ success: true, data: clothRoll });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Roll
// Mark Barcode as Damaged (Hide from Missing)
router.patch('/missing/damaged/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const result = await MissedScan.findOneAndUpdate(
            { barcode },
            { status: 'DAMAGED' },
            { new: true }
        );

        if (!result) return res.status(404).json({ error: 'Barcode not found in missing list' });

        // Audit logging
        await AuditLog.create({
            action: 'MARK_DAMAGED',
            user: 'Admin',
            details: { barcode },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Barcode marked as damaged and hidden.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/inventory/delete/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;

        const result = await ClothRoll.deleteOne({ barcode });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Roll not found' });
        }

        // Check if this was a generated barcode
        const validBarcode = await Barcode.findOne({ full_barcode: barcode });

        if (validBarcode) {
            // Re-add to MissedScan as PENDING
            try {
                await MissedScan.create({
                    barcode: validBarcode.full_barcode,
                    year: validBarcode.year,
                    size: validBarcode.size,
                    sequence: validBarcode.sequence,
                    status: 'PENDING',
                    detectedAt: new Date()
                });
            } catch (ignore) {
                // Ignore if already exists (shouldn't happen if logic is correct)
                console.log("Re-insert missing ignored:", ignore.message);
            }
        }

        // Audit Log
        await AuditLog.create({
            action: 'DELETE',
            user: 'Admin',
            details: { barcode },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Stock Deleted and moved to Missing' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
