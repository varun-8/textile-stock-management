import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEFAULT_TEMPLATE = {
    layoutMode: 'printed',
    companyName: '',
    subTitle: '',
    documentTitle: 'DELIVERY NOTE',
    gstin: '',
    address: '',
    phoneText: '',
    tableHeaderColor: '#1a5c1a',
    showPartyAddress: true,
    showQuality: true,
    showFolding: true,
    showLotNo: true,
    showBillNo: true,
    showBillPreparedBy: true,
    showVehicle: true,
    showDriver: true,
    logoDataUrl: '',
    logoDataUrl2: '',
    companyNameSize: 16,
    subTitleSize: 8,
    addressSize: 7.5,
    detailFontSize: 9,
    detailLineHeight: 4.4,
    footerFontSize: 9,
    signatoryFontSize: 8
};

function hexToRgb(hex) {
    const input = String(hex || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(input)) {
        return [30, 41, 59];
    }
    return [
        parseInt(input.slice(1, 3), 16),
        parseInt(input.slice(3, 5), 16),
        parseInt(input.slice(5, 7), 16)
    ];
}

function normalizeTemplate(templateConfig, dcData) {
    const safe = { ...DEFAULT_TEMPLATE };
    if (templateConfig && typeof templateConfig === 'object') {
        Object.assign(safe, templateConfig);
    } else if (typeof templateConfig === 'string') {
        safe.companyName = templateConfig;
    }

    if (dcData && dcData.companyName && !safe.companyName) {
        safe.companyName = dcData.companyName;
    }

    safe.showVehicle = safe.showVehicle !== false;
    safe.showDriver = safe.showDriver !== false;
    safe.showPartyAddress = safe.showPartyAddress !== false;
    safe.showQuality = safe.showQuality !== false;
    safe.showFolding = safe.showFolding !== false;
    safe.showLotNo = safe.showLotNo !== false;
    safe.showBillNo = safe.showBillNo !== false;
    safe.showBillPreparedBy = safe.showBillPreparedBy !== false;
    safe.layoutMode = safe.layoutMode === 'printed' ? 'printed' : 'modern';
    return safe;
}

