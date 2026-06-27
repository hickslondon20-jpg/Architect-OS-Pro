import React, { useState } from 'react';
import {
    CheckCircle2,
    Circle,
    AlertCircle,
    MonitorPlay,
    Filter,
    ChevronDown,
    LayoutList,
    ListTree,
    Clock,
    ChevronRight,
    MessageSquare
} from 'lucide-react';

const SPRINT_GOAL = "We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.";

// --- Mock Data --- //
const MOCK_MILESTONES = [
    {
        id: 1,
        initiative: "Finalize Standard Operating Procedure Matrix",
        title: "Audit existing SOPs for gaps",
        status: "Complete",
        owner: "Sarah Hicks",
        ownerInitials: "SH",
        ownerStyle: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
        timeframe: "Month 1",
        notes: "Found 12 critical gaps in onboarding flow."
    },
    {
        id: 2,
        initiative: "Finalize Standard Operating Procedure Matrix",
        title: "Draft missing SOP documentation",
        status: "In Progress",
        owner: "Sarah Hicks",
        ownerInitials: "SH",
        ownerStyle: { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)' },
        timeframe: "Month 1",
        notes: "Drafting the client handoff protocol."
    },
    {
        id: 3,
        initiative: "Implement Client Onboarding Playbook",
        title: "Migrate active clients to new portal",
        status: "Blocked",
        owner: "Marcus Webb",
        ownerInitials: "MW",
        ownerStyle: { background: 'var(--aos-risk-tint)', color: 'var(--aos-risk)' },
        timeframe: "Month 2",
        notes: "Waiting on API keys from legacy CRM."
    },
    {
        id: 4,
        initiative: "Deploy updated accountability charts",
        title: "Hold 1:1s to review new roles",
        status: "Not Started",
        owner: "Elena Rostova",
        ownerInitials: "ER",
        ownerStyle: { background: 'var(--aos-warning-tint)', color: 'var(--aos-warning)' },
        timeframe: "Month 2",
        notes: ""
    }
];

