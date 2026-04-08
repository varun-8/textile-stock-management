import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';
import { useNotification } from '../context/NotificationContext';
import { IconEye, IconPlus, IconTruck, IconX, IconEdit } from '../components/Icons';
import { DENSITY_NAME } from '../constants';
import { generateQuotationPdf } from '../utils/pdfGenerator';

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

const emptyForm = {
    id: '',
    partyName: '',
    partyAddress: '',
    validityDate: '',
    density: '',
    notes: '',
    terms: ''
};

const Quotations = () => {
    const { apiUrl } = useConfig();
    const { showNotification } = useNotification();

    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [availableRolls, setAvailableRolls] = useState([]);
    const [selectedBarcodes, setSelectedBarcodes] = useState([]);
    const [loadingRolls, setLoadingRolls] = useState(false);
    const [densities, setDensities] = useState([]);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfPreviewTitle, setPdfPreviewTitle] = useState('Quotation PDF Preview');
    const [dcTemplateConfig, setDcTemplateConfig] = useState(null);
    const [expandedActionsId, setExpandedActionsId] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const token = localStorage.getItem('ADMIN_TOKEN');
    const authHeaders = useMemo(() => ({
        headers: { Authorization: `Bearer ${token}` }
    }), [token]);

    const activeTemplate = useMemo(() => ({
        ...DEFAULT_DC_TEMPLATE,
        ...(dcTemplateConfig || {})
    }), [dcTemplateConfig]);

    const isEditMode = !!form.id;
    const totalRolls = selectedBarcodes.length;
    const simpleFieldStyle = {
        width: '100%',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-primary)',
        padding: '0.65rem 0.8rem',
        fontSize: '0.88rem'
    };
    const simpleLabelStyle = {
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '0.4rem'
    };
    const fieldErrorStyle = {
        marginTop: '0.35rem',
        color: 'var(--error-color)',
        fontSize: '0.76rem'
    };

    const getApiErrorMessage = (error, fallbackMessage) => {
        if (typeof error?.response?.data?.error === 'string' && error.response.data.error.trim()) {
            return error.response.data.error.trim();
        }
        if (typeof error?.response?.data?.message === 'string' && error.response.data.message.trim()) {
            return error.response.data.message.trim();
        }
        if (typeof error?.message === 'string' && error.message.trim()) {
            return error.message.trim();
        }
        return fallbackMessage;
    };

    const validateQuotationForm = () => {
        const errors = {};
        if (!form.partyName.trim()) {
            errors.partyName = 'Party Name is required.';
        }
        if (!form.density) {
            errors.density = `Please select ${DENSITY_NAME}.`;
        }
        if (selectedBarcodes.length === 0) {
            errors.rollSelection = 'Select at least one roll to continue.';
        }
        return errors;
    };

    useEffect(() => {
        fetchQuotations();
        fetchDensities();
        fetchDcTemplateConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) {
                try {
                    URL.revokeObjectURL(pdfPreviewUrl);
                } catch (_) {}
            }
        };
    }, [pdfPreviewUrl]);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${apiUrl}/api/quotations`, authHeaders);
            setQuotations(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch quotations:', error);
            showNotification('Failed to load quotations', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchDensities = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/sizes`);
            const values = (Array.isArray(res.data) ? res.data : [])
                .map((item) => String(item?.code || '').trim())
                .filter(Boolean);
            setDensities(values);
        } catch (error) {
            console.error('Failed to fetch densities:', error);
        }
    };

    const fetchDcTemplateConfig = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/admin/config/dc-template`, authHeaders);
            setDcTemplateConfig(res.data || null);
        } catch (error) {
            console.error('Failed to fetch DC template config:', error);
        }
    };

    const fetchAvailableRolls = async (densityValue, preservedSelection = []) => {
        if (!densityValue) {
            setAvailableRolls([]);
            setSelectedBarcodes([]);
            return;
        }

        try {
            setLoadingRolls(true);
            const res = await axios.get(`${apiUrl}/api/quotations/available-rolls?density=${encodeURIComponent(densityValue)}`, authHeaders);
            const rows = Array.isArray(res.data?.rolls) ? res.data.rolls : [];
            setAvailableRolls(rows);

            if (Array.isArray(preservedSelection) && preservedSelection.length > 0) {
                const allowed = new Set(rows.map((roll) => roll.barcode));
                setSelectedBarcodes(preservedSelection.filter((barcode) => allowed.has(barcode)));
            } else {
                setSelectedBarcodes([]);
            }
        } catch (error) {
            console.error('Failed to fetch rolls by density:', error);
            setAvailableRolls([]);
            setSelectedBarcodes([]);
            showNotification(error.response?.data?.error || `Failed to load available rolls for selected ${DENSITY_NAME}`, 'error');
        } finally {
            setLoadingRolls(false);
        }
    };

    const openCreateModal = async () => {
        setForm(emptyForm);
        setAvailableRolls([]);
        setSelectedBarcodes([]);
        setFormErrors({});
        setSubmitError('');
        setIsModalOpen(true);
        await Promise.all([fetchDensities(), fetchDcTemplateConfig()]);
    };

    const openEditModal = async (quotation) => {
        const selected = Array.isArray(quotation.rolls) && quotation.rolls.length > 0
            ? quotation.rolls.map((roll) => roll.barcode)
            : (Array.isArray(quotation.rollSnapshots) ? quotation.rollSnapshots.map((roll) => roll.barcode) : []);

        setForm({
            id: quotation._id,
            partyName: quotation.partyName || '',
            partyAddress: quotation.partyAddress || '',
            validityDate: quotation.validityDate ? new Date(quotation.validityDate).toISOString().slice(0, 10) : '',
            density: quotation.density || '',
            notes: quotation.notes || '',
            terms: quotation.terms || ''
        });
        setFormErrors({});
        setSubmitError('');
        setIsModalOpen(true);
        await Promise.all([
            fetchDensities(),
            fetchDcTemplateConfig(),
            fetchAvailableRolls(quotation.density || '', selected)
        ]);
    };

    const closeModal = () => {
        setForm(emptyForm);
        setAvailableRolls([]);
        setSelectedBarcodes([]);
        setFormErrors({});
        setSubmitError('');
        setIsSubmitting(false);
        setIsModalOpen(false);
    };

    const toggleBarcodeSelection = (barcode) => {
        setSelectedBarcodes((prev) => {
            if (prev.includes(barcode)) {
                return prev.filter((item) => item !== barcode);
            }
            return [...prev, barcode];
        });

        setFormErrors((prev) => {
            if (!prev.rollSelection) {
                return prev;
            }
            const next = { ...prev };
            delete next.rollSelection;
            return next;
        });
    };

    const updateFormField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setFormErrors((prev) => {
            if (!prev[field]) {
                return prev;
            }
            const next = { ...prev };
            delete next[field];
            return next;
        });
        if (submitError) {
            setSubmitError('');
        }
    };

    const handleDensityChange = async (value) => {
        updateFormField('density', value);
        await fetchAvailableRolls(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) {
            return;
        }

        const validationErrors = validateQuotationForm();
        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            showNotification(Object.values(validationErrors)[0], 'error');
            return;
        }

        setSubmitError('');
        setIsSubmitting(true);

        const payload = {
            partyName: form.partyName.trim(),
            partyAddress: form.partyAddress.trim(),
            validityDate: form.validityDate || null,
            density: form.density,
            barcodes: selectedBarcodes,
            notes: form.notes,
            terms: form.terms,
            templateId: typeof dcTemplateConfig?.templateId === 'string' ? dcTemplateConfig.templateId : '',
            templateName: typeof dcTemplateConfig?.templateName === 'string' ? dcTemplateConfig.templateName : '',
            templateSnapshot: activeTemplate
        };

        try {
            let res;
            if (isEditMode) {
                res = await axios.put(`${apiUrl}/api/quotations/${form.id}`, payload, authHeaders);
                showNotification(`Quotation ${res.data?.quotation?.quotationNumber || ''} updated successfully`, 'success');
            } else {
                res = await axios.post(`${apiUrl}/api/quotations`, payload, authHeaders);
                showNotification(`Quotation ${res.data?.quotation?.quotationNumber || ''} created successfully`, 'success');
            }

            const quotation = res.data?.quotation;
            if (quotation) {
                const rows = Array.isArray(quotation.rolls) ? quotation.rolls : [];
                const pdfUrl = generateQuotationPdf(quotation, rows, quotation.templateSnapshot || activeTemplate, { mode: 'bloburl' });
                if (pdfUrl) {
                    if (pdfPreviewUrl) {
                        try {
                            URL.revokeObjectURL(pdfPreviewUrl);
                        } catch (_) {}
                    }
                    setPdfPreviewTitle(`Quotation ${quotation.quotationNumber} Preview`);
                    setPdfPreviewUrl(pdfUrl);
                }

                if (window.electronAPI?.printOrSavePdf) {
                    try {
                        const pdfBlob = generateQuotationPdf(quotation, rows, quotation.templateSnapshot || activeTemplate, { mode: 'blob' });
                        if (pdfBlob) {
                            const bytes = Array.from(new Uint8Array(await pdfBlob.arrayBuffer()));
                            const filename = `${String(quotation.quotationNumber || 'Quotation').replace(/\s+/g, '_')}.pdf`;
                            await window.electronAPI.printOrSavePdf(filename, bytes);
                        }
                    } catch (printError) {
                        console.error('PDF save/print failed:', printError);
                        showNotification('Quotation saved, but PDF save failed.', 'error');
                    }
                }
            }

            closeModal();
            await fetchQuotations();
        } catch (error) {
            console.error('Failed to save quotation:', error);
            const message = getApiErrorMessage(error, 'Failed to save quotation');
            setSubmitError(message);
            showNotification(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewPdf = async (quotation) => {
        const rows = Array.isArray(quotation.rolls) && quotation.rolls.length > 0
            ? quotation.rolls
            : (Array.isArray(quotation.rollSnapshots) ? quotation.rollSnapshots.map((r) => ({
                barcode: r.barcode,
                metre: r.metre,
                weight: r.weight,
                pieces: new Array(Number(r.pieces || 1)).fill({ length: 0 })
            })) : []);

        const pdfUrl = generateQuotationPdf(
            quotation,
            rows,
            quotation.templateSnapshot || activeTemplate,
            { mode: 'bloburl' }
        );

        if (!pdfUrl) {
            showNotification('Unable to generate quotation PDF', 'error');
            return;
        }

        if (pdfPreviewUrl) {
            try {
                URL.revokeObjectURL(pdfPreviewUrl);
            } catch (_) {}
        }

        setPdfPreviewTitle(`Quotation ${quotation.quotationNumber} Preview`);
        setPdfPreviewUrl(pdfUrl);
    };

    const handleCancelQuotation = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this quotation?')) {
            return;
        }

        try {
            await axios.post(`${apiUrl}/api/quotations/${id}/cancel`, {}, authHeaders);
            showNotification('Quotation cancelled successfully', 'success');
            fetchQuotations();
        } catch (error) {
            console.error('Failed to cancel quotation:', error);
            showNotification(error.response?.data?.error || 'Failed to cancel quotation', 'error');
        }
    };

    const closePdfPreview = () => {
        if (pdfPreviewUrl) {
            try {
                URL.revokeObjectURL(pdfPreviewUrl);
            } catch (_) {}
        }
        setPdfPreviewUrl('');
        setPdfPreviewTitle('Quotation PDF Preview');
    };

    const toggleRowActions = (id) => {
        setExpandedActionsId((prev) => (prev === id ? '' : id));
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <header style={{
                padding: '1.5rem 2rem',
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Quotations</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                        Create and manage quotations by {DENSITY_NAME} with automatic roll totals.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    style={{
                        background: 'var(--accent-color)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '8px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                    }}
                >
                    <IconPlus size="18" /> CREATE QUOTATION
                </button>
            </header>

            <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                <div className="card">
                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <IconTruck size="18" /> Quotation History
                    </h2>

                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading quotations...</div>
                    ) : quotations.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No quotations generated yet.
                        </div>
                    ) : (
                        <div className="table-container" style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: 'var(--bg-secondary)',
                            boxShadow: '0 10px 22px rgba(2, 6, 23, 0.12)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '17%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '24%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '15%' }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: 'var(--table-header-bg)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>QUOTATION NO.</th>
                                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>DATE</th>
                                        <th style={{ textAlign: 'left', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>PARTY</th>
                                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{DENSITY_NAME}</th>
                                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>TOTAL ROLLS</th>
                                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>STATUS</th>
                                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotations.map((quotation, index) => {
                                        const isCancelled = quotation.status === 'CANCELLED';
                                        const isActionsExpanded = expandedActionsId === quotation._id;
                                        return (
                                            <tr key={quotation._id} style={{
                                                opacity: isCancelled ? 0.65 : 1,
                                                background: index % 2 === 0 ? 'transparent' : 'var(--row-alt-bg)'
                                            }}>
                                                <td style={{
                                                    fontWeight: '700',
                                                    padding: '0.9rem 1rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    borderTop: '1px solid var(--table-border-color)'
                                                }}>
                                                    {quotation.quotationNumber}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '0.9rem 1rem', whiteSpace: 'nowrap', borderTop: '1px solid var(--table-border-color)' }}>{new Date(quotation.createdAt).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderTop: '1px solid var(--table-border-color)' }} title={quotation.partyName}>{quotation.partyName}</td>
                                                <td style={{ textAlign: 'center', padding: '0.9rem 1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderTop: '1px solid var(--table-border-color)' }} title={quotation.density}>{quotation.density}</td>
                                                <td style={{ fontWeight: '700', textAlign: 'center', padding: '0.9rem 1rem', borderTop: '1px solid var(--table-border-color)' }}>{quotation.totalRolls}</td>
                                                <td style={{ textAlign: 'center', padding: '0.9rem 1rem', borderTop: '1px solid var(--table-border-color)' }}>
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
                                                        background: isCancelled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: isCancelled ? 'var(--error-color)' : 'var(--success-color)',
                                                        border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`
                                                    }}>
                                                        {quotation.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.9rem 1rem', borderTop: '1px solid var(--table-border-color)' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                                                        <button
                                                            className="btn"
                                                            onClick={() => toggleRowActions(quotation._id)}
                                                            style={{
                                                                minWidth: '88px',
                                                                padding: '0.4rem 0.7rem',
                                                                fontSize: '0.8rem',
                                                                background: 'var(--bg-tertiary)',
                                                                color: 'var(--text-primary)',
                                                                border: '1px solid var(--border-color)'
                                                            }}
                                                        >
                                                            {isActionsExpanded ? 'Hide' : 'Show'}
                                                        </button>

                                                        {isActionsExpanded && (
                                                            <div style={{
                                                                display: 'flex',
                                                                justifyContent: 'center',
                                                                gap: '0.35rem',
                                                                flexWrap: 'wrap',
                                                                padding: '0.35rem',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '8px',
                                                                background: 'var(--bg-primary)'
                                                            }}>
                                                                <button className="btn" onClick={() => handleViewPdf(quotation)} style={{ minWidth: '78px', padding: '0.42rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                                                    <IconEye size="14" /> View PDF
                                                                </button>
                                                                {!isCancelled && (
                                                                    <button className="btn" onClick={() => openEditModal(quotation)} style={{ minWidth: '64px', padding: '0.42rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                                                        <IconEdit size="14" /> Edit
                                                                    </button>
                                                                )}
                                                                {!isCancelled && (
                                                                    <button className="btn" onClick={() => handleCancelQuotation(quotation._id)} style={{ minWidth: '70px', padding: '0.42rem 0.55rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)' }}>
                                                                        Cancel
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
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

            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.62)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '1180px',
                        height: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        boxShadow: '0 30px 56px rgba(2, 6, 23, 0.45)'
                    }}>
                        <div style={{
                            padding: '1.1rem 1.5rem',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.14), rgba(99, 102, 241, 0.02))'
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.15rem', letterSpacing: '0.02em' }}>{isEditMode ? 'Edit Quotation' : 'Create Quotation'}</h2>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Fill customer details and pick available rolls to generate a clean quotation.
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    width: '34px',
                                    height: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <IconX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            <div style={{
                                width: '390px',
                                padding: '1.5rem',
                                borderRight: '1px solid var(--border-color)',
                                overflowY: 'auto',
                                background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))'
                            }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Customer Details</h3>
                                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Required fields are marked with *
                                    </p>
                                </div>

                                {submitError && (
                                    <div style={{
                                        marginBottom: '0.95rem',
                                        padding: '0.6rem 0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(239, 68, 68, 0.45)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: 'var(--error-color)',
                                        fontSize: '0.82rem'
                                    }}>
                                        {submitError}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label style={simpleLabelStyle}>Party Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={form.partyName}
                                        onChange={(e) => updateFormField('partyName', e.target.value)}
                                        placeholder="Customer Name"
                                        style={{
                                            ...simpleFieldStyle,
                                            borderColor: formErrors.partyName ? 'var(--error-color)' : 'var(--border-color)'
                                        }}
                                    />
                                    {formErrors.partyName && <div style={fieldErrorStyle}>{formErrors.partyName}</div>}
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label style={simpleLabelStyle}>Party Address</label>
                                    <textarea
                                        className="input"
                                        rows={2}
                                        value={form.partyAddress}
                                        onChange={(e) => updateFormField('partyAddress', e.target.value)}
                                        placeholder="Customer Address"
                                        style={{ ...simpleFieldStyle, resize: 'vertical', minHeight: '72px' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label style={simpleLabelStyle}>{DENSITY_NAME} *</label>
                                        <select
                                            className="input"
                                            value={form.density}
                                            onChange={(e) => handleDensityChange(e.target.value)}
                                            style={{
                                                ...simpleFieldStyle,
                                                borderColor: formErrors.density ? 'var(--error-color)' : 'var(--border-color)'
                                            }}
                                        >
                                            <option value="">Select {DENSITY_NAME}</option>
                                            {densities.map((density) => (
                                                <option key={density} value={density}>{density}</option>
                                            ))}
                                        </select>
                                        {formErrors.density && <div style={fieldErrorStyle}>{formErrors.density}</div>}
                                    </div>

                                    <div className="form-group">
                                        <label style={simpleLabelStyle}>Validity Date</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={form.validityDate}
                                            onChange={(e) => updateFormField('validityDate', e.target.value)}
                                            style={simpleFieldStyle}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label style={simpleLabelStyle}>Notes</label>
                                    <textarea
                                        className="input"
                                        rows={2}
                                        value={form.notes}
                                        onChange={(e) => updateFormField('notes', e.target.value)}
                                        placeholder="Optional notes"
                                        style={{ ...simpleFieldStyle, resize: 'vertical', minHeight: '72px' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label style={simpleLabelStyle}>Terms</label>
                                    <textarea
                                        className="input"
                                        rows={2}
                                        value={form.terms}
                                        onChange={(e) => updateFormField('terms', e.target.value)}
                                        placeholder="Optional terms"
                                        style={{ ...simpleFieldStyle, resize: 'vertical', minHeight: '72px' }}
                                    />
                                </div>

                                <div style={{
                                    marginTop: '1.25rem',
                                    padding: '1rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    background: 'rgba(99, 102, 241, 0.08)'
                                }}>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>QUOTATION SNAPSHOT</div>
                                    <div style={{ fontWeight: '700', marginTop: '0.35rem' }}>{form.density || `Select ${DENSITY_NAME}`}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.9rem' }}>
                                        <div style={{ padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Available</div>
                                            <div style={{ marginTop: '0.15rem', fontWeight: '700' }}>{availableRolls.length}</div>
                                        </div>
                                        <div style={{ padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Selected</div>
                                            <div style={{ marginTop: '0.15rem', fontWeight: '700' }}>{totalRolls}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                flex: 1,
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                background: 'var(--bg-primary)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.95rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.03em' }}>Available Rolls</h3>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            Choose rolls to include in this quotation.
                                        </p>
                                        {formErrors.rollSelection && <div style={fieldErrorStyle}>{formErrors.rollSelection}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn"
                                            onClick={() => {
                                                setSelectedBarcodes(availableRolls.map((roll) => roll.barcode));
                                                setFormErrors((prev) => {
                                                    if (!prev.rollSelection) {
                                                        return prev;
                                                    }
                                                    const next = { ...prev };
                                                    delete next.rollSelection;
                                                    return next;
                                                });
                                            }}
                                            disabled={availableRolls.length === 0}
                                            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            className="btn"
                                            onClick={() => {
                                                setSelectedBarcodes([]);
                                                setFormErrors((prev) => {
                                                    if (!prev.rollSelection) {
                                                        return prev;
                                                    }
                                                    const next = { ...prev };
                                                    delete next.rollSelection;
                                                    return next;
                                                });
                                            }}
                                            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    flex: 1,
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    overflow: 'auto',
                                    background: 'var(--bg-secondary)',
                                    boxShadow: 'inset 0 1px 0 rgba(148, 163, 184, 0.08)'
                                }}>
                                    {!form.density ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            Select {DENSITY_NAME} to load available rolls.
                                        </div>
                                    ) : loadingRolls ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rolls...</div>
                                    ) : availableRolls.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No rolls available for selected {DENSITY_NAME}.
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--table-header-bg)' }}>
                                                    <th style={{ textAlign: 'left', padding: '0.78rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', letterSpacing: '0.05em' }}>SELECT</th>
                                                    <th style={{ textAlign: 'left', padding: '0.78rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', letterSpacing: '0.05em' }}>BARCODE</th>
                                                    <th style={{ textAlign: 'right', padding: '0.78rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', letterSpacing: '0.05em' }}>METRE</th>
                                                    <th style={{ textAlign: 'right', padding: '0.78rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', letterSpacing: '0.05em' }}>WEIGHT</th>
                                                    <th style={{ textAlign: 'right', padding: '0.78rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', letterSpacing: '0.05em' }}>PIECES</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {availableRolls.map((roll, idx) => {
                                                    const checked = selectedBarcodes.includes(roll.barcode);
                                                    const pieceCount = Array.isArray(roll.pieces) ? roll.pieces.length : 1;
                                                    return (
                                                        <tr key={roll._id || roll.barcode} style={{ background: checked ? 'rgba(99, 102, 241, 0.13)' : (idx % 2 === 0 ? 'transparent' : 'var(--row-alt-bg)') }}>
                                                            <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleBarcodeSelection(roll.barcode)}
                                                                    style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.83rem' }}>{roll.barcode}</td>
                                                            <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{Number(roll.metre || 0).toFixed(2)}</td>
                                                            <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{Number(roll.weight || 0).toFixed(2)}</td>
                                                            <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{pieceCount}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(0deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.01))'
                        }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                                Total Rolls auto-calculated from selected {DENSITY_NAME}: <strong style={{ color: 'var(--text-primary)' }}>{totalRolls}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn" type="button" onClick={closeModal} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>Cancel</button>
                                <button
                                    className="btn"
                                    type="submit"
                                    style={{ background: 'var(--accent-color)', color: 'white', fontWeight: '700', minWidth: '178px', boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)', opacity: isSubmitting ? 0.7 : 1 }}
                                    disabled={isSubmitting || !form.partyName || !form.density || selectedBarcodes.length === 0}
                                >
                                    {isSubmitting ? 'SAVING...' : (isEditMode ? 'UPDATE QUOTATION' : 'CREATE QUOTATION')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        <button className="btn" onClick={closePdfPreview}>Close</button>
                    </div>

                    <div style={{ flex: 1, padding: '0.75rem' }}>
                        <iframe
                            title="Quotation PDF Preview"
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

export default Quotations;
