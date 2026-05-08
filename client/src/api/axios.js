import axios from 'axios';

// Create a custom axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true, // Crucial for sending cookies (JWT)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach token if not using httpOnly cookies, though withCredentials covers httpOnly.
api.interceptors.request.use(
  (config) => {
    // If using localStorage instead of cookies for the access token (fallback):
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401/403 and automatic token refresh
api.interceptors.response.use(
  (response) => {
    // Standardize response format if needed
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to hit the refresh token endpoint
        // Assumes /api/auth/refresh sets a new HttpOnly cookie
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        // Retry the original request with the new credentials
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token failed or expired. Force logout.
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 400) {
      console.error('[Axios] 400 Bad Request Payload:', originalRequest.data);
      console.error('[Axios] 400 Bad Request Response:', error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;
