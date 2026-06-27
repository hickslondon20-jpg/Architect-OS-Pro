import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Calendar, ChevronDown, ChevronRight, Clock, Filter, X } from 'lucide-react';

// Sprint window — May 4 → Aug 2, 2026 (13 weeks); today (Jun 20) lands ~week 7
const SPRINT_START = new Date('2026-05-04');
const SPRINT_END = new Date('2026-08-02');
const SPRINT_WEEKS = 13;

const WEEK_LABELS: string[] = [];
for (let i = 0; i < SPRINT_WEEKS; i++) {
    const d = new Date(SPRINT_START);
    d.setDate(d.getDate() + i * 7);
    WEEK_LABELS.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
}

type ThreeP = 'Prioritize' | 'Plant' | 'Progressively Iterate';
type BarStatus = 'complete' | 'in-progress' | 'not-started' | 'blocked';
type FilterSection = 'initiative' | 'milestone';

interface Milestone {
    id: string;
    label: string;
    start: Date | null;
    end: Date | null;
    status: BarStatus;
}

interface TimelineInitiative {
    id: string;
    initiative: string;
    threeP: ThreeP;
    owner: string;
    milestones: Milestone[];
}

const INITIATIVES: TimelineInitiative[] = [
    {
        id: 'i1',
        initiative: 'Finalize SOP Matrix',
        threeP: 'Prioritize',
        owner: 'S. Hicks',
        milestones: [
            { id: 'i1-m1', label: 'Audit existing SOPs for gaps', start: new Date('2026-05-04'), end: new Date('2026-05-24'), status: 'complete' },
            { id: 'i1-m2', label: 'Draft missing SOP documentation', start: new Date('2026-05-18'), end: new Date('2026-06-14'), status: 'in-progress' },
            { id: 'i1-m3', label: 'Peer review + sign-off', start: new Date('2026-06-15'), end: new Date('2026-07-05'), status: 'not-started' },
        ],
    },
    {
        id: 'i2',
        initiative: 'Client Onboarding Playbook',
        threeP: 'Prioritize',
        owner: 'M. Webb',
        milestones: [
            { id: 'i2-m1', label: 'Map current onboarding steps', start: new Date('2026-05-04'), end: new Date('2026-05-17'), status: 'complete' },
            { id: 'i2-m2', label: 'Migrate active clients to new portal', start: new Date('2026-05-26'), end: new Date('2026-07-05'), status: 'blocked' },
            { id: 'i2-m3', label: 'Train team on new playbook', start: null, end: null, status: 'not-started' },
        ],
    },
    {
        id: 'i3',
        initiative: 'Ops Infrastructure v2',
        threeP: 'Plant',
        owner: 'E. Rostova',
        milestones: [
            { id: 'i3-m1', label: 'Scope tech stack decisions', start: new Date('2026-05-11'), end: new Date('2026-06-01'), status: 'in-progress' },
            { id: 'i3-m2', label: 'Build internal dashboard', start: new Date('2026-06-02'), end: new Date('2026-07-12'), status: 'not-started' },
            { id: 'i3-m3', label: 'QA & rollout', start: new Date('2026-07-13'), end: new Date('2026-08-02'), status: 'not-started' },
        ],
    },
    {
        id: 'i4',
        initiative: 'Team Capacity Benchmarking',
        threeP: 'Plant',
        owner: 'TBD',
        milestones: [
            { id: 'i4-m1', label: 'Baseline capacity model', start: null, end: null, status: 'not-started' },
            { id: 'i4-m2', label: 'Identify bottleneck roles', start: null, end: null, status: 'not-started' },
        ],
    },
    {
        id: 'i5',
        initiative: 'Leadership Cadence Retune',
        threeP: 'Progressively Iterate',
        owner: 'S. Hicks',
        milestones: [
            { id: 'i5-m1', label: 'Move to weekly strategic block', start: new Date('2026-05-04'), end: new Date('2026-06-01'), status: 'in-progress' },
            { id: 'i5-m2', label: 'Delegate 3 recurring ops decisions', start: new Date('2026-06-01'), end: new Date('2026-07-05'), status: 'not-started' },
        ],
    },
    {
        id: 'i6',
        initiative: 'Q2 Planning Foundations',
        threeP: 'Progressively Iterate',
        owner: 'S. Hicks',
        milestones: [
            { id: 'i6-m1', label: 'Build Q2 initiative shortlist', start: new Date('2026-07-05'), end: null, status: 'not-started' },
            { id: 'i6-m2', label: 'Align leadership on Q2 theme', start: new Date('2026-07-12'), end: new Date('2026-07-26'), status: 'not-started' },
        ],
    },
];

