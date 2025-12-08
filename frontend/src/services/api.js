import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data)
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  getCredits: () => api.get('/users/credits'),
  getTransactions: () => api.get('/users/credits/transactions')
};

// Chat API
export const chatAPI = {
  sendMessage: (data) => api.post('/chat', data),
  getHistory: (sessionId) => api.get(`/chat/history/${sessionId}`)
};

// Payment API
export const paymentAPI = {
  getPackages: () => api.get('/payments/packages'),
  createIntent: (packageType) => api.post('/payments/create-intent', { package_type: packageType }),
  getHistory: () => api.get('/payments/history')
};

// Stream API
export const streamAPI = {
  create: (data) => api.post('/streams/create', data),
  start: (id) => api.post(`/streams/${id}/start`),
  stop: (id) => api.post(`/streams/${id}/stop`),
  saveMetrics: (id, metrics) => api.post(`/streams/${id}/metrics`, metrics),
  getMyStreams: (status) => api.get('/streams/my-streams', { params: { status } }),
  getStream: (id) => api.get(`/streams/${id}`)
};

// Team API
export const teamAPI = {
  create: (data) => api.post('/teams/create', data),
  getMyTeams: () => api.get('/teams/my-teams'),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  getMembers: (teamId) => api.get(`/teams/${teamId}/members`)
};

export default api;