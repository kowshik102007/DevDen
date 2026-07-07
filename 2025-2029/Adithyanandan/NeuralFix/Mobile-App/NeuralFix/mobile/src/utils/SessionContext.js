import React, { createContext, useContext, useState, useCallback } from 'react';
import * as api from '../services/api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);

  const checkServer = useCallback(async () => {
    try { await api.checkHealth(); setServerOnline(true); return true; }
    catch { setServerOnline(false); return false; }
  }, []);

  const loadSessions = useCallback(async () => {
    try { const d = await api.listSessions(); setSessions(d.sessions || []); }
    catch (e) { console.error('loadSessions:', e); }
  }, []);

  const createSession = useCallback(async (title = 'New Session', category = 'general') => {
    const s = await api.createSession(title, category);
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
    return s.id;
  }, []);

  const deleteSession = useCallback(async (id) => {
    await api.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [activeSessionId]);

  const refreshSession = useCallback(async (id) => {
    try {
      const updated = await api.getSession(id);
      setSessions(prev => prev.map(s => s.id === id ? updated : s));
      return updated;
    } catch (e) { console.error('refreshSession:', e); return null; }
  }, []);

  const getSession = useCallback((id) => sessions.find(s => s.id === id) || null, [sessions]);

  return (
    <SessionContext.Provider value={{ sessions, activeSessionId, setActiveSessionId, serverOnline, checkServer, loadSessions, createSession, deleteSession, refreshSession, getSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() { return useContext(SessionContext); }
