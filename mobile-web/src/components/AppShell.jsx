import React, { useEffect, useState } from 'react';
import InstallPrompt from './InstallPrompt';

export const AppShell = ({ children, isLoading = false }) => {
    const [safeAreaInsets, setSafeAreaInsets] = useState({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
    });

    useEffect(() => {
        // Get safe area insets for notched devices
        const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0;
        const bottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')) || 0;

        setSafeAreaInsets({ top, bottom, left: 0, right: 0 });
    }, []);

    return (
        <div className="min-h-screen bg-primary text-textPrimary flex flex-col overflow-hidden"
            style={{
                paddingTop: `${safeAreaInsets.top}px`,
                paddingBottom: `${safeAreaInsets.bottom}px`
            }}>
            {isLoading && (
                <div className="absolute inset-0 z-50 bg-primary/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 rounded-full border-3 border-accent/30 border-t-accent animate-spin mx-auto mb-3"></div>
                        <p className="text-sm font-medium text-textSecondary">Loading...</p>
                    </div>
                </div>
            )}
            {children}
            <InstallPrompt />
        </div>
    );
};

export default AppShell;