const ALL_INITIATIVE_IDS = INITIATIVES.map((i) => i.id);
const ALL_MILESTONE_IDS = INITIATIVES.flatMap((i) => i.milestones.map((m) => m.id));

type ThreePFilter = 'All' | ThreeP;
const THREE_P_PILLS: ThreePFilter[] = ['All', 'Prioritize', 'Plant', 'Progressively Iterate'];

const THREE_P_COLORS: Record<ThreePFilter, React.CSSProperties> = {
    All: { background: 'rgba(255,255,255,0.15)', color: 'var(--fg-on-dark)', border: '1px solid rgba(255,255,255,0.25)' },
    Prioritize: { background: 'rgba(184,146,42,0.2)', color: 'var(--aos-brass)', border: '1px solid rgba(184,146,42,0.4)' },
    Plant: { background: 'rgba(46,125,91,0.2)', color: '#6BC99A', border: '1px solid rgba(46,125,91,0.4)' },
    'Progressively Iterate': { background: 'rgba(95,126,163,0.25)', color: 'var(--aos-steel-blue)', border: '1px solid rgba(95,126,163,0.4)' },
};

function toWeekOffset(date: Date): number {
    return (date.getTime() - SPRINT_START.getTime()) / (7 * 24 * 60 * 60 * 1000);
}

const STATUS_STYLES: Record<BarStatus, { bar: React.CSSProperties; label: string }> = {
    complete: { bar: { background: 'var(--aos-success)' }, label: 'Complete' },
    'in-progress': { bar: { background: 'var(--aos-brass)' }, label: 'In Progress' },
    blocked: { bar: { background: 'var(--aos-risk)' }, label: 'Blocked' },
    'not-started': { bar: { background: 'var(--fg-4)', opacity: 0.4 }, label: 'Not Started' },
};

const divider = <div className="hidden md:block w-px h-10 self-center" style={{ background: 'var(--aos-mist)' }} />;

