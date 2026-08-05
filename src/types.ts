export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'nvidia' | 'clawrouter' | 'metaclaw' | 'fireworks' | 'groq' | 'cerebras' | 'mistral' | 'deepseek' | 'glm' | 'mimo' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const PROVIDERS: Record<AIProvider, { name: string; models: string[]; needsKey: boolean; placeholder: string }> = {
  ollama: {
    name: 'Ollama (Локально)',
    models: [
      'hf.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive:Q4_K_M',
      'hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q4_K_M',
      'huihui-ai/Huihui-Qwen3.5-35B-A3B-abliterated',
      'qwen2.5-coder:7b',
      'llama3.1',
      'mistral',
      'deepseek-coder-v2:16b',
      'gemma2',
    ],
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
  fireworks: {
    name: 'Fireworks (GLM-5.1)',
    models: ['accounts/zhipu-glm-5-1/models/glm-5-1', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct'],
    needsKey: true,
    placeholder: 'fw_...',
  },
  groq: {
    name: 'Groq (Бесплатно)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen-3-32b'],
    needsKey: true,
    placeholder: 'gsk_...',
  },
  cerebras: {
    name: 'Cerebras (Бесплатно)',
    models: ['gpt-oss-120b', 'qwen-3-32b', 'llama-3.3-70b', 'zai-glm-4.7'],
    needsKey: true,
    placeholder: 'csk-...',
  },
  mistral: {
    name: 'Mistral (Бесплатно)',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'ministral-8b-latest'],
    needsKey: true,
    placeholder: 'Mistral API key',
  },
  deepseek: {
    name: 'DeepSeek (дёшево · КНР)',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    needsKey: true,
    placeholder: 'sk-... (platform.deepseek.com)',
  },
  glm: {
    name: 'GLM · Zhipu (z.ai · КНР)',
    models: ['glm-4.6', 'glm-4.7', 'glm-5.2'],
    needsKey: true,
    placeholder: 'z.ai API key',
  },
  mimo: {
    name: 'MiMo · Xiaomi (КНР)',
    models: ['mimo-v2.5-pro', 'mimo-v2.5'],
    needsKey: true,
    placeholder: 'platform.xiaomimimo.com key',
  },
  custom: {
    name: 'Custom (OpenAI-совместимый)',
    models: ['deepseek-v4-flash'],
    needsKey: true,
    placeholder: 'API-ключ эндпоинта',
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

export type ModuleId = 'chat' | 'arena' | 'rag' | 'growth-os' | 'deck-studio' | 'ai-builder' | 'research-room' | 'ads-audit' | 'model-registry' | 'code-review' | 'copywriter' | 'security-scan' | 'image-studio';
