import React, { useEffect, useState } from 'react';
import { useMobile } from '../context/MobileContext';

const THEME = {
    dark: {
        bg: '#0f172a',
        card: '#1e293b',
        text: '#f8fafc',
        subtext: '#94a3b8',
        border: '#334155',
        accent: '#6366f1',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        btnText: '#ffffff'
    },
    light: {
        bg: '#f1f5f9',
        card: '#ffffff',
        text: '#0f172a',
        subtext: '#64748b',
        border: '#e2e8f0',
        accent: '#4f46e5',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        btnText: '#ffffff'
    }
};

const MissingScans = () => {
    const { api } = useMobile();
    const theme = THEME.dark;
    const [missing, setMissing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState(null);

    const fetchMissing = async () => {
        // Keep loading true only on initial mount to avoid shrinking list on updates
        try {
            const res = await api.get('/api/stats/list/missingCount');
            if (Array.isArray(res.data)) {
                setMissing(res.data);
                setError(null);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            // Don't show full error UI for background fetch failures, 
            // but we could set a transient error state if needed.
            // For now, if initial load fails, we might want to show something.
            if (loading) {
                setError("Failed to load data. Check connection.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMissing();
        const interval = setInterval(fetchMissing, 10000);
        return () => clearInterval(interval);
    }, [api]);

    const handleIgnore = async (barcode) => {
        if (!window.confirm("Verify: Mark roll as DAMAGED/SKIPPED?")) return;
        setProcessingId(barcode);
        try {
            await api.patch(`/api/mobile/missing/damaged/${barcode}`);
            await fetchMissing(); // Immediate refresh
        } catch (err) {
            alert(`Operation Failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleEdit = (barcode) => {
        alert(`To register Roll #${barcode}, please close this menu and use the "Manual Input" feature on the main screen.`);
    };

    if (loading && missing.length === 0 && !error) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
                <div style={{ color: theme.subtext }}>Loading sequence data...</div>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            backgroundColor: theme.bg,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '30px 25px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderBottom: `1px solid ${theme.border}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{
                    width: '45px',
                    height: '45px',
                    backgroundColor: `${theme.accent}20`,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '15px'
                }}>
                    <span style={{ fontSize: '20px' }}>📋</span>
                </div>
                <div>
                    <h2 style={{
                        color: theme.text,
                        fontSize: '20px',
                        fontWeight: '800',
                        margin: 0,
                        letterSpacing: '-0.02em'
                    }}>
                        Sequence Gaps
                    </h2>
                    <p style={{
                        color: theme.subtext,
                        fontSize: '13px',
                        fontWeight: '600',
                        margin: '2px 0 0 0'
                    }}>
                        {missing.length} Missing Entries
                    </p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '16px',
                    backgroundColor: `${theme.error}20`,
                    color: theme.error,
                    fontSize: '14px',
                    textAlign: 'center',
                    fontWeight: '600'
                }}>
                    {error}
                </div>
            )}

            {/* Content List */}
            {missing.length === 0 && !loading && !error ? (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px'
                }}>
                    <div style={{
                        width: '70px',
                        height: '70px',
                        backgroundColor: `${theme.success}20`,
                        borderRadius: '35px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '20px'
                    }}>
                        <span style={{ fontSize: '30px', color: theme.success }}>✓</span>
                    </div>
                    <h3 style={{
                        color: theme.text,
                        fontSize: '18px',
                        fontWeight: '700',
                        marginBottom: '8px'
                    }}>
                        All Clear
                    </h3>
                    <p style={{
                        color: theme.subtext,
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        No sequence interruptions detected.
                    </p>
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {missing.map((item) => (
                        <div key={item.barcode} style={{
                            backgroundColor: theme.card,
                            borderRadius: '16px',
                            padding: '20px',
                            border: `1px solid ${theme.border}`,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            {/* Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        color: theme.accent,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Missing Roll
                                    </span>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: '800',
                                        color: theme.text,
                                        fontFamily: 'monospace',
                                        marginTop: '4px'
                                    }}>
                                        {item.barcode}
                                    </div>
                                </div>
                                <div style={{
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    backgroundColor: `${theme.warning}20`,
                                    color: theme.warning,
                                    fontSize: '11px',
                                    fontWeight: '800'
                                }}>
                                    PENDING
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                paddingTop: '16px',
                                borderTop: `1px solid ${theme.border}`
                            }}>
                                <button
                                    onClick={() => handleEdit(item.barcode)}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${theme.border}`,
                                        color: theme.text,
                                        padding: '12px',
                                        borderRadius: '10px',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span>📝</span> Manual Entry
                                </button>
                                <button
                                    onClick={() => handleIgnore(item.barcode)}
                                    disabled={processingId === item.barcode}
                                    style={{
                                        backgroundColor: processingId === item.barcode ? theme.subtext : theme.card,
                                        border: `1px solid ${theme.error}`,
                                        color: theme.error,
                                        padding: '12px',
                                        borderRadius: '10px',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        cursor: processingId === item.barcode ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <span>✕</span>
                                    {processingId === item.barcode ? 'Saving...' : 'Ignore / Damaged'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MissingScans;
