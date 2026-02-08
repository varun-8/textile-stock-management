import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { io } from "socket.io-client";
import DetailedViewModal from '../components/DetailedViewModal';

// --- Icons ---
const IconBox = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
const IconScan = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>;
const IconSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconCloud = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11.91 4.9" /><path d="M12 13v8" /><path d="m15 18-3 3-3-3" /></svg>;

const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconTrash = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const IconSignal = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 20V4" /></svg>;


const Dashboard = () => {
    const navigate = useNavigate();
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();
    const [showSettings, setShowSettings] = useState(false);
    const [tempIp, setTempIp] = useState(apiUrl);

    const [stats, setStats] = useState([
        { label: 'Total Inventory', value: '0', change: 'System Total', key: 'totalRolls', color: 'var(--text-secondary)', icon: '📦' },
        { label: 'Current Stock', value: '0', change: 'Live Units', key: 'stockIn', color: 'var(--success-color)', icon: '🏭' },
        { label: 'Dispatched', value: '0', change: 'Outbound', key: 'stockOut', color: 'var(--accent-color)', icon: '🚛' },
        { label: 'Missing Logs', value: '0', change: 'Action Required', key: 'missingCount', alert: true, color: 'var(--error-color)', icon: '⚠️' }
    ]);

    const [recentLogs, setRecentLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('LIVE');
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [isTodayOnly, setIsTodayOnly] = useState(false);
    const [sessionStartTime, setSessionStartTime] = useState(null); // Deprecated state kept null
    const [activeSessionCount, setActiveSessionCount] = useState(0);

    // Detailed View Modal State
    const [detailedView, setDetailedView] = useState({ isOpen: false, type: null });

    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const showModal = (type, title, message, onConfirm = null) => {
        setModalConfig({ isOpen: true, type, title, message, onConfirm });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    const getTodayRange = () => {
        const today = new Date().toISOString().split('T')[0];
        return { startDate: today, endDate: today };
    };

    const fetchStats = async () => {
        try {
            let url = `${apiUrl}/api/stats/dashboard`;
            if (isTodayOnly) {
                const { startDate, endDate } = getTodayRange();
                url += `?startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            setStats([
                { label: 'Total Inventory', value: data.totalRolls, change: isTodayOnly ? "Today's Total" : 'All-time Registered', key: 'totalRolls', color: 'var(--text-secondary)', icon: '📦' },
                { label: 'Current Stock', value: data.stockIn, change: isTodayOnly ? "Today's Inflow" : 'Units in Warehouse', key: 'stockIn', color: 'var(--success-color)', icon: '🏭' },
                { label: 'Dispatched', value: data.stockOut, change: isTodayOnly ? "Today's Outflow" : 'Sent to Customers', key: 'stockOut', color: 'var(--accent-color)', icon: '🚛' },
                { label: 'Missing Logs', value: data.missingCount, change: isTodayOnly ? "Today's Gaps" : 'Need Resolution', key: 'missingCount', alert: data.missingCount > 0, color: 'var(--error-color)', icon: '⚠️' }
            ]);
        } catch (err) { console.error(err); }
    };

    const fetchRecentLogs = async () => {
        if (false) { // Deprecated check removed
            setRecentLogs([]);
            return;
        }

        try {
            // Fetch logs for today by default if no range is set and activeTab is LIVE
            // If sessionStartTime was null, we fetched nothing. Now we fetch recent.
            // Using existing API that supports limit=all or date range.
            // Let's use getTodayRange() if no explicit range.

            let url = `${apiUrl}/api/stats/list/recent?limit=50`; // Default to last 50

            // If today view is toggled, force today's range
            if (isTodayOnly) {
                const { startDate, endDate } = getTodayRange();
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }

            // Using sessionStartTime logic was: ?startDate=${sessionStartTime}&limit=all
            // We remove that. Now it's just recent logs.
            const res = await fetch(url);
            const data = await res.json();
            const normalized = data.map(item => ({
                time: new Date(item.updatedAt || item.detectedAt || item.createdAt).toLocaleString(),
                barcode: item.barcode,
                type: item.status || 'UNKNOWN',
                details: { metre: item.metre, weight: item.weight, percentage: item.percentage }
            }));
            setRecentLogs(normalized);
        } catch (err) { console.error(err); }
    };

    const fetchActiveSessions = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sessions/active`);
            const data = await res.json();
            setActiveSessionCount(Array.isArray(data) ? data.length : 0);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchStats();
        fetchActiveSessions();
        if (activeTab === 'LIVE') fetchRecentLogs();

        const socket = io(apiUrl, {
            rejectUnauthorized: false,
            transports: ['websocket', 'polling']
        });
        socket.on('stock_update', (data) => {
            if (activeTab === 'LIVE') { // Removed sessionStartTime check
                const newLog = {
                    time: new Date().toLocaleTimeString(),
                    barcode: data.barcode,
                    type: data.type,
                    details: data.details
                };
                setRecentLogs(prev => [newLog, ...prev]);
            }
            fetchStats();
        });

        socket.on('session_update', () => {
            fetchActiveSessions();
        });

        return () => socket.disconnect();
    }, [apiUrl, activeTab, isTodayOnly, sessionStartTime]);

    useEffect(() => {
        if (activeTab !== 'LIVE') handleCardClick(activeTab);
    }, [startDate, endDate, isTodayOnly]);

    const handleCardClick = async (key) => {
        setActiveTab(key);
        setFilteredLogs([]);

        let url = `${apiUrl}/api/stats/list/${key}`;
        const params = new URLSearchParams();
        if (isTodayOnly) {
            const range = getTodayRange();
            params.append('startDate', range.startDate);
            params.append('endDate', range.endDate);
        } else if (startDate || endDate) {
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        try {
            const res = await fetch(url);
            const data = await res.json();
            const normalized = data.map(item => ({
                time: new Date(item.updatedAt || item.detectedAt || item.createdAt).toLocaleString(),
                barcode: item.barcode,
                type: item.status || (key === 'missingCount' ? 'MISSING' : 'UNKNOWN'),
                details: { metre: item.metre, weight: item.weight, percentage: item.percentage }
            }));
            setFilteredLogs(normalized);
        } catch (err) { console.error(err); }
    };

    const handleCardDoubleClick = (key) => {
        // Only allow detailed view for main inventory types
        if (key === 'totalRolls' || key === 'stockIn' || key === 'stockOut') {
            setDetailedView({ isOpen: true, type: key });
        }
    };

    const handleDelete = async (barcode) => {
        if (!window.confirm("Move this roll back to Missing items?")) return;
        try {
            const res = await fetch(`${apiUrl}/api/mobile/inventory/delete/${barcode}`, { method: 'DELETE' });
            if (res.ok) { handleCardClick(activeTab); fetchStats(); }
        } catch (err) { console.error(err); }
    };

    const handleMarkDamaged = async (barcode) => {
        if (!window.confirm("Mark this barcode as DAMAGED? It will be removed from the missing list and ignored by the system.")) return;
        try {
            const res = await fetch(`${apiUrl}/api/mobile/missing/damaged/${barcode}`, { method: 'PATCH' });
            if (res.ok) { handleCardClick(activeTab); fetchStats(); }
            else { alert("Operation failed."); }
        } catch (err) { console.error(err); }
    };

    const handleSaveEdit = async () => {
        if (!editItem) return;
        try {
            const isMissingResolve = activeTab === 'missingCount';
            const endpoint = isMissingResolve ? `${apiUrl}/api/mobile/transaction` : `${apiUrl}/api/mobile/inventory/update`;
            const method = isMissingResolve ? 'POST' : 'PUT';

            // Standardize payloads
            const payload = {
                barcode: editItem.barcode,
                metre: parseFloat(editItem.details.metre || 0),
                weight: parseFloat(editItem.details.weight || 0),
                percentage: parseFloat(editItem.details.percentage || 100),
                type: editItem.type || 'IN', // For transaction route
                status: editItem.type || 'IN' // For inventory/update route
            };

            if (payload.metre <= 0 || payload.weight <= 0) {
                return alert("Metric Error: Metre and Weight must be positive numbers.");
            }

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                setEditItem(null);
                handleCardClick(activeTab);
                fetchStats();
            } else {
                alert(result.error || "System rejected transaction. Verify data format.");
            }
        } catch (err) {
            console.error(err);
            alert("Network link failed. Verify server connectivity.");
        }
    };

    const displayList = (() => {
        const rawList = activeTab === 'LIVE' ? recentLogs : filteredLogs;
        if (!Array.isArray(rawList)) return [];
        return rawList.filter(log => {
            const term = searchTerm.toLowerCase();
            return log.barcode.toLowerCase().includes(term) || (log.type && log.type.toLowerCase().includes(term));
        });
    })();

    const totals = React.useMemo(() => {
        if (!displayList.length) return { metre: 0, weight: 0 };
        return displayList.reduce((acc, item) => {
            // Only count if it has metre/weight details
            if (item.details) {
                acc.metre += parseFloat(item.details.metre || 0);
                acc.weight += parseFloat(item.details.weight || 0);
            }
            return acc;
        }, { metre: 0, weight: 0 });
    }, [displayList]);

    const downloadCSV = () => {
        if (!displayList.length) return showModal('warning', 'Export Empty', "There is no data to export right now.");
        generateAndDownloadCSV(displayList, `inventory_${activeTab}_${Date.now()}.csv`);
    };

    const generateAndDownloadCSV = (data, filename) => {
        try {
            const headers = ["Timestamp", "Barcode", "Status", "Metre", "Weight", "Quality %"];
            const rows = data.map(item => [
                `"${item.time}"`,
                item.barcode,
                item.type,
                item.details?.metre || 0,
                item.details?.weight || 0,
                item.details?.percentage || 0
            ]);
            const csvContent = "data:text/csv;charset=utf-8,"
                + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            showModal('error', 'Export Failed', 'An error occurred while generating the CSV file.');
        }
    };

    // Legacy Session handlers removed

    return (
        <>
            {/* --- MAIN CONTENT (Native App Feel) --- */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Header (Drag area for Electron) */}
                <header style={{
                    padding: '1rem 2.5rem',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 5
                }} className="app-region-drag">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }} className="app-region-no-drag">
                        <div>
                            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                                {activeTab === 'LIVE' ? 'Real-time Logistics' : 'Inventory Management'}
                            </h1>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.6 }}>SYSTEM OPERATIONAL • {new Date().toDateString().toUpperCase()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setIsTodayOnly(!isTodayOnly)}
                                style={{
                                    background: 'transparent',
                                    color: isTodayOnly ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    border: isTodayOnly ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    padding: '0.4rem 1.2rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: '"Segoe UI", sans-serif',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.02em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <span style={{ fontSize: '1rem' }}>{isTodayOnly ? '●' : '○'}</span>
                                {isTodayOnly ? 'Today\'s View' : 'All History'}
                            </button>
                            <button
                                onClick={downloadCSV}
                                style={{
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    padding: '0.4rem 1.2rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: '"Segoe UI", sans-serif',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.02em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <span style={{ opacity: 0.7 }}>📥</span> Export
                            </button>

                            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.5rem' }}></div>

                            <button
                                onClick={() => navigate('/sessions')}
                                style={{
                                    padding: '0.4rem 1.2rem',
                                    background: activeSessionCount > 0 ? 'var(--accent-bg)' : 'var(--bg-primary)',
                                    border: activeSessionCount > 0 ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: activeSessionCount > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <IconSignal />
                                {activeSessionCount > 0 ? `${activeSessionCount} ACTIVE SESSIONS` : 'NO ACTIVE SESSIONS'}
                            </button>
                            <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }`}</style>
                        </div>
                    </div>

                    <div className="app-region-no-drag" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search inventory databases..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width: '320px',
                                    background: 'var(--bg-primary)',
                                    paddingLeft: '2.8rem',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    height: '42px'
                                }}
                            />
                            <span style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>🔍</span>
                        </div>
                    </div>
                </header>

                {/* Page View with Padded Inset */}
                <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }} className="animate-fade-in native-scroll">

                    {/* Industrial Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                className="panel glass"
                                onClick={() => handleCardClick(stat.key)}
                                onDoubleClick={() => handleCardDoubleClick(stat.key)}
                                title="Double-click for Detailed Analysis & Filters"
                                style={{
                                    cursor: 'pointer',
                                    borderTop: `4px solid ${stat.color}`,
                                    transform: activeTab === stat.key ? 'translateY(-4px)' : 'none',
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    padding: '1.8rem',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                                        <div style={{ fontSize: '3rem', fontWeight: '800', margin: '0.75rem 0', letterSpacing: '-0.03em' }}>{stat.value}</div>
                                    </div>
                                    <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>{stat.icon}</div>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }}></span>
                                    {stat.change}
                                </div>
                                {['totalRolls', 'stockIn', 'stockOut'].includes(stat.key) && (
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0, transition: 'opacity 0.2s', fontSize: '0.7rem' }} className="hover-hint">
                                        Double-click for Details ↗
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <style>{`
                        .panel:hover .hover-hint { opacity: 0.6 !important; }
                    `}</style>

                    {/* Content Table Area */}
                    <div className="panel" style={{ background: 'var(--bg-secondary)', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                                    {activeTab === 'LIVE' ? 'Real-time Operations' : `Inventory: ${activeTab.split('stock').join('').toUpperCase()}`}
                                </h2>

                                {(activeTab === 'stockIn' || activeTab === 'stockOut') && (
                                    <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-primary)', padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.6, letterSpacing: '0.05em' }}>TOTAL LENGTH:</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--success-color)', fontFamily: 'monospace' }}>{totals.metre.toLocaleString()} M</span>
                                        </div>
                                        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.6, letterSpacing: '0.05em' }}>TOTAL WEIGHT:</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent-color)', fontFamily: 'monospace' }}>{totals.weight.toLocaleString()} KG</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ... (date inputs) ... */}

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {activeTab !== 'LIVE' && (
                                    <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: '8px' }}>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '0.4rem' }} />
                                        <span style={{ opacity: 0.3, alignSelf: 'center' }}>|</span>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '0.4rem' }} />
                                    </div>
                                )}
                                {activeTab !== 'LIVE' && (
                                    <button onClick={() => { setActiveTab('LIVE'); setStartDate(''); setEndDate(''); }} className="btn btn-secondary">BACK TO LIVE</button>
                                )}
                            </div>
                        </div>

                        <div style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--table-header-bg)' }}>
                                    <tr>
                                        <th style={thStyle}>TIMESTAMPS</th>
                                        <th style={thStyle}>BARCODE ID</th>
                                        <th style={thStyle}>FLOW STATUS</th>
                                        <th style={thStyle}>METRICS (M/KG)</th>
                                        {(activeTab === 'totalRolls' || activeTab === 'stockIn' || activeTab === 'missingCount') && <th style={{ ...thStyle, textAlign: 'right' }}>CONTROL</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayList.length === 0 ? (
                                        <tr><td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No transactions recorded in this period.</td></tr>
                                    ) : displayList.map((log, i) => {
                                        const isMissing = activeTab === 'missingCount';
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'var(--row-alt-bg)' : 'transparent' }}>
                                                <td style={tdStyle}><span style={{ opacity: 0.8, fontWeight: '500' }}>{log.time}</span></td>
                                                <td style={{ ...tdStyle, fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-color)', fontFamily: 'monospace' }}>{log.barcode}</td>
                                                <td style={tdStyle}>
                                                    <StatusBadge type={log.type} />
                                                </td>
                                                <td style={tdStyle}>
                                                    {log.details?.metre ? (
                                                        <div style={{ display: 'flex', gap: '1.25rem' }}>
                                                            <Metric label="M" value={log.details.metre} />
                                                            <Metric label="KG" value={log.details.weight} />
                                                            <Metric label="Q" value={Number(log.details.percentage).toFixed(2) + '%'} color={Number(log.details.percentage) < 80 ? 'var(--warning-color)' : 'var(--text-secondary)'} />
                                                        </div>
                                                    ) : <span style={{ opacity: 0.4 }}>PENDING REGISTRATION</span>}
                                                </td>
                                                {(activeTab === 'totalRolls' || activeTab === 'stockIn' || activeTab === 'missingCount') && (
                                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => {
                                                                const isInvalidType = log.type === 'MISSING' || log.type === 'PENDING' || !log.type;
                                                                setEditItem({
                                                                    ...log,
                                                                    type: isInvalidType ? 'IN' : (log.type === 'OUT' ? 'OUT' : 'IN'),
                                                                    details: {
                                                                        metre: log.details.metre || '',
                                                                        weight: log.details.weight || '',
                                                                        percentage: log.details.percentage || '100'
                                                                    }
                                                                });
                                                            }}
                                                            className="btn"
                                                            title="Edit"
                                                            style={{
                                                                padding: '8px',
                                                                fontSize: '11px',
                                                                background: 'var(--bg-tertiary)',
                                                                color: isMissing ? 'var(--warning-color)' : 'inherit',
                                                                border: isMissing ? '1px solid var(--warning-color)' : 'none',
                                                                fontWeight: '800',
                                                                borderRadius: '8px',
                                                                minWidth: '36px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <IconEdit />
                                                        </button>
                                                        {activeTab === 'totalRolls' && (
                                                            <button
                                                                onClick={() => handleDelete(log.barcode)}
                                                                className="btn"
                                                                title="Delete"
                                                                style={{
                                                                    padding: '8px',
                                                                    fontSize: '11px',
                                                                    marginLeft: '6px',
                                                                    color: 'var(--error-color)',
                                                                    border: '1px solid var(--error-color)',
                                                                    fontWeight: '700',
                                                                    borderRadius: '8px',
                                                                    minWidth: '36px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        )}
                                                        {activeTab === 'missingCount' && (
                                                            <button onClick={() => handleMarkDamaged(log.barcode)} className="btn" style={{ padding: '8px 16px', fontSize: '11px', marginLeft: '6px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontWeight: '700', borderRadius: '8px' }}>IGNORE</button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                {/* Edit Modal */}
                {
                    editItem && (
                        <div className="panel animate-fade-in" style={{ width: '400px' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Adjust Roll Parameters</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '1.5rem', fontWeight: '700' }}>ROLL ID: {editItem.barcode}</p>

                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                <div>
                                    <label style={labelStyle}>Length (Metres)</label>
                                    <input type="number" value={editItem.details.metre} onChange={e => setEditItem({ ...editItem, details: { ...editItem.details, metre: e.target.value } })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Weight (Kilograms)</label>
                                    <input type="number" value={editItem.details.weight} onChange={e => setEditItem({ ...editItem, details: { ...editItem.details, weight: e.target.value } })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Quality Index (%)</label>
                                    <input type="number" value={editItem.details.percentage} onChange={e => setEditItem({ ...editItem, details: { ...editItem.details, percentage: e.target.value } })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Flow Status</label>
                                    <select
                                        value={editItem.type}
                                        onChange={e => setEditItem({ ...editItem, type: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                    >
                                        <option value="IN">STOCK-IN</option>
                                        <option value="OUT">DISPATCH (OUT)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 1 }}>SAVE CHANGES</button>
                                <button onClick={() => setEditItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>DISCARD</button>
                            </div>
                        </div>
                    )
                }
                {/* Custom Confirmation Modal */}
                {modalConfig.isOpen && (
                    <div style={modalOverlayStyle}>
                        <div className="panel animate-fade-in" style={{ width: '400px', borderTop: `4px solid ${modalConfig.type === 'error' ? 'var(--error-color)' : (modalConfig.type === 'success' ? 'var(--success-color)' : 'var(--accent-color)')}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        color: modalConfig.type === 'error' ? 'var(--error-color)' : (modalConfig.type === 'success' ? 'var(--success-color)' : 'var(--accent-color)')
                                    }}>
                                        {modalConfig.type === 'error' ? '⚠️' : (modalConfig.type === 'success' ? '✅' : 'ℹ️')}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>{modalConfig.title}</h3>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                                    {modalConfig.message}
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                    {modalConfig.type === 'confirm' ? (
                                        <>
                                            <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
                                            <button onClick={() => { modalConfig.onConfirm(); closeModal(); }} className="btn btn-primary">Confirm</button>
                                        </>
                                    ) : (
                                        <button onClick={closeModal} className="btn btn-secondary" style={{ width: '100%' }}>Close</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div >

            {/* Detailed View Modal Integration */}
            <DetailedViewModal
                isOpen={detailedView.isOpen}
                onClose={() => setDetailedView({ ...detailedView, isOpen: false })}
                type={detailedView.type}
                apiUrl={apiUrl}
            />
        </>
    );
};

// --- Sub-components ---

const StatusBadge = ({ type }) => {
    const isSuccess = type === 'IN' || type === 'RESOLVED';
    const isOut = type === 'OUT';
    return (
        <span style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
            background: isSuccess ? 'var(--success-bg)' : (isOut ? 'rgba(99, 102, 241, 0.1)' : 'var(--error-bg)'),
            color: isSuccess ? 'var(--success-color)' : (isOut ? 'var(--accent-color)' : 'var(--error-color)'),
            border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}`
        }}>
            {type === 'IN' ? 'STOCK-IN' : (type === 'OUT' ? 'DISPATCH' : type)}
        </span>
    );
};

const Metric = ({ label, value, color }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: '2px', background: 'var(--bg-primary)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '80px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: '1.2rem', fontWeight: '800', color: color || 'inherit', fontFamily: 'monospace' }}>{value}</span>
    </div>
);

// --- Styles ---
const thStyle = { padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' };
const tdStyle = { padding: '1rem 2rem', fontSize: '1.05rem', fontWeight: '500' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 };

export default Dashboard;
