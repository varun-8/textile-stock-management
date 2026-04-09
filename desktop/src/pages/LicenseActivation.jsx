import React, { useMemo, useState } from 'react';
import { useConfig } from '../context/ConfigContext';

const LicenseActivation = ({ licenseStatus, onActivated }) => {
    const { apiUrl } = useConfig();
    const [activationCode, setActivationCode] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const deviceId = useMemo(() => licenseStatus?.deviceId || 'Loading...', [licenseStatus]);

    const submitActivation = async (e) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/license/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activationCode: activationCode.trim() })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Activation failed');
            }
            setMessage({ type: 'success', text: 'License activated successfully.' });
            if (onActivated) onActivated(data.license);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const submitReset = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/license/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resetCode: resetCode.trim(),
                    newPassword: newPassword.trim()
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Reset failed');
            }
            setMessage({ type: 'success', text: 'Admin password updated successfully.' });
            setResetCode('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={pageStyle}>
            <div style={cardStyle}>
                <div style={badgeStyle}>PRODEXA</div>
                <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 900, color: '#e2e8f0' }}>License Activation</h1>
                <p style={{ margin: '0 0 1.5rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    This installation is protected by a private license. Enter the signed activation code from the cloud portal to unlock the system.
                </p>

                <div style={infoGrid}>
                    <div style={infoBox}>
                        <div style={infoLabel}>Device ID</div>
                        <div style={infoValue}>{deviceId}</div>
                    </div>
                    <div style={infoBox}>
                        <div style={infoLabel}>Status</div>
                        <div style={infoValue}>{licenseStatus?.active ? 'Active' : 'Pending'}</div>
                    </div>
                </div>

                {licenseStatus?.message && (
                    <div style={noticeStyle}>
                        {licenseStatus.message}
                    </div>
                )}

                {message && (
                    <div style={{
                        ...noticeStyle,
                        background: message.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        borderColor: message.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                        color: message.type === 'success' ? '#34d399' : '#f87171'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={submitActivation} style={{ display: 'grid', gap: '0.9rem', marginTop: '1.5rem' }}>
                    <label style={labelStyle}>Activation Code</label>
                    <textarea
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value)}
                        placeholder="Paste signed activation code here"
                        rows={5}
                        style={textAreaStyle}
                    />
                    <button type="submit" disabled={loading || !activationCode.trim()} style={buttonStyle}>
                        {loading ? 'Activating...' : 'Activate License'}
                    </button>
                </form>

                <div style={{ height: '1px', background: 'rgba(148,163,184,0.18)', margin: '1.75rem 0' }} />

                <form onSubmit={submitReset} style={{ display: 'grid', gap: '0.9rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e2e8f0' }}>Reset Admin Password</h2>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
                        Use a signed reset key from the cloud portal to set a new admin password on this device.
                    </p>
                    <textarea
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="Paste signed reset key here"
                        rows={4}
                        style={textAreaStyle}
                    />
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New admin password"
                        style={inputStyle}
                    />
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        style={inputStyle}
                    />
                    <button type="submit" disabled={loading || !resetCode.trim() || !newPassword.trim()} style={secondaryButtonStyle}>
                        {loading ? 'Updating...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const pageStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'radial-gradient(circle at top, #1e293b 0%, #020617 55%, #000 100%)',
    padding: '1.5rem'
};

const cardStyle = {
    width: 'min(760px, 100%)',
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '28px',
    padding: '2rem',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(22px)'
};

const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    background: 'rgba(99,102,241,0.14)',
    color: '#a5b4fc',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    marginBottom: '1rem'
};

const infoGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0.9rem',
    marginTop: '1rem'
};

const infoBox = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: '18px',
    padding: '1rem'
};

const infoLabel = {
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.45rem'
};

const infoValue = {
    color: '#f8fafc',
    fontSize: '0.95rem',
    fontWeight: 700,
    wordBreak: 'break-word'
};

const noticeStyle = {
    marginTop: '1rem',
    padding: '0.9rem 1rem',
    borderRadius: '14px',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.18)',
    color: '#c7d2fe',
    fontSize: '0.92rem',
    lineHeight: 1.5
};

const labelStyle = {
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
};

const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.95rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(255,255,255,0.03)',
    color: '#f8fafc',
    outline: 'none'
};

const textAreaStyle = {
    ...inputStyle,
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'monospace'
};

const buttonStyle = {
    padding: '0.95rem 1.1rem',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: 'white',
    fontWeight: 800,
    cursor: 'pointer'
};

const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'
};

export default LicenseActivation;
