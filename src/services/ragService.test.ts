import { describe, expect, it } from 'vitest';
import { findRelevantChunks, buildRAGPrompt, parseDocument } from './ragService';
import type { RAGDocument } from '../types';

function makeDoc(chunks: string[]): RAGDocument {
  return {
    id: 'doc-test',
    name: 'test.txt',
    content: chunks.join(' '),
    chunks,
    addedAt: Date.now(),
  };
}

describe('ragService.findRelevantChunks', () => {
  it('returns empty array when document has no chunks', () => {
    expect(findRelevantChunks('test', makeDoc([]))).toEqual([]);
  });

  it('returns first topK chunks when query words are too short (<=2 chars)', () => {
    const doc = makeDoc(['alpha', 'beta', 'gamma', 'delta']);
    const result = findRelevantChunks('ab', doc, 2);
    expect(result).toEqual(['alpha', 'beta']);
  });

  it('scores chunks by keyword frequency and returns top matches', () => {
    const doc = makeDoc([
      'React hooks are great for state management',
      'Python is popular for data science and machine learning',
      'React components and React hooks simplify UI development',
    ]);

    const result = findRelevantChunks('React hooks', doc, 2);
    // Chunk 3 mentions "react" twice + "hooks" once → highest score
    // Chunk 1 mentions "react" once + "hooks" once
    expect(result[0]).toContain('React components');
    expect(result[1]).toContain('React hooks are great');
  });

  it('is case-insensitive', () => {
    const doc = makeDoc(['TYPESCRIPT is great', 'javascript is fine']);
    const result = findRelevantChunks('typescript', doc, 1);
    expect(result[0]).toContain('TYPESCRIPT');
  });

  it('respects topK parameter', () => {
    const doc = makeDoc(['a word', 'b word', 'c word', 'd word']);
    expect(findRelevantChunks('word', doc, 2)).toHaveLength(2);
    expect(findRelevantChunks('word', doc, 4)).toHaveLength(4);
  });

  it('defaults to topK=3', () => {
    const doc = makeDoc(['a keyword', 'b keyword', 'c keyword', 'd keyword', 'e keyword']);
    expect(findRelevantChunks('keyword', doc)).toHaveLength(3);
  });

  it('strips punctuation from query before matching', () => {
    const doc = makeDoc(['the server crashed yesterday', 'the client works fine']);
    const result = findRelevantChunks('server...crashed???', doc, 1);
    expect(result[0]).toContain('server crashed');
  });
});

describe('ragService.buildRAGPrompt', () => {
  it('returns a simple prompt when no chunks are provided', () => {
    const prompt = buildRAGPrompt('What is React?', []);
    expect(prompt).toContain('What is React?');
    expect(prompt).not.toContain('Фрагмент');
  });

  it('includes numbered fragments and the query', () => {
    const chunks = ['React is a UI library', 'Vue is another framework'];
    const prompt = buildRAGPrompt('Compare React and Vue', chunks);

    expect(prompt).toContain('[Фрагмент 1]');
    expect(prompt).toContain('React is a UI library');
    expect(prompt).toContain('[Фрагмент 2]');
    expect(prompt).toContain('Vue is another framework');
    expect(prompt).toContain('Compare React and Vue');
    expect(prompt).toContain('честно укажи');
  });

  it('preserves chunk content verbatim (no trimming or transformation)', () => {
    const chunks = ['  spaces preserved  ', 'Line1\nLine2'];
    const prompt = buildRAGPrompt('test', chunks);
    expect(prompt).toContain('  spaces preserved  ');
    expect(prompt).toContain('Line1\nLine2');
  });
});

describe('ragService.parseDocument', () => {
  it('extracts text from a .txt file and splits into chunks', async () => {
    const content = 'A'.repeat(1200); // >500 chars → multiple chunks
    const file = new File([content], 'test.txt', { type: 'text/plain' });

    const doc = await parseDocument(file);

    expect(doc.name).toBe('test.txt');
    expect(doc.content).toBe(content);
    expect(doc.chunks.length).toBeGreaterThan(1);
    expect(doc.id).toMatch(/^doc-/);
    expect(doc.addedAt).toBeGreaterThan(0);
  });

  it('handles a short file as a single chunk', async () => {
    const file = new File(['Short text.'], 'note.txt', { type: 'text/plain' });

    const doc = await parseDocument(file);
    expect(doc.chunks).toHaveLength(1);
    expect(doc.chunks[0]).toBe('Short text.');
  });

  it('throws when file content is empty', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    await expect(parseDocument(file)).rejects.toThrow('Не удалось извлечь текст');
  });

  it('reads .md files as text', async () => {
    const file = new File(['# Hello\nWorld'], 'readme.md', { type: 'text/markdown' });
    const doc = await parseDocument(file);
    expect(doc.content).toContain('# Hello');
  });

  it('reads .json files as text', async () => {
    const file = new File(['{"key": "value"}'], 'data.json', { type: 'application/json' });
    const doc = await parseDocument(file);
    expect(doc.content).toContain('"key"');
  });
});
