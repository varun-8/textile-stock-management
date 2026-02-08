import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'react-qr-code';

const Scanners = () => {
    const navigate = useNavigate();
    const { apiUrl } = useConfig();
    const [scanners, setScanners] = useState([]);
    const [setupToken] = useState('FACTORY_SETUP_2026');
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
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>

                {/* Header Block */}
                <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>CONNECTED DEVICES</div>
                        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Scanner Fleet</h1>
                        <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Monitor and manage your active warehouse scanners.</p>
                    </div>

                    <button
                        onClick={() => setShowQr(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.8rem 1.5rem' }}
                    >
                        <span>+</span> Pair New Device
                    </button>
                </div>

                {error && (
                    <div style={{ background: 'var(--error-bg)', color: 'var(--error-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠</span> {error}
                    </div>
                )}

                {/* Empty State */}
                {scanners.length === 0 && !loading && (
                    <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem', borderStyle: 'dashed', background: 'transparent' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>📱</div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>No scanners connected</h3>
                        <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>
                            Your fleet is currently empty. Click <b style={{ color: 'var(--accent-color)' }}>Pair New Device</b> to get started.
                        </p>
                    </div>
                )}

                {/* Scanners Grid */}
                {scanners.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {scanners.map((scanner) => {
                            const isOnline = scanner.status === 'ONLINE';
                            const statusColor = isOnline ? 'var(--success-color)' : 'var(--text-secondary)';
                            const statusBg = isOnline ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)';

                            return (
                                <div key={scanner.scannerId} className="panel glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${statusColor}` }}>

                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '12px',
                                            background: statusBg,
                                            color: statusColor,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
                                        }}>
                                            {isOnline ? '📱' : '🔌'}
                                        </div>
                                        {/* Status Pill */}
                                        <div style={{
                                            padding: '4px 10px', borderRadius: '100px',
                                            border: `1px solid ${statusColor}`,
                                            background: statusBg,
                                            color: statusColor, fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase'
                                        }}>
                                            {isOnline ? 'Online' : 'Offline'}
                                        </div>
                                    </div>

                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '700' }}>
                                        {scanner.name || `Scanner ${scanner.scannerId.substring(0, 4)}`}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5, fontFamily: 'monospace' }}>
                                        ID: {scanner.scannerId.substring(0, 12)}...
                                    </p>

                                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={labelStyle}>LAST SEEN</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                                {scanner.lastSeen ? new Date(scanner.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                            </div>
                                        </div>

                                        {deleteConfirm === scanner.scannerId ? (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => removeScannerDevice(scanner.scannerId)} className="btn" style={{ background: 'var(--error-color)', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Delete</button>
                                                <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setDeleteConfirm(scanner.scannerId)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.5, fontSize: '1.1rem' }}
                                                onMouseOver={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--error-color)'; }}
                                                onMouseOut={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                            >
                                                🗑
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* QR Backdrop */}
            {showQr && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '3rem', position: 'relative', textAlign: 'center' }}>

                        <button
                            onClick={() => setShowQr(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                        >✕</button>

                        <div style={{ margin: '0 auto 1.5rem', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                            🔗
                        </div>

                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Pair Mobile Scanner</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '2rem' }}>Scan this code with the WH Flow mobile app to connect.</p>

                        {!serverIp ? (
                            <div style={{ padding: '2rem' }}>
                                <div style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                                <p style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>Resolving Server IP...</p>
                                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            </div>
                        ) : (
                            <>
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', marginBottom: '2rem' }}>
                                    <QRCode value={getPairingUrl()} size={200} />
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    Server: {serverIp}:5000
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const labelStyle = { fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' };

export default Scanners;
