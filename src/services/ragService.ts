import type { RAGDocument } from '../types';

/**
 * Разбить текст на чанки заданного размера с перекрытием.
 *
 * @param text — исходный текст
 * @param chunkSize — размер одного чанка в символах
 * @param overlap — размер перекрытия между соседними чанками
 * @returns массив текстовых чанков
 */
function splitIntoChunks(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  if (!text || text.length === 0) return chunks;

  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    // Сдвигаемся на (chunkSize - overlap), но минимум на 1 символ
    start += Math.max(chunkSize - overlap, 1);
  }

  return chunks;
}

/**
 * Извлечь текст из файла. Поддерживает .txt и .pdf (базовое извлечение текста из PDF).
 *
 * @param file — загруженный файл (File объект)
 * @returns извлечённый текст
 */
async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
    return file.text();
  }

  if (ext === 'pdf') {
    return extractTextFromPDF(file);
  }

  // Для остальных форматов пробуем прочитать как текст
  try {
    return await file.text();
  } catch {
    throw new Error(`Не удалось прочитать файл: ${file.name}. Поддерживаемые форматы: .txt, .md, .csv, .json, .pdf`);
  }
}

/**
 * Базовое извлечение текста из PDF — ищет текстовые строки в бинарных данных.
 * Для полноценного парсинга рекомендуется использовать pdf.js.
 *
 * @param file — PDF-файл
 * @returns извлечённый текст (может быть неполным)
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Декодируем весь файл как Latin-1 для поиска текстовых потоков
  let rawText = '';
  for (let i = 0; i < bytes.length; i++) {
    rawText += String.fromCharCode(bytes[i]);
  }

  const textParts: string[] = [];

  // Извлекаем содержимое между BT (Begin Text) и ET (End Text) операторами
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(rawText)) !== null) {
    const block = match[1];

    // Извлекаем строки из Tj и TJ операторов
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = tjMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\([()])/g, '$1');
      if (decoded.trim()) textParts.push(decoded);
    }

    // TJ-массив: [(text) kern (text) ...]
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrayMatch: RegExpExecArray | null;
    while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
      const innerRegex = /\(([^)]*)\)/g;
      let innerMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((innerMatch = innerRegex.exec(tjArrayMatch[1])) !== null) {
        parts.push(
          innerMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\')
            .replace(/\\([()])/g, '$1'),
        );
      }
      if (parts.length > 0) textParts.push(parts.join(''));
    }
  }

  const result = textParts.join(' ').replace(/\s+/g, ' ').trim();

  if (!result) {
    // Если BT/ET не дало результатов — фолбэк на простой UTF-8 decode
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const utf8 = decoder.decode(buffer);
    // Убираем бинарный мусор, оставляем только печатные символы
    return utf8.replace(/[^\x20-\x7E\xA0-\xFF\u0400-\u04FF\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, ' ')
      .trim();
  }

  return result;
}

/**
 * Парсинг документа: извлекает текст и разбивает на чанки для RAG.
 *
 * @param file — загруженный файл
 * @returns объект RAGDocument с чанками
 */
export async function parseDocument(file: File): Promise<RAGDocument> {
  const content = await extractText(file);

  if (!content || content.trim().length === 0) {
    throw new Error(`Не удалось извлечь текст из файла: ${file.name}`);
  }

  const chunks = splitIntoChunks(content, 500, 100);

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    content,
    chunks,
    addedAt: Date.now(),
  };
}

/**
 * Найти наиболее релевантные чанки для заданного запроса.
 * Используется простой keyword-based scoring: разбиваем запрос на слова,
 * считаем количество совпадений в каждом чанке.
 *
 * @param query — пользовательский запрос
 * @param doc — документ с чанками
 * @param topK — количество возвращаемых чанков (по умолчанию 3)
 * @returns массив наиболее релевантных чанков
 */
export function findRelevantChunks(query: string, doc: RAGDocument, topK = 3): string[] {
  if (!doc.chunks.length) return [];

  // Нормализуем запрос: приводим к нижнему регистру, разбиваем на слова
  const queryWords = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((w) => w.length > 2); // Игнорируем слишком короткие слова

  if (queryWords.length === 0) {
    // Если запрос слишком короткий — возвращаем первые topK чанков
    return doc.chunks.slice(0, topK);
  }

  // Оцениваем каждый чанк
  const scored = doc.chunks.map((chunk) => {
    const lowerChunk = chunk.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      // Считаем все вхождения слова в чанке
      let idx = 0;
      while (true) {
        idx = lowerChunk.indexOf(word, idx);
        if (idx === -1) break;
        score += 1;
        idx += word.length;
      }
    }

    return { chunk, score };
  });

  // Сортируем по убыванию релевантности и берём topK
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.chunk);
}

/**
 * Сформировать промпт для RAG-запроса: объединяет контекст из чанков и вопрос пользователя.
 *
 * @param query — вопрос пользователя
 * @param chunks — релевантные фрагменты документа
 * @returns готовый промпт для отправки AI
 */
export function buildRAGPrompt(query: string, chunks: string[]): string {
  if (chunks.length === 0) {
    return `Ответь на вопрос: ${query}`;
  }

  const context = chunks
    .map((chunk, i) => `[Фрагмент ${i + 1}]\n${chunk}`)
    .join('\n\n');

  return [
    'На основе следующих фрагментов документа:',
    '',
    context,
    '',
    '---',
    '',
    `Ответь на вопрос: ${query}`,
    '',
    'Если информации в фрагментах недостаточно для ответа, честно укажи это.',
  ].join('\n');
}
