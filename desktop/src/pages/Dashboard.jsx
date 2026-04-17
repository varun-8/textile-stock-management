import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { io } from "socket.io-client";

/* eslint-disable react-hooks/set-state-in-effect */


// --- Icons ---
const IconBox = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
const IconScan = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>;
const IconSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconCloud = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11.91 4.9" /><path d="M12 13v8" /><path d="m15 18-3 3-3-3" /></svg>;

const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconTrash = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const IconSignal = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 20V4" /></svg>;

const roundPieceLength = (value) => Math.round(value * 1000) / 1000;

const normalizeEditPieces = (pieces, fallbackMetre) => {
    if (Array.isArray(pieces) && pieces.length > 0) {
        const normalized = pieces
            .map((piece, index) => {
                const length = Number(typeof piece === 'number' ? piece : piece?.length);
                if (!Number.isFinite(length) || length <= 0) {
                    return null;
                }

                return {
                    length: roundPieceLength(length),
                    label: typeof piece === 'number' ? `Piece ${index + 1}` : (piece?.label || `Piece ${index + 1}`)
                };
            })
            .filter(Boolean);

        if (normalized.length > 0) {
            return normalized;
        }
    }

    const metre = Number(fallbackMetre);
    if (Number.isFinite(metre) && metre > 0) {
        return [{ length: roundPieceLength(metre), label: 'Piece 1' }];
    }

    return [{ length: '', label: 'Piece 1' }];
};

const totalEditPieces = (pieces) => pieces.reduce((sum, piece) => sum + (Number(piece.length) || 0), 0);


