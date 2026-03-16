const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const ClothRoll = require('../models/ClothRoll');
const Barcode = require('../models/Barcode');
const ExcelJS = require('exceljs');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get Active Sessions
router.get('/active', async (req, res) => {
    try {
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

        const session = new Session({
            type,
            targetSize: normalizedTargetSize,
            createdBy: createdBy || 'Admin',
            status: 'ACTIVE',
            activeScanners: [] // Initialize as empty - scanners join explicitly
        });

        await session.save();

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
        worksheet.addRow(['Batch ID', session._id.toString()]);
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
        res.setHeader('Content-Disposition', `attachment; filename=summary_${session.targetSize}_${id}.xlsx`);

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

        worksheet.columns = [
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'Original Metre', key: 'original_metre', width: 15 },
            { header: 'Percentage Applied', key: 'percentage_applied', width: 20 },
            { header: 'Additional Metre', key: 'additional_metre', width: 20 },
            { header: 'Final Metre', key: 'final_metre', width: 15 },
        ];

        let totalFinalMetre = 0;

        items.forEach(item => {
            const txs = item.transactionHistory.filter(t => String(t.sessionId) === String(session._id));
            if (txs.length > 0) {
                const originalMetre = parseFloat(item.metre) || 0;
                const additionalMetre = originalMetre * (percentage / 100);
                const finalMetre = originalMetre + additionalMetre;

                totalFinalMetre += finalMetre;

                worksheet.addRow({
                    barcode: item.barcode,
                    original_metre: originalMetre.toFixed(2),
                    percentage_applied: percentage + '%',
                    additional_metre: additionalMetre.toFixed(2),
                    final_metre: finalMetre.toFixed(2)
                });
            }
        });

        // Add blank row
        worksheet.addRow([]);
        // Add total row
        worksheet.addRow({
            barcode: 'Total Metre',
            original_metre: '',
            percentage_applied: '',
            additional_metre: '',
            final_metre: totalFinalMetre.toFixed(2)
        }).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${dcNumber}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating DC report');
    }
});

module.exports = router;
