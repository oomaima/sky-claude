import axios from 'axios';

// If VITE_API_BASE_URL is set (e.g. local dev), use it. 
// Otherwise, fallback to empty string so requests go to the same origin (Nginx proxy)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add a request interceptor for the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
