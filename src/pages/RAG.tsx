import React, { useState } from 'react';
import { FileText, Upload, Search, Trash2, File, Loader2 } from 'lucide-react';
import { RAGDocument } from '../types';
import { parseDocument, findRelevantChunks, buildRAGPrompt } from '../services/ragService';
import { complete } from '../services/aiService';

export const RAG: React.FC = () => {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    setError('');

    for (const file of Array.from(files)) {
      try {
        const doc = await parseDocument(file);
        setDocuments((prev) => [...prev, doc]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Ошибка загрузки: ${file.name}`);
      }
    }

    setUploading(false);
    e.target.value = '';
  };

  const removeDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleQuery = async () => {
    if (!query.trim() || documents.length === 0 || loading) return;

    setLoading(true);
    setAnswer('');
    setError('');

    try {
      // Gather relevant chunks from all documents
      const allChunks: string[] = [];
      for (const doc of documents) {
        const chunks = findRelevantChunks(query, doc, 3);
        allChunks.push(...chunks);
      }

      const ragPrompt = buildRAGPrompt(query, allChunks);
      const systemPrompt =
        'Ты — эксперт по анализу документов. Отвечай точно на основе предоставленного контекста. Если информации недостаточно, честно укажи это. Ответь на русском.';

      const result = await complete(systemPrompt, ragPrompt);
      setAnswer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при запросе к AI');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <FileText size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">RAG - Работа с документами</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Upload zone */}
          <div className="hub-card p-6 mb-6">
            <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-hub-border rounded-lg cursor-pointer hover:border-hub-accent/50 transition-colors">
              {uploading ? (
                <Loader2 size={32} className="text-hub-accent animate-spin" />
              ) : (
                <Upload size={32} className="text-gray-500" />
              )}
              <span className="text-sm text-gray-400">
                {uploading ? 'Загрузка и парсинг...' : 'Нажмите или перетащите файлы (.txt, .md, .json, .pdf)'}
              </span>
              <input
                type="file"
                multiple
                accept=".txt,.md,.json,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Document list */}
          {documents.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm text-gray-400 mb-3">Загруженные документы ({documents.length})</h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="hub-card flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <File size={16} className="text-hub-accent shrink-0" />
                      <div>
                        <span className="text-sm text-white">{doc.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{doc.chunks.length} чанков</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Query */}
          <div className="hub-card p-6">
            <label className="text-sm text-gray-400 mb-2 block">Вопрос по документам</label>
            <div className="flex gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Задайте вопрос по загруженным документам..."
                className="hub-input"
              />
              <button
                onClick={handleQuery}
                disabled={!query.trim() || documents.length === 0 || loading}
                className="hub-btn shrink-0 flex items-center gap-2 disabled:opacity-40"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? 'Поиск...' : 'Найти'}
              </button>
            </div>
            {documents.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">Сначала загрузите документы</p>
            )}
          </div>

          {/* Answer */}
          {answer && (
            <div className="hub-card p-6 mt-6">
              <label className="text-sm text-gray-400 mb-3 block">Ответ</label>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {answer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