export const StatusTracker: React.FC = () => {
    const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
    const [standupMode, setStandupMode] = useState(false);

    const StatusBadge = ({ status }: { status: string }) => {
        const base: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'Geist Mono, monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
        };
        switch (status) {
            case 'Complete':
                return (
                    <span style={{ ...base, background: 'var(--aos-success-tint)', color: 'var(--aos-success)', border: '1px solid var(--aos-success)' }}>
                        <CheckCircle2 size={12} /> Complete
                    </span>
                );
            case 'In Progress':
                return (
                    <span style={{ ...base, background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)', border: '1px solid var(--aos-brass)' }}>
                        <RotateCwIcon /> In Progress
                    </span>
                );
            case 'Blocked':
                return (
                    <span style={{ ...base, background: 'var(--aos-risk-tint)', color: 'var(--aos-risk)', border: '1px solid var(--aos-risk)' }}>
                        <AlertCircle size={12} /> Blocked
                    </span>
                );
            default:
                return (
                    <span style={{ ...base, background: 'var(--bg-sunken)', color: 'var(--fg-3)', border: '1px solid var(--aos-mist)' }}>
                        <Circle size={12} style={{ color: 'var(--fg-4)' }} /> Not Started
                    </span>
                );
        }
    };

    const RotateCwIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
    );

    const filterBtn: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--aos-mist)',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--fg-2)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-soft-1)',
        fontFamily: 'Geist, sans-serif',
    };

    return (
        <div className={`space-y-6 pb-20 ${standupMode ? 'max-w-[1600px] mx-auto' : ''}`}>

            {/* Standup Banner */}
            {standupMode && (
                <div
                    className="flex items-center justify-between p-4 rounded-xl shadow-lg mb-4"
                    style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(184,146,42,0.15)', border: '1px solid rgba(184,146,42,0.3)' }}
                        >
                            <MonitorPlay size={20} style={{ color: 'var(--aos-brass)' }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>Standup Mode Active</h2>
                            <p className="text-sm" style={{ color: 'var(--aos-steel-blue)' }}>Filtering to Month 1 Focus. Details minimized for screen sharing.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setStandupMode(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--fg-on-dark)', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                        Exit Standup
                    </button>
                </div>
            )}

            {!standupMode && (
                <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>
                        Status Tracker
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--fg-3)' }}>
                        The operational heartbeat of your sprint. Update milestones, flag blockers, and run standups.
                    </p>
                </div>
            )}

            {/* Sprint Header Card */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)' }}
            >
                {/* Sprint Goal Banner */}
                <div
                    className="p-4"
                    style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)' }}
                >
                    <p
                        className="text-xs font-bold uppercase tracking-wider mb-1"
                        style={{ color: 'var(--aos-brass)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.08em' }}
                    >
                        Sprint 1 Goal
                    </p>
                    <p className="font-medium" style={{ color: 'var(--fg-1)', fontSize: '14px' }}>{SPRINT_GOAL}</p>
                </div>

                {/* Summary Bar */}
                <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-6 overflow-x-auto">

                    <div className="flex items-center gap-4 min-w-max">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-sunken)" strokeWidth="4" />
                                {/* Progress bar stays obsidian per spec */}
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--aos-obsidian)" strokeWidth="4" strokeDasharray="100" strokeDashoffset="62" />
                            </svg>
                            <span
                                className="absolute text-sm font-bold"
                                style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}
                            >
                                38%
                            </span>
                        </div>
                        <div>
                            <p
                                className="text-xs font-medium uppercase tracking-wider mb-0.5"
                                style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}
                            >
                                Overall Completion
                            </p>
                            <p className="text-sm font-bold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}>
                                16 of 42 Milestones
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-10" style={{ background: 'var(--aos-mist)' }} />

                    <div className="min-w-max">
                        <p
                            className="text-xs font-medium uppercase tracking-wider mb-1"
                            style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}
                        >
                            Initiatives
                        </p>
                        <div className="flex gap-3 text-sm font-medium" style={{ fontFamily: 'Geist Mono, monospace' }}>
                            <span style={{ color: 'var(--aos-brass)' }}>7 Active</span>
                            <span style={{ color: 'var(--aos-mist)' }}>|</span>
                            <span style={{ color: 'var(--aos-success)' }}>1 Complete</span>
                            <span style={{ color: 'var(--aos-mist)' }}>|</span>
                            <span className="font-bold flex items-center gap-1" style={{ color: 'var(--aos-risk)' }}>
                                <AlertCircle size={12} /> 1 Blocked
                            </span>
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-10" style={{ background: 'var(--aos-mist)' }} />

                    <div className="min-w-max">
                        <p
                            className="text-xs font-medium uppercase tracking-wider mb-1"
                            style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}
                        >
                            Pace Assessment
                        </p>
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                            style={{ background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', color: 'var(--fg-2)' }}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--aos-success)' }} />
                            On Track
                            <ChevronDown size={14} style={{ color: 'var(--fg-4)' }} />
                        </button>
                    </div>

                    <div className="hidden md:block w-px h-10" style={{ background: 'var(--aos-mist)' }} />

                    <div className="min-w-max text-right md:text-left">
                        <p
                            className="text-xs font-medium uppercase tracking-wider mb-1"
                            style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}
                        >
                            Sprint Clock
                        </p>
                        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--fg-1)', fontFamily: 'Geist Mono, monospace' }}>
                            <Clock size={16} style={{ color: 'var(--aos-brass)' }} />
                            84 Days Remaining
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & View Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    {['3P Column', 'Initiative', 'Owner', 'Status', 'Timeframe'].map((label) => (
                        <button key={label} style={filterBtn}>
                            {label === '3P Column' && <Filter size={14} style={{ color: 'var(--fg-4)' }} />}
                            {label}
                            <ChevronDown size={14} style={{ color: 'var(--fg-4)' }} />
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div
                        className="flex p-1 rounded-lg"
                        style={{ background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)' }}
                    >
                        {(['flat', 'grouped'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                                style={
                                    viewMode === mode
                                        ? { background: 'var(--bg-surface)', color: 'var(--fg-1)', boxShadow: 'var(--shadow-soft-1)' }
                                        : { color: 'var(--fg-3)' }
                                }
                            >
                                {mode === 'flat' ? <LayoutList size={16} /> : <ListTree size={16} />}
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>

                    {!standupMode && (
                        <button
                            onClick={() => setStandupMode(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ml-auto md:ml-0"
                            style={{
                                background: 'var(--aos-brass-tint)',
                                color: 'var(--aos-brass)',
                                border: '1px solid var(--aos-brass)',
                            }}
                        >
                            <MonitorPlay size={16} />
                            Standup Mode
                        </button>
                    )}
                </div>
            </div>

            {/* Milestone Table */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)' }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)' }}>
                                {!standupMode && (
                                    <th className="p-4 w-12 text-center">
                                        <input type="checkbox" className="rounded" style={{ accentColor: 'var(--aos-brass)' }} />
                                    </th>
                                )}
                                {['Milestone', 'Status', 'Owner', !standupMode ? 'Timeframe' : null, 'Notes'].filter(Boolean).map((h) => (
                                    <th
                                        key={h as string}
                                        className="p-4 text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--fg-3)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em' }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'grouped' && (
                                <tr style={{ background: 'var(--bg-sunken)' }}>
                                    <td
                                        colSpan={standupMode ? 4 : 6}
                                        className="p-3 pl-4"
                                        style={{ borderLeft: '4px solid var(--aos-brass)' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button style={{ color: 'var(--fg-4)' }}>
                                                <ChevronDown size={18} />
                                            </button>
                                            <h3 className="font-bold" style={{ color: 'var(--fg-1)', fontSize: '14px' }}>
                                                Finalize Standard Operating Procedure Matrix
                                            </h3>
                                            <span
                                                className="px-2 py-0.5 text-xs font-bold rounded"
                                                style={{ background: 'var(--aos-mist)', color: 'var(--fg-2)', fontFamily: 'Geist Mono, monospace' }}
                                            >
                                                2/4
                                            </span>
                                            {/* Progress bar — obsidian per spec */}
                                            <div
                                                className="ml-auto w-32 h-2 rounded-full overflow-hidden"
                                                style={{ background: 'var(--aos-mist)' }}
                                            >
                                                <div className="w-1/2 h-full rounded-full" style={{ background: 'var(--aos-obsidian)' }} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {MOCK_MILESTONES.map((milestone) => {
                                const isBlocked = milestone.status === 'Blocked';
                                const isComplete = milestone.status === 'Complete';

                                return (
                                    <tr
                                        key={milestone.id}
                                        className="transition-colors group"
                                        style={isBlocked ? { background: 'rgba(154,91,82,0.04)' } : undefined}
                                        onMouseEnter={(e) => { if (!isBlocked) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-sunken)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isBlocked ? 'rgba(154,91,82,0.04)' : ''; }}
                                    >
                                        {!standupMode && (
                                            <td
                                                className="p-4 text-center"
                                                style={{ borderLeft: `4px solid ${isBlocked ? 'var(--aos-risk)' : 'transparent'}` }}
                                            >
                                                <input type="checkbox" className="rounded" style={{ accentColor: 'var(--aos-brass)' }} />
                                            </td>
                                        )}
                                        <td
                                            className="p-4"
                                            style={standupMode ? { borderLeft: `4px solid ${isBlocked ? 'var(--aos-risk)' : 'transparent'}` } : undefined}
                                        >
                                            <div className={viewMode === 'grouped' ? 'pl-8' : ''}>
                                                {viewMode === 'flat' && (
                                                    <p className="text-xs font-medium mb-1 line-clamp-1" style={{ color: 'var(--fg-3)' }}>
                                                        {milestone.initiative}
                                                    </p>
                                                )}
                                                <button
                                                    className="font-medium text-left transition-colors"
                                                    style={{ color: isComplete ? 'var(--fg-4)' : 'var(--fg-1)', textDecoration: isComplete ? 'line-through' : 'none', fontSize: '14px' }}
                                                >
                                                    {milestone.title}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 w-48">
                                            <StatusBadge status={milestone.status} />
                                        </td>
                                        <td className="p-4 w-48">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                    style={milestone.ownerStyle}
                                                >
                                                    {milestone.ownerInitials}
                                                </div>
                                                <span className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>
                                                    {milestone.owner}
                                                </span>
                                            </div>
                                        </td>
                                        {!standupMode && (
                                            <td className="p-4 w-32">
                                                <span
                                                    className="text-sm font-medium px-2 py-1 rounded"
                                                    style={{ background: 'var(--bg-sunken)', color: 'var(--fg-2)', fontFamily: 'Geist Mono, monospace' }}
                                                >
                                                    {milestone.timeframe}
                                                </span>
                                            </td>
                                        )}
                                        <td className="p-4">
                                            <div className="relative flex items-center group/note">
                                                {milestone.notes ? (
                                                    <p
                                                        className="text-sm line-clamp-1 flex-1 cursor-text rounded px-1 -mx-1 py-0.5 transition-colors"
                                                        style={{ color: 'var(--fg-2)' }}
                                                    >
                                                        {milestone.notes}
                                                    </p>
                                                ) : (
                                                    <p
                                                        className="text-sm italic flex-1 cursor-text rounded px-1 -mx-1 py-0.5 transition-colors"
                                                        style={{ color: 'var(--fg-4)' }}
                                                    >
                                                        Add a note...
                                                    </p>
                                                )}
                                                <MessageSquare size={14} className="opacity-0 group-hover/note:opacity-100 transition-opacity ml-2 shrink-0" style={{ color: 'var(--fg-4)' }} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
