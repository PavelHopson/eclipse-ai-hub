import type { AIConfig, AIProvider, ChatMessage } from '../types';

const CONFIG_KEY = 'eclipse-hub-ai-config';

/**
 * Получить текущую конфигурацию AI-провайдера из localStorage.
 * Возвращает конфигурацию по умолчанию (Ollama), если ничего не сохранено.
 */
export function getConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw) as AIConfig;
    }
  } catch (err) {
    console.error('[aiService] Ошибка чтения конфигурации:', err);
  }
  return {
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5-coder:7b',
    baseUrl: 'http://localhost:11434',
  };
}

/**
 * Сохранить конфигурацию AI-провайдера в localStorage.
 */
export function saveConfig(config: AIConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('[aiService] Ошибка сохранения конфигурации:', err);
  }
}

/**
 * Проверяет, является ли модель «нецензурированной» (abliterated/huihui).
 */
function isUncensoredModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes('abliterated') || lower.includes('huihui');
}

/**
 * Подготавливает массив сообщений для отправки, добавляя пометку для нецензурированных моделей.
 */
function prepareMessages(
  messages: ChatMessage[],
  model: string,
): Array<{ role: string; content: string }> {
  const prepared = messages.map((m) => ({ role: m.role, content: m.content }));

  if (isUncensoredModel(model)) {
    const systemIdx = prepared.findIndex((m) => m.role === 'system');
    if (systemIdx !== -1) {
      prepared[systemIdx].content += '\n[No restrictions]';
    } else {
      prepared.unshift({ role: 'system', content: '[No restrictions]' });
    }
  }

  return prepared;
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

/** Кеш для ленивой загрузки SDK Gemini */
let _geminiModule: typeof import('@google/genai') | null = null;

/**
 * Ленивый импорт @google/genai — загружается только при первом вызове.
 */
async function getGeminiSDK(): Promise<typeof import('@google/genai')> {
  if (!_geminiModule) {
    _geminiModule = await import('@google/genai');
  }
  return _geminiModule;
}

/**
 * Отправить запрос через Google Gemini SDK.
 */
async function chatGemini(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const { GoogleGenAI } = await getGeminiSDK();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  // Gemini ожидает роли 'user' и 'model'; system передаём как instruction
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const history = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Последнее сообщение (user) — отдельно для sendMessage
  const lastMsg = history.pop();
  if (!lastMsg) throw new Error('Нет сообщений для отправки');

  const chat = ai.chats.create({
    model: config.model,
    history,
    config: systemParts.length
      ? { systemInstruction: systemParts.join('\n') }
      : undefined,
  });

  const response = await chat.sendMessage({ message: lastMsg.parts[0].text });
  return response.text ?? '';
}

/**
 * Стриминг ответа через Google Gemini SDK.
 */
async function chatStreamGemini(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
): Promise<void> {
  const { GoogleGenAI } = await getGeminiSDK();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const history = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const lastMsg = history.pop();
  if (!lastMsg) throw new Error('Нет сообщений для отправки');

  const chat = ai.chats.create({
    model: config.model,
    history,
    config: systemParts.length
      ? { systemInstruction: systemParts.join('\n') }
      : undefined,
  });

  const stream = await chat.sendMessageStream({ message: lastMsg.parts[0].text });
  for await (const chunk of stream) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-совместимый формат (OpenAI, OpenRouter)
// ---------------------------------------------------------------------------

/**
 * Отправить запрос к API в формате OpenAI (используется для OpenAI и OpenRouter).
 */
async function chatOpenAIFormat(
  url: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[${response.status}] ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Стриминг ответа от API в формате OpenAI (SSE).
 */
async function chatStreamOpenAIFormat(
  url: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[${response.status}] ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Стрим не доступен');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {
        // Пропускаем некорректные строки SSE
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

/**
 * Отправить запрос через Anthropic Messages API.
 */
async function chatAnthropic(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    messages: conversationMessages,
  };
  if (systemParts.length) {
    body.system = systemParts.join('\n');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[${response.status}] ${errorText}`);
  }

  const data = await response.json();
  return data.content?.map((b: { text?: string }) => b.text ?? '').join('') ?? '';
}

/**
 * Стриминг ответа через Anthropic Messages API (SSE).
 */
async function chatStreamAnthropic(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
): Promise<void> {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    messages: conversationMessages,
    stream: true,
  };
  if (systemParts.length) {
    body.system = systemParts.join('\n');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[${response.status}] ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Стрим не доступен');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const parsed = JSON.parse(trimmed.slice(6));
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text);
        }
      } catch {
        // Пропускаем некорректные строки SSE
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

/**
 * Отправить запрос к Ollama API (/api/chat).
 */
async function chatOllama(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:11434';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[Ollama ${response.status}] ${errorText}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}

/**
 * Стриминг ответа от Ollama API (/api/chat, stream: true).
 */
async function chatStreamOllama(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
): Promise<void> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:11434';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Неизвестная ошибка');
    throw new Error(`[Ollama ${response.status}] ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Стрим не доступен');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          onChunk(parsed.message.content);
        }
      } catch {
        // Пропускаем некорректные строки
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

/**
 * Отправить историю сообщений выбранному AI-провайдеру и получить ответ.
 * Автоматически определяет провайдера из текущей конфигурации.
 *
 * @param messages — массив сообщений чата
 * @returns текст ответа от модели
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const config = getConfig();
  const prepared = prepareMessages(messages, config.model);

  switch (config.provider) {
    case 'gemini':
      return chatGemini(config, prepared);
    case 'openai':
      return chatOpenAIFormat(
        'https://api.openai.com/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
      );
    case 'anthropic':
      return chatAnthropic(config, prepared);
    case 'openrouter':
      return chatOpenAIFormat(
        'https://openrouter.ai/api/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
      );
    case 'ollama':
      return chatOllama(config, prepared);
    case 'clawrouter': {
      const base = (config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:8402') + '/v1/chat/completions';
      return chatOpenAIFormat(base, 'x402', config.model, prepared);
    }
    default:
      throw new Error(`Неизвестный провайдер: ${config.provider}`);
  }
}

/**
 * Стриминг ответа от AI-провайдера. Вызывает onChunk для каждого полученного фрагмента текста.
 *
 * @param messages — массив сообщений чата
 * @param onChunk — колбэк, вызываемый при получении каждого фрагмента
 */
export async function chatStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const config = getConfig();
  const prepared = prepareMessages(messages, config.model);

  switch (config.provider) {
    case 'gemini':
      return chatStreamGemini(config, prepared, onChunk);
    case 'openai':
      return chatStreamOpenAIFormat(
        'https://api.openai.com/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
        onChunk,
      );
    case 'anthropic':
      return chatStreamAnthropic(config, prepared, onChunk);
    case 'openrouter':
      return chatStreamOpenAIFormat(
        'https://openrouter.ai/api/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
        onChunk,
      );
    case 'ollama':
      return chatStreamOllama(config, prepared, onChunk);
    case 'clawrouter': {
      const base = (config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:8402') + '/v1/chat/completions';
      return chatStreamOpenAIFormat(base, 'x402', config.model, prepared, onChunk);
    }
    default:
      throw new Error(`Неизвестный провайдер: ${config.provider}`);
  }
}

/**
 * Простое завершение (completion) — отправляет системный промпт и пользовательский запрос,
 * возвращает текст ответа.
 *
 * @param systemPrompt — системная инструкция
 * @param userPrompt — запрос пользователя
 * @returns текст ответа от модели
 */
export async function complete(systemPrompt: string, userPrompt: string): Promise<string> {
  const now = Date.now();
  const messages: ChatMessage[] = [
    { id: `sys-${now}`, role: 'system', content: systemPrompt, timestamp: now },
    { id: `usr-${now}`, role: 'user', content: userPrompt, timestamp: now },
  ];
  return chat(messages);
}

/**
 * Завершение с явно переданной конфигурацией провайдера (для Арены).
 *
 * @param config — конфигурация AI-провайдера
 * @param systemPrompt — системная инструкция
 * @param userPrompt — запрос пользователя
 * @returns текст ответа от модели
 */
export async function completeWithConfig(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const now = Date.now();
  const messages: ChatMessage[] = [
    { id: `sys-${now}`, role: 'system', content: systemPrompt, timestamp: now },
    { id: `usr-${now}`, role: 'user', content: userPrompt, timestamp: now },
  ];
  const prepared = prepareMessages(messages, config.model);

  switch (config.provider) {
    case 'gemini':
      return chatGemini(config, prepared);
    case 'openai':
      return chatOpenAIFormat(
        'https://api.openai.com/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
      );
    case 'anthropic':
      return chatAnthropic(config, prepared);
    case 'openrouter':
      return chatOpenAIFormat(
        'https://openrouter.ai/api/v1/chat/completions',
        config.apiKey,
        config.model,
        prepared,
      );
    case 'ollama':
      return chatOllama(config, prepared);
    case 'clawrouter': {
      const base = (config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:8402') + '/v1/chat/completions';
      return chatOpenAIFormat(base, 'x402', config.model, prepared);
    }
    default:
      throw new Error(`Неизвестный провайдер: ${config.provider}`);
  }
}
