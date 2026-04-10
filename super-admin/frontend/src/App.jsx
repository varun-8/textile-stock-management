import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Licenses from './pages/Licenses';
import Clients from './pages/Clients';
import Systems from './pages/Systems';
import AuditLogs from './pages/AuditLogs';
import Team from './pages/Team';
import Profile from './pages/Profile';

import './index.css';
import './App.css';

const ProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) return <div className="loading-screen">Verifying session...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" />;

  return <Layout>{children}</Layout>;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/licenses" element={
            <ProtectedRoute>
              <Licenses />
            </ProtectedRoute>
          } />

          <Route path="/clients" element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          } />

          <Route path="/systems" element={
            <ProtectedRoute requireSuperAdmin={true}>
              <Systems />
            </ProtectedRoute>
          } />

          <Route path="/audit" element={
            <ProtectedRoute requireSuperAdmin={true}>
              <AuditLogs />
            </ProtectedRoute>
          } />

          <Route path="/team" element={
            <ProtectedRoute requireSuperAdmin={true}>
              <Team />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
