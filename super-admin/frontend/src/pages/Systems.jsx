import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Monitor, Ban, PowerOff, ShieldAlert, Wifi } from 'lucide-react';

const Systems = () => {
  const [systems, setSystems] = useState([]);

  const fetchSystems = async () => {
    try {
      const data = await api.get('/systems');
      setSystems(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  const handleAction = async (systemId, action) => {
    const reason = prompt(`Enter reason for ${action}:`);
    if (!reason) return;

    try {
      await api.post(`/systems/${systemId}/${action}`, { reason });
      fetchSystems();
    } catch (err) {
      alert(err.error || 'Action failed');
    }
  };

  return (
    <div className="systems-page">
      <div className="page-header">
        <h1>Global System Control</h1>
        <p>Monitor and manage active LoomTrack installations</p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Installation Context</th>
              <th>Server Machine Identifier (HID)</th>
              <th>License Status</th>
              <th>System Health</th>
              <th>Global Control</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => (
              <tr key={s.systemId}>
                <td>
                  <div className="client-cell">
                    <div className={`icon-box-small ${s.status === 'ACTIVE' ? 'indigo' : 'danger'}`} style={{ background: s.status === 'ACTIVE' ? '#eef2ff' : '#fee2e2', color: s.status === 'ACTIVE' ? '#4f46e5' : '#ef4444' }}>
                      <Monitor size={16} />
                    </div>
                    <div className="client-data">
                      <span className="strong" style={{ fontSize: '0.95rem' }}>{s.companyName}</span>
                      <span className="sub">Context: {s.systemId.substring(0, 16)}</span>
                    </div>
                  </div>
                </td>
                <td className="mono" style={{ fontSize: '0.9rem' }}>{s.deviceId}</td>
                <td>
                   <span className={`pill ${s.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '11px' }}>
                    {s.status}
                   </span>
                </td>
                <td>
                   <div className="health-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                      <div className="pulse-indicator" style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 0 2px rgba(16,185,129,0.2)' }}></div>
                      <span style={{ color: '#10b981' }}>Live</span>
                   </div>
                </td>
                <td>
                  <div className="action-row" style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="action-btn" 
                      onClick={() => handleAction(s.systemId, 'block')}
                      disabled={s.status === 'BLOCKED'}
                      style={{ background: 'transparent', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <Ban size={14} /> Soft Block
                    </button>
                    <button 
                      className="action-btn" 
                      onClick={() => handleAction(s.systemId, 'deactivate')}
                      disabled={s.status === 'DEACTIVATED'}
                      style={{ background: '#ef4444', border: 0, color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <PowerOff size={14} /> Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-container" style={{ padding: '24px', background: '#fffbeb', border: '1px solid #fef3c7', marginTop: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '12px', color: '#d97706' }}>
          <ShieldAlert size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#92400e', marginBottom: '2px' }}>High-Authority Control Zone</h3>
          <p style={{ fontSize: '13px', color: '#b45309' }}>Signal overrides transmitted here take effect within 300ms across the client distribution network.</p>
        </div>
      </div>
    </div>
  );
};

export default Systems;
