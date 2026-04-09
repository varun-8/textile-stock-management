import React, { useMemo, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MobileProvider, useMobile } from './context/MobileContext';
import { NotificationProvider } from './context/NotificationContext';
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

  // If scanner already paired, always show the app (eliminates flashing)
  if (scannerId) {
    return (
      <Routes>
        <Route path="/pin" element={<PinScreen />} />
        <Route path="/sessions" element={
          <ProtectedRoute>
            <SessionManager />
          </ProtectedRoute>
        } />
        <Route path="/*" element={
          <ProtectedRoute>
            <SessionGuard>
              <AppShell>
                <WorkScreen />
              </AppShell>
            </SessionGuard>
          </ProtectedRoute>
        } />
      </Routes>
    );
  }

  // If scanner was deleted or connection lost - show error screen
  if (scannerDeletedError) {
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

  // Fallback: No scanner paired, show setup
  return <SetupScreen />;
}

function App() {
  return (
    <MobileProvider>
      <NotificationProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </NotificationProvider>
    </MobileProvider>
  );
}

export default App;
