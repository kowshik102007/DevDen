import api from './api';

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post('/auth/login', { email, password });
  return data.access_token;
}

export async function register(email: string, username: string, password: string): Promise<string> {
  const { data } = await api.post('/auth/register', { email, username, password });
  return data.access_token;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me');
  return data;
}
