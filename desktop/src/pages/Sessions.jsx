import React, { useState, useEffect, useRef } from 'react';
import { IconBroadcast, IconPlus, IconTrash } from '../components/Icons';
import { io } from "socket.io-client";
import { useConfig } from '../context/ConfigContext';

const Sessions = () => {
    const { apiUrl } = useConfig();
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // New Session Form State
    const [sessionType, setSessionType] = useState('IN');
    const [targetSize, setTargetSize] = useState('40');
    const [sizes, setSizes] = useState([]);

    // History State
    const [history, setHistory] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewStats, setPreviewStats] = useState(null);
    const [previewItems, setPreviewItems] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);

    // Report Preview State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState(null);

    // Filters
    const [filterDate, setFilterDate] = useState('');

    // Live View State
    const [showLiveView, setShowLiveView] = useState(false);
    const [liveSession, setLiveSession] = useState(null);
    const [liveScans, setLiveScans] = useState([]);

    // Refs for Socket Listeners (To avoid constant reconnections)
    const liveViewRef = useRef(showLiveView);
    const liveSessionRef = useRef(liveSession);

    useEffect(() => {
        liveViewRef.current = showLiveView;
        liveSessionRef.current = liveSession;
    }, [showLiveView, liveSession]);

    // Socket Connection
    useEffect(() => {
        const socket = io(apiUrl, {
            rejectUnauthorized: false,
            transports: ['websocket', 'polling']
        });

        socket.on('stock_update', (data) => {
            // Use refs to check condition without needing effect to re-run
            if (liveViewRef.current && liveSessionRef.current && String(data.sessionId) === String(liveSessionRef.current._id)) {
                setLiveScans(prev => [data, ...prev].slice(0, 100)); // Keep last 100
            }
            // Also refresh stats if in list view
            if (!liveViewRef.current) {
                fetchSessions();
            }
        });

        socket.on('session_update', async (data) => {
            fetchSessions();
            fetchHistory();

            // Auto-update live session counts if it's the one being monitored
            if (liveViewRef.current && liveSessionRef.current && String(data.sessionId) === String(liveSessionRef.current._id)) {
                // Background fetch will handle liveSession update via sync effect
            }

            // Auto-show report when session ends
            if (data && data.action === 'ENDED' && data.sessionId) {
                try {
                    const res = await fetch(`${apiUrl}/api/sessions/${data.sessionId}/summary`);
                    const report = await res.json();
                    if (report.success) {
                        setReportData(report);
                        setShowReportModal(true);
                    }
                } catch (err) {
                    console.error("Failed to auto-load report", err);
                }
            }
        });

        return () => socket.disconnect();
    }, [apiUrl]);

    const openLiveView = async (session) => {
        setLiveSession(session);
        setLiveScans([]); // Clear previous
        setShowLiveView(true);

        // Fetch existing items for this session to populate the monitor immediately
        try {
            const res = await fetch(`${apiUrl}/api/sessions/${session._id}/preview`);
            const data = await res.json();
            if (data.success && data.items) {
                const historicScans = data.items.map(item => ({
                    barcode: item.barcode,
                    timestamp: item.scannedAt,
                    user: item.scannedBy,
                    details: {
                        metre: item.metre,
                        weight: item.weight
                    },
                    sessionId: session._id
                }));
                setLiveScans(historicScans);
            }
        } catch (err) {
            console.error("Failed to load session preview", err);
        }
    };

    const fetchSessions = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sessions/active`);
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to fetch sessions', err);
            setIsLoading(false);
        }
    };

    const fetchSizes = async () => {
        try {

            const resSizes = await fetch(`${apiUrl}/api/sizes`);
            const data = await resSizes.json();
            setSizes(data);
            if (data.length > 0 && !targetSize) setTargetSize(data[0].code);
        } catch (err) {
            console.error("Failed to fetch sizes", err);
        }
    }

    const fetchHistory = async () => {
        try {
            let url = `${apiUrl}/api/sessions/history`;
            const params = new URLSearchParams();
            if (filterDate) params.append('date', filterDate);

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            setHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch history', err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [filterDate]);

    useEffect(() => {
        fetchSessions();
        fetchHistory();
        fetchSizes();
        const interval = setInterval(() => {
            fetchSessions();
            fetchHistory();
        }, 2000); // Poll every 2 seconds for faster updates
        return () => clearInterval(interval);
    }, [apiUrl]);

    useEffect(() => {
        if (showLiveView && liveSession) {
            const updated = sessions.find(s => String(s._id) === String(liveSession._id));
            if (updated) setLiveSession(updated);
        }
    }, [sessions, showLiveView]);

    const handleCreateSession = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${apiUrl}/api/sessions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: sessionType,
                    targetSize: targetSize,
                    createdBy: 'Admin'
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowCreateModal(false);
                fetchSessions();
            }
        } catch (err) {
            console.error('Failed to create session', err);
        }
    };

    const initiateCloseSession = async (sessionId) => {
        try {
            const res = await fetch(`${apiUrl}/api/sessions/${sessionId}/preview`);
            const data = await res.json();
            if (data.success) {
                setPreviewStats(data.stats);
                setPreviewItems(data.items || []);
                setSelectedSessionId(sessionId);
                setShowPreview(true);
            } else {
                alert("Failed to get preview: " + data.error);
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const confirmCloseSession = async () => {
        if (!selectedSessionId) return;
        try {
            const res = await fetch(`${apiUrl}/api/sessions/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: selectedSessionId })
            });
            const data = await res.json();
            if (data.success) {
                setShowPreview(false);
                setSelectedSessionId(null);
                setPreviewStats(null);
                fetchSessions();
                fetchHistory();
            } else {
                alert("Failed to close: " + data.error);
            }
        } catch (err) {
            console.error("Failed to end session", err);
            alert("Error: " + err.message);
        }
    }

    const handleExport = (sessionId, type, size, reportType) => {
        const url = `${apiUrl}/api/sessions/${sessionId}/export/${reportType}`;
        window.open(url, '_blank');
    };

    const handleViewReport = async (sessionId) => {
        try {
            const res = await fetch(`${apiUrl}/api/sessions/${sessionId}/summary`);
            const data = await res.json();
            if (data.success) {
                setReportData(data);
                setShowReportModal(true);
            } else {
                alert("Failed to load report: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to connect to server");
        }
    };

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>

                {/* Header Block */}
                <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>REAL-TIME OPERATIONS</div>
                        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Active Sessions</h1>
                        <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Manage ongoing stock entry and dispatch sessions.</p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}><IconPlus /></span>
                        <span>Start New Session</span>
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>Loading active sessions...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        {sessions.length === 0 && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'transparent' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>📡</div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>No Active Sessions</h3>
                                <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>
                                    Start a new session to begin scanning operations.
                                </p>
                            </div>
                        )}

                        {sessions.map(session => {
                            const isIN = session.type === 'IN';
                            const statusColor = isIN ? 'var(--success-color)' : 'var(--error-color)';
                            const statusBg = isIN ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

                            return (
                                <div key={session._id} style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)',
                                    padding: '1.5rem',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                    }}
                                >
                                    {/* Top Bar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            background: statusBg,
                                            color: statusColor,
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            letterSpacing: '0.05em',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></span>
                                            {isIN ? 'STOCK IN' : 'DISPATCH'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                            {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>TARGET SIZE</div>
                                        <div style={{ fontSize: '3.5rem', fontWeight: '800', lineHeight: 1, color: 'var(--text-primary)' }}>
                                            {session.targetSize}
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-color)' }}>
                                                {session.scannedCount || 0}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SCANNED</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                {session.activeScanners ? session.activeScanners.length : 0}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)' }}>A. SCANNERS</div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <button
                                            onClick={() => openLiveView(session)}
                                            style={{
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)',
                                                border: '1px solid var(--border-color)',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                fontSize: '0.85rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        >
                                            <IconBroadcast size={16} /> Monitor
                                        </button>
                                        <button
                                            onClick={() => initiateCloseSession(session._id)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: 'var(--error-color)',
                                                border: '1px solid transparent',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                fontSize: '0.85rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'var(--error-color)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                e.currentTarget.style.color = 'var(--error-color)';
                                            }}
                                        >
                                            End Session
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* HISTORY SECTION */}
                <div style={{ marginTop: '4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Session History</h2>
                            <p style={{ opacity: 0.6, fontSize: '0.9rem', margin: 0 }}>Review and export reports from previous operations.</p>
                        </div>

                        {/* Date Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px 6px 6px 12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DATE:</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '600', outline: 'none', padding: '4px' }}
                            />
                            {filterDate && (
                                <button
                                    onClick={() => setFilterDate('')}
                                    style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '6px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                    title="Clear Date"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Date & Time</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Type</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Target Size</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Items Scanned</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '30%' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.3 }}>📅</div>
                                            No session history found for selected range.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map(s => (
                                        <tr key={s._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover:bg-white/5">
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {s.endedAt ? ` - ${new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em',
                                                    background: s.type === 'IN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: s.type === 'IN' ? 'var(--success-color)' : 'var(--error-color)',
                                                    border: `1px solid ${s.type === 'IN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                                }}>
                                                    {s.type === 'IN' ? 'STOCK IN' : 'DISPATCH'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: '700', fontSize: '1rem' }}>
                                                {s.targetSize}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem', fontWeight: '700' }}>
                                                {s.totalItems !== undefined ? s.totalItems : (s.scannedCount || 0)}
                                            </td>

                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleExport(s._id, s.type, s.targetSize, 'summary')}
                                                        className="btn"
                                                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                                        title="Download Excel Summary"
                                                    >
                                                        📊 Export
                                                    </button>
                                                    <button
                                                        onClick={() => handleViewReport(s._id)}
                                                        className="btn"
                                                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: 'var(--accent-color)' }}
                                                    >
                                                        👁️ View
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* LIVE VIEW MODAL */}
            {showLiveView && liveSession && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1100,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="panel animate-fade-in" style={{ width: '90%', maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        {/* Live Header */}
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="live-indicator">
                                    <span className="blink">●</span> LIVE FEED
                                </div>
                                <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Session Monitor</h2>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>target size {liveSession.targetSize} • {liveSession.type} Flow</div>
                                </div>
                            </div>
                            <button onClick={() => setShowLiveView(false)} className="btn" style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: 'transparent' }}>CLOSE MONITOR</button>
                        </div>

                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* Stats Side */}
                            <div style={{ width: '250px', padding: '1.5rem', borderRight: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.5rem' }}>ACTIVE SCANNERS</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-color)' }}>
                                        {liveSession.activeScanners ? liveSession.activeScanners.length : 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Devices Connected</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.5rem' }}>SESSION TOTAL</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                                        {liveSession.scannedCount || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Items Scanned</div>
                                </div>
                            </div>

                            {/* Live Feed */}
                            <div style={{ flex: 1, padding: '0', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                                {liveScans.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
                                        <p>Waiting for incoming scans...</p>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                            <tr>
                                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', opacity: 0.6 }}>TIME</th>
                                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', opacity: 0.6 }}>BARCODE</th>
                                                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', opacity: 0.6 }}>METRE</th>
                                                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', opacity: 0.6 }}>WEIGHT</th>
                                                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', opacity: 0.6 }}>USER</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {liveScans.map((scan, i) => (
                                                <tr key={i} className="animate-slide-in" style={{ borderBottom: '1px solid var(--border-color)', animationDelay: `${i * 0.05}s` }}>
                                                    <td style={{ padding: '12px 20px', fontFamily: 'monospace' }}>
                                                        {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontWeight: 'bold', color: 'var(--accent-color)', fontFamily: 'monospace' }}>
                                                        {scan.barcode}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>{scan.details?.metre}</td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>{scan.details?.weight}</td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', opacity: 0.8 }}>{scan.user || 'Unknown'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                    <style>{`
                        .blink { animation: blinker 1.5s linear infinite; color: var(--error-color); margin-right: 6px; }
                        @keyframes blinker { 50% { opacity: 0; } }
                        .live-indicator { display: flex; alignItems: center; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; color: var(--error-color); background: rgba(239, 68, 68, 0.1); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(239, 68, 68, 0.2); }
                    `}</style>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {showPreview && previewStats && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', padding: '0', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        <div style={{ padding: '2rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏁</div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>End Session?</h2>
                            <p style={{ opacity: 0.6 }}>Review the session summary before closing.</p>
                        </div>

                        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                            {/* Stats Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700' }}>{previewStats.totalCount}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700', letterSpacing: '1px' }}>ITEMS</div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success-color)' }}>{previewStats.totalWeight.toFixed(1)}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700', letterSpacing: '1px' }}>KG WEIGHT</div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-color)' }}>{previewStats.totalMetre.toFixed(1)}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700', letterSpacing: '1px' }}>TOTAL METRE</div>
                                </div>
                            </div>

                            {/* Items List */}
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', opacity: 0.8 }}>Item Details</h3>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                        <tr>
                                            <th style={{ padding: '12px', textAlign: 'left', opacity: 0.7 }}>Barcode</th>
                                            <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Metre</th>
                                            <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Weight</th>
                                            <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>User</th>
                                            <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewItems && previewItems.length > 0 ? (
                                            previewItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.barcode}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.metre}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.weight}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', opacity: 0.8 }}>{item.scannedBy}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', opacity: 0.6, fontSize: '0.8rem' }}>
                                                        {item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No items found</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', background: 'var(--bg-secondary)' }}>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="btn"
                                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCloseSession}
                                className="btn btn-primary"
                                style={{ flex: 2, background: 'var(--error-color)', border: 'none' }}
                            >
                                Confirm & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* REPORT PREVIEW MODAL */}
            {
                showReportModal && reportData && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 3000,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                    }}>
                        <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Session Report</h2>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>
                                        ID: {reportData.session._id} | Size: {reportData.session.targetSize} | {new Date(reportData.session.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '2rem', overflowY: 'auto' }}>

                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Employee Summary</h3>
                                <div style={{ marginBottom: '3rem', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                            <tr style={{ textAlign: 'left' }}>
                                                <th style={{ padding: '12px', opacity: 0.7 }}>Employee</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Count</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Tot. Metre</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Tot. Weight</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.stats.map((stat, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '12px', fontWeight: '600' }}>{stat._id || 'Unknown'}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{stat.count}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent-color)' }}>{stat.totalMetre.toFixed(2)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success-color)' }}>{stat.totalWeight.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            {/* Grand Total Row */}
                                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '16px', fontWeight: '800' }}>GRAND TOTAL</td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: '800' }}>
                                                    {reportData.stats.reduce((acc, curr) => acc + curr.count, 0)}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: '800', color: 'var(--accent-color)' }}>
                                                    {reportData.stats.reduce((acc, curr) => acc + curr.totalMetre, 0).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: '800', color: 'var(--success-color)' }}>
                                                    {reportData.stats.reduce((acc, curr) => acc + curr.totalWeight, 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Items List */}
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Detailed Items List</h3>
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                        <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                            <tr style={{ textAlign: 'left' }}>
                                                <th style={{ padding: '12px', opacity: 0.7 }}>Barcode</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Metre</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Weight</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>User</th>
                                                <th style={{ padding: '12px', textAlign: 'right', opacity: 0.7 }}>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.items && reportData.items.length > 0 ? (
                                                reportData.items.map((item, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.barcode}</td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.metre}</td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.weight}</td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', opacity: 0.8 }}>{item.scannedBy}</td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', opacity: 0.6, fontSize: '0.8rem' }}>
                                                            {item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No items found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', textAlign: 'right' }}>
                                <button className="btn" onClick={() => setShowReportModal(false)} style={{ padding: '8px 24px', background: 'var(--border-color)', border: 'none' }}>Close</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Modal */}
            {
                showCreateModal && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', position: 'relative' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>Start New Session</h2>

                            <form onSubmit={handleCreateSession}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', opacity: 0.7 }}>OPERATION TYPE</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setSessionType('IN')}
                                            style={{
                                                padding: '1rem', borderRadius: '12px', border: sessionType === 'IN' ? '2px solid var(--success-color)' : '1px solid var(--border-color)',
                                                background: sessionType === 'IN' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                color: sessionType === 'IN' ? 'var(--success-color)' : 'var(--text-secondary)',
                                                fontWeight: '700', cursor: 'pointer'
                                            }}
                                        >
                                            STOCK IN
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSessionType('OUT')}
                                            style={{
                                                padding: '1rem', borderRadius: '12px', border: sessionType === 'OUT' ? '2px solid var(--error-color)' : '1px solid var(--border-color)',
                                                background: sessionType === 'OUT' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                                color: sessionType === 'OUT' ? 'var(--error-color)' : 'var(--text-secondary)',
                                                fontWeight: '700', cursor: 'pointer'
                                            }}
                                        >
                                            STOCK OUT
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', opacity: 0.7 }}>TARGET SIZE</label>
                                    <select
                                        value={targetSize}
                                        onChange={(e) => setTargetSize(e.target.value)}
                                        style={{
                                            width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            borderRadius: '12px', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600', outline: 'none'
                                        }}
                                    >
                                        {sizes.map(s => (
                                            <option key={s._id} value={s.code}>{s.code}</option>
                                        ))}
                                        {sizes.length === 0 && <option value="40">40</option>}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="btn"
                                        style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ flex: 2 }}
                                    >
                                        Start Session
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};




export default Sessions;
