import { useState } from 'react';
import { SquarePen, MessageSquare, Trash2, Edit2, Check, X, Search, FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown, Settings, Bot, Plus, Play } from 'lucide-react';
import clsx from 'clsx';
import { Conversation } from '../services/chat';
import { Project } from '../services/projects';
import { AgentRun, Agent } from '../services/agents';


interface Props {
  /** Which workspace the sidebar reflects. */
  mode: 'chat' | 'agents';

  // Chat
  conversations: Conversation[];
  currentId?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMoveToProject?: (convId: string, projectId: string | null) => void;

  // Projects (shared)
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onAddProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;

  // Agents
  runs?: AgentRun[];
  currentRunId?: string | null;
  onSelectRun?: (id: string) => void;
  onDeleteRun?: (id: string) => void;
  onClearRuns?: () => void;
  onNewRun?: () => void;
  agents?: Agent[];
  onManageAgents?: () => void;
  onUseAgent?: (a: Agent) => void;

  username: string;
  onOpenSettings: () => void;
}

function groupByDate<T extends { updated_at?: string; created_at?: string }>(items: T[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const lastWeek = today - 7 * 86400000;

  const groups: { label: string; items: T[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const c of items) {
    const t = new Date((c.updated_at || c.created_at)!).getTime();
    if (t >= today) groups[0].items.push(c);
    else if (t >= yesterday) groups[1].items.push(c);
    else if (t >= lastWeek) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

function runStatusColor(status: string) {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'failed') return 'text-red-400';
  if (status === 'running') return 'text-blue-400';
  return 'text-zinc-500';
}

function ConvItem({
  conv, isActive, onSelect, onRename, onDelete,
}: {
  conv: Conversation; isActive: boolean;
  onSelect: () => void; onRename: (title: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
        isActive ? 'bg-zinc-700/60 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      )}
    >
      {editing ? (
        <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { if (title.trim()) onRename(title.trim()); setEditing(false); }
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 min-w-0 bg-zinc-700 rounded px-1.5 py-0.5 text-xs text-white outline-none"
          />
          <button onClick={() => { if (title.trim()) onRename(title.trim()); setEditing(false); }} className="text-emerald-400 hover:text-emerald-300"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
        </div>
      ) : (
        <>
          <span className="flex-1 truncate text-sm">{conv.title}</span>
          <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setTitle(conv.title); setEditing(true); }} className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300"><Edit2 size={11} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400"><Trash2 size={11} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function RunItem({
  run, isActive, onSelect, onDelete,
}: {
  run: AgentRun; isActive: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
        isActive ? 'bg-zinc-700/60 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', runStatusColor(run.status).replace('text-', 'bg-'))} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {run.mode && run.mode !== 'auto' && (
            <span className="text-[9px] uppercase tracking-wide text-zinc-500">{run.mode}</span>
          )}
          <span className={clsx('text-[9px] uppercase tracking-wide', runStatusColor(run.status))}>{run.status}</span>
        </div>
        <p className="truncate text-xs leading-snug mt-0.5">{run.goal}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="hidden group-hover:block p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400 flex-shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function ProjectItem({
  project, isSelected, onSelect, onRename, onDelete,
}: {
  project: Project; isSelected: boolean;
  onSelect: () => void; onRename: (name: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
        isSelected ? 'bg-zinc-700/60 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      )}
    >
      {isSelected ? <FolderOpen size={14} className="flex-shrink-0 text-yellow-400" /> : <Folder size={14} className="flex-shrink-0" />}
      {editing ? (
        <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { if (name.trim()) onRename(name.trim()); setEditing(false); }
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 min-w-0 bg-zinc-700 rounded px-1.5 py-0.5 text-xs text-white outline-none"
          />
          <button onClick={() => { if (name.trim()) onRename(name.trim()); setEditing(false); }} className="text-emerald-400 hover:text-emerald-300"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
        </div>
      ) : (
        <>
          <span className="flex-1 truncate text-sm">{project.name}</span>
          <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setName(project.name); setEditing(true); }} className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300"><Edit2 size={11} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400"><Trash2 size={11} /></button>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({
  mode,
  conversations, currentId, onSelect, onNew, onDelete, onRename,
  projects, selectedProjectId, onSelectProject, onAddProject, onRenameProject, onDeleteProject,
  runs = [], currentRunId, onSelectRun, onDeleteRun, onClearRuns, onNewRun, agents = [], onManageAgents, onUseAgent,
  username, onOpenSettings,
}: Props) {
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);

  const isAgents = mode === 'agents';

  const filteredConvs = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;
  const convGroups = groupByDate(filteredConvs);

  const filteredRuns = search.trim()
    ? runs.filter((r) => r.goal.toLowerCase().includes(search.toLowerCase()))
    : runs;
  const runGroups = groupByDate(filteredRuns);

  const submitNewProject = () => {
    if (newProjectName.trim()) {
      onAddProject(newProjectName.trim());
      setNewProjectName('');
    }
    setAddingProject(false);
  };

  return (
    <div className="w-64 bg-zinc-900 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-200 px-1">OpenAgent Hub</span>
        <button
          onClick={isAgents ? onNewRun : onNew}
          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={isAgents ? 'New run' : 'New chat'}
        >
          <SquarePen size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 focus-within:bg-zinc-700 transition-colors">
          <Search size={13} className="text-zinc-500 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAgents ? 'Search runs' : 'Search'}
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {/* Saved agents (agents mode only) */}
        {isAgents && (
          <div className="mb-1">
            <button
              onClick={() => setAgentsOpen((o) => !o)}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-zinc-500 text-xs font-medium uppercase tracking-wide hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
            >
              {agentsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>Agents</span>
              <button
                onClick={(e) => { e.stopPropagation(); onManageAgents?.(); }}
                className="ml-auto p-0.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300"
                title="Manage agents"
              >
                <Plus size={12} />
              </button>
            </button>
            {agentsOpen && (
              <div className="mt-0.5 space-y-0.5">
                {agents.length === 0 ? (
                  <button
                    onClick={onManageAgents}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800"
                  >
                    + Create an agent
                  </button>
                ) : agents.map((a) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                    onClick={() => onUseAgent?.(a)}
                    title={a.description || a.name}
                  >
                    <Bot size={13} className="flex-shrink-0 text-blue-400" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <Play size={11} className="hidden group-hover:block text-emerald-400 flex-shrink-0" />
                  </div>
                ))}
                <button
                  onClick={onManageAgents}
                  className="w-full text-left px-3 py-1 text-[11px] text-zinc-600 hover:text-zinc-400"
                >
                  Manage agents…
                </button>
              </div>
            )}
            <div className="border-t border-zinc-800 my-2" />
          </div>
        )}

        {/* Projects (shared) */}
        <div className="mb-1">
          <button
            onClick={() => setProjectsOpen((o) => !o)}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-zinc-500 text-xs font-medium uppercase tracking-wide hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
          >
            {projectsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Projects</span>
            <button
              onClick={(e) => { e.stopPropagation(); setAddingProject(true); setProjectsOpen(true); }}
              className="ml-auto p-0.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300"
              title="New project"
            >
              <FolderPlus size={12} />
            </button>
          </button>

          {projectsOpen && (
            <div className="mt-0.5 space-y-0.5">
              {addingProject && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Folder size={14} className="flex-shrink-0 text-zinc-500" />
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNewProject();
                      if (e.key === 'Escape') { setAddingProject(false); setNewProjectName(''); }
                    }}
                    onBlur={submitNewProject}
                    placeholder="Project name..."
                    className="flex-1 bg-zinc-800 rounded px-2 py-0.5 text-sm text-white outline-none"
                  />
                </div>
              )}
              <div
                onClick={() => onSelectProject(null)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
                  selectedProjectId === null ? 'bg-zinc-700/60 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                <span>All {isAgents ? 'runs' : 'chats'}</span>
              </div>
              {projects.map((p) => (
                <ProjectItem
                  key={p.id}
                  project={p}
                  isSelected={selectedProjectId === p.id}
                  onSelect={() => onSelectProject(p.id)}
                  onRename={(name) => onRenameProject(p.id, name)}
                  onDelete={() => onDeleteProject(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-2" />

        {/* Conversations or runs */}
        {isAgents ? (
          runGroups.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-6">No runs yet</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-zinc-600 text-[10px] uppercase tracking-wide font-medium">Run history</span>
                {runs.length > 0 && (
                  <button
                    onClick={() => { if (confirm('Delete all run history? This cannot be undone.')) onClearRuns?.(); }}
                    className="text-[10px] text-zinc-600 hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
              </div>
              {runGroups.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-zinc-600 text-xs px-3 py-1 font-medium">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((r) => (
                      <RunItem
                        key={r.id}
                        run={r}
                        isActive={currentRunId === r.id}
                        onSelect={() => onSelectRun?.(r.id)}
                        onDelete={() => onDeleteRun?.(r.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )
        ) : convGroups.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6">No conversations yet</p>
        ) : (
          convGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="text-zinc-600 text-xs px-3 py-1 font-medium">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((conv) => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    isActive={currentId === conv.id}
                    onSelect={() => onSelect(conv.id)}
                    onRename={(title) => onRename(conv.id, title)}
                    onDelete={() => onDelete(conv.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-800">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group cursor-default">
          <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 text-sm text-zinc-300 truncate">{username}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Settings"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
