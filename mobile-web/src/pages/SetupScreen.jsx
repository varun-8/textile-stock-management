import React, { useState, useEffect, useRef } from 'react';
import { useMobile } from '../context/MobileContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
    const { pairScanner } = useMobile();

    // Steps: 'NAME' -> 'SCAN' -> 'CONNECTING'
    // If opened via URL: 'NAME_URL' -> 'CONNECTING'
    const [step, setStep] = useState('NAME');

    const [scannerName, setScannerName] = useState('');
    const [manualIp, setManualIp] = useState('');
    const [showManual, setShowManual] = useState(false);

    const [pendingUrlPair, setPendingUrlPair] = useState(null); // { token, server }

    const [error, setError] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const html5QrCodeRef = useRef(null);
    const isScanningRef = useRef(false);

    // 1. Check for Auto-Pairing URL on Mount
    useEffect(() => {
        // Default Name suggestion (Display Only)
        setScannerName(`New Scanner`);

        const params = new URLSearchParams(window.location.search);
        const serverParam = params.get('server');
        const tokenParam = params.get('token');
        const scannerIdParam = params.get('scannerId'); // NEW
        const nameParam = params.get('name'); // NEW

        if (serverParam && tokenParam) {
            console.log('🔗 Deep Link Detected - Auto-triggering pairing');

            // 🧹 IMMEDIATELY Clear URL to prevent reload loops
            // We do this BEFORE pairing succeeds to ensure safety
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

            setPendingUrlPair({ token: tokenParam, server: serverParam, scannerId: scannerIdParam });
            // Auto-trigger pairing
            executePairing(tokenParam, serverParam, nameParam || 'AUTO_ASSIGN', scannerIdParam);
        } else {
            // Auto-advance to SCAN (Skip manual name entry)
            setStep('SCAN');
        }
    }, []);

    // --- CAMERA MANAGEMENT ---
    const startCamera = async () => {
        try {
            if (html5QrCodeRef.current) return;

            console.log('📱 Starting QR camera...');
            setCameraError(null);

            const html5QrCode = new Html5Qrcode("setup-setup-reader");
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 5,
                qrbox: { width: 250, height: 250 },
                disableFlip: false,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    if (isScanningRef.current) return;
                    if (decodedText && decodedText.length > 0) {
                        isScanningRef.current = true;
                        handleQRScan(decodedText);
                    }
                },
                (errorMessage) => { /* Silent error handling */ }
            );

            console.log('✅ QR Camera started successfully');
        } catch (err) {
            console.error('❌ Camera error:', err);
            setCameraError(`Camera Error: ${err.message || err.name}`);
            html5QrCodeRef.current = null;
        }
    };

    const stopCamera = async () => {
        try {
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
                html5QrCodeRef.current = null;
            }
        } catch (e) {
            console.warn('⚠️ Error stopping camera:', e);
            html5QrCodeRef.current = null;
        }
    };

    // Start camera when entering SCAN step
    useEffect(() => {
        if (step === 'SCAN') {
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [step]);

    // 3. Actions
    // handleNameSubmit is effectively deprecated but kept safe
    const handleNameSubmit = () => {
        // ...
    };

    const handleQRScan = (decodedText) => {
        stopCamera();
        haptic.success();
        setIsConnecting(true);
        isScanningRef.current = false; // Reset flag

        try {
            // Parse QR
            let token, server, scannerId, name;
            if (decodedText.startsWith('http')) {
                const url = new URL(decodedText);
                server = url.searchParams.get('server');
                token = url.searchParams.get('token');
                scannerId = url.searchParams.get('scannerId');
                name = url.searchParams.get('name');
            } else {
                // Fallback for JSON (unlikely used now but safe to keep)
                const data = JSON.parse(decodedText);
                token = data.id;
                server = data.url;
            }

            if (!server || !token) throw new Error("Invalid QR Code");

            // Send AUTO_ASSIGN for the name if not provided
            executePairing(token, server, name || 'AUTO_ASSIGN', scannerId);
        } catch (err) {
            console.error(err);
            isScanningRef.current = false; // Reset on error
            handlePairError("Invalid QR Code. Try again.");
        }
    };

    const handleManualConnect = () => {
        if (!manualIp.trim()) {
            setError("Enter Server IP");
            return;
        }
        setShowManual(false);
        const url = `https://${manualIp}:5000`;
        // Manual mode implies "Factory Setup" or fallback token
        executePairing("FACTORY_SETUP_2026", url, 'AUTO_ASSIGN');
    };

    const executePairing = async (token, url, nameOverride = null, scannerId = null) => {
        setIsConnecting(true);
        setStep('CONNECTING');

        try {
            // Use override or 'AUTO_ASSIGN' if not provided
            const finalName = nameOverride || 'AUTO_ASSIGN';
            await pairScanner(token, url, finalName, scannerId);
            // Success -> App component handles redirect based on context
        } catch (err) {
            handlePairError(err.message || 'Connection Failed');
        }
    };

    const handlePairError = (msg) => {
        setIsConnecting(false);
        setError(msg);
        haptic.error();
        
        // Check for specific error types
        const isAlreadyPaired = msg.includes('already paired') || msg.includes('ALREADY_PAIRED');
        const isDuplicate = msg.includes('DUPLICATE_DEVICE') || msg.includes('already paired');
        
        // If we were scanning, go back to scan (unless it's a fundamental issue)
        if (step === 'CONNECTING' && !pendingUrlPair && !isAlreadyPaired) {
            setTimeout(() => {
                setError(null);
                setStep('SCAN'); // Restart camera
            }, 3000);
        } else if (isAlreadyPaired) {
            // For already-paired, stay on error screen and show options
            // Don't auto-retry, user must clear data or use repair link
            setStep('SCAN');
        } else {
            // If deep link failed, stay on name screen
            setStep('NAME');
        }
    };

    // --- RENDERERS ---

    // 1. NAME INPUT SCREEN
    if (step === 'NAME') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={iconBadgeStyle}>🏷️</div>
                    <h1 style={headingStyle}>Device Setup</h1>
                    <p style={subTextStyle}>
                        {pendingUrlPair
                            ? "Pairing link detected. Name this device to finish."
                            : "Let's get started. Give this scanner a name."}
                    </p>

                    <div style={inputWrapperStyle}>
                        <label style={labelStyle}>DEVICE NAME</label>
                        <input
                            autoFocus
                            type="text"
                            value={scannerName}
                            onChange={(e) => { setScannerName(e.target.value); setError(null); }}
                            placeholder="e.g. Loading Dock A"
                            style={inputStyle}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                        />
                    </div>

                    {error && <div style={errorMessageStyle}>{error}</div>}

                    <button onClick={handleNameSubmit} style={btnPrimaryStyle}>
                        {pendingUrlPair ? "FINISH & CONNECT" : "NEXT: PAIR DEVICE"}
                    </button>
                </div>
                {/* Background Blobs (Decoration) */}
                <div style={blob1}></div>
                <div style={blob2}></div>
            </div>
        );
    }

    // 2. SCAN SCREEN
    if (step === 'SCAN') {
        return (
            <div style={containerStyleFullscreen}>
                {/* Header */}
                <div style={headerOverlayStyle}>
                    <button onClick={() => setStep('NAME')} style={backBtnStyle}>← Back</button>
                    <span style={{ fontWeight: '700', letterSpacing: '1px' }}>{scannerName}</span>
                    <button onClick={() => setShowManual(true)} style={iconBtnStyle}>⚙️</button>
                </div>

                {/* Camera Area */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black' }}>
                    <div id="setup-setup-reader" style={{ width: '100%', height: '100%' }}></div>

                    {/* Scan Frame */}
                    <div style={scanOverlayStyle}>
                        <div style={scanFrameBox}>
                            <div style={scanCornerTL}></div>
                            <div style={scanCornerTR}></div>
                            <div style={scanCornerBL}></div>
                            <div style={scanCornerBR}></div>
                            <div style={scanLaser}></div>
                        </div>
                        <p style={scanInstructionStyle}>Scan pairing QR code on Desktop</p>
                    </div>

                    {cameraError && (
                        <div style={errorOverlayStyle}>
                            <div style={{ fontSize: '40px', marginBottom: '20px' }}>📷</div>
                            <p>{cameraError}</p>
                            <button onClick={() => window.location.reload()} style={btnSecondaryStyle}>RELOAD</button>
                        </div>
                    )}
                </div>

                {/* Manual Input Modal */}
                {showManual && (
                    <div style={modalBackdropStyle}>
                        <div style={modalCardStyle}>
                            <h3 style={{ color: 'white', margin: '0 0 16px', fontSize: '18px' }}>Manual IP Entry</h3>
                            <input
                                value={manualIp}
                                onChange={e => setManualIp(e.target.value)}
                                placeholder="192.168.x.x"
                                style={inputStyle}
                            />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button onClick={handleManualConnect} style={{ ...btnPrimaryStyle }}>CONNECT</button>
                                <button onClick={() => setShowManual(false)} style={{ ...btnSecondaryStyle, background: 'transparent', border: `1px solid ${THEME.border}` }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Toast */}
                {error && <div style={toastErrorStyle}>{error}</div>}
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
                    <p style={{ color: THEME.textMuted }}>Registering {scannerName}</p>
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

const containerStyleFullscreen = {
    height: '100dvh', display: 'flex', flexDirection: 'column',
    backgroundColor: 'black', color: 'white'
};

const cardStyle = {
    background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(20px)',
    border: `1px solid ${THEME.border}`, padding: '40px 30px', borderRadius: '30px',
    width: '100%', maxWidth: '380px', textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: 10
};

const iconBadgeStyle = {
    width: '70px', height: '70px', borderRadius: '24px', background: THEME.accent,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
    margin: '0 auto 24px', boxShadow: `0 10px 30px -5px ${THEME.accent}80`
};

const headingStyle = { fontSize: '24px', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.5px' };
const subTextStyle = { color: THEME.textMuted, fontSize: '15px', lineHeight: '1.5', margin: '0 0 30px' };

const inputWrapperStyle = { textAlign: 'left', marginBottom: '24px' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: THEME.textMuted, marginBottom: '8px' };
const inputStyle = {
    width: '100%', padding: '16px', borderRadius: '14px', border: `1px solid ${THEME.border}`,
    background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box'
};

const btnPrimaryStyle = {
    width: '100%', padding: '18px', borderRadius: '16px', border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: 'white', fontWeight: '800', fontSize: '16px', letterSpacing: '0.5px',
    cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)',
    transition: 'transform 0.1s'
};

const btnSecondaryStyle = {
    padding: '12px 24px', borderRadius: '12px', border: 'none', background: THEME.border,
    color: 'white', fontWeight: '700', cursor: 'pointer'
};

const errorMessageStyle = {
    background: 'rgba(239, 68, 68, 0.15)', color: THEME.error, padding: '16px',
    borderRadius: '12px', marginBottom: '20px', fontSize: '13px', fontWeight: '600',
    lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
};

// Camera Overlays
const headerOverlayStyle = {
    position: 'absolute', top: 0, left: 0, right: 0, height: '60px', zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)'
};
const backBtnStyle = { background: 'none', border: 'none', color: 'white', fontWeight: '600', fontSize: '14px' };
const iconBtnStyle = { background: 'rgba(255,255,255,0.1)', width: '36px', height: '36px', borderRadius: '10px', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const scanOverlayStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)', // Dimmed Background
    maskImage: 'radial-gradient(ellipse at center, transparent 35%, black 60%)', // Cutout effect (simulated via mask or just box shadow)
    WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 35%, black 60%)'
};
// Note: maskImage is tricky in React inline. Using BoxShadow method is safer for cross-browser scanner styles.
// Actually, simple frame is robust:
const scanFrameBox = {
    width: '260px', height: '260px', position: 'relative', borderRadius: '30px',
    boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)', // The dark overlay
    border: '2px solid rgba(255,255,255,0.2)'
};

const scanInstructionStyle = { marginTop: '40px', fontWeight: '700', letterSpacing: '0.5px', textShadow: '0 2px 4px black', zIndex: 100 };

const cornerBase = { position: 'absolute', width: '40px', height: '40px', borderColor: THEME.accent, borderStyle: 'solid' };
const scanCornerTL = { ...cornerBase, top: '-2px', left: '-2px', borderTopWidth: '4px', borderLeftWidth: '4px', borderTopLeftRadius: '30px' };
const scanCornerTR = { ...cornerBase, top: '-2px', right: '-2px', borderTopWidth: '4px', borderRightWidth: '4px', borderTopRightRadius: '30px' };
const scanCornerBL = { ...cornerBase, bottom: '-2px', left: '-2px', borderBottomWidth: '4px', borderLeftWidth: '4px', borderBottomLeftRadius: '30px' };
const scanCornerBR = { ...cornerBase, bottom: '-2px', right: '-2px', borderBottomWidth: '4px', borderRightWidth: '4px', borderBottomRightRadius: '30px' };
const scanLaser = {
    position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px',
    background: THEME.error, boxShadow: `0 0 15px ${THEME.error}`, opacity: 0.8
};

const errorOverlayStyle = {
    position: 'absolute', inset: 0, background: '#0f172a', zIndex: 60,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center'
};

const modalBackdropStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const modalCardStyle = { ...cardStyle, maxWidth: '320px', padding: '30px 20px' };

const toastErrorStyle = {
    position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
    background: THEME.error, color: 'white', padding: '12px 24px', borderRadius: '50px',
    fontWeight: '700', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 200, width: 'max-content'
};

const spinnerStyle = { width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: THEME.accent, borderRadius: '50%' };

// Decoration
const blobBase = { position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 };
const blob1 = { ...blobBase, width: '300px', height: '300px', background: '#6366f1', top: '-100px', left: '-100px', opacity: 0.2 };
const blob2 = { ...blobBase, width: '250px', height: '250px', background: '#ec4899', bottom: '-80px', right: '-80px', opacity: 0.15 };

export default SetupScreen;
