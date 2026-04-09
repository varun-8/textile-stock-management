import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';
import { useNotification } from '../context/NotificationContext';
import { IconPlus, IconTruck, IconEye, IconX, IconPrint } from '../components/Icons';
import { generateDCPdf } from '../utils/pdfGenerator';

const DEFAULT_DC_TEMPLATE = {
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
    showVehicle: true,
    showDriver: true,
    logoDataUrl: '',
    logoDataUrl2: '',
    companyNameSize: 16,
    subTitleSize: 8,
    addressSize: 7.5
};

const DeliveryChallans = () => {
    const { apiUrl } = useConfig();
    const { showNotification } = useNotification();
    const [dcs, setDcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [dcTemplateConfig, setDcTemplateConfig] = useState(null);
    const [dcTemplates, setDcTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfPreviewTitle, setPdfPreviewTitle] = useState('PDF Preview');
    const [pdfPreviewMode, setPdfPreviewMode] = useState('history');

    // Form state
    const [partyName, setPartyName] = useState('');
    const [partyAddress, setPartyAddress] = useState('');
    const [quality, setQuality] = useState('');
    const [folding, setFolding] = useState('');
    const [lotNo, setLotNo] = useState('');
    const [billNo, setBillNo] = useState('');
    const [billPreparedBy, setBillPreparedBy] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [driverName, setDriverName] = useState('');
    const [percentage, setPercentage] = useState('0');
    
    // Batch selection state
    const [outBatches, setOutBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);

    const token = localStorage.getItem('ADMIN_TOKEN');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    const activeTemplate = { ...DEFAULT_DC_TEMPLATE, ...(dcTemplateConfig || {}) };
    const selectedTemplateConfig = (() => {
        const selected = dcTemplates.find((tpl) => tpl.id === selectedTemplateId);
        if (selected?.config) {
            return { ...DEFAULT_DC_TEMPLATE, ...(selected.config || {}) };
        }
        return activeTemplate;
    })();

    const fetchDCs = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${apiUrl}/api/dc`, authHeaders);
            setDcs(res.data);
        } catch (error) {
            console.error('Failed to fetch DCs:', error);
            showNotification('Failed to load Delivery Challans', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDCs();
        fetchDcTemplateConfig();
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) {
                try {
                    URL.revokeObjectURL(pdfPreviewUrl);
                } catch (err) {
                    console.debug('PDF preview URL cleanup skipped:', err);
                }
            }
        };
    }, [pdfPreviewUrl]);

    const fetchDcTemplateConfig = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/config/dc-template`, authHeaders);
            setDcTemplateConfig(res.data || null);
            if (res.data?.templateId) {
                setSelectedTemplateId(res.data.templateId);
            }
        } catch (error) {
            console.error('Failed to fetch DC template config:', error);
        }
    };

    const fetchDcTemplates = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/config/dc-templates`, authHeaders);
            const templates = Array.isArray(res.data?.templates) ? res.data.templates : [];
            setDcTemplates(templates);
            if (res.data?.activeTemplateId) {
                setSelectedTemplateId(res.data.activeTemplateId);
            } else if (templates.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(templates[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch DC templates:', error);
        }
    };

    const getLatestDcTemplateConfig = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/config/dc-template`, authHeaders);
            const latest = res.data || null;
            if (latest) {
                setDcTemplateConfig(latest);
            }
            return latest;
        } catch (error) {
            console.error('Failed to fetch latest DC template config:', error);
            return dcTemplateConfig;
        }
    };

    const handleOpenCreateModal = async () => {
        setPartyName('');
        setPartyAddress('');
        setQuality('');
        setFolding('');
        setLotNo('');
        setBillNo('');
        setBillPreparedBy('');
        setVehicleNumber('');
        setDriverName('');
        setPercentage('0');
        setSelectedBatch(null);
        setIsCreateModalOpen(true);
        await Promise.all([fetchOutBatches(), fetchDcTemplateConfig(), fetchDcTemplates()]);
    };

    const validateManualFields = (templateConfig) => {
        if (templateConfig.showPartyAddress && !partyAddress.trim()) return 'Party Address is required';
        if (templateConfig.showQuality && !quality.trim()) return 'Quality is required';
        if (templateConfig.showFolding && !folding.trim()) return 'Folding is required';
        if (templateConfig.showLotNo && !lotNo.trim()) return 'Lot No is required';
        if (templateConfig.showBillNo && !billNo.trim()) return 'Bill No is required';
        if (templateConfig.showBillPreparedBy && !billPreparedBy.trim()) return 'Bill Prepared By is required';
        return null;
    };

    const getSelectedTemplate = () => {
        const fromList = dcTemplates.find((tpl) => tpl.id === selectedTemplateId);
        if (fromList?.config) {
            return {
                id: fromList.id,
                name: fromList.name || 'Template',
                config: { ...DEFAULT_DC_TEMPLATE, ...(fromList.config || {}) }
            };
        }

        return {
            id: dcTemplateConfig?.templateId || '',
            name: dcTemplateConfig?.templateName || 'Template',
            config: { ...DEFAULT_DC_TEMPLATE, ...(dcTemplateConfig || {}) }
        };
    };

    const handlePreviewDC = async () => {
        if (!partyName) {
            return showNotification('Party Name is required', 'error');
        }
        if (!selectedBatch) {
            return showNotification('Select a batch for preview', 'error');
        }

        const pct = parseFloat(percentage) || 0;
        if (pct < 0 || pct > 100) {
            return showNotification('Percentage must be between 0 and 100', 'error');
        }

        try {
            const selectedTemplate = getSelectedTemplate();
            const latestTemplate = selectedTemplate?.config || {
                ...DEFAULT_DC_TEMPLATE,
                ...((await getLatestDcTemplateConfig()) || {})
            };
            const manualValidationError = validateManualFields(latestTemplate);
            if (manualValidationError) {
                return showNotification(manualValidationError, 'error');
            }

            // Create temporary DC-like object for preview
            const tempDC = {
                dcNumber: 'PREVIEW-' + new Date().getTime(),
                createdAt: new Date(),
                partyName,
                partyAddress: partyAddress.trim(),
                quality: quality.trim(),
                folding: folding.trim(),
                lotNo: lotNo.trim(),
                billNo: billNo.trim(),
                billPreparedBy: billPreparedBy.trim(),
                vehicleNumber: latestTemplate.showVehicle ? vehicleNumber : '',
                driverName: latestTemplate.showDriver ? driverName : '',
                totalRolls: selectedBatch.rollCount,
                totalMetre: (parseFloat(selectedBatch.totalMetre) * (1 + pct / 100)).toFixed(2),
                appliedPercentage: pct,
                rolls: selectedBatch.rolls || []
            };

            const pdfUrl = generateDCPdf(tempDC, tempDC.rolls, latestTemplate, { mode: 'bloburl' });
            
            if (!pdfUrl) {
                showNotification('Unable to generate preview', 'error');
                return;
            }

            if (pdfPreviewUrl) {
                try {
                    URL.revokeObjectURL(pdfPreviewUrl);
                } catch (err) {
                    console.debug('PDF preview URL revoke skipped:', err);
                }
            }

            setPdfPreviewTitle(`DC Preview - ${partyName}`);
            setPdfPreviewUrl(pdfUrl);
            setPdfPreviewMode('preview');
        } catch (error) {
            console.error('Failed to generate preview:', error);
            showNotification('Failed to generate preview', 'error');
        }
    };

    const handleCreateDC = async (e) => {
        e?.preventDefault();
        if (!partyName) {
            return showNotification('Party Name is required', 'error');
        }
        if (!selectedBatch) {
            return showNotification('Select a batch for the DC', 'error');
        }

        const pct = parseFloat(percentage) || 0;
        if (pct < 0 || pct > 100) {
            return showNotification('Percentage must be between 0 and 100', 'error');
        }

        try {
            const selectedTemplate = getSelectedTemplate();
            const latestTemplate = selectedTemplate?.config || {
                ...DEFAULT_DC_TEMPLATE,
                ...((await getLatestDcTemplateConfig()) || {})
            };
            const manualValidationError = validateManualFields(latestTemplate);
            if (manualValidationError) {
                return showNotification(manualValidationError, 'error');
            }

            // Create DC with batch data
            const dcData = {
                partyName,
                partyAddress: partyAddress.trim(),
                quality: quality.trim(),
                folding: folding.trim(),
                lotNo: lotNo.trim(),
                billNo: billNo.trim(),
                billPreparedBy: billPreparedBy.trim(),
                vehicleNumber: latestTemplate.showVehicle ? vehicleNumber : '',
                driverName: latestTemplate.showDriver ? driverName : '',
                // Backward compatibility for older backend builds.
                // New backend derives rolls from batchId and ignores this list.
                barcodes: Array.isArray(selectedBatch.rolls) ? selectedBatch.rolls.map(r => r.barcode) : [],
                batchId: selectedBatch._id,
                appliedPercentage: pct,
                templateId: selectedTemplate?.id || '',
                templateName: selectedTemplate?.name || '',
                templateSnapshot: latestTemplate
            };

            const res = await axios.post(`${apiUrl}/api/dc`, dcData, authHeaders);

            showNotification(`Delivery Challan ${res.data.dc.dcNumber} created with ${pct}% adjustment!`, 'success');

            const filename = `${String(res.data.dc.dcNumber || 'DC').replace(/\s+/g, '_')}_Challan.pdf`;
            if (window.electronAPI?.printOrSavePdf) {
                const pdfBlob = generateDCPdf(res.data.dc, res.data.dc.rolls, latestTemplate, { mode: 'blob' });
                if (pdfBlob) {
                    const buffer = await pdfBlob.arrayBuffer();
                    const bytes = Array.from(new Uint8Array(buffer));
                    const printResult = await window.electronAPI.printOrSavePdf(filename, bytes);
                    if (printResult?.mode === 'printed') {
                        showNotification('DC sent to printer', 'success');
                    } else {
                        showNotification('No printer available. DC is saved in software history only.', 'error');
                    }
                }
            }
            
            // Show view-only preview inside software.
            const pdfUrl = generateDCPdf(res.data.dc, res.data.dc.rolls, latestTemplate, { mode: 'bloburl' });
            
            if (pdfUrl) {
                setPdfPreviewTitle(`DC ${res.data.dc.dcNumber} Preview`);
                setPdfPreviewUrl(pdfUrl);
                setPdfPreviewMode('generated');
            }

            setIsCreateModalOpen(false);
            fetchDCs(); // refresh list
        } catch (error) {
            console.error('Failed to create DC:', error);
            showNotification(error.response?.data?.error || 'Failed to create DC', 'error');
        }
    };

    const handleCancelDC = async (id) => {
        if (!window.confirm('Are you sure you want to completely CANCEL this Delivery Challan? This action will reverse the stock OUT status.')) return;
        
        try {
            await axios.post(`${apiUrl}/api/dc/${id}/cancel`, {}, authHeaders);
            showNotification('Delivery Challan Cancelled', 'success');
            fetchDCs();
        } catch (error) {
            console.error('Failed to cancel DC:', error);
            showNotification(error.response?.data?.error || 'Failed to cancel DC', 'error');
        }
    };

    const fetchOutBatches = async () => {
        try {
            setBatchLoading(true);
            const res = await axios.get(`${apiUrl}/api/sessions/batch/active-out/list`, authHeaders);
            setOutBatches(res.data || []);
            setSelectedBatch(null);
            setPercentage('0');
        } catch (error) {
            console.error('Failed to fetch OUT batches:', error);
            showNotification('Failed to load OUT batches', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    const handleViewPdf = async (dc) => {
        const templateForDc = dc?.templateSnapshot && typeof dc.templateSnapshot === 'object'
            ? dc.templateSnapshot
            : await getLatestDcTemplateConfig();
        const pdfUrl = generateDCPdf(dc, dc.rolls, templateForDc, { mode: 'bloburl' });
        if (!pdfUrl) {
            showNotification('Unable to open PDF preview', 'error');
            return;
        }

        if (pdfPreviewUrl) {
            try {
                URL.revokeObjectURL(pdfPreviewUrl);
            } catch (err) {
                console.debug('PDF preview URL revoke skipped:', err);
            }
        }

        setPdfPreviewTitle(`DC ${dc.dcNumber || ''} Preview`);
        setPdfPreviewUrl(pdfUrl);
        setPdfPreviewMode('history');
    };

    const closePdfPreview = () => {
        if (pdfPreviewUrl) {
            try {
                URL.revokeObjectURL(pdfPreviewUrl);
            } catch (err) {
                console.debug('PDF preview URL close cleanup skipped:', err);
            }
        }
        setPdfPreviewUrl('');
        setPdfPreviewTitle('PDF Preview');
        setPdfPreviewMode('history');
    };

    const handlePrintPdf = () => {
        if (pdfPreviewUrl) {
            // Open in new window for printing
            const printWindow = window.open(pdfPreviewUrl, '_blank');
            if (printWindow) {
                printWindow.addEventListener('load', () => {
                    printWindow.print();
                });
            }
        }
    };

    const openHistoryPrompt = (dc) => {
        setSelectedHistoryDc(dc);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Header */}
            <header style={{ 
                padding: '1.5rem 2rem', 
                background: 'var(--bg-primary)', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Delivery Challans</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Manage official dispatches and generate DC documents.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        onClick={handleOpenCreateModal}
                        style={{
                            background: 'var(--accent-color)', color: 'white',
                            border: 'none', padding: '0.75rem 1.25rem',
                            borderRadius: '8px', fontWeight: '700',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                        }}
                    >
                        <IconPlus size="18" /> GENERATE NEW DC
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '2.5rem 2rem', overflowY: 'auto' }}>
                <div className="card">
                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <IconTruck size="18" /> DC History
                    </h2>
                    
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Delivery Challans...</div>
                    ) : dcs.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No Delivery Challans generated yet.
                        </div>
                    ) : (
                        <div className="panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.9rem' }}>
                                <colgroup>
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '30%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '24%' }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DC No.</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Party</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totals</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dcs.map((dc, idx) => {
                                        const isCancelled = dc.status === 'CANCELLED';
                                        return (
                                            <tr 
                                                key={dc._id} 
                                                style={{ 
                                                    opacity: isCancelled ? 0.65 : 1,
                                                    background: idx % 2 === 0 ? 'transparent' : 'var(--row-alt-bg)',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    transition: 'background 0.2s ease',
                                                    cursor: 'pointer'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = 'var(--row-hover-bg)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--row-alt-bg)';
                                                }}
                                                onClick={() => handleViewPdf(dc)}
                                            >
                                                <td style={{
                                                    fontWeight: '700',
                                                    padding: '1rem 1.5rem',
                                                    textAlign: 'left',
                                                    color: 'var(--accent-color)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    fontFamily: 'monospace'
                                                }} title={dc.dcNumber}>
                                                    {dc.dcNumber}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                    {new Date(dc.createdAt).toLocaleDateString('en-IN')}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dc.partyName}>
                                                    {dc.partyName}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                                                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{dc.totalRolls}</div>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{dc.totalMetre} m</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        minWidth: '96px',
                                                        padding: '5px 10px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.73rem',
                                                        fontWeight: '700',
                                                        letterSpacing: '0.03em',
                                                        background: isCancelled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                                        color: isCancelled ? 'var(--error-color)' : 'var(--success-color)',
                                                        border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                                    }}>
                                                        {dc.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Create DC Modal */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--modal-overlay)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div className="card" style={{ 
                        width: '100%',
                        maxWidth: '1050px',
                        height: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '14px',
                        boxShadow: 'var(--card-shadow)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconTruck /> Create Delivery Challan</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <IconX />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                            {/* Left Side: Form */}
                            <div style={{ width: '350px', padding: '1.5rem', borderRight: '1px solid var(--border-color)', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label>DC Template</label>
                                    <select
                                        className="input"
                                        value={selectedTemplateId}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        disabled={dcTemplates.length === 0}
                                    >
                                        {dcTemplates.length === 0 ? (
                                            <option value="">Default Template</option>
                                        ) : (
                                            dcTemplates.map((tpl) => (
                                                <option key={tpl.id} value={tpl.id}>
                                                    {tpl.name}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Party Name / Billed To *</label>
                                    <input type="text" className="input" value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Customer Name" />
                                </div>
                                {selectedTemplateConfig.showPartyAddress && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Party Address *</label>
                                        <textarea
                                            className="input"
                                            value={partyAddress}
                                            onChange={e => setPartyAddress(e.target.value)}
                                            placeholder="Customer Address"
                                            rows={2}
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>
                                )}
                                {selectedTemplateConfig.showQuality && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Quality *</label>
                                        <input type="text" className="input" value={quality} onChange={e => setQuality(e.target.value)} placeholder="Quality" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showFolding && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Folding *</label>
                                        <input type="text" className="input" value={folding} onChange={e => setFolding(e.target.value)} placeholder="Folding" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showLotNo && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Lot No *</label>
                                        <input type="text" className="input" value={lotNo} onChange={e => setLotNo(e.target.value)} placeholder="Lot Number" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showBillNo && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Bill No *</label>
                                        <input type="text" className="input" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="Bill Number" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showBillPreparedBy && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Bill Prepared By *</label>
                                        <input type="text" className="input" value={billPreparedBy} onChange={e => setBillPreparedBy(e.target.value)} placeholder="Prepared By" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showVehicle && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Vehicle Number</label>
                                        <input type="text" className="input" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="TN 38 XX 0000" />
                                    </div>
                                )}
                                {selectedTemplateConfig.showDriver && (
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <label>Driver Name / Addl Info</label>
                                        <input type="text" className="input" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Optional" />
                                    </div>
                                )}

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label>Percentage Adjustment (%)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        className="input" 
                                        value={percentage} 
                                        onChange={e => setPercentage(e.target.value)} 
                                        placeholder="e.g. 5" 
                                    />
                                </div>
                                
                                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Selected Batch</h3>
                                    {selectedBatch ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Batch Code:</span>
                                                <span style={{ fontWeight: 'bold' }}>{selectedBatch.batchCode}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Total Rolls:</span>
                                                <span style={{ fontWeight: 'bold' }}>{selectedBatch.rollCount}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Original Metre:</span>
                                                <span style={{ fontWeight: 'bold' }}>{selectedBatch.totalMetre}m</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                                                <span>With {percentage}% Adjustment:</span>
                                                <span>{(parseFloat(selectedBatch.totalMetre) * (1 + parseFloat(percentage || 0) / 100)).toFixed(2)}m</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--text-secondary)' }}>Select a batch from the right →</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Right Side: Batch Selection */}
                            <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                                <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>OUTSTOCK BATCHES - Select One</h3>
                                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    {batchLoading ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading batches...</div>
                                    ) : outBatches.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No active OUTSTOCK batches available.</div>
                                    ) : (
                                        <div>
                                            {outBatches.map(batch => (
                                                <div 
                                                    key={batch._id}
                                                    onClick={() => setSelectedBatch(batch)}
                                                    style={{
                                                        padding: '1rem',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        cursor: 'pointer',
                                                        background: selectedBatch?._id === batch._id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                                        borderLeft: selectedBatch?._id === batch._id ? '3px solid var(--accent-color)' : '3px solid transparent',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                                            Batch: {batch.batchCode}
                                                        </div>
                                                        {selectedBatch?._id === batch._id && (
                                                            <span style={{ background: 'var(--accent-color)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>✓ Selected</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                        📦 {batch.rollCount} rolls • 📏 {batch.totalMetre}m
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'var(--bg-secondary)' }}>
                            <button className="btn" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                            <button 
                                className="btn"
                                style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-color)', fontWeight: '600', border: '1px solid var(--accent-color)' }}
                                onClick={handlePreviewDC}
                                disabled={!selectedBatch || !partyName}
                            >
                                <IconEye size="16" style={{ marginRight: '0.4rem' }} /> PREVIEW
                            </button>
                            <button 
                                className="btn" 
                                style={{ background: 'var(--accent-color)', color: 'white', fontWeight: 'bold' }}
                                onClick={handleCreateDC}
                                disabled={!selectedBatch || !partyName}
                            >
                                GENERATE & PRINT
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* In-app PDF Preview Modal */}
            {pdfPreviewUrl && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1300,
                    background: 'rgba(2, 6, 23, 0.85)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        height: '64px',
                        padding: '0 1.25rem',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(15, 23, 42, 0.85)'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>{pdfPreviewTitle}</h3>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn"
                                onClick={handlePrintPdf}
                                style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                title="Print PDF"
                            >
                                <IconPrint size="16" /> Print
                            </button>
                            <button
                                className="btn"
                                onClick={closePdfPreview}
                                style={{ padding: '0.45rem 0.8rem' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '0.75rem' }}>
                        <iframe
                            title="Delivery Challan PDF Preview"
                            src={pdfPreviewUrl ? `${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=1` : ''}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: '1px solid rgba(148, 163, 184, 0.35)',
                                borderRadius: '10px',
                                background: '#fff'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveryChallans;
