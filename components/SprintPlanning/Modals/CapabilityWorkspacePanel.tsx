import React from 'react';
import { Plus, Target } from 'lucide-react';
import { UnifiedModalContainer } from './UnifiedModalContainer';
import { BreadcrumbNav } from './BreadcrumbNav';
import { InlineQuickAdd } from './InlineQuickAdd';
import { InlineExpandRow, ExpandRowData } from './InlineExpandRow';
import { AdvisorContextLevel } from '../Board/StrategicAdvisorPanel';

export interface CapabilityWorkspacePanelProps {
    isOpen: boolean;
    onClose: () => void;
    capability: {
        id: string;
        name: string;
        dimension?: string;
        description?: string;
        score: number;
        stageFit: 'Below Stage' | 'At Stage' | 'Ahead of Stage';
        tier: 'prioritize' | 'plant' | 'iterate';
    } | null;
    initiatives: any[]; // Using any[] for now, matching the InitiativeCard props shape
    onAddInitiative: (capabilityId: string, tier: 'prioritize' | 'plant' | 'iterate', name?: string) => void;
    onInitiativeClick: (initiativeId: string) => void;
    breadcrumbOverride?: React.ReactNode;
    advisorContext?: { level: AdvisorContextLevel; name?: string };
}

export const CapabilityWorkspacePanel: React.FC<CapabilityWorkspacePanelProps> = ({
    isOpen,
    onClose,
    capability,
    initiatives,
    onAddInitiative,
    onInitiativeClick,
    breadcrumbOverride,
    advisorContext
}) => {
    if (!isOpen || !capability) return null;

    const getStageColor = (fit: string) => {
        switch (fit) {
            case 'Below Stage': return 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]';
            case 'At Stage': return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)]';
            case 'Ahead of Stage': return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]';
            default: return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)]';
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'prioritize': return 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]';
            case 'plant': return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]';
            case 'iterate': return 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]';
            default: return 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)]';
        }
    };

    const capabilityInitiatives: ExpandRowData[] = initiatives.map((initiative) => ({
        id: initiative.id,
        title: initiative.name,
        description: initiative.description || 'Define the specific operational gap or opportunity this initiative is meant to close.',
        successDefinition: initiative.successDefinition || 'Describe the tangible business state that should be true when this initiative is complete.',
        sprintGoalConnection: initiative.sprintGoalConnection || 'Tie this initiative back to the sprint goal so the work stays sequenced.',
        constraintsOrRisks: initiative.constraintsOrRisks || '',
        status: initiative.progress > 0 ? 'In Progress' : 'Not Started',
        tier: capability.tier,
        owner: { name: initiative.ownerName || 'Founder' },
        metaText: `${initiative.milestoneCurrent || 0} of ${initiative.milestoneTotal || 0} milestones`,
        isIncomplete: initiative.isIncomplete || !initiative.description || !initiative.successDefinition || !initiative.sprintGoalConnection,
    }));

    const leftContent = (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header / Intro */}
            <div className="mb-8">
                <h2 className="mb-4 text-3xl font-extrabold leading-tight text-[var(--fg-1)]">
                    {capability.name}
                </h2>
                <div className="space-y-4">
                    <div>
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--fg-3)]">Description</h4>
                        <p className="text-sm text-[var(--fg-2)]">
                            {capability.description || 'This capability is one of the selected focus areas being translated into sprint-level initiatives.'}
                        </p>
                    </div>
                    <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--fg-3)]">What Good Looks Like</h4>
                        <div className="bg-[var(--bg-sunken)] rounded-[var(--radius-xs)] p-4 text-sm text-[var(--fg-2)] leading-relaxed border-l-2 border-[var(--aos-brass)]">
                            Define one or more initiatives that make this capability tangible this sprint. Each initiative should be specific enough to own, measure, and break into milestones.
                        </div>
                    </div>
                </div>
            </div>

            {/* Initiatives Section */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <h3 className="shrink-0 text-xs font-bold uppercase tracking-widest text-[var(--fg-3)]">Initiatives</h3>
                    <div className="h-px flex-1 bg-[var(--aos-mist)]"></div>
                </div>

                <div className="space-y-4 flex-1">

                    {/* Populated List using InlineExpandRow */}
                    <div className="space-y-3">
                        {capabilityInitiatives.length > 0 ? (
                            capabilityInitiatives.map((init) => (
                                <InlineExpandRow
                                    key={init.id}
                                    data={init}
                                    onEditFull={(id) => onInitiativeClick(id)}
                                />
                            ))
                        ) : (
                            <div className="rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-mist)] bg-[var(--bg-sunken)] p-6 text-center">
                                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                                    <Target className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-semibold text-[var(--fg-1)]">No initiatives yet</p>
                                <p className="mt-1 text-xs leading-relaxed text-[var(--fg-3)]">
                                    Add the first initiative that turns this capability into concrete sprint work.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3 pt-2">
                        <InlineQuickAdd
                            placeholder="+ Quick Add Initiative"
                            onAdd={(val) => onAddInitiative(capability.id, capability.tier, val)}
                        />

                        <button
                            onClick={(e) => { e.stopPropagation(); onAddInitiative(capability.id, capability.tier); }}
                            className="group flex w-full items-center justify-center rounded-[var(--radius-xs)] border-2 border-dashed border-[var(--aos-mist)] p-3 text-sm font-medium text-[var(--fg-3)] transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]"
                        >
                            <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            Add Initiative
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const rightContent = (
        <div className="flex flex-col h-full animate-in fade-in duration-300 delay-75">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-3)]">Maturity Score</span>
                    <span className="text-2xl font-extrabold text-[var(--fg-1)]">{capability.score}%</span>
                </div>

                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-3)]">Stage</span>
                    <span className={`inline-flex px-2 py-0.5 mt-1 text-xs font-bold rounded ${getStageColor(capability.stageFit)}`}>
                        {capability.stageFit}
                    </span>
                </div>

                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-3)]">3P Classification</span>
                    <span className={`inline-flex px-2 py-0.5 mt-1 text-xs font-bold uppercase tracking-wider rounded ${getTierColor(capability.tier)}`}>
                        {capability.tier}
                    </span>
                </div>

                <div className="group relative cursor-help overflow-hidden rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-3)]">Checkpoint Context</span>
                    <p className="line-clamp-2 text-xs text-[var(--fg-2)]">
                        Directional context about where the gaps live in this capability area.
                    </p>
                </div>
            </div>

            {/* Comments & Activity Section */}
            <div className="mt-4 flex flex-1 flex-col border-t border-[var(--aos-mist)] pt-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--fg-3)]">Comments & Activity</h3>
                <div className="flex flex-1 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--bg-sunken)] p-8">
                    <span className="text-sm italic text-[var(--fg-3)]">No comments yet.</span>
                </div>
            </div>
        </div>
    );

    return (
        <UnifiedModalContainer
            isOpen={isOpen}
            onClose={onClose}
            leftPanelContent={leftContent}
            rightPanelContent={rightContent}
            breadcrumbContent={breadcrumbOverride || <BreadcrumbNav />}
            advisorContext={advisorContext}
        />
    );
};
