import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { DENSITY_NAME } from '../constants';

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' };

const DetailedStats = () => {
    const { type } = useParams();
    const navigate = useNavigate();
    const { apiUrl } = useConfig();

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sizes, setSizes] = useState([]);
    const [pieceModal, setPieceModal] = useState(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const [editItem, setEditItem] = useState(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        picSize: ''
    });

    const roundPieceLength = (value) => Math.round(value * 1000) / 1000;

    const totalEditPieces = (pieces) => pieces.reduce((sum, piece) => sum + (Number(piece.length) || 0), 0);

    const syncPiecesToDetails = (pieces, weight, percentage) => {
        const validPieces = pieces.filter((piece) => Number(piece.length) > 0);
        const totalMetre = totalEditPieces(validPieces);
        
        let nextPercentage = percentage;
        const w = parseFloat(weight);
        const m = parseFloat(totalMetre);
        if (!isNaN(w) && !isNaN(m) && m > 0 && w > 0) {
            nextPercentage = ((w / m) * 1000).toFixed(2);
        }

        return {
            pieces,
            metre: totalMetre > 0 ? roundPieceLength(totalMetre) : '',
            percentage: nextPercentage
        };
    };

    const handleEditChange = (field, value) => {
        setEditItem(prev => {
            if (!prev) return prev;
            
            const newDetails = { ...prev.details, [field]: value };
            
            if (field === 'weight') {
                const m = parseFloat(newDetails.metre || 0);
                const w = parseFloat(value || 0);
                if (!isNaN(m) && !isNaN(w) && m > 0 && w > 0) {
                    newDetails.percentage = ((w / m) * 1000).toFixed(2);
                }
            }
            
            return { ...prev, details: newDetails };
        });
    };

    const handlePieceLengthChange = (index, value) => {
        setEditItem((prev) => {
            if (!prev) return prev;

            const pieces = [...(prev.details.pieces || [])];
            pieces[index] = {
                ...pieces[index],
                length: value
            };

            return {
                ...prev,
                details: {
                    ...prev.details,
                    ...syncPiecesToDetails(pieces, prev.details.weight, prev.details.percentage)
                }
            };
        });
    };

    const addPieceRow = () => {
        setEditItem((prev) => {
            if (!prev) return prev;

            const pieces = [...(prev.details.pieces || []), { length: '', label: `Piece ${(prev.details.pieces || []).length + 1}` }];

            return {
                ...prev,
                details: {
                    ...prev.details,
                    pieces
                }
            };
        });
    };

    const removePieceRow = (index) => {
        setEditItem((prev) => {
            if (!prev) return prev;

            const remaining = (prev.details.pieces || [])
                .filter((_, pieceIndex) => pieceIndex !== index)
                .map((piece, pieceIndex) => ({
                    ...piece,
                    label: `Piece ${pieceIndex + 1}`
                }));

            const pieces = remaining.length > 0 ? remaining : [{ length: '', label: 'Piece 1' }];

            return {
                ...prev,
                details: {
                    ...prev.details,
                    ...syncPiecesToDetails(pieces, prev.details.weight, prev.details.percentage)
                }
            };
        });
    };

    const handleSaveEdit = async () => {
        if (!editItem) return;
        try {
            const isCreation = type === 'missingCount';
            const endpoint = isCreation ? `${apiUrl}/api/mobile/transaction` : `${apiUrl}/api/admin/inventory/update`;
            const method = isCreation ? 'POST' : 'PUT';

            const payload = {
                barcode: editItem.barcode,
                metre: parseFloat(editItem.details.metre || 0),
                pieces: Array.isArray(editItem.details.pieces) && editItem.details.pieces.length > 0 ? editItem.details.pieces : undefined,
                weight: parseFloat(editItem.details.weight || 0),
                percentage: parseFloat(editItem.details.percentage || 100),
                type: 'IN',
                status: 'IN'
            };

            if (payload.metre <= 0 || payload.weight <= 0) {
                return alert("Metric Error: Metre and Weight must be positive numbers.");
            }

            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(endpoint, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                if (isCreation) {
                    await fetch(`${apiUrl}/api/admin/missing/create-entry/${encodeURIComponent(editItem.barcode)}`, {
                        method: 'PATCH',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ note: 'Handled via Industrial Entry' })
                    });
                }
                setEditItem(null);
                setRefreshTick(x => x + 1);
            } else {
                alert(result.error || "System rejected transaction.");
            }
        } catch (err) {
            console.error(err);
            alert("Network link failed.");
        }
    };

    useEffect(() => {
        const fetchSizes = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/sizes`);
                const data = await res.json();
                setSizes(data);
            } catch (err) { console.error("Failed to fetch sizes", err); }
        };
        fetchSizes();
    }, [apiUrl]);

    useEffect(() => {
        const fetchData = async () => {
            if (!type) return;
            setLoading(true);
            try {
                let url = `${apiUrl}/api/stats/list/${type}?limit=all`;
                const params = new URLSearchParams();
                if (filters.startDate) params.append('startDate', filters.startDate);
                if (filters.endDate) params.append('endDate', filters.endDate);
                if (filters.picSize) params.append('articleSize', filters.picSize);

                const queryString = params.toString();
                if (queryString) {
                    url += `&${queryString}`;
                }

                const res = await fetch(url);
                const result = await res.json();

                const normalized = result.map(item => ({
                    time: new Date(item.updatedAt || item.detectedAt || item.createdAt).toLocaleString(),
                    dateObj: new Date(item.updatedAt || item.detectedAt || item.createdAt),
                    barcode: item.barcode,
                    type: type === 'missingCount'
                        ? (item.issueType || 'SEQUENCE_MISSING')
                        : (item.status || 'UNKNOWN'),
                    status: item.status || 'PENDING',
                    details: {
                        metre: parseFloat(item.metre || 0),
                        weight: parseFloat(item.weight || 0),
                        percentage: item.percentage,
                        pieces: item.pieces || []
                    },
                    employee: item.employeeName || item.userId
                }));

                setData(normalized);
            } catch (err) {
                console.error("Failed to fetch detailed data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [type, filters, apiUrl, refreshTick]);

    const resolveMissing = async (barcode, action) => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const routeMap = {
                MARK_LOST: 'lost',
                IGNORE: 'ignore'
            };

            const route = routeMap[action];
            if (!route) return;

            const res = await fetch(`${apiUrl}/api/admin/missing/${route}/${encodeURIComponent(barcode)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ note: action === 'MARK_LOST' ? 'Marked as lost' : 'Ignored by admin' })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Action failed');
            }

            setRefreshTick((x) => x + 1);
        } catch (err) {
            console.error('Failed to resolve missing entry', err);
            alert(err.message || 'Failed to resolve missing entry');
        }
    };

    const runSequenceAudit = async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/missing/audit-sequences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const out = await res.json();
            if (!res.ok) throw new Error(out.error || 'Audit failed');

            setRefreshTick((x) => x + 1);
            alert(`Audit complete: ${out.missingDetected} missing, ${out.created} created`);
        } catch (err) {
            console.error('Sequence audit failed', err);
            alert(err.message || 'Sequence audit failed');
        }
    };

    const summary = useMemo(() => {
        return data.reduce((acc, item) => ({
            totalCount: acc.totalCount + 1,
            totalMetre: acc.totalMetre + (item.details.metre || 0),
            totalWeight: acc.totalWeight + (item.details.weight || 0)
        }), { totalCount: 0, totalMetre: 0, totalWeight: 0 });
    }, [data]);

    const formatPieceLengths = (pieces, totalMetre) => {
        if (Array.isArray(pieces) && pieces.length > 1) {
            return pieces.map(piece => piece.length).join(' + ');
        }
        return totalMetre.toFixed(2);
    };

    const formatPieceDetails = (pieces, totalMetre) => {
        if (Array.isArray(pieces) && pieces.length > 1) {
            return pieces.map((piece, index) => `Piece ${index + 1}: ${piece.length}`).join('\n');
        }
        return `Piece 1: ${Number(totalMetre).toFixed(2)}`;
    };

    const hasMultiplePieces = (pieces) => Array.isArray(pieces) && pieces.length > 1;

    const handleExport = () => {
        if (!data.length) return alert("No data to export");
        try {
            const headers = ["Timestamp", "Barcode", "Status", "Metre", "Pieces", "Weight", "Quality %"];
            const rows = data.map(item => [
                `"${item.time}"`,
                item.barcode,
                item.type,
                item.details.metre,
                (item.details.pieces || []).length || 1,
                item.details.weight,
                item.details.percentage || ''
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Report_${type}_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Export failed", e);
        }
    };

    const themeColor = type === 'stockIn' ? 'var(--success-color)' :
        type === 'readyToDispatch' ? 'var(--accent-color)' :
        type === 'stockOut' ? 'var(--accent-color)' :
            'var(--text-primary)';

    const pageTitle = type === 'totalRolls' ? 'Inventory Portfolio' :
        type === 'stockIn' ? 'Inbound Analysis' :
            type === 'readyToDispatch' ? 'Dispatch Queue' :
            type === 'stockOut' ? 'Dispatch Logs' :
                type === 'missingCount' ? 'Missing Logs' : 'Detailed View';

    return (
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-fade-in">

            {/* --- Header --- */}
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
                    <div style={{ width: '1px', height: '32px', background: 'var(--border-color)' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${themeColor}15`, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                            {type === 'stockIn' ? '📥' : type === 'readyToDispatch' ? '📋' : type === 'stockOut' ? '🚛' : '📦'}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>{pageTitle}</h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                {type === 'missingCount' ? 'Resolve sequence gaps' : 'Detailed operational metrics'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {type === 'missingCount' && (
                        <button onClick={runSequenceAudit} className="btn-accent" style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', fontWeight: '700', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>
                            Run Sequence Audit
                        </button>
                    )}
                    <button onClick={handleExport} className="btn-secondary" style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', fontWeight: '700', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                        Export CSV
                    </button>
                </div>
            </header>

            {/* --- Metrics --- */}
            <div style={{ padding: '2rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <MetricCard 
                    label={type === 'missingCount' ? "Detected Gaps" : "Total Rolls"} 
                    value={summary.totalCount} 
                    icon="📊" 
                    color={type === 'missingCount' ? 'var(--error-color)' : 'var(--text-primary)'} 
                />
                <MetricCard label="Total Metre" value={summary.totalMetre.toLocaleString()} unit="M" icon="📏" color="#10b981" />
                <MetricCard label="Total Weight" value={summary.totalWeight.toLocaleString()} unit="KG" icon="⚖️" color="#6366f1" />
            </div>

            {/* --- Filters --- */}
            <div style={{ padding: '0 2.5rem 2rem 2.5rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <span style={labelStyle}>Article:</span>
                        <select value={filters.picSize} onChange={e => setFilters({ ...filters, picSize: e.target.value })} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontWeight: '600' }}>
                            <option value="">All Sizes</option>
                            {sizes.map(s => <option key={s._id} value={s.code}>{s.code}</option>)}
                        </select>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <span style={labelStyle}>From:</span>
                        <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }} />
                        <span style={labelStyle}>To:</span>
                        <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }} />
                    </div>
                </div>
            </div>

            {/* --- Table --- */}
            <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                {loading ? (
                    <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading inventory data...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10 }}>
                            <tr>
                                <th style={thStyle}>BARCODE</th>
                                <th style={thStyle}>ARTICLE</th>
                                <th style={thStyle}>{type === 'missingCount' ? 'ISSUE / STATE' : 'STATUS'}</th>
                                {type !== 'missingCount' && <th style={{ ...thStyle, textAlign: 'right' }}>METRE</th>}
                                {type !== 'missingCount' && <th style={{ ...thStyle, textAlign: 'right' }}>PIECES</th>}
                                {type !== 'missingCount' && <th style={{ ...thStyle, textAlign: 'right' }}>WEIGHT</th>}
                                {type !== 'missingCount' && <th style={thStyle}>OPERATOR</th>}
                                <th style={thStyle}>{type === 'missingCount' ? 'RESOLUTION ACTIONS' : 'TIMESTAMP'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr><td colSpan={10} style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching records found.</td></tr>
                            ) : data.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', cursor: hasMultiplePieces(row.details.pieces) ? 'pointer' : 'default' }} onClick={hasMultiplePieces(row.details.pieces) ? () => setPieceModal({ barcode: row.barcode, message: formatPieceDetails(row.details.pieces, row.details.metre) }) : undefined}>
                                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{row.barcode}</span></td>
                                    <td style={tdStyle}>{row.barcode.split('-')[1] || '-'}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <StatusChip type={row.type} />
                                            {type === 'missingCount' && <StatusChip type={row.status} />}
                                        </div>
                                    </td>
                                    {type !== 'missingCount' && <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: 'var(--success-color)' }}>{row.details.metre.toFixed(2)}</td>}
                                    {type !== 'missingCount' && <td style={{ ...tdStyle, textAlign: 'right' }}>{(row.details.pieces || []).length || 1}</td>}
                                    {type !== 'missingCount' && <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: 'var(--accent-color)' }}>{row.details.weight.toFixed(2)}</td>}
                                    {type !== 'missingCount' && <td style={tdStyle}>{row.employee || '-'}</td>}
                                    <td style={tdStyle}>
                                        {type === 'missingCount' ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); resolveMissing(row.barcode, 'MARK_LOST'); }} style={{ padding: '6px 10px', fontSize: '0.7rem', border: '1px solid var(--error-color)', color: 'var(--error-color)', background: 'transparent', borderRadius: '4px', cursor: 'pointer' }}>LOST</button>
                                                <button onClick={(e) => { e.stopPropagation(); setEditItem({ barcode: row.barcode, details: { metre: '', pieces: [{ length: '', label: 'Piece 1' }], weight: '', percentage: '100' } }); }} style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>STOCK IN</button>
                                                <button onClick={(e) => { e.stopPropagation(); resolveMissing(row.barcode, 'IGNORE'); }} style={{ padding: '6px 10px', fontSize: '0.7rem', border: 'none', background: 'var(--bg-tertiary)', borderRadius: '4px', cursor: 'pointer' }}>IGNORE</button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{row.time}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- Modals --- */}
            {pieceModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="panel animate-fade-in" style={{ width: '400px' }}>
                        <h3>Piece Breakdown: {pieceModal.barcode}</h3>
                        <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>{pieceModal.message}</p>
                        <button className="btn btn-secondary" onClick={() => setPieceModal(null)} style={{ marginTop: '1rem', width: '100%' }}>Close</button>
                    </div>
                </div>
            )}

            {editItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
                    <div className="panel animate-fade-in" style={{ width: '400px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Industrial Entry: {editItem.barcode}</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Total Metre (Calculated)</label>
                                <input type="text" value={editItem.details.metre} readOnly style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', opacity: 0.8 }} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={labelStyle}>Pieces</label>
                                    <button onClick={addPieceRow} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>+ Add</button>
                                </div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                                    {editItem.details.pieces.map((p, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                            <input 
                                                type="text" 
                                                inputMode="decimal"
                                                autoFocus={idx === 0}
                                                value={p.length} 
                                                onChange={e => handlePieceLengthChange(idx, e.target.value)} 
                                                placeholder="Length" 
                                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} 
                                            />
                                            <button onClick={() => removePieceRow(idx)} style={{ background: 'transparent', border: 'none' }}>🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Weight (KG)</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={editItem.details.weight} 
                                    onChange={e => handleEditChange('weight', e.target.value)} 
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }} 
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 1 }}>SAVE & STOCK IN</button>
                            <button onClick={() => setEditItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ label, value, unit, icon, color }) => (
    <div style={{ background: 'var(--bg-tertiary)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</span>
            <span>{icon}</span>
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: color }}>
            {value} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>{unit}</span>
        </div>
    </div>
);

const StatusChip = ({ type }) => {
    const styleMap = {
        IN: { bg: 'var(--success-bg)', color: 'var(--success-color)', label: 'IN' },
        RESERVED: { bg: 'var(--accent-bg)', color: 'var(--accent-color)', label: 'RES' },
        OUT: { bg: 'var(--accent-bg)', color: 'var(--accent-color)', label: 'OUT' },
        PENDING: { bg: 'var(--error-bg)', color: 'var(--error-color)', label: 'PEND' },
        RESOLVED: { bg: 'var(--success-bg)', color: 'var(--success-color)', label: 'OK' },
        IGNORED: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', label: 'IGN' },
        LOST: { bg: 'var(--error-bg)', color: 'var(--error-color)', label: 'LOST' },
        SEQUENCE_MISSING: { bg: 'var(--error-bg)', color: 'var(--error-color)', label: 'GAP' }
    };
    const conf = styleMap[type] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', label: type };
    return (
        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '900', background: conf.bg, color: conf.color, minWidth: '40px', textAlign: 'center' }}>
            {conf.label}
        </span>
    );
};

const thStyle = { padding: '1rem', textAlign: 'left', fontWeight: '800', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '1rem', fontSize: '0.85rem' };

export default DetailedStats;
