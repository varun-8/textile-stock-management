// Haptic Feedback API - Works on Android Chrome
export const haptic = {
    // Light feedback
    light: () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
    },
    
    // Medium feedback
    medium: () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(30);
        }
    },
    
    // Strong feedback
    strong: () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    },
    
    // Pattern: double tap
    pattern: (pattern = [30, 50, 30]) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    // Success pattern
    success: () => {
        if ('vibrate' in navigator) {
            navigator.vibrate([20, 50, 20, 50, 20]);
        }
    },

    // Error pattern
    error: () => {
        if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50]);
        }
    }
};

export default haptic;
