import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { IconBox, IconScan, IconSettings, IconCloud } from './Icons';

const AppLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();
    const [showSettings, setShowSettings] = useState(false);
    const [tempIp, setTempIp] = useState(apiUrl);

    const isActive = (path) => location.pathname === path;

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>

            {/* --- SIDEBAR --- */}
            <aside style={{
                width: '280px',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
                boxShadow: '4px 0 24px rgba(0,0,0,0.2)'
            }}>
                <div style={{ padding: '2.5rem 1.5rem 2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }} className="app-region-drag">
                    <div style={{
                        width: '36px', height: '36px',
                        background: 'linear-gradient(135deg, var(--accent-color), #818cf8)',
                        borderRadius: '10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'white', fontWeight: '900',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                    }}>SL</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>SRI LAKSHMI</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--accent-color)', letterSpacing: '0.1em' }}>WAREHOUSE PRO</span>
                    </div>
                </div>

                <div style={{ flex: 1, paddingTop: '1rem' }} className="app-region-no-drag">
                    <div style={{ padding: '0 1.5rem 0.5rem', fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>MAIN NAVIGATION</div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <SidebarLink active={isActive('/dashboard')} onClick={() => navigate('/dashboard')} icon={<IconCloud />} label="Operations Dashboard" />
                        <SidebarLink active={isActive('/barcode')} onClick={() => navigate('/barcode')} icon={<IconScan />} label="Barcode Generator" />
                        <SidebarLink active={isActive('/scanners')} onClick={() => navigate('/scanners')} icon={<IconSettings />} label="Scanner Devices" />
                    </nav>

                    <div style={{ padding: '2rem 1.5rem 0.5rem', fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>CONFIGURATION</div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <SidebarLink onClick={() => setShowSettings(true)} icon={<IconSettings />} label="System Settings" />
                    </nav>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.05)',
                        padding: '1rem', borderRadius: '12px', marginBottom: '1rem',
                        border: '1px solid rgba(99, 102, 241, 0.1)'
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>System Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', background: 'var(--success-color)', borderRadius: '50%' }}></div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Connected to Master Node</span>
                        </div>
                    </div>
                    <button onClick={() => { localStorage.clear(); navigate('/'); }} className="sidebar-item" style={{ width: '100%', justifyContent: 'center', color: 'var(--error-color)', cursor: 'pointer' }}>TERMINATE SESSION</button>
                </div>
            </aside>

            {/* --- MAIN CONTENT WRAPPER --- */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                {children}
            </div>

            {/* --- MODALS --- */}
            {/* Settings Modal */}
            {showSettings && (
                <div style={modalOverlayStyle}>
                    <div className="panel animate-fade-in" style={{ width: '420px', background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>System Preferences</h3>
                            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={labelStyle}>Interface Theme</label>
                            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: '8px' }}>
                                <button onClick={() => theme !== 'dark' && toggleTheme()} style={{ flex: 1, background: theme === 'dark' ? 'var(--accent-color)' : 'transparent', color: theme === 'dark' ? 'white' : 'inherit' }} className="btn">DARK</button>
                                <button onClick={() => theme === 'dark' && toggleTheme()} style={{ flex: 1, background: theme === 'light' ? 'var(--accent-color)' : 'transparent', color: theme === 'light' ? 'white' : 'inherit' }} className="btn">LIGHT</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={labelStyle}>Server Endpoint</label>
                            <input type="text" value={tempIp} onChange={e => setTempIp(e.target.value)} style={{ width: '100%', fontFamily: 'monospace', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        </div>

                        <button onClick={() => { updateApiUrl(tempIp); setShowSettings(false); }} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: 'var(--accent-color)', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>APPLY CONFIGURATION</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SidebarLink = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`sidebar-item ${active ? 'active' : ''}`}
        style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.8rem 1.5rem', border: 'none',
            background: active ? 'var(--bg-primary)' : 'transparent',
            color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: active ? '700' : '500',
            cursor: 'pointer', textAlign: 'left',
            borderRadius: '8px', margin: '0 0.5rem', width: 'auto'
        }}
    >
        {React.cloneElement(icon, { stroke: active ? 'var(--accent-color)' : 'currentColor' })}
        <span style={{ fontSize: '0.9rem' }}>{label}</span>
        {active && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-color)' }}></div>}
    </button>
);

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 };

export default AppLayout;
