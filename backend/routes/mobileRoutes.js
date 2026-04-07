const express = require('express');
const router = express.Router();
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const AuditLog = require('../models/AuditLog');
const MissedScan = require('../models/MissedScan');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const Scanner = require('../models/Scanner');
const { normalizePieces, totalFromPieces } = require('../utils/rollPieces');

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
                            message: `Wrong Pick Density (PPI)! Expected ${session.targetSize}, Scanned ${scannedSize}`,
                            expected: session.targetSize,
                            actual: scannedSize
                        });
                    }
                }

                // OUT session can only scan currently available IN rolls for reservation.
                if (session.type === 'OUT') {
                    if (!clothRoll) {
                        return res.json({ status: 'INVALID', message: 'Roll not found for Stock Out batch' });
                    }
                    if (clothRoll.status !== 'IN') {
                        return res.json({
                            status: 'INVALID',
                            message: `Roll cannot be reserved. Current status: ${clothRoll.status}`
                        });
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
        let { barcode, type, details, metre, weight, percentage, pieces, pieceLengths, employeeId, employeeName } = req.body;
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
            const submittedPieces = pieces ?? pieceLengths ?? details?.pieces;
            const normalizedPieces = normalizePieces(submittedPieces, metre);
            const totalMetre = totalFromPieces(normalizedPieces);

            console.log('STOCK_IN_PIECES_PAYLOAD', {
                barcode,
                metre,
                pieces,
                pieceLengths,
                detailPieces: details?.pieces,
                normalizedPieces,
                totalMetre
            });

            // Validation: Check Mandatory Fields (Block Invalid Numeric Values)
            if (!totalMetre || Number.isNaN(totalMetre) || totalMetre <= 0) {
                return res.status(400).json({ error: 'Valid Metre required (Must be > 0)' });
            }
            if (weight === undefined || isNaN(weight) || weight <= 0) {
                return res.status(400).json({ error: 'Valid Weight required (Must be > 0)' });
            }

            metre = totalMetre;
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
                                        issueType: 'SEQUENCE_MISSING',
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
                clothRoll.pieces = normalizedPieces;
                // Update latest employee context
                clothRoll.employeeId = employeeId;
                clothRoll.employeeName = employeeName;

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
                    pieces: normalizedPieces,
                    employeeId,   // Save latest employee
                    employeeName, // Save latest employee
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

            // Rule: OUT batch scan moves IN -> RESERVED (not directly OUT)
            if (clothRoll.status === 'OUT') {
                return res.status(400).json({ error: 'Roll is already Checked Out' });
            }

            if (clothRoll.status === 'RESERVED') {
                return res.status(400).json({ error: 'Roll is already reserved for dispatch' });
            }

            if (clothRoll.status !== 'IN') {
                return res.status(400).json({ error: `Roll cannot be reserved from status ${clothRoll.status}` });
            }

            clothRoll.status = 'RESERVED';
            clothRoll.employeeId = employeeId;
            clothRoll.employeeName = employeeName;
            clothRoll.transactionHistory.push({
                status: 'RESERVED',
                details: details || 'Reserved in dispatch batch',
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

        if (type === 'IN') {
            console.log('STOCK_IN_PIECES_SAVED', {
                barcode: clothRoll.barcode,
                metre: clothRoll.metre,
                pieces: clothRoll.pieces || []
            });
        }

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
            details: { barcode, metre, weight, percentage, sessionId },
            ipAddress: req.ip
        });

        // Real-time Update
        if (req.io) {
            req.io.emit('stock_update', {
                type: type,
                barcode: barcode,
                details: { metre, weight, percentage, pieces: clothRoll.pieces || [] }, // Emitting details
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
        const { type, items, employeeId, employeeName, sessionId } = req.body; // items = [{ barcode, details, ... }]

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

                if (clothRoll.status === 'RESERVED') {
                    results.failed.push({ barcode, error: 'Already Reserved' });
                    continue;
                }

                if (clothRoll.status !== 'IN') {
                    results.failed.push({ barcode, error: `Invalid source status ${clothRoll.status}` });
                    continue;
                }

                // OUT batch reserves roll until DC is generated
                clothRoll.status = 'RESERVED';
                clothRoll.employeeId = employeeId;
                clothRoll.employeeName = employeeName;
                clothRoll.transactionHistory.push({
                    status: 'RESERVED',
                    details: details || 'Bulk Reserved for Dispatch',
                    date: new Date(),
                    employeeId,
                    employeeName,
                    sessionId: sessionId // Add Session ID
                });

                await clothRoll.save();

                // Audit Log
                await AuditLog.create({
                    action: 'STOCK_OUT',
                    user: employeeName || 'MobileBatch',
                    employeeId,
                    employeeName,
                    details: { barcode, method: 'BATCH', sessionId },
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
                type: 'RESERVED',
                count: results.success.length,
                timestamp: new Date()
            });

            // If Session ID exists, emit session update too
            if (sessionId) {
                req.io.emit('session_update', { action: 'UPDATE', sessionId });
            }
        }

        res.json({
            message: `Processed ${results.success.length} items. ${results.failed.length} failed.`,
            results
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
