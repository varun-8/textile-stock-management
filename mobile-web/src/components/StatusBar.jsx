import React from 'react';

export const StatusBar = ({ title, subtitle, icon = null, action = null }) => {
    return (
        <div className="h-16 bg-secondary border-b border-border flex items-center px-4 z-30 sticky top-0">
            <div className="flex items-center gap-3 flex-1">
                {icon && (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                         style={{ backgroundImage: 'linear-gradient(to bottom right, #6366f1, #4f46e5)' }}>
                        <span className="text-lg">{icon}</span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="text-textPrimary font-semibold text-sm truncate">{title}</div>
                    {subtitle && <div className="text-[11px] text-textSecondary truncate">{subtitle}</div>}
                </div>
            </div>
            {action && (
                <div className="ml-3">
                    {action}
                </div>
            )}
        </div>
    );
};

export default StatusBar;
