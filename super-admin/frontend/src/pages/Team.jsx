import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UserPlus, User, Mail, Shield, Trash2 } from 'lucide-react';

const Team = () => {
  const [members, setMembers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ email: '', fullName: '', password: '', role: 'MANAGER' });

  const fetchTeam = async () => {
    try {
      const data = await api.get('/team-members');
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/team-members', formData);
      setShowAdd(false);
      fetchTeam();
      setFormData({ email: '', fullName: '', password: '', role: 'MANAGER' });
    } catch (err) {
      alert(err.error || 'Failed to create member');
    }
  };

  return (
    <div className="team-page">
      <div className="page-header-actions">
        <div className="page-header">
          <h1>Team Management</h1>
          <p>Manage administrative access for LoomTrack managers</p>
        </div>
        {!showAdd && (
          <button className="accent-btn" onClick={() => setShowAdd(true)}>
            <UserPlus size={18} /> Add Manager
          </button>
        )}
      </div>

      {showAdd && (
        <div className="table-container card-shadow" style={{ padding: '40px', marginBottom: '32px' }}>
          <div className="form-header" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Authorize New Administrator</h3>
            <p style={{ opacity: 0.6 }}>Grant operational or administrative access to a new team member.</p>
          </div>
          <form onSubmit={handleCreate} className="admin-form" style={{ padding: 0 }}>
            <div className="form-row">
              <div className="form-field">
                <label>Legal Full Name</label>
                <input 
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </div>
              <div className="form-field">
                <label>Official Email (Login ID)</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="name@loomtrack.com"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Initial Temporary Password</label>
                <input 
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div className="form-field">
                <label>System Privilege Level</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '12px' }}
                >
                  <option value="MANAGER">Operational Manager</option>
                  <option value="SUPER_ADMIN">System Super Admin</option>
                </select>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
              <button type="submit" className="accent-btn" style={{ padding: '12px 24px' }}>Authorize Access</button>
              <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 0, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Administrative Profile</th>
              <th>System Role</th>
              <th>Operational Status</th>
              <th>Member Since</th>
              <th>Management</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td>
                  <div className="client-cell">
                    <div className="user-avatar" style={{ background: m.role === 'SUPER_ADMIN' ? 'var(--accent-gradient)' : '#e2e8f0', color: m.role === 'SUPER_ADMIN' ? 'white' : 'var(--text-secondary)' }}>
                      {m.fullName.charAt(0)}
                    </div>
                    <div className="client-data">
                      <span className="strong">{m.fullName}</span>
                      <span className="sub">{m.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`pill ${m.role === 'SUPER_ADMIN' ? 'indigo' : 'subtle'}`} style={{ color: m.role === 'SUPER_ADMIN' ? '#4f46e5' : '#64748b', background: m.role === 'SUPER_ADMIN' ? '#eef2ff' : '#f1f5f9' }}>
                    {m.role}
                  </span>
                </td>
                <td>
                  <span className="pill success">ACTIVE</span>
                </td>
                <td style={{ fontSize: '13px', opacity: 0.6 }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                <td>
                   <button className="action-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Manage Access</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Team;
