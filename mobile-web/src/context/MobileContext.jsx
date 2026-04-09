import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const MobileContext = createContext();

const DEFAULT_IP = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? window.location.hostname
    : 'stock-system.local';
const DISCOVERY_TIMEOUT_MS = 1200;
const DEV_HTTP_PORT = 5001;
const DEV_HTTPS_PORT = 5000;
const SETUP_TIMEOUT_MS = 6000;

const normalizeHost = (value) => {
    if (!value) return '';
    return String(value).trim().replace(/^https?:\/\//, '').replace(/:\d+.*$/, '');
};

const normalizeBaseUrl = (value) => {
    if (!value) return '';
    const text = String(value).trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(text) ? text : '';
};

const buildBaseUrls = (value) => {
    const normalizedBase = normalizeBaseUrl(value);
    const isNative = Capacitor.isNativePlatform();

    if (normalizedBase) {
        const candidates = [];
        
        try {
            const parsed = new URL(normalizedBase);
            const host = parsed.hostname;
            if (host) {
                // For Native Apps, ALWAYS try HTTP 5001 first to bypass self-signed cert issues
                if (isNative) {
                    candidates.push(`http://${host}:${DEV_HTTP_PORT}`);
                }
                candidates.push(normalizedBase);
                candidates.push(`http://${host}:${DEV_HTTP_PORT}`);
                candidates.push(`http://${host}:${DEV_HTTPS_PORT}`);
                candidates.push(`https://${host}:${DEV_HTTPS_PORT}`);
            }
        } catch (e) {
            candidates.push(normalizedBase);
        }

        return [...new Set(candidates)];
    }

    const host = normalizeHost(value);
    if (!host) return [];

    const defaultCandidates = [
        `http://${host}:${DEV_HTTP_PORT}`,
        `http://${host}:${DEV_HTTPS_PORT}`,
        `https://${host}:${DEV_HTTPS_PORT}`
    ];

    return isNative ? defaultCandidates : defaultCandidates.reverse();
};

const uniqueHosts = (values) => [...new Set(values.map(normalizeHost).filter(Boolean))];

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
    const [serverIp, setServerIp] = useState(() => {
        const saved = localStorage.getItem('SL_SERVER_IP');
        const current = window.location.hostname;
        // Auto-update if accessed via a network IP/hostname
        if (current && current !== 'localhost' && current !== '127.0.0.1' && current !== saved) {
            localStorage.setItem('SL_SERVER_IP', current);
            return current;
        }
        return saved || DEFAULT_IP;
    });
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
    const [workspaceCode, setWorkspaceCode] = useState(() => localStorage.getItem('SL_WORKSPACE_CODE') || '');
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

    const api = useMemo(() => axios.create(), []);

    const probeHost = useCallback(async (host) => {
        const baseUrls = buildBaseUrls(host);
        if (baseUrls.length === 0) return null;

        for (const baseURL of baseUrls) {
            try {
                const client = axios.create({
                    baseURL,
                    timeout: DISCOVERY_TIMEOUT_MS
                });

                const res = await client.get('/api/auth/discovery/ping');
                return {
                    host: normalizeHost(baseURL),
                    baseURL,
                    workspaceCode: res.data?.workspaceCode || '',
                    serverIp: res.data?.serverIp || normalizeHost(baseURL)
                };
            } catch (err) {
                // Try the next candidate URL.
            }
        }

        return null;
    }, []);

    const discoverBackend = useCallback(async (hintHost = null) => {
        const saved = localStorage.getItem('SL_SERVER_IP');
        const current = window.location.hostname;
        const candidates = uniqueHosts([
            hintHost,
            saved,
            current,
            DEFAULT_IP,
            'localhost',
            '127.0.0.1'
        ]);

        for (const host of candidates) {
            // eslint-disable-next-line no-await-in-loop
            const result = await probeHost(host);
            if (result) {
                localStorage.setItem('SL_SERVER_IP', result.host);
                if (result.workspaceCode) {
                    localStorage.setItem('SL_WORKSPACE_CODE', result.workspaceCode);
                    setWorkspaceCode(result.workspaceCode);
                }
                setServerIp(result.host);
                return result.host;
            }
        }

        return null;
    }, [probeHost]);

    useEffect(() => {
        const savedOrigin = localStorage.getItem('SL_SERVER_ORIGIN');
        const fallbackOrigin = buildBaseUrls(serverIp)[0] || `http://${serverIp}:${DEV_HTTP_PORT}`;
        api.defaults.baseURL = normalizeBaseUrl(savedOrigin) || fallbackOrigin;
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

    useEffect(() => {
        const bootstrapDiscovery = async () => {
            const saved = localStorage.getItem('SL_SERVER_IP');
            const savedOrigin = localStorage.getItem('SL_SERVER_ORIGIN');
            const current = window.location.hostname;

            if (!saved && !current) return;

            const currentHost = normalizeHost(serverIp || saved || current || DEFAULT_IP);
            const result = await probeHost(currentHost);
            if (result) {
                if (result.host !== serverIp) {
                    setServerIp(result.host);
                }
                if (result.workspaceCode && result.workspaceCode !== workspaceCode) {
                    setWorkspaceCode(result.workspaceCode);
                }
                localStorage.setItem('SL_SERVER_IP', result.host);
                localStorage.setItem('SL_SERVER_ORIGIN', result.baseURL);
                if (result.workspaceCode) {
                    localStorage.setItem('SL_WORKSPACE_CODE', result.workspaceCode);
                }
                return;
            }

            const discovered = await discoverBackend(currentHost);
            if (!discovered && savedOrigin) {
                localStorage.setItem('SL_SERVER_ORIGIN', normalizeBaseUrl(savedOrigin) || savedOrigin);
            }
        };

        bootstrapDiscovery();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateIp = useCallback((ip) => {
        setServerIp(ip);
        localStorage.setItem('SL_SERVER_IP', ip);
        const nextOrigin = buildBaseUrls(ip)[0];
        if (nextOrigin) {
            localStorage.setItem('SL_SERVER_ORIGIN', nextOrigin);
        }
    }, []);

    const loginUser = useCallback(async (username, password) => {
        try {
            const res = await api.post('/api/auth/login', {
                username,
                password,
                scannerId,
                workspaceCode
            });
            localStorage.setItem('SL_USER_TOKEN', 'mobile-session');
            localStorage.setItem('SL_USER', JSON.stringify(res.data.user));
            setUser(res.data.user);
            setIsLoggedIn(true);
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Login failed');
        }
    }, [api, scannerId, workspaceCode]);

    const logout = useCallback(() => {
        localStorage.removeItem('SL_USER_TOKEN');
        localStorage.removeItem('SL_USER');
        localStorage.removeItem('employee'); // Clear PIN session
        setUser(null);
        setIsLoggedIn(false);
    }, []);

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

    // Unified Pairing Function (QR / Manual)
    const setupDevice = useCallback(async (ip, token, name = null, allowDiscoveryRetry = true) => {
        console.log('🔗 setupDevice started - IP:', ip, 'Token:', token);

        try {
            const existingId = localStorage.getItem('SL_SCANNER_ID');
            const candidateBases = [
                ...buildBaseUrls(ip),
                ...buildBaseUrls(localStorage.getItem('SL_SERVER_ORIGIN')),
                ...buildBaseUrls(serverIp),
                ...buildBaseUrls(window.location.hostname),
                ...buildBaseUrls(DEFAULT_IP)
            ];
            const candidateHosts = [...new Set(candidateBases)];
            console.log('🔍 Candidate Hosts for pairing:', candidateHosts);
            let res = null;
            let connectedBase = null;
            let lastError = null;

            for (const baseURL of candidateHosts) {
                try {
                    const setupClient = axios.create({
                        baseURL,
                        timeout: SETUP_TIMEOUT_MS
                    });

                    res = await setupClient.post('/api/auth/pair', {
                        token: token,
                        name: name || 'AUTO_ASSIGN',
                        scannerId: existingId,
                        workspaceCode
                    });
                    connectedBase = baseURL;
                    break;
                } catch (err) {
                    lastError = err;
                    const status = err.response?.status;
                    const errorText = `${err.response?.data?.error || err.response?.data?.message || err.message || ''}`.toLowerCase();
                    const retryable = (
                        !status && (
                            err.code === 'ECONNABORTED' ||
                            err.code === 'ERR_NETWORK' ||
                            err.message === 'Network Error' ||
                            /abort|certificate|tls|fetch/i.test(err.message || '')
                        )
                        || status === 401
                        || status === 403
                        || status === 404
                        || status === 408
                        || status === 409
                        || status === 429
                        || status >= 500
                        || errorText.includes('request aborted')
                        || errorText.includes('invalid or expired link')
                        || errorText.includes('workspace')
                    );

                    if (!retryable || baseURL === candidateHosts[candidateHosts.length - 1]) {
                        throw lastError || err;
                    }
                }
            }

            if (!res) {
                throw new Error('Unable to reach the backend. Please check the network or scan a fresh QR code.');
            }

            if (!res.data.success || !res.data.scannerId) {
                throw new Error(res.data.error || 'Pairing response invalid');
            }

            const newScannerId = res.data.scannerId;
            const newFingerprint = res.data.fingerprint;

            console.log('✅ Pairing Successful!', newScannerId);

            localStorage.setItem('SL_SCANNER_ID', newScannerId);
            localStorage.setItem('SL_SERVER_ORIGIN', connectedBase || localStorage.getItem('SL_SERVER_ORIGIN') || buildBaseUrls(ip)[0] || '');
            localStorage.setItem('SL_SERVER_IP', normalizeHost(connectedBase || ip));
            localStorage.setItem('SL_WORKSPACE_CODE', workspaceCode || res.data.workspaceCode || '');
            if (newFingerprint) localStorage.setItem('SL_FINGERPRINT', newFingerprint);
            if (res.data.name) localStorage.setItem('SL_SCANNER_NAME', res.data.name);

            setScannerId(newScannerId);
            setServerIp(normalizeHost(connectedBase || ip));
            if (res.data.workspaceCode) {
                setWorkspaceCode(res.data.workspaceCode);
            }
            setScannerDeletedError(null);

            return true;
        } catch (err) {
            if (!err.response && allowDiscoveryRetry) {
                const discovered = await discoverBackend(ip);
                if (discovered) {
                    return setupDevice(discovered, token, name, false);
                }
            }
            console.error('❌ Setup Error:', err);
            const rawMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Setup Failed';
            const normalizedMsg = String(rawMsg).toLowerCase();
            const msg = (!err.response && (
                normalizedMsg.includes('request aborted') ||
                normalizedMsg.includes('network error') ||
                normalizedMsg.includes('failed to fetch') ||
                normalizedMsg.includes('ecconnaborted') ||
                normalizedMsg.includes('err_network')
            ))
                ? `Network Error: ${rawMsg}`
                : rawMsg;
            throw new Error(msg);
        }
    }, [serverIp, workspaceCode, discoverBackend]);

    const unpair = () => {
        localStorage.removeItem('SL_SCANNER_ID');
        localStorage.removeItem('SL_SERVER_IP');
        localStorage.removeItem('SL_SERVER_ORIGIN');
        localStorage.removeItem('SL_SCANNER_NAME');
        localStorage.removeItem('SL_FINGERPRINT');
        localStorage.removeItem('active_session_id');
        localStorage.removeItem('active_session_type');
        localStorage.removeItem('active_session_size');
        setScannerId(null);
        setServerIp(DEFAULT_IP);
        setScannerDeletedError(null);
        logout();
    };

    // Listen for localStorage changes (for cross-tab or programmatic updates)
    useEffect(() => {
        const handleStorageChange = () => {
            console.log('📦 localStorage change detected');
            const newScannerId = localStorage.getItem('SL_SCANNER_ID');
            const newServerIp = localStorage.getItem('SL_SERVER_IP');
            const newServerOrigin = localStorage.getItem('SL_SERVER_ORIGIN');
            if (newScannerId !== scannerId) {
                console.log('🔄 Updating scannerId from storage:', newScannerId);
                setScannerId(newScannerId);
            }
            if (newServerIp && newServerIp !== serverIp) {
                console.log('🔄 Updating serverIp from storage:', newServerIp);
                setServerIp(newServerIp);
            }
            if (newServerOrigin && normalizeBaseUrl(newServerOrigin) !== normalizeBaseUrl(api.defaults.baseURL)) {
                api.defaults.baseURL = normalizeBaseUrl(newServerOrigin) || api.defaults.baseURL;
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [scannerId, serverIp]);

    // Verify scanner is still paired on startup
    useEffect(() => {
        let isAborted = false;
        
        const verifyScannerPairing = async () => {
            if (scannerId) {
                // NEW: Add a 10-second delay for stability on new pairings
                // This prevents the "flash" back to the setup screen
                await new Promise(resolve => setTimeout(resolve, 10000));
                if (isAborted) return;

                try {
                    const verifyClient = axios.create();

                    // Include employee data if logged in
                    const employee = localStorage.getItem('employee');
                    const employeeParam = employee ? `?employee=${encodeURIComponent(employee)}` : '';

                    const workspaceParam = workspaceCode ? `&workspaceCode=${encodeURIComponent(workspaceCode)}` : '';
                    const verifyBase = normalizeBaseUrl(localStorage.getItem('SL_SERVER_ORIGIN')) || api.defaults.baseURL || buildBaseUrls(serverIp)[0] || `http://${serverIp}:${DEV_HTTP_PORT}`;
                    const res = await verifyClient.get(`${verifyBase}/api/auth/check-scanner/${scannerId}${employeeParam}${workspaceParam}`);
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
                    } else if (err.response?.status === 402) {
                        setScannerDeletedError(err.response?.data?.error || 'License activation required.');
                    } else if (err.message?.includes('Network Error') || err.code === 'ECONNREFUSED' || !err.response) {
                        // Server unreachable (network error, not deletion)
                        // DO NOT setScannerId(null) here. STAY PAIRED.
                        console.warn('⚠️ Server unreachable - keeping paired state');
                        setScannerDeletedError('Cannot reach server. Check your connection.');
                        // Attempt to rediscover the working IP/Port
                        await discoverBackend(serverIp);
                    }
                }
            }
        };

        verifyScannerPairing();
        return () => { isAborted = true; };
    }, [scannerId, serverIp, discoverBackend]);

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

    const contextValue = useMemo(() => ({
        serverIp,
        setServerIp: updateIp,
        api,
        isLoggedIn,
        user,
        scannerId,
        workspaceCode,
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
    }), [serverIp, updateIp, api, isLoggedIn, user, scannerId, workspaceCode, scannerDeletedError, missing, loadingMissing, loginUser, logout, setupDevice, deferredPrompt, installApp]);

    return (
        <MobileContext.Provider value={contextValue}>
            {children}
        </MobileContext.Provider>
    );
};

export const useMobile = () => useContext(MobileContext);
