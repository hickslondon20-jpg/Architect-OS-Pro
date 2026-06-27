import React from 'react';
import { Card } from '../../ui';
import { Plus } from 'lucide-react';
import { IncompleteIndicator } from './IncompleteIndicator';

export interface CapabilityCardProps {
    id: string; // Added ID for uniqueness
    name: string;
    score: number;
    stageFit: 'Below Stage' | 'At Stage' | 'Ahead of Stage';
    initiativeCount?: number; // Added to track child initiatives
    tier: 'prioritize' | 'plant' | 'iterate'; // Context for constraints
    isIncomplete?: boolean; // Added for Step 9
    onAddInitiative: (e: React.MouseEvent) => void;
    onClick?: () => void;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
    id,
    name,
    score,
    stageFit,
    initiativeCount = 0,
    tier,
    isIncomplete = false,
    onAddInitiative,
    onClick
}) => {

    const getStageColor = (fit: string) => {
        switch (fit) {
            case 'Below Stage': return 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)] text-[10px]';
            case 'At Stage': return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)] text-[10px]';
            case 'Ahead of Stage': return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)] text-[10px]';
            default: return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)] text-[10px]';
        }
    };

    return (
        <div className="group cursor-pointer flex flex-col h-full" onClick={onClick}>
            <Card className={`flex flex-1 flex-col bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] transition-all hover:bg-[var(--bg-canvas)] hover:shadow-md ${isIncomplete ? 'border-2 border-[var(--aos-warning)]' : 'border-[var(--aos-mist)] hover:border-[var(--aos-brass)]'}`}>
                {/* Header Area */}
                <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="line-clamp-2 break-words text-sm font-bold leading-snug text-[var(--fg-1)]">
                            {name}
                        </div>
                        {isIncomplete && <IncompleteIndicator />}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        <span className={`px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider ${getStageColor(stageFit)}`}>
                            {stageFit}
                        </span>

                        {/* Initiative Count Badge (Optional visual indicator) */}
                        {initiativeCount > 0 && (
                            <span className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-2 py-0.5 text-xs font-semibold text-[var(--fg-3)]">
                                {initiativeCount} {initiativeCount === 1 ? 'Initiative' : 'Initiatives'}
                            </span>
                        )}
                        {initiativeCount === 0 && !isIncomplete && (
                            <span className="rounded border border-[var(--aos-warning)] bg-[var(--aos-warning-tint)] px-2 py-0.5 text-xs font-semibold text-[var(--aos-warning)]">
                                Unplanned
                            </span>
                        )}
                    </div>
                </div>
            </Card>

            {/* Action Link outside card - Always present per PRD update */}
            <button
                onClick={(e) => { e.stopPropagation(); onAddInitiative(e); }}
                className="mt-3 flex w-full items-center justify-center rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-mist)] py-2 text-sm font-medium text-[var(--fg-3)] transition-all hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)] group-hover:bg-[var(--bg-canvas)]"
            >
                <Plus className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                Add Initiative
            </button>
        </div>
    );
};
