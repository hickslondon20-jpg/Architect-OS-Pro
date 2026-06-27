import React from 'react';
import { X } from 'lucide-react';
import { Capability } from './types';

interface CapabilityColumnCardProps {
    capability: Capability;
    onRemove: (id: string) => void;
    onClick: (id: string) => void;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent, capId: string) => void;
    onDragEnd?: () => void;
}

export const CapabilityColumnCard: React.FC<CapabilityColumnCardProps> = ({ capability, onRemove, onClick, isDragging, onDragStart, onDragEnd }) => {

    const getDimensionColor = (dim: string) => {
        const colors: Record<string, string> = {
            'Financial Health': 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]',
            'Client Portfolio': 'bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] border-[var(--aos-brass)]',
            'Operations': 'bg-[var(--bg-sunken)] text-[var(--fg-2)] border-[var(--aos-mist)]',
            'Team Structure': 'bg-[var(--aos-sage-soft)] text-[var(--aos-deep-teal)] border-[var(--aos-sage)]',
            'Strategic Stewardship': 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]',
        };
        return colors[dim] || 'bg-[var(--bg-sunken)] text-[var(--fg-2)] border-[var(--aos-mist)]';
    };

    return (
        <div
            draggable
            onDragStart={e => onDragStart?.(e, capability.id)}
            onDragEnd={onDragEnd}
            className="p-3 rounded-lg group animate-in zoom-in-95 duration-200 cursor-grab transition-colors hover:border-[var(--aos-brass)]"
            style={{
                background: 'var(--aos-brass-tint)',
                border: '1px solid var(--aos-brass)',
                boxShadow: 'var(--shadow-soft-1)',
                opacity: isDragging ? 0.4 : 1,
                transition: 'opacity 0.15s',
            }}
            onClick={() => onClick(capability.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getDimensionColor(capability.dimension)}`}>
                    {capability.dimension}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(capability.id);
                    }}
                    className="text-[var(--fg-3)] hover:text-[var(--aos-risk)] opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 -mt-1 rounded hover:bg-[var(--aos-risk-tint)]"
                    title="Remove"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="font-bold text-sm text-[var(--fg-1)] mb-2 leading-tight">
                {capability.name}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-[var(--bg-sunken)] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[var(--aos-brass)] h-full" style={{ width: `${capability.maturity}%` }} />
                </div>
                <span className="text-xs text-[var(--fg-3)] font-mono">{Math.round(capability.maturity)}%</span>
            </div>
        </div>
    );
};
