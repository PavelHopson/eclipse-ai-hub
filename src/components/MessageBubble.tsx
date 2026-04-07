import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ChatMessage } from '../types';
import { ProviderBadge } from './ProviderBadge';

interface MessageBubbleProps {
  message: ChatMessage;
}

/** Basic markdown-to-HTML: code blocks, inline code, bold, italic, links, line breaks */
function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langLabel = lang ? `<span class="text-xs text-gray-500 absolute top-2 right-10 select-none">${lang}</span>` : '';
    return `<div class="code-block-wrapper relative my-3 rounded-lg bg-[#0d0d1a] border border-hub-border overflow-hidden">
      ${langLabel}
      <pre class="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed"><code>${code.trim()}</code></pre>
    </div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/5 text-hub-accent-light text-sm font-mono">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-hub-accent-light underline underline-offset-2 hover:text-hub-accent">$1</a>'
  );

  // Line breaks (but not inside code blocks)
  html = html.replace(/\n/g, '<br/>');

  return html;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const handleCopyCode = (index: number) => {
    // Extract code blocks from raw content
    const codeBlocks = message.content.match(/```\w*\n([\s\S]*?)```/g);
    if (codeBlocks && codeBlocks[index]) {
      const code = codeBlocks[index].replace(/```\w*\n/, '').replace(/```$/, '').trim();
      navigator.clipboard.writeText(code);
      setCopiedBlock(index);
      setTimeout(() => setCopiedBlock(null), 2000);
    }
  };

  const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Count code blocks for copy buttons
  const codeBlockCount = (message.content.match(/```/g) || []).length / 2;

  return (
    <div
      className={`flex animate-fade-in ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`
          max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-hub-accent text-white rounded-br-md'
            : 'bg-hub-card border border-hub-border text-gray-200 rounded-bl-md'
          }
        `}
      >
        {/* Provider badge for assistant */}
        {!isUser && message.provider && (
          <div className="mb-2">
            <ProviderBadge provider={message.provider} model={message.model} />
          </div>
        )}

        {/* Content */}
        <div
          className="text-sm leading-relaxed break-words prose-invert"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />

        {/* Copy buttons for code blocks */}
        {!isUser && codeBlockCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Array.from({ length: codeBlockCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleCopyCode(i)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                title={`Скопировать блок ${i + 1}`}
              >
                {copiedBlock === i ? (
                  <><Check size={12} className="text-green-400" /> Скопировано</>
                ) : (
                  <><Copy size={12} /> Код {codeBlockCount > 1 ? `#${i + 1}` : ''}</>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50 text-right' : 'text-gray-500'}`}>
          {time}
        </div>
      </div>
    </div>
  );
};