function renderPrintedHeaderScaffold(doc, template, documentMeta = {}) {
    const inkRgb = hexToRgb(template.tableHeaderColor || '#1a5c1a');
    const [iR, iG, iB] = inkRgb;
    const setInk = () => {
        doc.setDrawColor(iR, iG, iB);
        doc.setTextColor(iR, iG, iB);
    };

    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const mL = 8;
    const mR = 8;
    const mT = 8;
    const UW = PW - mL - mR;
    const cx = PW / 2;
    const PT = 0.353;

    setInk();
    doc.setLineWidth(0.6);
    doc.rect(mL, mT, UW, PH - mT - 8);

    let curY = mT + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (template.gstin) {
        doc.text(`GSTIN : ${template.gstin}`, mL + 2, curY);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(template.documentTitle || 'DELIVERY NOTE', cx, curY, { align: 'center' });
    if (template.phoneText) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Ph: ${template.phoneText}`, PW - mR - 2, curY, { align: 'right' });
    }

    curY += 3;
    const cNameSz = parseFloat(template.companyNameSize) || 16;
    const subSz = parseFloat(template.subTitleSize) || 8;
    const addrSz = parseFloat(template.addressSize) || 7.5;
    const addrMaxW = UW * 0.54;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(addrSz);
    const addrLines = template.address ? doc.splitTextToSize(template.address, addrMaxW) : [];
    const addrLineH = addrSz * PT + 0.4;
    const contentH = 0.5 + cNameSz * PT + (template.subTitle ? subSz * PT + 1.5 : 0)
        + (addrLines.length > 0 ? addrSz * PT + 1.5 + (addrLines.length - 1) * addrLineH : 0) + 0.5;
    const textExtraH = 6;
    const containerH = Math.max(contentH + textExtraH, 22);
    const containerY = curY;

    doc.setLineWidth(0.4);
    doc.rect(mL, containerY, UW, containerH);

    const textLeft = cx - addrMaxW / 2;
    const textRight = cx + addrMaxW / 2;
    const logoSz = Math.min(containerH - textExtraH - 2, 26);
    const logoY = containerY + (containerH - textExtraH - logoSz) / 2 + 1;
    const logoGap = 3;

    const leftLogo = String(template.logoDataUrl || '');
    if (leftLogo.startsWith('data:image/')) {
        try {
            doc.addImage(leftLogo, leftLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG', textLeft - logoGap - logoSz, logoY, logoSz, logoSz);
        } catch (error) {
            console.debug('Skipping invalid left logo image:', error);
        }
    }

    const rightLogo = String(template.logoDataUrl2 || '');
    if (rightLogo.startsWith('data:image/')) {
        try {
            doc.addImage(rightLogo, rightLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG', textRight + logoGap, logoY, logoSz, logoSz);
        } catch (error) {
            console.debug('Skipping invalid right logo image:', error);
        }
    }

    const numberLabel = documentMeta.numberLabel || 'DC No.';
    const numberValue = documentMeta.numberValue || '__________';
    const numberValueOffset = Number.isFinite(documentMeta.numberValueOffset)
        ? documentMeta.numberValueOffset
        : 11;
    const dateLabel = documentMeta.dateLabel || 'Date';
    const rawDate = documentMeta.dateValue;
    const dateStr = rawDate
        ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '___________';

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${numberLabel} `, mL + 2, containerY + containerH - 2);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${numberValue}`, mL + 2 + numberValueOffset, containerY + containerH - 2);
    doc.setFont('helvetica', 'bold');
    doc.text(`${dateLabel} `, PW - mR - 30, containerY + containerH - 2);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${dateStr}`, PW - mR - 22, containerY + containerH - 2);

    let ty = containerY + (containerH - contentH) / 2 + 0.5;
    ty += cNameSz * PT;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(cNameSz);
    doc.text(template.companyName || 'COMPANY NAME', cx, ty, { align: 'center' });

    if (template.subTitle) {
        ty += subSz * PT + 1.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(subSz);
        doc.text(template.subTitle, cx, ty, { align: 'center' });
    }

    if (addrLines.length > 0) {
        ty += addrSz * PT + 1.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(addrSz);
        addrLines.forEach((line, i) => {
            doc.text(line, cx, ty + i * addrLineH, { align: 'center' });
        });
    }

    curY = containerY + containerH;
    doc.setLineWidth(0.4);
    doc.line(mL, curY, PW - mR, curY);
    curY += 3;

    return {
        setInk,
        mL,
        mR,
        UW,
        PW,
        PH,
        cx,
        curY
    };
}

function renderPrintedContinuationPage(doc, template, documentMeta) {
    doc.addPage();
    return renderPrintedHeaderScaffold(doc, template, documentMeta).curY;
}

function renderPrintedTemplate(doc, dcData, rollsList, template) {
    // Legacy entrypoint retained for compatibility.
    renderPrintedTemplateCompact(doc, dcData, rollsList, template);
}

