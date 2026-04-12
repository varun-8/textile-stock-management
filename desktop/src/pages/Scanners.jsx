import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { io } from 'socket.io-client';
import { useConfig } from '../context/ConfigContext';
import { IconBroadcast, IconTrash, IconScan, IconX } from '../components/Icons';
import { useNotification } from '../context/NotificationContext';

const Scanners = () => {
    const { apiUrl } = useConfig();
    const [scanners, setScanners] = useState([]);
    const [setupToken, setSetupToken] = useState('');
    const [qrTarget, setQrTarget] = useState(null); // null, 'NEW', or scanner object
    const [serverIp, setServerIp] = useState('');
    const [serverHttpPort, setServerHttpPort] = useState(5000);
    const [serverHttpsPort, setServerHttpsPort] = useState(5001);
    const [loading, setLoading] = useState(false);
    const [deletedScannerIds, setDeletedScannerIds] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [showInstallQr, setShowInstallQr] = useState(false);
    const [checkingInstallApk, setCheckingInstallApk] = useState(false);
    const [installApkStatus, setInstallApkStatus] = useState('unknown'); // unknown | ready | missing
    const { showNotification } = useNotification();

    const authHeaders = () => {
        const token = localStorage.getItem('ADMIN_TOKEN');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchServerIp = useCallback(async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/server-ip`, { headers: authHeaders() });
            if (res.data.ip) setServerIp(res.data.ip);
            if (res.data.httpPort) setServerHttpPort(Number(res.data.httpPort) || 5000);
            if (res.data.httpsPort) setServerHttpsPort(Number(res.data.httpsPort) || 5001);
        } catch (err) {
            console.error("Failed to fetch Server IP", err);
            showNotification("Could not resolve Server LAN IP", 'error');
        }
    }, [apiUrl, showNotification]);

    const fetchPairingToken = useCallback(async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/pairing-token`, { headers: authHeaders() });
            if (res.data.token) setSetupToken(res.data.token);
        } catch (err) {
            console.error("Failed to fetch pairing token", err);
            showNotification("Could not generate pairing token", 'error');
        }
    }, [apiUrl, showNotification]);

    const fetchScanners = useCallback(async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/scanners`, { headers: authHeaders() });
            setScanners(res.data || []);
        } catch (err) {
            console.error("Failed to fetch scanners:", err);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        setLoading(true);
        fetchScanners();
        // Poll more frequently for real-time scanner status updates
        const interval = setInterval(fetchScanners, 10000); // Poll every 10 seconds for live status
        return () => clearInterval(interval);
    }, [fetchScanners]);

    // Socket.IO real-time updates with better connection handling
    useEffect(() => {
        const socketOptions = import.meta.env.DEV
            ? { transports: ['websocket'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 }
            : { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 };

        const socket = io(apiUrl, socketOptions);

        socket.on('connect', () => {
            console.log('✓ Scanner page Socket.IO connected');
        });

        socket.on('disconnect', () => {
            console.warn('✗ Scanner page Socket.IO disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
        });

        socket.on('scanner_updated', () => {
            console.log('📡 Scanner updated event received');
            fetchScanners();
        });

        socket.on('scanner_deleted', (data) => {
            console.log('📡 Scanner deleted event received:', data);
            // Remove from deleted cache if we're tracking it
            setDeletedScannerIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(data?.scannerId);
                return newSet;
            });
            // Refetch to ensure consistency
            fetchScanners();
        });

        socket.on('scanner_registered', () => {
            console.log('📡 Scanner registered event received');
            fetchScanners();
        });

        return () => {
            socket.disconnect();
        };
    }, [apiUrl, fetchScanners]);

    // Fetch IP when QR modal opens
    useEffect(() => {
        if (qrTarget && !serverIp) fetchServerIp();
    }, [qrTarget, serverIp, fetchServerIp]);

    useEffect(() => {
        if (showInstallQr && !serverIp) fetchServerIp();
    }, [showInstallQr, serverIp, fetchServerIp]);

    useEffect(() => {
        if (qrTarget === 'NEW') {
            fetchPairingToken();
        }
        if (!qrTarget) {
            setSetupToken('');
        }
    }, [qrTarget, fetchPairingToken]);

    useEffect(() => {
        if (qrTarget !== 'NEW') return undefined;

        const interval = setInterval(() => {
            fetchPairingToken();
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, [qrTarget, fetchPairingToken]);

    // When QR modal closes (after pairing), immediately refetch scanners
    useEffect(() => {
        if (!qrTarget) {
            // Delay slightly to ensure backend has processed pairing
            const timer = setTimeout(() => {
                fetchScanners();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [qrTarget, fetchScanners]);

    const removeScannerDevice = async (scannerId) => {
        try {
            // Mark as deleted immediately in UI
            setDeletedScannerIds(prev => new Set([...prev, scannerId]));
            setScanners(prev => prev.filter(s => s.scannerId !== scannerId));
            setDeleteConfirm(null);
            showNotification('Scanner removed successfully', 'success');
            
            // Send delete request to backend
            const res = await axios.delete(`${apiUrl}/api/admin/scanners/${scannerId}`, { headers: authHeaders() });
            if (res.status === 200) {
                // Success - keep it removed
                setDeletedScannerIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(scannerId);
                    return newSet;
                });
            } else {
                // Failure - restore it and refetch
                showNotification('Failed to delete scanner', 'error');
                setDeletedScannerIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(scannerId);
                    return newSet;
                });
                fetchScanners();
            }
        } catch (err) {
            showNotification(`${err.response?.data?.error || 'Failed to remove scanner'}`, 'error');
            // Restore on error and refetch
            setDeletedScannerIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(scannerId);
                return newSet;
            });
            fetchScanners();
        }
    };

    const getPairingUrl = () => {
        if (!serverIp) return '';
        if (qrTarget === 'NEW' && !setupToken) return '';
        // Open pairing page on HTTPS (PWA/browser-safe), but pass HTTP server target for native app pairing.
        const pairingUrl = `https://${serverIp}:${serverHttpsPort}`;
        const serverForClient = `http://${serverIp}:${serverHttpPort}`;

        const tokenToUse = (qrTarget && typeof qrTarget === 'object') ? qrTarget.fingerprint : setupToken;
        const urlParams = `server=${encodeURIComponent(serverForClient)}`;

        return `${pairingUrl}/pair?token=${tokenToUse}&${urlParams}&action=PAIR`;
    };

    const getInstallUrl = () => {
        if (!serverIp) return '';
        // PWA and APK download should use HTTPS (Port 5001) because browsers require 
        // a secure context for Camera and Service Workers to function.
        return `https://${serverIp}:${serverHttpsPort}/pwa/LoomTrack.apk`;
    };

    const verifyInstallApk = async () => {
        setCheckingInstallApk(true);
        setInstallApkStatus('unknown');
        try {
            const statusRes = await axios.get(`${apiUrl}/api/admin/apk-status`, { headers: authHeaders() });
            const exists = Boolean(statusRes.data?.exists);
            if (exists) {
                setInstallApkStatus('ready');
                return;
            }

            // Fallback for dev/runtime path mismatches: check local filesystem via Electron.
            const localCandidates = Array.isArray(statusRes.data?.checkedPaths)
                ? statusRes.data.checkedPaths
                : [];

            let localFound = false;
            if (window.electronAPI?.fileExists && localCandidates.length > 0) {
                for (const p of localCandidates) {
                    const ok = await window.electronAPI.fileExists(p);
                    if (ok) {
                        localFound = true;
                        break;
                    }
                }
            }

            if (localFound) {
                setInstallApkStatus('ready');
                return;
            }

            setInstallApkStatus('missing');
            const checkedHint = localCandidates.length > 0
                ? ` Checked: ${localCandidates.join(' | ')}`
                : '';
            showNotification(`APK not found on server. Run mobile-web apk publish flow first.${checkedHint}`, 'warning');
        } catch (err) {
            console.error('Failed to verify APK availability', err);
            setInstallApkStatus('unknown');
        } finally {
            setCheckingInstallApk(false);
        }
    };

    useEffect(() => {
        if (showInstallQr && serverIp) {
            verifyInstallApk();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showInstallQr, serverIp]);

    return (
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-fade-in">
            {/* Header */}
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconBroadcast />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>DEVICE MANAGEMENT</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            Scanner Fleet
                        </h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => {
                            setShowInstallQr(true);
                        }}
                        className="btn"
                        style={{
                            padding: '0.8rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-tertiary)'
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>📲</span> <span>Install App</span>
                    </button>

                    <button
                        onClick={() => setQrTarget('NEW')}
                        className="btn btn-primary"
                        style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <IconScan /> <span>Pair Device</span>
                    </button>
                </div>
            </header>

            <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

                {/* Header removed error display as it's now handled by showNotification */}

                {/* Empty State */}
                {scanners.length === 0 && !loading ? (
                    <div style={{
                        height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        border: '2px dashed var(--border-color)', borderRadius: '16px', color: 'var(--text-secondary)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>📱</div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>No scanners connected</h3>
                        <p style={{ margin: 0, opacity: 0.6, maxWidth: '400px', textAlign: 'center' }}>
                            Your fleet is currently empty. Click the <b>Pair New Device</b> button above to connect a mobile scanner.
                        </p>
                    </div>
                ) : (
                    /* Grid */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                        {scanners.filter(s => !deletedScannerIds.has(s.scannerId)).map((scanner) => {
                            const lastSeenTime = scanner.lastSeen ? new Date(scanner.lastSeen).getTime() : 0;
                            // Scanner is online if seen in last 30 seconds (accounts for 10s polling + buffer)
                            const isActiveRecently = (Date.now() - lastSeenTime) < 30 * 1000;
                            const statusDisplay = isActiveRecently ? 'Online' : 'Offline';
                            const statusColor = isActiveRecently ? 'var(--success-color)' : 'var(--text-secondary)';
                            const statusBg = isActiveRecently ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)';

                            return (
                                <div key={scanner.scannerId} className="panel" style={{
                                    padding: '0', position: 'relative', overflow: 'hidden',
                                    border: '1px solid var(--border-color)', borderRadius: '16px',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex', flexDirection: 'column'
                                }}>
                                    {/* Card Header with Status */}
                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '12px',
                                                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
                                            }}>
                                                📱
                                            </div>
                                            <div>
                                                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                    {scanner.name || 'Unnamed Scanner'}
                                                </h3>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px', opacity: 0.8 }}>
                                                    UID: {scanner.scannerId.substring(0, 8)}...
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '4px 10px', borderRadius: '20px',
                                            background: statusBg, color: statusColor,
                                            fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></span>
                                            {statusDisplay}
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div style={{ padding: '1.5rem', flex: 1 }}>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>CURRENT USER</div>
                                            {scanner.currentEmployee && scanner.currentEmployee.name ? (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    background: 'rgba(99, 102, 241, 0.05)', padding: '10px 14px', borderRadius: '8px',
                                                    border: '1px solid rgba(99, 102, 241, 0.1)'
                                                }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                                                        {scanner.currentEmployee.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{scanner.currentEmployee.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {scanner.currentEmployee.employeeId}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '10px 0' }}>No active user</div>
                                            )}
                                        </div>

                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>LAST SEEN</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                                                {scanner.lastSeen ? new Date(scanner.lastSeen).toLocaleString() : 'Never'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        {deleteConfirm === scanner.scannerId ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                                <button
                                                    onClick={() => removeScannerDevice(scanner.scannerId)}
                                                    style={{ background: 'var(--error-bg)', color: 'var(--error-color)', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', flex: 1 }}
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setQrTarget(scanner)}
                                                    className="btn"
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', padding: '0', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <IconScan size={16} /> Re-Pair Device
                                                </button>

                                                <button
                                                    onClick={() => setDeleteConfirm(scanner.scannerId)}
                                                    className="btn-icon-danger"
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', cursor: 'pointer', opacity: 0.6, transition: 'opacity 0.2s' }}
                                                    title="Remove Device"
                                                    onMouseEnter={e => e.target.style.opacity = 1}
                                                    onMouseLeave={e => e.target.style.opacity = 0.6}
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* QR Backdrop Modal */}
            {qrTarget && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }} className="animate-fade-in">
                    <div style={{
                        width: '100%', maxWidth: '420px', background: 'var(--bg-secondary)',
                        borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--border-color)', overflow: 'hidden',
                        position: 'relative', display: 'flex', flexDirection: 'column',
                        maxHeight: '90vh' // Ensure it fits on screen
                    }}>
                        {/* Close Button (X) */}
                        <button
                            onClick={() => setQrTarget(null)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: '5px', zIndex: 10
                            }}
                        >
                            <IconX />
                        </button>

                        <div style={{ padding: '2.5rem 2rem 2rem', textAlign: 'center', overflowY: 'auto' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '20px',
                                background: 'var(--accent-bg)', color: 'var(--accent-color)',
                                margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <IconBroadcast />
                            </div>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                                {qrTarget === 'NEW' ? 'Pair New Device' : `Repair ${qrTarget.name}`}
                            </h2>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 2rem' }}>
                                {qrTarget === 'NEW'
                                    ? 'Scan this QR with any mobile device to connect it instantly.'
                                    : `Use this QR to reconnect "${qrTarget.name}" if it lost connection or was logged out.`}
                            </p>

                            {!serverIp || (qrTarget === 'NEW' && !setupToken) ? (
                                <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%' }}></div>
                                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>Generating Secure Link...</p>
                                </div>
                            ) : (
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                    <QRCode value={getPairingUrl()} size={200} />
                                </div>
                            )}




                        </div>
                    </div>
                </div>
            )}

            {showInstallQr && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }} className="animate-fade-in">
                    <div style={{
                        width: '100%', maxWidth: '440px', background: 'var(--bg-secondary)',
                        borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--border-color)', overflow: 'hidden',
                        position: 'relative', display: 'flex', flexDirection: 'column'
                    }}>
                        <button
                            onClick={() => setShowInstallQr(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: '5px', zIndex: 10
                            }}
                        >
                            <IconX />
                        </button>

                        <div style={{ padding: '2.5rem 2rem 2rem', textAlign: 'center' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '20px',
                                background: 'var(--accent-bg)', color: 'var(--accent-color)',
                                margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem'
                            }}>
                                📲
                            </div>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                                Install Mobile App
                            </h2>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
                                Scan this QR from your phone browser to download and install the native APK.
                            </p>

                            <div style={{
                                margin: '0 0 1rem',
                                fontSize: '0.8rem',
                                color:
                                    installApkStatus === 'ready'
                                        ? 'var(--success-color)'
                                        : installApkStatus === 'missing'
                                            ? 'var(--warning-color)'
                                            : 'var(--text-secondary)'
                            }}>
                                {checkingInstallApk
                                    ? 'Checking APK availability...'
                                    : installApkStatus === 'ready'
                                        ? 'APK is ready to install'
                                        : installApkStatus === 'missing'
                                            ? 'APK not found on server yet'
                                            : 'Could not verify from desktop, but QR may still work'}
                            </div>

                            {!serverIp || checkingInstallApk ? (
                                <div style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%' }}></div>
                                </div>
                            ) : installApkStatus === 'missing' ? (
                                <div style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    background: 'var(--warning-bg)',
                                    color: 'var(--warning-color)',
                                    border: '1px solid var(--warning-color)',
                                    fontSize: '0.86rem'
                                }}>
                                    APK is not available on server yet. Publish APK to continue native setup.
                                </div>
                            ) : (
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                    <QRCode value={getInstallUrl()} size={200} />
                                </div>
                            )}

                            <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Publish APK to server path: /pwa/LoomTrack.apk
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .btn-icon-danger:hover { background: var(--error-bg) !important; color: var(--error-color) !important; }
            `}</style>
        </div>
    );
};

export default Scanners;
