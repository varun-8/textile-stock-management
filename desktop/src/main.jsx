import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setupAxiosInterceptors } from './utils/axiosInterceptors'

// Setup global axios interceptors for cache-busting and auth
setupAxiosInterceptors();

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem('ADMIN_TOKEN');
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Add cache-busting for API endpoints
  let url = input;
  if (typeof url === 'string' && url.includes('/api/')) {
    // Add timestamp to GET requests
    if (!init.method || init.method === 'GET') {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}_t=${Date.now()}`;
    }
    // Add no-cache headers for all API calls
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
  }
  
  return originalFetch(url, { ...init, headers }).then((response) => {
    if (response.status === 401) {
      localStorage.removeItem('ADMIN_TOKEN');
      localStorage.removeItem('isAuthenticated');
      if (window.location.hash !== '#/' && window.location.hash !== '') {
        window.location.hash = '#/';
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
