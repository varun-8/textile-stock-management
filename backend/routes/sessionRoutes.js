const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const DeliveryChallan = require('../models/DeliveryChallan');
const ExcelJS = require('exceljs');
const { detectMissingSequences } = require('../utils/missingSequenceService');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDeliveryMetre(value) {
    const numericValue = Number(value) || 0;
    return numericValue.toFixed(2).replace('.', '-');
}

function getBatchPrefix(type) {
    return type === 'IN' ? 'BI' : 'BD';
}

function parseSequenceFromBatchCode(batchCode) {
    if (!batchCode || typeof batchCode !== 'string') return 0;
    const parts = batchCode.split('-');
    if (parts.length !== 3) return 0;
    const seq = parseInt(parts[2], 10);
    return Number.isFinite(seq) ? seq : 0;
}

async function backfillMissingBatchCodes() {
    const missingSessions = await Session.find({
        $or: [{ batchCode: { $exists: false } }, { batchCode: null }]
    }).sort({ createdAt: 1 });

    if (missingSessions.length === 0) {
        return;
    }

    const existingSessions = await Session.find({
        batchCode: { $exists: true, $ne: null }
    }).select('type batchYear batchSequence batchCode createdAt').lean();

    const keyToMaxSequence = new Map();

    for (const row of existingSessions) {
        const yy = Number.isFinite(row.batchYear)
            ? row.batchYear
            : (new Date(row.createdAt).getFullYear() % 100);
        const key = `${row.type}-${String(yy).padStart(2, '0')}`;
        const sequence = Number.isFinite(row.batchSequence)
            ? row.batchSequence
            : parseSequenceFromBatchCode(row.batchCode);
        const currentMax = keyToMaxSequence.get(key) || 0;
        if (sequence > currentMax) {
            keyToMaxSequence.set(key, sequence);
        }
    }

    const updates = [];
    for (const session of missingSessions) {
        const yy = new Date(session.createdAt).getFullYear() % 100;
        const yyText = String(yy).padStart(2, '0');
        const key = `${session.type}-${yyText}`;
        const nextSequence = (keyToMaxSequence.get(key) || 0) + 1;
        keyToMaxSequence.set(key, nextSequence);

        const batchCode = `${getBatchPrefix(session.type)}-${yyText}-${String(nextSequence).padStart(3, '0')}`;
        updates.push({
            updateOne: {
                filter: { _id: session._id },
                update: {
                    $set: {
                        batchCode,
                        batchYear: yy,
                        batchSequence: nextSequence
                    }
                }
            }
        });
    }

    if (updates.length > 0) {
        await Session.bulkWrite(updates, { ordered: true });
    }
}

async function createSessionWithBatchCode({ type, targetSize, createdBy }) {
    const prefix = getBatchPrefix(type);
    const year = new Date().getFullYear() % 100;
    const yearText = String(year).padStart(2, '0');
    const regex = new RegExp(`^${prefix}-${yearText}-\\d{3}$`);

    const latestSession = await Session.findOne({ batchCode: regex }).sort({ batchSequence: -1, createdAt: -1 });
    const nextSequence = (latestSession?.batchSequence || 0) + 1;
    const batchCode = `${prefix}-${yearText}-${String(nextSequence).padStart(3, '0')}`;

    const session = new Session({
        batchCode,
        batchYear: year,
        batchSequence: nextSequence,
        type,
        targetSize,
        createdBy,
        status: 'ACTIVE',
        activeScanners: []
    });

    await session.save();
    return session;
}

