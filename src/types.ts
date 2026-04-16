export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'nvidia' | 'clawrouter' | 'metaclaw';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const PROVIDERS: Record<AIProvider, { name: string; models: string[]; needsKey: boolean; placeholder: string }> = {
  ollama: {
    name: 'Ollama (Локально)',
    models: ['huihui-ai/Huihui-Qwen3.5-35B-A3B-abliterated', 'qwen2.5-coder:7b', 'llama3.1', 'mistral', 'deepseek-coder-v2:16b', 'gemma2'],
    needsKey: false,
    placeholder: 'http://localhost:11434',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    needsKey: true,
    placeholder: 'AIza...',
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    needsKey: true,
    placeholder: 'sk-...',
  },
  anthropic: {
    name: 'Anthropic Claude',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    needsKey: true,
    placeholder: 'sk-ant-...',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'meta-llama/llama-4-maverick'],
    needsKey: true,
    placeholder: 'sk-or-...',
  },
  nvidia: {
    name: 'NVIDIA NIM',
    models: [
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'mistralai/mistral-nemo-12b-instruct',
    ],
    needsKey: true,
    placeholder: 'nvapi-...',
  },
  clawrouter: {
    name: 'ClawRouter (Локальный)',
    models: ['blockrun/auto', 'blockrun/eco', 'blockrun/premium'],
    needsKey: false,
    placeholder: 'http://localhost:8402',
  },
  metaclaw: {
    name: 'MetaClaw (Авто-скиллы)',
    models: ['metaclaw/auto', 'metaclaw/skills-only'],
    needsKey: false,
    placeholder: 'http://localhost:30000',
  },
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: AIProvider;
  model?: string;
}

export interface ArenaResult {
  prompt: string;
  responses: Array<{ provider: AIProvider; model: string; content: string; durationMs: number }>;
  winner?: string;
}

export interface RAGDocument {
  id: string;
  name: string;
  content: string;
  chunks: string[];
  addedAt: number;
}

export type ModuleId = 'chat' | 'arena' | 'rag' | 'code-review' | 'copywriter' | 'security-scan' | 'image-studio';
