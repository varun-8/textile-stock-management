import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Ensure this is imported for autoTable

const Reports = () => {
    const { apiUrl } = useConfig();
    const [reportType, setReportType] = useState('IN'); // IN, OUT, ALL
    const [dateRange, setDateRange] = useState('TODAY'); // TODAY, CUSTOM
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [format, setFormat] = useState('DETAILED'); // SUMMARY, DETAILED
    const [previewData, setPreviewData] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Initial Date Setup
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            let url = `${apiUrl}/api/reports?type=${reportType}&format=${format}`;

            if (dateRange === 'TODAY') {
                const today = new Date().toISOString().split('T')[0];
                url += `&startDate=${today}&endDate=${today}`;
            } else {
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (format === 'SUMMARY') {
                setSummaryData(data);
                setPreviewData([]);
            } else {
                setPreviewData(data);
                setSummaryData(null);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text("SRI LAKSHMI TEXTILES", 14, 20);

        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text(`${reportType === 'ALL' ? 'FULL' : reportType} STOCK REPORT`, 14, 30);

        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

        const period = dateRange === 'TODAY' ? 'Today' : `${startDate} to ${endDate}`;
        doc.text(`Period: ${period}`, 14, 42);

        // Summary Section
        if (summaryData) {
            doc.autoTable({
                startY: 50,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Rolls', summaryData.totalRolls],
                    ['Total Metres', `${summaryData.totalMetres.toFixed(2)} M`],
                    ['Total Weight', `${summaryData.totalWeight.toFixed(2)} KG`]
                ],
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241] }
            });
        }
        else if (previewData.length > 0) {
            // Detailed Table
            const rows = previewData.map(item => [
                new Date(item.date).toLocaleString(),
                item.barcode,
                item.status,
                item.metre,
                item.weight,
                item.percentage + '%'
            ]);

            doc.autoTable({
                startY: 50,
                head: [['Time', 'Barcode', 'Status', 'Metre', 'Weight', 'Quality']],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: reportType === 'OUT' ? [220, 38, 38] : [16, 185, 129] },
                styles: { fontSize: 8 }
            });

            // Footer Totals for Detailed View
            const totalM = previewData.reduce((sum, item) => sum + (item.metre || 0), 0);
            const totalW = previewData.reduce((sum, item) => sum + (item.weight || 0), 0);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const finalY = doc.lastAutoTable.finalY + 10;
            doc.text(`Total Count: ${previewData.length}`, 14, finalY);
            doc.text(`Total Length: ${totalM.toFixed(2)} M`, 80, finalY);
            doc.text(`Total Weight: ${totalW.toFixed(2)} KG`, 140, finalY);
        }

        doc.save(`StockReport_${reportType}_${new Date().getTime()}.pdf`);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>Reports Center</h1>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Generate PDF Inventory Records</p>
                </div>
            </header>

            <div style={{ flex: 1, padding: '2rem', display: 'flex', gap: '2rem', overflow: 'hidden' }}>

                {/* Controls Sidebar */}
                <div className="panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>

                    <div>
                        <label style={labelStyle}>Report Type</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['IN', 'OUT', 'ALL'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setReportType(t)}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px',
                                        border: reportType === t ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                        background: reportType === t ? 'var(--accent-color)' : 'transparent',
                                        color: reportType === t ? 'white' : 'var(--text-secondary)',
                                        fontWeight: '700', cursor: 'pointer'
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Date Range</label>
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            style={inputStyle}
                        >
                            <option value="TODAY">Today</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                    </div>

                    {dateRange === 'CUSTOM' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>From</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>To</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={labelStyle}>Format</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setFormat('DETAILED')}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px',
                                    border: format === 'DETAILED' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: format === 'DETAILED' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: format === 'DETAILED' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontWeight: '700', cursor: 'pointer'
                                }}
                            >
                                Detailed List
                            </button>
                            <button
                                onClick={() => setFormat('SUMMARY')}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px',
                                    border: format === 'SUMMARY' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: format === 'SUMMARY' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: format === 'SUMMARY' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontWeight: '700', cursor: 'pointer'
                                }}
                            >
                                Summary
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={fetchReport}
                        className="btn btn-primary"
                        style={{ marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Fetching...' : 'Preview Data'}
                    </button>

                    {(previewData.length > 0 || summaryData) && (
                        <button
                            onClick={generatePDF}
                            style={{
                                padding: '16px', background: '#ef4444', color: 'white',
                                border: 'none', borderRadius: '12px', fontWeight: '800',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                            }}
                        >
                            <span>📄</span> DOWNLOAD PDF
                        </button>
                    )}

                </div>

                {/* Preview Area */}
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
                        Report Preview
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                        {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading data...</div>}

                        {!loading && !summaryData && previewData.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                                Select options and click "Preview Data"
                            </div>
                        )}

                        {summaryData && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <StatBox label="Total Rolls" value={summaryData.totalRolls} />
                                <StatBox label="Total Metres" value={`${summaryData.totalMetres.toFixed(2)} M`} />
                                <StatBox label="Total Weight" value={`${summaryData.totalWeight.toFixed(2)} KG`} />
                            </div>
                        )}

                        {previewData.length > 0 && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-primary)', textAlign: 'left' }}>
                                        <th style={thStyle}>Date</th>
                                        <th style={thStyle}>Barcode</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={thStyle}>Metre</th>
                                        <th style={thStyle}>Weight</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={tdStyle}>{new Date(item.date).toLocaleString()}</td>
                                            <td style={tdStyle}>{item.barcode}</td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    color: item.status === 'IN' ? 'var(--success-color)' : 'var(--error-color)',
                                                    fontWeight: '700'
                                                }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>{item.metre}</td>
                                            <td style={tdStyle}>{item.weight}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

const StatBox = ({ label, value }) => (
    <div style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{value}</div>
    </div>
);

const labelStyle = { display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.7 };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' };
const thStyle = { padding: '12px', borderBottom: '2px solid var(--border-color)' };
const tdStyle = { padding: '12px' };

export default Reports;
