import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { IconBox, IconScan, IconSettings, IconCloud, IconUsers, IconBroadcast } from './Icons';

const AppLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();

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
                        <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PRODEXA</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--accent-color)', letterSpacing: '0.1em' }}>SRI LAKSHMI TEXTILES</span>
                    </div>
                </div>

                <div style={{ flex: 1, paddingTop: '1rem', overflowY: 'auto' }} className="app-region-no-drag sidebar-scroll">
                    <div style={{ padding: '0 1.5rem 0.5rem', fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>MAIN NAVIGATION</div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <SidebarLink active={isActive('/dashboard')} onClick={() => navigate('/dashboard')} icon={<IconCloud />} label="Operations Dashboard" />
                        <SidebarLink active={isActive('/sessions')} onClick={() => navigate('/sessions')} icon={<IconBroadcast />} label="Active Sessions" />

                        <SidebarLink active={isActive('/barcode')} onClick={() => navigate('/barcode')} icon={<IconScan />} label="Barcode Generator" />
                        <SidebarLink active={isActive('/scanners')} onClick={() => navigate('/scanners')} icon={<IconSettings />} label="Scanner Devices" />
                    </nav>

                    <div style={{ padding: '2rem 1.5rem 0.5rem', fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>CONFIGURATION</div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <SidebarLink active={isActive('/employees')} onClick={() => navigate('/employees')} icon={<IconUsers />} label="Employee Management" />
                        <SidebarLink active={isActive('/configuration')} onClick={() => navigate('/configuration')} icon={<IconSettings />} label="Article Sizes" />
                        <SidebarLink active={isActive('/settings')} onClick={() => navigate('/settings')} icon={<IconSettings />} label="System Settings" />
                    </nav>
                </div>

                <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => { localStorage.clear(); navigate('/'); }}
                        className="sidebar-item"
                        style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.8rem 1.5rem', border: '1px solid transparent',
                            background: 'rgba(239, 68, 68, 0.05)',
                            color: 'var(--error-color)',
                            fontWeight: '700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            justifyContent: 'flex-start',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        <span style={{ fontSize: '0.9rem' }}>LOG OUT</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT WRAPPER --- */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                {children}
            </div>

            {/* --- MODALS --- */}
            <style>{`
                .sidebar-scroll::-webkit-scrollbar { width: 4px; }
                .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
                .sidebar-scroll::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
                .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

                .sidebar-item { transition: all 0.2s ease; opacity: 0.8; }
                .sidebar-item:hover { opacity: 1; background: var(--bg-primary) !important; transform: translateX(4px); }
                .sidebar-item.active { opacity: 1; background: var(--bg-primary) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            `}</style>
        </div>
    );
};

const SidebarLink = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`sidebar-item ${active ? 'active' : ''}`}
        style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.9rem 1.5rem', border: '1px solid transparent',
            background: active ? 'var(--bg-primary)' : 'transparent',
            color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: active ? '700' : '600',
            cursor: 'pointer', textAlign: 'left',
            borderRadius: '12px', margin: '2px 0', width: '100%',
            fontSize: '0.95rem'
        }}
    >
        {React.cloneElement(icon, { stroke: active ? 'var(--accent-color)' : 'currentColor', strokeWidth: active ? 2.5 : 2 })}
        <span>{label}</span>
        {active && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-color)' }}></div>}
    </button>
);

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 };

export default AppLayout;
