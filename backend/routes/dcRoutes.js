const express = require('express');
const router = express.Router();
const DeliveryChallan = require('../models/DeliveryChallan');
const ClothRoll = require('../models/ClothRoll');
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
        const { batchId } = req.query;
        const query = {
            status: 'RESERVED',
            $or: [{ dcId: { $exists: false } }, { dcId: null }]
        };

        if (batchId) {
            query.transactionHistory = {
                $elemMatch: {
                    status: 'RESERVED',
                    sessionId: batchId
                }
            };
        }

        const rolls = await ClothRoll.find(query)
            .sort({ updatedAt: -1 })
            .select('barcode metre weight pieces updatedAt');
        res.json(rolls);
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
            batchId,
            templateId,
            templateName,
            templateSnapshot
        } = req.body;
        
        if (!partyName) {
            return res.status(400).json({ error: 'Party Name is required' });
        }

        if (!batchId) {
            return res.status(400).json({ error: 'Batch is required for DC generation' });
        }

        const sourceBatch = await Session.findById(batchId).lean();
        if (!sourceBatch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (sourceBatch.type !== 'OUT') {
            return res.status(400).json({ error: 'Only Stock Out batches can be used for DC' });
        }

        if (sourceBatch.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Only fully completed batches can undergo DC' });
        }

        const existingBatchDc = await DeliveryChallan.findOne({ sourceBatchId: sourceBatch._id }).lean();
        if (existingBatchDc) {
            return res.status(400).json({ error: `DC already exists for this batch (${existingBatchDc.dcNumber})` });
        }

        const batchRolls = await ClothRoll.find({
            "transactionHistory.sessionId": sourceBatch._id
        }).select('barcode transactionHistory').lean();

        const hasHistoricalDcForBatch = batchRolls.some((roll) =>
            (roll.transactionHistory || []).some((tx) =>
                typeof tx.details === 'string' && tx.details.includes('Dispatched via DC-')
            )
        );

        if (hasHistoricalDcForBatch) {
            return res.status(400).json({ error: 'This completed batch has already undergone DC once' });
        }

        const eligibleBatchRolls = await getSessionDispatchRollDocs(sourceBatch._id);

        if (eligibleBatchRolls.length === 0) {
            return res.status(400).json({ error: 'No reserved rolls are available for this dispatch batch' });
        }

        // DC rolls are always derived from the selected dispatch batch.
        // Client payload cannot manually add/remove roll barcodes.
        const rollsToDispatch = eligibleBatchRolls;
        
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
            sourceBatchId: sourceBatch._id,
            sourceBatchCode: sourceBatch.batchCode || '',
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
                        $set: { status: 'OUT', dcId: dc._id },
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
               $set: { status: 'IN' },
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
                    $set: { status: 'OUT' },
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

module.exports = router;
