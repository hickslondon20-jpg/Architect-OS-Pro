import React from 'react';
import { Circle, CheckCircle2, CircleDashed } from 'lucide-react';

export interface Milestone {
    id: string;
    name: string;
    status: 'not_started' | 'in_progress' | 'complete';
    owner: string;
    timeline: string;
    outcome: string;
}

interface MilestoneListProps {
    milestones: Milestone[];
    onAddMilestone?: () => void;
}

export const MilestoneList: React.FC<MilestoneListProps> = ({ milestones, onAddMilestone }) => {
    const getStatusIcon = (status: Milestone['status']) => {
        switch (status) {
            case 'complete': return <CheckCircle2 className="h-4 w-4 text-[var(--aos-success)]" />;
            case 'in_progress': return <CircleDashed className="h-4 w-4 text-[var(--aos-insight)] animate-spin-slow" />;
            case 'not_started': return <Circle className="h-4 w-4 text-[var(--fg-4)]" />;
            default: return <Circle className="h-4 w-4 text-[var(--fg-4)]" />;
        }
    };

    return (
        <div className="mt-4 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-3)]">Milestones</h5>
            <div className="space-y-2">
                {milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-start gap-3 rounded-[var(--radius-xs)] p-2 transition-colors hover:bg-[var(--bg-canvas)]">
                        <div className="mt-0.5">{getStatusIcon(milestone.status)}</div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-[var(--fg-1)]">{milestone.name}</div>
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-xs text-[var(--fg-3)]">{milestone.owner} - {milestone.timeline}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onAddMilestone?.(); }}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--aos-brass)] hover:underline"
                >
                    + Add Milestone
                </button>
            </div>
        </div>
    );
};
