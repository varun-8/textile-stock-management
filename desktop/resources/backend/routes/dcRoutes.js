const express = require('express');
const router = express.Router();
const DeliveryChallan = require('../models/DeliveryChallan');
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const { detectMissingSequences } = require('../utils/missingSequenceService');
const {
    calculateDispatchTotals,
    getSessionDispatchRollDocs,
    syncDeliveryChallanFromSession
} = require('../utils/dispatchBatch');

// Get all Delivery Challans
router.get('/', async (req, res) => {
    try {
        const dcs = await DeliveryChallan.find()
            .populate({ path: 'rolls', select: 'barcode metre weight pieces' })
            .sort({ createdAt: -1 });
        res.json(dcs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Available Rolls for DC (Only RESERVED rolls and not linked to a DC)
router.get('/available-rolls', async (req, res) => {
    try {
        const { density } = req.query;
        const query = {
            status: 'RESERVED',
            $or: [{ dcId: { $exists: false } }, { dcId: null }]
        };

        if (density) {
            query.barcode = { $regex: new RegExp(`-${density}-`, 'i') };
        }

        const rolls = await ClothRoll.find(query)
            .sort({ updatedAt: -1 })
            .select('barcode metre weight pieces updatedAt transactionHistory')
            .lean();

        const Session = require('../models/Session');
        const sessionIds = new Set();
        rolls.forEach(r => {
            const tx = (r.transactionHistory || []).find(t => t.status === 'RESERVED' && t.sessionId);
            if (tx) sessionIds.add(tx.sessionId.toString());
        });

        const sessions = await Session.find({ _id: { $in: Array.from(sessionIds) } }).select('batchCode').lean();
        const batchCodeMap = new Map();
        sessions.forEach(s => batchCodeMap.set(s._id.toString(), s.batchCode));

        const rollsWithBatch = rolls.map(r => {
            const tx = (r.transactionHistory || []).find(t => t.status === 'RESERVED' && t.sessionId);
            const batchCode = tx ? batchCodeMap.get(tx.sessionId.toString()) : 'Unknown';
            return {
                _id: r._id,
                barcode: r.barcode,
                metre: r.metre,
                weight: r.weight,
                pieces: r.pieces,
                updatedAt: r.updatedAt,
                batchCode: batchCode || 'Unknown'
            };
        });

        res.json(rollsWithBatch);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new Delivery Challan
router.post('/', async (req, res) => {
    try {
        const {
            partyName,
            partyAddress,
            quality,
            folding,
            lotNo,
            billNo,
            billPreparedBy,
            appliedPercentage,
            vehicleNumber,
            driverName,
            density,
            templateId,
            templateName,
            templateSnapshot,
            barcodes
        } = req.body;
        
        if (!partyName) {
            return res.status(400).json({ error: 'Party Name is required' });
        }

        if (!Array.isArray(barcodes) || barcodes.length === 0) {
            return res.status(400).json({ error: 'Please provide at least one barcode to include in the DC' });
        }

        const rollsToDispatch = await ClothRoll.find({ barcode: { $in: barcodes } });
        
        if (rollsToDispatch.length !== barcodes.length) {
            return res.status(400).json({ error: 'Some requested rolls could not be found' });
        }
        
        let totalMetre = 0;
        for (const roll of rollsToDispatch) {
            if (roll.status !== 'RESERVED') {
                return res.status(400).json({ error: `Roll ${roll.barcode} is not reserved for dispatch` });
            }
            if (roll.dcId) {
                return res.status(400).json({ error: `Roll ${roll.barcode} is already assigned to a DC` });
            }
            totalMetre += roll.metre;
        }

        const pct = Number(appliedPercentage) || 0;
        const safePct = pct < -100 ? -100 : pct;
        const totalMetreWithAdjustment = totalMetre * (1 + safePct / 100);

        // Generate next DC Number (e.g. DC-YY-XXXX)
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const latestDC = await DeliveryChallan.findOne({ dcNumber: new RegExp(`^DC-${currentYear}-`) }).sort({ createdAt: -1 });
        let nextSeq = 1;
        if (latestDC) {
            const parts = latestDC.dcNumber.split('-');
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }
        const dcNumber = `DC-${currentYear}-${String(nextSeq).padStart(4, '0')}`;

        // Create the DC
        const dc = new DeliveryChallan({
            dcNumber,
            partyName,
            partyAddress: typeof partyAddress === 'string' ? partyAddress.trim().slice(0, 300) : '',
            quality: typeof quality === 'string' ? quality.trim().slice(0, 120) : '',
            folding: typeof folding === 'string' ? folding.trim().slice(0, 120) : '',
            lotNo: typeof lotNo === 'string' ? lotNo.trim().slice(0, 120) : '',
            billNo: typeof billNo === 'string' ? billNo.trim().slice(0, 120) : '',
            billPreparedBy: typeof billPreparedBy === 'string' ? billPreparedBy.trim().slice(0, 120) : '',
            vehicleNumber,
            driverName,
            density: density || '',
            templateId: typeof templateId === 'string' ? templateId.slice(0, 64) : '',
            templateName: typeof templateName === 'string' ? templateName.slice(0, 80) : '',
            templateSnapshot: templateSnapshot && typeof templateSnapshot === 'object' ? templateSnapshot : null,
            rolls: rollsToDispatch.map(r => r._id),
            totalRolls: rollsToDispatch.length,
            totalMetre: parseFloat(totalMetreWithAdjustment.toFixed(2)),
            appliedPercentage: parseFloat(safePct.toFixed(2))
        });

        await dc.save();

        // Final dispatch transition: RESERVED -> OUT
        const bulkOps = rollsToDispatch.map(roll => {
            return {
                updateOne: {
                    filter: { _id: roll._id },
                    update: {
                        $set: { status: 'OUT', dcId: dc._id, employeeName: req.user ? req.user.username : 'Admin DC Engine' },
                        $push: {
                            transactionHistory: {
                                status: 'OUT',
                                details: `Dispatched via ${dcNumber}`,
                                date: new Date(),
                                employeeName: req.user ? req.user.username : 'Admin DC Engine'
                            }
                        }
                    }
                }
            };
        });

        await ClothRoll.bulkWrite(bulkOps);

        await Barcode.updateMany(
            { full_barcode: { $in: rollsToDispatch.map((roll) => roll.barcode) } },
            {
                $set: {
                    status: 'Used',
                    lifecycleStatus: 'USED_IN_DISPATCH',
                    lastPrintedAt: new Date(),
                    lastPrintedBy: req.user ? req.user.username : 'Admin DC Engine'
                },
                $push: {
                    lifecycleHistory: {
                        action: 'USED_IN_DISPATCH',
                        note: `Dispatched via ${dcNumber}`,
                        by: req.user ? req.user.username : 'Admin DC Engine',
                        at: new Date()
                    }
                }
            }
        );

        // Sequence missing audit after DC generation.
        await detectMissingSequences({ triggeredBy: 'dc-generated' });

        // Audit Log
        await AuditLog.create({
            action: 'STOCK_OUT',
            user: req.user ? req.user.username : 'Admin',
            details: {
                method: 'DC_CREATION',
                dcNumber,
                totalRolls: dc.totalRolls,
                templateId: dc.templateId || null,
                templateName: dc.templateName || null
            },
            ipAddress: req.ip
        });
        
        if (req.io) {
            req.io.emit('stock_update', {
                type: 'DC_CREATED',
                count: dc.totalRolls,
                dcNumber: dc.dcNumber,
                timestamp: new Date()
            });
        }

        // Return populated DC for immediately printing
        const populatedDC = await DeliveryChallan.findById(dc._id).populate('rolls');

        res.json({ success: true, dc: populatedDC });

    } catch (err) {
        console.error('Error creating DC:', err);
        res.status(500).json({ error: err.message });
    }
});

// Cancel a DC
router.post('/:id/cancel', async (req, res) => {
    try {
        const dc = await DeliveryChallan.findById(req.params.id);
        if (!dc) return res.status(404).json({ error: 'DC not found' });
        
        if (dc.status === 'CANCELLED') {
            return res.status(400).json({ error: 'DC is already cancelled' });
        }

        dc.status = 'CANCELLED';
        await dc.save();

        // Revert Rolls back to IN and remove linkage
        await ClothRoll.updateMany(
            { dcId: dc._id },
            { 
               $set: { status: 'IN', employeeName: req.user ? req.user.username : 'Admin Cancel Engine' },
               $unset: { dcId: "" },
               $push: {
                   transactionHistory: {
                       status: 'IN',
                       details: `Reverted: ${dc.dcNumber} Cancelled`,
                       date: new Date(),
                       employeeName: req.user ? req.user.username : 'Admin Cancel Engine'
                   }
               }
            }
        );

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.user ? req.user.username : 'Admin',
            details: { action: 'CANCEL_DC', dcNumber: dc.dcNumber },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'DC_CANCELLED',
                count: dc.totalRolls,
                dcNumber: dc.dcNumber,
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'DC Cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exceptional controlled flow: Manual OUT without batch/DC (IN -> OUT only)
router.post('/manual-out', async (req, res) => {
    try {
        const { barcodes, reason, notes } = req.body;

        if (!Array.isArray(barcodes) || barcodes.length === 0) {
            return res.status(400).json({ error: 'At least one barcode is required' });
        }

        const normalizedReason = String(reason || '').trim();
        if (!normalizedReason) {
            return res.status(400).json({ error: 'Reason is required for Manual Out' });
        }

        const rolls = await ClothRoll.find({ barcode: { $in: barcodes } });
        if (rolls.length !== barcodes.length) {
            const found = new Set(rolls.map(r => r.barcode));
            const missing = barcodes.filter(b => !found.has(b));
            return res.status(400).json({ error: `Some rolls were not found: ${missing.join(', ')}` });
        }

        for (const roll of rolls) {
            if (roll.status !== 'IN') {
                return res.status(400).json({
                    error: `Roll ${roll.barcode} cannot be manually moved OUT from status ${roll.status}`
                });
            }
        }

        const when = new Date();
        const detailText = notes
            ? `Manual Out (${normalizedReason}): ${String(notes).trim()}`
            : `Manual Out (${normalizedReason})`;

        const ops = rolls.map((roll) => ({
            updateOne: {
                filter: { _id: roll._id },
                update: {
                    $set: { status: 'OUT', employeeName: req.user ? req.user.username : 'Admin Manual Out' },
                    $push: {
                        transactionHistory: {
                            status: 'OUT',
                            details: detailText,
                            date: when,
                            employeeName: req.user ? req.user.username : 'Admin Manual Out'
                        }
                    }
                }
            }
        }));

        await ClothRoll.bulkWrite(ops);

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.user ? req.user.username : 'Admin',
            details: {
                action: 'MANUAL_OUT',
                reason: normalizedReason,
                notes: notes || '',
                count: rolls.length,
                barcodes
            },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'MANUAL_OUT',
                count: rolls.length,
                reason: normalizedReason,
                timestamp: when
            });
        }

        res.json({ success: true, moved: rolls.length, reason: normalizedReason });
    } catch (err) {
        console.error('Manual Out error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Edit an existing DC
router.put('/:id', async (req, res) => {
    try {
        const dcId = req.params.id;
        const dc = await DeliveryChallan.findById(dcId);
        if (!dc) return res.status(404).json({ error: 'DC not found' });

        if (dc.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Cannot edit a cancelled DC' });
        }

        const {
            partyName,
            partyAddress,
            quality,
            folding,
            lotNo,
            billNo,
            billPreparedBy,
            vehicleNumber,
            driverName,
            barcodes,
            appliedPercentage
        } = req.body;

        if (!partyName) {
            return res.status(400).json({ error: 'Party Name is required' });
        }

        if (!Array.isArray(barcodes) || barcodes.length === 0) {
            return res.status(400).json({ error: 'Please provide at least one barcode' });
        }

        // Handle Text Fields
        dc.partyName = partyName;
        dc.partyAddress = typeof partyAddress === 'string' ? partyAddress.trim().slice(0, 300) : '';
        dc.quality = typeof quality === 'string' ? quality.trim().slice(0, 120) : '';
        dc.folding = typeof folding === 'string' ? folding.trim().slice(0, 120) : '';
        dc.lotNo = typeof lotNo === 'string' ? lotNo.trim().slice(0, 120) : '';
        dc.billNo = typeof billNo === 'string' ? billNo.trim().slice(0, 120) : '';
        dc.billPreparedBy = typeof billPreparedBy === 'string' ? billPreparedBy.trim().slice(0, 120) : '';
        dc.vehicleNumber = vehicleNumber || '';
        dc.driverName = driverName || '';

        const pct = Number(appliedPercentage) || 0;
        const safePct = pct < -100 ? -100 : pct;
        dc.appliedPercentage = parseFloat(safePct.toFixed(2));

        // Handle Rolls Modification
        const currentRollDocs = await ClothRoll.find({ dcId: dc._id });
        const currentBarcodes = currentRollDocs.map(r => r.barcode);

        const barcodesToRemove = currentBarcodes.filter(b => !barcodes.includes(b));
        const barcodesToAdd = barcodes.filter(b => !currentBarcodes.includes(b));

        // Validation for barcodesToAdd
        let rollsToAdd = [];
        if (barcodesToAdd.length > 0) {
            rollsToAdd = await ClothRoll.find({ barcode: { $in: barcodesToAdd } });
            
            if (rollsToAdd.length !== barcodesToAdd.length) {
                return res.status(400).json({ error: 'Some rolls to add were not found in the database.' });
            }

            for (const roll of rollsToAdd) {
                // We no longer require the roll to belong to a specific source batch
                if (roll.status !== 'RESERVED') {
                    return res.status(400).json({ error: `Roll ${roll.barcode} is not in RESERVED status (Status: ${roll.status}).` });
                }

                if (roll.dcId) {
                    return res.status(400).json({ error: `Roll ${roll.barcode} is already assigned to another DC.` });
                }
            }
        }

        const employeeName = req.user ? req.user.username : 'Admin DC Engine';

        // Process Removals
        if (barcodesToRemove.length > 0) {
            const rollsToRemoveDocs = currentRollDocs.filter(r => barcodesToRemove.includes(r.barcode));
            const removeBulkOps = rollsToRemoveDocs.map(roll => ({
                updateOne: {
                    filter: { _id: roll._id },
                    update: {
                        $set: { status: 'RESERVED' },
                        $unset: { dcId: "" },
                        $push: {
                            transactionHistory: {
                                status: 'RESERVED',
                                details: `Removed from ${dc.dcNumber}`,
                                date: new Date(),
                                employeeName
                            }
                        }
                    }
                }
            }));
            await ClothRoll.bulkWrite(removeBulkOps);

            await Barcode.updateMany(
                { full_barcode: { $in: barcodesToRemove } },
                {
                    $set: { status: 'Active', lifecycleStatus: 'PRINTED' },
                    $push: {
                        lifecycleHistory: {
                            action: 'REMOVED_FROM_DISPATCH',
                            note: `Removed from ${dc.dcNumber}`,
                            by: employeeName,
                            at: new Date()
                        }
                    }
                }
            );
        }

        // Process Additions
        if (rollsToAdd.length > 0) {
            const addBulkOps = rollsToAdd.map(roll => ({
                updateOne: {
                    filter: { _id: roll._id },
                    update: {
                        $set: { status: 'OUT', dcId: dc._id },
                        $push: {
                            transactionHistory: {
                                status: 'OUT',
                                details: `Dispatched via ${dc.dcNumber} (Edit)`,
                                date: new Date(),
                                employeeName
                            }
                        }
                    }
                }
            }));
            await ClothRoll.bulkWrite(addBulkOps);

            await Barcode.updateMany(
                { full_barcode: { $in: barcodesToAdd } },
                {
                    $set: {
                        status: 'Used',
                        lifecycleStatus: 'USED_IN_DISPATCH',
                        lastPrintedAt: new Date(),
                        lastPrintedBy: employeeName
                    },
                    $push: {
                        lifecycleHistory: {
                            action: 'USED_IN_DISPATCH',
                            note: `Added via ${dc.dcNumber} (Edit)`,
                            by: employeeName,
                            at: new Date()
                        }
                    }
                }
            );
        }

        // Update DC totals
        const finalRollDocs = await ClothRoll.find({ dcId: dc._id });
        let newTotalMetre = 0;
        for (const roll of finalRollDocs) {
            newTotalMetre += roll.metre;
        }

        const totalMetreWithAdjustment = newTotalMetre * (1 + dc.appliedPercentage / 100);

        dc.rolls = finalRollDocs.map(r => r._id);
        dc.totalRolls = finalRollDocs.length;
        dc.totalMetre = parseFloat(totalMetreWithAdjustment.toFixed(2));

        await dc.save();

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: employeeName,
            details: {
                action: 'EDIT_DC',
                dcNumber: dc.dcNumber,
                rollsAdded: barcodesToAdd.length,
                rollsRemoved: barcodesToRemove.length
            },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'DC_EDITED',
                dcNumber: dc.dcNumber,
                timestamp: new Date()
            });
        }

        const populatedDC = await DeliveryChallan.findById(dc._id).populate('rolls');
        res.json({ success: true, dc: populatedDC });

    } catch (err) {
        console.error('Error editing DC:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
