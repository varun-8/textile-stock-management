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
    const [scannerDeletedError, setScannerDeletedError] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(() => {
        return window.deferredPrompt || null;
    });
    const [canInstall, setCanInstall] = useState(!!window.deferredPrompt);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            console.log('📱 beforeinstallprompt event fired');
            setDeferredPrompt(e);
            setCanInstall(true);
            window.deferredPrompt = e;
        };

        const handleAppInstalled = () => {
            console.log('✅ App installed');
            setDeferredPrompt(null);
            setCanInstall(false);
            window.deferredPrompt = null;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const installApp = async () => {
        if (!deferredPrompt) {
            console.warn('⚠️ No install prompt available');
            return false;
        }
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`📦 Install outcome: ${outcome}`);
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setCanInstall(false);
                window.deferredPrompt = null;
                return true;
            }
            return false;
        } catch (err) {
            console.error('Install error:', err);
            return false;
        }
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

    const pairScanner = async (token, url, name, existingScannerId = null) => {
        console.log('🔗 pairScanner called - Token:', token, 'URL:', url, 'Name:', name, 'ID:', existingScannerId);

        // Extract IP from URL (handle both http:// and https://)
        let ip = url.replace(/https?:\/\//, '').split(':')[0]; // Get just the IP
        console.log('📍 Extracted IP:', ip);

        try {
            // Temporary client for pairing (since we don't have scannerId header yet)
            const pairClient = axios.create({
                baseURL: `https://${ip}:5000`,
                httpsAgent: { rejectUnauthorized: false }
            });

            // PRE-CHECK: Detect if device is already paired before attempting pairing
            console.log('🔍 Checking for already-paired device...');
            try {
                const checkRes = await pairClient.post('/api/auth/check-device', {
                    ip: ip,
                    fingerprint: localStorage.getItem('SL_FINGERPRINT') || null
                });

                if (checkRes.data.alreadyPaired) {
                    console.warn('⚠️ Device Already Paired:', checkRes.data);
                    throw new Error(
                        `ALREADY_PAIRED: ${checkRes.data.message}. ` +
                        `Use the repair link for "${checkRes.data.name}" if you need to reconnect.`
                    );
                }
            } catch (checkErr) {
                // If check fails, proceed anyway (backend might be old version)
                if (checkErr.response?.status === 409) {
                    throw checkErr; // Re-throw duplicate conflict
                }
                console.log('ℹ️ Pre-check skipped (backend may not support it yet)');
            }

            console.log('🌐 Authenticating with Token...');
            // Exchange Setup Token for Unique Scanner ID
            const res = await pairClient.post('/api/auth/pair', {
                token: token,
                name: name || `Mobile - ${new Date().toLocaleTimeString()}`,
                scannerId: existingScannerId // Optional Re-pair ID
            });

            if (!res.data.success || !res.data.scannerId) {
                throw new Error('Pairing response invalid');
            }

            const newScannerId = res.data.scannerId;
            const newFingerprint = res.data.fingerprint;
            console.log('✅ Pairing Successful! Assigned ID:', newScannerId);
            console.log('🖐️ Device Fingerprint:', newFingerprint);

            // Save to localStorage
            localStorage.setItem('SL_SCANNER_ID', newScannerId);
            localStorage.setItem('SL_SERVER_IP', ip);
            if (newFingerprint) {
                localStorage.setItem('SL_FINGERPRINT', newFingerprint);
                console.log('💾 Fingerprint saved to localStorage');
            }

            if (res.data.name) {
                localStorage.setItem('SL_SCANNER_NAME', res.data.name);
                console.log('📝 Scanner Assigned Name:', res.data.name);
            }

            // Update Context State
            setScannerId(newScannerId);
            setServerIp(ip);

            // 🧹 Clear URL parameters to prevent auto-re-pairing loops if scanner is deleted later
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

            console.log('✅ Pairing complete - State updated & URL cleaned');
        } catch (err) {
            console.error('❌ Pairing Error:', err);
            
            // Handle specific error types
            if (err.message?.includes('ALREADY_PAIRED')) {
                throw new Error(err.message);
            }

            if (err.response?.status === 409) {
                const data = err.response.data;
                const errorMsg = `${data.message}\n\nScanner Name: ${data.existingName}\n${data.suggestion || ''}`;
                throw new Error(errorMsg);
            }

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
                    
                    // Include employee data if logged in
                    const employee = localStorage.getItem('employee');
                    const employeeParam = employee ? `?employee=${encodeURIComponent(employee)}` : '';
                    
                    const res = await verifyClient.get(`https://${serverIp}:5000/api/auth/check-scanner/${scannerId}${employeeParam}`);
                    if (!res.data.valid) {
                        // Scanner no longer valid - unpair it
                        console.warn('Scanner no longer paired with backend');
                        localStorage.removeItem('SL_SCANNER_ID');
                        localStorage.removeItem('SL_USER_TOKEN');
                        localStorage.removeItem('SL_USER');
                        localStorage.removeItem('SL_FINGERPRINT');
                        setScannerId(null);
                        setUser(null);
                        setIsLoggedIn(false);
                        // NEW: Show deleted error state
                        setScannerDeletedError('Your scanner was removed from the system. Please pair again.');
                    }
                } catch (err) {
                    // Backend unreachable or scanner not found - unpair
                    console.error('Failed to verify scanner:', err);
                    
                    if (err.response?.status === 404) {
                        // Scanner specifically not found (deleted)
                        console.warn('❌ Scanner was deleted from backend');
                        localStorage.removeItem('SL_SCANNER_ID');
                        localStorage.removeItem('SL_USER_TOKEN');
                        localStorage.removeItem('SL_USER');
                        localStorage.removeItem('SL_FINGERPRINT');
                        setScannerId(null);
                        setUser(null);
                        setIsLoggedIn(false);
                        setScannerDeletedError('Your scanner was deleted. Please pair a new device.');
                    } else if (err.message?.includes('Network Error') || err.code === 'ECONNREFUSED') {
                        // Server unreachable (network error, not deletion)
                        console.warn('⚠️ Server unreachable');
                        setScannerDeletedError('Cannot reach server. Check your connection.');
                    }
                }
            }
        };

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
            scannerDeletedError,
            setScannerDeletedError,
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
