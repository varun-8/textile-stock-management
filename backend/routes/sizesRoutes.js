const express = require('express');
const router = express.Router();
const Size = require('../models/Size');

const Barcode = require('../models/Barcode');
const ClothRoll = require('../models/ClothRoll');

// GET all sizes with stats
router.get('/', async (req, res) => {
    try {
        const sizes = await Size.find().sort({ code: 1 });

        // Enrich with stats
        const enrichedSizes = await Promise.all(sizes.map(async (size) => {
            const sizeCode = size.code;
            const sizeObj = size.toObject();

            // 1. Count Generated Barcodes
            // Barcode collection uses Number for size.
            // Try to match both string or number representation to be safe,
            // though Barcode schema enforces Number.
            let generatedCount = 0;
            if (!isNaN(sizeCode)) {
                generatedCount = await Barcode.countDocuments({ size: Number(sizeCode) });
            } else {
                generatedCount = await Barcode.countDocuments({ size: sizeCode }); // Likely 0 if string
            }

            // 2. Count Stock In / Out
            // ClothRolls store full barcode string: YY-SIZE-SEQ
            // We use Regex to match the size part: /-SIZE-/
            // Safe because format is strict.
            const regex = new RegExp(`-${sizeCode}-`);

            const [inCount, outCount] = await Promise.all([
                ClothRoll.countDocuments({ barcode: { $regex: regex }, status: 'IN' }),
                ClothRoll.countDocuments({ barcode: { $regex: regex }, status: 'OUT' })
            ]);

            sizeObj.stats = {
                generated: generatedCount,
                inStock: inCount,
                outStock: outCount
            };

            return sizeObj;
        }));

        res.json(enrichedSizes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new size
router.post('/add', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Size Code is required' });

        const existing = await Size.findOne({ code });
        if (existing) return res.status(400).json({ error: 'Size Code already exists' });

        const newSize = new Size({ code });
        await newSize.save();
        res.status(201).json(newSize);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE size
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sizeToDelete = await Size.findById(id);

        if (!sizeToDelete) {
            return res.status(404).json({ error: 'Size not found' });
        }

        // Check availability in Barcode collection
        // Barcode schema uses Number for size, Size schema uses String.
        // We attempt to match both if the size code is numeric.
        let isUsed = false;

        // 1. Direct check (if schema matches)
        const directCount = await Barcode.countDocuments({ size: sizeToDelete.code });
        if (directCount > 0) isUsed = true;

        // 2. Numeric check (if code is a number but stored as string)
        if (!isUsed && !isNaN(sizeToDelete.code)) {
            const numericCode = Number(sizeToDelete.code);
            const numCount = await Barcode.countDocuments({ size: numericCode });
            if (numCount > 0) isUsed = true;
        }

        if (isUsed) {
            return res.status(400).json({
                error: `Cannot delete Size '${sizeToDelete.code}'. It is used in generated barcodes or stock.`
            });
        }

        await Size.findByIdAndDelete(id);
        res.json({ message: 'Size deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
