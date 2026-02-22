import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { haptic } from '../utils/haptic';

const IconFlash = ({ size = 20, active = false, disabled = false }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? "#f59e0b" : "none"}
        stroke={active ? "#f59e0b" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
            filter: active ? 'drop-shadow(0 0 5px rgba(245, 158, 11, 0.8))' : 'none',
            transition: 'all 0.3s ease',
            opacity: disabled ? 0.3 : 1
        }}
    >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);

const WorkScreen = () => {
    const navigate = useNavigate();
    const { api, serverIp, setServerIp, unpair, deferredPrompt, installApp, scannerId } = useMobile();
    const [scanned, setScanned] = useState(false);


    const [showInstallHelp, setShowInstallHelp] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualBarcode, setManualBarcode] = useState('');
    const [torch, setTorch] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    const [sessionMode, setSessionMode] = useState('IN');
    const [showMenu, setShowMenu] = useState(false);

    // Session Info State
    const [sessionSize, setSessionSize] = useState(null);
    const [sessionId, setSessionId] = useState(null);

    const [currentBarcode, setCurrentBarcode] = useState(null);
    const [mode, setMode] = useState('SCAN');
    const [scanData, setScanData] = useState(null);
    const [form, setForm] = useState({ metre: '', weight: '', percentage: '100' });
    const [previewItem, setPreviewItem] = useState(null);

    // Load Session from LocalStorage on Mount
    useEffect(() => {
        const sType = localStorage.getItem('active_session_type');
        const sSize = localStorage.getItem('active_session_size');
        const sId = localStorage.getItem('active_session_id');

        if (sType) setSessionMode(sType);
        if (sSize) setSessionSize(sSize);
        if (sId) setSessionId(sId);
    }, []);

    // Auto-calculate Percentage: (Weight / Metre) * 1000
    useEffect(() => {
        const m = parseFloat(form.metre);
        const w = parseFloat(form.weight);
        if (m > 0 && w > 0) {
            const calc = ((w / m) * 1000).toFixed(2);
            setForm(prev => ({ ...prev, percentage: calc }));
        }
    }, [form.metre, form.weight]);

    const [alertState, setAlertState] = useState({ show: false, message: '', type: 'info', title: '' });
    const [isProcessing, setIsProcessing] = useState(false);

    const html5QrCodeRef = useRef(null);
    const scanningRef = useRef(false);

    // Session Finish State
    const [showFinishPreview, setShowFinishPreview] = useState(false);
    const [finishStats, setFinishStats] = useState(null);
    const [showSessionComplete, setShowSessionComplete] = useState(false);

    // Live Session Stats
    const [sessionStats, setSessionStats] = useState({ totalCount: 0, totalMetre: 0, totalWeight: 0 });

    const normalizeStats = (stats = {}) => ({
        totalCount: Number(stats.totalCount ?? stats.count ?? 0),
        totalMetre: Number(stats.totalMetre ?? 0),
        totalWeight: Number(stats.totalWeight ?? 0)
    });

    const fetchSessionStats = async () => {
        if (!sessionId) return;
        try {
            const res = await api.get(`/api/sessions/${sessionId}/preview`);
            if (res.data.success) {
                setSessionStats(res.data.stats);
            }
        } catch (err) {
            console.error("Failed to fetch stats", err);
        }
    };

    useEffect(() => {
        if (sessionId) {
            fetchSessionStats();
            const interval = setInterval(fetchSessionStats, 5000);
            return () => clearInterval(interval);
        }
    }, [sessionId]);

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

    const showAlert = (message, type = 'info', title = '') => {
        setAlertState({ show: true, message, type, title });
    };

    const closeAlert = () => {
        setAlertState((prev) => ({ ...prev, show: false }));
        if (alertState.type === 'error') {
            scanningRef.current = false;
        }
    };

    useEffect(() => {
        if (mode === 'SCAN' && !scanned) {
            startCamera();
        } else {
            stopCamera();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                stopCamera();
            } else if (document.visibilityState === 'visible' && mode === 'SCAN' && !scanned) {
                setTimeout(() => startCamera(), 500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            stopCamera();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [mode, scanned]);

    const startCamera = async () => {
        try {
            if (html5QrCodeRef.current) return;

            console.log('📱 Starting camera...');
            setCameraError(null);

            const html5QrCode = new Html5Qrcode("reader");
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 5,
                qrbox: { width: 280, height: 200 },
                disableFlip: false,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13
                ]
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    if (scanningRef.current) return;
                    if (decodedText) {
                        scanningRef.current = true;
                        haptic.success();
                        handleBarCodeScanned(decodedText);
                    }
                },
                (errorMessage) => { }
            );

            // Check Torch Capability with multiple fallback methods
            try {
                let supported = false;

                // Method 1: Library provided capability check
                if (typeof html5QrCode.getRunningTrackCameraCapabilities === 'function') {
                    const caps = html5QrCode.getRunningTrackCameraCapabilities();
                    supported = caps && caps.torchFeature().isSupported();
                }

                // Method 2: Direct track check (more reliable on some devices)
                if (!supported) {
                    const track = html5QrCode.getRunningTrack();
                    if (track && typeof track.getCapabilities === 'function') {
                        const caps = track.getCapabilities();
                        supported = !!caps.torch;
                    }
                }

                setHasTorch(supported);
            } catch (err) {
                console.warn('Torch check failed:', err);
                setHasTorch(false);
            }

        } catch (err) {
            console.error('❌ Camera error:', err);
            setCameraError(`${err.name}: ${err.message}`);
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

    const handleBarCodeScanned = async (data) => {
        setScanned(true);

        let formattedBarcode = data.replace(/\s+/g, '').replace(/[^\d-]/g, '').trim();

        if (!formattedBarcode.includes('-') && formattedBarcode.length >= 8) {
            formattedBarcode = `${formattedBarcode.substring(0, 2)}-${formattedBarcode.substring(2, 4)}-${formattedBarcode.substring(4)}`;
        }

        // --- BULK OUT MODE LOGIC ---
        if (sessionMode === 'OUT') {
            // Instant Stock Out
            handleQuickStockOut(formattedBarcode);
            return;
        }

        // --- STANDARD IN MODE LOGIC (Existing) ---
        try {
            const url = `/api/mobile/scan/${formattedBarcode}`;
            const res = await api.get(url, { headers: { 'x-session-id': sessionId } });
            const json = res.data;

            // Session Logic
            if (json.status === 'WRONG_SIZE') {
                haptic.error();
                showAlert(`🛑 WRONG SIZE!\n\nExpected: ${json.expected}\nScanned: ${json.actual}`, 'error');
                setScanned(false);
                scanningRef.current = false;
                return;
            }

            if (json.status === 'SESSION_ENDED') {
                haptic.error();
                showAlert('Session has ended. Redirecting...', 'error');
                setTimeout(() => {
                    localStorage.removeItem('active_session_id');
                    window.location.reload();
                }, 2000);
                return;
            }

            if (json.status === 'INVALID') {
                haptic.error();
                showAlert(`❌ Invalid Barcode\n\n${json.message}`, 'error');
                setScanned(false);
                scanningRef.current = false;
                return;
            }

            setCurrentBarcode(formattedBarcode);
            setScanData({ ...json, barcode: formattedBarcode });

            if (json.status === 'EXISTING' && json.data) {
                setForm({
                    metre: json.data.metre ? String(json.data.metre) : '',
                    weight: json.data.weight ? String(json.data.weight) : '',
                    percentage: json.data.percentage ? String(json.data.percentage) : '100'
                });
            } else {
                setForm({ metre: '', weight: '', percentage: '100' });
            }

            if (sessionMode === 'IN' && json.data?.status !== 'IN') {
                setTimeout(() => setMode('IN_FORM'), 300);
            } else {
                setTimeout(() => setMode('ACTION'), 300);
            }

        } catch (err) {
            haptic.error();
            showAlert(`Error: ${err.message}`, 'error');
            setScanned(false);
            scanningRef.current = false;
        }
    };

    const handleQuickStockOut = async (barcode) => {
        // Prevent concurrent processing for the SAME barcode, but allow fast subsequent scans
        if (isProcessing) return;

        setIsProcessing(true);
        // Note: scanningRef is already true from the caller, we keep it true until we finish

        const employee = JSON.parse(localStorage.getItem('employee') || '{}');

        const payload = {
            barcode: barcode,
            type: 'OUT',
            employeeId: employee.employeeId, // E001, E002, etc.
            employeeName: employee.name,
            sessionId: sessionId // Include Session ID
        };

        try {
            const res = await api.post('/api/mobile/transaction', payload);

            if (res.data.error) {
                haptic.error();
                // Check if it's already out, might want a softer warning or just error
                showAlert(res.data.error, 'error');
            } else {
                haptic.success();
                // Optional: Show a "Toast" instead of a full blocking alert for speed?
                // For now, using the existing alert but maybe auto-dismiss it?
                // Actually, let's just show a quick successful toast if possible, otherwise alert.
                // The current showAlert blocks? No, it sets state.
                showAlert(`✅ OUT: ${barcode}`, 'success');

                // Trigger stats refresh in background
                fetchSessionStats();
            }
        } catch (err) {
            haptic.error();
            showAlert(err.response?.data?.error || err.message, 'error');
        } finally {
            setIsProcessing(false);
            // Re-enable scanning after a short delay to prevent accidental double-scans of same barcode
            setTimeout(() => {
                setScanned(false);
                scanningRef.current = false;
            }, 1500); // 1.5s delay before next scan is allowed - good for pace
        }
    };

    const executeSubmit = async (type) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const employee = JSON.parse(localStorage.getItem('employee') || '{}');

        const payload = {
            barcode: scanData.barcode,
            type, // Always IN for this mode, but kept flexible
            metre: parseFloat(form.metre || 0),
            weight: parseFloat(form.weight || 0),
            percentage: parseFloat(form.percentage || 100),
            employeeId: employee.employeeId, // E001, E002, etc.
            employeeName: employee.name,
            sessionId: sessionId // Include Session ID
        };

        try {
            const res = await api.post('/api/mobile/transaction', payload);
            if (res.data.error) {
                haptic.error();
                showAlert(res.data.error, 'error');
            } else {
                haptic.success();
                showAlert(`✅ ${type} Successful!`, 'success');
                fetchSessionStats(); // Refresh Stats
                reset();
            }
        } catch (err) {
            haptic.error();
            showAlert(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };





    const reset = () => {
        scanningRef.current = false;
        setScanned(false);
        setScanData(null);
        setMode('SCAN');
        setForm({ metre: '', weight: '', percentage: '100' });
        setCurrentBarcode(null);
    };

    const switchSessionMode = (newMode) => {
        setSessionMode(newMode);
        reset();
    };

    useEffect(() => {
        const applyTorch = async () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning && mode === 'SCAN' && !scanned) {
                try {
                    // Start by updating the internal state if the library supports it
                    await html5QrCodeRef.current.applyVideoConstraints({
                        advanced: [{ torch: torch }]
                    });
                } catch (err) {
                    console.warn("Standard Torch API failed, trying direct track constraint...", err);
                    try {
                        const track = html5QrCodeRef.current.getRunningTrack();
                        if (track && typeof track.applyConstraints === 'function') {
                            await track.applyConstraints({
                                advanced: [{ torch: torch }]
                            });
                        } else {
                            throw new Error("No track available");
                        }
                    } catch (err2) {
                        console.error("Direct Torch API failed:", err2);
                        if (torch) {
                            haptic.error();
                            // Don't alert repeatedly, just reset UI
                            setTorch(false);
                        }
                    }
                }
            }
        }

        // Small delay to ensure camera is ready
        const timer = setTimeout(applyTorch, 500);
        return () => clearTimeout(timer);
    }, [torch, mode, scanned]);

    const handleTorchClick = () => {
        setTorch(!torch);
    };

    const handleFinishSession = async () => {
        try {
            setIsProcessing(true);
            const res = await api.get(`/api/sessions/${sessionId}/preview`);
            if (res.data.success) {
                setFinishStats(normalizeStats(res.data.stats));
                setShowFinishPreview(true);
                setShowMenu(false);
            } else {
                showAlert(res.data.error || 'Failed to get session stats', 'error');
            }
        } catch (err) {
            console.error(err);
            showAlert('Failed to connect to server', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmFinishSession = async () => {
        try {
            setIsProcessing(true);
            console.log('📱 MOBILE: Ending session with source=mobile', { sessionId });
            const res = await api.post('/api/sessions/end', { sessionId, source: 'mobile' });
            console.log('📱 MOBILE: Response received:', { success: res.data.success, initiator: res.data.initiator });
            if (res.data.success) {
                setFinishStats(normalizeStats(res.data.stats));
                haptic.success();
                setShowFinishPreview(false);
                setShowSessionComplete(true);
                localStorage.removeItem('active_session_id');
                localStorage.removeItem('active_session_type');
                localStorage.removeItem('active_session_size');
            } else {
                showAlert(res.data.error, 'error');
            }
        } catch (err) {
            console.error('📱 MOBILE: Error ending session:', err);
            showAlert(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExitSession = async () => {
        try {
            const sessionIdToUse = sessionId || localStorage.getItem('active_session_id');
            const scannerIdToUse = scannerId || localStorage.getItem('SL_SCANNER_ID');

            if (sessionIdToUse) {
                await api.post(`/api/sessions/${sessionIdToUse}/leave`, {
                    scannerId: scannerIdToUse
                });
            }
        } catch (err) {
            console.error('Failed to leave session:', err);
        }

        // Clear local storage
        localStorage.removeItem('active_session_id');
        localStorage.removeItem('active_session_type');
        localStorage.removeItem('active_session_size');

        // Reset local state
        setSessionMode('IN');
        setSessionId(null);
        setSessionSize(null);
        reset();

        // Navigate back to sessions list
        navigate('/sessions');
    };

    // Session Completion Screen
    if (showSessionComplete && finishStats) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: THEME.primary, zIndex: 2000,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'slideUp 0.6s ease-out' }}>
                    <div style={{ fontSize: '80px', marginBottom: '20px', animation: 'bounce 0.8s ease-in-out' }}>✅</div>
                    <h1 style={{ color: 'white', fontSize: '28px', margin: 0, fontWeight: '800' }}>Session Complete!</h1>
                    <p style={{ color: THEME.textMuted, marginTop: '12px', fontSize: '14px' }}>Your session has been successfully saved.</p>
                </div>

                <div style={{ width: '80%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center', animation: 'slideUp 0.7s ease-out' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>{finishStats.totalCount}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>ITEMS SCANNED</div>
                    </div>
                    <div style={{ background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center', animation: 'slideUp 0.8s ease-out' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: THEME.accent }}>{finishStats.totalMetre.toFixed(0)}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>TOTAL METRE</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center', animation: 'slideUp 0.9s ease-out' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: THEME.success }}>{finishStats.totalWeight.toFixed(1)}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>TOTAL WEIGHT (KG)</div>
                    </div>
                </div>

                <style>{`
                    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                `}</style>

                <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={() => {
                            setShowSessionComplete(false);
                            setSessionId(null);
                            setSessionMode('IN');
                            setSessionSize(null);
                            reset();
                            navigate('/sessions');
                        }}
                        style={{
                            padding: '14px 24px', borderRadius: '10px', border: 'none',
                            background: THEME.accent, color: 'white', fontWeight: '700', fontSize: '14px',
                            cursor: 'pointer', transition: 'all 0.3s ease'
                        }}
                    >
                        BACK TO SESSIONS
                    </button>
                </div>
            </div>
        );
    }

    // Render Logic
    if (showFinishPreview && finishStats) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: THEME.primary, zIndex: 2000,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏁</div>
                    <h1 style={{ color: 'white', fontSize: '24px', margin: 0 }}>Finish Session?</h1>
                    <p style={{ color: THEME.textMuted, marginTop: '8px' }}>Review session summary before closing.</p>
                </div>

                <div style={{ width: '80%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>{finishStats.totalCount}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>ITEMS</div>
                    </div>
                    <div style={{ background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: THEME.accent }}>{finishStats.totalMetre.toFixed(0)}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>METRE</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', background: THEME.secondary, padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: THEME.success }}>{finishStats.totalWeight.toFixed(1)}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: THEME.textMuted, marginTop: '4px' }}>TOTAL WEIGHT (KG)</div>
                    </div>
                </div>

                <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <ActionButton
                        onClick={confirmFinishSession}
                        label="CONFIRM & FINISH"
                        icon="✅"
                        color={THEME.success}
                    />
                    <ActionButton
                        onClick={() => setShowFinishPreview(false)}
                        label="CANCEL"
                        variant="ghost"
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100dvh', width: '100vw', backgroundColor: 'black', display: 'flex', flexDirection: 'column', position: 'fixed', overflow: 'hidden' }}>

            {/* Premium Minimalistic Header */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '76px',
                padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(25px) saturate(200%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)', zIndex: 100
            }}>
                {/* Left: Refined User Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '100px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: '800', fontSize: '12px',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)'
                    }}>
                        {(() => {
                            const e = JSON.parse(localStorage.getItem('employee') || '{}');
                            return e.name ? e.name.charAt(0).toUpperCase() : '?';
                        })()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'white', fontWeight: '700', fontSize: '13px', letterSpacing: '-0.01em' }}>
                            {(() => {
                                const e = JSON.parse(localStorage.getItem('employee') || '{}');
                                return e.name || 'User';
                            })()}
                        </span>
                        <span style={{ color: THEME.textMuted, fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {sessionMode === 'IN' ? 'Receiving' : 'Dispatch'}
                        </span>
                    </div>
                </div>

                {/* Center: Sleek Mode Tag */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(255, 255, 255, 0.03)', padding: '6px 14px',
                    borderRadius: '100px', border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: sessionMode === 'IN' ? THEME.success : THEME.error,
                        boxShadow: `0 0 8px ${sessionMode === 'IN' ? THEME.success : THEME.error}`
                    }} />
                    <span style={{ color: 'white', fontWeight: '800', fontSize: '11px', letterSpacing: '0.02em', opacity: 0.9 }}>
                        SIZE {sessionSize || '--'}
                    </span>
                </div>

                {/* Right: Actions & Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        background: 'rgba(99, 102, 241, 0.1)', padding: '6px 12px',
                        borderRadius: '10px', marginRight: '4px'
                    }}>
                        <span style={{ color: THEME.accent, fontWeight: '900', fontSize: '14px' }}>
                            {sessionStats.totalCount}
                        </span>
                        <span style={{ color: THEME.accent, fontWeight: '700', fontSize: '9px', opacity: 0.7 }}>UNITS</span>
                    </div>

                    {hasTorch && (
                        <button
                            onClick={handleTorchClick}
                            style={{
                                ...iconBtnStyle,
                                width: '38px', height: '38px', borderRadius: '10px',
                                background: torch ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: torch ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                color: torch ? '#f59e0b' : 'white',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            <IconFlash active={torch} size={18} />
                        </button>
                    )}

                    <button
                        onClick={() => setShowMenu(true)}
                        style={{
                            ...iconBtnStyle,
                            width: '38px', height: '38px', borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            fontSize: '18px'
                        }}
                    >
                        ☰
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

                {mode === 'SCAN' ? (
                    <>
                        <div id="reader" style={{ width: '100%', height: '100%' }}></div>
                        <style>
                            {`
                                #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: 0 !important; }
                                #reader { border: none !important; }
                            `}
                        </style>

                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                width: '280px', height: '280px',
                                border: `2px solid ${sessionMode === 'IN' ? THEME.success : THEME.error}`, borderRadius: '24px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
                                position: 'relative', overflow: 'hidden'
                            }}>
                                <div className="laser-line" style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                    background: sessionMode === 'IN' ? THEME.success : THEME.error,
                                    boxShadow: `0 0 10px ${sessionMode === 'IN' ? THEME.success : THEME.error}`,
                                    animation: 'scan 2s infinite ease-in-out'
                                }}></div>
                                <style>{`@keyframes scan { 0% { top: 10%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 90%; opacity: 0; } }`}</style>
                            </div>



                            <button
                                onClick={() => setShowManualInput(true)}
                                style={{
                                    position: 'absolute', bottom: '15%',
                                    background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white',
                                    padding: '16px 32px', borderRadius: '100px', fontWeight: '700',
                                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                                    pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px'
                                }}>
                                <span>⌨️</span> ENTER PIN / BARCODE
                            </button>

                            <button
                                onClick={handleExitSession}
                                style={{
                                    position: 'absolute', bottom: '2%',
                                    background: 'rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)', color: THEME.error,
                                    padding: '12px 24px', borderRadius: '100px', fontWeight: '700',
                                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                                    pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px'
                                }}>
                                <span>🚪</span> EXIT SESSION
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0, background: THEME.primary,
                        display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out'
                    }}>
                        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

                        {/* This Scan Result UI is primarily for 'IN' mode or single scan checks */}
                        <div style={{ padding: '80px 20px 20px', textAlign: 'center' }}>
                            <div style={{ background: THEME.secondary, padding: '24px', borderRadius: '24px', border: `1px solid ${THEME.border}` }}>
                                <div style={{ fontSize: '12px', color: THEME.textMuted, fontWeight: '700', marginBottom: '8px' }}>DETECTED BARCODE</div>
                                <div style={{ fontSize: '32px', color: 'white', fontWeight: '800', fontFamily: 'monospace', letterSpacing: '-1px' }}>
                                    {scanData?.barcode}
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
                            {mode === 'ACTION' ? (
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {scanData.gapDetected && (
                                        <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.2)', color: THEME.warning, borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '13px', fontWeight: '600' }}>
                                            ⚠️ Gap Detected: {scanData.gapBarcode} skipped
                                        </div>
                                    )}

                                    {/* Barcode Info */}

                                    {/* Simplified Actions based on Session Mode */}
                                    {sessionMode === 'IN' && (
                                        <ActionButton
                                            onClick={() => setMode('IN_FORM')}
                                            disabled={scanData?.data?.status === 'IN'}
                                            label={scanData?.data?.status === 'IN' ? "ALREADY IN STOCK" : scanData?.status === 'NEW' ? "STOCK IN" : "STOCK IN"}
                                            sub={scanData?.data?.status === 'IN' ? "(Entry Exists)" : scanData?.status === 'NEW' ? "Enter details first" : null}
                                            icon="📥"
                                            color={THEME.success}
                                        />
                                    )}

                                    {sessionMode === 'OUT' && (
                                        <ActionButton
                                            onClick={() => handleQuickStockOut(scanData.barcode)}
                                            disabled={scanData?.data?.status === 'OUT' || !scanData?.data}
                                            label={scanData?.data?.status === 'OUT' ? "ALREADY OUT OF STOCK" : !scanData?.data ? "NOT IN STOCK" : "STOCK OUT"}
                                            sub={scanData?.data?.status === 'OUT' ? "(Already Checked Out)" : !scanData?.data ? "(Cannot stock out)" : null}
                                            icon="📤"
                                            color={THEME.error}
                                        />
                                    )}

                                    {/* Fallback Action if needed or for single checks */}
                                    <ActionButton
                                        onClick={reset}
                                        label="CANCEL"
                                        icon="✕"
                                        variant="ghost"
                                    />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <h2 style={{ color: 'white', fontSize: '20px', margin: 0 }}>
                                        {mode === 'IN_FORM' ? '📥 Details' : '📤 Details'}
                                    </h2>

                                    <InputGroup label="METRE" value={form.metre} onChange={v => setForm({ ...form, metre: v })} />
                                    <InputGroup label="WEIGHT (KG)" value={form.weight} onChange={v => setForm({ ...form, weight: v })} />
                                    <div style={{ opacity: 0.7 }}>
                                        <InputGroup
                                            label="QUALITY % (AUTO)"
                                            value={form.percentage}
                                            onChange={() => { }} // No-op
                                            readOnly={true}
                                        />
                                    </div>

                                    <ActionButton
                                        onClick={() => executeSubmit('IN')}
                                        label="CONFIRM"
                                        icon="✅"
                                        color={THEME.success}
                                    />
                                    <ActionButton onClick={() => setMode('ACTION')} label="BACK" variant="ghost" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>







            {
                showInstallHelp && (
                    <div style={modalBackdropStyle}>
                        <div style={alertBoxStyle}>
                            <div style={{ fontSize: '32px', marginBottom: '16px' }}>📱</div>
                            <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>Install Manually</h3>
                            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                                To install as an App (APK style):
                            </p>
                            <ol style={{ textAlign: 'left', color: 'white', fontSize: '14px', lineHeight: '1.8', marginBottom: '24px', paddingLeft: '20px' }}>
                                <li>Tap browser menu (<b>⋮</b> or <b>Share</b>)</li>
                                <li>Select <b>"Add to Home Screen"</b> or <b>"Install App"</b></li>
                                <li>Confirm installation</li>
                            </ol>
                            <button onClick={() => setShowInstallHelp(false)} style={btnPrimaryStyle}>OK, GOT IT</button>
                        </div>
                    </div>
                )
            }

            {
                alertState.show && (
                    <div style={modalBackdropStyle} onClick={closeAlert}>
                        <div style={alertBoxStyle} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                                {alertState.type === 'error' ? '❌' : '✅'}
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>{alertState.title || (alertState.type === 'error' ? 'Error' : 'Success')}</h3>
                            <p style={{ margin: '0 0 24px 0', color: THEME.textMuted, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
                            <button onClick={closeAlert} style={btnPrimaryStyle}>OK</button>
                        </div>
                    </div>
                )
            }

            {
                showManualInput && (
                    <div style={modalBackdropStyle}>
                        <div style={alertBoxStyle}>
                            <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>Enter Barcode</h3>
                            <input autoFocus value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} style={inputStyle} placeholder="Barcode..." />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button onClick={() => { if (manualBarcode) { handleBarCodeScanned(manualBarcode); setManualBarcode(''); setShowManualInput(false); } }} style={{ ...btnPrimaryStyle, flex: 1 }}>GO</button>
                                <button onClick={() => setShowManualInput(false)} style={{ ...btnGhostStyle, flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* Menu Drawer */}
            {showMenu && (
                <>
                    <div
                        style={{ ...modalBackdropStyle, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease forwards' }}
                        onClick={() => setShowMenu(false)}
                    />
                    <div style={{
                        position: 'fixed', bottom: '20px', left: '20px', right: '20px',
                        background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(25px)',
                        borderRadius: '24px', padding: '12px', zIndex: 1001,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        animation: 'slideUpDrawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                    }}>
                        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '8px auto 20px' }} />

                        <div style={{ display: 'grid', gap: '8px' }}>
                            <MenuItem
                                icon="🏁"
                                label="Finish Session"
                                sub="Generate report & close"
                                onClick={handleFinishSession}
                            />

                            <MenuItem
                                icon="🚪"
                                label="Exit Session"
                                sub="Leave without closing"
                                color={THEME.error}
                                onClick={handleExitSession}
                            />
                        </div>

                        <button
                            onClick={() => setShowMenu(false)}
                            style={{
                                width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)',
                                border: 'none', borderRadius: '16px', color: 'white',
                                fontWeight: '700', fontSize: '14px', marginTop: '12px'
                            }}
                        >
                            CLOSE
                        </button>
                    </div>
                </>
            )}

        </div >
    );
};



const ActionButton = ({ onClick, disabled, label, sub, icon, color, variant = 'solid' }) => (
    <button
        onClick={onClick} disabled={disabled}
        style={{
            width: '100%', padding: '20px', borderRadius: '16px',
            background: variant === 'ghost' ? 'transparent' : (disabled ? '#334155' : (color || '#6366f1')),
            color: disabled ? '#94a3b8' : (variant === 'ghost' ? '#94a3b8' : 'white'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            fontSize: '16px', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer',
            border: variant === 'ghost' ? '1px solid #334155' : 'none',
            transition: 'transform 0.1s active'
        }}
    >
        {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span>{label}</span>
            {sub && <span style={{ fontSize: '12px', opacity: 0.7, fontWeight: '400' }}>{sub}</span>}
        </div>
    </button>
);

const InputGroup = ({ label, value, onChange, type = "number", readOnly = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px', marginLeft: '4px' }}>{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            step="0.01"
            style={{
                background: readOnly ? 'rgba(15, 23, 42, 0.5)' : '#1e293b',
                border: '1px solid #334155',
                color: 'white',
                padding: '16px',
                borderRadius: '16px',
                fontSize: '18px',
                fontWeight: '700',
                outline: 'none',
                width: '100%',
                fontFamily: 'monospace'
            }}
        />
    </div>
);

const MenuItem = ({ icon, label, onClick, sub, color }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '20px 24px', background: 'transparent', border: 'none', color: color || 'white', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '16px', fontWeight: '600', textAlign: 'left', borderBottom: '1px solid #334155' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <div>
            <div>{label}</div>
            {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
    </button>
);

const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
// Native-like Alert Style (iOS/Android hybrid look)
const alertBoxStyle = {
    background: 'rgba(30, 41, 59, 1)',
    backdropFilter: 'blur(24px)',
    padding: '24px',
    borderRadius: '24px',
    width: '85%',
    maxWidth: '340px',
    textAlign: 'center',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)'
};
const menuStyle = { background: '#0f172a', width: '100%', maxWidth: '360px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #334155' };
const iconBtnStyle = { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputStyle = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid #334155', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', textAlign: 'center' };
const btnPrimaryStyle = { width: '100%', padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px' };
const btnGhostStyle = { width: '100%', padding: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', fontWeight: '600', fontSize: '15px' };

const styles = document.createElement('style');
styles.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
`;
document.head.appendChild(styles);

export default WorkScreen;
