function roundLength(value) {
    return Math.round(value * 1000) / 1000;
}

function normalizePieces(rawPieces, fallbackMetre) {
    if (Array.isArray(rawPieces) && rawPieces.length > 0) {
        const normalized = rawPieces
            .map((piece, index) => {
                const rawLength = typeof piece === 'number' ? piece : piece?.length;
                const length = Number(rawLength);
                const label = typeof piece === 'number' ? `Piece ${index + 1}` : (piece?.label || `Piece ${index + 1}`);

                if (!Number.isFinite(length) || length <= 0) {
                    return null;
                }

                return {
                    length: roundLength(length),
                    label
                };
            })
            .filter(Boolean);

        if (normalized.length > 0) {
            return normalized;
        }
    }

    const metre = Number(fallbackMetre);
    if (Number.isFinite(metre) && metre > 0) {
        return [{ length: roundLength(metre), label: 'Piece 1' }];
    }

    return [];
}

function totalFromPieces(pieces) {
    return roundLength(
        (Array.isArray(pieces) ? pieces : []).reduce((sum, piece) => sum + Number(piece.length || 0), 0)
    );
}

module.exports = {
    normalizePieces,
    totalFromPieces
};
