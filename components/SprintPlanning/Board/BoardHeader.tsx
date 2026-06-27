import React from 'react';
import { Target, Settings } from 'lucide-react';

export interface BoardHeaderProps {
    onOpenSettings?: () => void;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({ onOpenSettings }) => {

    return (
        <div className="flex flex-col gap-4 bg-transparent py-2">

            {/* Top row: Title */}
            <div className="flex justify-between items-start sm:items-center">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--fg-1)]">Sprint Board</h1>
                    <span className="mt-1 text-sm font-medium uppercase tracking-wider text-[var(--fg-3)]">Q1 2026</span>
                </div>

                {onOpenSettings && (
                    <button
                        onClick={onOpenSettings}
                        className="flex items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-2 text-[var(--fg-3)] shadow-[var(--shadow-soft-1)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] sm:px-3 sm:py-2"
                        title="Team Settings"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm font-medium">Team Settings</span>
                    </button>
                )}
            </div>

            {/* Bottom Row: Locked Sprint Goal (Sticky Header Simulation) */}
            <div className="mt-2 flex w-full flex-col items-start gap-4 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] md:flex-row md:items-center">
                <div className="flex shrink-0 items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--aos-brass)]">
                    <Target className="w-4 h-4" />
                    Sprint Goal
                </div>
                <div className="flex-1 border-l-2 border-[var(--aos-mist)] py-1 pl-4 text-lg font-medium italic leading-snug text-[var(--fg-2)]">
                    "We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention."
                </div>
            </div>

        </div>
    );
};
