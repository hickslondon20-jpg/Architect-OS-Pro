import React, { useState, useEffect } from 'react';
import { Card, PageHeader } from '../../../components/ui';
import { useSprintState, SprintState } from '../../../hooks/useSprintState';
import { supabase } from '../../../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, RotateCcw, Rocket, Compass, Edit2, AlertCircle, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// PARKED for home Strategic Overview dashboard - V-08.
// This preserves the prior Execution Hub lifecycle, identity, health/stat, and sp_sprint_* fetch logic.

// --- Static Components for Sprint Lifecycle States --- //

const SprintIdentityBlock: React.FC<{ sprintState: SprintState }> = ({ sprintState }) => {
    const status = sprintState.status;
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(sprintState.sprintName || '');

    useEffect(() => {
        if (!isEditing) {
            setName(sprintState.sprintName || '');
        }
    }, [sprintState.sprintName, isEditing]);

    const handleSaveName = async () => {
        setIsEditing(false);
        if (name === sprintState.sprintName || !sprintState.sprintId) return;

        try {
            await supabase.from('sp_sprint_goals').update({ name }).eq('id', sprintState.sprintId);
        } catch (error) {
            console.error('Error saving sprint name:', error);
            setName(sprintState.sprintName || '');
        }
    };

    let badgeText = "ACTIVE";
    let badgeBg = "bg-blue-100 text-blue-700";
    let dateString = "Dates running...";
    let showDaysRemaining = true;
    let daysRemaining = `${sprintState.daysRemaining} days remaining`;
    let daysBg = "bg-slate-100 text-slate-600";

    if (status === 'PRE_LAUNCH') {
        badgeText = "PRE-LAUNCH";
        badgeBg = "bg-slate-100 text-slate-700 uppercase";
        dateString = "Kickoff date not set";
        showDaysRemaining = false;
    } else if (status === 'WIND_DOWN') {
        badgeText = "WIND-DOWN";
        badgeBg = "bg-amber-100 text-amber-700 uppercase";
        daysBg = "bg-amber-100 text-amber-700";
    } else if (status === 'CLOSED_RETRO_PENDING' || status === 'CLOSED_COMPLETE') {
        badgeText = "CLOSED";
        badgeBg = "bg-slate-100 text-slate-700 uppercase";
        dateString = "Sprint complete";
        showDaysRemaining = false;
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') {
                                    setIsEditing(false);
                                    setName(sprintState.sprintName || '');
                                }
                            }}
                            autoFocus
                            className="bg-transparent border-b border-blue-500 font-bold text-2xl text-slate-900 focus:outline-none w-96"
                        />
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-slate-900">{name || 'Sprint...'}</h2>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Rename Sprint"
                            >
                                <Edit2 size={16} />
                            </button>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md tracking-wider ${badgeBg}`}>
                        {badgeText}
                    </span>
                    {status === 'CLOSED_COMPLETE' && (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider bg-green-100 text-green-700">
                            Retrospective Complete
                        </span>
                    )}
                </div>
            </div>

            <p className="text-slate-600 mb-6 max-w-3xl">
                {sprintState.sprintGoal || 'No goal set yet.'}
            </p>

            <div className="flex items-center gap-4 text-sm font-medium">
                <span className={status === 'PRE_LAUNCH' ? 'text-amber-600 flex items-center gap-1' : 'text-slate-500'}>
                    {status === 'PRE_LAUNCH' && <AlertCircle size={14} />}
                    {dateString}
                </span>
                {showDaysRemaining && (
                    <>
                        <span className="text-slate-300">•</span>
                        <span className={`px-2 py-0.5 rounded-md ${daysBg}`}>
                            {daysRemaining}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

const HealthBarStrip: React.FC<{ stats: any }> = ({ stats }) => {
    const completionPct = stats.totalMilestones > 0 ? Math.round((stats.completedMilestones / stats.totalMilestones) * 100) : 0;

    return (
        // Pending V-08: move organization-health/dashboard content to the home Strategic Overview.
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-8 w-full">
                <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Overall Completion</p>
                    <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-blue-600 rounded-full`} style={{ width: `${completionPct}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{completionPct}%</span>
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-200"></div>

                <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Initiatives</p>
                    <p className="text-sm font-bold text-slate-900">{stats.completedInitiatives} of {stats.totalInitiatives} complete</p>
                </div>

                <div className="h-8 w-px bg-slate-200"></div>

                <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Blockers</p>
                    {stats.blockedItems > 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            {stats.blockedItems} blocked
                        </div>
                    ) : (
                        <p className="text-sm font-bold text-slate-400">0 blocked</p>
                    )}
                </div>

                <div className="h-8 w-px bg-slate-200"></div>

                <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Last Updated</p>
                    <p className={`text-sm font-bold ${stats.lastUpdatedDaysAgo > 7 ? 'text-amber-600' : 'text-slate-900'}`}>
                        Updated {stats.lastUpdatedDaysAgo === 0 ? 'today' : `${stats.lastUpdatedDaysAgo} days ago`}
                    </p>
                </div>
            </div>
        </div>
    )
};

type ExecutionElementState = 'ready' | 'current' | 'upcoming';

interface ExecutionElement {
    label: string;
    surface: string;
    description: string;
    href: string;
    icon: LucideIcon;
    state: ExecutionElementState;
    statusLine: string;
}

const getExecutionElements = (status: SprintState['status']): ExecutionElement[] => {
    const isNoSprint = status === 'NO_SPRINT';
    const isPreLaunch = status === 'PRE_LAUNCH';
    const isReflectPhase = status === 'WIND_DOWN' || status === 'CLOSED_RETRO_PENDING' || status === 'CLOSED_COMPLETE';

    return [
        {
            label: 'Orient',
            surface: 'Sprint Charter & Summary',
            description: 'Re-anchor on the locked sprint goal, 3P plan, owners, and team alignment story.',
            href: '/pro/execution/orient',
            icon: Compass,
            state: isPreLaunch ? 'current' : 'ready',
            statusLine: isNoSprint ? 'Available after sprint planning' : isPreLaunch ? 'Start here before kickoff' : 'Reference throughout the sprint',
        },
        {
            label: 'Operate',
            surface: 'Status Tracker',
            description: 'Run the sprint through milestone updates, blockers, ownership, and standup rhythm.',
            href: '/pro/execution/operate',
            icon: CheckCircle2,
            state: status === 'ACTIVE' ? 'current' : isNoSprint || isPreLaunch ? 'upcoming' : 'ready',
            statusLine: status === 'ACTIVE' ? 'Current operating surface' : isPreLaunch ? 'Ready once the sprint begins' : 'Review operational progress',
        },
        {
            label: 'Reflect',
            surface: 'Wind-Down · Retrospective · Reflection & Review',
            description: 'Close the sprint, decide what carries forward, and capture what the organization learned.',
            href: '/pro/execution/reflect',
            icon: RotateCcw,
            state: isReflectPhase ? 'current' : 'upcoming',
            statusLine: isReflectPhase ? 'Close and review this sprint' : 'Opens when it is time to close',
        },
    ];
};

const ExecutionElementCard: React.FC<{ element: ExecutionElement; index: number }> = ({ element, index }) => {
    const Icon = element.icon;
    const isCurrent = element.state === 'current';
    const isUpcoming = element.state === 'upcoming';

    return (
        <Link to={element.href} className="group block h-full">
            <Card
                className="flex h-full flex-col rounded-[var(--radius-xs)] p-5 transition-colors"
                style={{
                    background: isUpcoming ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                    border: isCurrent ? 'var(--border-accent)' : 'var(--border-hairline)',
                    boxShadow: isCurrent ? 'var(--shadow-soft-1)' : 'none',
                }}
            >
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span
                            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                            style={{
                                background: isCurrent ? 'var(--aos-brass)' : 'var(--bg-surface)',
                                color: isCurrent ? 'var(--aos-cloud)' : 'var(--fg-3)',
                                border: isCurrent ? '1px solid var(--aos-brass)' : 'var(--border-hairline)',
                            }}
                        >
                            {index + 1}
                        </span>
                        <Icon className="h-5 w-5" style={{ color: isUpcoming ? 'var(--fg-3)' : 'var(--aos-brass)' }} />
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--aos-brass)' }} />
                </div>

                <div className="aos-eyebrow mb-2" style={{ color: isCurrent ? 'var(--aos-brass)' : 'var(--fg-3)' }}>
                    {element.label}
                </div>
                <h3 className="aos-h3">{element.surface}</h3>
                <p className="aos-small mt-3 flex-1">{element.description}</p>
                <div className="mt-5 rounded-[var(--radius-xs)] px-3 py-2" style={{ background: 'var(--bg-canvas)', border: 'var(--border-hairline)' }}>
                    <p className="text-xs font-medium" style={{ color: isCurrent ? 'var(--aos-brass)' : 'var(--fg-3)' }}>
                        {element.statusLine}
                    </p>
                </div>
            </Card>
        </Link>
    );
};

const ExecutionElementLaunchpad: React.FC<{ sprintState: SprintState }> = ({ sprintState }) => {
    const elements = getExecutionElements(sprintState.status);

    return (
        <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)]" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                            <Rocket className="h-6 w-6" style={{ color: 'var(--aos-brass)' }} />
                        </div>
                        <div>
                            <div className="aos-eyebrow mb-2">Execution Sequence</div>
                            <h2 className="aos-h3">Three elements to run the sprint</h2>
                            <p className="aos-small mt-2 max-w-2xl">
                                Orient on the sprint, operate the work, then reflect and close with a clear handoff into what comes next.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-[var(--radius-xs)] px-4 py-3" style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}>
                        <div className="aos-eyebrow mb-1">Current phase</div>
                        <p className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>
                            {sprintState.status.replace(/_/g, ' ')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {elements.map((element, index) => (
                        <ExecutionElementCard key={element.label} element={element} index={index} />
                    ))}
                </div>
            </div>
        </Card>
    );
};

const PreLaunchBanner: React.FC<{ sprintState: SprintState }> = ({ sprintState }) => {
    const [kickoffDate, setKickoffDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = async () => {
        if (!kickoffDate || !sprintState.sprintId) return;

        setIsSaving(true);
        try {
            await supabase.from('sp_sprint_goals').update({ kickoff_date: kickoffDate }).eq('id', sprintState.sprintId);
            window.location.reload();
        } catch (error) {
            console.error('Error saving kickoff:', error);
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Set your sprint kickoff date to start the clock.</h3>
                <p className="text-slate-600">Your sprint plan is locked and ready. Choose the date your team officially kicks off this sprint — this is when your 84-day countdown begins.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <input
                    type="date"
                    className="border border-slate-300 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    value={kickoffDate}
                    onChange={(e) => setKickoffDate(e.target.value)}
                />
                <button
                    onClick={handleConfirm}
                    disabled={!kickoffDate || isSaving}
                    className="px-4 py-2 bg-slate-900 text-white font-medium rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Confirm Kickoff'}
                </button>
            </div>
        </div>
    );
};

const WindDownBanner = () => (
    <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h3 className="text-lg font-bold text-amber-900 mb-1">Sprint 1 ends in 21 days.</h3>
            <p className="text-amber-700">Begin your wind-down review to close this quarter with intention — decide what to complete, what to carry forward, and what to release.</p>
        </div>
        <div className="shrink-0">
            <Link to="/pro/execution/reflect/wind-down" className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition-colors whitespace-nowrap inline-block">
                Begin Wind-Down Review
            </Link>
        </div>
    </div>
);

const RetrospectiveBanner = () => (
    <div className="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-600 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h3 className="text-lg font-bold text-blue-900 mb-1">Sprint 1 is complete.</h3>
            <p className="text-blue-700">Take a moment to close this chapter. Your retrospective synthesizes what you accomplished, how your capabilities developed, and what comes next.</p>
        </div>
        <div className="shrink-0">
            <Link to="/pro/execution/reflect/retrospective" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap inline-block">
                Begin Retrospective
            </Link>
        </div>
    </div>
);

const CompletionSummaryBlock: React.FC<{ stats: any, sprintState: SprintState }> = ({ stats, sprintState }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Milestones Completed</p>
            <p className="text-xl font-bold text-slate-900">{stats.completedMilestones} of {stats.totalMilestones}</p>
        </div>
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Initiatives Completed</p>
            <p className="text-xl font-bold text-slate-900">{stats.completedInitiatives} of {stats.totalInitiatives}</p>
        </div>
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Days in Sprint</p>
            <p className="text-xl font-bold text-slate-900">{sprintState.daysElapsed || 84}</p>
        </div>
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Sprint Goal Self-Assessment</p>
            <p className="text-sm font-medium text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle size={14} /> Pending
            </p>
        </div>
    </div>
);

const CelebrationBlock = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-sm text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Sprint 1 is documented and complete.</h2>
        <div className="max-w-2xl mx-auto space-y-4">
            <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Sprint Theme</p>
                <p className="text-xl text-slate-800 font-serif italic mb-6">"Establishing the bedrock for scalable delivery."</p>
            </div>
            <div className="pt-6 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Sprint Closing Note</p>
                <p className="text-base text-slate-600">The foundation holds. We shifted from heroic, individual delivery to system-driven consistency, clearing the path for growth without breakage.</p>
            </div>
        </div>
    </div>
);

const SprintSummaryStrip = () => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row justify-around items-center gap-6">
        <div className="text-center w-full md:w-auto">
            <p className="text-3xl font-bold text-slate-900 mb-1">38</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Milestones Completed</p>
        </div>
        <div className="hidden md:block w-px h-12 bg-slate-200"></div>
        <div className="text-center w-full md:w-auto">
            <p className="text-3xl font-bold text-slate-900 mb-1">3</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Capabilities Advanced</p>
        </div>
        <div className="hidden md:block w-px h-12 bg-slate-200"></div>
        <div className="text-center w-full md:w-auto">
            <p className="text-3xl font-bold text-slate-900 mb-1">Achieved</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sprint Goal Outcome</p>
        </div>
    </div>
);

const ForwardCTABlock = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Ready to begin Sprint 2 Planning?</h3>
        <p className="text-slate-600 mb-6">Your Forward Guidance has been pre-populated in the Quarter Map.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/pro/planning" className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                Begin Sprint 2 Planning
            </Link>
            <Link to="/pro/execution/reflect/retrospective" className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors w-full sm:w-auto">
                View Sprint 1 Retrospective
            </Link>
        </div>
    </div>
);

const SprintHistoryPlaceholder = () => (
    <div className="mt-12 text-center md:text-left">
        <button className="flex items-center justify-center md:justify-start gap-2 mb-4 mx-auto md:mx-0 cursor-pointer hover:opacity-80 transition-opacity text-slate-500 hover:text-slate-800">
            <ChevronRight size={18} />
            <h3 className="text-base font-medium">Your Sprint History</h3>
        </button>
    </div>
);

// --- Main Page Component --- //

export const ExecutionLanding: React.FC = () => {
    const sprintState = useSprintState();
    const [initiatives, setInitiatives] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [stats, setStats] = useState({
        completedMilestones: 0,
        totalMilestones: 0,
        completedInitiatives: 0,
        totalInitiatives: 0,
        blockedItems: 0,
        lastUpdatedDaysAgo: 0,
    });
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => {
        if (!sprintState.sprintId) {
            return;
        }

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Fetch initiatives
                const { data: inits, error: initsError } = await supabase
                    .from('sp_sprint_initiatives')
                    .select('*')
                    .eq('sprint_goal_id', sprintState.sprintId);

                if (initsError) throw initsError;
                const fetchedInitiatives = inits || [];
                setInitiatives(fetchedInitiatives);

                if (fetchedInitiatives.length === 0) {
                    setIsLoadingData(false);
                    return;
                }

                const initiativeIds = fetchedInitiatives.map((i: any) => i.id);

                // Fetch milestones
                const { data: miles, error: milesError } = await supabase
                    .from('sp_sprint_milestones')
                    .select('*')
                    .in('initiative_id', initiativeIds);

                if (milesError) throw milesError;
                const fetchedMilestones = miles || [];
                setMilestones(fetchedMilestones);

                // Calculate stats
                let completedMilestones = 0;
                let latestUpdate = new Date(0);
                let blockedItems = 0;

                fetchedMilestones.forEach((m: any) => {
                    if (m.status === 'completed') completedMilestones++;
                    if (m.status === 'blocked') blockedItems++;

                    const updated = new Date(m.updated_at || m.created_at);
                    if (updated > latestUpdate) latestUpdate = updated;
                });

                let completedInitiatives = 0;
                fetchedInitiatives.forEach((i: any) => {
                    if (i.status === 'completed') completedInitiatives++;
                    else {
                        const itsMilestones = fetchedMilestones.filter((m: any) => m.initiative_id === i.id);
                        if (itsMilestones.length > 0 && itsMilestones.every((m: any) => m.status === 'completed')) {
                            completedInitiatives++;
                        }
                    }
                    if (i.status === 'blocked') blockedItems++;

                    const updated = new Date(i.updated_at || i.created_at);
                    if (updated > latestUpdate) latestUpdate = updated;
                });

                let lastUpdatedDaysAgo = 0;
                if (latestUpdate.getTime() > 0) {
                    const diffTime = Math.abs(new Date().getTime() - latestUpdate.getTime());
                    lastUpdatedDaysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }

                setStats({
                    completedMilestones,
                    totalMilestones: fetchedMilestones.length,
                    completedInitiatives,
                    totalInitiatives: fetchedInitiatives.length,
                    blockedItems,
                    lastUpdatedDaysAgo
                });

            } catch (error) {
                console.error("Error fetching execution data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [sprintState.sprintId]);

    const renderContent = () => {
        switch (sprintState.status) {
            case 'NO_SPRINT':
                return (
                    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl mt-8">
                        <div className="w-12 h-12 bg-slate-100 rounded-full mb-4 flex items-center justify-center">
                            <Rocket className="text-slate-400" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Your execution layer is ready.</h2>
                        <p className="text-slate-500 max-w-md mb-6">
                            Once you lock your sprint plan, this section becomes your operational home for the quarter: orient the team, operate the work, and close the sprint with reflection.
                        </p>
                        <Link to="/pro/planning" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block">
                            Go to Planning
                        </Link>
                        <div className="mt-8 w-full">
                            <ExecutionElementLaunchpad sprintState={sprintState} />
                        </div>
                    </div>
                );
            case 'PRE_LAUNCH':
                return (
                    <div className="space-y-6 mt-6">
                        <SprintIdentityBlock sprintState={sprintState} />
                        <PreLaunchBanner sprintState={sprintState} />
                        <ExecutionElementLaunchpad sprintState={sprintState} />
                    </div>
                );
            case 'ACTIVE':
                return (
                    <div className="space-y-6 mt-6">
                        <SprintIdentityBlock sprintState={sprintState} />
                        <HealthBarStrip stats={stats} />
                        <ExecutionElementLaunchpad sprintState={sprintState} />
                    </div>
                );
            case 'WIND_DOWN':
                return (
                    <div className="space-y-6 mt-6">
                        <SprintIdentityBlock sprintState={sprintState} />
                        <WindDownBanner />
                        <HealthBarStrip stats={stats} />
                        <ExecutionElementLaunchpad sprintState={sprintState} />
                    </div>
                );
            case 'CLOSED_RETRO_PENDING':
                return (
                    <div className="space-y-6 mt-6">
                        <SprintIdentityBlock sprintState={sprintState} />
                        <RetrospectiveBanner />
                        <CompletionSummaryBlock stats={stats} sprintState={sprintState} />
                        <ExecutionElementLaunchpad sprintState={sprintState} />
                    </div>
                );
            case 'CLOSED_COMPLETE':
                return (
                    <div className="space-y-6 mt-6">
                        <SprintIdentityBlock sprintState={sprintState} />
                        <CelebrationBlock />
                        <SprintSummaryStrip />
                        <ForwardCTABlock />
                        <ExecutionElementLaunchpad sprintState={sprintState} />
                        <SprintHistoryPlaceholder />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <PageHeader title="Execution & Review" subtitle="Maintain momentum and recalibrate regularly." />
            {renderContent()}
        </div>
    );
};
