import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'react-qr-code';

const Scanners = () => {
    const navigate = useNavigate();
    const { apiUrl } = useConfig();
    const [scanners, setScanners] = useState([]);
    const [setupToken, setSetupToken] = useState('FACTORY_SETUP_2026');
    const [showQr, setShowQr] = useState(false);
    const [serverIp, setServerIp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchScanners();
        const interval = setInterval(fetchScanners, 5000);
        return () => clearInterval(interval);
    }, [apiUrl]);

    useEffect(() => {
        if (showQr) fetchServerIp();
    }, [showQr]);

    const fetchServerIp = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/server-ip`);
            if (res.data.ip) setServerIp(res.data.ip);
        } catch (err) {
            console.error("Failed to fetch Server IP", err);
            setError("Could not resolve Server LAN IP");
        }
    };

    const fetchScanners = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${apiUrl}/api/admin/scanners`);
            setScanners(res.data || []);
        } catch (err) {
            console.error("Failed to fetch scanners:", err);
            setScanners([]);
        } finally {
            setLoading(false);
        }
    };

    const removeScannerDevice = async (scannerId) => {
        try {
            setDeleting(true);
            const res = await axios.delete(`${apiUrl}/api/admin/scanners/${scannerId}`);
            if (res.status === 200) {
                setScanners(scanners.filter(s => s.scannerId !== scannerId));
                setDeleteConfirm(null);
            }
        } catch (err) {
            setError(`Error: ${err.response?.data?.error || 'Failed to remove scanner'}`);
        } finally {
            setDeleting(false);
        }
    };

    const getPairingUrl = () => {
        if (!serverIp) return '';
        const lanUrl = `https://${serverIp}:5000`;
        return `${lanUrl}/pwa/index.html?token=${setupToken}&server=${encodeURIComponent(lanUrl)}`;
    };

    return (
        <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '40px 20px',
            fontFamily: "'Inter', sans-serif",
            height: '100%',
            overflowY: 'auto'
        }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px'
            }}>
                <div>
                    <h1 style={{
                        width: 'fit-content',
                        margin: '0 0 10px 0',
                        fontSize: '32px',
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-1px'
                    }}>
                        Connected Devices
                    </h1>
                    <p style={{
                        margin: 0,
                        color: '#64748b',
                        fontSize: '16px'
                    }}>
                        Monitor and manage active warehouse scanners
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            padding: '12px 24px',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            color: '#64748b',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                    >
                        ← Dashboard
                    </button>
                    <button
                        onClick={() => setShowQr(true)}
                        style={{
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        + Pair New Device
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '15px 20px',
                    background: '#fef2f2',
                    borderLeft: '4px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b',
                    marginBottom: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Empty State */}
            {scanners.length === 0 && !loading ? (
                <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    background: 'white',
                    borderRadius: '24px',
                    border: '1px dashed #cbd5e1',
                    marginBottom: '40px'
                }}>
                    <div style={{
                        width: '80px', height: '80px', background: '#f1f5f9',
                        borderRadius: '50%', margin: '0 auto 20px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '32px'
                    }}>
                        📱
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '20px' }}>No scanners connected</h3>
                    <p style={{ margin: '0', color: '#64748b' }}>
                        Click the <b>Pair New Device</b> button to get started.
                    </p>
                </div>
            ) : (
                /* Grid Layout */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '24px',
                    marginBottom: '40px'
                }}>
                    {scanners.map((scanner, index) => (
                        <div key={scanner.scannerId} style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '24px',
                            border: '1px solid #f1f5f9',
                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.05)',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'transform 0.2s',
                            animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`
                        }}>
                            {/* Status Badge */}
                            <div style={{
                                position: 'absolute', top: '24px', right: '24px',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '20px',
                                background: '#ecfdf5', color: '#059669',
                                fontWeight: '600', fontSize: '12px'
                            }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                Active
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    width: '48px', height: '48px',
                                    background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                    borderRadius: '14px', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '16px', color: '#4f46e5', fontSize: '24px'
                                }}>
                                    📱
                                </div>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                                    {scanner.name || `Scanner ${scanner.scannerId.substring(0, 6)}`}
                                </h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                                    ID: {scanner.scannerId.substring(0, 18)}...
                                </p>
                            </div>

                            <div style={{
                                borderTop: '1px solid #f1f5f9', paddingTop: '20px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    Seen: {new Date(scanner.lastSeen || Date.now()).toLocaleTimeString()}
                                </div>

                                {deleteConfirm === scanner.scannerId ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => removeScannerDevice(scanner.scannerId)}
                                            style={{
                                                padding: '6px 12px', border: 'none', borderRadius: '8px',
                                                background: '#ef4444', color: 'white', fontWeight: '600',
                                                fontSize: '12px', cursor: 'pointer'
                                            }}
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            style={{
                                                padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                                                background: 'white', color: '#64748b', fontWeight: '600',
                                                fontSize: '12px', cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(scanner.scannerId)}
                                        style={{
                                            padding: '8px', border: 'none', borderRadius: '8px',
                                            background: '#fff1f2', color: '#fb7185',
                                            fontSize: '14px', cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Unpair Device"
                                        onMouseOver={e => e.currentTarget.style.background = '#ffe4e6'}
                                        onMouseOut={e => e.currentTarget.style.background = '#fff1f2'}
                                    >
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* QR Code Modal - Glassmorphism */}
            {showQr && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '40px',
                        width: '100%',
                        maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        textAlign: 'center',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setShowQr(false)}
                            style={{
                                position: 'absolute', top: '24px', right: '24px',
                                background: 'none', border: 'none', fontSize: '24px',
                                color: '#94a3b8', cursor: 'pointer'
                            }}
                        >
                            ✕
                        </button>

                        <div style={{
                            width: '64px', height: '64px', background: '#e0e7ff',
                            borderRadius: '20px', margin: '0 auto 20px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#4f46e5'
                        }}>
                            🔗
                        </div>

                        <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>
                            Pair Mobile Scanner
                        </h2>
                        <p style={{ margin: '0 0 30px 0', color: '#64748b', fontSize: '15px', lineHeight: '1.5' }}>
                            Open the scanning app on your mobile device and point the camera at this code.
                        </p>

                        {!serverIp ? (
                            <div style={{ padding: '40px' }}>
                                <div style={{
                                    width: '30px', height: '30px', border: '3px solid #e2e8f0',
                                    borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    background: 'white', padding: '20px', borderRadius: '16px',
                                    border: '1px solid #e2e8f0', display: 'inline-block',
                                    marginBottom: '30px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
                                }}>
                                    <QRCode value={getPairingUrl()} size={220} level="M" />
                                </div>

                                <div style={{
                                    padding: '16px', background: '#f8fafc', borderRadius: '12px',
                                    marginBottom: '20px', textAlign: 'left'
                                }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Troubleshooting
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                                        <span>📶</span>
                                        <span>Ensure device is on the <strong>same Wi-Fi</strong></span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#64748b' }}>
                                        <span>🌐</span>
                                        <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{getPairingUrl()}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default Scanners;
