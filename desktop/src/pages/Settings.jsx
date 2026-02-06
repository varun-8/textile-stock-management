import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings, IconCloud, IconScan } from '../components/Icons';

const Settings = () => {
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();
    const [activeTab, setActiveTab] = useState('general');
    const [backupPath, setBackupPath] = useState('');
    const [backups, setBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [backupMsg, setBackupMsg] = useState('');

    // System Info State
    const [serverIp, setServerIp] = useState('Loading...');
    const [scanners, setScanners] = useState([]);

    useEffect(() => {
        fetchConfig();
        fetchBackups();
        fetchSystemInfo();
    }, [apiUrl]);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/admin/config/backup-path`);
            const data = await res.json();
            if (data.path) setBackupPath(data.path);
        } catch (err) { console.error(err); }
    };

    const fetchBackups = async () => {
        setLoadingBackups(true);
        try {
            const res = await fetch(`${apiUrl}/api/admin/backups`);
            const data = await res.json();
            setBackups(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); }
        finally { setLoadingBackups(false); }
    };

    const fetchSystemInfo = async () => {
        try {
            // Fetch IP
            const resIp = await fetch(`${apiUrl}/api/admin/server-ip`);
            const dataIp = await resIp.json();
            setServerIp(dataIp.ip);

            // Fetch Scanners for count
            const resScan = await fetch(`${apiUrl}/api/admin/scanners`);
            const dataScan = await resScan.json();
            setScanners(dataScan);
        } catch (err) { console.error(err); }
    };

    const handleSavePath = async () => {
        try {
            await fetch(`${apiUrl}/api/admin/config/backup-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: backupPath })
            });
            alert('Backup path updated successfully');
        } catch (err) { alert('Failed to update path'); }
    };

    const handleCreateBackup = async () => {
        setBackupMsg('Creating backup...');
        try {
            const res = await fetch(`${apiUrl}/api/admin/backup`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setBackupMsg(`Backup created: ${data.filename}`);
                fetchBackups();
            } else {
                setBackupMsg(`Error: ${data.error}`);
            }
        } catch (err) { setBackupMsg('Failed to create backup'); }
    };

    const handleImportBackup = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm('WARNING: Restoring a backup will OVERWRITE all current data. This action cannot be undone. Continue?')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = JSON.parse(e.target.result);
                setBackupMsg('Restoring data...');

                const res = await fetch(`${apiUrl}/api/admin/restore`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileContent: content })
                });

                const data = await res.json();
                if (res.ok) {
                    alert('System restored successfully. The page will reload.');
                    window.location.reload();
                } else {
                    alert(`Restore failed: ${data.error}`);
                    setBackupMsg('');
                }
            } catch (err) {
                alert('Invalid backup file format');
                setBackupMsg('');
            }
        };
        reader.readAsText(file);
    };

    const handleRestore = async (filename) => {
        if (!window.confirm(`Restore from ${filename}? Current data will be replaced.`)) return;

        try {
            const res = await fetch(`${apiUrl}/api/admin/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            if (res.ok) {
                alert('Restore complete. Reloading...');
                window.location.reload();
            } else {
                alert('Restore failed');
            }
        } catch (err) { alert('Restore failed'); }
    };

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconSettings />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>ADMINISTRATION</div>
                        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>System Settings</h1>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setActiveTab('general')}
                        style={{
                            padding: '1rem 0.5rem', background: 'none', border: 'none',
                            borderBottom: activeTab === 'general' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'general' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                        }}
                    >
                        General & Interface
                    </button>
                    <button
                        onClick={() => setActiveTab('backup')}
                        style={{
                            padding: '1rem 0.5rem', background: 'none', border: 'none',
                            borderBottom: activeTab === 'backup' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'backup' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                        }}
                    >
                        Backup & Recovery
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        style={{
                            padding: '1rem 0.5rem', background: 'none', border: 'none',
                            borderBottom: activeTab === 'system' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'system' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                        }}
                    >
                        System Information
                    </button>
                </div>

                {/* Content */}
                <div className="panel" style={{ padding: '2.5rem', background: 'var(--bg-secondary)' }}>

                    {/* --- GENERAL TAB --- */}
                    {activeTab === 'general' && (
                        <div className="animate-fade-in">
                            <h3 style={{ marginBottom: '1.5rem' }}>Interface Preferences</h3>

                            <div style={{ marginBottom: '2.5rem', maxWidth: '500px' }}>
                                <label style={labelStyle}>Theme Mode</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={() => theme !== 'light' && toggleTheme()}
                                        style={{
                                            flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid',
                                            borderColor: theme === 'light' ? 'var(--accent-color)' : 'var(--border-color)',
                                            background: theme === 'light' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ☀️ Light Mode
                                    </button>
                                    <button
                                        onClick={() => theme !== 'dark' && toggleTheme()}
                                        style={{
                                            flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid',
                                            borderColor: theme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)',
                                            background: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                            cursor: 'pointer', color: 'var(--text-primary)'
                                        }}
                                    >
                                        🌙 Dark Mode
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2.5rem', maxWidth: '500px' }}>
                                <label style={labelStyle}>Server Endpoint Configuration</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={apiUrl}
                                        readOnly
                                        style={{
                                            flex: 1, padding: '0.8rem', borderRadius: '8px',
                                            border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                            color: 'var(--text-secondary)', fontFamily: 'monospace'
                                        }}
                                    />
                                    <button
                                        onClick={() => { const url = prompt("Enter new API URL:", apiUrl); if (url) updateApiUrl(url); }}
                                        className="btn btn-secondary"
                                    >
                                        Edit
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                                    Current connection endpoint for scanner data synchronization.
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST' });
                                    } catch (e) { console.error(e); }
                                    localStorage.clear();
                                    window.location.href = '/';
                                }}
                                style={{ color: 'var(--error-color)', background: 'none', border: '1px solid var(--error-color)', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Terminate Session & Logout
                            </button>
                        </div>
                    )}

                    {/* --- BACKUP TAB --- */}
                    {activeTab === 'backup' && (
                        <div className="animate-fade-in">
                            <h3 style={{ marginBottom: '1.5rem' }}>Backup Configuration</h3>

                            <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                                <label style={labelStyle}>Server Backup Directory</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <input
                                        type="text"
                                        value={backupPath}
                                        onChange={e => setBackupPath(e.target.value)}
                                        placeholder="./backups"
                                        style={{
                                            flex: 1, padding: '0.8rem', borderRadius: '8px',
                                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)', fontFamily: 'monospace'
                                        }}
                                    />
                                    <button onClick={handleSavePath} className="btn btn-primary" style={{ padding: '0 1.5rem' }}>Save Path</button>
                                </div>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                                    Absolute path on the server where automated backups will be stored. Ensure the server process has write permissions.
                                </p>
                            </div>

                            <h3 style={{ marginBottom: '1.5rem' }}>Manual Actions</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                <button onClick={handleCreateBackup} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem' }}>
                                    <IconCloud /> Create System Backup
                                </button>

                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportBackup}
                                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                    />
                                    <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem' }}>
                                        📥 Import Backup File
                                    </button>
                                </div>
                            </div>
                            {backupMsg && <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', borderLeft: '4px solid var(--accent-color)' }}>{backupMsg}</div>}

                            <h3 style={{ margin: '0 0 1rem' }}>Backup History</h3>
                            {loadingBackups ? <div style={{ opacity: 0.5 }}>Loading archives...</div> : (
                                <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                    {backups.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No backups found in configured directory.</div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {backups.map((filename, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>{filename}</td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                                <a
                                                                    href={`${apiUrl}/api/admin/backup/download/${filename}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
                                                                >
                                                                    Download
                                                                </a>
                                                                <button
                                                                    onClick={() => handleRestore(filename)}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                                                                >
                                                                    Restore
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- SYSTEM TAB --- */}
                    {activeTab === 'system' && (
                        <div className="animate-fade-in">
                            <h3 style={{ marginBottom: '1.5rem' }}>Environment Status</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                <div style={infoCardStyle}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Network</span>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace' }}>{serverIp}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', marginTop: '0.5rem' }}>● Online (HTTPS)</div>
                                </div>

                                <div style={infoCardStyle}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Scanner Nodes</span>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{scanners.length} <span style={{ fontSize: '1rem', opacity: 0.5 }}>Active</span></div>
                                    <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>Connected Devices</div>
                                </div>

                                <div style={infoCardStyle}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Database</span>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>MongoDB</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', marginTop: '0.5rem' }}>● Connected</div>
                                </div>

                                <div style={infoCardStyle}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>System Version</span>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>v2.4.0</div>
                                    <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>Build 2026.02</div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.8rem' };
const infoCardStyle = { background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' };

export default Settings;
