import React, { useState, useEffect, useRef } from 'react';
import { useMobile } from '../context/MobileContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { haptic } from '../utils/haptic';
import MissingScans from '../components/MissingScans';

const WorkScreen = () => {
    const { api, serverIp, setServerIp, unpair, deferredPrompt, installApp } = useMobile();
    const [scanned, setScanned] = useState(false);
    const [showIpInput, setShowIpInput] = useState(false);
    const [showMissing, setShowMissing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showInstallHelp, setShowInstallHelp] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualBarcode, setManualBarcode] = useState('');
    const [torch, setTorch] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    const [lastAction, setLastAction] = useState(null);
    const [currentBarcode, setCurrentBarcode] = useState(null);
    const [mode, setMode] = useState('SCAN');
    const [scanData, setScanData] = useState(null);
    const [form, setForm] = useState({ metre: '', weight: '', percentage: '100' });

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
        if (mode === 'SCAN' && !scanned && !showMissing && !showIpInput && !showMenu) {
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
    }, [mode, scanned, showMissing, showIpInput, showMenu]);

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

        try {
            const url = `/api/mobile/scan/${formattedBarcode}`;
            const res = await api.get(url);
            const json = res.data;

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

    const executeSubmit = async (type) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const payload = {
            barcode: scanData.barcode,
            type,
            metre: parseFloat(form.metre || 0),
            weight: parseFloat(form.weight || 0),
            percentage: parseFloat(form.percentage || 100)
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

    const reset = () => {
        scanningRef.current = false;
        setScanned(false);
        setScanData(null);
        setMode('SCAN');
        setForm({ metre: '', weight: '', percentage: '100' });
        setCurrentBarcode(null);
    };

    useEffect(() => {
        const applyTorch = async () => {
            if (html5QrCodeRef.current && mode === 'SCAN' && !scanned) {
                try {
                    await html5QrCodeRef.current.applyVideoConstraints({
                        advanced: [{ torch: torch }]
                    });
                } catch (err) {
                }
            }
        };
        setTimeout(applyTorch, 500);
    }, [torch, mode, scanned]);

    return (
        <div style={{ height: '100dvh', width: '100vw', backgroundColor: 'black', display: 'flex', flexDirection: 'column', position: 'fixed', overflow: 'hidden' }}>

            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '60px',
                padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 100
            }}>
                <h1 style={{ color: 'white', fontWeight: '800', fontSize: '18px', letterSpacing: '-0.5px' }}>
                    WH FLOW
                </h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setTorch(!torch)} style={iconBtnStyle}>{torch ? '💡' : '🔦'}</button>
                    <button onClick={() => setShowMenu(true)} style={iconBtnStyle}>☰</button>
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
                                width: '280px', height: '200px',
                                border: '2px solid rgba(255,255,255,0.3)', borderRadius: '20px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                                position: 'relative', overflow: 'hidden'
                            }}>
                                <div className="laser-line" style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                    background: '#ef4444', boxShadow: '0 0 10px #ef4444',
                                    animation: 'scan 2s infinite ease-in-out'
                                }}></div>
                                <style>{`@keyframes scan { 0% { top: 10%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 90%; opacity: 0; } }`}</style>
                            </div>
                            <p style={{ position: 'absolute', bottom: '25%', color: 'white', fontWeight: '600', letterSpacing: '1px', fontSize: '12px' }}>
                                SCAN BARCODE
                            </p>

                            <button
                                onClick={() => setShowManualInput(true)}
                                style={{
                                    position: 'absolute', bottom: '15%',
                                    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255,255,255,0.1)', color: 'white',
                                    padding: '12px 24px', borderRadius: '30px', fontWeight: '600', pointerEvents: 'auto'
                                }}>
                                ⌨️ Manual Input
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0, background: THEME.primary,
                        display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out'
                    }}>
                        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

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

                                    <ActionButton
                                        onClick={() => setMode('IN_FORM')}
                                        disabled={scanData?.status === 'EXISTING'}
                                        label="IN STOCK"
                                        sub={scanData?.status === 'EXISTING' ? "(Already In)" : null}
                                        icon="📥"
                                        color={THEME.success}
                                    />
                                    <ActionButton
                                        onClick={() => setMode('OUT_FORM')}
                                        disabled={scanData?.status === 'NEW' || scanData?.data?.status === 'OUT'}
                                        label="OUT STOCK"
                                        sub={scanData?.data?.status === 'OUT' ? "(Already Out)" : null}
                                        icon="📤"
                                        color={THEME.error}
                                    />
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
                                    <InputGroup label="QUALITY %" value={form.percentage} onChange={v => setForm({ ...form, percentage: v })} />

                                    <ActionButton
                                        onClick={() => executeSubmit(mode === 'IN_FORM' ? 'IN' : 'OUT')}
                                        label="CONFIRM"
                                        icon="✅"
                                        color={mode === 'IN_FORM' ? THEME.success : THEME.error}
                                    />
                                    <ActionButton onClick={() => setMode('ACTION')} label="BACK" variant="ghost" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showMenu && (
                <div style={modalBackdropStyle} onClick={() => setShowMenu(false)}>
                    <div style={menuStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: `1px solid ${THEME.border}` }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Menu</h2>
                        </div>
                        <MenuItem
                            icon="⬇️"
                            label="Install App / APK"
                            onClick={() => {
                                if (deferredPrompt) {
                                    installApp();
                                } else {
                                    setShowMenu(false);
                                    setShowInstallHelp(true);
                                }
                            }}
                            sub={!deferredPrompt ? "(Manual Install)" : ""}
                        />
                        <MenuItem icon="⚙️" label="Server IP" onClick={() => setShowIpInput(true)} />
                        <MenuItem icon="📋" label="Missing Scans" onClick={() => { setShowMissing(true); setShowMenu(false); }} />
                        <MenuItem icon="🔓" label="Unpair" color={THEME.error} onClick={() => unpair()} />
                        <div style={{ padding: '20px' }}>
                            <button onClick={() => setShowMenu(false)} style={btnPrimaryStyle}>CLOSE</button>
                        </div>
                    </div>
                </div>
            )}

            {showInstallHelp && (
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
            )}

            {alertState.show && (
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
            )}

            {showMissing && (
                <div style={{ position: 'fixed', inset: 0, background: THEME.primary, zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}><MissingScans serverIp={serverIp} /></div>
                    <button onClick={() => setShowMissing(false)} style={{ padding: '20px', background: THEME.secondary, border: 'none', color: 'white', fontWeight: 'bold' }}>CLOSE</button>
                </div>
            )}

            {showManualInput && (
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
            )}

            {showIpInput && (
                <div style={modalBackdropStyle}>
                    <div style={alertBoxStyle}>
                        <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>Server IP</h3>
                        <input value={serverIp} onChange={e => setServerIp(e.target.value)} style={inputStyle} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button onClick={() => setShowIpInput(false)} style={{ ...btnPrimaryStyle, flex: 1 }}>SAVE</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
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

const InputGroup = ({ label, value, onChange }) => (
    <div>
        <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', fontWeight: '700', marginBottom: '6px', letterSpacing: '1px' }}>{label}</label>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
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

const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const alertBoxStyle = { background: '#1e293b', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '340px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' };
const menuStyle = { background: '#0f172a', width: '100%', maxWidth: '360px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #334155' };
const iconBtnStyle = { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputStyle = { width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '16px', borderRadius: '12px', fontSize: '18px', outline: 'none', boxSizing: 'border-box' };
const btnPrimaryStyle = { width: '100%', padding: '16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '16px' };
const btnGhostStyle = { width: '100%', padding: '16px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '12px', fontWeight: '700', fontSize: '16px' };

export default WorkScreen;
