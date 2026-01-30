import React, { useState } from 'react';
import QRCode from "react-qr-code";
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';

// --- Icons ---
const IconExpo = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 0H2.4C1.08 0 0 1.08 0 2.4v19.2C0 22.92 1.08 24 2.4 24h19.2c1.32 0 2.4-1.08 2.4-2.4V2.4C24 1.08 22.92 0 21.6 0zm-2.4 19.2h-14.4V4.8h14.4v14.4z" /><path d="M7.2 7.2h9.6v9.6H7.2z" /></svg>;
const IconLink = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;

const MobileScanner = () => {
    const navigate = useNavigate();
    const { apiUrl } = useConfig();
    const [connectMode, setConnectMode] = useState('PROD'); // PROD or EXPO

    // Extract IP from API URL (e.g., http://10.29.168.224:5000 -> 10.29.168.224)
    const serverIp = apiUrl.replace('http://', '').split(':')[0];
    const expoUrl = `exp://${serverIp}:8081`;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>

            {/* Header */}
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '40px', height: '40px',
                        background: 'linear-gradient(135deg, var(--accent-color), #818cf8)',
                        borderRadius: '12px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: '900',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}>S</div>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>Device Synchronization</h1>
                        <p style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linking Mobile Node to Master Server</p>
                    </div>
                </div>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">RETURN TO COMMAND CENTER</button>
            </header>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '3rem' }}>

                {/* Left: Mode Toggle & Info */}
                <div style={{ maxWidth: '400px' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: '1.1', letterSpacing: '-0.03em' }}>
                        Connect Your <span style={{ color: 'var(--accent-color)' }}>Mobile Device</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.7', marginBottom: '2.5rem' }}>
                        Scan the gateway code to authorize your mobile scanner. Ensure both devices are connected to the same local network (Wi-Fi).
                    </p>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <ModeButton
                            active={connectMode === 'PROD'}
                            onClick={() => setConnectMode('PROD')}
                            title="Standard Production"
                            desc="Use this for the installed Warehouse App."
                            icon={<IconLink />}
                        />
                        <ModeButton
                            active={connectMode === 'EXPO'}
                            onClick={() => setConnectMode('EXPO')}
                            title="Expo Go (Development)"
                            desc="Scan using the Expo Go app for testing."
                            icon={<IconExpo />}
                        />
                    </div>
                </div>

                {/* Right: QR Card */}
                <div className="panel animate-fade-in" style={{
                    width: '440px', padding: '3rem',
                    background: 'var(--bg-secondary)', borderRadius: '32px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.3)',
                    textAlign: 'center', position: 'relative'
                }}>
                    <div style={{
                        background: 'white', padding: '2.5rem', borderRadius: '2rem',
                        display: 'inline-block', marginBottom: '2.5rem'
                    }}>
                        <QRCode
                            value={connectMode === 'EXPO' ? expoUrl : apiUrl}
                            size={200}
                            level="H"
                            fgColor="#0f172a"
                        />
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                            {connectMode === 'EXPO' ? 'EXPO GO PROTOCOL' : 'API ENDPOINT'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: '700', color: connectMode === 'EXPO' ? '#ffffff' : 'var(--accent-color)' }}>
                            {connectMode === 'EXPO' ? expoUrl : apiUrl}
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
                        <Instruction step="1" text="Open App" />
                        <Instruction step="2" text="Scan Code" />
                        <Instruction step="3" text="Linked" />
                    </div>
                </div>

            </div>
        </div>
    );
};

// --- Sub-components ---
const ModeButton = ({ active, onClick, title, desc, icon }) => (
    <button onClick={onClick} style={{
        textAlign: 'left', padding: '1.25rem', borderRadius: '16px',
        border: `2px solid ${active ? 'var(--accent-color)' : 'var(--border-color)'}`,
        background: active ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '1rem',
        alignItems: 'center'
    }}>
        <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: active ? 'var(--accent-color)' : 'var(--bg-tertiary)',
            color: active ? 'white' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>{desc}</div>
        </div>
    </button>
);

const Instruction = ({ step, text }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' }}>{step}</div>
        <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{text}</span>
    </div>
);

export default MobileScanner;
