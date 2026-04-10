/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';

const ConfigContext = createContext();

const defaultProtocol = 'http';
const defaultApiUrl = `${defaultProtocol}://localhost:5001`;

// Normalize API URL while keeping production secure and local development simple.
const sanitizeUrl = (raw) => {
    if (!raw) return defaultApiUrl;

    let value = raw.trim();
    const hasProtocol = /^https?:\/\//i.test(value);
    
    let protocol = defaultProtocol;
    let host = value;

    if (hasProtocol) {
        try {
            const url = new URL(value);
            protocol = url.protocol.replace(':', '');
            host = url.host;
        } catch (e) {
            host = value.replace(/^https?:\/\//, '');
        }
    }

    // Ensure double slashes are removed from the host part
    host = host.replace(/\/{2,}/g, '/');

    // Ensure PORT if missing (default to 5001 for HTTP)
    if (!host.includes(':')) {
        host = `${host}:5001`;
    }

    // CRITICAL: Force consistency between protocol and port for local architecture.
    if (host.includes(':5000') && protocol === 'http') {
        protocol = 'https';
    } else if (host.includes(':5001') && protocol === 'https') {
        protocol = 'http';
    }

    const result = `${protocol}://${host}`;
    return result;
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
        const safe = sanitizeUrl(newUrl);
        setApiUrl(safe);
        localStorage.setItem('API_URL', safe);
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
