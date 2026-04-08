import React, { useState } from 'react';
import { Sparkles, Download, Loader2, AlertCircle, Copy, Check, Image, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { getConfig } from '../services/aiService';
import { PROVIDERS } from '../types';

type GenerationState = 'idle' | 'generating' | 'complete' | 'error';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

// Prompt templates inspired by Awesome Nano Banana
const PROMPT_TEMPLATES = [
  { label: '📸 Портрет', prompt: 'Professional portrait, golden hour, 85mm lens, bokeh, 8K' },
  { label: '🌸 Манга', prompt: 'Manga illustration, cel shading, expressive eyes, dynamic pose' },
  { label: '👾 Пиксель', prompt: '16-bit pixel art, retro game style, crisp pixels, nostalgic' },
  { label: '🧊 3D Изо', prompt: 'Isometric 3D render, miniature diorama, tilt-shift, vibrant' },
  { label: '🗾 Укиё-э', prompt: 'Ukiyo-e woodblock print, flat colors, Hokusai style, traditional' },
  { label: '🧱 LEGO', prompt: 'LEGO minifigure diorama, macro lens, toy photography, studio light' },
  { label: '📦 Продукт', prompt: 'Product on white background, studio lighting, commercial quality' },
  { label: '💫 Комикс', prompt: 'Comic book art, bold outlines, halftone dots, vivid primary colors' },
  { label: '🌃 Киберпанк', prompt: 'Cyberpunk cityscape, neon lights, rain, holographic ads, 8K' },
  { label: '🎨 Акварель', prompt: 'Watercolor painting, soft edges, paper texture, pastel palette' },
];

export const ImageStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<AspectRatio>('1:1');
  const [state, setState] = useState<GenerationState>('idle');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = getConfig();
  const providerInfo = PROVIDERS[config.provider];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!config.apiKey && config.provider !== 'ollama') {
      setError('API ключ не настроен. Перейдите в Настройки.');
      setState('error');
      return;
    }

    setState('generating');
    setError('');
    setImageUrl('');

    try {
      if (config.provider === 'gemini') {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: config.apiKey });

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-preview-image-generation',
          contents: prompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if ((part as any).inlineData) {
            const data = (part as any).inlineData;
            setImageUrl(`data:${data.mimeType};base64,${data.data}`);
            setState('complete');
            return;
          }
        }
        throw new Error('Модель не вернула изображение. Попробуйте другой промпт.');
      } else if (config.provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: ratio === '16:9' ? '1792x1024' : ratio === '9:16' ? '1024x1792' : '1024x1024',
            response_format: 'b64_json',
          }),
        });

        if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json;
        if (b64) {
          setImageUrl(`data:image/png;base64,${b64}`);
          setState('complete');
          return;
        }
        throw new Error('Нет изображения в ответе');
      } else {
        throw new Error(`Провайдер "${providerInfo?.name}" не поддерживает генерацию изображений. Используйте Gemini или OpenAI.`);
      }
    } catch (err: any) {
      setState('error');
      setError(err.message || 'Ошибка генерации');
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `eclipse-image-${Date.now()}.png`;
    a.click();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-hub-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Image size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Image Studio</h1>
            <p className="text-xs text-gray-500">
              {providerInfo?.name} · Генерация изображений по тексту
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Controls */}
          <div className="space-y-4">
            {/* Prompt */}
            <div className="bg-hub-card border border-hub-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Промпт</label>
                <button
                  onClick={handleCopyPrompt}
                  className="text-gray-500 hover:text-white transition-colors"
                  title="Копировать"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишите изображение... Например: Кот-астронавт на Марсе смотрит на закат"
                rows={5}
                className="w-full bg-hub-surface border border-hub-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-hub-accent resize-none"
              />

              {/* Templates toggle */}
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <BookOpen size={12} />
                Шаблоны промптов
                {showTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showTemplates && (
                <div className="grid grid-cols-2 gap-1.5 animate-in fade-in">
                  {PROMPT_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setPrompt((prev) => (prev ? `${prev}, ${t.prompt}` : t.prompt))}
                      className="text-left text-xs px-2.5 py-2 rounded-lg bg-hub-surface hover:bg-hub-accent/10 text-gray-400 hover:text-white transition-colors border border-hub-border"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="bg-hub-card border border-hub-border rounded-xl p-4">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                Соотношение сторон
              </label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.value}
                    onClick={() => setRatio(ar.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      ratio === ar.value
                        ? 'bg-hub-accent/15 text-hub-accent-light ring-1 ring-hub-accent/30'
                        : 'bg-hub-surface text-gray-400 hover:text-white border border-hub-border'
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || state === 'generating'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-hub-accent text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === 'generating' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Генерирую...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Сгенерировать
                </>
              )}
            </button>
          </div>

          {/* Right — Result */}
          <div className="space-y-4">
            <div className="bg-hub-card border border-hub-border rounded-xl overflow-hidden aspect-square flex items-center justify-center">
              {state === 'idle' && !imageUrl && (
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-hub-surface flex items-center justify-center">
                    <Image size={32} className="text-gray-700" />
                  </div>
                  <p className="text-gray-500 text-sm">Введите промпт и нажмите «Сгенерировать»</p>
                </div>
              )}

              {state === 'generating' && (
                <div className="text-center p-8">
                  <Loader2 size={40} className="text-hub-accent animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Генерация изображения...</p>
                </div>
              )}

              {state === 'error' && (
                <div className="text-center p-8">
                  <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 text-sm max-w-xs mx-auto">{error}</p>
                  <button
                    onClick={() => setState('idle')}
                    className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-hub-surface border border-hub-border text-gray-400 hover:text-white transition-colors"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}

              {imageUrl && state === 'complete' && (
                <img src={imageUrl} alt={prompt} className="w-full h-full object-cover" />
              )}
            </div>

            {imageUrl && state === 'complete' && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-hub-surface border border-hub-border text-gray-300 hover:text-white hover:bg-hub-card transition-colors"
              >
                <Download size={16} /> Скачать изображение
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
