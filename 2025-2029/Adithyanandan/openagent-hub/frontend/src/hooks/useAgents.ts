import { useState, useCallback, useEffect, useRef } from 'react';
import {
  listAgents, listRuns, getRun, runAgent as apiRunAgent, continueRun as apiContinueRun,
  deleteRun, clearRuns,
  createAgent as apiCreateAgent, updateAgent as apiUpdateAgent, deleteAgent as apiDeleteAgent,
  Agent, AgentRun, AgentRunDetail, AgentStep, RunEvent, RunAgentParams, ContinueRunParams,
} from '../services/agents';

export interface LiveStep {
  type: AgentStep['type'];
  content?: string;
  tool?: string;
  input?: any;
  output?: string;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadAgents = useCallback(async () => {
    try { setAgents(await listAgents()); } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async () => {
    try { setRuns(await listRuns()); } catch { /* ignore */ }
  }, []);

  // Shared SSE event handler: appends steps and tracks the run id / final answer.
  const onRunEvent = useCallback((evt: RunEvent) => {
    if (evt.run_id) setCurrentRunId(evt.run_id);
    setRunError(null);
    if (evt.type === 'thought') {
      setLiveSteps((p) => [...p, { type: 'thought', content: evt.content }]);
    } else if (evt.type === 'tool_call') {
      setLiveSteps((p) => [...p, { type: 'tool_call', tool: evt.tool, input: evt.input }]);
    } else if (evt.type === 'tool_result') {
      setLiveSteps((p) => [...p, { type: 'tool_result', tool: evt.tool, output: evt.output }]);
    } else if (evt.type === 'error') {
      setRunError(evt.message ?? 'Unknown error');
      setIsRunning(false);
    } else if (evt.type === 'final') {
      setFinalAnswer(evt.content ?? '');
      setLiveSteps((p) => [...p, { type: 'final', content: evt.content }]);
    }
  }, []);

  const start = useCallback((params: RunAgentParams) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsRunning(true);
    setRunError(null);
    setFinalAnswer(null);
    setLiveSteps([]);
    setCurrentRunId(null);

    abortRef.current = apiRunAgent(
      params,
      token,
      onRunEvent,
      () => { setIsRunning(false); loadRuns(); },
      (err) => { setIsRunning(false); setRunError(err); },
    );
  }, [loadRuns, onRunEvent]);

  // Load a past run's steps into the live timeline so it can be continued in place.
  const primeFromRun = useCallback((run: AgentRunDetail) => {
    setCurrentRunId(run.id);
    setRunError(null);
    setFinalAnswer(run.result ?? null);
    setLiveSteps(
      run.steps.map((s) => ({
        type: s.type,
        content: s.content ?? undefined,
        tool: s.tool_name ?? undefined,
        input: s.tool_input ?? undefined,
        output: s.tool_output ?? undefined,
      })),
    );
  }, []);

  // Continue an existing run with a follow-up; new steps append to the timeline.
  const continueRun = useCallback((runId: string, params: ContinueRunParams) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsRunning(true);
    setRunError(null);
    setCurrentRunId(runId);

    abortRef.current = apiContinueRun(
      runId,
      params,
      token,
      onRunEvent,
      () => { setIsRunning(false); loadRuns(); },
      (err) => { setIsRunning(false); setRunError(err); },
    );
  }, [loadRuns, onRunEvent]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const removeRun = useCallback(async (id: string) => {
    setRuns((p) => p.filter((r) => r.id !== id));
    try { await deleteRun(id); } catch { loadRuns(); }
  }, [loadRuns]);

  const clearAllRuns = useCallback(async () => {
    setRuns([]);
    try { await clearRuns(); } catch { loadRuns(); }
  }, [loadRuns]);

  const createAgent = useCallback(async (payload: Partial<Agent>) => {
    const a = await apiCreateAgent(payload);
    setAgents((p) => [...p, a]);
    return a;
  }, []);

  const updateAgent = useCallback(async (id: string, payload: Partial<Agent>) => {
    const a = await apiUpdateAgent(id, payload);
    setAgents((p) => p.map((x) => (x.id === id ? a : x)));
    return a;
  }, []);

  const removeAgent = useCallback(async (id: string) => {
    setAgents((p) => p.filter((a) => a.id !== id));
    try { await apiDeleteAgent(id); } catch { loadAgents(); }
  }, [loadAgents]);

  useEffect(() => {
    loadAgents();
    loadRuns();
  }, [loadAgents, loadRuns]);

  return {
    agents, runs, liveSteps, isRunning, runError, finalAnswer, currentRunId,
    loadAgents, loadRuns, start, stop, continueRun, primeFromRun, getRun, removeRun, clearAllRuns,
    createAgent, updateAgent, removeAgent,
  };
}
