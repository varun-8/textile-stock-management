import React, { useState } from 'react';
import { useMobile } from '../context/MobileContext';
import StatusBar from '../components/StatusBar';
import { haptic } from '../utils/haptic';

const LoginScreen = () => {
    const { loginUser, unpair, scannerId } = useMobile();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        haptic.light();
        try {
            await loginUser(username, password);
            haptic.success();
        } catch (err) {
            haptic.error();
            setError(err.message || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-primary flex flex-col">
            {/* StatusBar */}
            <StatusBar 
                icon="👤"
                title="Worker Login"
                subtitle={`Device: ${scannerId?.slice(0, 8)}...`}
            />

            {/* Background Decorative Blob - Matching Desktop Theme */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="absolute w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/3 rounded-full blur-3xl"></div>
            </div>
            
            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Header Section */}
                <div className="w-full max-w-sm mb-12 text-center">
                    {/* Logo Circle - Desktop Style */}
                    <div className="flex justify-center mb-8">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                             style={{
                               backgroundImage: 'linear-gradient(to bottom right, #6366f1, #4f46e5)',
                               boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)'
                             }}>
                            <span className="text-3xl font-bold text-white">S</span>
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-textPrimary mb-2">SRI LAKSHMI</h1>
                    <p className="text-textSecondary text-sm font-medium mb-8">Stock Management Console</p>
                    
                    {/* Device Info Card - Desktop Glass Style */}
                    <div className="glass rounded-xl p-4 mb-8">
                        <p className="text-xs text-textSecondary font-semibold uppercase tracking-wider mb-2">Connected Device</p>
                        <p className="font-mono text-sm text-accent font-bold">{scannerId || 'Pairing...'}</p>
                    </div>
                </div>

                {/* Form Section */}
                <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5">
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-error/10 border border-error/30 rounded-lg p-4 animate-fade-in">
                            <p className="text-sm font-semibold text-error">{error}</p>
                        </div>
                    )}

                    {/* Staff ID Input */}
                    <div>
                        <label className="block text-xs font-bold text-textPrimary mb-2 uppercase tracking-wider">Staff ID</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-primary border border-border rounded-lg text-textPrimary text-sm font-medium outline-none transition-all disabled:opacity-50"
                            placeholder="Enter username"
                        />
                    </div>

                    {/* Access Key Input */}
                    <div>
                        <label className="block text-xs font-bold text-textPrimary mb-2 uppercase tracking-wider">Access Key</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-primary border border-border rounded-lg text-textPrimary text-sm font-medium outline-none transition-all disabled:opacity-50"
                            placeholder="••••••••"
                        />
                    </div>

                    {/* Authenticate Button - Desktop Style */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-6 px-4 py-3 btn-primary uppercase tracking-wider font-bold"
                    >
                        {loading ? 'Authenticating...' : 'Authenticate & Enter'}
                    </button>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-primary text-textSecondary">Or</span>
                        </div>
                    </div>

                    {/* Unpair Button - Desktop Style */}
                    <button 
                        type="button"
                        onClick={unpair} 
                        className="w-full px-4 py-3 btn-secondary"
                    >
                        Unpair This Device
                    </button>
                </form>

                {/* Footer - Desktop Style */}
                <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-textSecondary">
                    <p>ESTABLISHED 2026 • SYSTEM V2.4</p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
