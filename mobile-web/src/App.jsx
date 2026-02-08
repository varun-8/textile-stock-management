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
  const { scannerId } = useMobile();

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
      <Route path="/session" element={
        <ProtectedRoute>
          <SessionManager />
        </ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <SessionGuard>
            <WorkScreen />
          </SessionGuard>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
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
