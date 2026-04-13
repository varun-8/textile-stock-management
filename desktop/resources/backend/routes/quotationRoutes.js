const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const ClothRoll = require('../models/ClothRoll');
const AuditLog = require('../models/AuditLog');

function normalizeDensity(value) {
    return String(value || '').trim().toUpperCase();
}

function parseBarcodeParts(barcode) {
    const parts = String(barcode || '').trim().split('-');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        return null;
    }
    return parts;
}

function extractDensityFromBarcode(barcode) {
    const parts = parseBarcodeParts(barcode);
    return parts ? String(parts[1]).trim().toUpperCase() : null;
}

function toRollSnapshot(roll) {
    return {
        barcode: roll.barcode,
        metre: Number(roll.metre || 0),
        weight: Number(roll.weight || 0),
        pieces: Array.isArray(roll.pieces) && roll.pieces.length > 0 ? roll.pieces.length : 1,
        density: extractDensityFromBarcode(roll.barcode) || ''
    };
}

async function validateAndResolveRolls(barcodes, density) {
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
        throw new Error('At least one roll barcode is required');
    }

    const normalizedDensity = normalizeDensity(density);
    if (!normalizedDensity) {
        throw new Error('Density is required');
    }

    const uniqueBarcodes = Array.from(new Set(barcodes.map((b) => String(b || '').trim()).filter(Boolean)));
    if (uniqueBarcodes.length === 0) {
        throw new Error('At least one valid roll barcode is required');
    }

    const malformed = uniqueBarcodes.filter((barcode) => !parseBarcodeParts(barcode));
    if (malformed.length > 0) {
        throw new Error(`Malformed barcode(s): ${malformed.join(', ')}`);
    }

    const rolls = await ClothRoll.find({ barcode: { $in: uniqueBarcodes } }).select('barcode metre weight pieces status').lean();

    if (rolls.length !== uniqueBarcodes.length) {
        const found = new Set(rolls.map((roll) => roll.barcode));
        const missing = uniqueBarcodes.filter((barcode) => !found.has(barcode));
        throw new Error(`Some rolls were not found: ${missing.join(', ')}`);
    }

    const unavailable = rolls.filter((roll) => roll.status !== 'IN' && roll.status !== 'RESERVED');
    if (unavailable.length > 0) {
        throw new Error(`Some rolls are not available: ${unavailable.map((r) => r.barcode).join(', ')}`);
    }

    const wrongDensity = rolls.filter((roll) => extractDensityFromBarcode(roll.barcode) !== normalizedDensity);
    if (wrongDensity.length > 0) {
        throw new Error(`Roll density mismatch for selected density ${normalizedDensity}: ${wrongDensity.map((r) => r.barcode).join(', ')}`);
    }

    return rolls;
}

