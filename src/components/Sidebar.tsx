import React, { useState } from 'react';
import {
  MessageSquare,
  Swords,
  FileText,
  Code,
  PenTool,
  Shield,
  Image,
  Settings,
  ChevronLeft,
  ChevronRight,
  Eclipse,
} from 'lucide-react';
import { ModuleId } from '../types';

type Page = ModuleId | 'settings';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',          label: 'Чат',          icon: MessageSquare },
  { id: 'arena',         label: 'Арена',        icon: Swords },
  { id: 'rag',           label: 'RAG',          icon: FileText },
  { id: 'code-review',   label: 'Code Review',  icon: Code },
  { id: 'copywriter',    label: 'Копирайтер',   icon: PenTool },
  { id: 'security-scan', label: 'Сканер',       icon: Shield },
  { id: 'image-studio', label: 'Image Studio', icon: Image },
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
        flex flex-col h-screen bg-hub-surface border-r border-hub-border
        transition-all duration-200 ease-in-out shrink-0
        ${expanded ? 'w-64' : 'w-16'}
      `}
    >
      {/* Logo / Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-hub-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-hub-accent/20 flex items-center justify-center shrink-0">
          <Eclipse size={18} className="text-hub-accent" />
        </div>
        {expanded && (
          <span className="text-sm font-bold text-white whitespace-nowrap overflow-hidden">
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
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
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
                  ? 'bg-hub-accent/15 text-hub-accent-light'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
              title={!expanded ? item.label : undefined}
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
      <div className="border-t border-hub-border px-2 py-3 shrink-0">
        <button
          onClick={() => onNavigate('settings')}
          className={`
            w-full flex items-center gap-3 rounded-lg transition-all text-sm
            ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
            ${current === 'settings'
              ? 'bg-hub-accent/15 text-hub-accent-light'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
          title={!expanded ? 'Настройки' : undefined}
        >
          <Settings size={20} className="shrink-0" />
          {expanded && <span>Настройки</span>}
        </button>
      </div>
    </aside>
  );
};
