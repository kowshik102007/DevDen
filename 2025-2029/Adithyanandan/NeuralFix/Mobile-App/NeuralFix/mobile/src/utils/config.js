// 👇 Change this to your server's local IP (shown when you run python run.py)
export const API_BASE_URL = 'http://172.16.210.196:8001';

export const ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  sessions: `${API_BASE_URL}/api/sessions`,
  chat: `${API_BASE_URL}/api/chat/`,
  imageUpload: `${API_BASE_URL}/api/images/upload/`,
  imageFile: (f) => `${API_BASE_URL}/api/images/file/${f}`,
  reportGenerate: `${API_BASE_URL}/api/reports/generate/`,
  reportGet: (id) => `${API_BASE_URL}/api/reports/${id}/`,
  ragStatus: `${API_BASE_URL}/api/rag/status/`,
  // Vision Agent
  visionAnalyse: `${API_BASE_URL}/vision/analyse`,
  visionChat: `${API_BASE_URL}/vision/chat`,
};

