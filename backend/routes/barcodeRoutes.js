const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Barcode = require('../models/Barcode');
const MissedScan = require('../models/MissedScan');
const AuditLog = require('../models/AuditLog');

function pushLifecycleEvent(doc, action, note, user) {
    doc.lifecycleStatus = action;
    doc.lifecycleHistory = Array.isArray(doc.lifecycleHistory) ? doc.lifecycleHistory : [];
    doc.lifecycleHistory.push({
        action,
        note: note || '',
        by: user || 'Admin',
        at: new Date()
    });
}

// Get next sequence for UI
router.get('/sequence', async (req, res) => {
    try {
        const { year, size } = req.query;
        if (!year || !size) return res.status(400).json({ error: 'Year and Pick Density (PPI) are required' });

        const lastBarcode = await Barcode.findOne({ year, size }).sort({ sequence: -1 });
        const lastSequence = lastBarcode ? lastBarcode.sequence : 0;

        res.json({
            lastSequence,
            nextSequence: lastSequence + 1
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate barcodes
router.post('/generate', async (req, res) => {
    try {
        const { year, size, quantity } = req.body;

        // Basic validation
        if (!year || !size || !quantity) {
            return res.status(400).json({ error: 'Year, Pick Density (PPI), and quantity are required' });
        }

        const qty = parseInt(quantity);
        if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
        const batchId = crypto.randomUUID();

        // Find last sequence
        // We do this inside the request. Note: Race condition possible here but caught by Unique Index.
        const lastBarcode = await Barcode.findOne({ year, size }).sort({ sequence: -1 });
        let currentSequence = lastBarcode ? lastBarcode.sequence : 0;

        const newBarcodes = [];

        for (let i = 1; i <= qty; i++) {
            const seq = currentSequence + i;
            const seqString = seq.toString().padStart(4, '0');
            const yy = year.toString().slice(-2);
            const full_barcode = `${yy}-${size}-${seqString}`;

            newBarcodes.push({
                year,
                size,
                sequence: seq,
                full_barcode,
                status: 'Unused',
                lifecycleStatus: 'GENERATED',
                printCount: 0,
                paperSize: req.body.paperSize || 'a4',
                batchId,
                lifecycleHistory: [{
                    action: 'GENERATED',
                    note: 'Barcode generated',
                    by: req.user?.username || 'Admin',
                    at: new Date()
                }]
            });
        }

        // Insert Barcodes
        try {
            const savedBarcodes = await Barcode.insertMany(newBarcodes);

            // Also Populate MissedScan (Pending Scan List)
            const pendingScans = newBarcodes.map(b => ({
                barcode: b.full_barcode,
                year: b.year,
                size: b.size,
                sequence: b.sequence,
                status: 'PENDING',
                issueType: 'UNREGISTERED_ROLL',
                detectedAt: new Date()
            }));

            try {
                // Use ordered: false to ignore duplicates if they re-generate or if partial exists
                await MissedScan.insertMany(pendingScans, { ordered: false });
            } catch (missedErr) {
                // Ignore duplicate errors (code 11000) for MissedScan
                if (missedErr.code !== 11000) console.error("Error populating missing list", missedErr);
            }

            // Real-time Sync: Notify all clients to update their sequence display
            if (req.io) {
                req.io.emit('sequence_update', {
                    year,
                    size,
                    lastSequence: currentSequence + qty
                });
            }

            const now = new Date();
            await Barcode.bulkWrite(savedBarcodes.map((doc) => ({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            lifecycleStatus: 'PRINTED',
                            printCount: 1,
                            lastPrintedAt: now,
                            lastPrintedBy: req.user?.username || 'Admin'
                        },
                        $push: {
                            lifecycleHistory: {
                                action: 'PRINTED',
                                note: 'Initial barcode print',
                                by: req.user?.username || 'Admin',
                                at: now
                            }
                        }
                    }
                }
            })));

            await AuditLog.create({
                action: 'BARCODE_GENERATE',
                user: req.user?.username || 'Admin',
                details: { year, size, quantity: qty, batchId },
                ipAddress: req.ip
            });

            const printedBarcodes = await Barcode.find({ _id: { $in: savedBarcodes.map((doc) => doc._id) } }).lean();
            res.json({ success: true, barcodes: printedBarcodes });
        } catch (err) {
            if (err.code === 11000) {
                // Duplicate detected
                return res.status(409).json({
                    error: 'Duplicate barcode detected – generation stopped',
                    details: 'Sequence conflict. Please refresh and try again.'
                });
            }
            throw err;
        }

    } catch (err) {
        console.error("Barcode generation error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/lookup/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const barcodeDoc = await Barcode.findOne({ full_barcode: barcode }).lean();
        if (!barcodeDoc) {
            return res.status(404).json({ error: 'Barcode not found' });
        }

        const missingDoc = await MissedScan.findOne({ barcode }).lean();
        res.json({ barcode: barcodeDoc, missing: missingDoc || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check for missing barcodes (gaps in sequence)
router.get('/missing', async (req, res) => {
    try {
        const { year, size } = req.query;
        if (!year || !size) return res.status(400).json({ error: 'Year and Pick Density (PPI) are required' });

        // Get all sequences, sorted
        const barcodes = await Barcode.find({ year, size }, { sequence: 1 }).sort({ sequence: 1 }).lean();

        const existingSeqs = new Set(barcodes.map(b => b.sequence));
        const maxSeq = barcodes.length > 0 ? barcodes[barcodes.length - 1].sequence : 0;

        const missing = [];
        // Assuming sequence starts at 1 based on "0001" example. 
        // If "Start from 0000" meant 0 is a valid barcode, we'd start loop at 0.
        // But usually "Starts from 0000" in counters means next is 1.
        for (let i = 1; i < maxSeq; i++) {
            if (!existingSeqs.has(i)) {
                // Generate the full barcode string for the missing sequence
                const seqString = i.toString().padStart(4, '0');
                const yy = year.toString().slice(-2);
                missing.push({
                    sequence: i,
                    full_barcode: `${yy}-${size}-${seqString}`
                });
            }
        }

        res.json({ missing, count: missing.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reprint', async (req, res) => {
    try {
        const { barcodes, paperSize } = req.body;
        const list = Array.isArray(barcodes) ? Array.from(new Set(barcodes.map((item) => String(item || '').trim()).filter(Boolean))) : [];

        if (list.length === 0) {
            return res.status(400).json({ error: 'At least one barcode is required' });
        }

        const docs = await Barcode.find({ full_barcode: { $in: list } }).lean();
        if (docs.length !== list.length) {
            const found = new Set(docs.map((doc) => doc.full_barcode));
            const missing = list.filter((code) => !found.has(code));
            return res.status(404).json({ error: `Barcode(s) not found: ${missing.join(', ')}` });
        }

        const now = new Date();
        for (const doc of docs) {
            pushLifecycleEvent(doc, 'REPRINTED', 'Barcode label reprinted', req.user?.username || 'Admin');
            doc.printCount = (Number(doc.printCount) || 0) + 1;
            doc.lastPrintedAt = now;
            doc.lastPrintedBy = req.user?.username || 'Admin';
            doc.paperSize = paperSize || doc.paperSize || 'a4';
            await doc.save();
        }

        await AuditLog.create({
            action: 'BARCODE_GENERATE',
            user: req.user?.username || 'Admin',
            details: { count: docs.length, barcodes: list, reprint: true },
            ipAddress: req.ip
        });

        res.json({
            success: true,
            barcodes: await Barcode.find({ full_barcode: { $in: list } }).lean()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get barcode generation history
router.get('/history', async (req, res) => {
    try {
        const history = await Barcode.aggregate([
            {
                $addFields: {
                    historyBatchId: {
                        $ifNull: [
                            '$batchId',
                            {
                                $concat: [
                                    { $toString: '$year' },
                                    '-',
                                    '$size',
                                    '-',
                                    { $dateToString: { format: '%Y-%m-%dT%H:%M:%S', date: '$createdAt' } }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        batchId: "$historyBatchId",
                        year: "$year",
                        size: "$size"
                    },
                    count: { $sum: 1 },
                    minSeq: { $min: "$sequence" },
                    maxSeq: { $max: "$sequence" },
                    paperSize: { $first: "$paperSize" },
                    createdAt: { $min: "$createdAt" },
                    barcodes: {
                        $push: { full_barcode: "$full_barcode" }
                    }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $limit: 25
            }
        ]);

        const formatted = history.map(h => ({
            year: h._id.year,
            size: h._id.size,
            date: new Date(h.createdAt).toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }),
            paperSize: h.paperSize,
            count: h.count,
            sequenceRange: `${String(h.minSeq).padStart(4, '0')} - ${String(h.maxSeq).padStart(4, '0')}`,
            barcodes: h.barcodes
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
