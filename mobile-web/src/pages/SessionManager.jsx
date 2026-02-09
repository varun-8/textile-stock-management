import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';

const SessionManager = () => {
    const navigate = useNavigate();
    const { api, scannerId, logout, deferredPrompt, installApp } = useMobile();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showScanVerify, setShowScanVerify] = useState(false);
    const [verifyBarcode, setVerifyBarcode] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [showManualInput, setShowManualInput] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);

    // Get employee from localStorage
    const employee = localStorage.getItem('employee') ? JSON.parse(localStorage.getItem('employee')) : null;
    const scannerName = localStorage.getItem('SL_SCANNER_NAME') || 'Unknown Scanner';

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

    // Handle install prompt - now using context
    const handleUnpair = () => {
        if (window.confirm('Unpair this device? You will need to pair again to scan.')) {
            localStorage.removeItem('SL_SCANNER_ID');
            localStorage.removeItem('SL_SCANNER_NAME');
            window.location.reload();
        }
    };

    const handleInstall = async () => {
        console.log('=== INSTALL BUTTON CLICKED ===');
        console.log('deferredPrompt from context:', !!deferredPrompt);
        console.log('window.deferredPrompt:', !!window.deferredPrompt);

        const prompt = deferredPrompt || window.deferredPrompt;
        console.log('Final prompt object:', !!prompt);

        if (!prompt) {
            console.error('❌ NO PROMPT AVAILABLE');
            console.log('Available on window:', Object.keys(window).filter(k => k.includes('defer')));
            setInstallStatus({ type: 'info', message: 'On iOS: Tap Share → Add to Home Screen' });
            setTimeout(() => setInstallStatus(null), 4000);
            return;
        }

        try {
            console.log('✅ PROMPT AVAILABLE - Calling prompt.prompt()');
            setShowMenu(false);
            setShowInstallBanner(false);
            setInstallStatus({ type: 'installing', message: 'Installing Prodexa...' });

            prompt.prompt();
            console.log('✅ prompt.prompt() called - waiting for user choice');

            const { outcome } = await prompt.userChoice;
            console.log(`📦 User choice: ${outcome}`);

            if (outcome === 'accepted') {
                console.log('✅ INSTALL ACCEPTED');
                setInstallStatus({ type: 'success', message: '✅ Prodexa installed successfully!' });
                setTimeout(() => setInstallStatus(null), 3000);
            } else {
                console.log('⏭️ User dismissed install');
                setInstallStatus(null);
            }
        } catch (err) {
            console.error('❌ Install error:', err);
            console.error('Error details:', err.message, err.stack);
            setInstallStatus({ type: 'error', message: 'Installation failed' });
            setTimeout(() => setInstallStatus(null), 3000);
        }
    };

    const handleVerifyBarcode = async (barcode) => {
        try {
            const res = await api.get(`/api/mobile/check-barcode/${barcode}`);
            setVerifyResult(res.data);
        } catch (err) {
            setVerifyResult({ error: 'Failed to verify barcode', status: 'NOT_FOUND' });
        }
    };

    useEffect(() => {
        fetchSessions();
        fetchSizes();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    // Auto-show install banner when prompt is available
    useEffect(() => {
        // Check window.deferredPrompt set by index.html
        if (window.deferredPrompt && !localStorage.getItem('pwa_install_dismissed')) {
            console.log('✅ deferredPrompt found in window');
            setTimeout(() => setShowInstallBanner(true), 1000);
        }
    }, []);

    const handleJoin = async (session) => {
        try {
            const scannerIdToUse = scannerId || localStorage.getItem('SL_SCANNER_ID');
            const res = await api.post('/api/sessions/join',
                { sessionId: session._id, scannerId: scannerIdToUse },
                scannerIdToUse ? { headers: { 'x-scanner-id': scannerIdToUse } } : undefined
            );
            const data = res.data;
            if (data.success) {
                localStorage.setItem('active_session_id', session._id);
                localStorage.setItem('active_session_type', session.type);
                localStorage.setItem('active_session_size', session.targetSize);
                navigate('/work');
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
                // Auto-join the new session
                await handleJoin(data.session);
            }
        } catch (err) {
            alert('Failed to create session');
        }
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            try {
                // Clear employee from backend scanner record
                await api.post('/api/auth/logout', { scannerId });
            } catch (err) {
                console.error('Failed to clear employee from backend:', err);
            }

            localStorage.removeItem('employee');
            logout();
            navigate('/pin');
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
        <div style={{ height: '100dvh', background: THEME.primary, fontFamily: '"Outfit", sans-serif', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '100px' }}>
                <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flex: 1,
                            height: '44px',
                            background: 'rgba(30, 41, 59, 0.55)',
                            border: `1px solid ${THEME.border}`,
                            borderRadius: '12px',
                            padding: '0 14px',
                            boxShadow: '0 10px 24px rgba(0,0,0,0.25)'
                        }}>
                            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Prodexa" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', justifyContent: 'center', minWidth: 0 }}>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: THEME.text, letterSpacing: '-0.02em', lineHeight: '1.2' }}>Prodexa</span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: THEME.accent, letterSpacing: '0.06em', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>SRI LAKSHMI TEXTILES</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {/* ... Buttons preserved but simplified if needed ... */}
                            <button
                                onClick={() => setShowScanVerify(true)}
                                style={{
                                    width: '44px', height: '44px', background: THEME.secondary, borderRadius: '12px',
                                    border: `1px solid ${THEME.border}`, color: THEME.accent, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                }}
                                title="Scan to Verify"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M9 3v18" />
                                    <path d="M15 3v18" />
                                </svg>
                            </button>
                            <button
                                onClick={fetchSessions}
                                style={{
                                    width: '44px', height: '44px', background: THEME.secondary, borderRadius: '12px',
                                    border: `1px solid ${THEME.border}`, color: THEME.accent, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                }}
                                title="Refresh Sessions"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                            </button>
                            <button
                                onClick={() => setShowMenu(true)}
                                style={{
                                    width: '44px', height: '44px', background: THEME.secondary, borderRadius: '12px',
                                    border: `1px solid ${THEME.border}`, color: THEME.accent, cursor: 'pointer', fontSize: '18px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                }}
                                title="Menu"
                            >
                                ☰
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', opacity: 0.5 }}>
                            <div style={{ width: '32px', height: '32px', border: `2px solid ${THEME.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {sessions.length === 0 && (
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    padding: '60px 20px', textAlign: 'center', opacity: 0.7
                                }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                                    <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>No Active Sessions</h3>
                                    <p style={{ color: THEME.textMuted, fontSize: '14px', margin: 0 }}>
                                        Start a new session to begin scanning.
                                    </p>
                                </div>
                            )}

                            {sessions.map(session => (
                                <div key={session._id} style={{ ...cardStyle }}>
                                    <div style={{
                                        position: 'absolute', top: 0, bottom: 0, left: 0, width: '6px',
                                        background: session.type === 'IN' ? THEME.success : THEME.error
                                    }}></div>

                                    {/* Session Header */}
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

                                    {/* Session Summary */}
                                    <div style={{
                                        paddingLeft: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid rgba(255,255,255,0.05)`,
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'
                                    }}>
                                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.accent}` }}>
                                            <div style={{ fontSize: '11px', color: THEME.textMuted, fontWeight: '700', marginBottom: '4px' }}>TOTAL SCANNED</div>
                                            <div style={{ fontSize: '18px', color: THEME.accent, fontWeight: '800' }}>
                                                {session.scannedCount || 0}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                            <div style={{ fontSize: '11px', color: THEME.textMuted, fontWeight: '700', marginBottom: '4px' }}>DURATION</div>
                                            <div style={{ fontSize: '18px', color: THEME.success, fontWeight: '800' }}>Active</div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{
                                        paddingLeft: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', marginLeft: '8px' }}>
                                            {[...Array(Math.min(3, session.activeScanners?.length || 0))].map((_, i) => (
                                                <div key={i} style={{
                                                    width: '24px', height: '24px', borderRadius: '50%', background: '#334155', border: '2px solid #1e293b',
                                                    marginLeft: '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white'
                                                }}>📱</div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                            <button
                                                onClick={() => handleJoin(session)}
                                                style={{
                                                    flex: 1, padding: '10px 16px', background: THEME.accent, color: 'white', border: 'none', borderRadius: '10px',
                                                    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                                                }}
                                            >
                                                JOIN
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm(`End this session? All items will be finalized.`)) {
                                                        try {
                                                            await api.post('/api/sessions/end', { sessionId: session._id });
                                                            // Refresh list
                                                            fetchSessions();
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert('Failed to end session');
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', color: THEME.error, border: `1px solid rgba(239, 68, 68, 0.3)`,
                                                    borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                                }}
                                            >
                                                END
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div style={{
                padding: '20px',
                background: 'linear-gradient(to top, #0f172a 80%, rgba(15, 23, 42, 0))',
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10
            }}>
                <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{ ...btnStyle(), boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)' }}
                    >
                        <span style={{ fontSize: '20px' }}>+</span>
                        START NEW SESSION
                    </button>
                </div>
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

            {/* Menu Modal */}
            {showMenu && (
                <div style={modalBackdropStyle} onClick={() => setShowMenu(false)}>
                    <div style={menuStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(99, 102, 241, 0.05)' }}>
                            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Prodexa" style={{ width: '42px', height: '42px', flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
                                <span style={{ fontWeight: '800', fontSize: '18px', color: THEME.text, letterSpacing: '-0.02em', lineHeight: '1.1' }}>Prodexa</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: THEME.accent, letterSpacing: '0.06em', lineHeight: '1.2' }}>SRI LAKSHMI TEXTILES</span>
                            </div>
                        </div>
                        {employee && (
                            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${THEME.border}`, background: 'rgba(30, 41, 59, 0.3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${THEME.accent}, #8b5cf6)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '20px', fontWeight: '800', color: 'white',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', flexShrink: 0
                                    }}>
                                        {employee.name ? employee.name.charAt(0).toUpperCase() : '👤'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: '700', color: THEME.text, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {employee.name || 'Worker'}
                                        </div>
                                        <div style={{
                                            padding: '2px 8px', background: 'rgba(99, 102, 241, 0.15)',
                                            borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                            color: THEME.accent, fontFamily: 'monospace', display: 'inline-block'
                                        }}>
                                            {employee.employeeId || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <MenuItem
                            icon="⬇️"
                            label="Install App"
                            onClick={handleInstall}
                        />
                        <MenuItem icon="🔄" label="Switch User" onClick={() => {
                            if (window.confirm('Switch user?')) {
                                localStorage.removeItem('employee');
                                window.location.reload();
                            }
                        }} />
                        <MenuItem icon="🔌" label="Unpair Device" onClick={() => handleUnpair()} />
                        <MenuItem icon="🚪" label="Logout" onClick={() => {
                            if (window.confirm('Logout?')) {
                                logout();
                                navigate('/pin');
                            }
                        }} />
                        <div style={{ padding: '20px' }}>
                            <button onClick={() => setShowMenu(false)} style={btnStyle(THEME.accent)}>CLOSE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Install Banner */}
            {showInstallBanner && (deferredPrompt || window.deferredPrompt) && (
                <div style={{
                    position: 'fixed',
                    top: '16px',
                    left: '16px',
                    right: '16px',
                    zIndex: 1001,
                    background: `linear-gradient(135deg, ${THEME.accent}, #8b5cf6)`,
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'slideDown 0.3s ease'
                }}>
                    <div style={{ fontSize: '32px' }}>📲</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'white', marginBottom: '2px' }}>
                            Install Prodexa App
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                            Quick access from home screen
                        </div>
                    </div>
                    <button
                        onClick={handleInstall}
                        style={{
                            padding: '8px 16px',
                            background: 'white',
                            color: THEME.accent,
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        INSTALL
                    </button>
                    <button
                        onClick={() => {
                            setShowInstallBanner(false);
                            localStorage.setItem('pwa_install_dismissed', 'true');
                        }}
                        style={{
                            padding: '8px',
                            background: 'transparent',
                            color: 'white',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            opacity: 0.8
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Install Status Toast */}
            {installStatus && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1002,
                    background: installStatus.type === 'success' ? THEME.success :
                        installStatus.type === 'error' ? THEME.error : THEME.accent,
                    color: 'white',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    fontSize: '14px',
                    fontWeight: '600',
                    maxWidth: '300px',
                    textAlign: 'center',
                    animation: 'slideUp 0.3s ease'
                }}>
                    {installStatus.type === 'success' && '✅ '}
                    {installStatus.type === 'error' && '❌ '}
                    {installStatus.message}
                </div>
            )}

            {/* Scan Verification Modal */}
            {showScanVerify && (
                <div style={modalBackdropStyle} onClick={() => { setShowScanVerify(false); setVerifyResult(null); setVerifyBarcode(''); }}>
                    <div style={{ ...modalContentStyle, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: THEME.text, margin: '0 0 8px' }}>
                                Verify Barcode
                            </h2>
                            <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>
                                Scan or enter barcode to check status
                            </p>
                        </div>

                        {!verifyResult ? (
                            <>
                                {/* Manual Input */}
                                <div style={{ marginBottom: '16px' }}>
                                    <input
                                        type="text"
                                        value={verifyBarcode}
                                        onChange={(e) => setVerifyBarcode(e.target.value)}
                                        placeholder="Enter barcode number..."
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            background: THEME.primary,
                                            border: `1px solid ${THEME.border}`,
                                            borderRadius: '12px',
                                            color: THEME.text,
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            outline: 'none',
                                            textAlign: 'center',
                                            fontFamily: 'monospace'
                                        }}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    onClick={() => {
                                        if (verifyBarcode.trim()) {
                                            handleVerifyBarcode(verifyBarcode.trim());
                                        }
                                    }}
                                    disabled={!verifyBarcode.trim()}
                                    style={{
                                        ...btnStyle(THEME.accent),
                                        opacity: !verifyBarcode.trim() ? 0.5 : 1,
                                        cursor: !verifyBarcode.trim() ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    VERIFY
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Result Display */}
                                <div style={{
                                    background: verifyResult.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    border: `1px solid ${verifyResult.error ? THEME.error : THEME.success}`,
                                    borderRadius: '12px',
                                    padding: '20px',
                                    marginBottom: '16px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                                        {verifyResult.error ? '❌' : '✅'}
                                    </div>
                                    <h3 style={{
                                        fontSize: '16px',
                                        fontWeight: '700',
                                        color: verifyResult.error ? THEME.error : THEME.success,
                                        margin: '0 0 8px'
                                    }}>
                                        {verifyResult.error ? 'Not Found' : verifyResult.status || 'Found'}
                                    </h3>
                                    {verifyResult.item && (
                                        <div style={{ fontSize: '13px', color: THEME.textMuted, marginTop: '12px' }}>
                                            <div>Size: <strong>{verifyResult.item.size}</strong></div>
                                            <div>Metre: <strong>{verifyResult.item.metre}m</strong></div>
                                            {verifyResult.item.weight && <div>Weight: <strong>{verifyResult.item.weight}kg</strong></div>}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setVerifyResult(null);
                                        setVerifyBarcode('');
                                    }}
                                    style={btnStyle(THEME.accent)}
                                >
                                    VERIFY ANOTHER
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => {
                                setShowScanVerify(false);
                                setVerifyResult(null);
                                setVerifyBarcode('');
                            }}
                            style={{
                                ...btnStyle(THEME.border),
                                background: 'transparent',
                                border: `1px solid ${THEME.border}`,
                                marginTop: '12px'
                            }}
                        >
                            CLOSE
                        </button>
                    </div>
                </div>
            )}
        </div>

    );
};

export default SessionManager;

// MenuItem Component
const MenuItem = ({ icon, label, onClick, sub, color }) => {
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
    return (
        <button onClick={onClick} style={{ width: '100%', padding: '16px 24px', background: 'transparent', border: 'none', color: THEME.text, display: 'flex', alignItems: 'center', gap: '14px', fontSize: '15px', fontWeight: '600', textAlign: 'left', borderBottom: `1px solid ${THEME.border}`, cursor: 'pointer', transition: 'background 0.2s' }}>
            <span style={{ fontSize: '18px', opacity: 0.9 }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div>{label}</div>
                {sub && <div style={{ fontSize: '11px', color: THEME.textMuted, marginTop: '3px', fontWeight: '500' }}>{sub}</div>}
            </div>
        </button>
    );
};

// Modal Styles
const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const menuStyle = { background: '#0f172a', width: '100%', maxWidth: '360px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #334155' };

// Add animations
const styles = document.createElement('style');
styles.textContent = `
    @keyframes slideDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
`;
if (!document.querySelector('style[data-install-banner]')) {
    styles.setAttribute('data-install-banner', 'true');
    document.head.appendChild(styles);
}
