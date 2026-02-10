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

        // Add interceptor to catch 403 (Scanner Deleted/Disabled) globally
        const interceptor = api.interceptors.response.use(
            response => response,
            error => {
                if (error.response && (error.response.status === 403 || error.response.status === 401)) {
                    const errMsg = error.response.data?.error || '';
                    // Only auto-logout if it's clearly a scanner auth issue
                    if (errMsg.includes('Scanner') || errMsg.includes('Unauthorized')) {
                        console.warn('🚨 Global 403 Interceptor: Scanner invalid. Clearing session.');
                        localStorage.removeItem('SL_SCANNER_ID');
                        localStorage.removeItem('SL_USER_TOKEN');
                        localStorage.removeItem('SL_USER');
                        localStorage.removeItem('SL_FINGERPRINT');
                        setScannerId(null);
                        setUser(null);
                        setIsLoggedIn(false);
                        setScannerDeletedError('Device removed by admin. Please pair again.');
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptor);
        };
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
        localStorage.removeItem('employee'); // Clear PIN session
        setUser(null);
        setIsLoggedIn(false);
    };

    // Session Expiration Check (24 Hours)
    useEffect(() => {
        const checkSession = () => {
            const employeeData = localStorage.getItem('employee');
            if (employeeData) {
                try {
                    const { loginTime } = JSON.parse(employeeData);
                    if (loginTime) {
                        const now = Date.now();
                        const hours24 = 24 * 60 * 60 * 1000;
                        if (now - loginTime > hours24) {
                            console.warn('Session expired (24h). Logging out.');
                            logout();
                            window.location.reload(); // Force redirect to PIN
                        }
                    }
                } catch (e) {
                    // Invalid JSON, clear it
                    logout();
                }
            }
        };

        checkSession(); // Check on mount
        const interval = setInterval(checkSession, 60 * 1000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    // Auto-fetch missing scans every 10 seconds
    useEffect(() => {
        if (isLoggedIn) {
            fetchMissing();
            const interval = setInterval(fetchMissing, 10000);
            return () => clearInterval(interval);
        }
    }, [serverIp, isLoggedIn]);

    // Unified Pairing Function (QR / Manual)
    const setupDevice = async (ip, token, name = null) => {
        console.log('🔗 setupDevice called - IP:', ip, 'Token:', token);

        try {
            // Temporary client for pairing
            const setupClient = axios.create({
                baseURL: `https://${ip}:5000`,
                httpsAgent: { rejectUnauthorized: false }
            });

            // 1. Pre-Check (Optional but good)
            try {
                // We can skip pre-check for now to speed up, or keep it.
                // Let's go straight to pair for speed.
            } catch (e) { }

            console.log('🌐 Authenticating setup...');

            // Get existing ID if any (to support Re-Pairing)
            const existingId = localStorage.getItem('SL_SCANNER_ID');

            // 2. Perform Pairing Request (Smart Pairing)
            const res = await setupClient.post('/api/auth/pair', {
                token: token, // The "Secret" from QR
                name: name || 'AUTO_ASSIGN',
                scannerId: existingId // Send existing ID to check if we can reconnect
            });

            if (!res.data.success || !res.data.scannerId) {
                throw new Error(res.data.error || 'Pairing response invalid');
            }

            const newScannerId = res.data.scannerId;
            const newFingerprint = res.data.fingerprint;

            console.log('✅ Pairing Successful!', newScannerId);

            // 3. Save Everything
            localStorage.setItem('SL_SCANNER_ID', newScannerId);
            localStorage.setItem('SL_SERVER_IP', ip);
            if (newFingerprint) localStorage.setItem('SL_FINGERPRINT', newFingerprint);
            if (res.data.name) localStorage.setItem('SL_SCANNER_NAME', res.data.name);

            // 4. Update State
            setScannerId(newScannerId);
            setServerIp(ip);
            // Clear any previous errors
            setScannerDeletedError(null);

            return true;
        } catch (err) {
            console.error('❌ Setup Error:', err);
            const msg = err.response?.data?.message || err.message || 'Setup Failed';
            throw new Error(msg);
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
            setupDevice,
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
