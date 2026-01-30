import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BarcodeGenerator from './pages/BarcodeGenerator';
import MobileScanner from './pages/MobileScanner';
import Scanners from './pages/Scanners';

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
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
