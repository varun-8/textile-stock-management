import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { useNavigate } from 'react-router-dom';
import { io } from "socket.io-client";
import { useConfig } from '../context/ConfigContext';

const BarcodeGenerator = () => {
    const { apiUrl } = useConfig();
    const navigate = useNavigate();
    const [year, setYear] = useState(new Date().getFullYear());
    const [size, setSize] = useState('');
    const [quantity, setQuantity] = useState(24);
    const [seqInfo, setSeqInfo] = useState({ lastSequence: 0, nextSequence: 1 });
    const [missingBarcodes, setMissingBarcodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [seqLoading, setSeqLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [sizes, setSizes] = useState([]);
    const MAX_PER_PAGE = 96; // 4 full pages of 24

    useEffect(() => {
        fetchSizes().then(() => {
            fetchSequence(); // This might depend on size being set, so we handle it carefully
        });
        fetchMissing();

        const socket = io(apiUrl);
        socket.on('sequence_update', (data) => {
            if (String(data.year) === String(year) && String(data.size) === String(size)) {
                setSeqInfo({ lastSequence: data.lastSequence, nextSequence: data.lastSequence + 1 });
            }
        });
        return () => socket.disconnect();
    }, [year, size, apiUrl]);

    const fetchSizes = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sizes`);
            const data = await res.json();
            setSizes(data.map(s => s.code));
            // Set default if not set and data exists
            if (data.length > 0 && !size) {
                setSize(data[0].code);
            }
        } catch (err) { console.error("Failed to fetch sizes", err); }
    };

    const fetchSequence = async () => {
        setSeqLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/sequence?year=${year}&size=${size}`);
            const data = await res.json();
            if (!data.error) setSeqInfo(data);
        } catch (err) { console.error(err); }
        finally { setSeqLoading(false); }
    };

    const fetchMissing = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/barcode/missing?year=${year}&size=${size}`);
            const data = await res.json();
            if (data.missing) setMissingBarcodes(data.missing);
        } catch (err) { console.error(err); }
    };

    const generatePDF = (barcodes) => {
        const doc = new jsPDF();

        // Professional Sizing: 3 columns x 8 rows = 24 per page
        const cols = 3;
        const rowsPerPage = 8;
        const startX = 15;
        const startY = 15;
        const cellWidth = 60;
        const cellHeight = 34;

        barcodes.forEach((item, index) => {
            const pageIndex = index % (cols * rowsPerPage);
            if (index > 0 && pageIndex === 0) {
                doc.addPage();
            }

            const col = pageIndex % cols;
            const row = Math.floor(pageIndex / cols);
            const x = startX + (col * cellWidth);
            const y = startY + (row * cellHeight);

            // Generate high-resolution barcode
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, item.full_barcode, {
                format: "CODE128",
                width: 4, // Higher resolution bars
                height: 80,
                displayValue: true,
                fontSize: 20,
                fontOptions: "bold",
                margin: 10,
                textMargin: 5
            });

            // Add to PDF with high-quality mapping (50mm x 25mm scaled)
            doc.addImage(canvas.toDataURL("image/png"), 'PNG', x, y, 50, 25);

            // Subtle border for cutting guide
            doc.setDrawColor(230);
            doc.setLineWidth(0.1);
            doc.rect(x, y, 50, 25);
        });

        doc.save(`PRO_Barcodes_${year}_${size}_${Date.now()}.pdf`);
    };

    const handleGenerate = async () => {
        setError(''); setSuccessMsg('');
        if (quantity > MAX_PER_PAGE) return setError(`Current system batch limit is ${MAX_PER_PAGE} units.`);

        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/barcode/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, size, quantity })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            generatePDF(data.barcodes);
            setSuccessMsg(`Production batch created: ${data.barcodes.length} Barcodes exported.`);
            fetchSequence();
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>

                {/* Header Block */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>LOGISTICS & TRACKING</div>
                    <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Sequence Generation</h1>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Sri Lakshmi Textiles Automated Barcode System</p>
                </div>

                {/* Sequence Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
                    <div className="panel glass" style={{ borderLeft: '4px solid var(--accent-color)', padding: '2rem' }}>
                        <span style={labelStyle}>Last Registered Unit</span>
                        <div style={{ fontSize: '3rem', fontWeight: '800', fontFamily: 'monospace', marginTop: '0.5rem' }}>
                            {seqLoading ? '...' : String(seqInfo.lastSequence).padStart(4, '0')}
                        </div>
                    </div>
                    <div className="panel glass" style={{ borderLeft: '4px solid var(--success-color)', padding: '2rem' }}>
                        <span style={labelStyle}>Next Available Sequence</span>
                        <div style={{ fontSize: '3rem', fontWeight: '800', fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--success-color)' }}>
                            {seqLoading ? '...' : String(seqInfo.nextSequence).padStart(4, '0')}
                        </div>
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="panel" style={{ background: 'var(--bg-secondary)', padding: '2.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>Batch Configuration</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
                        <div>
                            <label style={labelStyle}>Fiscal Year (YY)</label>
                            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Article Size Code</label>
                            <select value={size} onChange={(e) => setSize(e.target.value)} style={{ width: '100%' }}>
                                {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Batch Quantity</label>
                            <input type="number" value={quantity} min="1" max={MAX_PER_PAGE} onChange={(e) => setQuantity(parseInt(e.target.value) || '')} style={{ width: '100%' }} />
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.5rem' }}>One page limit: 24 barcodes</p>
                        </div>
                    </div>

                    {missingBarcodes.length > 0 && (
                        <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <span style={{ color: 'var(--error-color)', fontSize: '1.25rem' }}>⚠</span>
                                <h4 style={{ color: 'var(--error-color)', margin: 0 }}>INTEGRITY ALERT: Gap Detected</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.8 }}>Missing sequences detected in current parameter set:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {missingBarcodes.map(b => <span key={b.full_barcode} style={{ background: 'var(--bg-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: '700' }}>{b.full_barcode}</span>)}
                            </div>
                        </div>
                    )}

                    {error && <div style={{ background: 'var(--error-bg)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}><b>System Error:</b> {error}</div>}
                    {successMsg && <div style={{ background: 'var(--success-bg)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}><b>Export Ready:</b> {successMsg}</div>}

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !quantity}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1.25rem', fontSize: '1rem', letterSpacing: '0.05em' }}
                    >
                        {loading ? 'PROCESSING SECURE EXPORT...' : 'GENERATE PRODUCTION PDF'}
                    </button>
                </div>

                <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.75rem' }}>
                    SECURE SEQUENCE GENERATOR • AUTHORIZED ACCESS ONLY
                </div>
            </div>
        </div>
    );
};

const labelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' };

export default BarcodeGenerator;
