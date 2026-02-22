import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';

const SessionManager = () => {
    const navigate = useNavigate();
    const { api, scannerId, logout, unpair, deferredPrompt, installApp } = useMobile();
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
    const [showEndSummary, setShowEndSummary] = useState(false);
    const [endSummarySession, setEndSummarySession] = useState(null);
    const [endSummaryStats, setEndSummaryStats] = useState(null);
    const [endSummaryItems, setEndSummaryItems] = useState([]);
    const [closingSession, setClosingSession] = useState(false);

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
            (async () => {
                try {
                    if (scannerId) {
                        await api.post('/api/auth/logout', { scannerId });
                    }
                } catch (err) {
                    console.error('Failed to clear employee before unpair:', err);
                } finally {
                    unpair();
                    window.location.reload();
                }
            })();
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

    const openEndSummary = async (session) => {
        try {
            const res = await api.get(`/api/sessions/${session._id}/preview`);
            if (!res.data?.success) {
                alert(res.data?.error || 'Failed to load session summary');
                return;
            }

            const s = res.data.stats || {};
            setEndSummarySession(session);
            setEndSummaryStats({
                totalCount: Number(s.totalCount ?? s.count ?? 0),
                totalMetre: Number(s.totalMetre ?? 0),
                totalWeight: Number(s.totalWeight ?? 0)
            });
            setEndSummaryItems(Array.isArray(res.data.items) ? res.data.items : []);
            setShowEndSummary(true);
        } catch (err) {
            console.error(err);
            alert('Failed to load session summary');
        }
    };

    const confirmEndSessionFromSummary = async () => {
        if (!endSummarySession?._id) return;
        try {
            setClosingSession(true);
            const res = await api.post('/api/sessions/end', {
                sessionId: endSummarySession._id,
                source: 'mobile'
            });
            if (!res.data?.success) {
                alert(res.data?.error || 'Failed to end session');
                return;
            }
            setShowEndSummary(false);
            setEndSummarySession(null);
            setEndSummaryStats(null);
            setEndSummaryItems([]);
            fetchSessions();
        } catch (err) {
            console.error(err);
            alert('Failed to end session');
        } finally {
            setClosingSession(false);
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
        background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(12px)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
    };

    const modalContentStyle = {
        background: 'rgba(30, 41, 59, 0.7)',
        width: '100%', maxWidth: '420px',
        borderRadius: '32px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        overflow: 'hidden'
    };

    const modalBackdropStyle = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 1000
    };

    const menuStyle = {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
        padding: '32px 24px 48px', zIndex: 1001,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: '8px'
    };

    const menuBtnStyle = {
        width: '100%', padding: '16px 20px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
        color: 'white', fontSize: '15px', fontWeight: '700',
        display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
        textAlign: 'left'
    };

    return (
        <div style={{ height: '100dvh', background: THEME.primary, fontFamily: '"Outfit", sans-serif', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '100px' }}>
                <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                    {/* Header */}
                    {/* Modern App Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 0',
                        marginBottom: '24px'
                    }}>
                        {/* Company Logo & Service Name */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '6px 16px 6px 8px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{
                                width: '36px', height: '36px', background: THEME.accent,
                                borderRadius: '12px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                            }}>
                                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Prodexa" style={{ width: '22px', height: '22px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '16px', fontWeight: '900', color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>Prodexa</span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: THEME.textMuted, letterSpacing: '0.05em', marginTop: '2px' }}>TEXTILE MANAGEMENT</span>
                            </div>
                        </div>

                        {/* Right: Profile & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => setShowScanVerify(true)}
                                style={{
                                    width: '42px', height: '42px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                🔍
                            </button>

                            <div
                                onClick={() => setShowMenu(true)}
                                style={{
                                    height: '42px', padding: '0 6px 0 12px', background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
                                }}
                            >
                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                                    {employee ? employee.name.split(' ')[0] : 'Profile'}
                                </span>
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: '900', color: 'white'
                                }}>
                                    {employee ? employee.name.charAt(0).toUpperCase() : '?'}
                                </div>
                            </div>
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
                                <div key={session._id} style={{
                                    ...cardStyle,
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '24px',
                                    padding: '24px',
                                    position: 'relative',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                                }}>
                                    {/* Status Glow Bar */}
                                    <div style={{
                                        position: 'absolute', top: 0, left: '20px', right: '20px', height: '2px',
                                        background: session.type === 'IN'
                                            ? 'linear-gradient(90deg, transparent, #10b981, transparent)'
                                            : 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                                        opacity: 0.6
                                    }}></div>

                                    {/* Session Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: session.type === 'IN' ? THEME.success : THEME.error,
                                                    boxShadow: `0 0 10px ${session.type === 'IN' ? THEME.success : THEME.error}`
                                                }}></div>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: '900', color: session.type === 'IN' ? THEME.success : THEME.error,
                                                    textTransform: 'uppercase', letterSpacing: '0.1em'
                                                }}>
                                                    {session.type === 'IN' ? 'Stock Entry' : 'Dispatch'}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>|</span>
                                                <span style={{ fontSize: '11px', color: THEME.textMuted, fontWeight: '600' }}>
                                                    {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
                                                Size <span style={{ color: THEME.accent }}>{session.targetSize}</span>
                                            </h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>👤</div>
                                                <div style={{ fontSize: '12px', color: THEME.textMuted, fontWeight: '600' }}>
                                                    {session.createdBy}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            background: 'rgba(255, 255, 255, 0.05)', padding: '10px 14px', borderRadius: '14px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: 'white', lineHeight: 1 }}>
                                                {session.activeScanners ? session.activeScanners.length : 0}
                                            </div>
                                            <div style={{ fontSize: '8px', fontWeight: '800', color: THEME.textMuted, textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.05em' }}>DEVICES</div>
                                        </div>
                                    </div>

                                    {/* Summary Stats Grid */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px'
                                    }}>
                                        <div style={{
                                            background: 'rgba(99, 102, 241, 0.08)', padding: '16px', borderRadius: '16px',
                                            border: '1px solid rgba(99, 102, 241, 0.15)', display: 'flex', flexDirection: 'column', gap: '4px'
                                        }}>
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>TOTAL SCANNED</span>
                                            <span style={{ fontSize: '22px', fontWeight: '900', color: THEME.accent }}>{session.scannedCount || 0}</span>
                                        </div>
                                        <div style={{
                                            background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '16px',
                                            border: '1px solid rgba(16, 185, 129, 0.15)', display: 'flex', flexDirection: 'column', gap: '4px'
                                        }}>
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>STATUS</span>
                                            <span style={{ fontSize: '20px', fontWeight: '900', color: THEME.success }}>ACTIVE</span>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                            onClick={() => handleJoin(session)}
                                            style={{
                                                flex: 1, height: '52px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '13px',
                                                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)', cursor: 'pointer'
                                            }}
                                        >
                                            JOIN SESSION
                                        </button>
                                        <button
                                            onClick={() => openEndSummary(session)}
                                            style={{
                                                flex: 1, height: '52px', background: 'rgba(239, 68, 68, 0.1)',
                                                color: THEME.error, border: '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '13px', fontWeight: '800', cursor: 'pointer'
                                            }}
                                        >
                                            END SESSION
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div style={{
                padding: '24px',
                background: 'linear-gradient(to top, #0f172a 70%, transparent)',
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
                display: 'flex', justifyContent: 'center'
            }}>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{
                        width: '100%', maxWidth: '400px', height: '58px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        color: 'white', border: 'none', borderRadius: '18px',
                        fontWeight: '900', fontSize: '16px', letterSpacing: '0.02em',
                        boxShadow: '0 12px 30px rgba(99, 102, 241, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                    }}
                >
                    <span style={{ fontSize: '24px', fontWeight: '300' }}>+</span>
                    START NEW SESSION
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        {/* Decorative Background Glow */}
                        <div style={{
                            position: 'absolute', top: '-100px', right: '-100px', width: '200px', height: '200px',
                            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                            pointerEvents: 'none'
                        }}></div>

                        <button
                            onClick={() => setShowCreate(false)}
                            style={{
                                position: 'absolute', top: '24px', right: '24px',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                color: 'white', fontSize: '18px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >✕</button>

                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{
                                width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '18px',
                                background: 'rgba(99, 102, 241, 0.1)', color: THEME.accent,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', margin: 0, letterSpacing: '-0.02em' }}>New Session</h2>
                            <p style={{ color: THEME.textMuted, fontSize: '14px', marginTop: '6px', fontWeight: '500' }}>Define your operation parameters</p>
                        </div>

                        <form onSubmit={handleCreate}>
                            <div style={{ marginBottom: '28px' }}>
                                <label style={{ display: 'block', color: THEME.textMuted, fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>
                                    TYPE OF OPERATION
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('IN')}
                                        style={{
                                            padding: '16px', borderRadius: '16px',
                                            border: `2px solid ${newType === 'IN' ? THEME.success : 'rgba(255,255,255,0.05)'}`,
                                            background: newType === 'IN' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                                            color: newType === 'IN' ? THEME.success : 'rgba(255,255,255,0.4)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                            fontWeight: '800', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>📥</span>
                                        <span style={{ fontSize: '12px' }}>STOCK IN</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('OUT')}
                                        style={{
                                            padding: '16px', borderRadius: '16px',
                                            border: `2px solid ${newType === 'OUT' ? THEME.error : 'rgba(255,255,255,0.05)'}`,
                                            background: newType === 'OUT' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
                                            color: newType === 'OUT' ? THEME.error : 'rgba(255,255,255,0.4)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                            fontWeight: '800', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>📤</span>
                                        <span style={{ fontSize: '12px' }}>DISPATCH</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '32px' }}>
                                <label style={{ display: 'block', color: THEME.textMuted, fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>
                                    SELECT TARGET SIZE
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={newSize}
                                        onChange={(e) => setNewSize(e.target.value)}
                                        style={{
                                            width: '100%', padding: '18px 20px', background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                                            color: 'white', fontSize: '17px', fontWeight: '700', outline: 'none',
                                            appearance: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        {sizes.map(s => (
                                            <option key={s._id} value={s.code} style={{ background: '#1e293b' }}>Size {s.code}</option>
                                        ))}
                                        {sizes.length === 0 && <option value="40" style={{ background: '#1e293b' }}>Size 40</option>}
                                    </select>
                                    <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: THEME.textMuted }}>
                                        ▼
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                style={{
                                    ...btnStyle(THEME.accent),
                                    height: '60px', borderRadius: '18px', fontSize: '16px', letterSpacing: '0.02em',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
                                }}
                            >
                                START OPERATION
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Menu Drawer */}
            {showMenu && (
                <>
                    <div style={modalBackdropStyle} onClick={() => setShowMenu(false)} />
                    <div style={menuStyle}>
                        {/* Drag Handle */}
                        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '-16px auto 20px' }}></div>

                        {/* Profile Section */}
                        <div style={{
                            padding: '24px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '20px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '18px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '24px', fontWeight: '900', color: 'white',
                                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)'
                                }}>
                                    {employee?.name ? employee.name.charAt(0).toUpperCase() : '👤'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '-0.01em' }}>
                                        {employee?.name || 'Authorized User'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: THEME.textMuted, fontWeight: '700', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                        <span>ID: {employee?.employeeId || 'N/A'}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.1)' }}>•</span>
                                        <span style={{ color: THEME.accent }}>{scannerName}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Menu Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => { setShowProfile(true); setShowMenu(false); }}
                                style={menuBtnStyle}
                            >
                                <span style={{ fontSize: '20px' }}>👤</span>
                                <span>My Profile</span>
                            </button>

                            <button
                                onClick={() => { handleLogout(); setShowMenu(false); }}
                                style={{ ...menuBtnStyle, color: THEME.error }}
                            >
                                <span style={{ fontSize: '20px' }}>🚪</span>
                                <span>Logout</span>
                            </button>

                            <button
                                onClick={() => { handleUnpair(); setShowMenu(false); }}
                                style={{ ...menuBtnStyle, marginTop: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                            >
                                <span style={{ fontSize: '20px' }}>🔌</span>
                                <span style={{ color: THEME.error }}>Unpair Device</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* End Session Summary Modal */}
            {showEndSummary && endSummarySession && endSummaryStats && (
                <div style={modalOverlayStyle}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.92)',
                        width: '100%',
                        maxWidth: '760px',
                        maxHeight: '90vh',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '18px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(15, 23, 42, 0.85)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>Session Summary</div>
                                <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '2px' }}>
                                    {endSummarySession.type} | Size {endSummarySession.targetSize}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEndSummary(false)}
                                disabled={closingSession}
                                style={{
                                    width: '32px', height: '32px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                x
                            </button>
                        </div>

                        <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>{endSummaryStats.totalCount}</div>
                                    <div style={{ fontSize: '10px', color: THEME.textMuted, fontWeight: '700' }}>ITEMS</div>
                                </div>
                                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '900', color: THEME.accent }}>{endSummaryStats.totalMetre.toFixed(2)}</div>
                                    <div style={{ fontSize: '10px', color: THEME.textMuted, fontWeight: '700' }}>METRE</div>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '900', color: THEME.success }}>{endSummaryStats.totalWeight.toFixed(2)}</div>
                                    <div style={{ fontSize: '10px', color: THEME.textMuted, fontWeight: '700' }}>WEIGHT</div>
                                </div>
                            </div>

                            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', color: THEME.textMuted, fontWeight: '800' }}>Barcode</th>
                                            <th style={{ padding: '10px', textAlign: 'right', color: THEME.textMuted, fontWeight: '800' }}>Metre</th>
                                            <th style={{ padding: '10px', textAlign: 'right', color: THEME.textMuted, fontWeight: '800' }}>Weight</th>
                                            <th style={{ padding: '10px', textAlign: 'right', color: THEME.textMuted, fontWeight: '800' }}>Scanned By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {endSummaryItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '18px', textAlign: 'center', color: THEME.textMuted }}>
                                                    No scanned items in this session
                                                </td>
                                            </tr>
                                        ) : (
                                            endSummaryItems.map((item, idx) => (
                                                <tr key={`${item.barcode}-${idx}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <td style={{ padding: '10px', color: 'white', fontFamily: 'monospace', fontWeight: '700' }}>{item.barcode}</td>
                                                    <td style={{ padding: '10px', color: 'white', textAlign: 'right' }}>{Number(item.metre || 0).toFixed(2)}</td>
                                                    <td style={{ padding: '10px', color: 'white', textAlign: 'right' }}>{Number(item.weight || 0).toFixed(2)}</td>
                                                    <td style={{ padding: '10px', color: THEME.textMuted, textAlign: 'right' }}>{item.scannedBy || 'Unknown'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            padding: '14px 20px',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(15, 23, 42, 0.85)'
                        }}>
                            <button
                                onClick={() => {
                                    setShowEndSummary(false);
                                    setEndSummarySession(null);
                                    setEndSummaryStats(null);
                                    setEndSummaryItems([]);
                                }}
                                disabled={closingSession}
                                style={{
                                    flex: 1,
                                    height: '46px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    background: 'transparent',
                                    color: 'white',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmEndSessionFromSummary}
                                disabled={closingSession}
                                style={{
                                    flex: 2,
                                    height: '46px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: closingSession ? 'rgba(239,68,68,0.5)' : THEME.error,
                                    color: 'white',
                                    fontWeight: '800',
                                    cursor: closingSession ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {closingSession ? 'Closing...' : 'Confirm & End Session'}
                            </button>
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
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <button
                            onClick={() => { setShowScanVerify(false); setVerifyResult(null); setVerifyBarcode(''); }}
                            style={{
                                position: 'absolute', top: '24px', right: '24px',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                color: 'white', fontSize: '18px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >✕</button>

                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{
                                width: '52px', height: '52px', margin: '0 auto 16px', borderRadius: '16px',
                                background: 'rgba(99, 102, 241, 0.1)', color: THEME.accent,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(99, 102, 241, 0.15)'
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'white', margin: 0 }}>Verify Item</h2>
                            <p style={{ color: THEME.textMuted, fontSize: '13px', marginTop: '4px' }}>Check status of any barcode</p>
                        </div>

                        {!verifyResult ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={verifyBarcode}
                                        onChange={(e) => setVerifyBarcode(e.target.value)}
                                        placeholder="Scan or Type Barcode..."
                                        style={{
                                            width: '100%', padding: '18px 20px', background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                                            color: 'white', fontSize: '18px', fontWeight: '700', outline: 'none',
                                            textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.05em'
                                        }}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    onClick={() => verifyBarcode.trim() && handleVerifyBarcode(verifyBarcode.trim())}
                                    disabled={!verifyBarcode.trim()}
                                    style={{
                                        ...btnStyle(THEME.accent),
                                        height: '56px', borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        opacity: !verifyBarcode.trim() ? 0.5 : 1
                                    }}
                                >
                                    VERIFY NOW
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{
                                    background: verifyResult.error ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                    borderRadius: '24px', padding: '24px', textAlign: 'center',
                                    border: `1px solid ${verifyResult.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`
                                }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                                        {verifyResult.error ? '⚠️' : '✅'}
                                    </div>
                                    <h3 style={{
                                        fontSize: '18px', fontWeight: '900',
                                        color: verifyResult.error ? THEME.error : THEME.success,
                                        margin: '0 0 12px'
                                    }}>
                                        {verifyResult.error ? 'Record Not Found' : (verifyResult.status || 'Active Item')}
                                    </h3>

                                    {verifyResult.item && (
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                                            textAlign: 'left', marginTop: '20px', padding: '16px',
                                            background: 'rgba(255,255,255,0.03)', borderRadius: '16px'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', color: THEME.textMuted, fontWeight: '800' }}>SIZE</span>
                                                <span style={{ color: 'white', fontWeight: '700' }}>{verifyResult.item.size}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', color: THEME.textMuted, fontWeight: '800' }}>LENGTH</span>
                                                <span style={{ color: 'white', fontWeight: '700' }}>{verifyResult.item.metre}m</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => { setVerifyResult(null); setVerifyBarcode(''); }}
                                    style={{ ...btnStyle('rgba(255,255,255,0.05)'), height: '52px', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    VERIFY ANOTHER
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfile && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <button
                            onClick={() => setShowProfile(false)}
                            style={{
                                position: 'absolute', top: '24px', right: '24px',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                color: 'white', fontSize: '18px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >✕</button>

                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{
                                width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '24px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '36px', fontWeight: '900', color: 'white',
                                boxShadow: '0 12px 30px rgba(99, 102, 241, 0.4)'
                            }}>
                                {employee?.name ? employee.name.charAt(0).toUpperCase() : '👤'}
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', margin: 0 }}>Terminal User</h2>
                            <p style={{ color: THEME.textMuted, fontSize: '14px', marginTop: '4px' }}>Hardware Authorization Active</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '11px', color: THEME.textMuted, fontWeight: '800', marginBottom: '12px', letterSpacing: '0.1em' }}>EMPLOYEE DETAILS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textMuted }}>Name</span>
                                        <span style={{ color: 'white', fontWeight: '700' }}>{employee?.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textMuted }}>Worker ID</span>
                                        <span style={{ color: THEME.accent, fontWeight: '800', fontFamily: 'monospace' }}>{employee?.employeeId}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '11px', color: THEME.textMuted, fontWeight: '800', marginBottom: '12px', letterSpacing: '0.1em' }}>PAIRING STATUS</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: THEME.success, boxShadow: `0 0 10px ${THEME.success}` }}></div>
                                        <span style={{ color: 'white', fontWeight: '700' }}>{scannerName}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: THEME.success, padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>VERIFIED</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowProfile(false)}
                            style={{ ...btnStyle(THEME.accent), height: '56px', borderRadius: '16px', marginTop: '24px' }}
                        >
                            CLOSE PROFILE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionManager;

const styles = document.createElement('style');
styles.textContent = `
                    @keyframes slideDown {
                        from {transform: translateY(-100%); opacity: 0; }
                    to {transform: translateY(0); opacity: 1; }
    }
                    @keyframes slideUp {
                        from {transform: translateX(-50%) translateY(100%); opacity: 0; }
                    to {transform: translateX(-50%) translateY(0); opacity: 1; }
    }
                    `;
if (!document.querySelector('style[data-prodexa-animations]')) {
    styles.setAttribute('data-prodexa-animations', 'true');
    document.head.appendChild(styles);
}
