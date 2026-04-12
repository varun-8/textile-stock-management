/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';

const ConfigContext = createContext();

const defaultProtocol = 'http';

// Normalize API URL while keeping production secure and local development simple.
const sanitizeUrl = (raw, defaultPort = 5000) => {
    if (!raw) return `${defaultProtocol}://localhost:${defaultPort}`;

    let value = raw.trim();
    const hasProtocol = /^https?:\/\//i.test(value);
    let host = value;

    if (hasProtocol) {
        try {
            const url = new URL(value);
            host = url.host;
        } catch {
            host = value.replace(/^https?:\/\//, '');
        }
    } else {
        host = value.replace(/^https?:\/\//, '');
    }

    // Ensure double slashes are removed from the host part
    host = host.replace(/\/{2,}/g, '/');

    // Ensure PORT if missing
    if (!host.includes(':')) {
        host = `${host}:${defaultPort}`;
    }

    return `${defaultProtocol}://${host}`;
};

export const ConfigProvider = ({ children }) => {
    // Sanitize on startup so stale protocol/port values do not break connectivity.
    const [apiUrl, setApiUrl] = useState(() => {
        const stored = localStorage.getItem('API_URL');
        return sanitizeUrl(stored);
    });

    // Sync with Electron dynamic ports on startup
    useEffect(() => {
        const syncPort = async () => {
            if (window.electronAPI?.getApiConfig) {
                try {
                    const config = await window.electronAPI.getApiConfig();
                    if (config && (config.httpPort || config.httpsPort)) {
                        const current = localStorage.getItem('API_URL');
                        // Extract hostname from current or default to localhost
                        let hostname = 'localhost';
                        if (current) {
                            try { hostname = new URL(current).hostname; } catch {
                                // Invalid URL format, use default hostname
                            }
                        }
                        const backendPort = config.httpPort || 5000;
                        const newUrl = `http://${hostname}:${backendPort}`;
                        setApiUrl(newUrl);
                        localStorage.setItem('API_URL', newUrl);
                    }
                } catch (err) {
                    console.error("Failed to sync dynamic API port:", err);
                }
            }
        };
        syncPort();
    }, []);

    const updateApiUrl = (newUrl) => {
        const safe = sanitizeUrl(newUrl);
        setApiUrl(safe);
        localStorage.setItem('API_URL', safe);
    };

    // Theme
    const [theme, setTheme] = useState(localStorage.getItem('THEME') || 'light');
    const [companyName, setCompanyName] = useState('SRI LAKSHMI TEXTILES');

    // Fetch company name from active DC template on startup
    useEffect(() => {
        const fetchCompanyName = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/admin/config/dc-template`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.companyName) {
                        setCompanyName(data.companyName);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch company name for layout:", err);
            }
        };
        fetchCompanyName();
    }, [apiUrl]);

    const updateCompanyName = (name) => {
        setCompanyName(name);
    };

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('THEME', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ConfigContext.Provider value={{ apiUrl, updateApiUrl, theme, toggleTheme, companyName, updateCompanyName }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
