/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Desktop Theme Palette - Premium Indigo/Slate
                primary: '#0f172a',      // Deep dark primary (matching desktop --bg-primary)
                secondary: '#1e293b',    // Secondary panel bg (matching desktop --bg-secondary)
                surface: '#334155',      // Tertiary/surface (matching desktop --bg-tertiary)

                // Premium Indigo Accent (Primary Brand Color - matching desktop)
                accent: '#6366f1',       // Premium Indigo (matching desktop --accent-color)
                accentHover: '#4f46e5',  // Hover state (matching desktop --accent-hover)
                accentGlow: 'rgba(99, 102, 241, 0.4)',  // Shadow/glow effect

                // Success, Warning, Error (matching desktop theme)
                success: '#10b981',      // Green (matching desktop --success-color)
                successGlow: 'rgba(16, 185, 129, 0.1)',

                warning: '#f59e0b',      // Amber/Orange (matching desktop --warning-color)
                warningGlow: 'rgba(245, 158, 11, 0.1)',

                error: '#ef4444',        // Red (matching desktop --error-color)
                errorGlow: 'rgba(239, 68, 68, 0.1)',

                // Text Colors (matching desktop)
                textPrimary: '#f8fafc',      // Light text on dark
                textSecondary: '#94a3b8',    // Muted text

                // Utility
                border: '#334155',  // Border color
            },
            animation: {
                'scan': 'scan 2.5s linear infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.4s ease-out forwards',
            },
            keyframes: {
                scan: {
                    '0%': { top: '0%', opacity: 0 },
                    '10%': { opacity: 1 },
                    '90%': { opacity: 1 },
                    '100%': { top: '100%', opacity: 0 },
                },
                fadeIn: {
                    'from': { opacity: '0', transform: 'translateY(10px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },
    plugins: [],
}
