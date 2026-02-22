import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';

const Login = () => {
    const { apiUrl, updateApiUrl } = useConfig();
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [tempIp, setTempIp] = useState(apiUrl);
    const navigate = useNavigate();

    // Sync temp API URL with Context
    React.useEffect(() => {
        setTempIp(apiUrl);
    }, [apiUrl]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${apiUrl}/api/login`, credentials);
            if (res.data.success && res.data.token) {
                localStorage.setItem('ADMIN_TOKEN', res.data.token);
                localStorage.setItem('isAuthenticated', 'true');
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Login Error:', err);
            if (!err.response) {
                setError('Network Error: Check Server URL or Cert');
            } else if (err.response.status === 401) {
                setError('Invalid Credentials');
            } else {
                setError(`Server Error: ${err.message}`);
            }
        }
    };

    return (
        <div style={containerStyle}>
            {/* Background Decorative Element */}
            <div style={blobStyle}></div>

            <button onClick={() => setShowSettings(true)} style={settingsBtnStyle}>⚙️</button>

            <div className="panel animate-fade-in glass" style={loginPanelStyle}>
                <img src="/logo.svg" alt="Prodexa" style={{ height: '64px', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', fontWeight: '800', letterSpacing: '-0.03em' }}>Prodexa</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '500' }}>Warehouse Operations Software</p>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-color)', marginBottom: '2.5rem', opacity: 0.8 }}>For Sri Lakshmi Textiles</div>

                {error && (
                    <div style={errorStyle}>
                        {error}
                        {error.includes('Network Error') && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
                                <a href={`${apiUrl}/api/admin/server-ip`} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>
                                    Click here to trust the server certificate
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Staff ID</label>
                        <input
                            type="text"
                            placeholder="Enter username"
                            value={credentials.username}
                            onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                            required
                            style={{ width: '100%', padding: '0.8rem 1rem' }}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Access Key</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                            required
                            style={{ width: '100%', padding: '0.8rem 1rem' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '1rem' }}>
                        AUTHENTICATE & ENTER
                    </button>
                </form>

                <div style={footerStyle}>
                    ESTABLISHED 2026 • SYSTEM V2.4
                    <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', opacity: 0.5, fontFamily: 'monospace' }}>
                        Server: {apiUrl}
                    </div>
                </div>
            </div>

            {/* Server Settings Modal */}
            {showSettings && (
                <div style={modalOverlayStyle}>
                    <div className="panel glass animate-fade-in" style={{ width: '360px' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Server Configuration</h3>
                        <label style={labelStyle}>Backend Node URL</label>
                        <input
                            type="text"
                            value={tempIp}
                            onChange={(e) => setTempIp(e.target.value)}
                            style={{ width: '100%', marginBottom: '1.5rem', fontFamily: 'monospace' }}
                        />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    updateApiUrl(tempIp);
                                    setShowSettings(false);
                                    window.location.reload(); // Force reload to apply changes cleanly
                                }}
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                            >
                                SAVE & RELOAD
                            </button>
                            <button onClick={() => setShowSettings(false)} className="btn btn-secondary" style={{ flex: 1 }}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const containerStyle = {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden'
};

const blobStyle = {
    position: 'absolute', width: '600px', height: '600px',
    background: 'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)',
    opacity: 0.1, top: '-200px', right: '-200px', borderRadius: '50%', zIndex: 0
};

const loginPanelStyle = {
    width: '420px', padding: '3rem', textAlign: 'center', position: 'relative', zIndex: 1
};

const logoCircleStyle = {
    width: '48px', height: '48px', background: 'var(--accent-color)', color: 'white',
    borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 1.5rem', fontSize: '1.5rem', fontWeight: '800'
};

const inputGroupStyle = { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const labelStyle = { fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' };
const errorStyle = { background: 'var(--error-bg)', color: 'var(--error-color)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1.5rem', fontWeight: '600' };
const footerStyle = { marginTop: '3rem', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', fontWeight: '600' };
const settingsBtnStyle = { position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.5 };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };

export default Login;
