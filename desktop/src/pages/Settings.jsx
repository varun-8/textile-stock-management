import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings, IconCloud, IconScan } from '../components/Icons';
import { useNotification } from '../context/NotificationContext';

const Settings = () => {
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();
    const { showNotification, showConfirm } = useNotification();
    const [activeTab, setActiveTab] = useState('general');
    const [backupPath, setBackupPath] = useState('');
    const [backups, setBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [backupMsg, setBackupMsg] = useState('');

    // System Info State
    const [serverIp, setServerIp] = useState('Loading...');
    const [scanners, setScanners] = useState([]);

    // Wipe states
    const [showWipeConfirm, setShowWipeConfirm] = useState(false);
    const [wipePasswordInput, setWipePasswordInput] = useState('');

    // API Edit states
    const [isEditingApi, setIsEditingApi] = useState(false);
    const [tempApiUrl, setTempApiUrl] = useState(apiUrl);

    useEffect(() => {
        fetchConfig();
        fetchBackups();
        fetchSystemInfo();
    }, [apiUrl]);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/config/backup-path`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.path) setBackupPath(data.path);
        } catch (err) { console.error(err); }
    };

    const fetchBackups = async () => {
        setLoadingBackups(true);
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/backups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setBackups(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); }
        finally { setLoadingBackups(false); }
    };

    const fetchSystemInfo = async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            // Fetch IP
            const resIp = await fetch(`${apiUrl}/api/admin/server-ip`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataIp = await resIp.json();
            setServerIp(dataIp.ip);

            // Fetch Scanners for count
            const resScan = await fetch(`${apiUrl}/api/admin/scanners`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataScan = await resScan.json();
            setScanners(dataScan);
        } catch (err) { console.error(err); }
    };

    const handleSavePath = async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            await fetch(`${apiUrl}/api/admin/config/backup-path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ path: backupPath })
            });
            alert('Backup path updated successfully');
        } catch { alert('Failed to update path'); }
    };

    const handleCreateBackup = async () => {
        setBackupMsg('Creating backup...');
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/backup`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setBackupMsg(`Backup created: ${data.filename}`);
                fetchBackups();
            } else {
                setBackupMsg(`Error: ${data.error}`);
            }
        } catch { setBackupMsg('Failed to create backup'); }
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

                const token = localStorage.getItem('ADMIN_TOKEN');
                const res = await fetch(`${apiUrl}/api/admin/restore`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
            } catch {
                alert('Invalid backup file format');
                setBackupMsg('');
            }
        };
        reader.readAsText(file);
    };

    const handleRestore = async (filename) => {
        if (!window.confirm(`Restore from ${filename}? Current data will be replaced.`)) return;

        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ filename })
            });
            if (res.ok) {
                alert('Restore complete. Reloading...');
                window.location.reload();
            } else {
                alert('Restore failed');
            }
        } catch (err) { console.error(err); alert('Restore failed'); }
    };

    const handleDownload = async (filename) => {
        try {
            setBackupMsg('Downloading...');
            const res = await fetch(`${apiUrl}/api/admin/backup/download/${filename}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ADMIN_TOKEN')}` }
            });

            if (!res.ok) throw new Error('Download failed');

            // Because it's a blob/json file, we fetch it and create an object URL
            const blob = await res.blob();

            // Native Electron Download Bridge
            if (window.electronAPI?.saveFile) {
                const text = await blob.text();
                const saved = await window.electronAPI.saveFile(filename, text);
                if (saved) setBackupMsg('Download complete');
                else setBackupMsg('');
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            setBackupMsg('');
        } catch (err) {
            setBackupMsg('Error downloading backup');
            console.error(err);
        }
    };

    const handleWipe = async () => {
        if (!wipePasswordInput) {
            showNotification('Please enter the wipe password.', 'error');
            return;
        }

        const confirmed = await showConfirm(
            'CRITICAL: System Wipe',
            'Are you absolutely sure? This operation will PERMANENTLY delete all stock, barcodes, sessions, and configurations. This cannot be undone.',
            'danger'
        );

        if (!confirmed) return;

        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/system/wipe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: wipePasswordInput })
            });

            const data = await res.json();
            if (res.ok) {
                showNotification(data.message, 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showNotification(data.error || 'System wipe failed.', 'error');
            }
        } catch {
            showNotification('Communication failure during wipe operation.', 'error');
        }
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
                                        value={isEditingApi ? tempApiUrl : apiUrl}
                                        readOnly={!isEditingApi}
                                        onChange={(e) => setTempApiUrl(e.target.value)}
                                        style={{
                                            flex: 1, padding: '0.8rem', borderRadius: '8px',
                                            border: isEditingApi ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                            background: isEditingApi ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                                            color: isEditingApi ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                    {isEditingApi ? (
                                        <>
                                            <button
                                                onClick={() => { updateApiUrl(tempApiUrl); setIsEditingApi(false); }}
                                                className="btn btn-primary"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => { setIsEditingApi(false); setTempApiUrl(apiUrl); }}
                                                className="btn btn-secondary"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditingApi(true)}
                                            className="btn btn-secondary"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                                    Current connection endpoint for scanner data synchronization.
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        await fetch(`${apiUrl}/api/logout`, { method: 'POST' });
                                    } catch (e) { console.error('Logout err', e); }
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                                {/* Auto Backup Config Card */}
                                <div style={infoCardStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                                            <IconCloud />
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Auto-Backup Setup</h3>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                        System state is backed up automatically at <strong>11:00 PM daily</strong> and upon <strong>Admin Login/Logout</strong>. Choose where these files are saved.
                                    </p>
                                    <label style={labelStyle}>Target Directory Path</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                        <input
                                            type="text"
                                            value={backupPath}
                                            onClick={async () => {
                                                if (window.electronAPI?.selectDirectory) {
                                                    const path = await window.electronAPI.selectDirectory();
                                                    if (path) setBackupPath(path);
                                                }
                                            }}
                                            onChange={e => setBackupPath(e.target.value)}
                                            placeholder="./backups (Click to browse)"
                                            style={{
                                                flex: 1, padding: '0.8rem', borderRadius: '8px',
                                                border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)', fontFamily: 'monospace',
                                                cursor: window.electronAPI ? 'pointer' : 'text'
                                            }}
                                        />
                                        <button onClick={handleSavePath} className="btn btn-primary" style={{ padding: '0 1rem' }}>Save</button>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, margin: 0 }}>
                                        Supports absolute paths (e.g. <code>C:/Backups</code>) or relative paths. Ensure the server has write permissions.
                                    </p>
                                </div>

                                {/* Manual Action Card */}
                                <div style={infoCardStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                                            <IconSettings />
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Manual Actions</h3>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                        Create an instant snapshot of your current database state, or restore the system from an existing <code>.json</code> backup file.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <button onClick={handleCreateBackup} className="btn btn-primary" style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                            <IconCloud /> Create Snapshot Now
                                        </button>

                                        <div style={{ position: 'relative', borderRadius: '8px', border: '2px dashed var(--accent-color)', background: 'rgba(99, 102, 241, 0.05)', transition: 'all 0.2s ease', overflow: 'hidden' }}>
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleImportBackup}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                                            />
                                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.9rem', pointerEvents: 'none' }}>
                                                📥 Click or Drop .json to Import/Restore
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {backupMsg && (
                                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', borderLeft: '4px solid var(--accent-color)', fontWeight: '600' }}>
                                    {backupMsg}
                                </div>
                            )}

                            <h3 style={{ margin: '0 0 1rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border-color)' }}>Snapshot History</h3>
                            {loadingBackups ? <div style={{ opacity: 0.5 }}>Loading archives...</div> : (
                                <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                    {backups.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No backups found in configured directory.</div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {backups.map((filename, i) => {
                                                    const match = filename.match(/^backup-([A-Z]+)-(.*)\.json$/);
                                                    let type = 'BACKUP';
                                                    let displayDate = filename;

                                                    if (match) {
                                                        type = match[1];
                                                        const [datePart, timePart] = match[2].split('T');
                                                        if (datePart && timePart) {
                                                            const tk = timePart.split('-');
                                                            if (tk.length >= 3) {
                                                                try {
                                                                    const dObj = new Date(`${datePart}T${tk[0]}:${tk[1]}:${tk[2]}.${tk[3]}`);
                                                                    if (!isNaN(dObj.getTime())) displayDate = dObj.toLocaleString();
                                                                    else displayDate = `${datePart} ${tk[0]}:${tk[1]}`;
                                                                } catch (e) {
                                                                    console.debug(e);
                                                                }
                                                            }
                                                        }
                                                    }

                                                    return (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '1rem', width: '80px' }}>
                                                                <div style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', textAlign: 'center', color: 'var(--accent-color)' }}>
                                                                    {type}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>{displayDate}</div>
                                                                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7 }}>{filename}</div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={() => handleDownload(filename)}
                                                                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                                                                    >
                                                                        Download
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRestore(filename)}
                                                                        style={{ background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                                                                    >
                                                                        Restore
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
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

                            {/* Danger Zone */}
                            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.03)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', background: 'var(--bg-secondary)' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>⚠️</span> Danger Zone
                                        </h3>
                                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            System-wide data reset and permanent deletion.
                                        </p>
                                    </div>
                                    <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                                        {!showWipeConfirm ? (
                                            <button
                                                onClick={() => setShowWipeConfirm(true)}
                                                className="btn"
                                                style={{
                                                    maxWidth: '400px', margin: '0 auto', justifyContent: 'center', padding: '1rem 2rem',
                                                    background: 'var(--error-color)', color: '#fff', border: 'none',
                                                    fontWeight: '800', borderRadius: '8px', cursor: 'pointer',
                                                    fontSize: '0.9rem', letterSpacing: '0.05em', display: 'flex'
                                                }}
                                            >
                                                INITIALIZE SYSTEM WIPE
                                            </button>
                                        ) : (
                                            <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <p style={{ color: 'var(--error-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    ENTER WIPE PASSWORD TO PROCEED:
                                                </p>
                                                <input
                                                    type="password"
                                                    value={wipePasswordInput}
                                                    onChange={e => setWipePasswordInput(e.target.value)}
                                                    placeholder="Enter password..."
                                                    autoFocus
                                                    style={{
                                                        width: '100%', padding: '0.8rem', borderRadius: '8px',
                                                        border: '2px solid var(--error-color)', background: 'var(--bg-primary)',
                                                        color: 'var(--text-primary)', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '1rem' }}>
                                                    <button
                                                        onClick={handleWipe}
                                                        className="btn"
                                                        style={{
                                                            flex: 2, justifyContent: 'center', padding: '0.8rem',
                                                            background: 'var(--error-color)', color: '#fff', border: 'none',
                                                            fontWeight: '800', borderRadius: '8px', cursor: 'pointer'
                                                        }}
                                                    >
                                                        CONFIRM WIPE
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowWipeConfirm(false); setWipePasswordInput(''); }}
                                                        className="btn btn-secondary"
                                                        style={{ flex: 1, justifyContent: 'center' }}
                                                    >
                                                        CANCEL
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                            Caution: This will reset inventory, logout all sessions, and clear all history logs.
                                        </p>
                                    </div>
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
