import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building, Shield, User, Mail, ShieldCheck } from 'lucide-react';

const Profile = () => {
  const { user, isSuperAdmin } = useAuth();
  const [profileData, setProfileData] = useState({
    name: '',
    domain: '',
    supportEmail: ''
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', nextPassword: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      const fetchProfile = async () => {
        try {
          const data = await api.get('/company-profile');
          setProfileData(data);
        } catch (err) {
          console.error('Failed to fetch profile', err);
        }
      };
      fetchProfile();
    }
  }, [isSuperAdmin]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/admin/company-profile', profileData);
      setStatus('Profile settings updated successfully');
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setStatus('Failed to update profile: ' + (err.error || err.message));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/me/password', passwordData);
      setStatus('Security credentials updated successfully');
      setPasswordData({ currentPassword: '', nextPassword: '' });
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setStatus('Security update failed: ' + (err.error || err.message));
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Administrative Settings</h1>
        <p>Manage your account credentials and portal branding</p>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '32px', alignItems: 'start' }}>
        <div className="settings-main">
          {/* Company Branding */}
          {isSuperAdmin && (
            <div className="table-container card-shadow" style={{ padding: '32px', marginBottom: '32px' }}>
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <Building size={20} className="text-secondary" />
                <h2 style={{ fontSize: '1.25rem' }}>Portal Branding</h2>
              </div>
              <form onSubmit={handleUpdateProfile} className="admin-form" style={{ padding: 0 }}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div className="form-field">
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Official Portal Name</label>
                    <input 
                      value={profileData.name}
                      onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
                    />
                  </div>
                  <div className="form-field">
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Service Domain</label>
                    <input 
                      value={profileData.domain}
                      onChange={(e) => setProfileData({...profileData, domain: e.target.value})}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
                    />
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>System Email Address (Support)</label>
                  <input 
                    type="email"
                    value={profileData.supportEmail}
                    onChange={(e) => setProfileData({...profileData, supportEmail: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
                  />
                </div>
                <button type="submit" className="accent-btn" style={{ padding: '12px 24px' }}>Save Branding Parameters</button>
              </form>
            </div>
          )}

          {/* Security */}
          <div className="table-container card-shadow" style={{ padding: '32px' }}>
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <Shield size={20} className="text-secondary" />
              <h2 style={{ fontSize: '1.25rem' }}>Security Credentials</h2>
            </div>
            <form onSubmit={handleChangePassword} className="admin-form" style={{ padding: 0 }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div className="form-field">
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Current Secure Password</label>
                  <input 
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
                    required
                  />
                </div>
                <div className="form-field">
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>New Access Code</label>
                  <input 
                    type="password"
                    value={passwordData.nextPassword}
                    onChange={(e) => setPasswordData({...passwordData, nextPassword: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
                    required
                  />
                </div>
              </div>
              
              {status && (
                <div className={`status-pill`} style={{ 
                  padding: '12px', 
                  borderRadius: '12px', 
                  background: status.toLowerCase().includes('failed') ? '#fee2e2' : '#d1fae5', 
                  color: status.toLowerCase().includes('failed') ? '#991b1b' : '#065f46', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <ShieldCheck size={16} />
                  {status}
                </div>
              )}
              
              <button type="submit" className="accent-btn" style={{ padding: '12px 24px' }}>Update Security Token</button>
            </form>
          </div>
        </div>

        <aside className="profile-sidebar">
          <div className="table-container card-shadow" style={{ padding: '32px', textAlign: 'center' }}>
            <div className="user-avatar-large" style={{ 
              width: '80px', 
              height: '80px', 
              background: 'var(--accent-gradient)', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 20px', 
              color: 'white', 
              fontWeight: 800, 
              fontSize: '28px' 
            }}>
              {user?.fullName?.charAt(0)}
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px', fontWeight: 700 }}>{user?.fullName}</h3>
            <p style={{ opacity: 0.6, fontSize: '13px', marginBottom: '24px' }}>{user?.email}</p>
            <div className="pill indigo" style={{ 
              display: 'inline-block',
              padding: '6px 14px', 
              borderRadius: '8px', 
              fontSize: '11px', 
              fontWeight: 800, 
              background: '#eef2ff', 
              color: '#4f46e5',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {user?.role}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Profile;
