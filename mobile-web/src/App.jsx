import React from 'react';
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
    return <Navigate to="/session" replace />;
  }
  return children;
};

function AppContent() {
  const { scannerId, scannerDeletedError, setScannerDeletedError } = useMobile();

  // If scanner was deleted - show error screen
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

  // If no scanner ID, show setup screen (Global check)
  if (!scannerId) {
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