const Dashboard = () => {
    const navigate = useNavigate();
    const { apiUrl } = useConfig();

    const [missingCount, setMissingCount] = useState(0);
    const [stats, setStats] = useState([
        { label: 'Total Inventory', value: '0', change: 'System Total', key: 'totalRolls', color: 'var(--text-secondary)', icon: 'INV' },
        { label: 'In Stock', value: '0', change: 'Available (IN)', key: 'stockIn', color: 'var(--success-color)', icon: 'IN' },
        { label: 'Ready to Dispatch', value: '0', change: 'Reserved (RESERVED)', key: 'readyToDispatch', color: 'var(--accent-color)', icon: 'RDY' },
        { label: 'Out Stock', value: '0', change: 'Dispatched (OUT)', key: 'stockOut', color: 'var(--accent-color)', icon: 'OUT' }
    ]);

    const [recentLogs, setRecentLogs] = useState([]);
    const activeTab = 'LIVE';

    // Filters for "Recent Logs" only (Live view)
    const [searchTerm, setSearchTerm] = useState('');
    const [editItem, setEditItem] = useState(null);

    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const showModal = (type, title, message, onConfirm = null) => {
        setModalConfig({ isOpen: true, type, title, message, onConfirm });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/stats/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setMissingCount(data.missingCount || 0);
            setStats([
                { label: 'Total Inventory', value: data.totalRolls, change: 'IN + RESERVED in Godown', key: 'totalRolls', color: 'var(--text-secondary)', icon: 'INV' },
                { label: 'In Stock', value: data.inStock ?? data.stockIn, change: 'Ready for use (IN)', key: 'stockIn', color: 'var(--success-color)', icon: 'IN' },
                { label: 'Ready to Dispatch', value: data.readyToDispatch ?? 0, change: 'Picked but not dispatched', key: 'readyToDispatch', color: 'var(--accent-color)', icon: 'RDY' },
                { label: 'Out Stock', value: data.stockOut ?? 0, change: 'Already dispatched (OUT)', key: 'stockOut', color: 'var(--accent-color)', icon: 'OUT' }
            ]);
        } catch (err) { console.error(err); }
    }, [apiUrl]);

    const fetchRecentLogs = useCallback(async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/stats/list/recent?limit=50`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            
            if (!Array.isArray(data)) {
                console.error('Expected array for recent logs, received:', data);
                setRecentLogs([]);
                return;
            }
            
            const normalized = data.map(item => ({
                time: new Date(item.updatedAt || item.detectedAt || item.createdAt).toLocaleString(),
                barcode: item.barcode || 'UNKNOWN',
                type: item.status || 'UNKNOWN',
                details: { metre: item.metre, weight: item.weight, percentage: item.percentage, pieces: item.pieces || [] },
                employee: item.employeeName || item.userId || 'System'
            }));
            setRecentLogs(normalized);
        } catch (err) { console.error(err); }
    }, [apiUrl]);

    useEffect(() => {
        fetchStats();
        if (activeTab === 'LIVE') fetchRecentLogs();

        const socketOptions = import.meta.env.DEV
            ? { transports: ['polling'], upgrade: false }
            : { transports: ['websocket', 'polling'] };

        const socket = io(apiUrl, socketOptions);
        socket.on('stock_update', (data) => {
            if (activeTab === 'LIVE') {
                const newLog = {
                    time: new Date().toLocaleTimeString(),
                    barcode: data.barcode,
                    type: data.type,
                    details: data.details,
                    employee: data.user || 'System'
                };
                setRecentLogs(prev => [newLog, ...prev]);
            }
            fetchStats();
        });

        socket.on('session_update', () => {
            fetchStats();
        });

        return () => socket.disconnect();
    }, [apiUrl, activeTab, fetchRecentLogs, fetchStats]);


    const handleCardClick = (key) => {
        // Navigate to the detailed view page
        navigate(`/dashboard/${key}`);
    };

    const handleEditChange = (field, value) => {
        setEditItem(prev => {
            if (!prev) return prev;
            
            const newDetails = { ...prev.details, [field]: value };
            
            // Auto-calculate percentage if metre or weight changes
            if (field === 'metre' || field === 'weight') {
                const m = parseFloat(newDetails.metre || 0);
                const w = parseFloat(newDetails.weight || 0);
                if (m > 0 && w > 0) {
                    newDetails.percentage = ((w / m) * 1000).toFixed(2);
                }
            }
            
            return { ...prev, details: newDetails };
        });
    };

    const syncPiecesToDetails = (pieces, weight, percentage) => {
        const validPieces = pieces.filter((piece) => Number(piece.length) > 0);
        const totalMetre = totalEditPieces(validPieces);
        const nextPercentage = totalMetre > 0 && Number(weight) > 0
            ? ((Number(weight) / totalMetre) * 1000).toFixed(2)
            : percentage;

        return {
            pieces,
            metre: totalMetre > 0 ? roundPieceLength(totalMetre) : '',
            percentage: nextPercentage
        };
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
            const isMissingResolve = activeTab === 'missingCount'; // Not really used in LIVE view but kept for safety if we reuse logic
            const endpoint = isMissingResolve ? `${apiUrl}/api/mobile/transaction` : `${apiUrl}/api/admin/inventory/update`;
            const method = isMissingResolve ? 'POST' : 'PUT';

            // Standardize payloads
            const payload = {
                barcode: editItem.barcode,
                metre: parseFloat(editItem.details.metre || 0),
                pieces: Array.isArray(editItem.details.pieces) && editItem.details.pieces.length > 0 ? editItem.details.pieces : undefined,
                weight: parseFloat(editItem.details.weight || 0),
                percentage: parseFloat(editItem.details.percentage || 100),
                type: editItem.type || 'IN',
                status: editItem.type || 'IN'
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
                setEditItem(null);
                fetchRecentLogs();
                fetchStats();
            } else {
                alert(result.error || "System rejected transaction. Verify data format.");
            }
        } catch (err) {
            console.error(err);
            alert("Network link failed. Verify server connectivity.");
        }
    };

    const displayList = (() => {
        // Only showing recent logs on dashboard now
        const rawList = recentLogs;
        if (!Array.isArray(rawList)) return [];
        return rawList.filter(log => {
            const term = searchTerm.toLowerCase();
            return (log.barcode || '').toLowerCase().includes(term) || (log.type || '').toLowerCase().includes(term);
        });
    })();


    const formatPieceDetails = (pieces, totalMetre) => {
        if (Array.isArray(pieces) && pieces.length > 1) {
            return pieces
                .map((piece, index) => `Piece ${index + 1}: ${piece.length}`)
                .join('\n');
        }
        return `Piece 1: ${totalMetre}`;
    };

    const hasMultiplePieces = (pieces) => Array.isArray(pieces) && pieces.length > 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

            {/* Header (Drag area) */}
            <header style={{
                padding: '1rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 5
            }} className="app-region-drag">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }} className="app-region-no-drag">
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                            Operations Dashboard
                        </h1>
                        <p style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.6 }}>SYSTEM OPERATIONAL • {new Date().toDateString().toUpperCase()}</p>
                    </div>

                </div>

                <div className="app-region-no-drag" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    {missingCount > 0 && (
                        <div 
                            onClick={() => handleCardClick('missingCount')}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.6rem',
                                padding: '0.5rem 1rem',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                animation: 'pulse-soft 2s infinite ease-in-out'
                            }}
                            title="Missing Sequence Logs - Action Required"
                        >
                            <span style={{ fontSize: '1.1rem' }}>!</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--error-color)', lineHeight: 1.1 }}>{missingCount}</span>
                                <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--error-color)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Missing</span>
                            </div>
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search recent logs..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '320px',
                                background: 'var(--bg-primary)',
                                paddingLeft: '2.8rem',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                height: '42px'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>🔍</span>
                    </div>
                </div>
            </header>

            {/* Page View with Padded Inset */}
            <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }} className="animate-fade-in native-scroll">

                {/* Industrial Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className="panel glass"
                            onClick={() => handleCardClick(stat.key)}
                            title="Click for Detailed Report"
                            style={{
                                cursor: 'pointer',
                                borderTop: `4px solid ${stat.color}`,
                                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                padding: '1.8rem',
                                position: 'relative'
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', margin: '0.75rem 0', letterSpacing: '-0.03em' }}>{stat.value}</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>{stat.icon}</div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }}></span>
                                {stat.change}
                            </div>
                            <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0, transition: 'opacity 0.2s', fontSize: '0.7rem' }} className="hover-hint">
                                View Details ↗
                            </div>
                        </div>
                    ))}
                </div>

                <style>{`
                    .panel:hover .hover-hint { opacity: 0.6 !important; }
                `}</style>

                {/* Content Table Area */}
                <div className="panel" style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                                Real-time Operations Log
                            </h2>
                        </div>
                    </div>

                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--table-header-bg)' }}>
                                <tr>
                                    <th style={thStyle}>TIMESTAMPS</th>
                                    <th style={thStyle}>BARCODE ID</th>
                                    <th style={thStyle}>FLOW STATUS</th>
                                    <th style={thStyle}>METRICS (M/KG)</th>
                                    <th style={thStyle}>OPERATOR</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>CONTROL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayList.length === 0 ? (
                                    <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No transactions recorded in this period.</td></tr>
                                ) : displayList.map((log, i) => {
                                    return (
                                        <tr
                                            key={i}
                                            onClick={hasMultiplePieces(log.details.pieces)
                                                ? () => showModal('info', `Piece Lengths - ${log.barcode}`, formatPieceDetails(log.details.pieces, log.details.metre))
                                                : undefined}
                                            style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                background: i % 2 === 0 ? 'var(--row-alt-bg)' : 'transparent',
                                                cursor: hasMultiplePieces(log.details.pieces) ? 'pointer' : 'default'
                                            }}
                                        >
                                            <td style={tdStyle}><span style={{ opacity: 0.8, fontWeight: '500' }}>{log.time}</span></td>
                                            <td style={{ ...tdStyle, fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-color)', fontFamily: 'monospace' }}>{log.barcode}</td>
                                            <td style={tdStyle}>
                                                <StatusBadge type={log.type} />
                                            </td>
                                            <td style={tdStyle}>
                                                {log.details?.metre ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                                                        <Metric label="M" value={log.details.metre} />
                                                        <Metric label="KG" value={log.details.weight} />
                                                        <Metric
                                                            label="PCS"
                                                            value={Array.isArray(log.details.pieces) && log.details.pieces.length > 0 ? log.details.pieces.length : 1}
                                                        />
                                                        <Metric label="Q" value={Number(log.details.percentage).toFixed(2) + '%'} color={Number(log.details.percentage) < 80 ? 'var(--warning-color)' : 'var(--text-secondary)'} />
                                                    </div>
                                                ) : <span style={{ opacity: 0.4 }}>PENDING REGISTRATION</span>}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', opacity: 0.9 }}>
                                                    {log.employee || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>System</span>}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        const isInvalidType = log.type === 'MISSING' || log.type === 'PENDING' || !log.type;
                                                        setEditItem({
                                                            ...log,
                                                            type: isInvalidType ? 'IN' : (log.type === 'OUT' ? 'OUT' : 'IN'),
                                                            details: {
                                                                metre: log.details.metre || '',
                                                                pieces: normalizeEditPieces(log.details.pieces, log.details.metre),
                                                                weight: log.details.weight || '',
                                                                percentage: log.details.percentage || '100'
                                                            }
                                                        });
                                                    }}
                                                    className="btn"
                                                    title="Edit"
                                                    style={{
                                                        padding: '8px',
                                                        fontSize: '11px',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'inherit',
                                                        border: 'none',
                                                        fontWeight: '800',
                                                        borderRadius: '8px',
                                                        minWidth: '36px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <IconEdit />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Edit Modal */}
            {
                editItem && (
                    <div style={modalOverlayStyle}>
                        <div className="panel animate-fade-in" style={{ width: '400px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Adjust Roll Parameters</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '1.5rem', fontWeight: '700' }}>ROLL ID: {editItem.barcode}</p>

                            <div style={{ display: 'grid', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                <div>
                                    <label style={labelStyle}>Length (Metres)</label>
                                    <input type="number" value={editItem.details.metre} readOnly style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed' }} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Piece Lengths</label>
                                        <button
                                            type="button"
                                            onClick={addPieceRow}
                                            className="btn"
                                            style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: '700' }}
                                        >
                                            + Add Piece
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                                        {(editItem.details.pieces || []).map((piece, index) => (
                                            <div key={piece.label || index} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={piece.length}
                                                    placeholder={`Piece ${index + 1} length`}
                                                    onChange={e => handlePieceLengthChange(index, e.target.value)}
                                                    style={{ width: '100%' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removePieceRow(index)}
                                                    className="btn"
                                                    title={`Remove Piece ${index + 1}`}
                                                    style={{
                                                        padding: '8px',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'var(--bg-primary)',
                                                        minWidth: '40px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <IconTrash />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Weight (Kilograms)</label>
                                    <input type="number" value={editItem.details.weight} onChange={e => handleEditChange('weight', e.target.value)} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Quality Index (%)</label>
                                    <input type="number" value={editItem.details.percentage} onChange={e => handleEditChange('percentage', e.target.value)} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Flow Status</label>
                                    <select
                                        value={editItem.type}
                                        onChange={e => setEditItem({ ...editItem, type: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                    >
                                        <option value="IN">STOCK-IN</option>
                                        <option value="OUT">DISPATCH (OUT)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 1 }}>SAVE CHANGES</button>
                                <button onClick={() => setEditItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>DISCARD</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Custom Confirmation Modal */}
            {modalConfig.isOpen && (
                <div style={modalOverlayStyle}>
                    <div className="panel animate-fade-in" style={{ width: '400px', borderTop: `4px solid ${modalConfig.type === 'error' ? 'var(--error-color)' : (modalConfig.type === 'success' ? 'var(--success-color)' : 'var(--accent-color)')}` }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    color: modalConfig.type === 'error' ? 'var(--error-color)' : (modalConfig.type === 'success' ? 'var(--success-color)' : 'var(--accent-color)')
                                }}>
                                    {modalConfig.type === 'error' ? '!' : (modalConfig.type === 'success' ? 'OK' : 'i')}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>{modalConfig.title}</h3>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-line' }}>
                                {modalConfig.message}
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                {modalConfig.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
                                        <button onClick={() => { modalConfig.onConfirm(); closeModal(); }} className="btn btn-primary">Confirm</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="btn btn-secondary" style={{ width: '100%' }}>Close</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};


// --- Sub-components ---

const StatusBadge = ({ type }) => {
    const isSuccess = type === 'IN' || type === 'RESOLVED';
    const isOut = type === 'OUT';
    return (
        <span style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
            background: isSuccess ? 'var(--success-bg)' : (isOut ? 'rgba(99, 102, 241, 0.1)' : 'var(--error-bg)'),
            color: isSuccess ? 'var(--success-color)' : (isOut ? 'var(--accent-color)' : 'var(--error-color)'),
            border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}`
        }}>
            {type === 'IN' ? 'STOCK-IN' : (type === 'OUT' ? 'DISPATCH' : type)}
        </span>
    );
};

const Metric = ({ label, value, color, wide = false, onClick }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: 'column',
            gap: '2px',
            background: 'var(--bg-primary)',
            padding: '0.4rem 0.6rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            minWidth: wide ? '140px' : '70px',
            cursor: onClick ? 'pointer' : 'default'
        }}
    >
        <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: '1.2rem', fontWeight: '800', color: color || 'inherit', fontFamily: 'monospace' }}>{value}</span>
    </div>
);

// --- Styles ---
const thStyle = { padding: '1rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' };
const tdStyle = { padding: '0.8rem 1rem', fontSize: '1rem', fontWeight: '500' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 };

export default Dashboard;
