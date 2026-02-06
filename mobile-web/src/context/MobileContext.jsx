import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const MobileContext = createContext();

const DEFAULT_IP = 'stock-system.local'; // Use hostname for HTTPS cert validation
const THEME = {
    primary: '#0f172a',
    secondary: '#1e293b',
    accent: '#6366f1',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    border: '#334155'
};

export const MobileProvider = ({ children }) => {
    const [serverIp, setServerIp] = useState(localStorage.getItem('SL_SERVER_IP') || DEFAULT_IP);
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('SL_USER_TOKEN'));
    const [user, setUser] = useState(() => {
        try {
            const val = localStorage.getItem('SL_USER');
            return val ? JSON.parse(val) : null;
        } catch (e) {
            console.error('Failed to parse user from local storage', e);
            return null;
        }
    });
    const [scannerId, setScannerId] = useState(localStorage.getItem('SL_SCANNER_ID') || null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Check if event already fired (captured by index.html script)
        if (window.deferredPrompt) {
            console.log('📱 Found existing deferredPrompt');
            setDeferredPrompt(window.deferredPrompt);
        }

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            console.log('📱 Captured beforeinstallprompt event');
            setDeferredPrompt(e);
            window.deferredPrompt = e; // Sync global
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const installApp = async () => {
        if (!deferredPrompt) {
            console.warn('⚠️ No deferredPrompt found');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User choice: ${outcome}`);
        setDeferredPrompt(null);
        window.deferredPrompt = null;
    };
    const [missing, setMissing] = useState([]);
    const [loadingMissing, setLoadingMissing] = useState(false);

    const api = axios.create({
        httpsAgent: {
            rejectUnauthorized: false // Allow self-signed certificates
        }
    });

    useEffect(() => {
        api.defaults.baseURL = `https://${serverIp}:5000`;
        // Add scanner ID header to all requests if paired
        if (scannerId) {
            api.defaults.headers.common['x-scanner-id'] = scannerId;
        } else {
            delete api.defaults.headers.common['x-scanner-id'];
        }
    }, [serverIp, scannerId]);

    const updateIp = (ip) => {
        setServerIp(ip);
        localStorage.setItem('SL_SERVER_IP', ip);
    };

    const loginUser = async (username, password) => {
        try {
            const res = await api.post('/api/auth/login', { username, password });
            localStorage.setItem('SL_USER_TOKEN', res.data.token);
            localStorage.setItem('SL_USER', JSON.stringify(res.data.user));
            setUser(res.data.user);
            setIsLoggedIn(true);
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Login failed');
        }
    };

    const logout = () => {
        localStorage.removeItem('SL_USER_TOKEN');
        localStorage.removeItem('SL_USER');
        setUser(null);
        setIsLoggedIn(false);
    };

    const pairScanner = async (token, url, name) => {
        console.log('🔗 pairScanner called - Token:', token, 'URL:', url, 'Name:', name);

        // Extract IP from URL (handle both http:// and https://)
        let ip = url.replace(/https?:\/\//, '').split(':')[0]; // Get just the IP
        console.log('📍 Extracted IP:', ip);

        try {
            // Temporary client for pairing (since we don't have scannerId header yet)
            const pairClient = axios.create({
                baseURL: `https://${ip}:5000`,
                httpsAgent: { rejectUnauthorized: false }
            });

            console.log('🌐 Authenticating with Token...');
            // Exchange Setup Token for Unique Scanner ID
            const res = await pairClient.post('/api/auth/pair', {
                token: token,
                name: name || `Mobile - ${new Date().toLocaleTimeString()}`
            });

            if (!res.data.success || !res.data.scannerId) {
                throw new Error('Pairing response invalid');
            }

            const newScannerId = res.data.scannerId;
            console.log('✅ Pairing Successful! Assigned ID:', newScannerId);

            // Save to localStorage
            localStorage.setItem('SL_SCANNER_ID', newScannerId);
            localStorage.setItem('SL_SERVER_IP', ip);
            // Save name locally too if needed, but not critical

            // Update Context State
            setScannerId(newScannerId);
            setServerIp(ip);

            console.log('✅ Pairing complete - State updated');
        } catch (err) {
            console.error('❌ Pairing Error:', err);
            // Propagate error to UI
            throw new Error(err.response?.data?.error || err.message || 'Pairing Failed');
        }
    };

    const unpair = () => {
        localStorage.removeItem('SL_SCANNER_ID');
        localStorage.removeItem('SL_SERVER_IP');
        setScannerId(null);
        setServerIp(DEFAULT_IP);
        logout();
    };

    // Listen for localStorage changes (for cross-tab or programmatic updates)
    useEffect(() => {
        const handleStorageChange = () => {
            console.log('📦 localStorage change detected');
            const newScannerId = localStorage.getItem('SL_SCANNER_ID');
            const newServerIp = localStorage.getItem('SL_SERVER_IP');
            if (newScannerId !== scannerId) {
                console.log('🔄 Updating scannerId from storage:', newScannerId);
                setScannerId(newScannerId);
            }
            if (newServerIp && newServerIp !== serverIp) {
                console.log('🔄 Updating serverIp from storage:', newServerIp);
                setServerIp(newServerIp);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [scannerId, serverIp]);

    // Verify scanner is still paired on startup
    useEffect(() => {
        const verifyScannerPairing = async () => {
            if (scannerId) {
                try {
                    const verifyClient = axios.create({
                        httpsAgent: {
                            rejectUnauthorized: false // Allow self-signed certificates
                        }
                    });
                    const res = await verifyClient.get(`https://${serverIp}:5000/api/auth/check-scanner/${scannerId}`);
                    if (!res.data.valid) {
                        // Scanner no longer valid - unpair it
                        console.warn('Scanner no longer paired with backend');
                        localStorage.removeItem('SL_SCANNER_ID');
                        localStorage.removeItem('SL_USER_TOKEN');
                        localStorage.removeItem('SL_USER');
                        setScannerId(null);
                        setUser(null);
                        setIsLoggedIn(false);
                    }
                } catch (err) {
                    // Backend unreachable or scanner not found - unpair
                    console.error('Failed to verify scanner:', err);
                    localStorage.removeItem('SL_SCANNER_ID');
                    setScannerId(null);
                }
            }
        };

        verifyScannerPairing();
        verifyScannerPairing();
    }, [scannerId, serverIp]);

    // Heartbeat for Connection Status
    useEffect(() => {
        if (!isLoggedIn || !scannerId) return;

        const sendHeartbeat = async () => {
            try {
                await api.get('/api/mobile/ping');
            } catch (e) {
                console.warn('Heartbeat failed', e.message);
            }
        };

        sendHeartbeat(); // Initial
        const interval = setInterval(sendHeartbeat, 30000); // 30s
        return () => clearInterval(interval);
    }, [isLoggedIn, scannerId, api]);

    const fetchMissing = async () => {
        setLoadingMissing(true);
        try {
            const res = await api.get('/api/mobile/missing-scans');
            setMissing(res.data || []);
        } catch (err) {
            console.error('Failed to fetch missing scans:', err);
            setMissing([]);
        } finally {
            setLoadingMissing(false);
        }
    };

    // Auto-fetch missing scans every 10 seconds
    useEffect(() => {
        if (isLoggedIn) {
            fetchMissing();
            const interval = setInterval(fetchMissing, 10000);
            return () => clearInterval(interval);
        }
    }, [serverIp, isLoggedIn]);

    return (
        <MobileContext.Provider value={{
            serverIp,
            setServerIp: updateIp,
            api,
            isLoggedIn,
            user,
            scannerId,
            missing,
            loadingMissing,
            loginUser,
            logout,
            pairScanner,
            unpair,
            fetchMissing,
            deferredPrompt,
            installApp,
            THEME
        }}>
            {children}
        </MobileContext.Provider>
    );
};

export const useMobile = () => useContext(MobileContext);
