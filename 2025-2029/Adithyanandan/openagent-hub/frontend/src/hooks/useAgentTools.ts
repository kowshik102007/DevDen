import { useState, useCallback, useEffect } from 'react';
import { listAgentTools, AgentTool } from '../services/agents';

/** Available tools for the current user (built-ins + MCP), used by the chat and
 *  agent Tools pickers to let the user limit which tools may be called. */
export function useAgentTools() {
  const [tools, setTools] = useState<AgentTool[]>([]);

  const load = useCallback(async () => {
    try { setTools(await listAgentTools()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { tools, reloadTools: load };
}
