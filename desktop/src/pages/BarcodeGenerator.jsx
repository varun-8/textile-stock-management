import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { useNavigate } from 'react-router-dom';
import { io } from "socket.io-client";
import { useConfig } from '../context/ConfigContext';
import { IconBox } from '../components/Icons';

const BarcodeGenerator = () => {
    const { apiUrl } = useConfig();
    const navigate = useNavigate();
    const [year, setYear] = useState(new Date().getFullYear());
    // Auto-format year to 2-digits if needed, but usually full year is stored, displayed as 2-digit
    const displayYear = String(year).slice(-2);

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
            if (data.length > 0 && !size) {
                setSize(data[0].code);
            }
            return data;
        } catch (err) { console.error("Failed to fetch sizes", err); return []; }
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

            const canvas = document.createElement('canvas');
            JsBarcode(canvas, item.full_barcode, {
                format: "CODE128", width: 4, height: 80, displayValue: true, fontSize: 20, fontOptions: "bold", margin: 10, textMargin: 5
            });

            doc.addImage(canvas.toDataURL("image/png"), 'PNG', x, y, 50, 25);
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
            fetchSequence(); // Refresh header
            fetchMissing(); // Refresh missing list
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
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
                                    <label style={labelStyle}>Article Size Code</label>
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
                                    <label style={labelStyle}>Batch Quantity (Units)</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        min="1"
                                        max={MAX_PER_PAGE}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
                                        style={inputStyle}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                        Max Limit: {MAX_PER_PAGE} units per batch
                                    </p>
                                </div>
                            </div>

                            {/* Integrity Alert */}
                            {missingBarcodes.length > 0 && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--error-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>!</div>
                                        <h4 style={{ color: 'var(--error-color)', margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>INTEGRITY ALERT: Sequence Gap Detected</h4>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                        The system detected missing sequences in the current parameter set. These should be regenerated to maintain continuity.
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {missingBarcodes.map(b => (
                                            <span key={b.full_barcode} style={{
                                                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem',
                                                fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)'
                                            }}>
                                                {b.full_barcode}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div style={{ background: 'var(--error-bg)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            {successMsg && (
                                <div style={{ background: 'var(--success-bg)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span>✅</span> {successMsg}
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={loading || !quantity}
                                className="btn btn-primary"
                                style={{
                                    width: '100%', padding: '1.25rem', fontSize: '1rem', fontWeight: '700', letterSpacing: '0.02em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    opacity: loading || !quantity ? 0.7 : 1, cursor: loading || !quantity ? 'not-allowed' : 'pointer'
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
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default BarcodeGenerator;
