import React, { useState, useEffect, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings, IconCloud } from '../components/Icons';
import { useNotification } from '../context/NotificationContext';
import { generateDCPdf } from '../utils/pdfGenerator';

const Settings = () => {
    const { apiUrl, updateApiUrl, theme, toggleTheme, updateCompanyName } = useConfig();
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

    // DC Template state
    const [dcTemplate, setDcTemplate] = useState({
        layoutMode: 'printed',
        companyName: '',
        subTitle: '',
        documentTitle: 'DELIVERY NOTE',
        gstin: '',
        address: '',
        phoneText: '',
        tableHeaderColor: '#1a5c1a',
        showPartyAddress: true,
        showQuality: true,
        showFolding: true,
        showLotNo: true,
        showBillNo: true,
        showBillPreparedBy: true,
        logoDataUrl: '',
        logoDataUrl2: '',
        companyNameSize: 16,
        subTitleSize: 8,
        addressSize: 7.5
    });
    const [dcTemplates, setDcTemplates] = useState([]);
    const [selectedDcTemplateId, setSelectedDcTemplateId] = useState('');
    const [dcTemplateName, setDcTemplateName] = useState('Default Template');
    const [savingDcTemplate, setSavingDcTemplate] = useState(false);
    const [templatePreviewUrl, setTemplatePreviewUrl] = useState('');

    const fetchConfig = useCallback(async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const [backupRes, dcTemplateRes, dcTemplatesRes] = await Promise.all([
                fetch(`${apiUrl}/api/admin/config/backup-path`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${apiUrl}/api/admin/config/dc-template`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${apiUrl}/api/admin/config/dc-templates`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const backupData = await backupRes.json();
            if (backupData.path) setBackupPath(backupData.path);

            if (dcTemplateRes.ok) {
                const dcTemplateData = await dcTemplateRes.json();
                setDcTemplate((prev) => ({
                    ...prev,
                    ...dcTemplateData,
                    layoutMode: dcTemplateData.layoutMode || 'printed'
                }));
                setDcTemplateName(dcTemplateData.templateName || 'Default Template');
                if (dcTemplateData.companyName) {
                    updateCompanyName(dcTemplateData.companyName);
                }
            }

            if (dcTemplatesRes.ok) {
                const catalog = await dcTemplatesRes.json();
                setDcTemplates(Array.isArray(catalog.templates) ? catalog.templates : []);
                if (catalog.activeTemplateId) {
                    setSelectedDcTemplateId(catalog.activeTemplateId);
                }
            }
        } catch (err) { console.error(err); }
    }, [apiUrl]);

    const fetchBackups = useCallback(async () => {
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
    }, [apiUrl]);

    const fetchSystemInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const resIp = await fetch(`${apiUrl}/api/admin/server-ip`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataIp = await resIp.json();
            setServerIp(dataIp.ip);

            const resScan = await fetch(`${apiUrl}/api/admin/scanners`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataScan = await resScan.json();
            setScanners(dataScan);
        } catch (err) { console.error(err); }
    }, [apiUrl]);

    useEffect(() => {
        fetchConfig();
        fetchBackups();
        fetchSystemInfo();
    }, [fetchConfig, fetchBackups, fetchSystemInfo]);

    useEffect(() => {
        return () => {
            if (templatePreviewUrl) {
                try {
                    URL.revokeObjectURL(templatePreviewUrl);
                } catch (err) {
                    console.debug('Template preview URL cleanup skipped:', err);
                }
            }
        };
    }, [templatePreviewUrl]);

    const handleDcTemplateChange = (field, value) => {
        setDcTemplate((prev) => ({ ...prev, [field]: value }));
        if (field === 'companyName') {
            updateCompanyName(value);
        }
    };

    const handleSelectDcTemplate = async (templateId) => {
        if (!templateId) return;
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/config/dc-template/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ templateId })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to switch template');
            }
            setSelectedDcTemplateId(data.templateId || templateId);
            setDcTemplateName(data.templateName || 'Untitled Template');
            if (data.dcTemplate && data.dcTemplate.companyName) {
                updateCompanyName(data.dcTemplate.companyName);
            }
            setDcTemplate((prev) => ({ ...prev, ...(data.dcTemplate || {}) }));
        } catch (err) {
            showNotification(err.message || 'Failed to switch template', 'error');
        }
    };

    const handleNewTemplateDraft = () => {
        setSelectedDcTemplateId('');
        setDcTemplateName('New Template');
        setDcTemplate({
            layoutMode: 'printed',
            companyName: '',
            subTitle: '',
            documentTitle: 'DELIVERY NOTE',
            gstin: '',
            address: '',
            phoneText: '',
            tableHeaderColor: '#1a5c1a',
            showPartyAddress: true,
            showQuality: true,
            showFolding: true,
            showLotNo: true,
            showBillNo: true,
            showBillPreparedBy: true,
            logoDataUrl: '',
            logoDataUrl2: '',
            companyNameSize: 16,
            subTitleSize: 8,
            addressSize: 7.5
        });
    };

    // Core preview generator — called only by button click
    const generatePreview = (templateToUse) => {
        const sampleDc = {
            dcNumber: 'DC-PREVIEW',
            createdAt: new Date().toISOString(),
            status: 'ACTIVE',
            partyName: 'Sample Party Name',
            vehicleNumber: 'KA-01-AB-1234',
            driverName: 'John Doe',
            totalRolls: 13,
            totalMetre: 410.5
        };

        const sampleRolls = [
            { barcode: '26-42-0001', metre: 30.00, pieces: [{ length: 30.00 }] },
            { barcode: '26-42-0002', metre: 28.50, pieces: [{ length: 14.00 }, { length: 14.50 }] },
            { barcode: '26-42-0003', metre: 34.50, pieces: [{ length: 34.50 }] },
            { barcode: '26-42-0004', metre: 45.00, pieces: [{ length: 15.00 }, { length: 15.00 }, { length: 15.00 }] },
            { barcode: '26-42-0005', metre: 22.00, pieces: [{ length: 22.00 }] },
            { barcode: '26-42-0006', metre: 60.00, pieces: [{ length: 15.00 }, { length: 15.00 }, { length: 15.00 }, { length: 15.00 }] },
            { barcode: '26-42-0007', metre: 33.00, pieces: [{ length: 33.00 }] },
            { barcode: '26-42-0008', metre: 12.00, pieces: [{ length: 12.00 }] },
            { barcode: '26-42-0009', metre: 25.50, pieces: [{ length: 12.50 }, { length: 13.00 }] },
            { barcode: '26-42-0010', metre: 10.00, pieces: [{ length: 10.00 }] },
            { barcode: '26-42-0011', metre: 40.00, pieces: [{ length: 40.00 }] },
            { barcode: '26-42-0012', metre: 55.00, pieces: [{ length: 11.00 }, { length: 11.00 }, { length: 11.00 }, { length: 11.00 }, { length: 11.00 }] },
            { barcode: '26-42-0013', metre: 15.00, pieces: [{ length: 15.00 }] }
        ];

        const pdfUrl = generateDCPdf(sampleDc, sampleRolls, templateToUse, { mode: 'bloburl' });
        if (!pdfUrl) return;  // silent fail — no popup

            setTemplatePreviewUrl((prev) => {
                if (prev) {
                    try {
                        URL.revokeObjectURL(prev);
                    } catch (error) {
                        console.debug('Template preview cleanup skipped:', error);
                    }
                }
                return pdfUrl;
            });
    };

    const handlePreviewDcTemplate = () => generatePreview(dcTemplate);

    const handleDcLogoUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showNotification('Please select a valid image file.', 'error'); return; }
        if (file.size > 2.5 * 1024 * 1024) { showNotification('Logo file is too large. Please use an image under 2.5 MB.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = typeof evt.target?.result === 'string' ? evt.target.result : '';
            if (!dataUrl) { showNotification('Failed to load image.', 'error'); return; }
            setDcTemplate((prev) => ({ ...prev, logoDataUrl: dataUrl }));
        };
        reader.onerror = () => showNotification('Failed to read image file.', 'error');
        reader.readAsDataURL(file);
    };

    const handleDcLogo2Upload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showNotification('Please select a valid image file.', 'error'); return; }
        if (file.size > 2.5 * 1024 * 1024) { showNotification('Logo file is too large. Please use an image under 2.5 MB.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = typeof evt.target?.result === 'string' ? evt.target.result : '';
            if (!dataUrl) { showNotification('Failed to load image.', 'error'); return; }
            setDcTemplate((prev) => ({ ...prev, logoDataUrl2: dataUrl }));
        };
        reader.onerror = () => showNotification('Failed to read image file.', 'error');
        reader.readAsDataURL(file);
    };

    const handleSaveDcTemplate = async () => {
        setSavingDcTemplate(true);
        try {
            const token = localStorage.getItem('ADMIN_TOKEN');
            const res = await fetch(`${apiUrl}/api/admin/config/dc-template`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...dcTemplate,
                    templateId: selectedDcTemplateId || undefined,
                    templateName: dcTemplateName || 'Untitled Template'
                })
            });

            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error('Template payload is too large. Use a smaller logo image.');
                }
                if (res.status === 401 || res.status === 403) {
                    throw new Error('Session expired. Please log in again.');
                }
                const raw = await res.text();
                let parsed = {};
                try {
                    parsed = JSON.parse(raw || '{}');
                } catch {
                    parsed = {};
                }
                throw new Error(parsed.error || raw || 'Failed to save DC template');
            }

            const data = await res.json();
            if (data.dcTemplate) {
                setDcTemplate((prev) => ({ ...prev, ...data.dcTemplate }));
            }
            if (Array.isArray(data.templates)) {
                setDcTemplates(data.templates);
            }
            if (data.templateId) {
                setSelectedDcTemplateId(data.templateId);
            }
            if (data.templateName) {
                setDcTemplateName(data.templateName);
            }
            showNotification('DC template saved successfully', 'success');
        } catch (err) {
            showNotification(err.message || 'Failed to save DC template', 'error');
        } finally {
            setSavingDcTemplate(false);
        }
    };

    const handleResetDcTemplate = () => {
        setDcTemplate({
            layoutMode: 'printed',
            companyName: '',
            subTitle: '',
            documentTitle: 'DELIVERY NOTE',
            gstin: '',
            address: '',
            phoneText: '',
            tableHeaderColor: '#1a5c1a',
            showPartyAddress: true,
            showQuality: true,
            showFolding: true,
            showLotNo: true,
            showBillNo: true,
            showBillPreparedBy: true,
            logoDataUrl: '',
            logoDataUrl2: '',
            companyNameSize: 16,
            subTitleSize: 8,
            addressSize: 7.5
        });
    };



    const closeTemplatePreview = () => {
        if (templatePreviewUrl) {
            try {
                URL.revokeObjectURL(templatePreviewUrl);
            } catch (err) {
                console.debug('Template preview close cleanup skipped:', err);
            }
        }
        setTemplatePreviewUrl('');
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
            'Are you absolutely sure? This operation will PERMANENTLY delete all stock, barcodes, batches, and configurations. This cannot be undone.',
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
                        onClick={() => setActiveTab('dc-template')}
                        style={{
                            padding: '1rem 0.5rem', background: 'none', border: 'none',
                            borderBottom: activeTab === 'dc-template' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'dc-template' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                        }}
                    >
                        DC Template
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
                                        Light Mode
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
                                        Dark Mode
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
                                Terminate Batch & Logout
                            </button>
                        </div>
                    )}

                    {/* --- DC TEMPLATE TAB --- */}
                    {activeTab === 'dc-template' && (
                        <div className="animate-fade-in" style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 280px)', minHeight: '600px' }}>

                            {/* ── LEFT: FORM PANEL ── */}
                            <div style={{ width: '380px', flexShrink: 0, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                <h3 style={{ margin: '0 0 0.4rem' }}>DC Challan Template</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                                    Fill your company details below. Click <strong>Preview</strong> to see the challan format.
                                </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

                                {/* Template Selector */}
                                <div style={{ ...infoCardStyle, marginBottom: 0 }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--accent-color)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template Set</div>

                                    <label style={labelStyle}>Select Template</label>
                                    <select
                                        value={selectedDcTemplateId}
                                        onChange={(e) => handleSelectDcTemplate(e.target.value)}
                                        style={{ ...textInputStyle, marginBottom: '0.7rem' }}
                                    >
                                        {dcTemplates.length === 0 ? (
                                            <option value="">No templates found</option>
                                        ) : (
                                            dcTemplates.map((tpl) => (
                                                <option key={tpl.id} value={tpl.id}>
                                                    {tpl.name}
                                                </option>
                                            ))
                                        )}
                                    </select>

                                    <label style={labelStyle}>Template Name</label>
                                    <input
                                        type="text"
                                        value={dcTemplateName}
                                        onChange={(e) => setDcTemplateName(e.target.value)}
                                        style={{ ...textInputStyle, marginBottom: '0.7rem' }}
                                        placeholder="Template name"
                                    />

                                    <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={handleNewTemplateDraft}>
                                        + New Template
                                    </button>
                                </div>

                                {/* Layout Mode */}
                                <div style={{ ...infoCardStyle, marginBottom: 0 }}>
                                    <label style={labelStyle}>Layout Mode</label>
                                    <select value={dcTemplate.layoutMode || 'printed'} onChange={(e) => handleDcTemplateChange('layoutMode', e.target.value)} style={textInputStyle}>
                                        <option value="printed">Printed Ledger (Tally Sheet — matches paper)</option>
                                        <option value="modern">Modern Table</option>
                                    </select>
                                </div>

                                {/* Company Info */}
                                <div style={{ ...infoCardStyle, marginBottom: 0 }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--accent-color)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company Identity</div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <label style={labelStyle}>Company Name</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Size</span>
                                            <input type="number" min="8" max="40" step="1" 
                                                value={dcTemplate.companyNameSize ?? ''} 
                                                placeholder="16"
                                                onChange={(e) => handleDcTemplateChange('companyNameSize', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                                style={{ ...textInputStyle, width: '56px', padding: '0.3rem 0.4rem' }} 
                                            />
                                        </div>
                                    </div>
                                    <input type="text" value={dcTemplate.companyName || ''} onChange={(e) => handleDcTemplateChange('companyName', e.target.value)} style={{ ...textInputStyle, marginBottom: '0.7rem' }} placeholder="Company Name" />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <label style={labelStyle}>Sub Heading / Specialty</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Size</span>
                                            <input type="number" min="6" max="24" step="0.5" 
                                                value={dcTemplate.subTitleSize ?? ''} 
                                                placeholder="8"
                                                onChange={(e) => handleDcTemplateChange('subTitleSize', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                                style={{ ...textInputStyle, width: '56px', padding: '0.3rem 0.4rem' }} 
                                            />
                                        </div>
                                    </div>
                                    <input type="text" value={dcTemplate.subTitle || ''} onChange={(e) => handleDcTemplateChange('subTitle', e.target.value)} style={{ ...textInputStyle, marginBottom: '0.7rem' }} placeholder="Specialty or tagline" />

                                    <label style={labelStyle}>Document Title</label>
                                    <input type="text" value={dcTemplate.documentTitle || ''} onChange={(e) => handleDcTemplateChange('documentTitle', e.target.value)} style={{ ...textInputStyle, marginBottom: '0.7rem' }} placeholder="DELIVERY NOTE" />
                                    <label style={labelStyle}>GSTIN</label>
                                    <input type="text" value={dcTemplate.gstin || ''} onChange={(e) => handleDcTemplateChange('gstin', e.target.value)} style={{ ...textInputStyle, marginBottom: '0.7rem' }} placeholder="Your GSTIN number" />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <label style={labelStyle}>Full Address</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Size</span>
                                            <input type="number" min="6" max="18" step="0.5" 
                                                value={dcTemplate.addressSize ?? ''} 
                                                placeholder="7.5"
                                                onChange={(e) => handleDcTemplateChange('addressSize', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                                style={{ ...textInputStyle, width: '56px', padding: '0.3rem 0.4rem' }} 
                                            />
                                        </div>
                                    </div>
                                    <textarea
                                        value={dcTemplate.address || ''}
                                        onChange={(e) => handleDcTemplateChange('address', e.target.value)}
                                        style={{ ...textInputStyle, marginBottom: '0.7rem', resize: 'vertical', minHeight: '68px', fontFamily: 'inherit', lineHeight: '1.5' }}
                                        placeholder="Door No, Street, Area, City, State - PIN"
                                        rows={3}
                                    />
                                    <label style={labelStyle}>Phone / Contact</label>
                                    <input type="text" value={dcTemplate.phoneText || ''} onChange={(e) => handleDcTemplateChange('phoneText', e.target.value)} style={{ ...textInputStyle, marginBottom: '0.7rem' }} placeholder="Mobile / Phone number" />
                                    <label style={labelStyle}>Ink / Border Colour</label>
                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        <input type="color" value={dcTemplate.tableHeaderColor || '#1a5c1a'} onChange={(e) => handleDcTemplateChange('tableHeaderColor', e.target.value)} style={{ width: '44px', height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }} />
                                        <input type="text" value={dcTemplate.tableHeaderColor || '#1a5c1a'} onChange={(e) => handleDcTemplateChange('tableHeaderColor', e.target.value)} style={textInputStyle} placeholder="#1a5c1a" />
                                    </div>
                                </div>

                                {/* Logos */}
                                <div style={{ ...infoCardStyle, marginBottom: 0 }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--accent-color)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logos (Left &amp; Right of Company Name)</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={labelStyle}>Left Logo</label>
                                            <input type="file" accept="image/*" onChange={handleDcLogoUpload} style={{ ...textInputStyle, padding: '0.4rem', fontSize: '0.78rem' }} />
                                            {dcTemplate.logoDataUrl ? (
                                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                                                    <img src={dcTemplate.logoDataUrl} alt="Left logo" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', padding: '2px' }} />
                                                    <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => handleDcTemplateChange('logoDataUrl', '')}>Remove</button>
                                                </div>
                                            ) : <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>No logo</p>}
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Right Logo</label>
                                            <input type="file" accept="image/*" onChange={handleDcLogo2Upload} style={{ ...textInputStyle, padding: '0.4rem', fontSize: '0.78rem' }} />
                                            {dcTemplate.logoDataUrl2 ? (
                                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                                                    <img src={dcTemplate.logoDataUrl2} alt="Right logo" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', padding: '2px' }} />
                                                    <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => handleDcTemplateChange('logoDataUrl2', '')}>Remove</button>
                                                </div>
                                            ) : <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>No logo</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Optional Fields */}
                                <div style={{ ...infoCardStyle, marginBottom: 0 }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--accent-color)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optional Fields</div>
                                    <label style={checkboxLabelStyle}>
                                        <input type="checkbox" checked={dcTemplate.showPartyAddress !== false} onChange={(e) => handleDcTemplateChange('showPartyAddress', e.target.checked)} />
                                        Party Address (enter at DC generation)
                                    </label>
                                    <label style={{ ...checkboxLabelStyle, marginTop: '0.6rem' }}>
                                        <input type="checkbox" checked={dcTemplate.showQuality !== false} onChange={(e) => handleDcTemplateChange('showQuality', e.target.checked)} />
                                        Quality (enter at DC generation)
                                    </label>
                                    <label style={{ ...checkboxLabelStyle, marginTop: '0.6rem' }}>
                                        <input type="checkbox" checked={dcTemplate.showFolding !== false} onChange={(e) => handleDcTemplateChange('showFolding', e.target.checked)} />
                                        Folding (enter at DC generation)
                                    </label>
                                    <label style={{ ...checkboxLabelStyle, marginTop: '0.6rem' }}>
                                        <input type="checkbox" checked={dcTemplate.showLotNo !== false} onChange={(e) => handleDcTemplateChange('showLotNo', e.target.checked)} />
                                        Lot No (enter at DC generation)
                                    </label>
                                    <label style={{ ...checkboxLabelStyle, marginTop: '0.6rem' }}>
                                        <input type="checkbox" checked={dcTemplate.showBillNo !== false} onChange={(e) => handleDcTemplateChange('showBillNo', e.target.checked)} />
                                        Bill No (enter at DC generation)
                                    </label>
                                    <label style={{ ...checkboxLabelStyle, marginTop: '0.6rem' }}>
                                        <input type="checkbox" checked={dcTemplate.showBillPreparedBy !== false} onChange={(e) => handleDcTemplateChange('showBillPreparedBy', e.target.checked)} />
                                        Bill Prepared By (enter at DC generation)
                                    </label>
                                </div>



                                {/* Action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '1rem' }}>
                                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontWeight: '700' }} onClick={handlePreviewDcTemplate}>
                                        Preview Challan
                                    </button>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={handleResetDcTemplate}>Reset</button>
                                        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', fontWeight: '700' }} onClick={handleSaveDcTemplate} disabled={savingDcTemplate}>
                                            {savingDcTemplate ? 'Saving...' : 'Save Template'}
                                        </button>
                                    </div>
                                </div>

                            </div>{/* end form sections */}
                        </div>{/* end left panel */}

                            {/* ── RIGHT: LIVE PREVIEW PANEL ── */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
                                <div style={{ padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Challan Preview</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Click "Preview Challan" button to refresh</div>
                                    </div>
                                    {templatePreviewUrl && (
                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={closeTemplatePreview}>✕ Clear</button>
                                    )}
                                </div>

                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                                    {templatePreviewUrl ? (
                                        <iframe
                                            title="Delivery Challan Template Preview"
                                            src={templatePreviewUrl}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                        />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
                                            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>No Preview Generated</div>
                                            <div style={{ fontSize: '0.85rem' }}>Fill in your details and click <strong>Preview Challan</strong> to see the exact PDF that will be generated.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
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
                                                Click or Drop .json to Import/Restore
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
                                            <span>!</span> Danger Zone
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
                                            Caution: This will reset inventory, logout all batches, and clear all history logs.
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
const textInputStyle = {
    width: '100%',
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)'
};
const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--text-primary)',
    fontSize: '0.9rem'
};

export default Settings;
