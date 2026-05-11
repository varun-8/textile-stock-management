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

    if (template.layoutMode === 'printed') {
        const {
            setInk,
            mL,
            mR,
            UW,
            PW,
            PH,
            curY: baseHeaderY
        } = renderPrintedHeaderScaffold(doc, template, {
            numberLabel: 'Quotation No.',
            numberValue: quotationData.quotationNumber || '__________',
            numberValueOffset: 27,
            dateLabel: 'Date',
            dateValue: quotationData.createdAt
        });

        let curY = baseHeaderY;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('To M/s.', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${quotationData.partyName || '________________________________'}`, mL + 16, curY + 4);
        curY += 5;

        const pAddr = String(quotationData.partyAddress || '').trim();
        if (pAddr) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text('Address', mL + 2, curY + 4);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.8);
            const pAddrLines = doc.splitTextToSize(`: ${pAddr}`, UW - 20);
            pAddrLines.forEach((line, i) => {
                doc.text(line, mL + 16, curY + 4 + i * 3.5);
            });
            curY += 4 + pAddrLines.length * 3.5;
        }

        const validityText = quotationData.validityDate
            ? new Date(quotationData.validityDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'N/A';

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('Density', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${quotationData.density || 'N/A'}`, mL + 16, curY + 4);
        doc.setFont('helvetica', 'bold');
        doc.text('Validity', PW - mR - 40, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${validityText}`, PW - mR - 28, curY + 4);
        curY += 9;

        doc.setLineWidth(0.4);
        doc.setDrawColor(100, 116, 139);
        doc.line(mL, curY, PW - mR, curY);
        curY += 2;

        const totalRolls = Number(quotationData.totalRolls || rows.length || 0);
        const totalMetre = rows.reduce((sum, roll) => sum + Number(roll?.metre || 0), 0);

        autoTable(doc, {
            startY: curY,
            margin: { left: mL, right: mR },
            head: [['S.No', 'Barcode', 'Metre', 'Pieces']],
            body: (rows.length > 0 ? rows : [{}]).map((roll, index) => {
                if (rows.length === 0) {
                    return ['-', 'No rolls selected', '0.00', '0'];
                }
                const piecesCount = Array.isArray(roll?.pieces) ? roll.pieces.length : Number(roll?.pieces || 1);
                return [
                    index + 1,
                    roll?.barcode || '-',
                    Number(roll?.metre || 0).toFixed(2),
                    piecesCount
                ];
            }),
            theme: 'grid',
            headStyles: {
                fillColor: hexToRgb(template.tableHeaderColor),
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 9,
                lineWidth: 0,
                halign: 'center',
                cellPadding: 3.2
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 3.2,
                textColor: [30, 41, 59]
            },
            bodyStyles: {
                lineColor: [203, 213, 225],
                lineWidth: 0.25
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right', cellWidth: 18 }
            }
        });

        const finalY = doc.lastAutoTable?.finalY || curY;

        const summaryY = finalY + 6;
        const summaryGap = 4;
        const summaryBoxW = (UW - summaryGap) / 2;
        const summaryItems = [
            { label: 'Total Rolls', value: String(totalRolls) },
            { label: 'Total Metre', value: totalMetre.toFixed(2) }
        ];

        summaryItems.forEach((item, idx) => {
            const boxX = mL + idx * (summaryBoxW + summaryGap);
            setInk();
            doc.setLineWidth(0.5);
            doc.setDrawColor(41, 84, 209);
            doc.rect(boxX, summaryY, summaryBoxW, 11);
            doc.setFillColor(248, 250, 252);
            doc.rect(boxX, summaryY, summaryBoxW, 11, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(item.label.toUpperCase(), boxX + summaryBoxW / 2, summaryY + 3.5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text(item.value, boxX + summaryBoxW / 2, summaryY + 8.5, { align: 'center' });
        });

        let notesY = summaryY + 15;
        const notes = String(quotationData.notes || '').trim();
        if (notes) {
            setInk();
            doc.setLineWidth(0.35);
            doc.setDrawColor(100, 116, 139);
            doc.rect(mL, notesY - 3, UW, 11);
            doc.setFillColor(248, 250, 252);
            doc.rect(mL, notesY - 3, UW, 11, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text('Notes:', mL + 2, notesY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            const notesLines = doc.splitTextToSize(notes, UW - 14);
            notesLines.forEach((line, idx) => {
                doc.text(line, mL + 14, notesY + idx * 3.5);
            });
            const notesHeight = Math.max(11, notesLines.length * 3.5 + 5.5);
            setInk();
            doc.setLineWidth(0.35);
            doc.setDrawColor(100, 116, 139);
            doc.rect(mL, notesY - 3, UW, notesHeight);
            notesY += notesHeight + 2;
        }

        const terms = String(quotationData.terms || '').trim();
        if (terms) {
            setInk();
            doc.setLineWidth(0.35);
            doc.setDrawColor(100, 116, 139);
            doc.rect(mL, notesY - 3, UW, 11);
            doc.setFillColor(248, 250, 252);
            doc.rect(mL, notesY - 3, UW, 11, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text('Terms:', mL + 2, notesY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            const termLines = doc.splitTextToSize(terms, UW - 14);
            termLines.forEach((line, idx) => {
                doc.text(line, mL + 14, notesY + idx * 3.5);
            });
            const termsHeight = Math.max(11, termLines.length * 3.5 + 5.5);
            setInk();
            doc.setLineWidth(0.35);
            doc.setDrawColor(100, 116, 139);
            doc.rect(mL, notesY - 3, UW, termsHeight);
        }

        setInk();
        doc.setLineWidth(0.5);
        doc.setDrawColor(71, 84, 209);
        doc.line(mL, PH - 16, PW - mR, PH - 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, mL, PH - 11);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Authorised Signatory', PW - mR - 2, PH - 11, { align: 'right' });

        const filename = `${String(quotationData.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
        return finalizePdf(doc, filename, options);
    }

    // Modern quotation layout (default)
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const borderColor = [0, 0, 0];
    const textColor = [0, 0, 0];
    let yPosition = 12;

    // Company header with logo
    let logoEndX = marginLeft;
    const logoSize = 18;
    const logoDataUrl = String(template.logoDataUrl || '');
    if (logoDataUrl.startsWith('data:image/')) {
        try {
            const isPng = logoDataUrl.startsWith('data:image/png');
            const format = isPng ? 'PNG' : 'JPEG';
            doc.addImage(logoDataUrl, format, marginLeft, yPosition, logoSize, logoSize);
            logoEndX = marginLeft + logoSize + 4;
        } catch (error) {
            console.debug('Logo error:', error);
        }
    }

    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(template.companyName || "COMPANY NAME", logoEndX, yPosition + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text(template.subTitle || "", logoEndX, yPosition + 12);

    // Quotation title and status (right side)
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("QUOTATION", pageWidth - marginRight, yPosition + 3, { align: "right" });

    if (quotationData.status === 'CANCELLED') {
        doc.setTextColor(...textColor);
        doc.setFontSize(9);
        doc.text("CANCELLED", pageWidth - marginRight, yPosition + 11, { align: "right" });
    }

    yPosition += 25;

    // Quotation details section
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, yPosition, contentWidth, 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...textColor);
    
    const detailCol1X = marginLeft + 3;
    const detailCol2X = marginLeft + contentWidth / 2;
    
    doc.text("Quotation No.", detailCol1X, yPosition + 5);
    doc.setFont("helvetica", "normal");
    doc.text(quotationData.quotationNumber || 'N/A', detailCol1X, yPosition + 10);

    const createdDate = new Date(quotationData.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    doc.setFont("helvetica", "bold");
    doc.text("Date", detailCol1X, yPosition + 16);
    doc.setFont("helvetica", "normal");
    doc.text(createdDate, detailCol1X, yPosition + 21);

    doc.setFont("helvetica", "bold");
    doc.text("Density", detailCol2X, yPosition + 5);
    doc.setFont("helvetica", "normal");
    doc.text(quotationData.density || 'N/A', detailCol2X, yPosition + 10);

    const validityDate = quotationData.validityDate
        ? new Date(quotationData.validityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';
    doc.setFont("helvetica", "bold");
    doc.text("Valid Till", detailCol2X, yPosition + 16);
    doc.setFont("helvetica", "normal");
    doc.text(validityDate, detailCol2X, yPosition + 21);

    yPosition += 28;

    // Party details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text("Bill To:", marginLeft, yPosition);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...textColor);
    doc.text(quotationData.partyName || 'N/A', marginLeft + 25, yPosition);

    if (quotationData.partyAddress) {
        const addressLines = doc.splitTextToSize(quotationData.partyAddress, contentWidth - 25);
        yPosition += 5;
        addressLines.slice(0, 2).forEach((line, idx) => {
            doc.text(line, marginLeft + 25, yPosition + idx * 4);
        });
        yPosition += Math.min(addressLines.length, 2) * 4;
    } else {
        yPosition += 5;
    }

    yPosition += 3;

    // Items table
    const tableStartY = yPosition;
    const tableHeaders = ["S.No", "Barcode", "Description", "Metre", "Pieces"];
    const tableData = (rows.length > 0 ? rows : [{}]).map((roll, index) => {
        if (rows.length === 0) {
            return ['1', '-', 'No rolls selected', '0.00', '0'];
        }
        const piecesCount = Array.isArray(roll?.pieces) ? roll.pieces.length : Number(roll?.pieces || 1);
        const parts = String(roll?.barcode || '').split('-');
        const description = parts.length === 3 ? `${parts[1]} PPI` : 'Cloth Roll';
        return [
            String(index + 1),
            roll?.barcode || '-',
            description,
            Number(roll?.metre || 0).toFixed(2),
            String(piecesCount)
        ];
    });

    autoTable(doc, {
        startY: tableStartY,
        margin: { left: marginLeft, right: marginRight },
        tableWidth: contentWidth,
        head: [tableHeaders],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center',
            valign: 'middle',
            cellPadding: 3,
            lineColor: [0, 0, 0],
            lineWidth: 0.25
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255],
            cellPadding: 2.5,
            lineColor: [0, 0, 0],
            lineWidth: 0.25,
            overflow: 'linebreak',
            valign: 'middle'
        },
        alternateRowStyles: {
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center', valign: 'middle' },
            1: { cellWidth: 40, halign: 'center', valign: 'middle' },
            2: { cellWidth: 'auto', halign: 'left', valign: 'middle' },
            3: { cellWidth: 22, halign: 'right', valign: 'middle' },
            4: { cellWidth: 15, halign: 'center', valign: 'middle' }
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body') {
                hookData.cell.styles.fontSize = 8;
                hookData.cell.styles.overflow = 'linebreak';
                hookData.cell.styles.valign = 'middle';
                hookData.cell.styles.textColor = [0, 0, 0];
                if (hookData.column.index === 1 || hookData.column.index === 2) {
                    hookData.cell.styles.cellPadding = 2.2;
                }
            }
        }
    });

    yPosition = doc.lastAutoTable?.finalY || tableStartY + 20;
    yPosition += 4;

    // Summary boxes
    const boxHeight = 10;
    const boxGap = 3;
    const box1Width = contentWidth / 2 - boxGap / 2;
    const totalRolls = Number(quotationData.totalRolls || rows.length || 0);
    const totalMetre = rows.reduce((sum, roll) => sum + Number(roll?.metre || 0), 0);

    // Total Rolls box
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.6);
    doc.rect(marginLeft, yPosition, box1Width, boxHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...textColor);
    doc.text("Total Rolls", marginLeft + 3, yPosition + 3.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(String(totalRolls), marginLeft + box1Width - 3, yPosition + 7, { align: "right" });

    // Total Metre box
    const box2X = marginLeft + box1Width + boxGap;
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.6);
    doc.rect(box2X, yPosition, box1Width, boxHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...textColor);
    doc.text("Total Metre", box2X + 3, yPosition + 3.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(totalMetre.toFixed(2), box2X + box1Width - 3, yPosition + 7, { align: "right" });

    yPosition += boxHeight + 6;

    // Notes section
    const notes = String(quotationData.notes || '').trim();
    if (notes) {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.4);
        doc.rect(marginLeft, yPosition - 2, contentWidth, 8);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...textColor);
        doc.text("Notes:", marginLeft + 3, yPosition + 1);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const notesLines = doc.splitTextToSize(notes, contentWidth - 25);
        const notesHeight = Math.min(notesLines.length, 2) * 3;
        
        notesLines.slice(0, 2).forEach((line, idx) => {
            doc.text(line, marginLeft + 25, yPosition + 1 + idx * 3);
        });
        
        yPosition += Math.max(8, notesHeight + 4);
    }

    // Terms section
    const terms = String(quotationData.terms || '').trim();
    if (terms) {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.4);
        doc.rect(marginLeft, yPosition - 2, contentWidth, 8);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...textColor);
        doc.text("Terms & Conditions:", marginLeft + 3, yPosition + 1);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const termLines = doc.splitTextToSize(terms, contentWidth - 35);
        termLines.slice(0, 2).forEach((line, idx) => {
            doc.text(line, marginLeft + 35, yPosition + 1 + idx * 3);
        });
        
        yPosition += Math.max(8, Math.min(termLines.length, 2) * 3 + 4);
    }

    yPosition = Math.max(yPosition, pageHeight - 35);

    // Footer with signature line
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, yPosition - 2, pageWidth - marginRight, yPosition - 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...textColor);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, marginLeft, yPosition + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text("Authorised Signatory", pageWidth - marginRight, yPosition + 4, { align: "right" });

    // Signature line
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - marginRight - 30, pageHeight - 8, pageWidth - marginRight, pageHeight - 8);

    const filename = `${String(quotationData.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
    return finalizePdf(doc, filename, options);
};
