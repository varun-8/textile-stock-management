import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { haptic } from '../utils/haptic';

const WorkScreen = () => {
    const navigate = useNavigate();
    const { api, serverIp, setServerIp, unpair, deferredPrompt, installApp, scannerId } = useMobile();
    const [scanned, setScanned] = useState(false);
    const [showIpInput, setShowIpInput] = useState(false);

    const [showInstallHelp, setShowInstallHelp] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualBarcode, setManualBarcode] = useState('');
    const [torch, setTorch] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    const [sessionMode, setSessionMode] = useState('IN');
    const [sessionList, setSessionList] = useState([]);
    const [showReview, setShowReview] = useState(false);

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
        if (mode === 'SCAN' && !scanned && !showIpInput && !showReview) {
            startCamera();
        } else {
            stopCamera();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                stopCamera();
            } else if (document.visibilityState === 'visible' && mode === 'SCAN' && !scanned && !showReview) {
                setTimeout(() => startCamera(), 500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            stopCamera();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [mode, scanned, showIpInput, showReview]);

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

            // Check Torch Capability
            try {
                const caps = html5QrCode.getRunningTrackCameraCapabilities();
                if (caps && caps.torchFeature().isSupported()) {
                    setHasTorch(true);
                } else {
                    setHasTorch(false);
                }
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
            // Check if already in session list
            if (sessionList.some(item => item.barcode === formattedBarcode)) {
                haptic.error();
                showAlert(`Barcode ID: ${formattedBarcode}\n\nAlready in current list!`, 'error', 'Duplicate Scan');
                setScanned(false);
                scanningRef.current = false;
                return;
            }

            // Verify with Server if it exists and is IN Stock
            try {
                const url = `/api/mobile/scan/${formattedBarcode}`;
                const res = await api.get(url, { headers: { 'x-session-id': sessionId } });
                const json = res.data;

                // Session Logic: Wrong Size?
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

                if (json.status === 'INVALID' || !json.data) {
                    haptic.error();
                    showAlert(`Unknown Barcode: ${formattedBarcode}`, 'error');
                } else if (json.data.status === 'OUT') {
                    haptic.error();
                    showAlert(`Item already Dispatched: ${formattedBarcode}`, 'error');
                } else {
                    // SHOW PREVIEW INSTEAD OF AUTO ADDING
                    haptic.success();
                    setPreviewItem({
                        barcode: formattedBarcode,
                        details: json.data
                    });
                    // Pause scanning while in preview
                    scanningRef.current = true;
                }
            } catch (err) {
                haptic.error();
                showAlert(err.message, 'error');
                // Resume scanning on error
                setTimeout(() => {
                    setScanned(false);
                    scanningRef.current = false;
                }, 1000);
            }
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

            setTimeout(() => setMode('ACTION'), 300);

        } catch (err) {
            haptic.error();
            showAlert(`Error: ${err.message}`, 'error');
            setScanned(false);
            scanningRef.current = false;
        }
    };

    const handleQuickStockOut = async (barcode) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const employee = JSON.parse(localStorage.getItem('employee') || '{}');

        const payload = {
            barcode: barcode,
            type: 'OUT',
            employeeId: employee.employeeId, // E001, E002, etc.
            employeeName: employee.name
        };

        try {
            const res = await api.post('/api/mobile/transaction', payload);
            if (res.data.error) {
                haptic.error();
                showAlert(res.data.error, 'error');
            } else {
                haptic.success();
                showAlert(`✅ Stock Out Successful!`, 'success');
                reset();
            }
        } catch (err) {
            haptic.error();
            showAlert(err.response?.data?.error || err.message, 'error');
        } finally {
            setIsProcessing(false);
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
            employeeName: employee.name
        };

        try {
            const res = await api.post('/api/mobile/transaction', payload);
            if (res.data.error) {
                haptic.error();
                showAlert(res.data.error, 'error');
            } else {
                haptic.success();
                showAlert(`✅ ${type} Successful!`, 'success');
                reset();
            }
        } catch (err) {
            haptic.error();
            showAlert(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const submitBatchOut = async () => {
        if (sessionList.length === 0) return;
        setIsProcessing(true);

        try {
            const employee = JSON.parse(localStorage.getItem('employee') || '{}');

            const payload = {
                type: 'OUT',
                employeeId: employee.employeeId, // E001, E002, etc.
                employeeName: employee.name,
                items: sessionList.map(item => ({
                    barcode: item.barcode,
                    details: 'Bulk Stock Out via Session'
                }))
            };

            const res = await api.post('/api/mobile/batch-transaction', payload);

            if (res.data.results && res.data.results.failed.length > 0) {
                const failedCount = res.data.results.failed.length;
                const successCount = res.data.results.success.length;
                showAlert(`⚠️ Partial Success\n\nProcessed: ${successCount}\nFailed: ${failedCount}\n\nCheck logs for failed items.`, 'error');
                // Keep failed items in list? For simplicity, we clear and user re-scans if needed, or we filter?
                // Let's clear for now to avoid complexity in this step
                setSessionList([]);
                setShowReview(false);
            } else {
                haptic.success();
                showAlert(`✅ Batch Dispatch Complete!\n\n${sessionList.length} items processed.`, 'success');
                setSessionList([]);
                setShowReview(false);
            }

        } catch (err) {
            haptic.error();
            showAlert(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const removeItemFromSession = (idx) => {
        const newList = [...sessionList];
        newList.splice(idx, 1);
        setSessionList(newList);
    };

    const confirmAddItem = () => {
        if (!previewItem) return;
        setSessionList(prev => [{
            barcode: previewItem.barcode,
            details: previewItem.details,
            scannedAt: new Date()
        }, ...prev]);

        setPreviewItem(null);
        setScanned(false);
        scanningRef.current = false;
        haptic.success();
    };

    const cancelAddItem = () => {
        setPreviewItem(null);
        setScanned(false);
        scanningRef.current = false;
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
        if (sessionList.length > 0) {
            if (!window.confirm("Switching modes will clear your current scanned list. Continue?")) return;
        }
        setSessionMode(newMode);
        setSessionList([]);
        reset();
    };

    useEffect(() => {
        const applyTorch = async () => {
            // Only attempt if camera is running and we are in SCAN mode
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning && mode === 'SCAN' && !scanned && !showReview) {
                try {
                    await html5QrCodeRef.current.applyVideoConstraints({
                        advanced: [{ torch: torch }]
                    });
                } catch (err) {
                    console.error("Torch Error:", err);
                    if (torch) {
                        // Only show alert if trying to turn ON
                        haptic.error();
                        showAlert("Flashlight unavailble on this device/browser", "warning");
                        // Timeout to avoid state loop
                        setTimeout(() => setTorch(false), 500);
                    }
                }
            }
        }

        // Small delay to ensure camera is ready
        const timer = setTimeout(applyTorch, 500);
        return () => clearTimeout(timer);
    }, [torch, mode, scanned, showReview]);

    const handleTorchClick = () => {
        setTorch(!torch);
    };

    const handleFinishSession = async () => {
        try {
            setIsProcessing(true);
            const res = await api.get(`/api/sessions/${sessionId}/preview`);
            if (res.data.success) {
                setFinishStats(res.data.stats);
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
            const res = await api.post('/api/sessions/end', { sessionId });
            if (res.data.success) {
                haptic.success();
                showAlert('Session Finished Successfully!', 'success');
                localStorage.removeItem('active_session_id');
                localStorage.removeItem('active_session_type');
                localStorage.removeItem('active_session_size');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showAlert(res.data.error, 'error');
            }
        } catch (err) {
            showAlert(err.message, 'error');
        } finally {
            setIsProcessing(false);
            setShowFinishPreview(false);
        }
    };

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

            {/* Header */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
                padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 100,
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '12px' }}>
                    <div style={{
                        padding: '6px 12px', borderRadius: '8px',
                        background: sessionMode === 'IN' ? THEME.success : THEME.error,
                        color: 'white', fontWeight: '800', fontSize: '11px', lineHeight: '1'
                    }}>
                        {sessionMode}
                    </div>
                    {sessionSize && (
                        <div style={{
                            padding: '6px 12px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white', fontWeight: '800', fontSize: '11px', lineHeight: '1'
                        }}>
                            S-{sessionSize}
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ color: 'white', fontWeight: '800', fontSize: '14px', letterSpacing: '0.5px', margin: 0 }}>
                        {sessionMode === 'IN' ? 'STOCK ENTRY' : 'DISPATCH'}
                    </h1>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        {(() => {
                            const e = JSON.parse(localStorage.getItem('employee') || '{}');
                            return e.name ? `${e.name} (${e.employeeId})` : 'Unknown';
                        })()}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleTorchClick}
                        style={iconBtnStyle}
                    >
                        {torch ? '💡' : '🔦'}
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

                            {/* Session Counter / Review Button */}
                            {sessionMode === 'OUT' && (
                                <button
                                    onClick={() => setShowReview(true)}
                                    style={{
                                        position: 'absolute', bottom: '25%', pointerEvents: 'auto',
                                        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255,255,255,0.2)', padding: '10px 24px', borderRadius: '30px',
                                        color: 'white', fontWeight: '800', display: 'flex', gap: '8px', alignItems: 'center'
                                    }}
                                >
                                    <span>🛒 LIST ({sessionList.length})</span>
                                    <span style={{ fontSize: '10px', background: 'white', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>REVIEW</span>
                                </button>
                            )}

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
                                onClick={async () => {
                                    try {
                                        // Remove scanner from session on backend
                                        const sessionIdToUse = sessionId || localStorage.getItem('active_session_id');
                                        if (sessionIdToUse) {
                                            const scannerIdToUse = scannerId || localStorage.getItem('SL_SCANNER_ID');
                                            await api.post(
                                                `/api/sessions/${sessionIdToUse}/leave`,
                                                { scannerId: scannerIdToUse },
                                                scannerIdToUse ? { headers: { 'x-scanner-id': scannerIdToUse } } : undefined
                                            );
                                        }
                                    } catch (err) {
                                        console.error('Failed to leave session:', err);
                                    }

                                    localStorage.removeItem('active_session_id');
                                    localStorage.removeItem('active_session_type');
                                    localStorage.removeItem('active_session_size');
                                    setSessionMode('IN');
                                    setSessionId(null);
                                    setSessionSize(null);
                                    setSessionList([]);
                                    reset();
                                    navigate('/sessions');
                                }}
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
                                            disabled={scanData?.data?.status === 'IN' || scanData?.status === 'NEW'}
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

            {/* PREVIEW MODAL (CONFIRM ADD TO LIST) */}
            {
                previewItem && (
                    <div style={modalBackdropStyle}>
                        <div style={{ ...alertBoxStyle, maxWidth: '400px', textAlign: 'left' }}>
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📦</div>
                                <h3 style={{ margin: 0, color: 'white' }}>Confirm Item</h3>
                                <p style={{ color: THEME.textMuted, fontSize: '0.9rem' }}>Check details before adding to list</p>
                            </div>

                            <div style={{ background: THEME.secondary, padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', border: `1px solid ${THEME.border}` }}>
                                <div style={{ fontSize: '0.8rem', color: THEME.textMuted, fontWeight: '700', letterSpacing: '1px', marginBottom: '4px' }}>BARCODE</div>
                                <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: '800', color: 'white', marginBottom: '1.5rem' }}>{previewItem.barcode}</div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: THEME.textMuted, fontWeight: '700' }}>METRE</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: THEME.success }}>{previewItem.details.metre} m</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: THEME.textMuted, fontWeight: '700' }}>WEIGHT</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: THEME.accent }}>{previewItem.details.weight} kg</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={confirmAddItem} style={{ ...btnPrimaryStyle, background: THEME.success, flex: 1 }}>PROCEED</button>
                                <button onClick={cancelAddItem} style={{ ...btnGhostStyle, flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* REVIEW MODAL (Bulk Out) */}
            {
                showReview && (
                    <div style={{ position: 'fixed', inset: 0, background: THEME.primary, zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Review List ({sessionList.length})</h2>
                            <button onClick={() => setShowReview(false)} style={{ background: 'transparent', border: 'none', color: THEME.textMuted, fontSize: '1.5rem' }}>✕</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                            {sessionList.length === 0 ? (
                                <div style={{ textAlign: 'center', color: THEME.textMuted, marginTop: '50px' }}>List is empty</div>
                            ) : (
                                displayList(sessionList, removeItemFromSession, THEME)
                            )}
                        </div>

                        <div style={{ padding: '20px', borderTop: `1px solid ${THEME.border}` }}>
                            <ActionButton
                                onClick={submitBatchOut}
                                label={`SUBMIT ALL (${sessionList.length})`}
                                icon="🚀"
                                color={THEME.error}
                                disabled={sessionList.length === 0 || isProcessing}
                            />
                        </div>
                    </div>
                )
            }



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

            {
                showIpInput && (
                    <div style={modalBackdropStyle}>
                        <div style={alertBoxStyle}>
                            <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>Server IP</h3>
                            <input value={serverIp} onChange={e => setServerIp(e.target.value)} style={inputStyle} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button onClick={() => setShowIpInput(false)} style={{ ...btnPrimaryStyle, flex: 1 }}>SAVE</button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};

// Helper for Review List
const displayList = (list, onRemove, THEME) => list.map((item, i) => (
    <div key={i} style={{
        background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(10px)',
        marginBottom: '12px', padding: '16px', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
        <div>
            <div style={{ fontWeight: '800', fontSize: '1.2rem', fontFamily: 'monospace', color: 'white', letterSpacing: '-0.5px' }}>{item.barcode}</div>
            <div style={{ fontSize: '0.85rem', color: THEME.textMuted, marginTop: '2px' }}>
                <span style={{ color: THEME.success, fontWeight: '700' }}>{item.details.metre}m</span>
                <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                <span style={{ color: THEME.accent, fontWeight: '700' }}>{item.details.weight}kg</span>
            </div>
        </div>
        <button
            onClick={() => onRemove(i)}
            style={{
                background: 'rgba(239, 68, 68, 0.1)', color: THEME.error, border: '1px solid rgba(239, 68, 68, 0.2)',
                width: '40px', height: '40px', borderRadius: '12px', fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >×</button>
    </div>
));

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

export default WorkScreen;