function renderPrintedTemplateCompact(doc, dcData, rollsList, template) {
    const {
        setInk,
        mL,
        mR,
        UW,
        PW,
        PH,
        cx,
        curY: baseHeaderY
    } = renderPrintedHeaderScaffold(doc, template, {
        numberLabel: 'DC No.',
        numberValue: dcData.dcNumber || '__________',
        dateLabel: 'Date',
        dateValue: dcData.createdAt
    });

    const pct = Number(dcData?.appliedPercentage || 0);
    const safePct = Number.isFinite(pct) ? pct : 0;
    const factor = 1 + safePct / 100;
    const adjustedMetre = (value) => Number((Number(value || 0) * factor).toFixed(2));
    const items = Array.isArray(rollsList) ? rollsList : [];

    // User-configurable readability settings for printed layout.
    const detailFontSize = parseFloat(template.detailFontSize) || 9;
    const detailLineHeight = parseFloat(template.detailLineHeight) || 4.4;
    const footerFontSize = parseFloat(template.footerFontSize) || 9;
    const signatoryFontSize = parseFloat(template.signatoryFontSize) || 8;

    let curY = baseHeaderY;
    doc.setFontSize(detailFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text('To M/s.', mL + 2, curY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${dcData.partyName || '________________________________'}`, mL + 16, curY + 4);
    curY += 5;

    const pAddr = dcData.partyAddress || '';
    if (template.showPartyAddress) {
        doc.setFont('helvetica', 'bold');
        doc.text('Address', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        if (pAddr) {
            const pAddrLines = doc.splitTextToSize(`: ${pAddr}`, UW - 20);
            pAddrLines.forEach((line, i) => doc.text(line, mL + 16, curY + 4 + i * detailLineHeight));
            curY += 4 + pAddrLines.length * detailLineHeight;
        } else {
            doc.text(': ________________________________', mL + 16, curY + 4);
            curY += 7;
        }
    }

    if (template.showQuality) {
        doc.setFont('helvetica', 'bold');
        doc.text('Quality', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${dcData.quality || '______________________'}`, mL + 17, curY + 4);
    }
    if (template.showFolding) {
        doc.setFont('helvetica', 'bold');
        doc.text('Folding', cx - 26, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${dcData.folding || '__________________'}`, cx - 11, curY + 4);
    }
    if (template.showLotNo) {
        doc.setFont('helvetica', 'bold');
        doc.text('Lot No', PW - mR - 40, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${dcData.lotNo || '__________'}`, PW - mR - 28, curY + 4);
    }
    curY += 9;

    doc.setLineWidth(0.28);
    doc.line(mL, curY, PW - mR, curY);
    const startY = curY + 1;

    const totalColCount = 6;
    const rollColCount = 4;
    const colW = UW / totalColCount;
    const rollAreaW = colW * rollColCount;
    const summaryX = mL + rollAreaW;
    const summaryW = UW - rollAreaW;
    const bottomLimit = PH - 34;
    const titleRowH = 5.6;
    const detailRowH = 4.8;
    const _padX = 2.2;
    const textOffsetY = 3.3;
    const rollSerialHeaderW = 6;

    const formatPieceValue = (piece) => {
        const rawLength = typeof piece === 'number' ? piece : Number(piece?.length || 0);
        const adjustedLength = Number((Number(rawLength || 0) * factor).toFixed(2));
        return adjustedLength.toFixed(2);
    };

    const drawPageSummaryColumn = (pageSummaryRows, topY, rollAreaEndY) => {
        const titleH = 5;
        const headerH = 5;
        const rows = Math.max(pageSummaryRows.length, 1);
        const rowGap = 4.5;
        const totalRowH = 6.5;
        const columnStartY = topY;
        const columnEndY = topY + titleH + headerH + (rows * rowGap) + totalRowH + 2;
        const totalH = columnEndY - columnStartY;

        const splitX = summaryX + 15;
        const snoCenterX = summaryX + ((splitX - summaryX) / 2);
        const bodyFontSize = 8;

        setInk();
        doc.setLineWidth(0.18);
        doc.rect(summaryX, columnStartY, summaryW, totalH);
        doc.line(summaryX, columnStartY + titleH, summaryX + summaryW, columnStartY + titleH);
        doc.line(summaryX, columnStartY + titleH + headerH, summaryX + summaryW, columnStartY + titleH + headerH);
        doc.line(splitX, columnStartY + titleH, splitX, columnEndY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('ROLL SUMMARY', summaryX + (summaryW / 2), columnStartY + 3.6, { align: 'center' });
        doc.text('S.No', snoCenterX, columnStartY + titleH + 3.4, { align: 'center' });
        doc.text('Total Mtrs', summaryX + summaryW - 2, columnStartY + titleH + 3.4, { align: 'right' });

        const rowsAreaTopY = columnStartY + titleH + headerH;
        const totalRowY = rowsAreaTopY + (rows * rowGap);
        doc.setLineWidth(0.15);
        doc.line(summaryX, totalRowY, summaryX + summaryW, totalRowY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        pageSummaryRows.forEach((row, idx) => {
            const y = rowsAreaTopY + ((idx + 1) * rowGap) - 1.5;
            doc.text(String(row.serialNo), snoCenterX, y, { align: 'center' });
            doc.text(row.totalMtrs, summaryX + summaryW - 2, y, { align: 'right' });
        });

        const totalY = totalRowY + 5.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(bodyFontSize + 0.5);
        const grandTotal = pageSummaryRows.reduce((sum, row) => sum + Number(row.totalMtrs), 0);
        doc.text('Total Meters', splitX + 2, totalY);
        doc.text(grandTotal.toFixed(2), summaryX + summaryW - 2, totalY, { align: 'right' });
    };

    let drawY = startY;
    let cursor = 0;

    while (cursor < items.length) {
        const pageTopY = drawY;
        const pageSummaryRows = [];
        let isFirstGroupOnPage = true;

        while (cursor < items.length) {
            const group = items.slice(cursor, cursor + rollColCount);
            const normalized = Array.from({ length: rollColCount }, (_, idx) => {
                const roll = group[idx] || null;
                if (!roll) return null;
                const absoluteIndex = cursor + idx;
                const pieces = Array.isArray(roll?.pieces) && roll.pieces.length > 0
                    ? roll.pieces
                    : [{ length: roll?.metre || 0 }];
                return {
                    roll,
                    absoluteIndex,
                    pieceValues: pieces.map((piece) => formatPieceValue(piece)),
                    totalText: Number(adjustedMetre(roll?.metre || 0)).toFixed(2)
                };
            });

            const maxPieceRows = normalized.reduce((max, entry) => {
                if (!entry) return max;
                return Math.max(max, entry.pieceValues.length);
            }, 1);

            const totalRows = maxPieceRows + 1;
            const groupHeight = titleRowH + (totalRows * detailRowH);

            if (!isFirstGroupOnPage && drawY + groupHeight > bottomLimit) {
                break;
            }

            setInk();
            doc.setLineWidth(0.28);
            doc.line(mL, drawY, mL + rollAreaW, drawY);
            doc.line(mL, drawY + groupHeight, mL + rollAreaW, drawY + groupHeight);
            doc.line(mL, drawY, mL, drawY + groupHeight);
            doc.line(mL + rollAreaW, drawY, mL + rollAreaW, drawY + groupHeight);

            for (let c = 1; c < rollColCount; c++) {
                const vx = mL + (c * colW);
                doc.line(vx, drawY, vx, drawY + groupHeight);
            }
            // Show barcode serial split in every populated roll column.
            doc.setLineWidth(0.14);
            for (let c = 0; c < rollColCount; c++) {
                if (!normalized[c]) continue;
                const sx = mL + (c * colW) + rollSerialHeaderW;
                const splitEndY = c === 0 ? (drawY + groupHeight) : (drawY + titleRowH);
                doc.line(sx, drawY, sx, splitEndY);
            }
            doc.setLineWidth(0.28);
            doc.line(mL, drawY + titleRowH, mL + rollAreaW, drawY + titleRowH);
            doc.setLineWidth(0.18);
            for (let r = 1; r < totalRows; r++) {
                const hy = drawY + titleRowH + (r * detailRowH);
                doc.line(mL, hy, mL + rollAreaW, hy);
            }

            normalized.forEach((entry, colIdx) => {
                if (!entry) return;
                const gx = mL + (colIdx * colW);
                const barcodeText = String(entry.roll?.barcode || '').trim();
                const serialCenterX = gx + (rollSerialHeaderW / 2);
                const barcodeCenterX = gx + rollSerialHeaderW + ((colW - rollSerialHeaderW) / 2);
                const valueCellCenterX = barcodeCenterX;
                const showPieceNumbers = colIdx === 0;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                // Barcode serial number in the fixed left serial sub-column.
                doc.text(String(entry.absoluteIndex + 1), serialCenterX, drawY + 3.9, { align: 'center' });
                doc.setFontSize(8);
                // Keep barcode in the dedicated right sub-column so it never shifts.
                doc.text(barcodeText || `ROLL ${entry.absoluteIndex + 1}`, barcodeCenterX, drawY + 3.9, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.6);
                for (let r = 0; r < maxPieceRows; r++) {
                    const lineY = drawY + titleRowH + (r * detailRowH) + textOffsetY;
                    const lineValue = entry.pieceValues[r];
                    // Show piece-row numbers only in the starting column.
                    if (showPieceNumbers) {
                        doc.text(String(r + 1), serialCenterX, lineY, { align: 'center' });
                    }
                    if (lineValue) {
                        doc.text(lineValue, valueCellCenterX, lineY, { align: 'center' });
                    }
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.8);
                const totalY = drawY + titleRowH + (maxPieceRows * detailRowH) + textOffsetY;
                // Piece count is shown only in the starting column.
                if (showPieceNumbers) {
                    doc.text(String(entry.pieceValues.length), serialCenterX, totalY, { align: 'center' });
                }
                doc.text(entry.totalText, valueCellCenterX, totalY, { align: 'center' });

                pageSummaryRows.push({
                    serialNo: entry.absoluteIndex + 1,
                    totalMtrs: entry.totalText
                });
            });

            isFirstGroupOnPage = false;
            drawY += groupHeight;
            cursor += rollColCount;
        }

        drawPageSummaryColumn(pageSummaryRows, pageTopY, drawY);

        if (cursor < items.length) {
            drawY = renderPrintedContinuationPage(doc, template, {
                numberLabel: 'DC No.',
                numberValue: dcData.dcNumber || '__________',
                dateLabel: 'Date',
                dateValue: dcData.createdAt
            });
        }
    }

    curY = drawY + 3;
    const footerY = PH - 35;
    const grandMetre = items.reduce((sum, roll) => sum + adjustedMetre(roll?.metre || 0), 0);
    const totalPieces = items.reduce((sum, roll) => sum + (Array.isArray(roll?.pieces) && roll.pieces.length > 0 ? roll.pieces.length : 1), 0);

    setInk();
    doc.setLineWidth(0.35);
    doc.line(mL, footerY - 2, PW - mR, footerY - 2);
    doc.setLineWidth(0.24);
    doc.line(mL, footerY - 2, mL, footerY + 25);
    doc.line(PW - mR, footerY - 2, PW - mR, footerY + 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(footerFontSize);
    const footerLabelX = mL + 2;
    const footerColonX = mL + 34;
    const footerValueX = mL + 38;

    doc.text('Total Meter', footerLabelX, footerY + 4);
    doc.text(':', footerColonX, footerY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(grandMetre.toFixed(2), footerValueX, footerY + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Pieces', footerLabelX, footerY + 10);
    doc.text(':', footerColonX, footerY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(String(totalPieces), footerValueX, footerY + 10);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Roll', footerLabelX, footerY + 16);
    doc.text(':', footerColonX, footerY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(String(items.length), footerValueX, footerY + 16);

    if (template.showBillNo) {
        doc.setFont('helvetica', 'bold');
        doc.text('Bill No :', cx - 18, footerY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(dcData.billNo || '______________', cx + 3, footerY + 4);
    }
    if (template.showBillPreparedBy) {
        doc.setFont('helvetica', 'bold');
        doc.text('Bill Prepared by :', cx - 18, footerY + 13);
        doc.setFont('helvetica', 'normal');
        doc.text(dcData.billPreparedBy || '______________', cx + 12, footerY + 13);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(signatoryFontSize);
    doc.text('Authorised Signatory', PW - mR - 2, footerY + 24, { align: 'right' });
}

function finalizePdf(doc, filename, options = {}) {
    const mode = options.mode || 'save';
    if (mode === 'bloburl') {
        // Use manual blob URL - jsPDF's built-in bloburl doesn't work in Electron iframes
        const blob = doc.output('blob');
        return URL.createObjectURL(blob);
    }
    if (mode === 'blob') {
        return doc.output('blob');
    }
    doc.save(filename);
    return null;
}

export const generateDCPdf = (dcData, rollsList, templateConfig = null, options = {}) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const template = normalizeTemplate(templateConfig, dcData);
    const pct = Number(dcData?.appliedPercentage || 0);
    const safePct = Number.isFinite(pct) ? pct : 0;
    const factor = 1 + safePct / 100;
    const adjustedMetre = (value) => Number((Number(value || 0) * factor).toFixed(2));
    const company = template.companyName || DEFAULT_TEMPLATE.companyName;
    const subTitle = template.subTitle || DEFAULT_TEMPLATE.subTitle;
    const documentTitle = template.documentTitle || DEFAULT_TEMPLATE.documentTitle;
    const headFillColor = hexToRgb(template.tableHeaderColor);

    const logoDataUrl = String(template.logoDataUrl || '');
    const hasLogo = logoDataUrl.startsWith('data:image/');
    let textStartX = 14;

    if (template.layoutMode === 'printed') {
        renderPrintedTemplate(doc, dcData, rollsList, template);
        const filename = `${String(dcData.dcNumber || 'DC').replace(/\s+/g, '_')}_Challan.pdf`;
        return finalizePdf(doc, filename, options);
    }

    if (hasLogo) {
        try {
            const isPng = logoDataUrl.startsWith('data:image/png');
            const format = isPng ? 'PNG' : 'JPEG';
            doc.addImage(logoDataUrl, format, 14, 12, 20, 20);
            textStartX = 38;
        } catch (error) {
            console.debug('Skipping invalid quotation logo image:', error);
            textStartX = 14;
        }
    }

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(company, textStartX, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subTitle, textStartX, 26);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(documentTitle, 200, 20, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Status warning if cancelled
    if (dcData.status === 'CANCELLED') {
        doc.setTextColor(255, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("CANCELLED", 200, 26, { align: "right" });
        doc.setTextColor(0, 0, 0);
    }

    doc.setFont("helvetica", "bold");
    doc.text("DC No:", 150, 36);
    doc.setFont("helvetica", "normal");
    doc.text(dcData.dcNumber, 175, 36);

    const dateStr = new Date(dcData.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    
    doc.setFont("helvetica", "bold");
    doc.text("Date:", 150, 42);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, 175, 42);

    // --- Party Data (Left Side) ---
    doc.setFont("helvetica", "bold");
    doc.text("Billed To:", 14, 36);
    doc.setFont("helvetica", "normal");
    doc.text(dcData.partyName || 'N/A', 14, 42);

    if (template.showVehicle && dcData.vehicleNumber) {
        doc.setFont("helvetica", "bold");
        doc.text("Vehicle No:", 14, 50);
        doc.setFont("helvetica", "normal");
        doc.text(dcData.vehicleNumber, 36, 50);
    }

    if (template.showDriver && dcData.driverName) {
        const driverY = template.showVehicle && dcData.vehicleNumber ? 56 : 50;
        doc.setFont("helvetica", "bold");
        doc.text("Driver:", 14, driverY);
        doc.setFont("helvetica", "normal");
        doc.text(dcData.driverName, 36, driverY);
    }

    doc.setLineWidth(0.5);
    doc.line(14, 62, 200, 62);

    const tableHeaders = [["S.No", "Barcode ID", "Description / Size", "Metre", "Weight", "Pieces"]];
    const tableBody = rollsList.map((roll, index) => {
        const parts = roll.barcode.split('-');
        const sizeDesc = parts.length === 3 ? `${parts[1]} PPI` : 'Cloth Roll';
        const piecesCount = (roll.pieces && Array.isArray(roll.pieces)) ? roll.pieces.length : 1;
        
        return [
            index + 1,
            roll.barcode,
            sizeDesc,
            adjustedMetre(roll.metre).toFixed(2),
            Number(roll.weight).toFixed(2),
            piecesCount
        ];
    });

    autoTable(doc, {
        startY: 68,
        head: tableHeaders,
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: headFillColor,
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 15 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
        }
    });

    const finalY = doc.lastAutoTable.finalY || 68;
    
    doc.setLineWidth(0.5);
    doc.rect(14, finalY + 4, 186, 12);
    
    doc.setFont("helvetica", "bold");
    doc.text("Total Rolls:", 18, finalY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(String(dcData.totalRolls), 45, finalY + 12);

    doc.setFont("helvetica", "bold");
    doc.text("Total Metre:", 140, finalY + 12);
    doc.setFont("helvetica", "normal");
    const computedTotal = rollsList.reduce((sum, roll) => sum + adjustedMetre(roll.metre), 0);
    doc.text(Number(computedTotal).toFixed(2), 165, finalY + 12);

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "bold");
    doc.text("Authorized Signatory", 14, pageHeight - 20);
    doc.text("Receiver's Signature", 150, pageHeight - 20);

    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 25, 60, pageHeight - 25);
    doc.line(150, pageHeight - 25, 200, pageHeight - 25);

    const filename = `${String(dcData.dcNumber || 'DC').replace(/\s+/g, '_')}_Challan.pdf`;
    return finalizePdf(doc, filename, options);
};

export const generateQuotationPdf = (quotationData, rollsList, templateConfig = null, options = {}) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const template = normalizeTemplate(templateConfig, quotationData);
    template.documentTitle = 'QUOTATION';
    const rows = Array.isArray(rollsList) ? rollsList : [];
    
    const pct = Number(quotationData?.appliedPercentage || 0);
    const safePct = Number.isFinite(pct) ? pct : 0;
    const factor = 1 + safePct / 100;
    const adjustedMetre = (value) => Number((Number(value || 0) * factor).toFixed(2));

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const topMargin = 12;
    const bottomMargin = 16;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const titleColor = [17, 24, 39];
    const textColor = [31, 41, 55];
    const mutedColor = [107, 114, 128];
    const borderColor = [55, 65, 81];
    const softFill = [249, 250, 251];
    let yPosition = topMargin;

    const ensureSpace = (requiredHeight = 10) => {
        if (yPosition + requiredHeight <= pageHeight - bottomMargin) return;
        doc.addPage();
        yPosition = topMargin;
    };

    const drawTextSection = (title, value) => {
        const safeValue = String(value || '').trim();
        if (!safeValue) return;

        const lines = doc.splitTextToSize(safeValue, contentWidth - 8);
        const bodyHeight = Math.max(8, lines.length * 3.9 + 2);
        const totalHeight = bodyHeight + 6;
        ensureSpace(totalHeight + 4);

        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.25);
        doc.rect(marginLeft, yPosition, contentWidth, totalHeight);
        doc.setFillColor(...softFill);
        doc.rect(marginLeft, yPosition, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(...titleColor);
        doc.text(title, marginLeft + 2.5, yPosition + 4.1);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.1);
        doc.setTextColor(...textColor);
        lines.forEach((line, idx) => {
            doc.text(line, marginLeft + 2.5, yPosition + 9 + idx * 3.9);
        });

        yPosition += totalHeight + 4;
    };

    const createdDate = quotationData.createdAt
        ? new Date(quotationData.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';
    const validityDate = quotationData.validityDate
        ? new Date(quotationData.validityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';

    const company = template.companyName || DEFAULT_TEMPLATE.companyName;
    const subTitle = template.subTitle || DEFAULT_TEMPLATE.subTitle;
    const logoDataUrl = String(template.logoDataUrl || '');
    const hasLogo = logoDataUrl.startsWith('data:image/');
    let textStartX = 14;

    if (hasLogo) {
        try {
            const isPng = logoDataUrl.startsWith('data:image/png');
            const format = isPng ? 'PNG' : 'JPEG';
            doc.addImage(logoDataUrl, format, 14, 12, 20, 20);
            textStartX = 38;
        } catch (error) {
            console.debug('Skipping invalid quotation logo image:', error);
            textStartX = 14;
        }
    }

    doc.setTextColor(...titleColor);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(company || 'COMPANY NAME', textStartX, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (subTitle) {
        doc.setTextColor(...mutedColor);
        doc.text(subTitle, textStartX, 26);
    }

    doc.setTextColor(...titleColor);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTATION', 200, 20, { align: 'right' });

    if (quotationData.status === 'CANCELLED') {
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('CANCELLED', 200, 26, { align: 'right' });
        doc.setTextColor(...titleColor);
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Quotation No:', 145, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(String(quotationData.quotationNumber || 'N/A'), 175, 36);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 145, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(createdDate, 175, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', 14, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(String(quotationData.partyName || 'N/A'), 14, 42);

    const partyAddress = String(quotationData.partyAddress || '').trim();
    let headerBottom = 62;
    if (partyAddress) {
        doc.setFontSize(8.4);
        doc.setTextColor(...textColor);
        const addressLines = doc.splitTextToSize(partyAddress, 110);
        addressLines.slice(0, 2).forEach((line, idx) => {
            doc.text(line, 14, 48 + idx * 4);
        });
        headerBottom = Math.max(headerBottom, 52 + Math.min(addressLines.length, 2) * 4);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('Density:', 145, 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...titleColor);
    doc.text(String(quotationData.density || 'N/A'), 175, 50);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('Valid Till:', 145, 56);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...titleColor);
    doc.text(validityDate, 175, 56);

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.line(14, headerBottom, 200, headerBottom);
    yPosition = headerBottom + 6;

    const tableRows = (rows.length > 0 ? rows : [{}]).map((roll, index) => {
        if (rows.length === 0) {
            return ['-', 'No rolls selected', '0.00', '0'];
        }
        const piecesCount = Array.isArray(roll?.pieces) ? roll.pieces.length : Number(roll?.pieces || 1);
        return [
            String(index + 1),
            String(roll?.barcode || '-'),
            adjustedMetre(roll?.metre || 0).toFixed(2),
            String(piecesCount)
        ];
    });

    autoTable(doc, {
        startY: yPosition,
        margin: { left: marginLeft, right: marginRight },
        tableWidth: contentWidth,
        head: [['S.No', 'Barcode', 'Metre', 'Pieces']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [245, 246, 248],
            textColor: [17, 24, 39],
            fontStyle: 'bold',
            fontSize: 8.4,
            lineColor: borderColor,
            lineWidth: 0.25,
            halign: 'center',
            cellPadding: 2.6
        },
        bodyStyles: {
            fontSize: 8.2,
            textColor: [31, 41, 55],
            lineColor: [156, 163, 175],
            lineWidth: 0.2,
            cellPadding: 2.4,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 98, halign: 'left' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 22, halign: 'right' }
        }
    });

    yPosition = (doc.lastAutoTable?.finalY || yPosition) + 5;

    const totalRolls = Number(quotationData.totalRolls || rows.length || 0);
    const totalMetre = rows.reduce((sum, roll) => sum + adjustedMetre(roll?.metre || 0), 0);
    ensureSpace(16);

    const summaryGap = 4;
    const summaryWidth = (contentWidth - summaryGap) / 2;
    const summaryHeight = 12;
    const summaryTop = yPosition;

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.25);
    doc.rect(marginLeft, summaryTop, summaryWidth, summaryHeight);
    doc.rect(marginLeft + summaryWidth + summaryGap, summaryTop, summaryWidth, summaryHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...mutedColor);
    doc.text('TOTAL ROLLS', marginLeft + 2.5, summaryTop + 4.4);
    doc.text('TOTAL METRE', marginLeft + summaryWidth + summaryGap + 2.5, summaryTop + 4.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.6);
    doc.setTextColor(...titleColor);
    doc.text(String(totalRolls), marginLeft + summaryWidth - 2.5, summaryTop + 9.2, { align: 'right' });
    doc.text(totalMetre.toFixed(2), marginLeft + summaryWidth + summaryGap + summaryWidth - 2.5, summaryTop + 9.2, { align: 'right' });

    yPosition += summaryHeight + 5;

    const footerY = pageHeight - 12;
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.35);
    doc.line(marginLeft, footerY - 4.5, pageWidth - marginRight, footerY - 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(...mutedColor);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, marginLeft, footerY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...titleColor);
    doc.text('Authorised Signatory', pageWidth - marginRight, footerY, { align: 'right' });

    const filename = `${String(quotationData.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
    return finalizePdf(doc, filename, options);
};
