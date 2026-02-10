import React, { useMemo, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MobileProvider, useMobile } from './context/MobileContext';
import WorkScreen from './pages/WorkScreen';
import SetupScreen from './pages/SetupScreen';
import PinScreen from './pages/PinScreen';
import SessionManager from './pages/SessionManager';
import AppShell from './components/AppShell';

const ProtectedRoute = ({ children }) => {
  const employee = localStorage.getItem('employee');
  if (!employee) {
    return <Navigate to="/pin" replace />;
  }
  return children;
};

const SessionGuard = ({ children }) => {
  const sessionId = localStorage.getItem('active_session_id');
  if (!sessionId) {
    return <Navigate to="/sessions" replace />;
  }
  return children;
};

function AppContent() {
  const { scannerId, scannerDeletedError, setScannerDeletedError } = useMobile();

  // Detect if this is a "Repair/Setup" link
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
  const isSetupLink = queryParams.get('server') && queryParams.get('token');

  // If we JUST paired, we want to IGNORE the isSetupLink so we can transition to the app
  const [justPaired, setJustPaired] = React.useState(false);

  React.useEffect(() => {
    if (scannerId && isSetupLink) {
      setJustPaired(true);
    }
  }, [scannerId, isSetupLink]);

  if (isSetupLink && !justPaired) {
    console.log("🔗 Setup Link Detected - Active:", Object.fromEntries(queryParams));
  }

  // If scanner was deleted - show error screen (UNLESS we are trying to setup)
  if (scannerDeletedError && !isSetupLink) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '20px', fontSize: '48px' }}>⚠️</div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px' }}>Site Cannot Be Reached</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '300px', margin: '0 0 30px', lineHeight: '1.5' }}>
          {scannerDeletedError}
        </p>
        <button
          onClick={() => {
            localStorage.clear();
            setScannerDeletedError(null);
            window.location.reload();
          }}
          style={{
            padding: '12px 24px',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Pair New Device
        </button>
      </div>
    );
  }

  // If no scanner ID OR we are setting up (and haven't just finished)
  if (!scannerId || (isSetupLink && !justPaired)) {
    return (
      <div className="transition-opacity duration-300 opacity-100">
        <SetupScreen />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/pin" element={<PinScreen />} />
      <Route path="/sessions" element={
        <ProtectedRoute>
          <SessionManager />
        </ProtectedRoute>
      } />
      <Route path="/work" element={
        <ProtectedRoute>
          <SessionGuard>
            <WorkScreen />
          </SessionGuard>
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/sessions" replace />} />
      <Route path="*" element={<Navigate to="/sessions" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <MobileProvider>
      <HashRouter>
        <AppShell>
          <AppContent />
        </AppShell>
      </HashRouter>
    </MobileProvider>
  );
}

export default App;
