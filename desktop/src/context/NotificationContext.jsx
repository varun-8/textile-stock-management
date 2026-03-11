/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

const Toast = ({ message, type, onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '🔔';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return 'var(--success-color)';
            case 'error': return 'var(--error-color)';
            case 'warning': return 'var(--warning-color)';
            case 'info': return 'var(--accent-color)';
            default: return 'var(--text-primary)';
        }
    };

    const getBg = () => {
        switch (type) {
            case 'success': return 'var(--success-bg)';
            case 'error': return 'var(--error-bg)';
            case 'warning': return 'rgba(245, 158, 11, 0.1)';
            case 'info': return 'var(--accent-bg)';
            default: return 'var(--bg-tertiary)';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            minWidth: '320px',
            maxWidth: '450px',
            background: 'var(--bg-secondary)',
            border: `1px solid ${getColor()}40`,
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            animation: 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(12px)',
            cursor: 'default'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: getBg(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
            }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: getColor(), textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                    {type}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.4' }}>
                    {message}
                </div>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.5,
                    transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.target.style.opacity = 1}
                onMouseOut={(e) => e.target.style.opacity = 0.5}
            >
                ×
            </button>
            <style>{`
                @keyframes toastIn {
                    from { transform: translateX(100%) scale(0.9); opacity: 0; }
                    to { transform: translateX(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, type }) => {
    if (!isOpen) return null;

    const getColor = () => {
        switch (type) {
            case 'danger': return 'var(--error-color)';
            case 'warning': return 'var(--warning-color)';
            default: return 'var(--accent-color)';
        }
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-fade-in" style={{
                width: '100%', maxWidth: '400px', background: 'var(--bg-secondary)',
                borderRadius: '16px', border: `1px solid var(--border-color)`,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
            }}>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: `${getColor()}20`, color: getColor(),
                        margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem'
                    }}>
                        {type === 'danger' ? '⚠️' : '❓'}
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>{title}</h3>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{message}</p>
                </div>
                <div style={{ padding: '1.25rem', background: 'var(--bg-tertiary)', display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'transparent', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1, padding: '0.8rem', borderRadius: '8px', border: 'none',
                            background: getColor(), color: 'white', fontWeight: '700', cursor: 'pointer'
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', resolve: null });

    const showNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        setNotifications((prev) => [...prev, { id, message, type }]);
    }, []);

    const showConfirm = useCallback((title, message, type = 'info') => {
        return new Promise((resolve) => {
            setModal({ isOpen: true, title, message, type, resolve });
        });
    }, []);

    const handleConfirm = () => {
        if (modal.resolve) modal.resolve(true);
        setModal({ ...modal, isOpen: false, resolve: null });
    };

    const handleCancel = () => {
        if (modal.resolve) modal.resolve(false);
        setModal({ ...modal, isOpen: false, resolve: null });
    };

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification, showConfirm }}>
            {children}
            {notifications.map((n) => (
                <Toast
                    key={n.id}
                    message={n.message}
                    type={n.type}
                    onClose={() => removeNotification(n.id)}
                />
            ))}
            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </NotificationContext.Provider>
    );
};
