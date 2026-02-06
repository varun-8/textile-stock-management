import React, { useState, useEffect, useMemo } from 'react';

const DetailedViewModal = ({ isOpen, onClose, type, apiUrl }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sizes, setSizes] = useState([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        articleSize: ''
    });

    // Reset filters when modal opens/closes or type changes
    useEffect(() => {
        if (isOpen) {
            setFilters({ startDate: '', endDate: '', articleSize: '' });
            fetchData();
        } else {
            setData([]);
        }
    }, [isOpen, type]);

    // Fetch data when filters change
    useEffect(() => {
        if (isOpen) fetchData();
    }, [filters, isOpen]);

    // Fetch sizes on mount
    useEffect(() => {
        const fetchSizes = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/sizes`);
                const data = await res.json();
                setSizes(data);
            } catch (err) { console.error("Failed to fetch sizes", err); }
        };
        fetchSizes();
    }, [apiUrl]);

    const fetchData = async () => {
        if (!type) return;
        setLoading(true);
        try {
            let url = `${apiUrl}/api/stats/list/${type}?limit=all`;
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.articleSize) params.append('articleSize', filters.articleSize);

            const queryString = params.toString();
            if (queryString) {
                url += `&${queryString}`;
            }

            const res = await fetch(url);
            const result = await res.json();

            // Normalize result
            const normalized = result.map(item => ({
                time: new Date(item.updatedAt || item.detectedAt || item.createdAt).toLocaleString(),
                dateObj: new Date(item.updatedAt || item.detectedAt || item.createdAt),
                barcode: item.barcode,
                type: item.status || (type === 'missingCount' ? 'MISSING' : 'UNKNOWN'),
                details: {
                    metre: parseFloat(item.metre || 0),
                    weight: parseFloat(item.weight || 0),
                    percentage: item.percentage
                }
            }));

            setData(normalized);
        } catch (err) {
            console.error("Failed to fetch detailed data", err);
        } finally {
            setLoading(false);
        }
    };

    const summary = useMemo(() => {
        return data.reduce((acc, item) => ({
            totalCount: acc.totalCount + 1,
            totalMetre: acc.totalMetre + (item.details.metre || 0),
            totalWeight: acc.totalWeight + (item.details.weight || 0)
        }), { totalCount: 0, totalMetre: 0, totalWeight: 0 });
    }, [data]);

    const handleExport = () => {
        if (!data.length) return alert("No data to export");

        try {
            const headers = ["Timestamp", "Barcode", "Status", "Metre", "Weight", "Quality %"];
            const rows = data.map(item => [
                `"${item.time}"`,
                item.barcode,
                item.type,
                item.details.metre,
                item.details.weight,
                item.details.percentage || ''
            ]);

            const csvContent = "data:text/csv;charset=utf-8,"
                + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Detailed_Report_${type}_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed");
        }
    };

    if (!isOpen) return null;

    // --- Dynamic Styles for Overlay ---
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(9, 9, 11, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
    };

    const modalStyle = {
        background: 'var(--bg-primary)',
        width: '95%', maxWidth: '1200px', height: '90vh',
        borderRadius: '24px',
        boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    };

    const headerStyle = {
        padding: '1.5rem 2.5rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-secondary)'
    };

    // Color theme based on type
    const themeColor = type === 'stockIn' ? 'var(--success-color)' :
        type === 'stockOut' ? 'var(--accent-color)' :
            'var(--text-primary)';

    return (
        <div style={overlayStyle} onClick={onClose}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .metric-card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1); }
            `}</style>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>

                {/* --- Header --- */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: `${themeColor}15`, color: themeColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem'
                        }}>
                            {type === 'stockIn' ? '📥' : type === 'stockOut' ? '🚛' : '📦'}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                                {type === 'totalRolls' ? 'Total Inventory Portfolio' :
                                    type === 'stockIn' ? 'Inbound Stock Analysis' :
                                        type === 'stockOut' ? 'Outbound Dispatch Logs' : 'Detailed View'}
                            </h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
                                Advanced data breakdown and operational metrics
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--bg-tertiary)', border: 'none',
                            width: '36px', height: '36px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'var(--error-bg)'; e.currentTarget.style.color = 'var(--error-color)' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                        ✕
                    </button>
                </div>

                {/* --- Toolbar & Metrics --- */}
                <div style={{ padding: '2rem 2.5rem', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Top Row: Metrics Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        <MetricCard
                            label="Total Rolls"
                            value={summary.totalCount}
                            sub="Count"
                            icon="📦"
                            color="var(--text-primary)"
                        />
                        <MetricCard
                            label="Total Length"
                            value={summary.totalMetre.toLocaleString()}
                            unit="M"
                            sub="Aggregated"
                            icon="📏"
                            color="#10b981"
                            bg="rgba(16, 185, 129, 0.05)"
                        />
                        <MetricCard
                            label="Total Weight"
                            value={summary.totalWeight.toLocaleString()}
                            unit="KG"
                            sub="Aggregated"
                            icon="⚖️"
                            color="#6366f1"
                            bg="rgba(99, 102, 241, 0.05)"
                        />
                    </div>

                    {/* Bottom Row: Filters & Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Time Period</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'inherit', fontWeight: '600' }}
                                    />
                                    <span style={{ opacity: 0.3 }}>→</span>
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'inherit', fontWeight: '600' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Filter Size</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                                    <select
                                        value={filters.articleSize}
                                        onChange={e => setFilters({ ...filters, articleSize: e.target.value })}
                                        style={{
                                            padding: '8px 12px 8px 32px', borderRadius: '10px', border: '1px solid var(--border-color)',
                                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', width: '120px', fontSize: '0.9rem', fontWeight: '600'
                                        }}
                                    >
                                        <option value="">All</option>
                                        {sizes.map(s => <option key={s._id} value={s.code}>{s.code}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleExport}
                            style={{
                                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                                border: 'none', padding: '0.8rem 1.5rem', borderRadius: '10px',
                                fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'all 0.2s',
                                fontFamily: 'inherit'
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <span>📥</span> Export Report
                        </button>
                    </div>
                </div>

                {/* --- Data Table --- */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem' }}>
                            <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Processing Inventory Data...</p>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                <tr>
                                    <th style={thStyle}>TIMESTAMP</th>
                                    <th style={thStyle}>BARCODE ID</th>
                                    <th style={thStyle}>SIZE</th>
                                    <th style={thStyle}>STATUS</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>LENGTH (M)</th>
                                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '2.5rem' }}>WEIGHT (KG)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr><td colSpan="6" style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</div>
                                        No records found for the selected criteria.
                                    </td></tr>
                                ) : data.map((row, i) => {
                                    const sizePart = row.barcode.split('-')[1] || '-';
                                    return (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid var(--border-color)',
                                            background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                            transition: 'background 0.2s'
                                        }} className="table-row-hover">
                                            <td style={tdStyle}><span style={{ opacity: 0.7, fontFamily: 'monospace' }}>{row.time}</span></td>
                                            <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)', fontSize: '1rem' }}>{row.barcode}</span></td>
                                            <td style={tdStyle}><span style={{ background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{sizePart}</span></td>
                                            <td style={tdStyle}>
                                                <StatusChip type={row.type} />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem', fontWeight: '600', color: 'var(--success-color)' }}>{row.details.metre.toFixed(2)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: '2.5rem', fontFamily: 'monospace', fontSize: '1rem', fontWeight: '600', color: 'var(--accent-color)' }}>{row.details.weight.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Styled Sub-components ---

const MetricCard = ({ label, value, unit, sub, icon, color, bg }) => (
    <div className="metric-card-hover" style={{
        background: bg || 'var(--bg-tertiary)',
        border: '1px solid transparent',
        borderColor: bg ? 'transparent' : 'var(--border-color)',
        padding: '1.5rem',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{
                fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase',
                color: color || 'var(--text-primary)', opacity: 0.8, letterSpacing: '0.05em'
            }}>{label}</span>
            <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>{icon}</span>
        </div>
        <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: '800', color: color || 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
                {unit && <span style={{ fontSize: '1rem', fontWeight: '700', color: color || 'var(--text-primary)', opacity: 0.6 }}>{unit}</span>}
            </div>
            {sub && <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.5, fontWeight: '600' }}>{sub}</div>}
        </div>
    </div>
);

const StatusChip = ({ type }) => {
    const styleMap = {
        IN: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', label: 'STOCK-IN' },
        OUT: { bg: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)', label: 'DISPATCHED' },
        MISSING: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', label: 'MISSING' },
        UNKNOWN: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', label: 'UNKNOWN' }
    };
    const conf = styleMap[type] || styleMap.UNKNOWN;
    return (
        <span style={{
            padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800',
            background: conf.bg, color: conf.color, letterSpacing: '0.02em',
            display: 'inline-block', minWidth: '80px', textAlign: 'center'
        }}>
            {conf.label}
        </span>
    );
};

const thStyle = {
    padding: '1.2rem 1.5rem', textAlign: 'left', fontWeight: '800', fontSize: '0.75rem',
    color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase'
};
const tdStyle = {
    padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)'
};

export default DetailedViewModal;
