import React, { useState, useEffect } from 'react';
import { useMobile } from '../context/MobileContext';
import { haptic } from '../utils/haptic';
import InstallPrompt from '../components/InstallPrompt';

const THEME = {
    bg: '#0f172a', // Slate 900
    card: '#1e293b', // Slate 800
    accent: '#6366f1', // Indigo 500
    accentHover: '#4f46e5',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#334155',
    error: '#ef4444',
    success: '#10b981'
};

const SetupScreen = () => {
    const { setupDevice } = useMobile();

    // Steps: 'LANDING' -> 'CONNECTING'
    const [step, setStep] = useState('LANDING');

    const [manualIp, setManualIp] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [error, setError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // 1. Check for Auto-Pairing URL on Mount (Deep Link Support)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const serverParam = params.get('server');
        const tokenParam = params.get('token');

        if (serverParam && tokenParam) {
            console.log('🔗 Deep Link Detected - Auto-triggering pairing');
            // Extract IP from legacy URL
            let ip = serverParam.replace(/https?:\/\//, '').split(':')[0];

            // Auto-trigger pairing
            executePairing(ip, tokenParam, 'AUTO_ASSIGN');
        }
    }, []);

    const handleManualConnect = () => {
        if (!manualIp.trim()) {
            setError("Enter Server IP");
            return;
        }
        setShowManual(false);
        // Manual mode implies "Factory Setup"
        executePairing(manualIp, "FACTORY_SETUP_2026", 'AUTO_ASSIGN');
    };

    const executePairing = async (ip, token, nameOverride = null) => {
        setIsConnecting(true);
        setStep('CONNECTING');
        setError(null);

        try {
            // Use override or 'AUTO_ASSIGN' if not provided
            const finalName = nameOverride || 'AUTO_ASSIGN';
            await setupDevice(ip, token, finalName);

            // Success -> Clear URL to prevent re-pairing on reload
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

            // App component handles redirect based on context (scannerId set)
        } catch (err) {
            handlePairError(err.message || 'Connection Failed');
        }
    };

    const handlePairError = (msg) => {
        setIsConnecting(false);
        setError(msg);
        haptic.error();
        setStep('LANDING');
    };

    // --- RENDERERS ---

    // 2. LANDING SCREEN (No Scanner)
    if (step === 'LANDING') {
        return (
            <div style={containerStyle}>
                {/* Header Logo */}
                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <div style={iconBadgeStyle}>⚡</div>
                    <h1 style={headingStyle}>Connect Scanner</h1>
                    <p style={subTextStyle}>
                        To pair this device, scan the <b>Master QR Code</b> using your <b>Camera App</b> or <b>Google Lens</b>.
                    </p>
                </div>

                {/* Manual Connect Option */}
                <div style={{ width: '100%', maxWidth: '320px' }}>
                    <button
                        onClick={() => setShowManual(true)}
                        style={{ ...btnSecondaryStyle, width: '100%', marginBottom: '20px' }}
                    >
                        ENTER IP MANUALLY
                    </button>

                    {error && (
                        <div style={errorMessageStyle}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Manual Input Modal */}
                {showManual && (
                    <div style={modalBackdropStyle}>
                        <div style={modalCardStyle}>
                            <h3 style={{ color: 'white', margin: '0 0 16px', fontSize: '18px' }}>Manual Server IP</h3>
                            <input
                                value={manualIp}
                                onChange={e => setManualIp(e.target.value)}
                                placeholder="192.168.x.x"
                                style={inputStyle}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button onClick={handleManualConnect} style={{ ...btnPrimaryStyle }}>CONNECT</button>
                                <button onClick={() => setShowManual(false)} style={{ ...btnSecondaryStyle, background: 'transparent', border: `1px solid ${THEME.border}` }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ position: 'absolute', bottom: '30px', opacity: 0.3, fontSize: '12px' }}>
                    v2.5 • No In-App Scan
                </div>
            </div>
        );
    }

    // 3. CONNECTING SCREEN
    if (step === 'CONNECTING') {
        return (
            <div style={containerStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="spinner" style={spinnerStyle}></div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spinner { animation: spin 1s linear infinite; }`}</style>
                    <h2 style={{ color: 'white', marginTop: '20px', letterSpacing: '1px' }}>CONNECTING...</h2>
                    <p style={{ color: THEME.textMuted }}>Registering Device...</p>
                </div>
            </div>
        );
    }

    return null;
};

// --- STYLES ---

const containerStyle = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.bg, color: THEME.text, padding: '20px', position: 'relative', overflow: 'hidden'
};

const iconBadgeStyle = {
    width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(99, 102, 241, 0.1)',
    color: THEME.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px',
    margin: '0 auto 24px', border: `1px solid ${THEME.accent}`
};

const headingStyle = { fontSize: '28px', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-0.5px' };
const subTextStyle = { color: THEME.textMuted, fontSize: '16px', lineHeight: '1.6', margin: '0 auto', maxWidth: '300px' };

const inputStyle = {
    width: '100%', padding: '16px', borderRadius: '14px', border: `1px solid ${THEME.border}`,
    background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box', fontFamily: 'monospace', textAlign: 'center'
};

const btnPrimaryStyle = {
    width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
    background: THEME.accent,
    color: 'white', fontWeight: '700', fontSize: '15px', letterSpacing: '0.5px',
    cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
};

const btnSecondaryStyle = {
    padding: '16px', borderRadius: '16px', border: `1px solid ${THEME.border}`,
    background: 'rgba(30, 41, 59, 0.5)',
    color: THEME.textMuted, fontWeight: '600', cursor: 'pointer', fontSize: '14px'
};

const errorMessageStyle = {
    background: 'rgba(239, 68, 68, 0.1)', color: THEME.error, padding: '16px',
    borderRadius: '12px', marginTop: '20px', fontSize: '14px', fontWeight: '600',
    textAlign: 'center', border: `1px solid rgba(239, 68, 68, 0.2)`
};

const modalBackdropStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const modalCardStyle = {
    background: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(20px)',
    border: `1px solid ${THEME.border}`, padding: '30px 24px', borderRadius: '24px',
    width: '100%', maxWidth: '320px', textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
};

const spinnerStyle = { width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: THEME.accent, borderRadius: '50%' };

export default SetupScreen;
