import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DetailedStats from './pages/DetailedStats';
import BarcodeGenerator from './pages/BarcodeGenerator';
import MobileScanner from './pages/MobileScanner';
import LicenseActivation from './pages/LicenseActivation';

import Scanners from './pages/Scanners';
import Configuration from './pages/Configuration';
import Settings from './pages/Settings';
import Employees from './pages/Employees';
import Sessions from './pages/Sessions';
import DeliveryChallans from './pages/DeliveryChallans';
import Quotations from './pages/Quotations';

const ProtectedRoute = ({ children }) => {
  const hasToken = !!localStorage.getItem('ADMIN_TOKEN');
  return hasToken ? children : <Navigate to="/" />;
};

import { ConfigProvider, useConfig } from './context/ConfigContext';
import { NotificationProvider } from './context/NotificationContext';
import AppLayout from './components/AppLayout';

// New ServerGuard component to ensure the backend is reachable before rendering the rest of the app.
const ServerGuard = ({ children }) => {
  const { apiUrl } = useConfig();
  const [serverReady, setServerReady] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loadingLicense, setLoadingLicense] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    const ping = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/license/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });
        const data = await response.json();
        setLicenseStatus(data);
        setServerReady(true);
        setLoadingLicense(false);
        clearInterval(pollRef.current);
      } catch {
        setAttempts(prev => prev + 1);
        setLoadingLicense(false);
      }
    };
    
    clearInterval(pollRef.current);
    
    ping(); // Immediate first attempt
    pollRef.current = setInterval(ping, 1000);
    return () => clearInterval(pollRef.current);
  }, [apiUrl]);

  if (!serverReady || loadingLicense) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)', opacity: 0.1, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>Initializing Core Systems</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', maxWidth: '300px', margin: '0 auto' }}>
            {attempts < 3 ? 'Connecting to local backend host...' : 'Backend still starting. Please wait...'}
          </p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (licenseStatus?.required && !licenseStatus?.active) {
    return (
      <LicenseActivation
        licenseStatus={licenseStatus}
        onActivated={async () => {
          try {
            const response = await fetch(`${apiUrl}/api/license/status`, {
              method: 'GET',
              signal: AbortSignal.timeout(2000)
            });
            const data = await response.json();
            setLicenseStatus(data);
          } catch (err) {
            console.error('Failed to refresh license status after activation', err);
          }
        }}
      />
    );
  }

  return children;
};

function AppShell() {
  const { apiUrl } = useConfig();

  return (
    <ServerGuard key={apiUrl}>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/:type" element={
            <ProtectedRoute>
              <AppLayout>
                <DetailedStats />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/barcode" element={
            <ProtectedRoute>
              <AppLayout>
                <BarcodeGenerator />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/mobile" element={
            <ProtectedRoute>
              <MobileScanner />
            </ProtectedRoute>
          } />
          <Route path="/scanners" element={
            <ProtectedRoute>
              <AppLayout>
                <Scanners />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/configuration" element={
            <ProtectedRoute>
              <AppLayout>
                <Configuration />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute>
              <AppLayout>
                <Employees />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/sessions" element={
            <ProtectedRoute>
              <AppLayout>
                <Sessions />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/dcs" element={
            <ProtectedRoute>
              <AppLayout>
                <DeliveryChallans />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/quotations" element={
            <ProtectedRoute>
              <AppLayout>
                <Quotations />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ServerGuard>
  );
}

function App() {
  return (
    <ConfigProvider>
      <NotificationProvider>
        <AppShell />
      </NotificationProvider>
    </ConfigProvider>
  );
}

export default App;
