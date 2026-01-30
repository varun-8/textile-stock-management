import React, { useState, useEffect, useRef } from 'react';
import { useMobile } from '../context/MobileContext';
import jsQR from 'jsqr';
import { haptic } from '../utils/haptic';
import MissingScans from '../components/MissingScans';

const THEME = {
    primary: '#0f172a',
    secondary: '#1e293b',
    accent: '#6366f1',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    border: '#334155'
};

const WorkScreen = () => {
    const { api, serverIp, setServerIp, unpair } = useMobile();
    const [scanned, setScanned] = useState(false);
    const [showIpInput, setShowIpInput] = useState(false);
    const [showMissing, setShowMissing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [torch, setTorch] = useState(false);

    const [scanData, setScanData] = useState(null);
    const [mode, setMode] = useState('SCAN'); // SCAN, ACTION, IN_FORM
    const [form, setForm] = useState({ metre: '', weight: '', percentage: '100' });
    const [cameraError, setCameraError] = useState(null);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);

    // Start camera when in SCAN mode
    useEffect(() => {
        if (mode === 'SCAN' && !scanned && !showMissing && !showIpInput && !showMenu) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [mode, scanned, showMissing, showIpInput, showMenu]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                await videoRef.current.play();
                scanBarcode();
            }
        } catch (err) {
            console.error('Environment camera failed:', err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }
                });
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    await videoRef.current.play();
                    scanBarcode();
                }
            } catch (finalErr) {
                console.error('Camera failed:', finalErr);
                setCameraError('Camera access denied. Please enable camera permissions.');
            }
        }
    };

    const stopCamera = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const scanBarcode = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const scan = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA && !scanned) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    handleBarCodeScanned(code.data);
                    return;
                }
            }
            animationRef.current = requestAnimationFrame(scan);
        };

        scan();
    };

    const handleBarCodeScanned = async (data) => {
        setScanned(true);
        haptic.light();
        
        try {
            const res = await api.get(`/api/mobile/scan/${data}`);
            const json = res.data;

            if (json.status === 'INVALID') {
                haptic.error();
                if (window.confirm(`❌ Invalid Barcode\n${json.message}`)) {
                    setScanned(false);
                }
                return;
            }

            if (json.gapDetected) {
                haptic.pattern([30, 50, 30]);
                const proceed = window.confirm(
                    `⚠️ Sequence Warning\n\nA barcode (${json.gapBarcode}) was skipped! Do you want to continue with ${data}?`
                );
                
                if (proceed) {
                    setScanData({ barcode: data, ...json });
                    setMode('ACTION');
                } else {
                    setScanned(false);
                }
            } else {
                haptic.medium();
                setScanData({ barcode: data, ...json });
                setMode('ACTION');
            }
        } catch (err) {
            console.error('Connection error:', err);
            haptic.error();
            const retry = window.confirm(
                'Connection Failed\n\nVerify Server IP in settings.\n\nPress OK to go to Settings, Cancel to Retry.'
            );
            
            if (retry) {
                setScanned(false);
                setShowIpInput(true);
            } else {
                setScanned(false);
            }
        }
    };

    const executeSubmit = async (type) => {
        const payload = {
            barcode: scanData.barcode,
            type,
            metre: parseFloat(form.metre || 0),
            weight: parseFloat(form.weight || 0),
            percentage: parseFloat(form.percentage || 100)
        };

        try {
            const res = await api.post('/api/mobile/transaction', payload);
            const json = res.data;

            if (json.error) {
                haptic.error();
                alert(`Failed\n${json.error}`);
            } else {
                haptic.success();
                alert(`Success\n\nRoll ${type} logged!`);
                reset();
            }
        } catch (err) {
            haptic.error();
            alert('Error\n\nTransaction failed to send.');
        }
    };

    const reset = () => {
        setScanned(false);
        setScanData(null);
        setMode('SCAN');
        setForm({ metre: '', weight: '', percentage: '100' });
    };

    const handleUnpair = () => {
        if (window.confirm('Are you sure you want to unpair this device?\n\nYou will need to scan the QR code again to reconnect.')) {
            unpair();
        }
    };

    // MENU MODAL
    if (showMenu) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '30px'
            }}>
                <div style={{
                    backgroundColor: THEME.secondary,
                    padding: '0',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '400px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        padding: '30px 30px 20px',
                        borderBottom: `1px solid ${THEME.border}`
                    }}>
                        <h2 style={{ color: THEME.text, fontSize: '20px', fontWeight: '900', margin: 0 }}>
                            Menu
                        </h2>
                    </div>

                    <div style={{ padding: '10px 0' }}>
                        <button
                            onClick={() => { setShowMenu(false); setShowIpInput(true); }}
                            style={{
                                width: '100%',
                                padding: '18px 30px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: THEME.text,
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}>
                            <span style={{ fontSize: '20px' }}>⚙️</span>
                            Change Server IP
                        </button>

                        <button
                            onClick={() => { setShowMenu(false); setShowMissing(true); }}
                            style={{
                                width: '100%',
                                padding: '18px 30px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: THEME.text,
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}>
                            <span style={{ fontSize: '20px' }}>📋</span>
                            View Missing Scans
                        </button>

                        <button
                            onClick={() => { setShowMenu(false); handleUnpair(); }}
                            style={{
                                width: '100%',
                                padding: '18px 30px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: THEME.error,
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}>
                            <span style={{ fontSize: '20px' }}>🔓</span>
                            Unpair Device
                        </button>
                    </div>

                    <div style={{ 
                        padding: '20px 30px',
                        borderTop: `1px solid ${THEME.border}`
                    }}>
                        <button
                            onClick={() => setShowMenu(false)}
                            style={{
                                width: '100%',
                                padding: '15px',
                                backgroundColor: THEME.primary,
                                border: `1px solid ${THEME.border}`,
                                borderRadius: '10px',
                                color: THEME.text,
                                fontSize: '14px',
                                fontWeight: '900',
                                cursor: 'pointer'
                            }}>
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // MISSING SCANS VIEW
    if (showMissing) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: THEME.primary, display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                    height: '60px', 
                    padding: '0 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    backgroundColor: THEME.secondary,
                    borderBottom: `1px solid ${THEME.border}`
                }}>
                    <h1 style={{ color: THEME.text, fontWeight: '900', letterSpacing: '1px', margin: 0, fontSize: '16px' }}>
                        WH FLOW
                    </h1>
                </div>
                
                <div style={{ flex: 1 }}>
                    <MissingScans serverIp={serverIp} />
                </div>

                <button
                    onClick={() => setShowMissing(false)}
                    style={{
                        backgroundColor: THEME.secondary,
                        padding: '20px',
                        border: 'none',
                        color: THEME.text,
                        fontWeight: '900',
                        fontSize: '14px',
                        cursor: 'pointer'
                    }}>
                    BACK TO SCANNER
                </button>
            </div>
        );
    }

    // IP SETTINGS MODAL
    if (showIpInput) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '30px'
            }}>
                <div style={{
                    backgroundColor: THEME.secondary,
                    padding: '30px',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <h2 style={{ color: THEME.text, fontSize: '20px', fontWeight: '900', marginBottom: '20px' }}>
                        Set IP
                    </h2>
                    <input
                        type="text"
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        placeholder="192.168.x.x"
                        style={{
                            width: '100%',
                            padding: '15px',
                            backgroundColor: THEME.primary,
                            border: `1px solid ${THEME.border}`,
                            borderRadius: '10px',
                            color: THEME.text,
                            fontSize: '16px',
                            marginBottom: '15px',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button
                        onClick={() => setShowIpInput(false)}
                        style={{
                            width: '100%',
                            padding: '15px',
                            backgroundColor: THEME.accent,
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '900',
                            cursor: 'pointer'
                        }}>
                        SAVE
                    </button>
                </div>
            </div>
        );
    }

    // MAIN SCANNER VIEW
    return (
        <div style={{ minHeight: '100vh', backgroundColor: THEME.primary, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ 
                height: '60px', 
                padding: '0 20px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                backgroundColor: THEME.secondary,
                borderBottom: `1px solid ${THEME.border}`,
                zIndex: 10
            }}>
                <h1 style={{ color: THEME.text, fontWeight: '900', letterSpacing: '1px', margin: 0, fontSize: '16px' }}>
                    WH FLOW
                </h1>
                <button 
                    onClick={() => setShowIpInput(true)}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        fontSize: '20px', 
                        cursor: 'pointer',
                        padding: '5px'
                    }}>
                    ⚙️
                </button>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                {mode === 'SCAN' ? (
                    <>
                        {/* Full-screen Camera */}
                        <video 
                            ref={videoRef}
                            playsInline
                            muted
                            style={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Overlay with cutout */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none'
                        }}>
                            {/* Scanning Frame */}
                            <div style={{
                                width: '250px',
                                height: '180px',
                                border: `2px solid ${THEME.accent}`,
                                borderRadius: '10px',
                                position: 'relative'
                            }}>
                                {/* Optional: Add scanning line animation */}
                            </div>

                            {/* Hint Text */}
                            <p style={{
                                color: 'white',
                                marginTop: '20px',
                                fontWeight: '900',
                                fontSize: '12px',
                                letterSpacing: '1px',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}>
                                POINT AT BARCODE
                            </p>
                        </div>

                        {/* Torch Toggle - Top Right */}
                        <button
                            onClick={() => setTorch(!torch)}
                            style={{
                                position: 'absolute',
                                top: '30px',
                                right: '30px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                padding: '10px',
                                borderRadius: '30px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                zIndex: 10
                            }}>
                            {torch ? '💡' : '🔦'}
                        </button>

                        {/* View Gaps Button - Bottom Center */}
                        <button
                            onClick={() => setShowMissing(true)}
                            style={{
                                position: 'absolute',
                                bottom: '30px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: THEME.secondary,
                                padding: '12px 25px',
                                borderRadius: '25px',
                                border: `1px solid ${THEME.border}`,
                                color: THEME.warning,
                                fontSize: '12px',
                                fontWeight: '900',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                zIndex: 10
                            }}>
                            VIEW GAPS
                        </button>

                        {/* Camera Error */}
                        {cameraError && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 20,
                                padding: '40px'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        margin: '0 auto 30px',
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${THEME.error}, #dc2626)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '40px'
                                    }}>
                                        📷
                                    </div>
                                    <h3 style={{ color: THEME.text, fontWeight: '900', fontSize: '20px', marginBottom: '15px' }}>
                                        Camera Required
                                    </h3>
                                    <p style={{ color: THEME.textMuted, fontSize: '14px', lineHeight: '1.6', maxWidth: '300px', margin: '0 auto 30px' }}>
                                        {cameraError}
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        style={{
                                            padding: '15px 30px',
                                            backgroundColor: THEME.accent,
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: 'white',
                                            fontSize: '16px',
                                            fontWeight: '900',
                                            cursor: 'pointer'
                                        }}>
                                        Enable Camera
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    // ACTION & FORM PANEL
                    <div style={{ 
                        flex: 1, 
                        padding: '20px',
                        overflowY: 'auto'
                    }}>
                        {/* Barcode Card */}
                        <div style={{
                            padding: '25px',
                            backgroundColor: THEME.secondary,
                            borderRadius: '15px',
                            textAlign: 'center',
                            marginBottom: '20px'
                        }}>
                            <p style={{ color: THEME.textMuted, fontSize: '10px', fontWeight: '900', marginBottom: '5px' }}>
                                BARCODE
                            </p>
                            <p style={{ color: THEME.text, fontSize: '32px', fontWeight: '900', fontFamily: 'monospace', margin: 0 }}>
                                {scanData.barcode}
                            </p>
                        </div>

                        {mode === 'ACTION' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={() => setMode('IN_FORM')}
                                    style={{
                                        padding: '20px',
                                        backgroundColor: THEME.success,
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '16px',
                                        fontWeight: '900',
                                        cursor: 'pointer'
                                    }}>
                                    STOCK IN
                                </button>
                                <button
                                    onClick={() => executeSubmit('OUT')}
                                    style={{
                                        padding: '20px',
                                        backgroundColor: THEME.error,
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '16px',
                                        fontWeight: '900',
                                        cursor: 'pointer'
                                    }}>
                                    STOCK OUT (DISPATCH)
                                </button>
                                <button
                                    onClick={reset}
                                    style={{
                                        padding: '15px',
                                        background: 'none',
                                        border: 'none',
                                        color: THEME.textMuted,
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}>
                                    CANCEL
                                </button>
                            </div>
                        ) : (
                            <div style={{
                                padding: '20px',
                                backgroundColor: THEME.secondary,
                                borderRadius: '15px'
                            }}>
                                <h3 style={{ color: THEME.text, fontSize: '20px', fontWeight: '900', marginBottom: '20px' }}>
                                    Enter Details
                                </h3>

                                {/* METRE Input */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ 
                                        display: 'block',
                                        color: THEME.textMuted, 
                                        fontSize: '10px', 
                                        fontWeight: '900', 
                                        marginBottom: '5px' 
                                    }}>
                                        METRE
                                    </label>
                                    <input
                                        type="number"
                                        value={form.metre}
                                        onChange={(e) => setForm({ ...form, metre: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '15px',
                                            backgroundColor: THEME.primary,
                                            border: `1px solid ${THEME.border}`,
                                            borderRadius: '10px',
                                            color: THEME.text,
                                            fontSize: '18px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                {/* WEIGHT Input */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ 
                                        display: 'block',
                                        color: THEME.textMuted, 
                                        fontSize: '10px', 
                                        fontWeight: '900', 
                                        marginBottom: '5px' 
                                    }}>
                                        WEIGHT
                                    </label>
                                    <input
                                        type="number"
                                        value={form.weight}
                                        onChange={(e) => setForm({ ...form, weight: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '15px',
                                            backgroundColor: THEME.primary,
                                            border: `1px solid ${THEME.border}`,
                                            borderRadius: '10px',
                                            color: THEME.text,
                                            fontSize: '18px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <button
                                    onClick={() => executeSubmit('IN')}
                                    style={{
                                        width: '100%',
                                        padding: '20px',
                                        backgroundColor: THEME.accent,
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '16px',
                                        fontWeight: '900',
                                        cursor: 'pointer',
                                        marginBottom: '10px'
                                    }}>
                                    SAVE & LOG
                                </button>

                                <button
                                    onClick={() => setMode('ACTION')}
                                    style={{
                                        width: '100%',
                                        padding: '15px',
                                        background: 'none',
                                        border: 'none',
                                        color: THEME.textMuted,
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}>
                                    BACK
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkScreen;
