import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  IconChat,
  IconArena,
  IconRAG,
  IconCodeReview,
  IconCopywriter,
  IconSecurity,
  IconImageStudio,
  IconSettings,
  IconEclipseLogo,
} from './icons/EclipseIcons';
import { ModuleId } from '../types';

type Page = ModuleId | 'settings';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',          label: 'Чат',          icon: IconChat },
  { id: 'arena',         label: 'Арена',        icon: IconArena },
  { id: 'rag',           label: 'RAG',          icon: IconRAG },
  { id: 'code-review',   label: 'Code Review',  icon: IconCodeReview },
  { id: 'copywriter',    label: 'Копирайтер',   icon: IconCopywriter },
  { id: 'security-scan', label: 'Сканер',       icon: IconSecurity },
  { id: 'image-studio', label: 'Image Studio', icon: IconImageStudio },
];

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ current, onNavigate }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={`
        eclipse-sidebar eclipse-sidebar-noise
        flex flex-col h-screen border-r border-hub-border
        transition-all duration-200 ease-in-out shrink-0
        ${expanded ? 'w-64' : 'w-16'}
      `}
    >
      {/* Logo / Header */}
      <div className="relative z-10 flex items-center gap-3 px-4 h-16 border-b border-hub-border shrink-0">
        <div className="eclipse-icon-glow w-8 h-8 rounded-lg bg-hub-accent/20 flex items-center justify-center shrink-0">
          <IconEclipseLogo size={18} className="relative z-10 text-hub-accent" />
        </div>
        {expanded && (
          <span className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-glow">
            Eclipse AI Hub
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
          title={expanded ? 'Свернуть' : 'Развернуть'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = current === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 rounded-lg transition-all text-sm
                ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                ${isActive
                  ? `bg-hub-accent/15 text-hub-accent-light ${expanded ? 'eclipse-active-indicator' : ''}`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
                ${!expanded ? 'eclipse-tooltip' : ''}
              `}
              data-tooltip={!expanded ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {expanded && <span className="truncate">{item.label}</span>}
              {isActive && !expanded && (
                <span className="absolute left-0 w-0.5 h-6 bg-hub-accent rounded-r" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings (bottom) */}
      <div className="relative z-10 border-t border-hub-border px-2 py-3 shrink-0">
        <button
          onClick={() => onNavigate('settings')}
          className={`
            w-full flex items-center gap-3 rounded-lg transition-all text-sm
            ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
            ${current === 'settings'
              ? `bg-hub-accent/15 text-hub-accent-light ${expanded ? 'eclipse-active-indicator' : ''}`
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
            ${!expanded ? 'eclipse-tooltip' : ''}
          `}
          data-tooltip={!expanded ? 'Настройки' : undefined}
        >
          <IconSettings size={20} className="shrink-0" />
          {expanded && <span>Настройки</span>}
        </button>
      </div>
    </aside>
  );
};
