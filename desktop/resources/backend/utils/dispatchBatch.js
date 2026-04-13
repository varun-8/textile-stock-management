const Session = require('../models/Session');
const ClothRoll = require('../models/ClothRoll');
const DeliveryChallan = require('../models/DeliveryChallan');

async function getSessionDispatchRollIds(sessionId) {
    const session = await Session.findById(sessionId).select('dispatchRolls type').lean();
    if (!session) {
        return [];
    }

    if (Array.isArray(session.dispatchRolls) && session.dispatchRolls.length > 0) {
        return session.dispatchRolls.map((id) => String(id));
    }

    const linkedDc = await DeliveryChallan.findOne({ sourceBatchId: sessionId }).select('_id').lean();
    if (linkedDc) {
        const rolls = await ClothRoll.find({ dcId: linkedDc._id }).select('_id').lean();
        return rolls.map((roll) => String(roll._id));
    }

    const legacyRolls = await ClothRoll.find({
        'transactionHistory.sessionId': sessionId,
        status: 'RESERVED'
    }).select('_id').lean();

    return legacyRolls.map((roll) => String(roll._id));
}

async function getSessionDispatchRollDocs(sessionId) {
    const session = await Session.findById(sessionId).select('dispatchRolls').lean();
    if (!session) {
        return [];
    }

    let rollIds = Array.isArray(session.dispatchRolls) && session.dispatchRolls.length > 0
        ? session.dispatchRolls.map((id) => String(id))
        : [];

    if (rollIds.length === 0) {
        const linkedDc = await DeliveryChallan.findOne({ sourceBatchId: sessionId }).select('_id').lean();
        if (linkedDc) {
            const dcRolls = await ClothRoll.find({ dcId: linkedDc._id })
                .select('barcode metre weight pieces dcId status transactionHistory')
                .lean();
            return dcRolls;
        }

        const legacyRolls = await ClothRoll.find({
            'transactionHistory.sessionId': sessionId,
            status: 'RESERVED'
        })
            .select('barcode metre weight pieces dcId status transactionHistory')
            .lean();
        return legacyRolls;
    }

    const rollDocs = await ClothRoll.find({ _id: { $in: rollIds } })
        .select('barcode metre weight pieces dcId status transactionHistory')
        .lean();
    const byId = new Map(rollDocs.map((roll) => [String(roll._id), roll]));

    return rollIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
}

function calculateDispatchTotals(rolls, appliedPercentage = 0) {
    const safePct = Number(appliedPercentage) || 0;
    const factor = 1 + safePct / 100;

    const totalMetre = (Array.isArray(rolls) ? rolls : []).reduce((sum, roll) => {
        return sum + (Number(roll?.metre) || 0);
    }, 0);

    return {
        totalRolls: Array.isArray(rolls) ? rolls.length : 0,
        totalMetre: Number((totalMetre * factor).toFixed(2))
    };
}

async function syncDeliveryChallanFromSession(sessionId) {
    const dc = await DeliveryChallan.findOne({ sourceBatchId: sessionId });
    if (!dc) {
        return null;
    }

    const rolls = await getSessionDispatchRollDocs(sessionId);
    const totals = calculateDispatchTotals(rolls, dc.appliedPercentage || 0);

    dc.rolls = rolls.map((roll) => roll._id);
    dc.totalRolls = totals.totalRolls;
    dc.totalMetre = totals.totalMetre;
    dc.status = dc.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE';
    await dc.save();

    return DeliveryChallan.findById(dc._id).populate('rolls');
}

module.exports = {
    calculateDispatchTotals,
    getSessionDispatchRollDocs,
    getSessionDispatchRollIds,
    syncDeliveryChallanFromSession
};
