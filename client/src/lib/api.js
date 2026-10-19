import axios from 'axios';
import storage from './storage.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (MUTATING.has((config.method || 'get').toLowerCase())) {
    config.headers['x-csrf-protection'] = '1';
  }
  return config;
});

let refreshPromise = null;

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', {}, { headers: { 'x-csrf-protection': '1' } })
      .then((res) => {
        const token = res.data?.data?.accessToken;
        if (token) storage.setToken(token);
        return token;
      })
      .catch((err) => {
        storage.clear();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const status = response?.status;
    const isAuthCall = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh');

    if (status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        const token = await refreshSession();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(normalizeError(error));
  },
);

export function normalizeError(error) {
  if (error?.isNormalized) return error;
  const status = error?.response?.status || 0;
  const payload = error?.response?.data?.error;
  const normalized = new Error(payload?.message || error.message || 'Habaye ikibazo. Ongera ugerageze.');
  normalized.isNormalized = true;
  normalized.status = status;
  normalized.code = payload?.code || (status ? `HTTP_${status}` : 'NETWORK_ERROR');
  normalized.details = payload?.details || null;
  if (status === 0) normalized.code = 'NETWORK_ERROR';
  return normalized;
}

/** Returns `response.data.data` and throws a normalized error otherwise. */
export async function request(config) {
  const res = await api(config);
  return res.data?.data ?? res.data;
}

/** Returns the full `{ data, meta }` envelope for paginated endpoints. */
export async function requestFull(config) {
  const res = await api(config);
  return { data: res.data?.data, meta: res.data?.meta };
}

export { refreshSession };
export default api;
