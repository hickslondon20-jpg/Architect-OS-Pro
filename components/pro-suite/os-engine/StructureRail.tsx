import React from 'react';
import { Home, Upload, BookOpen, List, ClipboardList, ScrollText } from 'lucide-react';

export type OSEngineSection = 'welcome' | 'uploads' | 'wiki' | 'index' | 'manifest' | 'log';

interface RailItem {
  id: OSEngineSection;
  label: string;
  icon: React.ElementType;
  hint: string;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'welcome', label: 'Welcome', icon: Home, hint: 'Home & first-run import' },
  { id: 'uploads', label: 'Uploads', icon: Upload, hint: 'Raw files you have added' },
  { id: 'wiki', label: 'Wiki', icon: BookOpen, hint: 'What the system understands' },
  { id: 'index', label: 'Index', icon: List, hint: 'Map of the wiki' },
  { id: 'manifest', label: 'Manifest', icon: ClipboardList, hint: 'What has been ingested' },
  { id: 'log', label: 'Log', icon: ScrollText, hint: 'Activity & decisions' },
];

export const StructureRail: React.FC<{
  active: OSEngineSection;
  onSelect: (section: OSEngineSection) => void;
}> = ({ active, onSelect }) => (
  <nav
    className="flex w-[200px] flex-shrink-0 flex-col gap-0.5 border-r border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-3"
    aria-label="OS Engine sections"
  >
    <p className="aos-eyebrow px-2 pb-2 pt-1">OS Engine</p>
    {RAIL_ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = active === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          title={item.hint}
          className={`
            flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors
            ${isActive
              ? 'border-l-[3px] border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] pl-[7px] font-medium text-[var(--fg-1)]'
              : 'text-[var(--fg-2)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]'}
          `}
        >
          <Icon size={16} className={isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'} />
          <span>{item.label}</span>
        </button>
      );
    })}
  </nav>
);