async function getNextQuotationNumber() {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const latest = await Quotation.findOne({ quotationNumber: new RegExp(`^QTN-${currentYear}-`) }).sort({ createdAt: -1 }).lean();

    let nextSeq = 1;
    if (latest && latest.quotationNumber) {
        const parts = latest.quotationNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!Number.isNaN(lastSeq)) {
            nextSeq = lastSeq + 1;
        }
    }

    return `QTN-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
}

router.get('/', async (req, res) => {
    try {
        const quotations = await Quotation.find()
            .populate({ path: 'rolls', select: 'barcode metre weight pieces' })
            .sort({ createdAt: -1 });

        res.json(quotations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/available-rolls', async (req, res) => {
    try {
        const density = normalizeDensity(req.query.density);
        if (!density) {
            return res.status(400).json({ error: 'Density query parameter is required' });
        }

        const pattern = new RegExp(`^[^-]+-${density}-[^-]+$`, 'i');
        const rolls = await ClothRoll.find({
            status: { $in: ['IN', 'RESERVED'] },
            barcode: { $regex: pattern }
        })
            .sort({ updatedAt: -1 })
            .select('barcode metre weight pieces status updatedAt')
            .lean();

        const safeRolls = rolls
            .map((roll) => ({
                ...roll,
                density: extractDensityFromBarcode(roll.barcode)
            }))
            .filter((roll) => roll.density === density);

        res.json({
            density,
            totalRolls: safeRolls.length,
            rolls: safeRolls
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id)
            .populate({ path: 'rolls', select: 'barcode metre weight pieces' });

        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        res.json(quotation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            partyName,
            partyAddress,
            validityDate,
            density,
            barcodes,
            notes,
            terms,
            templateId,
            templateName,
            templateSnapshot
        } = req.body;

        if (!partyName || !String(partyName).trim()) {
            return res.status(400).json({ error: 'Party Name is required' });
        }

        const normalizedDensity = normalizeDensity(density);
        if (!normalizedDensity) {
            return res.status(400).json({ error: 'Density is required' });
        }

        const rolls = await validateAndResolveRolls(barcodes, normalizedDensity);
        const quotationNumber = await getNextQuotationNumber();

        const quotation = new Quotation({
            quotationNumber,
            partyName: String(partyName).trim().slice(0, 120),
            partyAddress: typeof partyAddress === 'string' ? partyAddress.trim().slice(0, 400) : '',
            validityDate: validityDate ? new Date(validityDate) : null,
            density: normalizedDensity,
            templateId: typeof templateId === 'string' ? templateId.slice(0, 64) : '',
            templateName: typeof templateName === 'string' ? templateName.slice(0, 80) : '',
            templateSnapshot: templateSnapshot && typeof templateSnapshot === 'object' ? templateSnapshot : null,
            rolls: rolls.map((roll) => roll._id),
            rollSnapshots: rolls.map(toRollSnapshot),
            totalRolls: rolls.length,
            notes: typeof notes === 'string' ? notes.trim().slice(0, 1200) : '',
            terms: typeof terms === 'string' ? terms.trim().slice(0, 1200) : '',
            createdBy: req.user ? req.user.username : 'Admin'
        });

        await quotation.save();

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.user ? req.user.username : 'Admin',
            details: {
                action: 'QUOTATION_CREATE',
                quotationNumber,
                density: normalizedDensity,
                totalRolls: quotation.totalRolls
            },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'QUOTATION_CREATED',
                quotationNumber,
                density: normalizedDensity,
                count: quotation.totalRolls,
                timestamp: new Date()
            });
        }

        const populated = await Quotation.findById(quotation._id)
            .populate({ path: 'rolls', select: 'barcode metre weight pieces' });

        res.json({ success: true, quotation: populated });
    } catch (err) {
        const message = err?.message || 'Failed to create quotation';
        if (
            message.includes('required') ||
            message.includes('Malformed barcode') ||
            message.includes('not found') ||
            message.includes('mismatch') ||
            message.includes('not available')
        ) {
            return res.status(400).json({ error: message });
        }
        res.status(500).json({ error: message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        if (quotation.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Cancelled quotation cannot be updated' });
        }

        const {
            partyName,
            partyAddress,
            validityDate,
            density,
            barcodes,
            notes,
            terms,
            templateId,
            templateName,
            templateSnapshot
        } = req.body;

        if (!partyName || !String(partyName).trim()) {
            return res.status(400).json({ error: 'Party Name is required' });
        }

        const normalizedDensity = normalizeDensity(density);
        if (!normalizedDensity) {
            return res.status(400).json({ error: 'Density is required' });
        }

        const rolls = await validateAndResolveRolls(barcodes, normalizedDensity);

        quotation.partyName = String(partyName).trim().slice(0, 120);
        quotation.partyAddress = typeof partyAddress === 'string' ? partyAddress.trim().slice(0, 400) : '';
        quotation.validityDate = validityDate ? new Date(validityDate) : null;
        quotation.density = normalizedDensity;
        quotation.templateId = typeof templateId === 'string' ? templateId.slice(0, 64) : '';
        quotation.templateName = typeof templateName === 'string' ? templateName.slice(0, 80) : '';
        quotation.templateSnapshot = templateSnapshot && typeof templateSnapshot === 'object' ? templateSnapshot : null;
        quotation.rolls = rolls.map((roll) => roll._id);
        quotation.rollSnapshots = rolls.map(toRollSnapshot);
        quotation.totalRolls = rolls.length;
        quotation.notes = typeof notes === 'string' ? notes.trim().slice(0, 1200) : '';
        quotation.terms = typeof terms === 'string' ? terms.trim().slice(0, 1200) : '';

        await quotation.save();

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.user ? req.user.username : 'Admin',
            details: {
                action: 'QUOTATION_UPDATE',
                quotationNumber: quotation.quotationNumber,
                density: normalizedDensity,
                totalRolls: quotation.totalRolls
            },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'QUOTATION_UPDATED',
                quotationNumber: quotation.quotationNumber,
                density: normalizedDensity,
                count: quotation.totalRolls,
                timestamp: new Date()
            });
        }

        const populated = await Quotation.findById(quotation._id)
            .populate({ path: 'rolls', select: 'barcode metre weight pieces' });

        res.json({ success: true, quotation: populated });
    } catch (err) {
        const message = err?.message || 'Failed to update quotation';
        if (
            message.includes('required') ||
            message.includes('Malformed barcode') ||
            message.includes('not found') ||
            message.includes('mismatch') ||
            message.includes('not available')
        ) {
            return res.status(400).json({ error: message });
        }
        res.status(500).json({ error: message });
    }
});

router.post('/:id/cancel', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        if (quotation.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Quotation is already cancelled' });
        }

        quotation.status = 'CANCELLED';
        await quotation.save();

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.user ? req.user.username : 'Admin',
            details: {
                action: 'QUOTATION_CANCEL',
                quotationNumber: quotation.quotationNumber
            },
            ipAddress: req.ip
        });

        if (req.io) {
            req.io.emit('stock_update', {
                type: 'QUOTATION_CANCELLED',
                quotationNumber: quotation.quotationNumber,
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'Quotation cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
