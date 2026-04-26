const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
    throw new Error('Session expired. Redirecting to login…');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function loginUser(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data; // { access_token }
}
export const logoutUser = () => request('POST', '/api/auth/logout');
export const getMe      = () => request('GET',  '/api/auth/me');

// ── Fields ────────────────────────────────────────────────────────────────────
export const getFields   = ()       => request('GET',    '/api/fields');
export const createField = (body)   => request('POST',   '/api/fields', body);
export const updateField = (id, b)  => request('PUT',    `/api/fields/${id}`, b);
export const deleteField = (id)     => request('DELETE', `/api/fields/${id}`);

// ── Devices ───────────────────────────────────────────────────────────────────
export const getDevices       = ()       => request('GET',    '/api/devices');
export const getDevice        = (id)     => request('GET',    `/api/devices/${id}`);
export const pingDevice       = (id)     => request('GET',    `/api/devices/${id}/ping`);
export const createDevice     = (body)   => request('POST',   '/api/devices', body);
export const deleteDevice     = (id)     => request('DELETE', `/api/devices/${id}`);
export const checkDeviceName  = (name)   => request('GET',    `/api/devices/check-name?name=${encodeURIComponent(name)}`);

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardMetrics  = (fieldId) => request('GET', `/api/dashboard/metrics?field_id=${fieldId ?? ''}`);
export const getSpeciesBreakdown  = (fieldId) => request('GET', `/api/dashboard/species-breakdown?field_id=${fieldId ?? ''}&run_id=latest`);
export const getDensityMap        = (fieldId) => request('GET', `/api/dashboard/density-map?field_id=${fieldId ?? ''}&run_id=latest`);
export const getFieldPartitionDensity = (fieldId) => request('GET', `/api/dashboard/partition-density?field_id=${fieldId ?? ''}`);
export const getRunsChart         = (fieldId, period = '30d') => request('GET', `/api/dashboard/runs-chart?field_id=${fieldId ?? ''}&period=${period}`);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getRuns = ({ device_id = '', field_id = '', month = '', page = 1, limit = 8 } = {}) =>
  request('GET', `/api/runs?device_id=${device_id}&field_id=${field_id}&month=${month}&page=${page}&limit=${limit}`);

export const deleteFilteredRuns = ({ device_id = '', field_id = '', month = '' } = {}) =>
  request('DELETE', `/api/runs?device_id=${device_id}&field_id=${field_id}&month=${month}`);

export const getRun            = (runId) => request('GET', `/api/runs/${runId}`);
export const getRunDensityMap  = (runId) => request('GET', `/api/runs/${runId}/density-map`);
export const getRunSpecies     = (runId) => request('GET', `/api/runs/${runId}/species`);
export const getRunDeviceSummary = (runId) => request('GET', `/api/runs/${runId}/device-summary`);
export const getRunDetectionLogs = (runId, page = 1, limit = 10) =>
  request('GET', `/api/runs/${runId}/detection-logs?page=${page}&limit=${limit}`);

// ── Device Control — Detection ────────────────────────────────────────────────
export const startDetection  = (id, body) => request('POST', `/api/devices/${id}/detection/start`, body);
export const stopDetection   = (id)       => request('POST', `/api/devices/${id}/detection/stop`);
export const pollDetectionStatus = (id)   => request('GET',  `/api/devices/${id}/detection/status`);
export const pollDetectionGrid   = (id)   => request('GET',  `/api/devices/${id}/detection/grid`);

// ── Device Control — Manual ───────────────────────────────────────────────────
export const sendMoveCommand = (id, command, value) =>
  request('POST', `/api/devices/${id}/move`, { command, value });

// ── Routes ────────────────────────────────────────────────────────────────────
export const getRoutes    = (deviceId = '') => request('GET',    `/api/routes?device_id=${deviceId}`);
export const getRoute     = (id)            => request('GET',    `/api/routes/${id}`);
export const createRoute  = (body)          => request('POST',   '/api/routes', body);
export const updateRoute  = (id, body)      => request('PUT',    `/api/routes/${id}`, body);
export const deleteRoute  = (id)            => request('DELETE', `/api/routes/${id}`);

// ── Settings ──────────────────────────────────────────────────────────────────
export const getDeviceSettings  = (id)       => request('GET', `/api/devices/${id}/settings`);
export const sendDeviceSettings = (id, body) => request('PUT', `/api/devices/${id}/settings`, body);
