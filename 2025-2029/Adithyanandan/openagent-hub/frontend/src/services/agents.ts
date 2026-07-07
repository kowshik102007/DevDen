import api from './api';

export interface AgentTool {
  name: string;
  description: string;
  parameters: any;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  model: string | null;
  provider_id: string | null;
  skill_id: string | null;
  allow_subagents: boolean;
  is_builtin: boolean;
}

export interface AgentStep {
  id: string;
  step_index: number;
  type: 'thought' | 'tool_call' | 'tool_result' | 'spawn' | 'final' | 'error';
  content: string | null;
  tool_name: string | null;
  tool_input: any;
  tool_output: string | null;
  created_at: string;
}

export type AgentMode = 'auto' | 'goal' | 'plan';

export interface AgentRun {
  id: string;
  goal: string;
  role: string | null;
  mode?: AgentMode | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  result: string | null;
  error: string | null;
  model: string | null;
  agent_id: string | null;
  parent_run_id: string | null;
  conversation_id: string | null;
  skill_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunDetail extends AgentRun {
  steps: AgentStep[];
}

export interface RunEvent {
  type: 'status' | 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error' | 'done';
  status?: string;
  content?: string;
  tool?: string;
  input?: any;
  output?: string;
  message?: string;
  index?: number;
  run_id?: string;
}

export async function listAgentTools(): Promise<AgentTool[]> {
  const { data } = await api.get('/agents/tools');
  return data;
}

export async function listAgents(): Promise<Agent[]> {
  const { data } = await api.get('/agents');
  return data;
}

export async function createAgent(payload: Partial<Agent>): Promise<Agent> {
  const { data } = await api.post('/agents', payload);
  return data;
}

export async function updateAgent(id: string, payload: Partial<Agent>): Promise<Agent> {
  const { data } = await api.patch(`/agents/${id}`, payload);
  return data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function listRuns(): Promise<AgentRun[]> {
  const { data } = await api.get('/agents/runs');
  return data;
}

export async function getRun(id: string): Promise<AgentRunDetail> {
  const { data } = await api.get(`/agents/runs/${id}`);
  return data;
}

export async function getRunChildren(id: string): Promise<AgentRunDetail[]> {
  const { data } = await api.get(`/agents/runs/${id}/children`);
  return data;
}

export async function deleteRun(id: string): Promise<void> {
  await api.delete(`/agents/runs/${id}`);
}

export async function clearRuns(): Promise<void> {
  await api.delete('/agents/runs');
}

export interface RunAgentParams {
  goal: string;
  model?: string | null;
  provider_id?: string | null;
  agent_id?: string | null;
  skill_id?: string | null;
  skill_auto?: boolean;
  conversation_id?: string | null;
  allow_subagents?: boolean;
  team_agent_ids?: string[] | null;
  tool_mode?: 'off' | 'auto' | 'always';
  tool_names?: string[] | null;
  mode?: AgentMode;
}

export interface ContinueRunParams {
  message: string;
  mode?: AgentMode;
  tool_mode?: 'off' | 'auto' | 'always';
  tool_names?: string[] | null;
  team_agent_ids?: string[] | null;
}

/** POST a JSON body and stream the SSE response. Returns an AbortController. */
function streamSSE(
  url: string,
  body: unknown,
  token: string,
  onEvent: (evt: RunEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        onError(`Server error: ${response.status}`);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) { onError('No response body'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt: RunEvent = JSON.parse(line.slice(6));
            onEvent(evt);
            if (evt.type === 'done') { onDone(); return; }
          } catch {
            // skip malformed lines
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err.message);
    });

  return controller;
}

/** Start an agent run and stream events over SSE. Returns an AbortController. */
export function runAgent(
  params: RunAgentParams,
  token: string,
  onEvent: (evt: RunEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  return streamSSE('/api/agents/run', params, token, onEvent, onDone, onError);
}

/** Continue an existing run with a follow-up message; streams new steps over SSE. */
export function continueRun(
  runId: string,
  params: ContinueRunParams,
  token: string,
  onEvent: (evt: RunEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  return streamSSE(`/api/agents/runs/${runId}/continue`, params, token, onEvent, onDone, onError);
}
