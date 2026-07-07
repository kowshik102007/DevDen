import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Bot } from 'lucide-react';
import clsx from 'clsx';
import { Sidebar } from '../components/Sidebar';
import { ChatWindow } from '../components/ChatWindow';
import { ChatInput } from '../components/ChatInput';
import { ProviderSettingsDialog } from '../components/ProviderSettingsDialog';
import { AgentsView } from '../components/AgentsView';
import { AgentManagerDialog } from '../components/AgentManagerDialog';
import { useChat } from '../hooks/useChat';
import { useProjects } from '../hooks/useProjects';
import { useProviderSettings } from '../hooks/useProviderSettings';
import { useProviders } from '../hooks/useProviders';
import { useCatalog } from '../hooks/useCatalog';
import { useSkills } from '../hooks/useSkills';
import { useAgentTools } from '../hooks/useAgentTools';
import { useAgents } from '../hooks/useAgents';
import { getRun, AgentRunDetail, AgentMode, Agent } from '../services/agents';
import { User } from '../services/auth';
import { ProviderConfig } from '../services/chat';

interface Props {
  user: User;
  onLogout: () => void;
}

export function ChatPage({ user, onLogout }: Props) {
  const {
    conversations,
    currentConversation,
    isStreaming,
    streamingContent,
    streamingTools,
    routeInfo,
    error,
    loadConversations,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    sendMessage,
    stopStreaming,
    editMessage,
    regenerateResponse,
  } = useChat();

  const { projects, loadProjects, addProject, renameProject, removeProject } = useProjects();
  const { config, availableModels, saveConfig, loadModels, loadConfig } = useProviderSettings();
  const { providerModels, refreshModels } = useProviders();
  const { catalog, sync: syncCatalog } = useCatalog();
  const { skills } = useSkills();
  const { tools } = useAgentTools();
  const agents = useAgents();

  const [selectedModel, setSelectedModel] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [thinkingLabel, setThinkingLabel] = useState('Thinking');
  const [view, setView] = useState<'chat' | 'agents'>('chat');

  // Agents-tab shared state.
  const [viewingRun, setViewingRun] = useState<AgentRunDetail | null>(null);
  const [showAgentManager, setShowAgentManager] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentPrefill, setAgentPrefill] = useState<{ goal?: string; mode?: AgentMode } | null>(null);

  useEffect(() => {
    loadConversations(selectedProjectId);
    loadProjects();
  }, [loadConversations, loadProjects, selectedProjectId]);

  // Default the Agents tab to the built-in Orchestrator so a run always has an agent.
  useEffect(() => {
    if (selectedAgentId) return;
    const orch =
      agents.agents.find((a) => a.is_builtin && a.name === 'Orchestrator')
      ?? agents.agents.find((a) => a.is_builtin);
    if (orch) setSelectedAgentId(orch.id);
  }, [agents.agents, selectedAgentId]);

  // Set initial model from single config if no provider model selected yet
  useEffect(() => {
    if (config?.model && !selectedModel) setSelectedModel(config.model);
  }, [config, selectedModel]);

  // If routing providers are configured but nothing is selected yet, default to
  // "Auto" (smart routing) so a first message never 400s on an empty model.
  useEffect(() => {
    if (!selectedModel && !config?.model && providerModels.length > 0) {
      setSelectedModel('auto');
      setSelectedProviderId(null);
    }
  }, [providerModels, selectedModel, config]);

  const handleModelChange = (model: string, providerId?: string | null) => {
    setSelectedModel(model);
    setSelectedProviderId(providerId ?? null);
  };

  const handleSend = (
    message: string,
    attachmentIds: string[],
    opts?: { useTools?: boolean; toolMode?: 'off' | 'auto' | 'always'; toolNames?: string[]; skillId?: string | null; skillAuto?: boolean; routingMode?: string },
  ) => {
    setThinkingLabel(attachmentIds.length > 0 ? 'Analysing' : 'Thinking');
    sendMessage(
      message,
      selectedModel || null,
      attachmentIds.length ? attachmentIds : undefined,
      selectedProviderId,
      opts,
    );
  };

  const handleSettingsSave = async (data: Partial<ProviderConfig>) => {
    await saveConfig(data);
    await loadConfig();
    if (data.model) setSelectedModel(data.model);
  };

  const handleProvidersChange = () => {
    refreshModels();
    syncCatalog();
  };

  // Selecting a conversation or starting a new chat should always land the user
  // in the Chat view, even if they were on the Agents tab.
  const handleSelectConversation = (id: string) => {
    setView('chat');
    selectConversation(id);
  };

  const handleNewChat = () => {
    setView('chat');
    startNewChat();
  };

  const handleSelectProject = (id: string | null) => {
    setView('chat');
    setSelectedProjectId(id);
    startNewChat();
  };

  const handleOpenSettings = () => {
    loadModels().catch(() => {});
    setShowSettings(true);
  };

  // ── Agents-tab handlers ──────────────────────────────────────────────────────
  const openRun = async (id: string) => {
    setView('agents');
    try { setViewingRun(await getRun(id)); } catch { /* ignore */ }
  };

  const switchToAgents = (prefill?: { goal?: string; mode?: AgentMode }) => {
    setView('agents');
    setViewingRun(null);
    if (prefill) setAgentPrefill(prefill);
  };

  const useAgent = (a: Agent) => {
    setView('agents');
    setSelectedAgentId(a.id);
    setShowAgentManager(false);
  };

  // Model options for the agent manager's dropdown.
  const managerModels = useMemo(
    () => providerModels.length
      ? providerModels.map((m) => ({ model: m.model, provider_id: m.provider_id, provider_name: m.provider_name }))
      : availableModels.map((m) => ({ model: m, provider_id: null as string | null })),
    [providerModels, availableModels],
  );

  // Decide which model list to show: use providerModels if available, else flat list
  const hasProviderModels = providerModels.length > 0;

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar
        mode={view}
        conversations={conversations}
        currentId={currentConversation?.id}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={deleteConversation}
        onRename={renameConversation}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onAddProject={addProject}
        onRenameProject={renameProject}
        onDeleteProject={removeProject}
        runs={agents.runs}
        currentRunId={viewingRun?.id ?? null}
        onSelectRun={openRun}
        onDeleteRun={(id) => { if (viewingRun?.id === id) setViewingRun(null); agents.removeRun(id); }}
        onClearRuns={() => { setViewingRun(null); agents.clearAllRuns(); }}
        onNewRun={() => { setView('agents'); setViewingRun(null); }}
        agents={agents.agents}
        onManageAgents={() => { setView('agents'); setShowAgentManager(true); }}
        onUseAgent={useAgent}
        username={user.username}
        onOpenSettings={handleOpenSettings}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* View switcher */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
          <button
            onClick={() => setView('chat')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === 'chat' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900')}
          >
            <MessageSquare size={14} /> Chat
          </button>
          <button
            onClick={() => setView('agents')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === 'agents' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900')}
          >
            <Bot size={14} /> Agents
          </button>
        </div>

        {view === 'chat' ? (
          <>
            <ChatWindow
              conversation={currentConversation}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              streamingTools={streamingTools}
              routeInfo={routeInfo}
              thinkingLabel={thinkingLabel}
              error={error}
              onEditMessage={(id, content) => editMessage(id, content, selectedModel || null, selectedProviderId)}
              onRegenerate={() => regenerateResponse(selectedModel || null, selectedProviderId)}
            />

            <ChatInput
              onSend={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={!hasProviderModels && !config?.model && !selectedModel}
              model={selectedModel}
              availableModels={availableModels}
              providerModels={hasProviderModels ? providerModels : undefined}
              catalog={catalog}
              skills={skills}
              tools={tools}
              onModelChange={handleModelChange}
              onSwitchToAgents={switchToAgents}
              onClearChat={handleNewChat}
            />
          </>
        ) : (
          <AgentsView
            providerModels={providerModels}
            fallbackModel={selectedModel || config?.model || ''}
            catalog={catalog}
            availableModels={availableModels}
            skills={skills}
            tools={tools}
            liveSteps={agents.liveSteps}
            isRunning={agents.isRunning}
            runError={agents.runError}
            currentRunId={agents.currentRunId}
            start={agents.start}
            stop={agents.stop}
            continueRun={agents.continueRun}
            primeFromRun={agents.primeFromRun}
            viewing={viewingRun}
            onClearViewing={() => setViewingRun(null)}
            savedAgents={agents.agents}
            selectedAgentId={selectedAgentId}
            onSelectedAgentChange={setSelectedAgentId}
            onOpenManager={() => setShowAgentManager(true)}
            prefill={agentPrefill}
            onPrefillConsumed={() => setAgentPrefill(null)}
          />
        )}
      </div>

      {showAgentManager && (
        <AgentManagerDialog
          agents={agents.agents}
          skills={skills}
          models={managerModels}
          onClose={() => setShowAgentManager(false)}
          onCreate={async (p) => { await agents.createAgent(p); }}
          onUpdate={async (id, p) => { await agents.updateAgent(id, p); }}
          onDelete={async (id) => { await agents.removeAgent(id); }}
          onUse={useAgent}
        />
      )}

      {showSettings && (
        <ProviderSettingsDialog
          config={config}
          onSave={handleSettingsSave}
          onFetchModels={loadModels}
          onClose={() => setShowSettings(false)}
          username={user.username}
          email={user.email}
          onLogout={onLogout}
          onProvidersChange={handleProvidersChange}
        />
      )}
    </div>
  );
}
