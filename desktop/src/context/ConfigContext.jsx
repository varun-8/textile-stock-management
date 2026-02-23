import React, { createContext, useState, useContext, useEffect } from 'react';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    // Default to localhost for better reliability out-of-the-box
    const [apiUrl, setApiUrl] = useState(localStorage.getItem('API_URL') || 'https://localhost:5000');

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