// Get Active Sessions
router.get('/active', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        const Session = require('../models/Session');
        const Scanner = require('../models/Scanner');

        // 1. Fetch active sessions
        let sessions = await Session.find({ status: 'ACTIVE' }).sort({ createdAt: -1 });

        // 2. Cleanup stale scanners (lazy cleanup on read)
        const TWO_MINUTES_AGO = new Date(Date.now() - 2 * 60 * 1000);

        // Parallel cleanups for all sessions
        await Promise.all(sessions.map(async (session) => {
            if (session.activeScanners && session.activeScanners.length > 0) {
                // Find scanners that are still "alive" (seen recently)
                const activeScanners = await Scanner.find({
                    uuid: { $in: session.activeScanners },
                    lastSeen: { $gte: TWO_MINUTES_AGO }
                }).select('uuid');

                const activeScannerIds = activeScanners.map(s => s.uuid);

                // If count changed, update the session
                if (activeScannerIds.length !== session.activeScanners.length) {
                    session.activeScanners = activeScannerIds;
                    await session.save();
                }
            }
        }));

        // 3. Re-fetch or use updated sessions (documents are updated in memory by save())
        // Continue with population logic...

        // Populate scanned count for each session
        const sessionsWithCount = await Promise.all(sessions.map(async (session) => {
            const scannedCount = await ClothRoll.countDocuments({
                "transactionHistory.sessionId": session._id
            });
            return {
                ...session.toObject(),
                scannedCount
            };
        }));

        res.json(sessionsWithCount);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Session History with Date Filter
router.get('/history', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        const { date, type } = req.query;
        let query = { status: 'COMPLETED' };

        if (type && ['IN', 'OUT'].includes(type)) {
            query.type = type;
        }

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            query.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        // If no date, limit to last 50. If date, show all for that day.
        const sessions = await Session.find(query).sort({ endedAt: -1 }).limit(date ? 0 : 50);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create New Session
router.post('/create', async (req, res) => {
    try {
        const { type, targetSize, createdBy } = req.body;
        const normalizedTargetSize = String(targetSize || '').trim();

        if (!type || !normalizedTargetSize) {
            return res.status(400).json({ error: 'Type and Pick Density (PPI) are required' });
        }

        if (!['IN', 'OUT'].includes(type)) {
            return res.status(400).json({ error: 'Invalid Session Type' });
        }

        if (type === 'IN') {
            const generatedBarcodeCount = await Barcode.countDocuments({ size: normalizedTargetSize });

            if (generatedBarcodeCount === 0) {
                return res.status(400).json({
                    error: `Cannot start Stock In for Pick Density ${normalizedTargetSize}. Generate barcodes for this pick density first.`
                });
            }
        }

        if (type === 'OUT') {
            const sizeRegex = new RegExp(`-${escapeRegex(normalizedTargetSize)}-`);
            const inStockCount = await ClothRoll.countDocuments({
                barcode: { $regex: sizeRegex },
                status: 'IN'
            });

            if (inStockCount === 0) {
                return res.status(400).json({
                    error: `Cannot start Stock Out for Pick Density ${normalizedTargetSize}. No in-stock rolls are available for this pick density.`
                });
            }
        }

        // Check if there is already an active session for this size/type?
        // Requirement says "multiple sessions can be created either for stock in or out"
        // So we allow multiple.

        let session = null;
        let lastError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                session = await createSessionWithBatchCode({
                    type,
                    targetSize: normalizedTargetSize,
                    createdBy: createdBy || 'Admin'
                });
                break;
            } catch (err) {
                lastError = err;
                // Retry only on duplicate batchCode under concurrent creation.
                if (err?.code !== 11000) {
                    throw err;
                }
            }
        }

        if (!session) {
            throw lastError || new Error('Failed to generate unique batch code');
        }

        if (req.io) {
            req.io.emit('session_update', { action: 'CREATED', session });
        }

        res.json({ success: true, session });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join Session (PWA Scanner)
router.post('/join', async (req, res) => {
    try {
        const { sessionId, scannerId } = req.body;
        const headerScannerId = req.headers['x-scanner-id'];
        const effectiveScannerId = scannerId || headerScannerId;
        console.log('📥 Join request received:', { sessionId, scannerId, headerScannerId, effectiveScannerId });

        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (session.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Batch is not active' });
        }

        if (effectiveScannerId) {
            // CRITICAL FIX: Ensure scanner is removed from ALL other active sessions first
            // This prevents "double counting" when switching sessions immediately
            await Session.updateMany(
                {
                    status: 'ACTIVE',
                    activeScanners: effectiveScannerId,
                    _id: { $ne: sessionId } // Don't remove from target if already there (handled below)
                },
                { $pull: { activeScanners: effectiveScannerId } }
            );

            // Add scanner to active list if not present
            if (!session.activeScanners.includes(effectiveScannerId)) {
                session.activeScanners.push(effectiveScannerId);
                await session.save();
                console.log('✅ Added scanner to session:', effectiveScannerId);
            }

            // UPDATE LAST SEEN to prevent immediate cleanup
            const Scanner = require('../models/Scanner');
            await Scanner.findOneAndUpdate(
                { uuid: effectiveScannerId },
                { lastSeen: new Date() }
            );

            // REAL-TIME UPDATE
            if (req.io) {
                const updatedSession = await Session.findById(sessionId); // Get fresh data
                req.io.emit('session_update', { action: 'UPDATE', session: updatedSession });
            }
        }

        res.json({ success: true, session });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Leave Session (PWA Scanner)
router.post('/:id/leave', async (req, res) => {
    try {
        const { id } = req.params;
        const { scannerId } = req.body;
        const headerScannerId = req.headers['x-scanner-id'];
        const effectiveScannerId = scannerId || headerScannerId;
        console.log('📤 Leave request received:', { id, scannerId, headerScannerId, effectiveScannerId });

        const session = await Session.findById(id);
        if (!session) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Remove scanner from active list
        if (effectiveScannerId && session.activeScanners.includes(effectiveScannerId)) {
            session.activeScanners = session.activeScanners.filter(id => id !== effectiveScannerId);
            await session.save();
            console.log('✅ Scanner removed from session:', effectiveScannerId);
        } else if (session.activeScanners.length === 1) {
            // Fallback: If only 1 scanner is there, assume it's the one leaving (Fixes ghost ids)
            const removed = session.activeScanners[0];
            session.activeScanners = [];
            await session.save();
            console.log('✅ Fallback removed sole scanner (ID Mismatch or Missing):', removed);
        } else {
            console.log('ℹ️ No scanner removed:', { effectiveScannerId, current: session.activeScanners });
        }

        if (req.io) {
            const updatedSession = await Session.findById(id);
            req.io.emit('session_update', { action: 'UPDATE', session: updatedSession });
        }

        res.json({ success: true, session });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Session Summary Preview (Before Ending)
router.get('/:id/preview', async (req, res) => {
    try {
        const { id } = req.params;
        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ error: 'Batch not found' });

        // Aggregate stats based on sessionId in transactionHistory
        const stats = await ClothRoll.aggregate([
            { $unwind: "$transactionHistory" },
            { $match: { "transactionHistory.sessionId": session._id } },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalMetre: { $sum: "$metre" },
                    totalWeight: { $sum: "$weight" }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : { totalCount: 0, totalMetre: 0, totalWeight: 0 };

        // Fetch detailed items for this session
        const items = await ClothRoll.find({ "transactionHistory.sessionId": session._id })
            .select('barcode metre weight percentage pieces transactionHistory')
            .lean();

        // Process items to show relevant details (e.g. time of scan)
        const detailedItems = items.map(item => {
            const tx = item.transactionHistory.find(t => String(t.sessionId) === String(session._id));
            return {
                _id: item._id,
                barcode: item.barcode,
                metre: item.metre,
                weight: item.weight,
                percentage: item.percentage,
                pieces: item.pieces || [],
                scannedAt: tx ? tx.date : null,
                scannedBy: tx ? tx.employeeName : 'Unknown'
            };
        }).sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

        res.json({ success: true, stats: result, items: detailedItems });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// End Session
router.post('/end', async (req, res) => {
    try {
        const { sessionId, source } = req.body;
        const initiator = source || 'desktop'; // Default to desktop if not specified
        
        console.log('📊 END SESSION REQUEST:', { sessionId, source, initiator });

        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Calculate Final Stats
        const stats = await ClothRoll.aggregate([
            { $unwind: "$transactionHistory" },
            { $match: { "transactionHistory.sessionId": session._id } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalMetre: { $sum: "$metre" },
                    totalWeight: { $sum: "$weight" }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : { count: 0, totalMetre: 0, totalWeight: 0 };

        session.status = 'COMPLETED';
        session.endedAt = new Date();
        session.totalItems = result.count;
        session.totalMetre = result.totalMetre;
        session.totalWeight = result.totalWeight;

        await session.save();

        // Run sequence-gap detection after batch completion.
        await detectMissingSequences({ triggeredBy: 'batch-completed' });

        if (req.io) {
            console.log('🔔 EMITTING SOCKET EVENT:', { action: 'ENDED', sessionId, initiator });
            req.io.emit('session_update', { action: 'ENDED', sessionId, initiator });
        }

        res.json({ success: true, message: 'Batch Ended', stats: result, initiator });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export Detailed Report
router.get('/:id/export/details', async (req, res) => {
    try {
        const { id } = req.params;
        const session = await Session.findById(id);
        if (!session) return res.status(404).send('Batch not found');

        // Fetch items linked to this session
        // Note: We need to match specific transactions to get the state AT THAT TIME ideally,
        // but current state + filters is often enough. For accuracy, we look at transactionHistory.
        const items = await ClothRoll.find({
            "transactionHistory.sessionId": session._id
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Batch Details');

        worksheet.columns = [
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Metre', key: 'metre', width: 10 },
            { header: 'Weight', key: 'weight', width: 10 },
            { header: 'Quality %', key: 'percentage', width: 10 },
            { header: 'Scanned By', key: 'user', width: 20 },
            { header: 'Scanned At', key: 'time', width: 20 }
        ];

        items.forEach(item => {
            // Find the relevant transaction(s)
            const txs = item.transactionHistory.filter(t => String(t.sessionId) === String(session._id));
            txs.forEach(tx => {
                worksheet.addRow({
                    barcode: item.barcode,
                    type: tx.status || session.type, // Fallback to session type if tx status missing
                    size: session.targetSize, // Assuming session target size is the item size
                    metre: item.metre,
                    weight: item.weight,
                    percentage: item.percentage,
                    user: tx.employeeName || 'Unknown',
                    time: tx.date ? new Date(tx.date).toLocaleString() : ''
                });
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=session_${session.targetSize}_${id}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating report');
    }
});

// Export Summary Report
router.get('/:id/export/summary', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        const { id } = req.params;
        const session = await Session.findById(id);
        if (!session) return res.status(404).send('Batch not found');

        const stats = await ClothRoll.aggregate([
            { $unwind: "$transactionHistory" },
            { $match: { "transactionHistory.sessionId": session._id } },
            {
                $group: {
                    _id: "$transactionHistory.employeeName",
                    count: { $sum: 1 },
                    totalMetre: { $sum: "$metre" },
                    totalWeight: { $sum: "$weight" }
                }
            }
        ]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Batch Summary');

        // Session Info Header
        worksheet.addRow(['Batch ID', session.batchCode || session._id.toString()]);
        worksheet.addRow(['Type', session.type]);
        worksheet.addRow(['Pick Density (PPI)', session.targetSize]);
        worksheet.addRow(['Start Time', session.createdAt.toLocaleString()]);
        worksheet.addRow(['End Time', session.endedAt ? session.endedAt.toLocaleString() : 'Active']);
        worksheet.addRow([]); // Spacer

        worksheet.addRow(['Employee', 'Total Items', 'Total Metre', 'Total Weight']).font = { bold: true };

        let grandCount = 0;
        let grandMetre = 0;
        let grandWeight = 0;

        stats.forEach(stat => {
            worksheet.addRow([
                stat._id || 'Unknown',
                stat.count,
                stat.totalMetre.toFixed(2),
                stat.totalWeight.toFixed(2)
            ]);
            grandCount += stat.count;
            grandMetre += stat.totalMetre;
            grandWeight += stat.totalWeight;
        });

        worksheet.addRow([]);
        worksheet.addRow(['GRAND TOTAL', grandCount, grandMetre.toFixed(2), grandWeight.toFixed(2)]).font = { bold: true, color: { argb: 'FF0000FF' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const summaryFileBatch = session.batchCode || id;
        res.setHeader('Content-Disposition', `attachment; filename=summary_${session.targetSize}_${summaryFileBatch}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating report');
    }
});

// Get Session Summary Data (JSON)
router.get('/:id/summary', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        const { id } = req.params;
        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ error: 'Batch not found' });

        const stats = await ClothRoll.aggregate([
            { $unwind: "$transactionHistory" },
            { $match: { "transactionHistory.sessionId": session._id } },
            {
                $group: {
                    _id: "$transactionHistory.employeeName",
                    count: { $sum: 1 },
                    totalMetre: { $sum: "$metre" },
                    totalWeight: { $sum: "$weight" }
                }
            }
        ]);

        // Fetch detailed items for this session
        const items = await ClothRoll.find({ "transactionHistory.sessionId": session._id })
            .select('barcode metre weight percentage pieces transactionHistory')
            .lean();

        // Process items to show relevant details
        const detailedItems = items.map(item => {
            const tx = item.transactionHistory.find(t => String(t.sessionId) === String(session._id));
            return {
                _id: item._id,
                barcode: item.barcode,
                metre: item.metre,
                weight: item.weight,
                percentage: item.percentage,
                pieces: item.pieces || [],
                scannedAt: tx ? tx.date : null,
                scannedBy: tx ? tx.employeeName : 'Unknown'
            };
        }).sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

        res.json({ success: true, session, stats, items: detailedItems });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export Download DC Report
router.get('/:id/export/dc', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        const { id } = req.params;
        const percentageStr = req.query.percentage;
        const dcNumber = req.query.dcNumber || `dc_report_${id}`;
        
        const parsedPercentage = parseFloat(percentageStr);
        const percentage = isNaN(parsedPercentage) ? 0 : parsedPercentage;

        const session = await Session.findById(id);
        if (!session) return res.status(404).send('Batch not found');

        const items = await ClothRoll.find({
            "transactionHistory.sessionId": session._id
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Download DC');
        const exportedRolls = items
            .filter(item => item.transactionHistory.some(t => String(t.sessionId) === String(session._id)))
            .map(item => {
                const validPieces = Array.isArray(item.pieces) && item.pieces.length > 0
                    ? item.pieces
                        .map((piece) => Number(typeof piece === 'number' ? piece : piece?.length))
                        .filter(length => Number.isFinite(length) && length > 0)
                    : [];

                const sourcePieces = validPieces.length > 0 ? validPieces : [Number(item.metre) || 0];
                const adjustedPieces = sourcePieces.map(pieceLength => pieceLength * (1 + (percentage / 100)));
                const totalMetre = adjustedPieces.reduce((sum, pieceLength) => sum + pieceLength, 0);

                return {
                    barcode: item.barcode,
                    pieces: adjustedPieces,
                    totalMetre
                };
            });

        const totalPieces = exportedRolls.reduce((sum, roll) => sum + roll.pieces.length, 0);
        const totalRolls = exportedRolls.length;
        const grandTotalMetre = exportedRolls.reduce((sum, roll) => sum + roll.totalMetre, 0);
        const rollsPerBlock = Math.max(1, Math.min(6, exportedRolls.length || 1));

        const setBoxBorder = (rowNumber, colNumber) => {
            const cell = worksheet.getCell(rowNumber, colNumber);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            return cell;
        };

        worksheet.getColumn(1).width = 8;
        for (let col = 2; col <= rollsPerBlock + 1; col++) {
            worksheet.getColumn(col).width = 14;
        }
        worksheet.getColumn(rollsPerBlock + 2).width = 14;

        worksheet.mergeCells(1, 1, 1, rollsPerBlock + 2);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.value = 'DELIVERY NOTE';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.getCell('A2').value = 'DC No.';
        worksheet.getCell('B2').value = dcNumber;
        worksheet.getCell(2, rollsPerBlock + 1).value = 'Date';
        worksheet.getCell(2, rollsPerBlock + 2).value = new Date().toLocaleDateString('en-GB');

        worksheet.getCell('A3').value = 'Batch ID';
        worksheet.getCell('B3').value = session.batchCode || session._id.toString();
        worksheet.getCell(3, rollsPerBlock + 1).value = 'Type';
        worksheet.getCell(3, rollsPerBlock + 2).value = session.type;

        worksheet.getCell('A4').value = 'Pick Density';
        worksheet.getCell('B4').value = session.targetSize;
        worksheet.getCell(4, rollsPerBlock + 1).value = 'Applied %';
        worksheet.getCell(4, rollsPerBlock + 2).value = `${percentage}%`;

        worksheet.getRow(6).values = ['S.No'];
        for (let col = 2; col <= rollsPerBlock + 1; col++) {
            worksheet.getCell(6, col).value = '';
        }
        worksheet.getCell(6, rollsPerBlock + 2).value = 'TOTAL';

        let currentRow = 7;
        let rollCounter = 1;

        for (let startIndex = 0; startIndex < exportedRolls.length; startIndex += rollsPerBlock) {
            const block = exportedRolls.slice(startIndex, startIndex + rollsPerBlock);
            const maxPieces = Math.max(...block.map(roll => roll.pieces.length), 1);
            const blockBodyRows = Math.max(maxPieces, block.length);

            block.forEach((roll, index) => {
                worksheet.getCell(currentRow, index + 2).value = roll.barcode;
            });
            worksheet.getCell(currentRow, rollsPerBlock + 2).value = 'TOTAL';

            for (let pieceIndex = 0; pieceIndex < maxPieces; pieceIndex++) {
                const rowNumber = currentRow + 1 + pieceIndex;
                worksheet.getCell(rowNumber, 1).value = `${pieceIndex + 1}.`;

                block.forEach((roll, index) => {
                    const pieceValue = roll.pieces[pieceIndex];
                    worksheet.getCell(rowNumber, index + 2).value = pieceValue ? formatDeliveryMetre(pieceValue) : '';
                });
            }

            const totalRowNumber = currentRow + 1 + blockBodyRows;
            worksheet.getCell(totalRowNumber, 1).value = '';
            block.forEach((roll, index) => {
                worksheet.getCell(totalRowNumber, index + 2).value = formatDeliveryMetre(roll.totalMetre);
            });

            block.forEach((roll, index) => {
                worksheet.getCell(currentRow + index + 1, rollsPerBlock + 2).value = `${rollCounter} ${formatDeliveryMetre(roll.totalMetre)}`;
                rollCounter += 1;
            });

            for (let row = currentRow; row <= totalRowNumber; row++) {
                for (let col = 1; col <= rollsPerBlock + 2; col++) {
                    setBoxBorder(row, col);
                    worksheet.getCell(row, col).alignment = { horizontal: 'center', vertical: 'middle' };
                    worksheet.getCell(row, col).font = { size: 11 };
                }
            }

            currentRow = totalRowNumber + 2;
        }

        worksheet.getCell(currentRow, 1).value = 'Total Metres';
        worksheet.getCell(currentRow, 2).value = formatDeliveryMetre(grandTotalMetre);
        worksheet.getCell(currentRow + 1, 1).value = 'Total Pieces';
        worksheet.getCell(currentRow + 1, 2).value = totalPieces;
        worksheet.getCell(currentRow + 2, 1).value = 'Total Roll';
        worksheet.getCell(currentRow + 2, 2).value = totalRolls;
        worksheet.getCell(currentRow, rollsPerBlock + 2).value = formatDeliveryMetre(grandTotalMetre);

        for (let row = currentRow; row <= currentRow + 2; row++) {
            for (let col = 1; col <= 2; col++) {
                setBoxBorder(row, col);
            }
        }
        setBoxBorder(currentRow, rollsPerBlock + 2);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${dcNumber}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating DC report');
    }
});

// Get eligible OUT-type completed batches for one-time DC generation
router.get('/batch/active-out/list', async (req, res) => {
    try {
        await backfillMissingBatchCodes();
        
        // Only fully completed OUT batches are eligible.
        const outBatches = await Session.find({ 
            status: 'COMPLETED',
            type: 'OUT'
        }).sort({ createdAt: -1 }).lean();

        const existingBatchDcs = await DeliveryChallan.find({
            sourceBatchId: { $in: outBatches.map(b => b._id) }
        }).select('sourceBatchId').lean();

        const usedBatchIds = new Set(existingBatchDcs.map(row => String(row.sourceBatchId)));
        const candidateBatches = outBatches.filter(batch => !usedBatchIds.has(String(batch._id)));

        // For each batch, get rolls and calculate totals
        const batchesWithRolls = await Promise.all(candidateBatches.map(async (batch) => {
            const rolls = await ClothRoll.find({
                "transactionHistory.sessionId": batch._id
            }).lean();

            const hasHistoricalDcForBatch = rolls.some((roll) =>
                (roll.transactionHistory || []).some((tx) =>
                    typeof tx.details === 'string' && tx.details.includes('Dispatched via DC-')
                )
            );

            // Show only rolls that are not already assigned to another DC.
            const usableRolls = rolls.filter(r => !r.dcId);

            const totalRolls = usableRolls.length;
            const totalMetre = usableRolls.reduce((sum, roll) => sum + (Number(roll.metre) || 0), 0);
            const totalPieces = usableRolls.reduce((sum, roll) => {
                const pieceLengths = Array.isArray(roll.pieces)
                    ? roll.pieces
                        .map((piece) => Number(typeof piece === 'number' ? piece : piece?.length))
                        .filter((length) => Number.isFinite(length) && length > 0)
                    : [];

                if (pieceLengths.length > 0) {
                    return sum + pieceLengths.length;
                }

                return sum + ((Number(roll.metre) || 0) > 0 ? 1 : 0);
            }, 0);

            return {
                _id: batch._id,
                batchCode: batch.batchCode,
                type: batch.type,
                targetSize: batch.targetSize,
                createdAt: batch.createdAt,
                hasHistoricalDcForBatch,
                totalRolls,
                totalMetre: totalMetre.toFixed(2),
                totalPieces,
                rollCount: usableRolls.length,
                rolls: usableRolls.map(r => ({
                    _id: r._id,
                    barcode: r.barcode,
                    metre: r.metre,
                    pieces: r.pieces || []
                }))
            };
        }));

        const eligibleBatches = batchesWithRolls.filter(batch => batch.rollCount > 0 && !batch.hasHistoricalDcForBatch);

        res.json(eligibleBatches);
    } catch (err) {
        console.error('Error fetching OUT batches:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
