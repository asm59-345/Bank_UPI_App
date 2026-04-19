// ═══════════════════════════════════════════════════════
//  API Layer — Axios Instance + JWT Interceptor
// ═══════════════════════════════════════════════════════

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ─── Request Interceptor: Attach JWT Token ───
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('payflow_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Handle 401 + Errors ───
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: string[] }>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear session and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('payflow_token');
        localStorage.removeItem('payflow_user');
        // Only redirect if not already on auth pages
        if (!window.location.pathname.startsWith('/login') && 
            !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
      }
    }
    
    // Extract error message
    const message = error.response?.data?.message 
      || error.message 
      || 'Something went wrong';
    
    return Promise.reject(new Error(message));
  }
);

export default api;
