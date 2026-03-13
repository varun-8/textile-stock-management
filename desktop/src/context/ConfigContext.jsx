/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';

const ConfigContext = createContext();

// Sanitize a stored URL: strip any protocol, force https://, ensure :5000 port
const sanitizeUrl = (raw) => {
    if (!raw) return 'https://localhost:5000';
    let cleaned = raw.trim().replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/\/{2,}/g, '/');
    if (!cleaned.includes(':')) cleaned = `${cleaned}:5000`;
    return `https://${cleaned}`;
};

export const ConfigProvider = ({ children }) => {
    // Sanitize on startup so stale http:// values don't cause ERR_CONNECTION_REFUSED
    const [apiUrl, setApiUrl] = useState(() => {
        const stored = localStorage.getItem('API_URL');
        const safe = sanitizeUrl(stored);
        // Persist the sanitized value back so it's correct for future loads
        if (stored !== safe) localStorage.setItem('API_URL', safe);
        return safe;
    });

    const updateApiUrl = (newUrl) => {
        // Strip existing protocol and whitespace
        let cleaned = newUrl.trim().replace(/^https?:\/\//, '');

        // Remove double slash if user typed it by accident (e.g. stock-system.local//)
        cleaned = cleaned.replace(/\/{2,}/g, '/');

        // Ensure PORT if missing (assume 5000)
        if (!cleaned.includes(':')) cleaned = `${cleaned}:5000`;

        // Reconstruct strict HTTPS URL
        const formatted = `https://${cleaned}`;

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
