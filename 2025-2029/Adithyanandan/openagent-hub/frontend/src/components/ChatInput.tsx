import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Square, Paperclip, X, FileText, Image, ChevronDown, Eye, Brain, Zap, Bot, Target, ClipboardList, Eraser } from 'lucide-react';
import clsx from 'clsx';
import { uploadAttachment, AttachmentMeta } from '../services/attachments';
import { ProviderModel } from '../hooks/useProviders';
import { CatalogModel } from '../services/catalog';
import { Skill } from '../services/skills';
import { AgentTool, AgentMode } from '../services/agents';
import { ToolPicker, ToolMode } from './ToolPicker';
import { SkillPicker } from './SkillPicker';
import { RoutingPicker, RoutingMode } from './RoutingPicker';
import { SlashCommandMenu, SlashCommand, SlashMenuHandle } from './SlashCommandMenu';

interface Props {
  onSend: (message: string, attachmentIds: string[], opts: { toolMode: ToolMode; toolNames: string[]; skillId: string | null; skillAuto: boolean; routingMode: RoutingMode }) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  model: string;
  availableModels: string[];
  providerModels?: ProviderModel[];
  catalog?: CatalogModel[];
  skills?: Skill[];
  tools?: AgentTool[];
  onModelChange: (model: string, providerId?: string | null) => void;
  /** Jump to the Agents workspace, optionally prefilling a goal/mode (/agents, /goal, /plan). */
  onSwitchToAgents?: (prefill?: { goal?: string; mode?: AgentMode }) => void;
  /** Start a new chat (/clear). */
  onClearChat?: () => void;
}

function FileChip({ att, onRemove }: { att: AttachmentMeta; onRemove: () => void }) {
  const isImage = att.content_type.startsWith('image/');
  return (
    <div className="flex items-center gap-1.5 bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 max-w-[160px]">
      {isImage ? <Image size={12} className="flex-shrink-0 text-blue-400" /> : <FileText size={12} className="flex-shrink-0 text-zinc-400" />}
      <span className="truncate">{att.filename}</span>
      <button onClick={onRemove} className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 ml-0.5">
        <X size={11} />
      </button>
    </div>
  );
}

function CapabilityBadges({ entry }: { entry: CatalogModel }) {
  return (
    <span className="flex items-center gap-1 ml-1 flex-shrink-0">
      {entry.vision_support && (
        <span title="Vision" className="text-blue-400"><Eye size={9} /></span>
      )}
      {entry.reasoning_support && (
        <span title="Reasoning" className="text-purple-400"><Brain size={9} /></span>
      )}
      {entry.speed_score !== null && entry.speed_score >= 8 && (
        <span title="Fast" className="text-yellow-400"><Zap size={9} /></span>
      )}
      {entry.context_window !== null && entry.context_window >= 100_000 && (
        <span className="text-[9px] text-emerald-400 font-medium leading-none">
          {entry.context_window >= 1_000_000 ? '1M' : `${Math.round(entry.context_window / 1000)}k`}
        </span>
      )}
    </span>
  );
}

