import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';

const SessionManager = () => {
    const navigate = useNavigate();
    const { api, scannerId, employee } = useMobile();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Create Form
    const [newType, setNewType] = useState('IN');
    const [newSize, setNewSize] = useState('40');
    const [sizes, setSizes] = useState([]);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/api/sessions/active');
            const data = res.data;
            setSessions(Array.isArray(data) ? data : []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const fetchSizes = async () => {
        try {
            const res = await api.get('/api/sizes');
            const data = res.data;
            setSizes(data);
            if (data.length > 0) setNewSize(data[0].code);
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        fetchSessions();
        fetchSizes();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleJoin = async (session) => {
        try {
            const res = await api.post('/api/sessions/join', { sessionId: session._id, scannerId });
            const data = res.data;
            if (data.success) {
                localStorage.setItem('active_session_id', session._id);
                localStorage.setItem('active_session_type', session.type);
                localStorage.setItem('active_session_size', session.targetSize);
                navigate('/');
            }
        } catch (err) {
            alert('Failed to join session');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/sessions/create', {
                type: newType,
                targetSize: newSize,
                createdBy: employee ? employee.name : `Scanner ${scannerId ? scannerId.slice(0, 4) : 'Mobile'}`
            });
            const data = res.data;
            if (data.success) {
                setShowCreate(false);
                fetchSessions();
            }
        } catch (err) {
            alert('Failed to create session');
        }
    };

    // WorkScreen Theme (Inline Styles to match user preference)
    const THEME = {
        primary: '#0f172a',
        secondary: '#1e293b',
        accent: '#6366f1',
        text: '#f8fafc',
        textMuted: '#94a3b8',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        border: '#334155',
        surface: 'rgba(30, 41, 59, 0.7)'
    };

    const cardStyle = {
        background: THEME.secondary,
        borderRadius: '16px',
        border: `1px solid ${THEME.border}`,
        padding: '20px',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    };

    const btnStyle = (color) => ({
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        background: color || THEME.accent,
        color: 'white',
        border: 'none',
        fontSize: '16px',
        fontWeight: '700',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });

    const modalOverlayStyle = {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    };

    const modalContentStyle = {
        background: THEME.secondary,
        width: '90%', maxWidth: '400px',
        borderRadius: '24px',
        padding: '24px',
        border: `1px solid ${THEME.border}`,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
    };

    return (
        <div style={{ minHeight: '100vh', background: THEME.primary, padding: '20px', paddingBottom: '100px', fontFamily: '"Outfit", sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: THEME.text, margin: 0 }}>Active Sessions</h1>
                    <p style={{ color: THEME.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Select a session to join</p>
                </div>
                <button
                    onClick={fetchSessions}
                    style={{
                        padding: '12px', background: THEME.secondary, borderRadius: '12px',
                        border: `1px solid ${THEME.border}`, color: THEME.accent, cursor: 'pointer'
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', opacity: 0.5 }}>
                    <div style={{ width: '32px', height: '32px', border: `2px solid ${THEME.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: THEME.textMuted }}>Loading sessions...</div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sessions.length === 0 && (
                        <div style={{
                            textAlign: 'center', padding: '48px 24px', background: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: '16px', border: `1px dashed ${THEME.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center'
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>📡</div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: THEME.text, margin: '0 0 8px 0' }}>No Active Sessions</h3>
                            <p style={{ color: THEME.textMuted, fontSize: '14px' }}>There are no sessions currently running.</p>
                        </div>
                    )}

                    {sessions.map(session => (
                        <div key={session._id} style={{ ...cardStyle }}>
                            <div style={{
                                position: 'absolute', top: 0, bottom: 0, left: 0, width: '6px',
                                background: session.type === 'IN' ? THEME.success : THEME.error
                            }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingLeft: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px',
                                            background: session.type === 'IN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: session.type === 'IN' ? THEME.success : THEME.error,
                                            border: `1px solid ${session.type === 'IN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                        }}>
                                            {session.type === 'IN' ? '📥 STOCK IN' : '📤 DISPATCH'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: THEME.textMuted, fontFamily: 'monospace' }}>
                                            {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'white', margin: 0, lineHeight: 1 }}>
                                        Size <span style={{ color: THEME.accent }}>{session.targetSize}</span>
                                    </h2>
                                    <div style={{ fontSize: '12px', color: THEME.textMuted, fontWeight: '500', marginTop: '4px' }}>
                                        By {session.createdBy}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        background: 'rgba(15, 23, 42, 0.5)', padding: '8px 12px', borderRadius: '8px',
                                        border: `1px solid ${THEME.border}`, backdropFilter: 'blur(4px)'
                                    }}>
                                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'white', textAlign: 'center', lineHeight: 1, marginBottom: '2px' }}>
                                            {session.activeScanners ? session.activeScanners.length : 0}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: '700', color: THEME.textMuted, textTransform: 'uppercase' }}>DEVICES</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                paddingLeft: '12px', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid rgba(255,255,255,0.05)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', marginLeft: '8px' }}>
                                    {[...Array(Math.min(3, session.activeScanners?.length || 0))].map((_, i) => (
                                        <div key={i} style={{
                                            width: '24px', height: '24px', borderRadius: '50%', background: '#334155', border: '2px solid #1e293b',
                                            marginLeft: '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white'
                                        }}>📱</div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleJoin(session)}
                                    style={{
                                        padding: '10px 24px', background: THEME.accent, color: 'white', border: 'none', borderRadius: '10px',
                                        fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                        boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                                    }}
                                >
                                    JOIN SESSION <span>→</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Bottom Action Bar */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px',
                background: 'linear-gradient(to top, #0f172a, rgba(15, 23, 42, 0))', pointerEvents: 'none'
            }}>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ ...btnStyle(), pointerEvents: 'auto' }}
                >
                    <span style={{ fontSize: '20px' }}>+</span>
                    START NEW SESSION
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, position: 'relative' }}>
                        <button
                            onClick={() => setShowCreate(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: THEME.textMuted, fontSize: '20px' }}
                        >✕</button>

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%',
                                background: 'rgba(99, 102, 241, 0.2)', color: THEME.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'white', margin: 0 }}>Start New Session</h2>
                            <p style={{ color: THEME.textMuted, fontSize: '13px', marginTop: '4px' }}>Configure operation details</p>
                        </div>

                        <form onSubmit={handleCreate}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: THEME.textMuted, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                                    Operation Type
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('IN')}
                                        style={{
                                            padding: '16px', borderRadius: '12px', border: `2px solid ${newType === 'IN' ? THEME.success : 'transparent'}`,
                                            background: newType === 'IN' ? 'rgba(16, 185, 129, 0.1)' : THEME.primary,
                                            color: newType === 'IN' ? THEME.success : THEME.textMuted,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                            fontWeight: '700'
                                        }}
                                    >
                                        <span style={{ fontSize: '20px' }}>📥</span>
                                        <span>STOCK IN</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('OUT')}
                                        style={{
                                            padding: '16px', borderRadius: '12px', border: `2px solid ${newType === 'OUT' ? THEME.error : 'transparent'}`,
                                            background: newType === 'OUT' ? 'rgba(239, 68, 68, 0.1)' : THEME.primary,
                                            color: newType === 'OUT' ? THEME.error : THEME.textMuted,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                            fontWeight: '700'
                                        }}
                                    >
                                        <span style={{ fontSize: '20px' }}>📤</span>
                                        <span>DISPATCH</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', color: THEME.textMuted, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                                    Target Size
                                </label>
                                <select
                                    value={newSize}
                                    onChange={(e) => setNewSize(e.target.value)}
                                    style={{
                                        width: '100%', padding: '16px', background: THEME.primary,
                                        border: `1px solid ${THEME.border}`, borderRadius: '12px',
                                        color: 'white', fontSize: '16px', fontWeight: '700', outline: 'none'
                                    }}
                                >
                                    {sizes.map(s => (
                                        <option key={s._id} value={s.code}>{s.code}</option>
                                    ))}
                                    {sizes.length === 0 && <option value="40">40</option>}
                                </select>
                            </div>

                            <button
                                type="submit"
                                style={btnStyle(THEME.accent)}
                            >
                                START SESSION
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionManager;
