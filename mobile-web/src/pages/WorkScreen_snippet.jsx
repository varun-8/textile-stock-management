/* ... existing code ... */

// In WorkScreen.jsx

useEffect(() => {
    // Load Session Info
    const sType = localStorage.getItem('active_session_type');
    const sSize = localStorage.getItem('active_session_size');
    const sId = localStorage.getItem('active_session_id');

    if (sType && sId) {
        setSessionMode(sType); // Lock mode
        // setSessionSize(sSize); // Store size for display
    }
}, []);

// ...

const handleBarCodeScanned = async (data) => {
    // ...
    try {
        const sessionId = localStorage.getItem('active_session_id');
        const url = `/api/mobile/scan/${formattedBarcode}`;
        const res = await api.get(url, {
            headers: { 'x-session-id': sessionId }
        });
        const json = res.data;

        if (json.status === 'WRONG_SIZE') {
            haptic.error();
            showAlert(`🛑 WRONG SIZE!\n\nExpected: ${json.expected}\nScanned: ${json.actual}`, 'error');
            setScanned(false);
            scanningRef.current = false;
            return;
        }

        if (json.status === 'SESSION_ENDED') {
            haptic.error();
            showAlert('Session has ended. Redirecting...', 'error');
            setTimeout(() => {
                localStorage.removeItem('active_session_id');
                window.location.reload();
            }, 2000);
            return;
        }

        // ... rest of logic
    }
        // ...
    }

/* ... */
