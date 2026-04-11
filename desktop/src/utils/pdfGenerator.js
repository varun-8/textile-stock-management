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
    addressSize: 7.5
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

    let curY = baseHeaderY;
    doc.setFontSize(8);
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
            pAddrLines.forEach((line, i) => doc.text(line, mL + 16, curY + 4 + i * 4));
            curY += 4 + pAddrLines.length * 4;
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

    doc.setLineWidth(0.35);
    doc.line(mL, curY, PW - mR, curY);
    const startY = curY + 1;

    const totalColCount = 4;
    const rollColCount = 3;
    const colW = UW / totalColCount;
    const rollAreaW = colW * rollColCount;
    const summaryX = mL + rollAreaW;
    const summaryW = colW;
    const bottomLimit = PH - 34;
    const titleRowH = 5.6;
    const detailRowH = 4.8;
    const padX = 2.2;
    const textOffsetY = 3.3;
    const serialColW = 10;

    const formatPieceValue = (piece) => {
        const rawLength = typeof piece === 'number' ? piece : Number(piece?.length || 0);
        const adjustedLength = Number((Number(rawLength || 0) * factor).toFixed(2));
        return adjustedLength.toFixed(2);
    };

    const drawPageSummaryColumn = (pageSummaryRows, topY, endY) => {
        const totalH = endY - topY;
        if (totalH < 14) return;

        const titleH = 5;
        const headerH = 5;
        const splitX = summaryX + 11;
        const snoCenterX = summaryX + ((splitX - summaryX) / 2);
        const rows = Math.max(pageSummaryRows.length, 1);
        const rowsAreaTopY = topY + titleH + headerH;
        const rowsAreaH = Math.max(endY - rowsAreaTopY, 4);
        const rowGap = rowsAreaH / (rows + 1);
        const bodyFontSize = rowGap < 4 ? 7 : 8;
        const baselineOffset = Math.max(2.2, rowGap * 0.25);

        setInk();
        doc.setLineWidth(0.25);
        doc.rect(summaryX, topY, summaryW, totalH);
        doc.line(summaryX, topY + titleH, summaryX + summaryW, topY + titleH);
        doc.line(summaryX, topY + titleH + headerH, summaryX + summaryW, topY + titleH + headerH);
        doc.line(splitX, topY + titleH, splitX, endY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('ROLL SUMMARY', summaryX + (summaryW / 2), topY + 3.6, { align: 'center' });
        doc.text('S.No', snoCenterX, topY + titleH + 3.4, { align: 'center' });
        doc.text('Total Mtrs', summaryX + summaryW - 1.5, topY + titleH + 3.4, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        pageSummaryRows.forEach((row, idx) => {
            const y = rowsAreaTopY + ((idx + 1) * rowGap) + baselineOffset;
            doc.text(String(row.serialNo), snoCenterX, y, { align: 'center' });
            doc.text(row.totalMtrs, summaryX + summaryW - 1.5, y, { align: 'right' });
        });
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
            doc.setLineWidth(0.25);
            if (isFirstGroupOnPage) doc.line(mL, drawY, mL + rollAreaW, drawY);
            doc.line(mL, drawY + groupHeight, mL + rollAreaW, drawY + groupHeight);
            doc.line(mL, drawY, mL, drawY + groupHeight);
            doc.line(mL + rollAreaW, drawY, mL + rollAreaW, drawY + groupHeight);

            for (let c = 1; c < rollColCount; c++) {
                const vx = mL + (c * colW);
                doc.line(vx, drawY, vx, drawY + groupHeight);
            }
            for (let c = 0; c < rollColCount; c++) {
                const gx = mL + (c * colW);
                doc.line(gx + serialColW, drawY, gx + serialColW, drawY + groupHeight);
            }

            doc.line(mL, drawY + titleRowH, mL + rollAreaW, drawY + titleRowH);
            for (let r = 1; r < totalRows; r++) {
                const hy = drawY + titleRowH + (r * detailRowH);
                doc.line(mL, hy, mL + rollAreaW, hy);
            }

            normalized.forEach((entry, colIdx) => {
                if (!entry) return;
                const gx = mL + (colIdx * colW);
                const barcodeText = String(entry.roll?.barcode || '').trim();
                const valueCellCenterX = gx + serialColW + ((colW - serialColW) / 2);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(String(entry.absoluteIndex + 1), gx + (serialColW / 2), drawY + 3.9, { align: 'center' });
                doc.text(barcodeText || `ROLL ${entry.absoluteIndex + 1}`, valueCellCenterX, drawY + 3.9, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.6);
                for (let r = 0; r < maxPieceRows; r++) {
                    const lineY = drawY + titleRowH + (r * detailRowH) + textOffsetY;
                    const lineValue = entry.pieceValues[r];
                    if (!lineValue) continue;
                    doc.text(String(r + 1), gx + (serialColW / 2), lineY, { align: 'center' });
                    doc.text(lineValue, valueCellCenterX, lineY, { align: 'center' });
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.8);
                const totalY = drawY + titleRowH + (maxPieceRows * detailRowH) + textOffsetY;
                doc.text(String(entry.pieceValues.length), gx + (serialColW / 2), totalY, { align: 'center' });
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
    doc.setLineWidth(0.45);
    doc.line(mL, footerY - 2, PW - mR, footerY - 2);
    doc.setLineWidth(0.3);
    doc.line(mL, footerY - 2, mL, footerY + 25);
    doc.line(PW - mR, footerY - 2, PW - mR, footerY + 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
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
    doc.setFontSize(7);
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
        doc.setFontSize(8);
        doc.text('To M/s.', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${quotationData.partyName || '________________________________'}`, mL + 16, curY + 4);
        curY += 5;

        const pAddr = String(quotationData.partyAddress || '').trim();
        if (pAddr) {
            doc.setFont('helvetica', 'bold');
            doc.text('Address', mL + 2, curY + 4);
            doc.setFont('helvetica', 'normal');
            const pAddrLines = doc.splitTextToSize(`: ${pAddr}`, UW - 20);
            pAddrLines.forEach((line, i) => {
                doc.text(line, mL + 16, curY + 4 + i * 4);
            });
            curY += 4 + pAddrLines.length * 4;
        }

        const validityText = quotationData.validityDate
            ? new Date(quotationData.validityDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'N/A';

        doc.setFont('helvetica', 'bold');
        doc.text('Density', mL + 2, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${quotationData.density || 'N/A'}`, mL + 16, curY + 4);
        doc.setFont('helvetica', 'bold');
        doc.text('Validity', PW - mR - 40, curY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${validityText}`, PW - mR - 28, curY + 4);
        curY += 9;

        doc.setLineWidth(0.4);
        doc.line(mL, curY, PW - mR, curY);
        curY += 2;

        const totalRolls = Number(quotationData.totalRolls || rows.length || 0);
        const totalMetre = rows.reduce((sum, roll) => sum + Number(roll?.metre || 0), 0);
        const totalWeight = rows.reduce((sum, roll) => sum + Number(roll?.weight || 0), 0);

        autoTable(doc, {
            startY: curY,
            margin: { left: mL, right: mR },
            head: [['S.No', 'Barcode', 'Metre', 'Weight', 'Pieces']],
            body: (rows.length > 0 ? rows : [{}]).map((roll, index) => {
                if (rows.length === 0) {
                    return ['-', 'No rolls selected', '0.00', '0.00', '0'];
                }
                const piecesCount = Array.isArray(roll?.pieces) ? roll.pieces.length : Number(roll?.pieces || 1);
                return [
                    index + 1,
                    roll?.barcode || '-',
                    Number(roll?.metre || 0).toFixed(2),
                    Number(roll?.weight || 0).toFixed(2),
                    piecesCount
                ];
            }),
            theme: 'grid',
            headStyles: {
                fillColor: hexToRgb(template.tableHeaderColor),
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8.7,
                lineWidth: 0,
                halign: 'center'
            },
            styles: {
                fontSize: 8.1,
                cellPadding: 2.8,
                textColor: [30, 41, 59]
            },
            bodyStyles: {
                lineColor: [203, 213, 225],
                lineWidth: 0.2
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right', cellWidth: 16 }
            }
        });

        const finalY = doc.lastAutoTable?.finalY || curY;

        const summaryY = finalY + 5;
        const summaryGap = 3;
        const summaryBoxW = (UW - summaryGap * 2) / 3;
        const summaryItems = [
            { label: 'Total Rolls', value: String(totalRolls) },
            { label: 'Total Metre', value: totalMetre.toFixed(2) },
            { label: 'Total Weight', value: totalWeight.toFixed(2) }
        ];

        summaryItems.forEach((item, idx) => {
            const boxX = mL + idx * (summaryBoxW + summaryGap);
            setInk();
            doc.setLineWidth(0.3);
            doc.rect(boxX, summaryY, summaryBoxW, 10.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.text(item.label.toUpperCase(), boxX + 2, summaryY + 3.7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(item.value, boxX + summaryBoxW - 2, summaryY + 8.1, { align: 'right' });
        });

        let notesY = summaryY + 14;
        const notes = String(quotationData.notes || '').trim();
        if (notes) {
            setInk();
            doc.setLineWidth(0.25);
            doc.rect(mL, notesY - 3.5, UW, 10);
            doc.setFont('helvetica', 'bold');
            doc.text('Notes:', mL + 2, notesY);
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(notes, UW - 14);
            notesLines.forEach((line, idx) => {
                doc.text(line, mL + 14, notesY + idx * 4);
            });
            const notesHeight = Math.max(10, notesLines.length * 4 + 5.5);
            setInk();
            doc.setLineWidth(0.25);
            doc.rect(mL, notesY - 3.5, UW, notesHeight);
            notesY += notesHeight + 2;
        }

        const terms = String(quotationData.terms || '').trim();
        if (terms) {
            setInk();
            doc.setLineWidth(0.25);
            doc.rect(mL, notesY - 3.5, UW, 10);
            doc.setFont('helvetica', 'bold');
            doc.text('Terms:', mL + 2, notesY);
            doc.setFont('helvetica', 'normal');
            const termLines = doc.splitTextToSize(terms, UW - 14);
            termLines.forEach((line, idx) => {
                doc.text(line, mL + 14, notesY + idx * 4);
            });
            const termsHeight = Math.max(10, termLines.length * 4 + 5.5);
            setInk();
            doc.setLineWidth(0.25);
            doc.rect(mL, notesY - 3.5, UW, termsHeight);
        }

        setInk();
        doc.setLineWidth(0.25);
        doc.line(mL, PH - 16, PW - mR, PH - 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, mL, PH - 11);
        doc.text('Authorised Signatory', PW - mR - 2, PH - 11, { align: 'right' });

        const filename = `${String(quotationData.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
        return finalizePdf(doc, filename, options);
    }

    const filename = `${String(quotationData.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
    return finalizePdf(doc, filename, options);
};
