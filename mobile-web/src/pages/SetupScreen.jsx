import React, { useState, useEffect, useRef } from 'react';
import { useMobile } from '../context/MobileContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { haptic } from '../utils/haptic';
import { Capacitor } from '@capacitor/core';

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
    const [step, setStep] = useState('LANDING');
    
    useEffect(() => {
        // Platform logging removed for production
    }, []);
    const [manualIp, setManualIp] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [error, setError] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [scannerRequested, setScannerRequested] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const html5QrCodeRef = useRef(null);

    const buildErrorMeta = (message, context = 'pairing') => {
        const raw = String(message || '').trim();
        const lower = raw.toLowerCase();

        if (context === 'scanner') {
            if (lower.includes('invalid pairing qr')) {
                return {
                    title: 'Invalid QR Code',
                    message: 'This QR code is not a valid pairing code for this scanner.',
                    hint: 'Open desktop Scanner Fleet and scan the Pair Device QR.'
                };
            }
            if (lower.includes('install qr')) {
                return {
                    title: 'Wrong QR Type',
                    message: 'You scanned the install QR instead of the pairing QR.',
                    hint: 'Use the Pair Device QR from desktop to connect this scanner.'
                };
            }
            return {
                title: 'Scanner Error',
                message: raw || 'Unable to scan QR code.',
                hint: 'Hold device steady and ensure the full QR is visible in frame.'
            };
        }

        if (lower.includes('network')) {
            return {
                title: 'Connection Error',
                message: raw,
                hint: 'Verify backend is reachable and scan a fresh pairing QR code.'
            };
        }

        if (lower.includes('expired') || lower.includes('invalid')) {
            return {
                title: 'Pairing Link Invalid',
                message: raw,
                hint: 'Generate a new Pair Device QR from desktop and try again.'
            };
        }

        return {
            title: 'Pairing Failed',
            message: raw || 'Unable to pair this device.',
            hint: 'Retry with a fresh QR from desktop or use manual IP setup.'
        };
    };

    // 1. Auto-Pairing from URL (QR Scan)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let serverParam = params.get('server');
        const tokenParam = params.get('token');

        if (serverParam && tokenParam) {
            console.log('🔗 Deep Link Detected - Auto-triggering pairing');
            
            // Normalize for native app: force http://ip:5000 to bypass SSL
            if (Capacitor.isNativePlatform() && serverParam.includes('://')) {
                const ip = serverParam.replace(/https?:\/\//, '').split(':')[0];
                if (ip) {
                    serverParam = `http://${ip}:5000`;
                    console.log('🔄 Normalized Deep Link Server URL for native:', serverParam);
                }
            }
            
            executePairing(serverParam, tokenParam, 'AUTO_ASSIGN');
        }
    }, [setupDevice]); // Add dependency for linting, though stable

    useEffect(() => {
        return () => {
            stopQrScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!showScanner || !scannerRequested) return;

        // Start scanner only after modal is painted and target element exists.
        const timer = setTimeout(() => {
            initializeQrScanner();
        }, 0);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showScanner, scannerRequested]);

    const handleManualConnect = () => {
        setError(null);
        if (!manualIp.trim()) {
            setError("Enter Server IP");
            return;
        }
        // Extract IP if user pastes full URL
        let ip = manualIp.replace(/https?:\/\//, '').split(':')[0];

        setShowManual(false);
        // Manual mode implies "Factory Setup"
        executePairing(ip, "FACTORY_SETUP_2026", 'AUTO_ASSIGN');
    };

    const executePairing = async (ip, token, nameOverride = null) => {
        setStep('CONNECTING');
        setError(null);
        const finalName = nameOverride || 'AUTO_ASSIGN';

        try {
            // Clean the input IP/URL to get just the hostname/IP and Port
            const matches = String(ip || '').match(/^https?:\/\/([^/:]+)(?::(\d+))?/i);
            const cleanHost = matches ? matches[1] : String(ip || '').split(':')[0].split('/')[0];
            const cleanPort = matches && matches[2] ? matches[2] : '5000';
            
            const httpUrl = `http://${cleanHost}:${cleanPort}`;
            await setupDevice(httpUrl, token, finalName);
            finishPairing();
        } catch (err) {
            handlePairError(err.message || 'Connection Failed');
        }
    };

    const finishPairing = () => {
        // Success -> Clear URL to prevent re-pairing on reload
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        // Context update will trigger App redirect
    };

    const handlePairError = (msg) => {
        setStep('LANDING'); // Go back to landing to show error
        setError(msg);
        haptic.error();
    };

    const extractPairPayload = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return null;

        const normalized = text.startsWith('?') ? text.slice(1) : text;
        const queryLike = normalized.includes('token=') || normalized.includes('server=');

        if (/LoomTrackMobile(?:-debug)?\.apk/i.test(text) || /\/pwa\/.*\.apk/i.test(text)) {
            return { kind: 'install' };
        }

        const parseParams = (params) => {
            const token = params.get('token');
            const serverFromParam = params.get('server');

            if (!token) return null;

            let ip = '';
            let finalServerUrl = serverFromParam || '';

            if (serverFromParam) {
                ip = serverFromParam.replace(/https?:\/\//, '').split(':')[0];
                
                // If native, normalization: force http://ip:5000
                if (Capacitor.isNativePlatform() && ip) {
                    finalServerUrl = `http://${ip}:5000`;
                }
            }

            if (!ip) return null;

            return { kind: 'pair', ip, token, serverUrl: finalServerUrl };
        };

        try {
            const url = new URL(text);
            const payload = parseParams(url.searchParams);
            if (payload) return payload;
        } catch {
            // Fall through to query-string parsing below.
        }

        if (queryLike) {
            const payload = parseParams(new URLSearchParams(normalized));
            if (payload) return payload;
        }

        return null;
    };

    const stopQrScanner = async () => {
        try {
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                await html5QrCodeRef.current.clear();
                html5QrCodeRef.current = null;
            }
        } catch (e) {
            html5QrCodeRef.current = null;
        }
    };

    const initializeQrScanner = async () => {
        try {
            if (html5QrCodeRef.current) return;

            const scanner = new Html5Qrcode('setup-qr-reader');
            html5QrCodeRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 240, height: 240 },
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
                },
                async (decodedText) => {
                    const payload = extractPairPayload(decodedText);
                    if (!payload) {
                        setScannerError('Invalid pairing QR. Scan the QR shown in desktop Pair Device window.');
                        return;
                    }

                    if (payload.kind === 'install') {
                        setScannerError('This is the install QR. Use the Pair Device QR from desktop instead.');
                        return;
                    }

                    await stopQrScanner();
                    setShowScanner(false);
                    setScannerRequested(false);
                    executePairing(payload.serverUrl || payload.ip, payload.token, 'AUTO_ASSIGN');
                },
                () => {}
            );
        } catch (err) {
            setScannerError(err?.message || 'Unable to start camera scanner');
            setScannerRequested(false);
        }
    };

    const startQrScanner = async () => {
        setScannerError('');
        setShowScanner(true);
        setScannerRequested(true);
    };


    // --- RENDERERS ---

    // 2. CONNECTING SCREEN
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

    // 3. LANDING SCREEN (Fallback / Manual)
    const isNativeApp = Capacitor.isNativePlatform();

    return (
        <div style={containerStyle}>
            {/* Header Logo */}
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={iconBadgeStyle}>⚡</div>
                <h1 style={headingStyle}>Connect Scanner</h1>
                <p style={subTextStyle}>
                    {isNativeApp 
                        ? "To pair this device, use in-app scanner and scan the Master QR from desktop."
                        : "Use your phone's camera or Google Lens to scan the Master QR from desktop."}
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div style={errorCardStyle}>
                    <div style={errorCardHeaderStyle}>
                        <div style={errorBadgeStyle}>!</div>
                        <div>
                            <div style={errorTitleStyle}>{buildErrorMeta(error).title}</div>
                            <div style={errorTextStyle}>{buildErrorMeta(error).message}</div>
                        </div>
                    </div>
                    <div style={errorHintStyle}>{buildErrorMeta(error).hint}</div>
                </div>
            )}

            {/* Connect Options */}
            <div style={{ width: '100%', maxWidth: '320px', marginTop: '20px' }}>
                {isNativeApp && (
                    <button
                        onClick={startQrScanner}
                        style={{ ...btnPrimaryStyle, width: '100%', marginBottom: '10px' }}
                    >
                        SCAN PAIR QR
                    </button>
                )}
                <button
                    onClick={() => setShowManual(true)}
                    style={{ ...btnSecondaryStyle, width: '100%' }}
                >
                    ENTER IP MANUALLY
                </button>
            </div>

            {/* In-App QR Scanner Modal */}
            {showScanner && (
                <div style={modalBackdropStyle}>
                    <div style={{ ...modalCardStyle, maxWidth: '360px' }}>
                        <h3 style={{ color: 'white', margin: '0 0 12px', fontSize: '18px' }}>Scan Pairing QR</h3>
                        <p style={{ color: THEME.textMuted, fontSize: '13px', margin: '0 0 12px' }}>
                            Point camera at desktop Pair Device QR.
                        </p>

                        <div id="setup-qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', minHeight: '260px' }} />

                        {scannerError && (
                            <div style={{ ...errorCardStyle, marginTop: '12px', padding: '12px 14px', textAlign: 'left' }}>
                                <div style={{ ...errorCardHeaderStyle, gap: '10px' }}>
                                    <div style={{ ...errorBadgeStyle, width: '24px', height: '24px', fontSize: '12px' }}>!</div>
                                    <div>
                                        <div style={{ ...errorTitleStyle, fontSize: '12px' }}>{buildErrorMeta(scannerError, 'scanner').title}</div>
                                        <div style={{ ...errorTextStyle, fontSize: '12px' }}>{buildErrorMeta(scannerError, 'scanner').message}</div>
                                    </div>
                                </div>
                                <div style={{ ...errorHintStyle, marginTop: '8px', fontSize: '11px' }}>{buildErrorMeta(scannerError, 'scanner').hint}</div>
                            </div>
                        )}

                        <button
                            onClick={async () => {
                                await stopQrScanner();
                                setShowScanner(false);
                                setScannerRequested(false);
                            }}
                            style={{ ...btnSecondaryStyle, width: '100%', marginTop: '14px' }}
                        >
                            CLOSE SCANNER
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Input Modal */}
            {showManual && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(20px)',
                        border: `1px solid ${THEME.border}`, padding: '30px 24px', borderRadius: '24px',
                        width: '100%', maxWidth: '320px', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <h3 style={{ color: 'white', margin: '0 0 16px', fontSize: '18px' }}>Manual Server IP</h3>
                        <input
                            value={manualIp}
                            onChange={e => setManualIp(e.target.value)}
                            placeholder="192.168.x.x"
                            style={{
                                width: '100%', padding: '16px', borderRadius: '14px', border: `1px solid ${THEME.border}`,
                                background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none',
                                transition: 'border-color 0.2s', boxSizing: 'border-box', fontFamily: 'monospace', textAlign: 'center'
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={handleManualConnect} style={{ ...btnPrimaryStyle, flex: 1 }}>CONNECT</button>
                            <button onClick={() => setShowManual(false)} style={{ ...btnSecondaryStyle, flex: 1, background: 'transparent' }}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ position: 'absolute', bottom: '30px', opacity: 0.3, fontSize: '12px' }}>
                v1.0 • Official Stable Release
            </div>
        </div>
    );
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

const errorCardStyle = {
    width: '100%',
    maxWidth: '360px',
    marginTop: '20px',
    borderRadius: '14px',
    padding: '14px 16px',
    background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.16), rgba(239, 68, 68, 0.08))',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)'
};

const errorCardHeaderStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
};

const errorBadgeStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    border: '1px solid rgba(239, 68, 68, 0.55)',
    background: 'rgba(239, 68, 68, 0.25)',
    color: '#fecaca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '800',
    flexShrink: 0
};

const errorTitleStyle = {
    color: '#fecaca',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.02em',
    marginBottom: '3px'
};

const errorTextStyle = {
    color: '#fee2e2',
    fontSize: '12px',
    lineHeight: '1.4',
    fontWeight: '500'
};

const errorHintStyle = {
    marginTop: '10px',
    color: '#fecaca',
    fontSize: '11px',
    lineHeight: '1.35',
    paddingTop: '8px',
    borderTop: '1px solid rgba(239, 68, 68, 0.28)'
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

