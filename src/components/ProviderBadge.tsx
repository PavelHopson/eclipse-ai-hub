import React from 'react';
import { AIProvider } from '../types';

const PROVIDER_COLORS: Record<AIProvider, { bg: string; text: string }> = {
  ollama:     { bg: 'bg-green-500/15',   text: 'text-green-400' },
  gemini:     { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
  openai:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  anthropic:  { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
  openrouter: { bg: 'bg-purple-500/15',  text: 'text-purple-400' },
  nvidia:     { bg: 'bg-lime-500/15',    text: 'text-lime-400' },
  clawrouter: { bg: 'bg-cyan-500/15',    text: 'text-cyan-400' },
  metaclaw:   { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  fireworks:  { bg: 'bg-rose-500/15',    text: 'text-rose-400' },
  groq:       { bg: 'bg-red-500/15',     text: 'text-red-400' },
  cerebras:   { bg: 'bg-sky-500/15',     text: 'text-sky-400' },
  mistral:    { bg: 'bg-yellow-500/15',  text: 'text-yellow-400' },
  deepseek:   { bg: 'bg-indigo-500/15',  text: 'text-indigo-400' },
  glm:        { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  mimo:       { bg: 'bg-teal-500/15',    text: 'text-teal-400' },
  custom:     { bg: 'bg-slate-500/15',   text: 'text-slate-400' },
};

interface ProviderBadgeProps {
  provider: AIProvider;
  model?: string;
  className?: string;
}

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider, model, className = '' }) => {
  const colors = PROVIDER_COLORS[provider] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span className="capitalize">{provider}</span>
      {model && (
        <span className="opacity-60 font-normal">/ {model}</span>
      )}
    </span>
  );
};
