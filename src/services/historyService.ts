import type { ChatMessage } from '../types';

const HISTORY_KEY = 'eclipse-hub-chat-history';

/**
 * Получить историю чата из localStorage.
 * Возвращает пустой массив, если история отсутствует или повреждена.
 *
 * @returns массив сообщений чата
 */
export function getChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.warn('[historyService] История чата имеет некорректный формат, сбрасываем');
      return [];
    }

    return parsed as ChatMessage[];
  } catch (err) {
    console.error('[historyService] Ошибка чтения истории чата:', err);
    return [];
  }
}

/**
 * Сохранить историю чата в localStorage.
 * При превышении лимита хранилища удаляет старые сообщения.
 *
 * @param messages — массив сообщений для сохранения
 */
export function saveChatHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch (err) {
    // Если localStorage переполнен — пробуем сохранить последние 100 сообщений
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('[historyService] localStorage переполнен, обрезаем историю');
      try {
        const trimmed = messages.slice(-100);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      } catch (innerErr) {
        console.error('[historyService] Не удалось сохранить даже обрезанную историю:', innerErr);
      }
    } else {
      console.error('[historyService] Ошибка сохранения истории чата:', err);
    }
  }
}

/**
 * Полностью очистить историю чата из localStorage.
 */
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (err) {
    console.error('[historyService] Ошибка очистки истории чата:', err);
  }
}
