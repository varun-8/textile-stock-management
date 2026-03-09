import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getColors = () => {
        switch (type) {
            case 'success': return { bg: '#10b981', icon: '✅' };
            case 'error': return { bg: '#ef4444', icon: '⚠️' };
            case 'warning': return { bg: '#f59e0b', icon: '🚩' };
            default: return { bg: '#6366f1', icon: 'ℹ️' };
        }
    };

    const { bg, icon } = getColors();

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            width: 'calc(100% - 32px)',
            maxWidth: '380px',
            background: bg,
            color: 'white',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{message}</div>
            <button
                onClick={onClose}
                style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                }}
            >
                ×
            </button>
            <style>{`
                @keyframes slideDown {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        setNotifications((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            {notifications.map((n) => (
                <Toast
                    key={n.id}
                    message={n.message}
                    type={n.type}
                    onClose={() => removeNotification(n.id)}
                />
            ))}
        </NotificationContext.Provider>
    );
};
