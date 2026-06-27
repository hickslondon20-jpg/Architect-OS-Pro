import React, { useEffect, useState } from 'react';
import { BoardHeader } from '../../components/SprintPlanning/Board/BoardHeader';
import { ColumnBoard } from '../../components/SprintPlanning/Board/ColumnBoard';
import { CapabilityCard, CapabilityCardProps } from '../../components/SprintPlanning/Board/CapabilityCard';
import { InitiativeCard, InitiativeCardProps } from '../../components/SprintPlanning/Board/InitiativeCard';
import { Milestone } from '../../components/SprintPlanning/Board/MilestoneList';
import { ReferenceStrip } from '../../components/pro-suite/quarter-map/ReferenceStrip';
import { CapabilityTagDrawer } from '../../components/SprintPlanning/Modals/CapabilityTagDrawer';
import { WorkspaceModalManager } from '../../components/SprintPlanning/Modals/WorkspaceModalManager';
import { StrategicAdvisorPanel } from '../../components/SprintPlanning/Board/StrategicAdvisorPanel';
import { InitiativeEntryForm } from '../../components/SprintPlanning/Modals/InitiativeEntryForm';
import { MilestoneEntryForm } from '../../components/SprintPlanning/Modals/MilestoneEntryForm';
import { TeamMembersModal } from '../../components/SprintPlanning/Modals/TeamMembersModal';
import { Plus, Sparkles, EyeOff, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { BucketType } from '../../components/pro-suite/quarter-map/types';



// MOCK DATA - Quarter Map Setup (Replace with actual fetch later)
const MOCK_REFERENCE_CONTEXT = {
    twelveMonthTheme: "Establish operational foundation and validate core positioning before scaling outbound engine.",
    focusAreas: [
        "Delivery Workflow (Stabilize)",
        "Pipeline Health (Elevate)",
        "Positioning Clarity (Iterate)"
    ]
};

type Tier = 'prioritize' | 'plant' | 'iterate';
type BoardCapability = Omit<CapabilityCardProps, 'onAddInitiative'> & {
    dimension?: string;
    description?: string;
};

const bucketToTier = (bucket: BucketType): Tier | 'parking' => {
    if (bucket === 'PRIORITIZE') return 'prioritize';
    if (bucket === 'PLANT') return 'plant';
    if (bucket === 'ITERATE') return 'iterate';
    return 'parking';
};

const normalizeStageFit = (fit?: string): 'Below Stage' | 'At Stage' | 'Ahead of Stage' => {
    if (fit === 'Below Stage' || fit === 'At Stage' || fit === 'Ahead of Stage') return fit;
    return 'At Stage';
};
// MOCK DATA - Capabilities
const CAPABILITIES_PRIORITIZE: Omit<CapabilityCardProps, 'onAddInitiative' | 'tier'>[] = [
    { id: '1', name: 'Cash Flow Forecasting', score: 62, stageFit: 'Below Stage', initiativeCount: 1, isIncomplete: true },
    { id: '2', name: 'Pipeline Health', score: 48, stageFit: 'Below Stage', initiativeCount: 2 },
    { id: '3', name: 'Delivery Workflow', score: 71, stageFit: 'At Stage', initiativeCount: 0 },
];

const CAPABILITIES_PLANT: Omit<CapabilityCardProps, 'onAddInitiative' | 'tier'>[] = [
    { id: '4', name: 'Leadership Definition', score: 34, stageFit: 'Below Stage', initiativeCount: 1 },
    { id: '5', name: 'Automation Framework', score: 29, stageFit: 'Below Stage', initiativeCount: 0 },
    { id: '6', name: 'Market Positioning', score: 58, stageFit: 'At Stage', initiativeCount: 0 },
];

const CAPABILITIES_ITERATE: Omit<CapabilityCardProps, 'onAddInitiative' | 'tier'>[] = [
    { id: '7', name: 'Positioning Clarity', score: 82, stageFit: 'Ahead of Stage', initiativeCount: 1 },
    { id: '8', name: 'Retention Maturity', score: 76, stageFit: 'At Stage', initiativeCount: 0 },
    { id: '9', name: 'Financial Resilience', score: 69, stageFit: 'At Stage', initiativeCount: 0 },
];

const CAPABILITIES_PARKING_LOT: Omit<CapabilityCardProps, 'onAddInitiative' | 'tier'>[] = [
    { id: '10', name: 'Scale Paid Acquisition', score: 20, stageFit: 'Below Stage', initiativeCount: 0 },
    { id: '11', name: 'Launch New Vertical', score: 15, stageFit: 'Below Stage', initiativeCount: 0 },
];

// MOCK DATA - Milestones (Generic set for skeleton)
const MOCK_MILESTONES: Milestone[] = [
    { id: 'm1', name: 'Audit current data sources', status: 'complete', owner: 'Sarah', timeline: 'January', outcome: 'Inventory complete' },
    { id: 'm2', name: 'Design dashboard structure', status: 'in_progress', owner: 'Sarah', timeline: 'February', outcome: 'Mockup approved' },
    { id: 'm3', name: 'Build & populate dashboard', status: 'not_started', owner: 'Tech Lead', timeline: 'Feb-Mar', outcome: 'Live dashboard' },
    { id: 'm4', name: 'Train team on dashboard use', status: 'not_started', owner: 'Sarah', timeline: 'March', outcome: 'Team trained' },
];

const MOCK_MILESTONES_HIDDEN: Milestone[] = [
    { id: 'm_h1', name: 'Review current messaging', status: 'complete', owner: 'Founder', timeline: 'January', outcome: ' ' },
    { id: 'm_h2', name: 'Draft new positioning statement', status: 'in_progress', owner: 'Founder', timeline: 'February', outcome: ' ' },
];

// MOCK DATA - Initiatives
const INITIATIVES_PRIORITIZE: Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'>[] = [
    { id: 'i1', capabilityId: '1', name: 'Build Financial Dashboard', progress: 60, ownerName: 'Sarah', ownerInitials: 'S', milestoneCurrent: 3, milestoneTotal: 5, capabilityName: 'Cash Flow Forecasting', milestones: MOCK_MILESTONES },
    { id: 'i2', capabilityId: '2', name: 'Redesign Pipeline Funnel', progress: 25, ownerName: 'Founder', ownerInitials: 'F', milestoneCurrent: 1, milestoneTotal: 4, capabilityName: 'Pipeline Health', milestones: MOCK_MILESTONES, isIncomplete: true },
    { id: 'i3', capabilityId: '3', name: 'Standardize Delivery Process', progress: 40, ownerName: 'Tom', ownerInitials: 'T', milestoneCurrent: 2, milestoneTotal: 3, capabilityName: 'Delivery Workflow', milestones: MOCK_MILESTONES },
];

