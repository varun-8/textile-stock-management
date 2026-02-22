import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem('ADMIN_TOKEN');
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return originalFetch(input, { ...init, headers }).then((response) => {
    if (response.status === 401) {
      localStorage.removeItem('ADMIN_TOKEN');
      localStorage.removeItem('isAuthenticated');
      if (window.location.hash !== '#/' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return response;
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
