import api from './api';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServer {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string[] | null;
  url: string | null;
  enabled: boolean;
  auto_approve: boolean;
  status: 'unknown' | 'healthy' | 'error';
  tools_cache: MCPTool[] | null;
  last_checked_at: string | null;
}

export async function listMCPServers(): Promise<MCPServer[]> {
  const { data } = await api.get('/mcp/servers');
  return data;
}

export async function createMCPServer(payload: {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  auto_approve?: boolean;
}): Promise<MCPServer> {
  const { data } = await api.post('/mcp/servers', payload);
  return data;
}

export async function updateMCPServer(id: string, payload: Partial<MCPServer>): Promise<MCPServer> {
  const { data } = await api.patch(`/mcp/servers/${id}`, payload);
  return data;
}

export async function deleteMCPServer(id: string): Promise<void> {
  await api.delete(`/mcp/servers/${id}`);
}

export async function syncMCPServer(id: string): Promise<MCPServer> {
  const { data } = await api.post(`/mcp/servers/${id}/sync`);
  return data;
}

export interface MCPSecretField {
  key: string;
  label: string;
  help?: string;
  default?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string;
  args: string[];
  env_required: MCPSecretField[];
  config_required: MCPSecretField[];
  homepage?: string;
}

export interface ResolvedSpec {
  name?: string;
  command: string;
  args: string[];
  transport: string;
  env_required?: MCPSecretField[];
  config_required?: MCPSecretField[];
  note?: string;
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  const { data } = await api.get('/mcp/catalog');
  return data;
}

export async function resolveSource(source: string): Promise<ResolvedSpec> {
  const { data } = await api.post('/mcp/resolve', { source });
  return data;
}

export async function installServer(payload: {
  source: string;
  name?: string;
  env?: Record<string, string>;
  config?: Record<string, string>;
  auto_approve?: boolean;
}): Promise<MCPServer> {
  const { data } = await api.post('/mcp/install', payload);
  return data;
}