const INITIATIVES_PLANT: Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'>[] = [
    { id: 'i4', capabilityId: '4', name: 'Define Leadership Roles', progress: 10, ownerName: 'Founder', ownerInitials: 'F', milestoneCurrent: 1, milestoneTotal: 3, capabilityName: 'Leadership Definition', milestones: MOCK_MILESTONES },
];

const INITIATIVES_ITERATE: Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'>[] = [
    { id: 'i5', capabilityId: '7', name: 'Clarify Positioning', progress: 50, ownerName: 'Founder', ownerInitials: 'F', milestoneCurrent: 1, milestoneTotal: 2, capabilityName: 'Positioning Clarity', milestones: MOCK_MILESTONES_HIDDEN },
];

// MOCK DATA - Tag Drawer
const MOCK_TAG_DATA = {
    name: 'Cash Flow Forecasting',
    score: 62,
    stageFit: 'Below Stage',
    checkpoints: [
        { id: '1.1.2', title: 'Visibility Across Core Drivers' },
        { id: '1.1.1', title: 'Data Integrity & Reporting' }
    ]
};

export const SprintBoardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [boardState, setBoardState] = useState<'capability' | 'initiative'>('capability');
    const [expandedInitiativeId, setExpandedInitiativeId] = useState<string | null>(null);
    const [tagDrawerState, setTagDrawerState] = useState<{ isOpen: boolean; x: number; y: number; capName: string } | null>(null);
    const [creationModalState, setCreationModalState] = useState<{ isOpen: boolean; capabilityId?: string; tier?: 'prioritize' | 'plant' | 'iterate' } | null>(null);
    const [milestoneCreationModalState, setMilestoneCreationModalState] = useState<{ isOpen: boolean; initiativeId: string; tier: 'prioritize' | 'plant' | 'iterate' } | null>(null);
    const [detailModalState, setDetailModalState] = useState<{ isOpen: boolean; initiativeId: string; initialFocus?: string } | null>(null);
    const [capabilityWorkspaceState, setCapabilityWorkspaceState] = useState<{ isOpen: boolean; capabilityId?: string } | null>(null);
    const [advisorOpen, setAdvisorOpen] = useState(false);
    const [isTeamMembersModalOpen, setIsTeamMembersModalOpen] = useState(false);

    // PRD 3: Staleness Flag State (Mocked)
    const [isStale, setIsStale] = useState(true);
    const [liveCapabilities, setLiveCapabilities] = useState<{
        prioritize: BoardCapability[];
        plant: BoardCapability[];
        iterate: BoardCapability[];
        parking: BoardCapability[];
    } | null>(null);
    const [isLoadingSelections, setIsLoadingSelections] = useState(false);
    const [boardInitiatives, setBoardInitiatives] = useState<Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'>[]>([
        ...INITIATIVES_PRIORITIZE,
        ...INITIATIVES_PLANT,
        ...INITIATIVES_ITERATE,
    ]);

    // Phase 7: Hidden State
    const [hiddenInitiatives, setHiddenInitiatives] = useState<string[]>(['i5']); // 'i5' is Clarify Positioning (default hidden)

    useEffect(() => {
        const loadSelectedCapabilities = async () => {
            if (!user) return;
            setIsLoadingSelections(true);

            try {
                const { data: selectionData } = await supabase
                    .from('quarter_map_selections')
                    .select('selections')
                    .eq('user_id', user.id)
                    .eq('quarter_name', 'Q1 2026')
                    .maybeSingle();

                const selections = (selectionData?.selections || []) as Array<{ capabilityId: string; bucket: BucketType }>;
                if (selections.length === 0) {
                    setLiveCapabilities(null);
                    return;
                }

                const capabilityIds = selections.map(selection => selection.capabilityId);

                const { data: assessmentData } = await supabase
                    .from('gm_assessments')
                    .select('assessment_id')
                    .eq('respondent_user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const [capabilityResponse, rankingResponse] = await Promise.all([
                    assessmentData
                        ? supabase
                            .from('gm_assessment_capability_scores')
                            .select(`
capability_id,
maturity_pct,
gm_capabilities: capability_id(
  capability_name,
  capability_summary,
  gm_dimensions(dimension_name)
)
                            `)
                            .eq('assessment_id', assessmentData.assessment_id)
                            .in('capability_id', capabilityIds)
                        : Promise.resolve({ data: null }),
                    assessmentData
                        ? supabase
                            .from('gm_capability_rankings')
                            .select('capability_id, stage_fit_variance_flag')
                            .eq('assessment_id', assessmentData.assessment_id)
                            .in('capability_id', capabilityIds)
                        : Promise.resolve({ data: null }),
                ]);

                const rankingByCapability = new Map(
                    (rankingResponse.data || []).map((ranking: any) => [ranking.capability_id, ranking])
                );
                const scoreByCapability = new Map(
                    (capabilityResponse.data || []).map((capability: any) => [capability.capability_id, capability])
                );
                const initiativeCountByCapability = new Map<string, number>();
                boardInitiatives.forEach(initiative => {
                    if (!initiative.capabilityId) return;
                    initiativeCountByCapability.set(
                        initiative.capabilityId,
                        (initiativeCountByCapability.get(initiative.capabilityId) || 0) + 1
                    );
                });

                const nextCapabilities = {
                    prioritize: [] as BoardCapability[],
                    plant: [] as BoardCapability[],
                    iterate: [] as BoardCapability[],
                    parking: [] as BoardCapability[],
                };

                selections.forEach((selection) => {
                    const tier = bucketToTier(selection.bucket);
                    const score = scoreByCapability.get(selection.capabilityId) as any;
                    const capabilityMeta = Array.isArray(score?.gm_capabilities) ? score.gm_capabilities[0] : score?.gm_capabilities;
                    const dimensionMeta = capabilityMeta?.gm_dimensions;
                    const dimensionName = Array.isArray(dimensionMeta) ? dimensionMeta[0]?.dimension_name : dimensionMeta?.dimension_name;
                    const ranking = rankingByCapability.get(selection.capabilityId) as any;

                    const capability: BoardCapability = {
                        id: selection.capabilityId,
                        name: capabilityMeta?.capability_name || selection.capabilityId,
                        description: capabilityMeta?.capability_summary || 'Use this capability area to define the initiative work this sprint should carry.',
                        dimension: dimensionName || 'Capability Area',
                        score: Math.round((score?.maturity_pct ?? 0) * 100),
                        stageFit: normalizeStageFit(ranking?.stage_fit_variance_flag),
                        initiativeCount: initiativeCountByCapability.get(selection.capabilityId) || 0,
                        tier: tier === 'parking' ? 'iterate' : tier,
                    };

                    nextCapabilities[tier].push(capability);
                });

                setLiveCapabilities(nextCapabilities);
            } catch (error) {
                console.error('Error loading Sprint Board 3P selections:', error);
                setLiveCapabilities(null);
            } finally {
                setIsLoadingSelections(false);
            }
        };

        loadSelectedCapabilities();
    }, [user]);

    const handleToggleHidden = (id: string) => {
        setHiddenInitiatives(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const boardCapabilities = liveCapabilities || {
        prioritize: CAPABILITIES_PRIORITIZE.map(capability => ({ ...capability, tier: 'prioritize' as const })),
        plant: CAPABILITIES_PLANT.map(capability => ({ ...capability, tier: 'plant' as const })),
        iterate: CAPABILITIES_ITERATE.map(capability => ({ ...capability, tier: 'iterate' as const })),
        parking: CAPABILITIES_PARKING_LOT.map(capability => ({ ...capability, tier: 'iterate' as const })),
    };

    const allCapabilities = [
        ...boardCapabilities.prioritize,
        ...boardCapabilities.plant,
        ...boardCapabilities.iterate,
        ...boardCapabilities.parking,
    ];

    const initiativesByTier = {
        prioritize: boardInitiatives.filter(initiative => {
            const capability = allCapabilities.find(capability => capability.id === initiative.capabilityId);
            return capability?.tier === 'prioritize' || (!capability && INITIATIVES_PRIORITIZE.some(item => item.id === initiative.id));
        }),
        plant: boardInitiatives.filter(initiative => {
            const capability = allCapabilities.find(capability => capability.id === initiative.capabilityId);
            return capability?.tier === 'plant' || (!capability && INITIATIVES_PLANT.some(item => item.id === initiative.id));
        }),
        iterate: boardInitiatives.filter(initiative => {
            const capability = allCapabilities.find(capability => capability.id === initiative.capabilityId);
            return capability?.tier === 'iterate' || (!capability && INITIATIVES_ITERATE.some(item => item.id === initiative.id));
        }),
    };

    // TRIGGER HANDLERS
    const handleAddInitiativeClick = (capId?: string, tier?: 'prioritize' | 'plant' | 'iterate') => {
        const inheritedCapabilityId = capId || (tier ? boardCapabilities[tier][0]?.id : undefined);
        setCreationModalState({
            isOpen: true,
            capabilityId: inheritedCapabilityId,
            tier
        });
    };

    const handleAddMilestoneClick = (initiativeId: string, tier: 'prioritize' | 'plant' | 'iterate') => {
        setMilestoneCreationModalState({
            isOpen: true,
            initiativeId,
            tier
        });
    };

    const addLocalInitiative = (data: any, fallbackCapabilityId?: string) => {
        if (!data?.name) return;

        const capabilityId = data.capabilityId || fallbackCapabilityId;
        const capabilityName = getCapabilityName(capabilityId) || data.capabilityName || 'Unassigned Capability';
        const newInitiative: Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'> = {
            id: `local-${Date.now()}`,
            capabilityId,
            name: data.name,
            description: data.addressing,
            successDefinition: data.successState,
            sprintGoalConnection: data.sprintConnection,
            constraintsOrRisks: data.constraints,
            progress: 0,
            ownerName: 'Founder',
            ownerInitials: 'F',
            milestoneCurrent: 0,
            milestoneTotal: 0,
            capabilityName,
            milestones: [],
            isIncomplete: !data.addressing || !data.successState || !data.sprintConnection,
        };
        setBoardInitiatives(prev => [...prev, newInitiative]);
    };

    const handleCreateInitiative = (data?: any) => {
        addLocalInitiative(data, creationModalState?.capabilityId);

        setCreationModalState(null);
        setBoardState('initiative');
    };

    const handleInitiativeExpand = (id: string) => {
        // Toggle expansion: logic is simple, click same to collapse, click other to switch
        setExpandedInitiativeId(prev => prev === id ? null : id);
    };

    const handleTagClick = (e: React.MouseEvent, capName: string) => {
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setTagDrawerState({
            isOpen: true,
            x: rect.left,
            y: rect.bottom,
            capName
        });
    };

    const closeTagDrawer = () => {
        setTagDrawerState(null);
    };

    // Helper to get capability name
    const getCapabilityName = (id?: string) => {
        if (!id) return undefined;
        return allCapabilities.find(c => c.id === id)?.name;
    };

    const handleCapabilityClick = (id: string) => {
        setCapabilityWorkspaceState({ isOpen: true, capabilityId: id });
    };

    // Derived values for Capability Workspace
    // RENDER HELPERS
    const renderCapabilityColumn = (
        items: BoardCapability[],
        tier: 'prioritize' | 'plant' | 'iterate'
    ) => (
        <>
            {items.map(item => (
                <CapabilityCard
                    key={item.id}
                    {...item}
                    initiativeCount={boardInitiatives.filter(initiative => initiative.capabilityId === item.id).length}
                    tier={tier}
                    onClick={() => handleCapabilityClick(item.id)}
                    onAddInitiative={(e) => { e.stopPropagation(); handleAddInitiativeClick(item.id, tier); }}
                />
            ))}
        </>
    );

    const renderInitiativeColumn = (
        items: Omit<InitiativeCardProps, 'onExpand' | 'onTagClick'>[],
        tier: 'prioritize' | 'plant' | 'iterate'
    ) => (
        <div className="space-y-4">
            {items.map(item => (
                <InitiativeCard
                    key={item.id}
                    {...item}
                    isExpanded={expandedInitiativeId === item.id}
                    onExpand={() => handleInitiativeExpand(item.id)}
                    onCollapse={() => setExpandedInitiativeId(null)}
                    onViewDetails={() => setDetailModalState({ isOpen: true, initiativeId: item.id })}
                    onTagClick={() => setDetailModalState({ isOpen: true, initiativeId: item.id, initialFocus: 'labels' })}
                    isHidden={hiddenInitiatives.includes(item.id)}
                    onToggleHidden={() => handleToggleHidden(item.id)}
                    onAddMilestone={() => handleAddMilestoneClick(item.id, tier)}
                />
            ))}

            {/* Add Initiative Link - Only if < 3 items */}
            {items.length < 3 && (
                <button
                    onClick={() => handleAddInitiativeClick(undefined, tier)}
                    className="group flex w-full items-center justify-center rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-mist)] py-3 text-[var(--fg-3)] transition-all hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]"
                >
                    <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Add Initiative</span>
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Zone A: Page Header */}
            <BoardHeader onOpenSettings={() => setIsTeamMembersModalOpen(true)} />

            <ReferenceStrip
                theme={MOCK_REFERENCE_CONTEXT.twelveMonthTheme}
                focusAreas={MOCK_REFERENCE_CONTEXT.focusAreas}
            />

            {isLoadingSelections && (
                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--fg-3)] shadow-[var(--shadow-soft-1)]">
                    Loading selected 3P capabilities...
                </div>
            )}

            <div className="relative flex-1 overflow-auto rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-8 shadow-[var(--shadow-soft-1)]">
                {/* STALENESS BANNER */}
                {isStale && (
                    <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] border-l-4 border-l-[var(--aos-warning)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft-1)] animate-in fade-in slide-in-from-top-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 rounded-full bg-[var(--aos-warning-tint)] p-1.5">
                                <Sparkles className="h-4 w-4 text-[var(--aos-warning)]" />
                            </div>
                            <p className="text-sm font-medium leading-snug text-[var(--fg-2)]">
                                Your sprint synthesis may no longer reflect your current plan after recent edits.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 px-2">
                            <button
                                onClick={() => setIsStale(false)}
                                className="rounded-full border border-[var(--aos-warning)] bg-[var(--aos-warning-tint)] px-4 py-1.5 text-sm font-semibold text-[var(--aos-warning)] transition-colors hover:bg-[var(--bg-sunken)]"
                            >
                                Regenerate
                            </button>
                            <button
                                onClick={() => setIsStale(false)}
                                className="px-3 py-1.5 text-sm font-medium text-[var(--fg-3)] transition-colors hover:text-[var(--fg-1)]"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* ACTION BAR: View Toggles & Save Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div className="flex rounded-full border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-soft-1)]">
                        <button
                            onClick={() => setBoardState('capability')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${boardState === 'capability'
                                ? 'border border-[var(--aos-mist)] bg-[var(--bg-canvas)] text-[var(--fg-1)] shadow-sm'
                                : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
                                }`}
                        >
                            By Capability
                        </button>
                        <button
                            onClick={() => setBoardState('initiative')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${boardState === 'initiative'
                                ? 'border border-[var(--aos-mist)] bg-[var(--bg-canvas)] text-[var(--aos-brass)] shadow-sm'
                                : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
                                }`}
                        >
                            By Initiative
                        </button>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <button className="flex-1 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--fg-2)] shadow-[var(--shadow-soft-1)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] sm:flex-none">
                            Save Draft
                        </button>
                        <button
                            onClick={() => navigate('/pro/planning/sprint-planning/review')}
                            className="flex-1 rounded-[var(--radius-xs)] border border-[var(--bg-inverse)] bg-[var(--bg-inverse)] px-4 py-2 text-sm font-medium text-[var(--fg-on-dark)] shadow-sm transition-colors hover:bg-[var(--aos-slate-blue)] sm:flex-none"
                        >
                            Review & Lock Sprint
                        </button>
                    </div>
                </div>

                <div className="flex h-full min-w-0 flex-col">
                    {/* Zone C: 3P Column Board */}
                    <ColumnBoard
                        boardState={boardState}
                        prioritize={boardState === 'capability' ? renderCapabilityColumn(boardCapabilities.prioritize, 'prioritize') : renderInitiativeColumn(initiativesByTier.prioritize, 'prioritize')}
                        plant={boardState === 'capability' ? renderCapabilityColumn(boardCapabilities.plant, 'plant') : renderInitiativeColumn(initiativesByTier.plant, 'plant')}
                        iterate={boardState === 'capability' ? renderCapabilityColumn(boardCapabilities.iterate, 'iterate') : renderInitiativeColumn(initiativesByTier.iterate, 'iterate')}
                    />

                    {/* Zone C.1: Parking Lot (Expandable Row) */}
                    {boardState === 'capability' && (
                        <div className="mt-8 overflow-hidden rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
                            <details className="group">
                                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-[var(--bg-canvas)]">
                                    <div className="rounded bg-[var(--bg-canvas)] p-1 text-[var(--fg-3)] transition-transform group-open:rotate-90">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--fg-1)]">Parking Lot</h3>
                                        <p className="text-xs font-medium text-[var(--fg-3)]">Not doing this right now. Selected capabilities that are safe to ignore for this sprint.</p>
                                    </div>
                                </summary>
                                <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-300 min-h-[160px]">
                                        {boardCapabilities.parking.map(item => (
                                            <div key={item.id} className="h-full">
                                                <CapabilityCard
                                                    {...item}
                                                    tier="iterate"
                                                    onClick={() => handleCapabilityClick(item.id)}
                                                    onAddInitiative={(e) => { e.stopPropagation(); handleAddInitiativeClick(item.id, 'iterate'); }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </div>
                    )}

                    {/* Hidden Items Banner (Moved to bottom, de-emphasized) */}
                    {hiddenInitiatives.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mt-8 opacity-70">
                            <EyeOff className="h-3.5 w-3.5 text-[var(--fg-4)]" />
                            <span className="text-xs font-medium text-[var(--fg-3)]">
                                {hiddenInitiatives.length} Initiative{hiddenInitiatives.length !== 1 && 's'} currently hidden from Progress Tracking
                            </span>
                        </div>
                    )}

                    {/* Capability Tag Drawer - Absolute Positioned */}
                    {tagDrawerState && (
                        <CapabilityTagDrawer
                            isOpen={tagDrawerState.isOpen}
                            onClose={closeTagDrawer}
                            position={{ x: tagDrawerState.x, y: tagDrawerState.y }}
                            data={MOCK_TAG_DATA} // In real app, fetch data based on tagDrawerState.capName
                        />
                    )}

                    {/* Centralized Workspace Modal Manager */}
                    <WorkspaceModalManager
                        isOpen={!!capabilityWorkspaceState?.isOpen || !!detailModalState?.isOpen}
                        onClose={() => {
                            setCapabilityWorkspaceState(null);
                            setDetailModalState(null);
                        }}
                        initialCapabilityId={capabilityWorkspaceState?.capabilityId}
                        initialInitiativeId={detailModalState?.initiativeId}
                        capabilities={allCapabilities as any[]}
                        initiatives={boardInitiatives as any[]}
                        onCreateInitiative={(data) => addLocalInitiative(data, data.capabilityId)}
                    />

                    {/* Initiative Entry Form (Replaces older Creation Modal for the Board Level) */}
                    {creationModalState && (
                        <InitiativeEntryForm
                            isOpen={creationModalState.isOpen}
                            onClose={() => setCreationModalState(null)}
                            tier={creationModalState.tier || 'prioritize'}
                            capabilityName={getCapabilityName(creationModalState.capabilityId) || 'Unassigned'}
                            sprintGoal="Finalize ICP v2 messaging and validate with 5 friendlies to ensure we are attracting the right fit." // Mock sprint goal for context
                            onSave={(data) => {
                                handleCreateInitiative(data);
                                console.log('Saved Initiative Data from Board:', data);
                            }}
                        />
                    )}

                    {/* Milestone Entry Form (For adding directly from Board) */}
                    {milestoneCreationModalState && (
                        <MilestoneEntryForm
                            isOpen={milestoneCreationModalState.isOpen}
                            onClose={() => setMilestoneCreationModalState(null)}
                            tier={milestoneCreationModalState.tier}
                            capabilityName={'Inherited Capability'} // Mock
                            initiativeName={boardInitiatives.find(i => i.id === milestoneCreationModalState.initiativeId)?.name || 'Unknown Initiative'}
                            existingMilestonesCount={2} // MOCKED
                            onSave={(data) => {
                                console.log('Saved Milestone Data from Board:', data);
                                setMilestoneCreationModalState(null);
                            }}
                        />
                    )}

                    {/* Zone D: Strategic Advisor Panel (Overlay) */}
                    <StrategicAdvisorPanel
                        isOpen={advisorOpen}
                        onClose={() => setAdvisorOpen(false)}
                        contextLevel="board"
                    />

                    {/* Helper Trigger Button (Floating Bottom Right) */}
                    <button
                        onClick={() => setAdvisorOpen(!advisorOpen)}
                        className="group fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--aos-brass)] bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] shadow-lg transition-all hover:scale-105 hover:bg-[var(--aos-brass)]"
                        aria-label="Toggle Strategic Advisor"
                        title="Strategic Advisor"
                    >
                        <Sparkles className="w-6 h-6 fill-current" />
                        <div className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded bg-[var(--bg-inverse)] px-2 py-1 text-xs text-[var(--fg-on-dark)] opacity-0 transition-opacity group-hover:opacity-100">
                            Strategic Advisor
                        </div>
                    </button>

                    {/* Team Members Management Modal */}
                    <TeamMembersModal
                        isOpen={isTeamMembersModalOpen}
                        onClose={() => setIsTeamMembersModalOpen(false)}
                    />

                </div>
            </div>
        </div>
    );
};
