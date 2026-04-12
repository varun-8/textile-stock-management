/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { io } from "socket.io-client";
import { useConfig } from '../context/ConfigContext';
import { useNotification } from '../context/NotificationContext';
import { IconBox } from '../components/Icons';
import { DENSITY_NAME } from '../constants';

const BarcodeGenerator = () => {
    const { apiUrl } = useConfig();
    const { showNotification } = useNotification();
    const token = localStorage.getItem('ADMIN_TOKEN');
    const year = new Date().getFullYear();
    // Auto-format year to 2-digits if needed, but usually full year is stored, displayed as 2-digit
    const displayYear = String(year).slice(-2);

    const [size, setSize] = useState('');
    const [quantity, setQuantity] = useState(44);
    const [seqInfo, setSeqInfo] = useState({ lastSequence: 0, nextSequence: 1 });
    const [missingBarcodes, setMissingBarcodes] = useState([]);
    const [pendingMissing, setPendingMissing] = useState([]);
    const [loading, setLoading] = useState(false);
    const [seqLoading, setSeqLoading] = useState(false);
    const [reprintValue, setReprintValue] = useState('');
    const [reprintLoading, setReprintLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [sizes, setSizes] = useState([]);
    const [paperSize, setPaperSize] = useState('a3');

    useEffect(() => {
        fetchSizes().then((data) => {
            if (data && data.length > 0 && !size) {
                // Trigger sequence fetch after setting size if not set
            }
        });
    }, [apiUrl]);

    useEffect(() => {
        if (!size) return;
        fetchSequence();
        fetchMissing();
        fetchPendingMissing();
        fetchHistory();

        const socketOptions = import.meta.env.DEV
            ? { transports: ['polling'], upgrade: false }
            : { transports: ['websocket', 'polling'] };

        const socket = io(apiUrl, socketOptions);
        socket.on('sequence_update', (data) => {
            if (String(data.year) === String(year) && String(data.size) === String(size)) {
                setSeqInfo({ lastSequence: data.lastSequence, nextSequence: data.lastSequence + 1 });
            }
        });
        return () => socket.disconnect();
    }, [year, size, apiUrl]);

    async function fetchPendingMissing() {
        try {
            const res = await fetch(`${apiUrl}/api/admin/missing/list?status=PENDING&limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPendingMissing(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    }

    const fetchSizes = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sizes`);
            const data = await res.json();
            setSizes(data.map(s => s.code));
            if (data.length > 0 && !size) {
                setSize(data[0].code);
            }
            return data;
        } catch (err) { console.error("Failed to fetch sizes", err); return []; }
    };

    const fetchSequence = async () => {
        setSeqLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/sequence?year=${year}&size=${size}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.error) setSeqInfo(data);
        } catch (err) { console.error(err); }
        finally { setSeqLoading(false); }
    };

    const fetchMissing = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/barcode/missing?year=${year}&size=${size}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.missing) setMissingBarcodes(data.missing);
        } catch (err) { console.error(err); }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setHistory(data);
        } catch (err) { console.error(err); }
        finally { setHistoryLoading(false); }
    };

    const generatePDF = (barcodes, batchYear = year, batchSize = size, forcedPaperSize = paperSize) => {
        const isA3 = forcedPaperSize === 'a3';
        const doc = new jsPDF('p', 'mm', isA3 ? 'a3' : 'a4');

        const cols = isA3 ? 4 : 3;
        const rowsPerPage = isA3 ? 11 : 8;
        const startX = isA3 ? 20 : 15;
        const startY = 15;
        const cellWidth = 65;
        const cellHeight = 35;

        barcodes.forEach((item, index) => {
            const pageIndex = index % (cols * rowsPerPage);
            if (index > 0 && pageIndex === 0) {
                doc.addPage();
            }

            const col = pageIndex % cols;
            const row = Math.floor(pageIndex / cols);
            const x = startX + (col * cellWidth);
            const y = startY + (row * cellHeight);

            const canvas = document.createElement('canvas');
            JsBarcode(canvas, item.full_barcode, {
                format: "CODE128", width: 4, height: 80, displayValue: true, fontSize: 20, fontOptions: "bold", margin: 10, textMargin: 5
            });

            doc.addImage(canvas.toDataURL("image/png"), 'PNG', x, y, 55, 26);
            doc.setDrawColor(230);
            doc.setLineWidth(0.1);
            doc.rect(x, y, 55, 26);
        });
        doc.save(`PRO_Barcodes_${batchYear}_${batchSize}_${forcedPaperSize.toUpperCase()}_${Date.now()}.pdf`);
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ year, size, quantity, paperSize })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            generatePDF(data.barcodes, year, size, paperSize);
            showNotification(`Success: ${data.barcodes.length} Barcodes generated.`, 'success');
            fetchSequence();
            fetchMissing();
            fetchPendingMissing();
            fetchHistory();
        } catch (err) {
            showNotification(err.message, 'error');
        } finally { setLoading(false); }
    };

    const handleReprint = async (barcodes, forcedPaperSize = paperSize) => {
        const list = Array.isArray(barcodes) ? barcodes : [barcodes];
        const normalized = Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)));
        if (normalized.length === 0) {
            showNotification('Enter at least one barcode to reprint', 'error');
            return;
        }

        setReprintLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/reprint`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ barcodes: normalized, paperSize: forcedPaperSize })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to reprint barcode');
            }

            const firstBc = data.barcodes?.[0] || {};
            generatePDF(data.barcodes, firstBc.year || year, firstBc.size || size, forcedPaperSize);
            showNotification(`Reprinted ${normalized.length} barcode(s).`, 'success');
            fetchHistory();
            fetchPendingMissing();
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            setReprintLoading(false);
        }
    };

    const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' };
    const inputStyle = { width: '100%', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500' };

    return (
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-fade-in">
            {/* Header */}
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconBox />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>LOGISTICS & TRACKING</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            Barcode Generation
                        </h1>
                    </div>
                </div>
            </header>

            <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                        <div className="panel" style={{
                            padding: '1.5rem', background: 'var(--bg-secondary)',
                            borderLeft: '4px solid var(--accent-color)', borderRadius: '12px',
                            border: '1px solid var(--border-color)', borderLeftWidth: '4px'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Last Registered Unit
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                                {seqLoading ? '...' : String(seqInfo.lastSequence).padStart(4, '0')}
                            </div>
                        </div>
                        <div className="panel" style={{
                            padding: '1.5rem', background: 'var(--bg-secondary)',
                            borderLeft: '4px solid var(--success-color)', borderRadius: '12px',
                            border: '1px solid var(--border-color)', borderLeftWidth: '4px'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Next Available Sequence
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--success-color)' }}>
                                {seqLoading ? '...' : String(seqInfo.nextSequence).padStart(4, '0')}
                            </div>
                        </div>
                    </div>

                    {/* Configuration Panel */}
                    <div className="panel" style={{ padding: '0', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Batch Configuration</h3>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Configure print parameters for new barcode sequence generation.
                            </p>
                        </div>

                        <div style={{ padding: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>

                                <div>
                                    <label style={labelStyle}>Fiscal Year (YY)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={displayYear}
                                            readOnly
                                            disabled
                                            style={{ ...inputStyle, background: 'var(--bg-tertiary)', opacity: 0.7, cursor: 'not-allowed', fontFamily: 'monospace', fontWeight: '700' }}
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>LOCKED</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>{DENSITY_NAME}</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={size}
                                            onChange={(e) => setSize(e.target.value)}
                                            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                                        >
                                            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>▼</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Sheet Size</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={paperSize}
                                            onChange={(e) => setPaperSize(e.target.value)}
                                            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                                        >
                                            <option value="a4">A4 Sheet (210 x 297mm)</option>
                                            <option value="a3">A3 Sheet (297 x 420mm)</option>
                                        </select>
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>▼</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Batch Quantity (Units)</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="number"
                                            value={quantity}
                                            min="1"
                                            onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                        <button
                                            onClick={() => setQuantity(paperSize === 'a3' ? 44 : 24)}
                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 15px', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}
                                        >
                                            FILL PAGE
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.8rem', fontWeight: '600' }}>
                                        {paperSize === 'a3' ? 'Tip: A3 sheet holds 44 barcodes per page' : 'Tip: A4 sheet holds 24 barcodes per page'}
                                    </p>
                                </div>

                            </div>



                            <button
                                onClick={handleGenerate}
                                disabled={loading || !quantity || !size}
                                className="btn btn-primary"
                                style={{
                                    width: '100%', padding: '1.25rem', fontSize: '1rem', fontWeight: '700', letterSpacing: '0.02em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    opacity: loading || !quantity || !size ? 0.7 : 1, cursor: loading || !quantity || !size ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                        <span>PROCESSING SECURE EXPORT...</span>
                                    </>
                                ) : (
                                    <>
                                    <span>GENERATE PRODUCTION PDF</span>
                                </>
                            )}
                            </button>

                            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    Reprint Barcode
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="text"
                                        value={reprintValue}
                                        onChange={(e) => setReprintValue(e.target.value)}
                                        placeholder="Enter full barcode e.g. 26-42-0001"
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleReprint(reprintValue)}
                                        disabled={reprintLoading || !reprintValue.trim()}
                                        style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 1rem', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        {reprintLoading ? '...' : 'REPRINT'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Reprint updates barcode lifecycle history but does not change stock state.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrity Alert */}
                    {missingBarcodes.length > 0 && (
                        <div style={{ marginTop: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--error-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>!</div>
                                <h4 style={{ color: 'var(--error-color)', margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>INTEGRITY ALERT: Sequence Gap Detected</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                The system detected missing sequences in the current parameter set. These should be regenerated to maintain continuity.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {missingBarcodes.map((b) => (
                                    <span
                                        key={b.full_barcode}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontFamily: 'monospace',
                                            fontWeight: '700',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        {b.full_barcode}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {pendingMissing.length > 0 && (
                        <div style={{ marginTop: '1.5rem', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.08)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.06em', color: 'var(--warning-color)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                Pending Missing Queue
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {pendingMissing.slice(0, 12).map((item) => (
                                    <span
                                        key={item.barcode}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '999px',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            fontFamily: 'monospace',
                                            fontSize: '0.78rem',
                                            fontWeight: '700'
                                        }}
                                    >
                                        {item.barcode}
                                    </span>
                                ))}
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                These are the gaps the system detected. Resolve them later from the Missing Logs screen.
                            </div>
                        </div>
                    )}

                    {/* History Panel */}
                    <div className="panel" style={{ padding: '0', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '2rem' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Generation History</h3>
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Recent batch generations and PDF recovery.
                                </p>
                            </div>
                            <button onClick={fetchHistory} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                Refresh
                            </button>
                        </div>

                        <div style={{ padding: '0', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date & Time</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DENSITY_NAME}</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sheet</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sequence Range</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyLoading ? (
                                        <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</td></tr>
                                    ) : history.length === 0 ? (
                                        <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No recent generation history found.</td></tr>
                                    ) : history.map((h, i) => (
                                        <tr key={i} className="hover-row" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-primary)', fontWeight: '600' }}>{h.date}</td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--accent-color)', fontWeight: '700' }}>{h.size}</td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 'bold' }}>{(h.paperSize || 'A4').toUpperCase()}</td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{h.sequenceRange}</td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{h.count}</td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleReprint(h.barcodes.map((item) => item.full_barcode), h.paperSize || 'a4')}
                                                    disabled={reprintLoading}
                                                    style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                >
                                                    {reprintLoading ? 'Working...' : 'Reprint & PDF'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div >
            </div >

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .hover-row:hover { background: var(--bg-tertiary); }
            `}</style>
        </div >
    );
};

export default BarcodeGenerator;
