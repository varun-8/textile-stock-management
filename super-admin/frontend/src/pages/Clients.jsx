import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Plus, Building, Smartphone, Search } from 'lucide-react';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ clientName: '', companyName: '', companyId: '', deviceId: '' });

  const fetchClients = async () => {
    try {
      const data = await api.get('/clients');
      setClients(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post('/clients/register', formData);
      setShowAdd(false);
      fetchClients();
      setFormData({ clientName: '', companyName: '', companyId: '', deviceId: '' });
    } catch (err) {
      alert(err.error || 'Registration failed');
    }
  };

  return (
    <div className="clients-page">
      <div className="page-header-actions">
        <div className="page-header">
          <h1>Client Management</h1>
          <p>Register and manage LoomTrack client organizations</p>
        </div>
        {!showAdd && (
          <button className="accent-btn" onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Register Client
          </button>
        )}
      </div>

      {showAdd && (
        <div className="table-container card-shadow" style={{ padding: '40px', marginBottom: '32px' }}>
          <div className="form-header" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Register New Client Organization</h3>
            <p style={{ opacity: 0.6 }}>Onboard a new client into the LoomTrack control plane.</p>
          </div>
          <form onSubmit={handleRegister} className="admin-form" style={{ padding: 0 }}>
            <div className="form-row">
              <div className="form-field">
                <label>Company Code / ID</label>
                <input 
                  value={formData.companyId}
                  onChange={(e) => setFormData({...formData, companyId: e.target.value})}
                  placeholder="e.g. SLT-001"
                  required
                />
              </div>
              <div className="form-field">
                <label>Organization Name</label>
                <input 
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  placeholder="e.g. Sri Lakshmi Textiles"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Primary Contact Name</label>
                <input 
                  value={formData.clientName}
                  onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                  placeholder="e.g. Varun Kumar"
                  required
                />
              </div>
              <div className="form-field">
                <label>Master Machine ID (Primary Server)</label>
                <input 
                  value={formData.deviceId}
                  onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                  placeholder="Hardware Unique Identification"
                  required
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
              <button type="submit" className="accent-btn" style={{ padding: '12px 24px' }}>Authorize & Register</button>
              <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 0, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <div className="table-header" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
          <div className="search-bar-inline" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', flex: 1, maxWidth: '400px' }}>
            <Search size={16} className="text-muted" />
            <input placeholder="Search registry..." style={{ border: 0, background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Organization Identity</th>
              <th>Technical Code</th>
              <th>Server HID</th>
              <th>Onboarding Date</th>
              <th>Network Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.clientId}>
                <td>
                  <div className="client-cell">
                    <div className="icon-box-small indigo" style={{ background: '#eef2ff', color: '#4f46e5' }}><Building size={16} /></div>
                    <div className="client-data">
                      <span className="strong" style={{ fontSize: '0.95rem' }}>{c.companyName}</span>
                      <span className="sub">{c.clientName}</span>
                    </div>
                  </div>
                </td>
                <td className="mono">
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{c.companyId}</span>
                      <span style={{ fontSize: '10px', opacity: 0.5 }}>PID: {c.systemId.substring(0, 8)}</span>
                   </div>
                </td>
                <td className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={14} style={{ opacity: 0.5 }}/>{c.deviceId}</td>
                <td>{new Date(c.registeredAt).toLocaleDateString()}</td>
                <td>
                  <span className="pill success">AUTHORIZED</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Clients;
