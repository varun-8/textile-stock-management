const express = require('express');
const router = express.Router();
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const AuditLog = require('../models/AuditLog');
const MissedScan = require('../models/MissedScan');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const Scanner = require('../models/Scanner');

// Check barcode status (Scan Logic)
router.get('/ping', async (req, res) => {
    try {
        if (req.scanner) {
            req.scanner.lastSeen = new Date();
            await req.scanner.save();
            res.json({ status: 'OK' });
        } else {
            res.status(401).json({ error: 'Unauthorized Scanner' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/scan/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const sessionId = req.headers['x-session-id'] || req.query.sessionId;

        const validBarcode = await Barcode.findOne({ full_barcode: barcode });
        const clothRoll = await ClothRoll.findOne({ barcode });

        // --- SESSION VALIDATION ---
        if (sessionId) {
            const Session = require('../models/Session');
            const session = await Session.findById(sessionId);

            if (session && session.status === 'ACTIVE') {
                // Check Size
                const barcodeParts = barcode.split('-'); // YY-SZ-XXXX
                if (barcodeParts.length === 3) {
                    const scannedSize = barcodeParts[1];
                    if (scannedSize !== session.targetSize) {
                        return res.json({
                            status: 'WRONG_SIZE',
                            message: `Wrong Size! Expected ${session.targetSize}, Scanned ${scannedSize}`,
                            expected: session.targetSize,
                            actual: scannedSize
                        });
                    }
                }

                // Check Type (If session is OUT, but item is not IN, etc? - Maybe handle in transaction, but early warning is good)
                if (session.type === 'OUT' && (!clothRoll || clothRoll.status === 'OUT')) {
                    // Allow scanning to proceed to "transaction" where it will fail, OR fail here with specific message
                    // Standard behavior: let it pass as "EXISTING" or "NEW" and let transaction handle status check detalils?
                    // But user wants to know if they can scan.
                    // If OUT session, and item doesn't exist -> Error
                    if (!clothRoll) {
                        return res.json({ status: 'INVALID', message: 'Roll not found for Stock Out' });
                    }
                }
            } else if (session && session.status !== 'ACTIVE') {
                return res.json({ status: 'SESSION_ENDED', message: 'Session is no longer active' });
            }
        }
        // -------------------------

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
        let { barcode, type, details, metre, weight, percentage, employeeId, employeeName } = req.body;
        const sessionId = req.headers['x-session-id'] || req.body.sessionId; // Capture Session ID
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
                    date: new Date(),
                    employeeId,
                    employeeName,
                    sessionId // Add Session ID
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
                        date: new Date(),
                        employeeId,
                        employeeName,
                        sessionId // Add Session ID
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
                date: new Date(),
                employeeId,
                employeeName,
                sessionId // Add Session ID
            });
        }

        if (type === 'IN') {
            // ...
            // Existing Stock In logic is above

            // Remove from Missed/Pending List as it is now found
            await MissedScan.deleteOne({ barcode: barcode });
        }

        await clothRoll.save();

        // --- ADD SCANNER TO SESSION ON FIRST SCAN ---
        if (sessionId && req.scanner) {
            try {
                const session = await Session.findById(sessionId);
                if (session && !session.activeScanners.includes(req.scanner.uuid)) {
                    session.activeScanners.push(req.scanner.uuid);
                    await session.save();
                }
            } catch (sessionErr) {
                console.error('Failed to update session scanners:', sessionErr);
            }
        }

        // --- UPDATE EMPLOYEE CONTEXT ---
        if (employeeId) {
            try {
                const updateData = { lastActive: new Date() };
                let scannerName = null;

                // 1. Try Direct Header (Best)
                const headerScannerId = req.headers['x-scanner-id'];
                if (headerScannerId) {
                    const directScanner = await Scanner.findOne({ uuid: headerScannerId });
                    if (directScanner) {
                        scannerName = directScanner.name;
                    }
                }

                // 2. Fallback to Session Association if Header failed
                if (!scannerName && sessionId) {
                    const session = await Session.findById(sessionId);
                    if (session && session.activeScanners && session.activeScanners.length > 0) {
                        // Heuristic: Use first scanner if multiple
                        const sessionScanner = await Scanner.findOne({ uuid: session.activeScanners[0] });
                        if (sessionScanner) {
                            scannerName = sessionScanner.name;
                        }
                    }
                }

                if (scannerName) {
                    updateData.lastScanner = scannerName;
                }

                await Employee.findOneAndUpdate({ employeeId }, updateData);
            } catch (empErr) {
                console.error("Failed to update employee context", empErr);
            }
        }
        // -------------------------------

        // AUDIT LOGGING
        await AuditLog.create({
            action: type === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
            user: employeeName || 'MobileUser', // Ideally req.user if auth existed
            employeeId,
            employeeName,
            employeeName,
            details: { barcode, metre, weight, percentage, sessionId },
            ipAddress: req.ip
        });

        // Real-time Update
        if (req.io) {
            req.io.emit('stock_update', {
                type: type,
                barcode: barcode,
                details: { metre, weight, percentage }, // Emitting details
                sessionId: sessionId, // Add Session ID for filtering
                timestamp: new Date(),
                user: employeeName
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

// Batch Transaction (Bulk Stock Out)
router.post('/batch-transaction', async (req, res) => {
    try {
        const { type, items, employeeId, employeeName } = req.body; // items = [{ barcode, details, ... }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items provided for batch processing' });
        }

        if (type !== 'OUT') {
            return res.status(400).json({ error: 'Batch processing currently only supported for Stock OUT' });
        }

        const results = {
            success: [],
            failed: []
        };

        // Process sequentially to avoid race conditions on same docs (unlikely but safe)
        for (const item of items) {
            const { barcode, details } = item;

            try {
                const clothRoll = await ClothRoll.findOne({ barcode });

                if (!clothRoll) {
                    results.failed.push({ barcode, error: 'Roll not found' });
                    continue;
                }

                if (clothRoll.status === 'OUT') {
                    results.failed.push({ barcode, error: 'Already Checked Out' });
                    continue;
                }

                // Update Status
                clothRoll.status = 'OUT';
                clothRoll.employeeId = employeeId;
                clothRoll.employeeName = employeeName;
                clothRoll.transactionHistory.push({
                    status: 'OUT',
                    details: details || 'Bulk Stock Out',
                    date: new Date(),
                    employeeId,
                    employeeName
                });

                await clothRoll.save();

                // Audit Log
                await AuditLog.create({
                    action: 'STOCK_OUT',
                    user: employeeName || 'MobileBatch',
                    employeeId,
                    employeeName,
                    details: { barcode, method: 'BATCH' },
                    ipAddress: req.ip
                });

                results.success.push({ barcode });

            } catch (err) {
                console.error(`Batch Error for ${barcode}:`, err);
                results.failed.push({ barcode, error: err.message });
            }
        }

        // Global Event for Dashboard Refresh
        if (req.io && results.success.length > 0) {
            req.io.emit('batch_stock_update', {
                type: 'OUT',
                count: results.success.length,
                timestamp: new Date()
            });
        }

        res.json({
            message: `Processed ${results.success.length} items. ${results.failed.length} failed.`,
            results
        });

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