function ModelPicker({
  model,
  availableModels,
  providerModels,
  catalog,
  onChange,
}: {
  model: string;
  availableModels: string[];
  providerModels?: ProviderModel[];
  catalog?: CatalogModel[];
  onChange: (m: string, providerId?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen((o) => !o);
  };

  // Group by provider when providerModels is populated
  const hasProviders = providerModels && providerModels.length > 0;

  // Build grouped structure
  const groups: { provider_id: string; provider_name: string; models: string[] }[] = [];
  if (hasProviders) {
    const seen = new Map<string, number>();
    for (const pm of providerModels!) {
      if (!seen.has(pm.provider_id)) {
        seen.set(pm.provider_id, groups.length);
        groups.push({ provider_id: pm.provider_id, provider_name: pm.provider_name, models: [] });
      }
      groups[seen.get(pm.provider_id)!].models.push(pm.model);
    }
  }

  const flatModels = !hasProviders ? (availableModels.length > 0 ? availableModels : model ? [model] : []) : [];
  const isEmpty = hasProviders ? groups.length === 0 : flatModels.length === 0;
  const isAuto = model === 'auto';

  return (
    <div ref={ref} className="relative">
      <button type="button" onMouseDown={handleMouseDown}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-md px-1.5 py-1 hover:bg-zinc-700">
        {isAuto && <Zap size={11} className="text-amber-400 flex-shrink-0" />}
        <span className="max-w-[140px] truncate">{isAuto ? 'Auto' : (model || 'Select model')}</span>
        <ChevronDown size={11} className={clsx('transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {hasProviders && (
              <button type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange('auto', null); setOpen(false); }}
                className={clsx('w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 border-b border-zinc-700',
                  isAuto ? 'bg-zinc-700 text-white' : 'text-zinc-200 hover:bg-zinc-700')}>
                <Zap size={13} className="text-amber-400 flex-shrink-0" />
                <span className="flex-1">
                  Auto
                  <span className="block text-[10px] text-zinc-500">Smart routing — best model per task</span>
                </span>
              </button>
            )}
            {isEmpty ? (
              <p className="text-zinc-500 text-xs px-3 py-3">No models — open Settings → Providers to add one.</p>
            ) : hasProviders ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {groups.map((g) => (
                  <div key={g.provider_id}>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{g.provider_name}</p>
                    {g.models.map((m) => {
                      const meta = catalog?.find((c) => c.provider_id === g.provider_id && c.model_id === m);
                      return (
                        <button key={`${g.provider_id}:${m}`} type="button"
                          onMouseDown={(e) => { e.preventDefault(); onChange(m, g.provider_id); setOpen(false); }}
                          className={clsx('w-full text-left px-3 py-1.5 text-sm transition-colors pl-4 flex items-center gap-1',
                            m === model ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
                          <span className="truncate flex-1">{m}</span>
                          {meta && <CapabilityBadges entry={meta} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto py-1">
                {flatModels.map((m) => (
                  <button key={m} type="button"
                    onMouseDown={(e) => { e.preventDefault(); onChange(m, null); setOpen(false); }}
                    className={clsx('w-full text-left px-3 py-2 text-sm transition-colors',
                      m === model ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, model, availableModels, providerModels, catalog, skills, tools, onModelChange, onSwitchToAgents, onClearChat }: Props) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>('off');
  // Empty = all tools available; non-empty restricts to the selected tools.
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [skillId, setSkillId] = useState<string>('auto');
  const [routingMode, setRoutingMode] = useState<RoutingMode>('balanced');

  // Auto-switch to Reliability routing when tools are enabled.
  useEffect(() => {
    if (toolMode !== 'off') setRoutingMode('quality');
  }, [toolMode]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashRef = useRef<SlashMenuHandle>(null);

  // Slash commands available from the chat composer.
  const slashCommands: SlashCommand[] = [
    { name: 'agents', description: 'Open the Agents workspace', Icon: Bot, accent: 'text-blue-400', run: () => { onSwitchToAgents?.(); setValue(''); } },
    { name: 'goal', args: '<task>', description: 'Run an autonomous agent until the goal is achieved', Icon: Target, accent: 'text-emerald-400', takesArgs: true, run: () => { onSwitchToAgents?.({ mode: 'goal', goal: '' }); setValue(''); } },
    { name: 'plan', args: '<task>', description: 'Plan a task step-by-step in Agents', Icon: ClipboardList, accent: 'text-amber-400', takesArgs: true, run: () => { onSwitchToAgents?.({ mode: 'plan', goal: '' }); setValue(''); } },
    { name: 'clear', description: 'Start a new chat', Icon: Eraser, run: () => { onClearChat?.(); setValue(''); } },
  ];

  const handleSend = () => {
    // Intercept a leading slash command before sending as a message.
    const cmd = value.trim().match(/^\/(\w+)\s*([\s\S]*)$/);
    if (cmd) {
      const name = cmd[1].toLowerCase();
      const rest = (cmd[2] ?? '').trim();
      if (name === 'agents') { onSwitchToAgents?.(); setValue(''); return; }
      if (name === 'goal') { onSwitchToAgents?.({ mode: 'goal', goal: rest }); setValue(''); return; }
      if (name === 'plan') { onSwitchToAgents?.({ mode: 'plan', goal: rest }); setValue(''); return; }
      if (name === 'clear') { onClearChat?.(); setValue(''); return; }
      // unknown command → fall through and send as a normal message
    }

    const msg = value.trim();
    if ((!msg && attachments.length === 0) || isStreaming) return;
    const ids = attachments.map((a) => a.id);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(msg || '(see attachment)', ids, {
      toolMode,
      toolNames,
      skillId: skillId === 'auto' || skillId === '' ? null : skillId,
      skillAuto: skillId === 'auto',
      routingMode,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashRef.current?.handleKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const token = localStorage.getItem('token') || '';
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadAttachment(f, token)));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (!imageFiles.length) return;
    e.preventDefault();
    const token = localStorage.getItem('token') || '';
    setUploading(true);
    try {
      const uploaded = await Promise.all(imageFiles.map((f) => uploadAttachment(f, token)));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error('Paste upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const canSend = !isStreaming && !disabled && !uploading && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div className="px-4 pb-4 pt-1 max-w-5xl mx-auto w-full">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((att) => (
            <FileChip
              key={att.id}
              att={att}
              onRemove={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
            />
          ))}
        </div>
      )}

      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl focus-within:border-zinc-500 transition-colors">
        {/* Text area */}
        <div className="px-4 pt-3 pb-1 relative">
          <SlashCommandMenu ref={slashRef} commands={slashCommands} value={value} onPick={() => textareaRef.current?.focus()} placement="up" />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder={disabled ? 'Configure your provider in Settings first...' : 'Message OpenAgent Hub…  (/ for commands)'}
            disabled={disabled && !isStreaming}
            rows={1}
            className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none text-sm leading-relaxed max-h-48 disabled:cursor-not-allowed"
          />
        </div>

        {/* Bottom bar */}
        <div className="px-3 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming || uploading}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-30"
              title="Attach file"
            >
              <Paperclip size={15} className={uploading ? 'animate-pulse' : ''} />
            </button>
            <ModelPicker model={model} availableModels={availableModels} providerModels={providerModels} catalog={catalog} onChange={onModelChange} />
            <RoutingPicker mode={routingMode} onMode={setRoutingMode} placement="up" />

            {/* Tools: Off / Auto / Always + optional per-tool restriction */}
            <ToolPicker
              mode={toolMode}
              onMode={setToolMode}
              selected={toolNames}
              onSelected={setToolNames}
              tools={tools ?? []}
              placement="up"
            />

            {/* Skill picker */}
            <SkillPicker value={skillId} onChange={setSkillId} skills={skills ?? []} placement="up" />
          </div>

          <button
            onClick={isStreaming ? onStop : handleSend}
            disabled={!isStreaming && !canSend}
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
              isStreaming
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : canSend
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isStreaming ? <Square size={13} /> : <Send size={13} />}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-zinc-600 text-center mt-1.5">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
