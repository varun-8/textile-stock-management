/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';

const ConfigContext = createContext();

const defaultProtocol = 'https';
const defaultApiUrl = `${defaultProtocol}://localhost:5000`;

// Normalize API URL while keeping production secure and local development simple.
const sanitizeUrl = (raw) => {
    if (!raw) return defaultApiUrl;

    const value = raw.trim();
    const hasProtocol = /^https?:\/\//i.test(value);
    const parsed = hasProtocol ? new URL(value) : null;

    let protocol = hasProtocol ? parsed.protocol.replace(':', '') : defaultProtocol;
    let cleaned = hasProtocol ? parsed.host : value.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/\/{2,}/g, '/');
    if (!cleaned.includes(':')) cleaned = `${cleaned}:5000`;

    return `${protocol}://${cleaned}`;
};

export const ConfigProvider = ({ children }) => {
    // Sanitize on startup so stale protocol/port values do not break connectivity.
    const [apiUrl, setApiUrl] = useState(() => {
        const stored = localStorage.getItem('API_URL');
        const safe = sanitizeUrl(stored);
        // Persist the sanitized value back so it's correct for future loads
        if (stored !== safe) localStorage.setItem('API_URL', safe);
        return safe;
    });

    const updateApiUrl = (newUrl) => {
        const value = newUrl.trim();
        if (!value) {
            setApiUrl(defaultApiUrl);
            localStorage.setItem('API_URL', defaultApiUrl);
            return;
        }
        const hasProtocol = /^https?:\/\//i.test(value);
        const parsed = hasProtocol ? new URL(value) : null;

        let protocol = hasProtocol ? parsed.protocol.replace(':', '') : defaultProtocol;
        let cleaned = hasProtocol ? parsed.host : value.replace(/^https?:\/\//, '');

        // Remove double slash if user typed it by accident (e.g. stock-system.local//)
        cleaned = cleaned.replace(/\/{2,}/g, '/');

        // Ensure PORT if missing (assume 5000)
        if (!cleaned.includes(':')) cleaned = `${cleaned}:5000`;

        const formatted = `${protocol}://${cleaned}`;

        setApiUrl(formatted);
        localStorage.setItem('API_URL', formatted);
    };

    // Theme
    const [theme, setTheme] = useState(localStorage.getItem('THEME') || 'light');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('THEME', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ConfigContext.Provider value={{ apiUrl, updateApiUrl, theme, toggleTheme }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
