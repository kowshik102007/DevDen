import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu } from 'lucide-react';

interface Props {
  model: string;
  availableModels: string[];
  onChange: (model: string) => void;
}

export function ModelSelector({ model, availableModels, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const models = availableModels.length > 0 ? availableModels : (model ? [model] : []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 transition-colors"
      >
        <Cpu size={13} className="text-zinc-400" />
        <span className="max-w-48 truncate">{model || 'Select model'}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {models.length === 0 ? (
            <p className="text-zinc-500 text-xs px-3 py-3">
              No models loaded. Open Settings → Fetch to load models.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => { onChange(m); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                    m === model ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
