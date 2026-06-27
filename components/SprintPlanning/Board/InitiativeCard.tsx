import React from 'react';
import { Card } from '../../ui';
import { MilestoneList, Milestone } from './MilestoneList';
import { X, Eye, EyeOff } from 'lucide-react';
import { IncompleteIndicator } from './IncompleteIndicator';

export interface InitiativeCardProps {
    id: string;
    capabilityId?: string;
    name: string;
    description?: string;
    successDefinition?: string;
    sprintGoalConnection?: string;
    constraintsOrRisks?: string;
    progress: number;
    ownerName: string;
    ownerInitials: string;
    milestoneCurrent: number;
    milestoneTotal: number;
    capabilityName: string;
    isExpanded?: boolean;
    isHidden?: boolean;
    isIncomplete?: boolean;
    onExpand: () => void;
    onCollapse?: () => void;
    onViewDetails?: () => void;
    onTagClick: (e: React.MouseEvent) => void;
    onToggleHidden?: (e: React.MouseEvent) => void;
    milestones?: Milestone[];
    onAddMilestone?: () => void;
}

export const InitiativeCard: React.FC<InitiativeCardProps> = ({
    name,
    progress,
    ownerName,
    ownerInitials,
    milestoneCurrent,
    milestoneTotal,
    capabilityName,
    isExpanded = false,
    onExpand,
    onCollapse,
    onViewDetails,
    onTagClick,
    onToggleHidden,
    isHidden = false,
    isIncomplete = false,
    milestones = [],
    onAddMilestone
}) => {

    const renderEye = () => (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleHidden?.(e); }}
            className={`rounded p-1 transition-colors ${isHidden ? 'bg-[var(--bg-canvas)] text-[var(--fg-4)]' : 'text-[var(--fg-4)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-2)]'}`}
            title={isHidden ? 'Show in Progress' : 'Hide from Progress'}
            aria-label={isHidden ? 'Show in progress' : 'Hide from progress'}
        >
            {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
    );

    if (isExpanded) {
        return (
            <Card className={`group relative overflow-hidden bg-[var(--bg-surface)] shadow-md transition-all duration-200 ${isIncomplete ? 'border-2 border-[var(--aos-warning)]' : 'border-[var(--aos-brass)] ring-1 ring-[var(--aos-brass-tint)]'}`}>
                <div className={`flex items-start justify-between border-b p-4 ${isIncomplete ? 'border-[var(--aos-warning)] bg-[var(--aos-warning-tint)]' : 'border-[var(--aos-mist)] bg-[var(--bg-canvas)]'}`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <h4 className="text-base font-bold leading-snug text-[var(--fg-1)]">{name}</h4>
                            {isIncomplete && <IncompleteIndicator />}
                        </div>
                        <div className="mt-1 text-xs text-[var(--fg-3)]">Related: 1.1.2 Visibility Across Core Drivers</div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCollapse?.(); }}
                        className="rounded-full p-1 transition-colors hover:bg-[var(--bg-sunken)]"
                        aria-label="Collapse initiative"
                    >
                        <X className="h-4 w-4 text-[var(--fg-3)]" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-canvas)]">
                            <div className="h-full rounded-full bg-[var(--aos-brass)]" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-[var(--fg-2)]">{progress}%</span>
                    </div>

                    <MilestoneList milestones={milestones} onAddMilestone={onAddMilestone} />

                    <div className="mt-6 flex items-center gap-3 border-t border-[var(--aos-mist)] pt-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
                            className="text-xs font-medium text-[var(--aos-brass)] hover:underline"
                        >
                            View Details
                        </button>
                        <button className="ml-auto text-xs font-medium text-[var(--fg-4)] hover:text-[var(--fg-2)]">Move to Plant</button>
                        {renderEye()}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card
            onClick={onExpand}
            className={`group relative cursor-pointer bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] transition-all hover:bg-[var(--bg-canvas)] hover:shadow-md ${isIncomplete ? 'border-2 border-[var(--aos-warning)]' : 'border-[var(--aos-mist)] hover:border-[var(--aos-brass)]'}`}
        >
            <div className={`space-y-4 p-4 ${isIncomplete ? 'bg-[var(--aos-warning-tint)]/40' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <h4 className={`break-words text-sm font-bold leading-snug transition-colors ${isHidden ? 'text-[var(--fg-4)] line-through' : 'text-[var(--fg-1)] group-hover:text-[var(--aos-brass)]'}`}>{name}</h4>
                        {isIncomplete && <div className="mt-2"><IncompleteIndicator /></div>}
                    </div>
                    {renderEye()}
                </div>

                <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-canvas)]">
                        <div
                            className="h-full rounded-full bg-[var(--aos-brass)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="text-right text-xs font-medium text-[var(--fg-3)]">
                        {progress}%
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--aos-mist)] bg-[var(--bg-canvas)] text-[10px] font-bold text-[var(--fg-2)]">
                            {ownerInitials}
                        </div>
                        <span className="text-xs text-[var(--fg-2)]">{ownerName}</span>
                    </div>
                    <div className="text-xs text-[var(--fg-3)]">
                        {milestoneCurrent} of {milestoneTotal} milestones
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onTagClick(e); }}
                        className="relative z-10 inline-flex items-center rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-2 py-1 text-xs font-medium text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]"
                    >
                        {capabilityName}
                    </button>
                </div>
            </div>
        </Card>
    );
};
