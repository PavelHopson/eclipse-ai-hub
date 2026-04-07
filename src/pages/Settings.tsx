import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Check, Eye, EyeOff } from 'lucide-react';
import { AIProvider, AIConfig, PROVIDERS } from '../types';
import { ProviderBadge } from '../components/ProviderBadge';

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'ollama',
    apiKey: '',
    model: PROVIDERS.ollama.models[0],
    baseUrl: 'http://localhost:11434',
  });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const providerInfo = PROVIDERS[config.provider];

  const handleProviderChange = (provider: AIProvider) => {
    setConfig({
      provider,
      apiKey: '',
      model: PROVIDERS[provider].models[0],
      baseUrl: provider === 'ollama' ? 'http://localhost:11434' : undefined,
    });
    setSaved(false);
  };

  const handleSave = () => {
    // TODO: persist to localStorage or backend
    localStorage.setItem('eclipse-ai-config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <SettingsIcon size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Настройки</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Provider selector */}
          <section>
            <h2 className="text-sm font-medium text-gray-300 mb-3">AI-провайдер</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDERS) as AIProvider[]).map((pid) => (
                <button
                  key={pid}
                  onClick={() => handleProviderChange(pid)}
                  className={`hub-card p-3 text-left transition-all ${
                    config.provider === pid
                      ? 'border-hub-accent ring-1 ring-hub-accent/30'
                      : 'hover:border-hub-accent/30'
                  }`}
                >
                  <ProviderBadge provider={pid} className="mb-2" />
                  <p className="text-xs text-gray-500">{PROVIDERS[pid].name}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Model selector */}
          <section>
            <h2 className="text-sm font-medium text-gray-300 mb-3">Модель</h2>
            <select
              value={config.model}
              onChange={(e) => {
                setConfig({ ...config, model: e.target.value });
                setSaved(false);
              }}
              className="hub-input"
            >
              {providerInfo.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </section>

          {/* API Key */}
          {providerInfo.needsKey && (
            <section>
              <h2 className="text-sm font-medium text-gray-300 mb-3">API-ключ</h2>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => {
                    setConfig({ ...config, apiKey: e.target.value });
                    setSaved(false);
                  }}
                  placeholder={providerInfo.placeholder}
                  className="hub-input pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </section>
          )}

          {/* Base URL (Ollama) */}
          {config.provider === 'ollama' && (
            <section>
              <h2 className="text-sm font-medium text-gray-300 mb-3">Base URL</h2>
              <input
                value={config.baseUrl || ''}
                onChange={(e) => {
                  setConfig({ ...config, baseUrl: e.target.value });
                  setSaved(false);
                }}
                placeholder="http://localhost:11434"
                className="hub-input"
              />
            </section>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            className="hub-btn flex items-center gap-2"
          >
            {saved ? <><Check size={16} /> Сохранено</> : <><Save size={16} /> Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
};
