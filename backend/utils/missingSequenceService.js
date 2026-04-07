const ClothRoll = require('../models/ClothRoll');
const MissedScan = require('../models/MissedScan');

const BARCODE_PATTERN = /^(\d{2})-([^-]+)-(\d+)$/;

function parseBarcode(fullBarcode) {
    const match = String(fullBarcode || '').match(BARCODE_PATTERN);
    if (!match) return null;

    const year = match[1];
    const size = match[2];
    const sequence = Number(match[3]);

    if (!Number.isFinite(sequence) || sequence <= 0) return null;
    return { year, size, sequence };
}

function buildBarcode(year, size, sequence) {
    return `${year}-${size}-${String(sequence).padStart(4, '0')}`;
}

async function detectMissingSequences({ triggeredBy = 'system' } = {}) {
    const rolls = await ClothRoll.find({}, { barcode: 1 }).lean();

    const grouped = new Map();

    for (const roll of rolls) {
        const parsed = parseBarcode(roll.barcode);
        if (!parsed) continue;

        const key = `${parsed.year}-${parsed.size}`;
        if (!grouped.has(key)) grouped.set(key, new Set());
        grouped.get(key).add(parsed.sequence);
    }

    const missingEntries = [];

    for (const [key, sequenceSet] of grouped.entries()) {
        const [year, size] = key.split('-');
        const sorted = Array.from(sequenceSet).sort((a, b) => a - b);
        if (sorted.length < 2) continue;

        for (let idx = 1; idx < sorted.length; idx += 1) {
            const prev = sorted[idx - 1];
            const curr = sorted[idx];
            if (curr <= prev + 1) continue;

            for (let seq = prev + 1; seq < curr; seq += 1) {
                missingEntries.push({
                    barcode: buildBarcode(year, size, seq),
                    year,
                    size,
                    sequence: seq
                });
            }
        }
    }

    let created = 0;
    let refreshed = 0;

    for (const missing of missingEntries) {
        const existing = await MissedScan.findOne({ barcode: missing.barcode });

        if (!existing) {
            await MissedScan.create({
                ...missing,
                status: 'PENDING',
                issueType: 'SEQUENCE_MISSING',
                detectedAt: new Date(),
                resolutionAction: 'NONE',
                resolutionNote: `Detected by sequence audit (${triggeredBy})`
            });
            created += 1;
            continue;
        }

        if (['PENDING'].includes(existing.status)) {
            existing.issueType = 'SEQUENCE_MISSING';
            existing.detectedAt = new Date();
            existing.resolutionNote = `Detected by sequence audit (${triggeredBy})`;
            await existing.save();
            refreshed += 1;
        }
    }

    return {
        groupsScanned: grouped.size,
        missingDetected: missingEntries.length,
        created,
        refreshed
    };
}

module.exports = {
    detectMissingSequences,
    parseBarcode,
    buildBarcode
};
