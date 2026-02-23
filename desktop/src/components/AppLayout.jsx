import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { IconBox, IconScan, IconSettings, IconCloud, IconUsers, IconBroadcast } from './Icons';
import AppLogo from '../assets/logo.svg';

// Simple Chevron Icons if not imported (assuming they might not exist in Icons.js, defining inline or using simple text if needed, but trying to use standard approach. 
// If Icons.js doesn't have them, I'll add SVGs directly).
// Let's assume for now I should just use SVGs directly in the button to avoid import errors if they don't exist.

const AppLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { apiUrl, updateApiUrl, theme, toggleTheme } = useConfig();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isActive = (path) => location.pathname === path;

    const handleNavigation = (path) => {
        navigate(path);
        // setIsCollapsed(true); // Disable auto-collapse on navigation
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>

            {/* --- SIDEBAR --- */}
            <aside style={{
                width: isCollapsed ? '80px' : '280px',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
                boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
            }}>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        position: 'absolute',
                        right: '-12px',
                        top: '32px',
                        width: '24px',
                        height: '24px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 20,
                        color: 'var(--text-secondary)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
                    </svg>
                </button>

                <div style={{
                    padding: isCollapsed ? '2rem 0' : '2rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                }} className="app-region-drag">
                    <img src={AppLogo} alt="Prodexa" style={{ width: isCollapsed ? '40px' : '56px', height: isCollapsed ? '40px' : '56px', transition: 'all 0.3s ease' }} />
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        opacity: isCollapsed ? 0 : 1,
                        width: isCollapsed ? 0 : 'auto',
                        transition: 'opacity 0.2s ease, width 0.3s ease'
                    }}>
                        <span style={{ fontWeight: '800', fontSize: '1.4rem', letterSpacing: '-0.02em', lineHeight: '1', color: 'var(--text-primary)' }}>Prodexa</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.8, letterSpacing: '0.02em' }}>WAREHOUSE OPERATIONS</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--accent-color)', letterSpacing: '0.05em', marginTop: '2px' }}>SRI LAKSHMI TEXTILES</span>
                    </div>
                </div>

                <div style={{ flex: 1, paddingTop: '1rem', overflowY: 'auto', overflowX: 'hidden' }} className="app-region-no-drag sidebar-scroll">
                    <div style={{
                        padding: isCollapsed ? '0' : '0 1.5rem 0.5rem',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.1em',
                        textAlign: isCollapsed ? 'center' : 'left',
                        height: '1.5em',
                        opacity: isCollapsed ? 0 : 1, // Hide section headers when collapsed
                        transition: 'opacity 0.2s ease'
                    }}>
                        {!isCollapsed && 'MAIN NAVIGATION'}
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <SidebarLink collapsed={isCollapsed} active={isActive('/dashboard')} onClick={() => handleNavigation('/dashboard')} icon={<IconCloud />} label="Operations Dashboard" />
                        <SidebarLink collapsed={isCollapsed} active={isActive('/sessions')} onClick={() => handleNavigation('/sessions')} icon={<IconBroadcast />} label="Active Sessions" />

                        <SidebarLink collapsed={isCollapsed} active={isActive('/barcode')} onClick={() => handleNavigation('/barcode')} icon={<IconScan />} label="Barcode Generator" />
                        <SidebarLink collapsed={isCollapsed} active={isActive('/scanners')} onClick={() => handleNavigation('/scanners')} icon={<IconSettings />} label="Scanner Devices" />
                    </nav>

                    <div style={{
                        padding: isCollapsed ? '0' : '2rem 1.5rem 0.5rem',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.1em',
                        textAlign: isCollapsed ? 'center' : 'left',
                        height: isCollapsed ? '1rem' : 'auto',
                        opacity: isCollapsed ? 0 : 1, // Hide section headers when collapsed
                        transition: 'opacity 0.2s ease',
                        marginTop: isCollapsed ? '1rem' : '0'
                    }}>
                        {!isCollapsed && 'CONFIGURATION'}
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <SidebarLink collapsed={isCollapsed} active={isActive('/employees')} onClick={() => handleNavigation('/employees')} icon={<IconUsers />} label="Employee Management" />
                        <SidebarLink collapsed={isCollapsed} active={isActive('/configuration')} onClick={() => handleNavigation('/configuration')} icon={<IconSettings />} label="Article Sizes" />
                        <SidebarLink collapsed={isCollapsed} active={isActive('/settings')} onClick={() => handleNavigation('/settings')} icon={<IconSettings />} label="System Settings" />
                    </nav>
                </div>

                <div style={{ marginTop: 'auto', padding: isCollapsed ? '1.5rem 0' : '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={async () => {
                            try {
                                await fetch(`${apiUrl}/api/logout`, { method: 'POST' });
                            } catch (e) { console.error('Logout error:', e); }
                            localStorage.clear();
                            navigate('/');
                        }}
                        className="sidebar-item"
                        style={{
                            width: isCollapsed ? '40px' : '100%',
                            height: isCollapsed ? '40px' : 'auto',
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: isCollapsed ? '0' : '0.8rem 1.5rem',
                            border: '1px solid transparent',
                            background: 'rgba(239, 68, 68, 0.05)',
                            color: 'var(--error-color)',
                            fontWeight: '700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            transition: 'all 0.2s',
                            overflow: 'hidden'
                        }}
                        title="Log Out"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: '20px' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        <span style={{
                            fontSize: '0.9rem',
                            opacity: isCollapsed ? 0 : 1,
                            width: isCollapsed ? 0 : 'auto',
                            transition: 'opacity 0.2s ease',
                            whiteSpace: 'nowrap'
                        }}>LOG OUT</span>
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
                .sidebar-item:hover { opacity: 1; background: var(--bg-primary) !important; transform: translateX(isCollapsed ? 0 : 4px); }
                .sidebar-item.active { opacity: 1; background: var(--bg-primary) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            `}</style>
        </div>
    );
};

const SidebarLink = ({ icon, label, active, onClick, collapsed }) => (
    <button
        onClick={onClick}
        className={`sidebar-item ${active ? 'active' : ''}`}
        title={collapsed ? label : ''}
        style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: collapsed ? '0.9rem 0' : '0.9rem 1.5rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            border: '1px solid transparent',
            background: active ? 'var(--bg-primary)' : 'transparent',
            color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: active ? '700' : '600',
            cursor: 'pointer', textAlign: 'left',
            borderRadius: '12px', margin: '2px 0',
            width: collapsed ? '48px' : '95%',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease',
        }}
    >
        {React.cloneElement(icon, { stroke: active ? 'var(--accent-color)' : 'currentColor', strokeWidth: active ? 2.5 : 2, style: { minWidth: '24px' } })}
        <span style={{
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : 'auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s ease, width 0.2s ease'
        }}>{label}</span>
        {active && !collapsed && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-color)' }}></div>}
    </button>
);

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 };

export default AppLayout;
