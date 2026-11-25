import { clearToken, getToken, notifyUnauthorized } from './auth.js';

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, timeout = 8000, auth = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      // An expired or revoked token should send the user back to the login
      // screen. Sign-in itself is exempt: a wrong password is a normal 401.
      if (auth && response.status === 401) {
        clearToken();
        notifyUnauthorized();
      }
      throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  health: () => request('/health', { auth: false }),

  register: (credentials) =>
    request('/auth/register', { method: 'POST', body: credentials, auth: false }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials, auth: false }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getDraft: () => request('/draft'),
  saveDraft: (draft) => request('/draft', { method: 'PUT', body: draft }),
  listNotes: () => request('/notes'),
  createNote: (note) => request('/notes', { method: 'POST', body: note }),
  updateNote: (id, note) => request(`/notes/${encodeURIComponent(id)}`, { method: 'PUT', body: note }),
  deleteNote: (id) => request(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listTasks: () => request('/tasks'),
  createTask: (task) => request('/tasks', { method: 'POST', body: task }),
  updateTask: (id, task) => request(`/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: task }),
  deleteTask: (id) => request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export default api;
