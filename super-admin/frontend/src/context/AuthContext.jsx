import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('LoomTrack_Admin_Token');
        if (token) {
          try {
            const { user } = await api.get('/auth/me');
            setUser(user);
          } catch {
            localStorage.removeItem('LoomTrack_Admin_Token');
          }
        }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('LoomTrack_Admin_Token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('LoomTrack_Admin_Token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin: user?.role === 'SUPER_ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
};

// This hook is intentionally exported from the context module.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
