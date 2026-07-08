import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Users, Send, Square, ChevronDown, Target, ClipboardList, Zap, Eraser, X, CornerDownRight } from 'lucide-react';
import clsx from 'clsx';
import { AgentRunDetail, Agent, AgentMode, AgentTool, RunAgentParams, ContinueRunParams } from '../services/agents';
import { Skill } from '../services/skills';
import { ProviderModel } from '../hooks/useProviders';
import { CatalogModel } from '../services/catalog';
import { LiveStep } from '../hooks/useAgents';
import { StepTimeline } from './StepTimeline';
import { ToolPicker, ToolMode } from './ToolPicker';
import { SkillPicker } from './SkillPicker';
import { ModePicker } from './ModePicker';
import { SlashCommandMenu, SlashCommand, SlashMenuHandle } from './SlashCommandMenu';

interface Props {
  providerModels: ProviderModel[];
  fallbackModel: string;
  catalog?: CatalogModel[];
  availableModels?: string[];
  skills: Skill[];
  tools: AgentTool[];
  // Run control (lifted to ChatPage so the sidebar and view share one source).
  liveSteps: LiveStep[];
  isRunning: boolean;
  runError: string | null;
  currentRunId: string | null;
  start: (params: RunAgentParams) => void;
  stop: () => void;
  continueRun: (runId: string, params: ContinueRunParams) => void;
  primeFromRun: (run: AgentRunDetail) => void;
  // Viewing a past run (selected from the sidebar).
  viewing: AgentRunDetail | null;
  onClearViewing: () => void;
  // Saved agents.
  savedAgents: Agent[];
  selectedAgentId: string | null;
  onSelectedAgentChange: (id: string | null) => void;
  onOpenManager: () => void;
  // Prefill from a chat-tab slash command (/goal, /plan).
  prefill: { goal?: string; mode?: AgentMode } | null;
  onPrefillConsumed: () => void;
}

const PREFER_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude', 'gemini-2.0-flash', 'gemini', 'llama-3.3-70b', 'qwen-2.5', 'mistral'];
const EXCLUDE_FRAGMENTS = ['search', 'audio', 'realtime', 'tts', 'whisper', 'image', 'dall-e', 'embedding', 'moderation', 'vision-preview'];

function modelName(id: string): string {
  const i = id.lastIndexOf('/');
  return (i >= 0 ? id.slice(i + 1) : id).toLowerCase();
}

function pickDefaultModel(models: ProviderModel[]): { model: string; providerId: string | null } {
  const usable = models.filter((m) => !EXCLUDE_FRAGMENTS.some((f) => modelName(m.model).includes(f)));
  const pool = usable.length ? usable : models;
  for (const frag of PREFER_MODELS) {
    const hit = pool.find((m) => modelName(m.model) === frag);
    if (hit) return { model: hit.model, providerId: hit.provider_id };
  }
  for (const frag of PREFER_MODELS) {
    const hit = pool.find((m) => modelName(m.model).includes(frag));
    if (hit) return { model: hit.model, providerId: hit.provider_id };
  }
  return { model: pool[0].model, providerId: pool[0].provider_id };
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'failed') return 'text-red-400';
  if (status === 'running') return 'text-blue-400';
  return 'text-zinc-500';
}

