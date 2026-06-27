import React, { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, CircleDashed, Activity, Ban, AlertCircle, Edit2 } from 'lucide-react';
import { IncompleteIndicator } from '../Board/IncompleteIndicator';
import { AutoSaveField } from './AutoSaveField';

export interface ExpandRowData {
    id: string;
    title: string;
    description: string; // What We Are Addressing
    successDefinition: string; // What Success Looks Like
    sprintGoalConnection: string;
    constraintsOrRisks: string;
    status?: string;
    tier?: string;
    owner?: { name: string; avatarUrl?: string };
    metaText?: string; // e.g., "3 of 5 milestones"
    isIncomplete?: boolean;
}

interface InlineExpandRowProps {
    data: ExpandRowData;
    onEditFull: (id: string) => void;
    // For pass 1 skeleton, we simply accept data. In reality, we'd add onSave callbacks.
}

export const InlineExpandRow: React.FC<InlineExpandRowProps> = ({
    data,
    onEditFull
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Hardcoded status icon logic matching existing patterns
    const StatusIcon = ({ status }: { status?: string }) => {
        switch (status) {
            case 'In Progress': return <Activity className="h-4 w-4 text-[var(--aos-insight)]" />;
            case 'Blocked': return <Ban className="h-4 w-4 text-[var(--aos-risk)]" />;
            case 'At Risk': return <AlertCircle className="h-4 w-4 text-[var(--aos-warning)]" />;
            case 'Complete': return <CheckCircle2 className="h-4 w-4 text-[var(--aos-success)]" />;
            default: return <CircleDashed className="h-4 w-4 text-[var(--fg-3)]" />;
        }
    };

    const getTierColor = (tier?: string) => {
        switch (tier) {
            case 'prioritize': return 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]';
            case 'plant': return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]';
            case 'iterate': return 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]';
            default: return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)]';
        }
    };

    return (
        <div className="overflow-hidden rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--bg-canvas)]">
            {/* Collapsed Header / Trigger */}
            <div
                className={`flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-[var(--bg-canvas)] ${isExpanded ? 'border-b border-[var(--aos-mist)] bg-[var(--bg-canvas)]' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* 1. Status Indicator (Left) */}
                <div className="pt-0.5 shrink-0">
                    <StatusIcon status={data.status} />
                </div>

                <div className="flex-1 min-w-0">
                    {/* 2. Top Row: 3P Tag, Owner, Milestone Count, Incomplete */}
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        {data.tier && (
                            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded opacity-80 ${getTierColor(data.tier)}`}>
                                {data.tier}
                            </span>
                        )}
                        {data.owner && (
                            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-[var(--aos-mist)] bg-[var(--bg-canvas)]" title={data.owner.name}>
                                {data.owner.avatarUrl ? (
                                    <img src={data.owner.avatarUrl} alt={data.owner.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-canvas)] text-[10px] font-bold text-[var(--fg-2)]">
                                        {data.owner.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                        )}
                        {data.metaText && (
                            <span className="ml-1 text-xs font-medium text-[var(--fg-3)]">
                                {data.metaText}
                            </span>
                        )}
                        {data.isIncomplete && (
                            // Muted styling per global feedback rule 2 (amber dot or soft badge)
                            <div className="flex items-center ml-2">
                                <div className="h-2 w-2 rounded-full bg-[var(--aos-warning)]" title="Missing Details"></div>
                            </div>
                        )}
                    </div>

                    {/* 3. Name (Bold, full text) */}
                    <div className="pr-2 text-base font-bold text-[var(--fg-1)] transition-colors">
                        {data.title}
                    </div>
                </div>

                {/* 4. Actions (Pencil, Chevron) */}
                <div className="flex shrink-0 items-center gap-1 pt-1 text-[var(--fg-3)]">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                        className="rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]"
                        title="Edit Inline"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <div className="flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]">
                        {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                        ) : (
                            <ChevronRight className="w-5 h-5" />
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Content Area */}
            {isExpanded && (
                <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-6 max-w-3xl">

                        <AutoSaveField
                            id={`inline-name-${data.id}`}
                            label="Initiative Name"
                            supportingLabel="A completely formed sentence describing the specific goal of this initiative."
                            value={data.title}
                            type="text"
                            onSave={async (val) => { console.log('Auto-saved Name:', val); }}
                        />

                        <AutoSaveField
                            id={`inline-desc-${data.id}`}
                            label="What We Are Addressing"
                            supportingLabel="What is the problem or opportunity? Why is this important right now?"
                            value={data.description}
                            type="textarea"
                            rows={3}
                            onSave={async (val) => { console.log('Auto-saved Description:', val); }}
                        />

                        <AutoSaveField
                            id={`inline-success-${data.id}`}
                            label="What Success Looks Like"
                            supportingLabel="How will we know this initiative is fully complete? What is the tangible deliverable?"
                            value={data.successDefinition}
                            type="textarea"
                            rows={3}
                            onSave={async (val) => { console.log('Auto-saved Success Definition:', val); }}
                        />

                        <div className="space-y-3">
                            <AutoSaveField
                                id={`inline-sprint-goal-${data.id}`}
                                label="Sprint Goal Connection"
                                supportingLabel="How does this initiative objectively contribute to the overall sprint goal? What is the through-line?"
                                value={data.sprintGoalConnection}
                                type="textarea"
                                rows={2}
                                onSave={async (val) => { console.log('Auto-saved Sprint Goal Connection:', val); }}
                            />
                            {/* Read-only reference block */}
                            <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 text-center">
                                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--fg-3)]">Current Sprint Goal</p>
                                <p className="text-sm italic text-[var(--fg-2)]">
                                    "Finalize ICP v2 messaging and validate with 5 friendlies to ensure we are attracting the right fit."
                                </p>
                            </div>
                        </div>

                        <AutoSaveField
                            id={`inline-constraints-${data.id}`}
                            label="Known Constraints or Risks"
                            supportingLabel="What might block this? Are we waiting on an external dependency? (Leave blank if none)"
                            value={data.constraintsOrRisks}
                            type="textarea"
                            rows={2}
                            optional={true}
                            onSave={async (val) => { console.log('Auto-saved Constraints:', val); }}
                        />

                        <div className="flex justify-end border-t border-[var(--aos-mist)] pt-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); onEditFull(data.id); }}
                                className="group flex items-center gap-1 text-sm font-semibold text-[var(--aos-brass)] transition-colors hover:underline"
                            >
                                Open Full Detail View <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
