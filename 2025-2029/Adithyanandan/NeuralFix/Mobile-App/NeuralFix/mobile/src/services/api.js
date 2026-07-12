import { ENDPOINTS, API_BASE_URL } from '../utils/config';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e) || `Error: ${res.status}`); }
  return res.json();
}

export const checkHealth = () => apiFetch(`${API_BASE_URL}/health`);
export const listSessions = () => apiFetch(`${API_BASE_URL}/api/sessions/`);
export const getSession = (id) => apiFetch(`${API_BASE_URL}/api/sessions/${id}/`);
export const deleteSession = (id) => apiFetch(`${API_BASE_URL}/api/sessions/${id}/`, { method: 'DELETE' });
export const sendChatMessage = (session_id, message) => apiFetch(`${API_BASE_URL}/api/chat/`, { method: 'POST', body: JSON.stringify({ session_id, message }) });
export const generateReport = (session_id) => apiFetch(`${API_BASE_URL}/api/reports/generate`, { method: 'POST', body: JSON.stringify({ session_id }) });
export const getReport = (id) => apiFetch(`${API_BASE_URL}/api/reports/${id}/`);

export const createSession = (title, category) =>
  apiFetch(`${API_BASE_URL}/api/sessions/`, { method: 'POST', body: JSON.stringify({ title, category }) });

export async function uploadImage(session_id, imageUri, filename = 'device.jpg') {
  const form = new FormData();
  form.append('session_id', session_id);
  form.append('file', { uri: imageUri, name: filename, type: 'image/jpeg' });
  const res = await fetch(`${API_BASE_URL}/api/images/upload`, { method: 'POST', body: form });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Upload failed: ${res.status}`); }
  return res.json();
}