export function AgentsView({
  providerModels, fallbackModel, catalog, availableModels, skills, tools,
  liveSteps, isRunning, runError, currentRunId, start, stop, continueRun, primeFromRun,
  viewing, onClearViewing,
  savedAgents, selectedAgentId, onSelectedAgentChange, onOpenManager,
  prefill, onPrefillConsumed,
}: Props) {
  const effectiveModels: ProviderModel[] = useMemo(() => {
    if (providerModels.length > 0) return providerModels;
    if (catalog && catalog.length > 0) {
      return catalog
        .filter((c) => c.is_enabled)
        .map((c) => ({ provider_id: c.provider_id, provider_name: c.provider_name, model: c.model_id }));
    }
    if (availableModels && availableModels.length > 0) {
      return availableModels.map((m) => ({ provider_id: '', provider_name: 'Configured provider', model: m }));
    }
    if (fallbackModel) {
      return [{ provider_id: '', provider_name: 'Configured provider', model: fallbackModel }];
    }
    return [];
  }, [providerModels, catalog, availableModels, fallbackModel]);

  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<AgentMode>('auto');
  const [skillId, setSkillId] = useState<string>('auto');
  const [toolMode, setToolMode] = useState<ToolMode>('auto');
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [allowSub, setAllowSub] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [selected, setSelected] = useState<{ model: string; providerId: string | null }>({ model: fallbackModel, providerId: null });
  const [modelOpen, setModelOpen] = useState(false);
  const [followup, setFollowup] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashRef = useRef<SlashMenuHandle>(null);

  const selectedAgent = savedAgents.find((a) => a.id === selectedAgentId) ?? null;
  // Agents that can be delegated to (everything except the active coordinator).
  const teamCandidates = savedAgents.filter((a) => a.id !== selectedAgentId);
  // Multi-agent affordances appear when the toggle is on or the coordinator allows sub-agents.
  const teamEnabled = allowSub || !!selectedAgent?.allow_subagents;

  useEffect(() => {
    if (!selected.model && effectiveModels.length > 0) setSelected(pickDefaultModel(effectiveModels));
  }, [effectiveModels, selected.model]);

  // Consume a prefill handed over from the chat tab (/goal, /plan).
  useEffect(() => {
    if (!prefill) return;
    if (prefill.mode) setMode(prefill.mode);
    if (prefill.goal !== undefined) setGoal(prefill.goal);
    onPrefillConsumed();
    textareaRef.current?.focus();
  }, [prefill, onPrefillConsumed]);

  const modelGroups = useMemo(() => {
    const groups: { provider_id: string; provider_name: string; models: string[] }[] = [];
    const seen = new Map<string, number>();
    for (const pm of effectiveModels) {
      if (!seen.has(pm.provider_id)) {
        seen.set(pm.provider_id, groups.length);
        groups.push({ provider_id: pm.provider_id, provider_name: pm.provider_name, models: [] });
      }
      groups[seen.get(pm.provider_id)!].models.push(pm.model);
    }
    return groups;
  }, [effectiveModels]);

  const runWith = (g: string, runMode: AgentMode) => {
    if (!g.trim() || isRunning) return;
    onClearViewing();
    start({
      goal: g.trim(),
      model: selected.model || null,
      provider_id: selected.providerId || null,
      agent_id: selectedAgentId,
      skill_id: skillId === 'auto' || skillId === '' ? null : skillId,
      skill_auto: skillId === 'auto',
      tool_mode: toolMode,
      tool_names: toolNames,
      allow_subagents: allowSub,
      team_agent_ids: teamEnabled && teamIds.length ? teamIds : null,
      mode: runMode,
    });
    setGoal('');
  };

  // Continue the run currently shown (a finished live run, or a viewed past run).
  const continuableRunId = viewing ? viewing.id : currentRunId;
  const canContinue = !!continuableRunId && !isRunning;

  const handleContinue = () => {
    if (!followup.trim() || !continuableRunId || isRunning) return;
    // If continuing a viewed run, load its steps into the live timeline first so new
    // steps append rather than replacing the view.
    if (viewing) { primeFromRun(viewing); onClearViewing(); }
    continueRun(continuableRunId, {
      message: followup.trim(),
      mode,
      tool_mode: toolMode,
      tool_names: toolNames,
      team_agent_ids: teamEnabled && teamIds.length ? teamIds : null,
    });
    setFollowup('');
  };

  const handleRun = () => {
    const m = goal.match(/^\/(\w+)\s*([\s\S]*)$/);
    if (m) {
      const name = m[1].toLowerCase();
      const rest = m[2] ?? '';
      if (name === 'auto' || name === 'goal' || name === 'plan') {
        setMode(name);
        if (rest.trim()) { runWith(rest, name); } else { setGoal(''); }
        return;
      }
      if (name === 'agents') { onOpenManager(); setGoal(''); return; }
      if (name === 'multiagent') { setAllowSub((v) => !v); setGoal(''); return; }
      if (name === 'clear') { setGoal(''); onClearViewing(); return; }
      // unknown → fall through and run as a normal goal
    }
    runWith(goal, mode);
  };

  const slashCommands: SlashCommand[] = [
    { name: 'goal', args: '<task>', description: 'Autonomous mode — work until the goal is achieved', Icon: Target, accent: 'text-emerald-400', takesArgs: true, run: () => { setMode('goal'); setGoal(''); } },
    { name: 'plan', args: '<task>', description: 'Produce a step-by-step plan, no execution', Icon: ClipboardList, accent: 'text-amber-400', takesArgs: true, run: () => { setMode('plan'); setGoal(''); } },
    { name: 'auto', description: 'One focused pass (default mode)', Icon: Zap, accent: 'text-blue-400', run: () => { setMode('auto'); setGoal(''); } },
    { name: 'agents', description: 'Create and manage saved agents', Icon: Bot, accent: 'text-blue-400', run: () => { onOpenManager(); setGoal(''); } },
    { name: 'multiagent', description: 'Toggle spawning sub-agents', Icon: Users, accent: 'text-pink-400', run: () => { setAllowSub((v) => !v); setGoal(''); } },
    { name: 'clear', description: 'Clear the composer', Icon: Eraser, run: () => { setGoal(''); onClearViewing(); } },
  ];

  const viewingSteps: LiveStep[] = useMemo(() => {
    if (!viewing) return [];
    return viewing.steps.map((s) => ({
      type: s.type,
      content: s.content ?? undefined,
      tool: s.tool_name ?? undefined,
      input: s.tool_input ?? undefined,
      output: s.tool_output ?? undefined,
    }));
  }, [viewing]);

  const showingLive = !viewing;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Composer */}
      <div className="border-b border-zinc-800 px-6 py-4 bg-zinc-950">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-zinc-300">
            <Bot size={18} className="text-blue-400" />
            <h2 className="text-sm font-semibold">Agents</h2>
            <span className="text-xs text-zinc-600">Give a goal — type <span className="font-mono text-zinc-500">/</span> for commands.</span>
            {selectedAgent && (
              <span className="ml-auto flex items-center gap-1.5 text-xs bg-blue-950/40 text-blue-300 rounded-lg px-2 py-1">
                <Bot size={11} /> {selectedAgent.name}
                <button onClick={() => onSelectedAgentChange(null)} className="hover:text-white"><X size={11} /></button>
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (slashRef.current?.handleKeyDown(e)) return;
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun();
              }}
              placeholder="e.g. Research the top 3 vector databases and recommend one. Type / for commands."
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none focus:border-zinc-500 transition-colors"
            />
            <SlashCommandMenu ref={slashRef} commands={slashCommands} value={goal} onPick={() => textareaRef.current?.focus()} placement="down" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Execution mode */}
            <ModePicker value={mode} onChange={setMode} placement="down" />

            {/* Skill selector — same control as chat */}
            <SkillPicker value={skillId} onChange={setSkillId} skills={skills} placement="down" />

            {/* Tools */}
            <ToolPicker mode={toolMode} onMode={setToolMode} selected={toolNames} onSelected={setToolNames} tools={tools} placement="down" />

            {/* Model selector */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setModelOpen((o) => !o); }}
                className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 transition-colors"
              >
                {selected.model === 'auto' && <Zap size={11} className="text-amber-400 flex-shrink-0" />}
                <span className="max-w-[160px] truncate">{selected.model === 'auto' ? 'Auto' : (selected.model || 'Select model')}</span>
                <ChevronDown size={11} className={clsx('transition-transform', modelOpen && 'rotate-180')} />
              </button>
              {modelOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto py-1">
                    {modelGroups.length > 0 && (
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSelected({ model: 'auto', providerId: null }); setModelOpen(false); }}
                        className={clsx('w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 border-b border-zinc-700',
                          selected.model === 'auto' ? 'bg-zinc-700 text-white' : 'text-zinc-200 hover:bg-zinc-700')}
                      >
                        <Zap size={13} className="text-amber-400 flex-shrink-0" />
                        <span className="flex-1">
                          Auto
                          <span className="block text-[10px] text-zinc-500">Smart routing — best model per task</span>
                        </span>
                      </button>
                    )}
                    {modelGroups.length === 0 ? (
                      <p className="text-zinc-500 text-xs px-3 py-3">No models — open Settings → Providers to add one.</p>
                    ) : modelGroups.map((g) => (
                      <div key={g.provider_id}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{g.provider_name}</p>
                        {g.models.map((m) => (
                          <button
                            key={`${g.provider_id}:${m}`}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setSelected({ model: m, providerId: g.provider_id }); setModelOpen(false); }}
                            className={clsx('w-full text-left px-4 py-1.5 text-sm transition-colors',
                              m === selected.model ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}
                          >
                            <span className="truncate block">{m}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Multi-agent toggle */}
            <button
              type="button"
              onClick={() => setAllowSub((v) => !v)}
              className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-colors',
                allowSub ? 'bg-pink-950/40 border-pink-800/60 text-pink-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200')}
              title="Allow the agent to spawn sub-agents for parallel subtasks"
            >
              <Users size={12} /> Multi-agent {allowSub ? 'on' : 'off'}
            </button>

            {/* Team multi-select — agents the coordinator can delegate to */}
            {teamEnabled && (
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTeamOpen((o) => !o); }}
                  className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-colors',
                    teamIds.length ? 'bg-pink-950/40 border-pink-800/60 text-pink-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200')}
                  title="Pick specialised agents the coordinator can delegate subtasks to"
                >
                  <Users size={12} /> Team{teamIds.length ? ` · ${teamIds.length}` : ''}
                  <ChevronDown size={11} className={clsx('transition-transform', teamOpen && 'rotate-180')} />
                </button>
                {teamOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setTeamOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto py-1">
                      {teamCandidates.length === 0 ? (
                        <p className="text-zinc-500 text-xs px-3 py-3">No other agents yet — create some in the Agents manager.</p>
                      ) : teamCandidates.map((a) => {
                        const on = teamIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTeamIds((p) => on ? p.filter((x) => x !== a.id) : [...p, a.id]);
                            }}
                            className={clsx('w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors',
                              on ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}
                          >
                            <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                              on ? 'bg-pink-500 border-pink-500' : 'border-zinc-500')}>
                              {on && <span className="text-[9px] text-white leading-none">✓</span>}
                            </span>
                            <span className="min-w-0">
                              <span className="truncate block">{a.name}</span>
                              {a.description && <span className="truncate block text-[10px] text-zinc-500">{a.description}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex-1" />

            <button
              onClick={isRunning ? stop : handleRun}
              disabled={!isRunning && !goal.trim()}
              className={clsx('flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                isRunning ? 'bg-red-600 hover:bg-red-700 text-white'
                  : goal.trim() ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed')}
            >
              {isRunning ? <><Square size={13} /> Stop</> : <><Send size={13} /> Run</>}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto">
          {viewing && (
            <div className="mb-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">
                  Viewing past run · <span className={statusColor(viewing.status)}>{viewing.status}</span>
                  {viewing.mode && viewing.mode !== 'auto' && <span className="text-zinc-600"> · {viewing.mode}</span>}
                </p>
                <p className="text-sm text-zinc-300 truncate">{viewing.goal}</p>
              </div>
              <button onClick={onClearViewing} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-800">
                New run
              </button>
            </div>
          )}

          {runError && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-sm">
              {runError}
            </div>
          )}

          {showingLive && liveSteps.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center text-center py-20 text-zinc-600">
              <Bot size={36} className="mb-3" />
              <p className="text-sm">Describe a goal above and hit Run.</p>
              <p className="text-xs mt-1 text-zinc-700">Use <span className="font-mono">/goal</span> for autonomous mode or <span className="font-mono">/plan</span> to plan first.</p>
            </div>
          )}

          <StepTimeline
            steps={showingLive ? liveSteps : viewingSteps}
            running={showingLive && isRunning}
          />

          {/* Continue this run with a follow-up */}
          {canContinue && (viewing || liveSteps.length > 0) && (
            <div className="mt-5 border-t border-zinc-800 pt-4">
              <p className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1">
                <CornerDownRight size={11} /> Continue this run — ask a follow-up or refine the result.
              </p>
              <div className="flex items-end gap-2">
                <textarea
                  value={followup}
                  onChange={(e) => setFollowup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleContinue(); }
                  }}
                  placeholder="e.g. Now also compare pricing, or fix the issue you found…"
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none focus:border-zinc-500 transition-colors"
                />
                <button
                  onClick={handleContinue}
                  disabled={!followup.trim()}
                  className={clsx('flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    followup.trim() ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed')}
                >
                  <Send size={13} /> Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
