const express = require('express');
const router = express.Router();
const Barcode = require('../models/Barcode');

// Get next sequence for UI
router.get('/sequence', async (req, res) => {
    try {
        const { year, size } = req.query;
        if (!year || !size) return res.status(400).json({ error: 'Year and Size required' });

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
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const qty = parseInt(quantity);
        if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

        // Limit quantity for single page (e.g. max 65 for 5x13 grid on A4, just an example limit)
        // User asked to "Prevent multi-page", so we enforce a hard limit.
        if (qty > 65) {
            return res.status(400).json({ error: 'Quantity exceeds single page limit (max 65)' });
        }

        // Find last sequence
        // We do this inside the request. Note: Race condition possible here but caught by Unique Index.
        const lastBarcode = await Barcode.findOne({ year, size }).sort({ sequence: -1 });
        let currentSequence = lastBarcode ? lastBarcode.sequence : 0;

        const newBarcodes = [];

        for (let i = 1; i <= qty; i++) {
            const seq = currentSequence + i;
            const seqString = seq.toString().padStart(4, '0');
            // Format: YY-SZ-XXXX (e.g. 26-40-0001)
            // Ensure year is 2 digits
            const yy = year.toString().slice(-2);
            const full_barcode = `${yy}-${size}-${seqString}`;

            newBarcodes.push({
                year,
                size,
                sequence: seq,
                full_barcode,
                status: 'Unused'
            });
        }

        // Insert Barcodes
        try {
            const savedBarcodes = await Barcode.insertMany(newBarcodes);

            // Also Populate MissedScan (Pending Scan List)
            const MissedScan = require('../models/MissedScan');
            const pendingScans = newBarcodes.map(b => ({
                barcode: b.full_barcode,
                year: b.year,
                size: b.size,
                sequence: b.sequence,
                status: 'PENDING',
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

            res.json({ success: true, barcodes: savedBarcodes });
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

// Check for missing barcodes (gaps in sequence)
router.get('/missing', async (req, res) => {
    try {
        const { year, size } = req.query;
        if (!year || !size) return res.status(400).json({ error: 'Year and Size required' });

        // Get all sequences, sorted
        const barcodes = await Barcode.find({ year, size }, { sequence: 1 }).sort({ sequence: 1 });

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

module.exports = router;
