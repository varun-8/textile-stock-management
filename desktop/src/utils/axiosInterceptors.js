import axios from 'axios';

/**
 * Setup global axios interceptors for cache-busting
 * Applies to all axios instances by default
 */
export function setupAxiosInterceptors() {
  // Request interceptor: Add cache-busting timestamp to GET requests
  axios.interceptors.request.use((config) => {
    // Only add timestamp to GET requests
    if ((!config.method || config.method === 'GET') && config.url && config.url.includes('/api/')) {
      const separator = config.url.includes('?') ? '&' : '?';
      config.url = `${config.url}${separator}_t=${Date.now()}`;
    }
    
    // Add no-cache headers for all API calls
    config.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    config.headers['Pragma'] = 'no-cache';
    
    return config;
  }, (error) => {
    return Promise.reject(error);
  });

  // Response interceptor: Handle 401s globally
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('ADMIN_TOKEN');
        localStorage.removeItem('isAuthenticated');
        if (window.location.hash !== '#/' && window.location.hash !== '') {
          window.location.hash = '#/';
        }
      }
      return Promise.reject(error);
    }
  );
}
