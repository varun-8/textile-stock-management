import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile } from '../context/MobileContext';
import { haptic } from '../utils/haptic';

const PinScreen = () => {
    const { api, unpair } = useMobile();
    const navigate = useNavigate();

    // Steps: 'ID' -> 'PIN'
    const [step, setStep] = useState('ID');

    const [idNum, setIdNum] = useState('');
    const [pin, setPin] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDigit = (digit) => {
        setError('');
        if (haptic.light) haptic.light();

        if (step === 'ID') {
            if (idNum.length < 3) { // Allow up to 3 digits for ID (E999)
                setIdNum(prev => prev + digit);
            }
        } else {
            if (pin.length < 6) {
                setPin(prev => prev + digit);
            }
        }
    };

    const handleClear = () => {
        setError('');
        if (haptic.light) haptic.light();
        if (step === 'ID') setIdNum('');
        else setPin('');
    };

    const handleBackspace = () => {
        setError('');
        if (haptic.light) haptic.light();
        if (step === 'ID') setIdNum(prev => prev.slice(0, -1));
        else setPin(prev => prev.slice(0, -1));
    };

    const handleNext = () => {
        if (step === 'ID') {
            if (!idNum) {
                setError('Enter ID Number');
                if (haptic.error) haptic.error();
                return;
            }
            setStep('PIN');
        } else {
            handleLogin();
        }
    };

    const handleBack = () => {
        if (step === 'PIN') {
            setStep('ID');
            setPin('');
            setError('');
        }
    };

    const handleLogin = async () => {
        if (pin.length < 4) {
            setError('PIN too short');
            if (haptic.error) haptic.error();
            return;
        }

        setLoading(true);
        try {
            // Format ID: 1 -> E001, 12 -> E012
            const formattedId = `E${idNum.padStart(3, '0')}`;

            const res = await api.post('/api/employees/verify', {
                employeeId: formattedId,
                pin
            });

            if (res.data.success) {
                if (haptic.success) haptic.success();
                localStorage.setItem('employee', JSON.stringify({
                    ...res.data.employee,
                    loginTime: Date.now()
                }));
                navigate('/', { replace: true });
            } else {
                setError('Invalid credentials');
                if (haptic.error) haptic.error();
                setPin('');
            }
        } catch (err) {
            console.error(err);
            if (haptic.error) haptic.error();
            setError(err.response?.data?.error || 'Authentication Failed');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#09090b', color: '#fff', touchAction: 'none' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>

                {/* Header */}
                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#71717a', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
                        {step === 'ID' ? 'IDENTIFICATION' : `EMPLOYEE E${idNum.padStart(3, '0')}`}
                    </div>
                    <h2 style={{ margin: 0, letterSpacing: '0.1em', fontWeight: '800' }}>
                        {step === 'ID' ? 'ENTER ID NUMBER' : 'ENTER PIN'}
                    </h2>
                </div>

                {/* Display */}
                <div style={{
                    fontSize: '3rem', letterSpacing: '0.2em', marginBottom: '3rem',
                    height: '60px', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace'
                }}>
                    {step === 'ID' ? (
                        <span>
                            <span style={{ color: '#52525b' }}>E</span>
                            {idNum || <span style={{ opacity: 0.3 }}>000</span>}
                        </span>
                    ) : (
                        '•'.repeat(Math.max(pin.length, 4))
                    )}
                </div>

                {error && <div style={{ color: '#ef4444', marginBottom: '1.5rem', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>{error}</div>}

                {/* Keypad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', width: '100%', maxWidth: '320px', marginBottom: '2rem' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleDigit(num)}
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                                height: '70px', borderRadius: '20px',
                                fontSize: '1.75rem', fontWeight: '600',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                cursor: 'pointer', active: { transform: 'scale(0.95)' }
                            }}
                        >
                            {num}
                        </button>
                    ))}
                    <button onClick={handleClear} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1rem', fontWeight: '700' }}>CLR</button>
                    <button
                        onClick={() => handleDigit(0)}
                        style={{
                            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                            height: '70px', borderRadius: '20px',
                            fontSize: '1.75rem', fontWeight: '600',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                    >0</button>
                    <button onClick={handleBackspace} style={{ background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '1.5rem' }}>⌫</button>
                </div>

                {/* Actions */}
                <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '1.2rem', background: '#6366f1', border: 'none',
                            borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '1.1rem',
                            opacity: loading ? 0.5 : 1,
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                    >
                        {loading ? 'VERIFYING...' : (step === 'ID' ? 'NEXT' : 'LOGIN')}
                    </button>

                    {step === 'PIN' ? (
                        <button
                            onClick={handleBack}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.9rem', padding: '1rem' }}
                        >
                            Back to ID
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (window.confirm('Unpair device?')) unpair();
                            }}
                            style={{
                                background: 'transparent', border: 'none', color: '#52525b',
                                fontSize: '0.8rem', padding: '1rem'
                            }}
                        >
                            Unpair Device
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PinScreen;