export const OperateTimelinePage: React.FC = () => {
    const [threePFilter, setThreePFilter] = useState<ThreePFilter>('All');
    const [filterOpen, setFilterOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<FilterSection>('initiative');
    const [selectedInitiatives, setSelectedInitiatives] = useState<Set<string>>(new Set(ALL_INITIATIVE_IDS));
    const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set(ALL_MILESTONE_IDS));
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const todayOffset = toWeekOffset(new Date());
    const todayPct = (todayOffset / SPRINT_WEEKS) * 100;
    const isInSprint = todayOffset >= 0 && todayOffset <= SPRINT_WEEKS;

    const initiativeFilterActive = selectedInitiatives.size < ALL_INITIATIVE_IDS.length;
    const milestoneFilterActive = selectedMilestones.size < ALL_MILESTONE_IDS.length;
    const anyFilterActive = initiativeFilterActive || milestoneFilterActive;

    const clearAllFilters = () => {
        setSelectedInitiatives(new Set(ALL_INITIATIVE_IDS));
        setSelectedMilestones(new Set(ALL_MILESTONE_IDS));
        setActiveSection('initiative');
    };

    const switchSection = (to: FilterSection) => {
        if (to === activeSection) return;
        // Reset the section we're leaving back to "all"
        if (activeSection === 'initiative') setSelectedInitiatives(new Set(ALL_INITIATIVE_IDS));
        if (activeSection === 'milestone') setSelectedMilestones(new Set(ALL_MILESTONE_IDS));
        setActiveSection(to);
    };

    const toggleInitiative = (id: string) => {
        setSelectedInitiatives((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleMilestone = (id: string) => {
        setSelectedMilestones((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Visible rows
    const visibleInitiatives = INITIATIVES.filter((i) => {
        if (threePFilter !== 'All' && i.threeP !== threePFilter) return false;
        if (!selectedInitiatives.has(i.id)) return false;
        return true;
    });

    const checkboxStyle: React.CSSProperties = { accentColor: 'var(--aos-brass)', width: 14, height: 14, cursor: 'pointer' };
    const metaLabel: React.CSSProperties = { color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' };

    return (
        <div className="space-y-5 pb-20">

            {/* ── Page title ── */}
            <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>Sprint Horizon</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--fg-3)' }}>
                    A lightweight view of where initiatives sit across the sprint window. Wiring and exact durations come later.
                </p>
            </div>

            {/* ── Sprint Summary Banner (mirrors Status Tracker) ── */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)' }}
            >
                {/* Sprint Goal */}
                <div className="p-4" style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)' }}>
                    <p className="text-xs font-bold mb-1" style={{ ...metaLabel, color: 'var(--aos-brass)' }}>Sprint 1 Goal</p>
                    <p className="font-medium text-sm" style={{ color: 'var(--fg-1)' }}>
                        We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.
                    </p>
                </div>

                {/* Stats row */}
                <div className="p-4 flex flex-col md:flex-row items-center gap-6 overflow-x-auto">
                    {/* Completion ring */}
                    <div className="flex items-center gap-4 min-w-max">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-sunken)" strokeWidth="4" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--aos-obsidian)" strokeWidth="4" strokeDasharray="100" strokeDashoffset="62" />
                            </svg>
                            <span className="absolute text-sm font-bold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}>38%</span>
                        </div>
                        <div>
                            <p className="mb-0.5" style={metaLabel}>Overall Completion</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}>16 of 42 Milestones</p>
                        </div>
                    </div>

                    {divider}

                    <div className="min-w-max">
                        <p className="mb-1" style={metaLabel}>Initiatives</p>
                        <div className="flex gap-3 text-sm font-medium" style={{ fontFamily: 'Geist Mono, monospace' }}>
                            <span style={{ color: 'var(--aos-brass)' }}>7 Active</span>
                            <span style={{ color: 'var(--aos-mist)' }}>|</span>
                            <span style={{ color: 'var(--aos-success)' }}>1 Complete</span>
                            <span style={{ color: 'var(--aos-mist)' }}>|</span>
                            <span className="flex items-center gap-1 font-bold" style={{ color: 'var(--aos-risk)' }}>
                                <AlertCircle size={12} /> 1 Blocked
                            </span>
                        </div>
                    </div>

                    {divider}

                    <div className="min-w-max">
                        <p className="mb-1" style={metaLabel}>Pace Assessment</p>
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', color: 'var(--fg-2)' }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--aos-success)' }} />
                            On Track
                            <ChevronDown size={14} style={{ color: 'var(--fg-4)' }} />
                        </button>
                    </div>

                    {divider}

                    <div className="min-w-max">
                        <p className="mb-1" style={metaLabel}>Sprint Clock</p>
                        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}>
                            <Clock size={16} style={{ color: 'var(--aos-brass)' }} />
                            84 Days Remaining
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Timeline card ── */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>

                {/* Obsidian axis header */}
                <div className="px-5 pt-4 pb-0" style={{ background: 'var(--bg-inverse)' }}>

                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        {/* Sprint label */}
                        <div className="flex items-center gap-2 mr-1">
                            <Calendar size={14} style={{ color: 'var(--aos-brass)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--fg-on-dark)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}>
                                Sprint 1 · May 4 – Aug 2, 2026 · 13 wks
                            </span>
                        </div>

                        {/* 3P pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {THREE_P_PILLS.map((pill) => (
                                <button
                                    key={pill}
                                    onClick={() => setThreePFilter(pill)}
                                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                                    style={
                                        threePFilter === pill
                                            ? { ...THREE_P_COLORS[pill], fontFamily: 'Geist, sans-serif' }
                                            : { background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Geist, sans-serif' }
                                    }
                                >
                                    {pill}
                                </button>
                            ))}
                        </div>

                        {/* Filter + Clear */}
                        <div className="flex items-center gap-1.5 ml-auto" ref={filterRef}>
                            {/* X clear button — only when filters active */}
                            {anyFilterActive && (
                                <button
                                    onClick={clearAllFilters}
                                    title="Clear all filters"
                                    className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                                    style={{ background: 'rgba(184,146,42,0.2)', border: '1px solid rgba(184,146,42,0.4)', color: 'var(--aos-brass)' }}
                                >
                                    <X size={11} />
                                </button>
                            )}

                            {/* Filter button */}
                            <div className="relative">
                                <button
                                    onClick={() => setFilterOpen((v) => !v)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                    style={{
                                        background: filterOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                                        color: 'var(--fg-on-dark)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        fontFamily: 'Geist, sans-serif',
                                    }}
                                >
                                    <Filter size={12} />
                                    Filter
                                    {anyFilterActive && (
                                        <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold" style={{ background: 'var(--aos-brass)', color: 'white' }}>
                                            •
                                        </span>
                                    )}
                                    <ChevronDown size={12} />
                                </button>

                                {/* Filter dropdown */}
                                {filterOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-2 rounded-xl z-50 overflow-hidden"
                                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-raised)', width: 292 }}
                                    >
                                        {/* Dropdown header */}
                                        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--aos-mist)' }}>
                                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace' }}>
                                                Filter View
                                            </span>
                                            <div className="flex items-center gap-3">
                                                {anyFilterActive && (
                                                    <button
                                                        onClick={clearAllFilters}
                                                        className="text-xs font-medium"
                                                        style={{ color: 'var(--aos-brass)', fontFamily: 'Geist, sans-serif' }}
                                                    >
                                                        Clear Filter
                                                    </button>
                                                )}
                                                <button onClick={() => setFilterOpen(false)} style={{ color: 'var(--fg-4)' }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Filter by Initiative */}
                                        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--aos-mist)' }}>
                                            <button
                                                className="flex items-center gap-1.5 w-full mb-2"
                                                onClick={() => switchSection('initiative')}
                                            >
                                                {activeSection === 'initiative'
                                                    ? <ChevronDown size={13} style={{ color: 'var(--fg-3)' }} />
                                                    : <ChevronRight size={13} style={{ color: 'var(--fg-4)' }} />}
                                                <span className="text-xs font-semibold" style={{ color: activeSection === 'initiative' ? 'var(--fg-1)' : 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>
                                                    Filter by Initiative
                                                </span>
                                                {activeSection === 'initiative' && initiativeFilterActive && (
                                                    <span className="ml-auto text-[11px]" style={{ color: 'var(--aos-brass)', fontFamily: 'Geist Mono, monospace' }}>
                                                        {selectedInitiatives.size}/{ALL_INITIATIVE_IDS.length}
                                                    </span>
                                                )}
                                            </button>

                                            {activeSection === 'initiative' ? (
                                                <>
                                                    <div className="flex gap-2 mb-2 pl-5">
                                                        <button className="text-[11px]" style={{ color: 'var(--aos-brass)', fontFamily: 'Geist, sans-serif' }} onClick={() => setSelectedInitiatives(new Set(ALL_INITIATIVE_IDS))}>All</button>
                                                        <span style={{ color: 'var(--aos-mist)' }}>·</span>
                                                        <button className="text-[11px]" style={{ color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }} onClick={() => setSelectedInitiatives(new Set())}>None</button>
                                                    </div>
                                                    <div className="space-y-2 max-h-44 overflow-y-auto pl-5 pr-1">
                                                        {INITIATIVES.map((i) => (
                                                            <label key={i.id} className="flex items-start gap-2 cursor-pointer">
                                                                <input type="checkbox" style={{ ...checkboxStyle, marginTop: 2 }} checked={selectedInitiatives.has(i.id)} onChange={() => toggleInitiative(i.id)} />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>{i.initiative}</p>
                                                                    <p className="text-[11px]" style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace' }}>{i.threeP} · {i.owner}</p>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-[11px] italic pl-5" style={{ color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }}>
                                                    Activating this filter will clear milestone selections.
                                                </p>
                                            )}
                                        </div>

                                        {/* Filter by Milestone */}
                                        <div className="px-4 py-3">
                                            <button
                                                className="flex items-center gap-1.5 w-full mb-2"
                                                onClick={() => switchSection('milestone')}
                                            >
                                                {activeSection === 'milestone'
                                                    ? <ChevronDown size={13} style={{ color: 'var(--fg-3)' }} />
                                                    : <ChevronRight size={13} style={{ color: 'var(--fg-4)' }} />}
                                                <span className="text-xs font-semibold" style={{ color: activeSection === 'milestone' ? 'var(--fg-1)' : 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>
                                                    Filter by Milestone
                                                </span>
                                                {activeSection === 'milestone' && milestoneFilterActive && (
                                                    <span className="ml-auto text-[11px]" style={{ color: 'var(--aos-brass)', fontFamily: 'Geist Mono, monospace' }}>
                                                        {selectedMilestones.size}/{ALL_MILESTONE_IDS.length}
                                                    </span>
                                                )}
                                            </button>

                                            {activeSection === 'milestone' ? (
                                                <>
                                                    <div className="flex gap-2 mb-2 pl-5">
                                                        <button className="text-[11px]" style={{ color: 'var(--aos-brass)', fontFamily: 'Geist, sans-serif' }} onClick={() => setSelectedMilestones(new Set(ALL_MILESTONE_IDS))}>All</button>
                                                        <span style={{ color: 'var(--aos-mist)' }}>·</span>
                                                        <button className="text-[11px]" style={{ color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }} onClick={() => setSelectedMilestones(new Set())}>None</button>
                                                    </div>
                                                    <div className="space-y-3 max-h-52 overflow-y-auto pl-5 pr-1">
                                                        {INITIATIVES.map((i) => (
                                                            <div key={i.id}>
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace' }}>{i.initiative}</p>
                                                                <div className="space-y-1.5 pl-2">
                                                                    {i.milestones.map((m) => (
                                                                        <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                                                                            <input type="checkbox" style={{ ...checkboxStyle, marginTop: 2 }} checked={selectedMilestones.has(m.id)} onChange={() => toggleMilestone(m.id)} />
                                                                            <span className="text-xs leading-snug" style={{ color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif' }}>{m.label}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-[11px] italic pl-5" style={{ color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }}>
                                                    Activating this filter will clear initiative selections.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Week axis labels */}
                    <div className="grid pb-2" style={{ gridTemplateColumns: `200px repeat(${SPRINT_WEEKS}, 1fr)` }}>
                        <div />
                        {WEEK_LABELS.map((label, i) => (
                            <div key={i} className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Geist Mono, monospace' }}>
                                {i % 2 === 0 ? label : ''}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bar rows */}
                <div className="divide-y" style={{ borderColor: 'var(--aos-mist)' }}>
                    {visibleInitiatives.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--fg-4)' }}>
                            <Filter size={20} />
                            <p className="text-sm" style={{ fontFamily: 'Geist, sans-serif' }}>No initiatives match the current filter.</p>
                        </div>
                    ) : (
                        visibleInitiatives.map((initiative) => {
                            const visibleMilestones = initiative.milestones.filter((m) => selectedMilestones.has(m.id));
                            if (visibleMilestones.length === 0) return null;

                            return (
                                <div key={initiative.id}>
                                    {/* Initiative group header */}
                                    <div className="px-5 py-2 flex items-center gap-3" style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)' }}>
                                        <span className="text-xs font-semibold" style={{ color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif' }}>
                                            {initiative.initiative}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...(THREE_P_COLORS[initiative.threeP] as React.CSSProperties), fontFamily: 'Geist Mono, monospace' }}>
                                            {initiative.threeP}
                                        </span>
                                        <span className="text-xs ml-auto" style={{ color: 'var(--fg-4)', fontFamily: 'Geist Mono, monospace' }}>
                                            {initiative.owner}
                                        </span>
                                    </div>

                                    {/* Milestone rows */}
                                    {visibleMilestones.map((m) => {
                                        const s = STATUS_STYLES[m.status];
                                        const hasBoth = m.start !== null && m.end !== null;
                                        const hasPartial = m.start !== null && m.end === null;

                                        let leftPct = 0, widthPct = 0;
                                        if (hasBoth) {
                                            const startOff = Math.max(0, toWeekOffset(m.start!));
                                            const endOff = Math.min(SPRINT_WEEKS, toWeekOffset(m.end!));
                                            leftPct = (startOff / SPRINT_WEEKS) * 100;
                                            widthPct = ((endOff - startOff) / SPRINT_WEEKS) * 100;
                                        } else if (hasPartial) {
                                            const startOff = Math.max(0, toWeekOffset(m.start!));
                                            leftPct = (startOff / SPRINT_WEEKS) * 100;
                                            widthPct = 12;
                                        }

                                        return (
                                            <div key={m.id} className="grid items-center px-5 py-2.5" style={{ gridTemplateColumns: '200px 1fr' }}>
                                                <div className="pr-4">
                                                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>{m.label}</p>
                                                </div>

                                                {/* Bar track */}
                                                <div className="relative h-7 rounded" style={{ background: 'var(--bg-sunken)' }}>
                                                    {/* Week grid lines */}
                                                    {WEEK_LABELS.map((_, idx) => (
                                                        <div key={idx} className="absolute top-0 bottom-0 w-px" style={{ left: `${(idx / SPRINT_WEEKS) * 100}%`, background: 'var(--aos-mist)', opacity: 0.5 }} />
                                                    ))}

                                                    {/* Today line */}
                                                    {isInSprint && (
                                                        <div
                                                            className="absolute top-0 bottom-0 z-10"
                                                            style={{ left: `${todayPct}%`, width: 1, borderLeft: '1.5px dotted var(--aos-brass)', opacity: 0.75 }}
                                                        />
                                                    )}

                                                    {/* Duration bar */}
                                                    {hasBoth && (
                                                        <div className="absolute top-1 bottom-1 rounded flex items-center px-2" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%`, ...s.bar }}>
                                                            <span className="text-[10px] font-semibold text-white truncate" style={{ fontFamily: 'Geist Mono, monospace' }}>
                                                                {m.start!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {m.end!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {hasPartial && (
                                                        <div className="absolute top-1 bottom-1 rounded-l flex items-center px-2" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 8)}%`, ...s.bar, borderRight: '2px dashed rgba(255,255,255,0.5)' }}>
                                                            <span className="text-[10px] font-semibold text-white truncate" style={{ fontFamily: 'Geist Mono, monospace' }}>
                                                                {m.start!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →
                                                            </span>
                                                        </div>
                                                    )}

                                                    {!m.start && (
                                                        <div className="absolute inset-0 flex items-center px-3 gap-1.5">
                                                            <AlertCircle size={11} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
                                                            <span className="text-xs italic truncate" style={{ color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }}>
                                                                No dates set — will appear when planning captures start date
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-5 pt-1">
                {(Object.entries(STATUS_STYLES) as [BarStatus, typeof STATUS_STYLES[BarStatus]][]).map(([, s]) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-7 rounded-sm" style={{ ...s.bar }} />
                        <span className="text-xs" style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace' }}>{s.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <AlertCircle size={11} style={{ color: 'var(--fg-4)' }} />
                    <span className="text-xs" style={{ color: 'var(--fg-4)', fontFamily: 'Geist Mono, monospace' }}>Undated</span>
                </div>
                {isInSprint && (
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-0 border-l-[1.5px] border-dotted" style={{ borderColor: 'var(--aos-brass)' }} />
                        <span className="text-xs" style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace' }}>Today</span>
                    </div>
                )}
            </div>

            {/* Wiring note */}
            <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--bg-sunken)', border: '1px dashed var(--aos-mist)', color: 'var(--fg-3)' }}>
                <strong style={{ color: 'var(--fg-2)' }}>Placeholder data.</strong>{' '}
                When wired, bars draw from initiative start dates and projected-completion dates captured in Sprint Planning. Items with missing dates remain visible but marked — the view never breaks on partial data.
            </div>
        </div>
    );
};
