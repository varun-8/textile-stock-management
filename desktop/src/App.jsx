import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BarcodeGenerator from './pages/BarcodeGenerator';
import MobileScanner from './pages/MobileScanner';
import Reports from './pages/Reports';
import Scanners from './pages/Scanners';
import Configuration from './pages/Configuration';
import Settings from './pages/Settings';
import Employees from './pages/Employees';
import Sessions from './pages/Sessions';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/" />;
};

import { ConfigProvider } from './context/ConfigContext';

import AppLayout from './components/AppLayout';

function App() {
  return (
    <ConfigProvider>
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
          <Route path="/reports" element={
            <ProtectedRoute>
              <AppLayout>
                <Reports />
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
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
