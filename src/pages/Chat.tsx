import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { MessageBubble } from '../components/MessageBubble';
import { chatStream, getConfig } from '../services/aiService';
import { getChatHistory, saveChatHistory, clearChatHistory } from '../services/historyService';

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getChatHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Persist history whenever messages change
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const config = getConfig();
    const assistantId = crypto.randomUUID();

    // Create placeholder assistant message for streaming
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      provider: config.provider,
      model: config.model,
    };

    setMessages((prev) => [...prev, assistantMsg]);

    try {
      let accumulated = '';
      await chatStream(updatedMessages, (chunk) => {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
        );
      });

      // If streaming produced no content, update with a fallback
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Получен пустой ответ от модели.' }
              : m,
          ),
        );
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Ошибка: ${errorText}` }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    clearChatHistory();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-hub-border shrink-0">
        <h1 className="text-lg font-semibold text-white">Чат</h1>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="hub-btn-ghost flex items-center gap-2 text-xs"
          >
            <Trash2 size={14} /> Очистить
          </button>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-hub-accent/10 flex items-center justify-center mb-4">
              <Send size={24} className="text-hub-accent" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Eclipse AI Chat</h2>
            <p className="text-gray-500 text-sm max-w-md">
              Начните диалог с AI. Выберите провайдера и модель в настройках.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
            <Loader2 size={16} className="animate-spin" />
            Генерация ответа...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-hub-border px-6 py-4 shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            rows={1}
            className="hub-input resize-none min-h-[44px] max-h-40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="hub-btn shrink-0 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
