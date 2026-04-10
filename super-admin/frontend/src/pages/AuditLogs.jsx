import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Activity, Calendar } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.get('/audit-logs');
        setLogs(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="audit-logs-page">
      <div className="page-header">
        <h1>System Audit Trails</h1>
        <p>Immutable traceability of all administrative actions in the ecosystem</p>
      </div>

      <div className="table-container">
        <div className="table-header" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar-inline" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', flex: 1, maxWidth: '400px' }}>
            <Search size={16} className="text-muted" />
            <input placeholder="Filter log entries..." style={{ border: 0, background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
          </div>
          <div className="filter-actions" style={{ display: 'flex', gap: '8px' }}>
            <button className="accent-btn" style={{ background: '#f8fafc', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'none' }}>Download Report</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Profile</th>
              <th>Objective</th>
              <th>Administrator</th>
              <th>Identity / Result</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.auditId}>
                <td style={{ fontSize: '12px', opacity: 0.6 }}>
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="strong">{log.action}</td>
                <td>
                  <div className="target-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#f1f5f9', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                    {log.targetType}
                  </div>
                </td>
                <td>
                  <div className="actor-info" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{log.actorEmail || 'System Process'}</span>
                    <span style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>{log.ip}</span>
                  </div>
                </td>
                <td>
                  <span className={`pill ${log.outcome === 'SUCCESS' ? 'success' : 'danger'}`}>
                    {log.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
