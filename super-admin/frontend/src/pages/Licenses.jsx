import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Key, 
  Plus, 
  RefreshCw, 
  Download, 
  CircleCheck, 
  WifiOff, 
  Copy,
  Check
} from 'lucide-react';

const Licenses = () => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list'); // 'list' or 'issue' or 'sync'
  const [copying, setCopying] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    workspaceCode: 'default',
    deviceId: '',
    features: ''
  });

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const data = await api.get('/licenses');
      setLicenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean)
      };
      await api.post('/licenses/issue', payload);
      setTab('list');
      fetchLicenses();
      setFormData({ companyName: '', workspaceCode: 'default', deviceId: '', features: '' });
    } catch (err) {
      alert(err.error || 'Failed to issue license');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  return (
    <div className="licenses-page">
      <div className="page-header-actions">
        <div className="page-header">
          <h1>License Registry</h1>
          <p>Issue activation codes and synchronize offline activations</p>
        </div>
        <div className="tabs" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
          <button 
            className={`tab-btn ${tab === 'list' ? 'active' : ''}`}
            onClick={() => setTab('list')}
          >
            <Key size={16} /> Registry
          </button>
          <button 
            className={`tab-btn ${tab === 'issue' ? 'active' : ''}`}
            onClick={() => setTab('issue')}
          >
            <Plus size={16} /> Online Issue
          </button>
          <button 
            className={`tab-btn ${tab === 'sync' ? 'active' : ''}`}
            onClick={() => setTab('sync')}
          >
            <WifiOff size={16} /> Offline Sync
          </button>
        </div>
      </div>

      {tab === 'list' && (
        <div className="licenses-grid">
          {loading ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>Synchronizing registry...</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Device Identifier</th>
                    <th>Issuance Date</th>
                    <th>Mode</th>
                    <th>Code Fragment</th>
                    <th>System Status</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((l) => (
                    <tr key={l.licenseId}>
                      <td className="strong">{l.companyName}</td>
                      <td className="mono">{l.deviceId}</td>
                      <td>{new Date(l.issuedAt).toLocaleDateString()}</td>
                      <td>
                        <span className={`pill ${l.source === 'OFFLINE' ? 'warning' : 'success'}`}>
                          {l.source}
                        </span>
                      </td>
                      <td className="code-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code>{l.activationCode.substring(0, 12)}...</code>
                        <button 
                          className="action-btn"
                          onClick={() => copyToClipboard(l.activationCode, l.licenseId)}
                          style={{ background: 'transparent', border: 0, cursor: 'pointer', opacity: 0.5 }}
                        >
                          {copying === l.licenseId ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      </td>
                      <td>
                        <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CircleCheck className="text-success" size={14} />
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{l.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'issue' && (
        <div className="table-container" style={{ padding: '40px' }}>
          <div className="form-header" style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Issue Global Activation Code</h3>
            <p style={{ opacity: 0.6 }}>Generate a unique signature for a specific machine ID.</p>
          </div>
          <form onSubmit={handleIssue} className="admin-form" style={{ padding: 0 }}>
            <div className="form-row">
              <div className="form-field">
                <label>Legal Company Title</label>
                <input 
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  placeholder="e.g. Sri Lakshmi Textiles"
                  required
                />
              </div>
              <div className="form-field">
                <label>Machine Context (Workspace)</label>
                <input 
                  value={formData.workspaceCode}
                  onChange={(e) => setFormData({...formData, workspaceCode: e.target.value})}
                  placeholder="default_production"
                />
              </div>
            </div>
            <div className="form-field">
              <label>Hardware Unique ID (HID)</label>
              <input 
                value={formData.deviceId}
                onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                placeholder="Paste the device fingerprint here"
                required
              />
            </div>
            <div className="form-field">
              <label>Entitlements (Comma separated)</label>
              <input 
                value={formData.features}
                onChange={(e) => setFormData({...formData, features: e.target.value})}
                placeholder="inventory, labels, reports"
              />
            </div>
            <div className="form-actions" style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
              <button type="submit" className="accent-btn" style={{ padding: '12px 24px' }}>Sign & Register Activation</button>
              <button type="button" className="cancel-btn" onClick={() => setTab('list')} style={{ background: 'transparent', border: 0, fontWeight: 600, cursor: 'pointer' }}>Discard</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'sync' && (
        <div className="table-container" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="sync-placeholder">
             <div className="icon-box warning" style={{ width: '80px', height: '80px', background: '#fffbeb', color: '#d97706', borderRadius: '24px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <WifiOff size={40} />
             </div>
             <h4 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Offline License Gateway</h4>
             <p style={{ maxWidth: '480px', margin: '0 auto 32px', opacity: 0.6 }}>Register activations performed by the Super Admin offline signing tool to maintain global synchronization.</p>
             <textarea 
               className="sync-area" 
               placeholder="Paste the offline activation payload block..."
               rows={6}
               style={{ width: '100%', maxWidth: '600px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}
             ></textarea>
             <div>
                <button className="accent-btn" style={{ margin: '0 auto' }}>Sync Local Activation</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Licenses;
