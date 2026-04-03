import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT and tenant slug from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  const tenantSlug = localStorage.getItem('tenantSlug');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (tenantSlug) config.headers['X-Tenant-ID'] = tenantSlug;
  return config;
});

// On 401 clear credentials and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tenantSlug');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ data: { accessToken: string; user: { id: string; email: string; role: string; tenantId: string } } }>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasksApi = {
  list: (params?: Record<string, unknown>) => api.get('/tasks', { params }),
  get: (id: string) => api.get(`/tasks/${id}`),
  create: (data: unknown) => api.post('/tasks', data),
  update: (id: string, data: unknown) => api.patch(`/tasks/${id}`, data),
  remove: (id: string) => api.delete(`/tasks/${id}`),
  acceptSuggestion: (id: string) => api.post(`/tasks/${id}/accept-suggestion`),
};

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const aiApi = {
  suggest: (taskId: string, title: string, description?: string) =>
    api.post('/ai/suggest', { taskId, title, description }),
  draft: (type: string, context: unknown) =>
    api.post('/ai/draft', { type, context }),
};

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export const integrationsApi = {
  list: () => api.get('/integrations'),
  connect: (provider: string) => api.post(`/integrations/${provider}/connect`),
  disconnect: (provider: string) => api.delete(`/integrations/${provider}`),
  sync: (provider: string) => api.post(`/integrations/${provider}/sync`),
};

export default api;
