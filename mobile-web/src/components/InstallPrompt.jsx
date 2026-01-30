import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI to notify the user they can add to home screen
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '90%',
            width: '400px',
            backgroundColor: '#1e293b', // Secondary color
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #334155'
        }}>
            <div style={{ marginRight: '15px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '14px', fontWeight: 'bold' }}>
                    Install App
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                    Add to Home Screen for offline access
                </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setShowPrompt(false)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        padding: '8px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    ✕
                </button>
                <button
                    onClick={handleInstallClick}
                    style={{
                        backgroundColor: '#6366f1', // Accent
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Install
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
