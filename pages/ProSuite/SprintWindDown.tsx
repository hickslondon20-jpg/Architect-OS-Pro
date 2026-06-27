import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, X, GripVertical, Filter, LayoutList, ListTree } from 'lucide-react';

// "Looking Ahead" forward-seeding questions relocated to Retrospective.tsx (Handoff #12, 2026-06-20).
// See docs/execution-hub-audit-inventory.md — relocation complete.

// ─── Types ──────────────────────────────────────────────────────────────────

type Decision = 'Complete' | 'Roll Over' | 'Release';
type Bucket = 'Prioritize' | 'Plant' | 'Iterate';
type MilestoneStatus = 'Complete' | 'In Progress' | 'Not Started' | 'Blocked';

interface Milestone {
    id: string;
    title: string;
    status: MilestoneStatus;
    owner: string;
    timeframe: string;
}

interface Initiative {
    id: string;
    title: string;
    bucket: Bucket;
    capability: string;
    ownerInitials: string;
    ownerName: string;
    progress: { done: number; total: number };
    milestones: Milestone[];
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const SPRINT_GOAL = 'We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.';

const SUPPORTING_GOALS = [
    'Delivery team executes client work without founder intervention on routine decisions.',
    'All onboarding milestones run on documented SOPs, not tribal knowledge.',
];

const MOCK_INITIATIVES: Initiative[] = [
    {
        id: 'i1',
        title: 'Draft standard operating procedures for onboarding',
        bucket: 'Prioritize',
        capability: 'Delivery Architecture',
        ownerInitials: 'TL',
        ownerName: 'Tech Lead',
        progress: { done: 3, total: 5 },
        milestones: [
            { id: 'm1', title: 'Outline core process steps', status: 'Complete', owner: 'TL', timeframe: 'Month 1' },
            { id: 'm2', title: 'Draft phase 1 documentation', status: 'In Progress', owner: 'TL', timeframe: 'Month 1' },
            { id: 'm3', title: 'Review with team', status: 'Not Started', owner: 'TL', timeframe: 'Month 2' },
            { id: 'm4', title: 'Pilot with new client', status: 'Not Started', owner: 'SJ', timeframe: 'Month 3' },
            { id: 'm5', title: 'Finalize and document', status: 'Not Started', owner: 'TL', timeframe: 'Month 3' },
        ],
    },
    {
        id: 'i2',
        title: 'Redesign client intake form',
        bucket: 'Prioritize',
        capability: 'Client Experience',
        ownerInitials: 'SJ',
        ownerName: 'Sarah J.',
        progress: { done: 3, total: 3 },
        milestones: [
            { id: 'm6', title: 'Map current intake flow', status: 'Complete', owner: 'SJ', timeframe: 'Month 1' },
            { id: 'm7', title: 'Design new form', status: 'Complete', owner: 'SJ', timeframe: 'Month 2' },
            { id: 'm8', title: 'Test with 3 clients', status: 'Complete', owner: 'SJ', timeframe: 'Month 2' },
        ],
    },
    {
        id: 'i3',
        title: 'Implement automated reporting dashboard',
        bucket: 'Plant',
        capability: 'Financial Operations',
        ownerInitials: 'FD',
        ownerName: 'Founder',
        progress: { done: 1, total: 4 },
        milestones: [
            { id: 'm9', title: 'Define key metrics and data sources', status: 'In Progress', owner: 'FD', timeframe: 'Month 2' },
            { id: 'm10', title: 'Select reporting tool', status: 'Not Started', owner: 'FD', timeframe: 'Month 3' },
            { id: 'm11', title: 'Build and populate dashboard', status: 'Not Started', owner: 'FD', timeframe: 'Month 3' },
            { id: 'm12', title: 'Deploy and train team', status: 'Not Started', owner: 'TL', timeframe: 'Month 3' },
        ],
    },
    {
        id: 'i4',
        title: 'Market footprint research — target segment analysis',
        bucket: 'Plant',
        capability: 'Market Footprint',
        ownerInitials: 'SJ',
        ownerName: 'Sarah J.',
        progress: { done: 0, total: 3 },
        milestones: [
            { id: 'm13', title: 'Identify 5 target segments', status: 'Not Started', owner: 'SJ', timeframe: 'Month 3' },
            { id: 'm14', title: 'Competitive positioning analysis', status: 'Not Started', owner: 'SJ', timeframe: 'Month 3' },
            { id: 'm15', title: 'Document findings and recommendations', status: 'Not Started', owner: 'SJ', timeframe: 'Month 3' },
        ],
    },
    {
        id: 'i5',
        title: 'Leadership cadence retune',
        bucket: 'Iterate',
        capability: 'Leadership Cadence',
        ownerInitials: 'FD',
        ownerName: 'Founder',
        progress: { done: 2, total: 4 },
        milestones: [
            { id: 'm16', title: 'Audit current meeting rhythm', status: 'Complete', owner: 'FD', timeframe: 'Month 1' },
            { id: 'm17', title: 'Design new weekly cadence', status: 'Complete', owner: 'FD', timeframe: 'Month 2' },
            { id: 'm18', title: 'Run for 4 weeks and gather feedback', status: 'Not Started', owner: 'FD', timeframe: 'Month 2' },
            { id: 'm19', title: 'Evaluate and finalize structure', status: 'Not Started', owner: 'FD', timeframe: 'Month 3' },
        ],
    },
];

const BUCKETS: Bucket[] = ['Prioritize', 'Plant', 'Iterate'];

// ─── Style helpers ───────────────────────────────────────────────────────────

const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    fontFamily: "'Geist Mono', monospace",
    whiteSpace: 'nowrap' as const,
};

const BUCKET_CHIP: Record<Bucket, React.CSSProperties> = {
    Prioritize: { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' },
    Plant: { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)' },
    Iterate: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
};

const DECISION_IDLE: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--aos-mist)',
    background: 'var(--bg-surface)',
    color: 'var(--fg-3)',
    fontFamily: 'Geist, sans-serif',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
};

const DECISION_ACTIVE: Record<Decision, React.CSSProperties> = {
    Complete: { ...DECISION_IDLE, background: 'var(--aos-success-tint)', color: 'var(--aos-success)', border: '1px solid var(--aos-success)' },
    'Roll Over': { ...DECISION_IDLE, background: 'var(--aos-warning-tint)', color: 'var(--aos-warning)', border: '1px solid var(--aos-warning)' },
    Release: { ...DECISION_IDLE, background: 'var(--aos-risk-tint)', color: 'var(--aos-risk)', border: '1px solid var(--aos-risk)' },
};

const STATUS_CHIP: Record<MilestoneStatus, React.CSSProperties> = {
    Complete: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)', border: '1px solid var(--aos-success)' },
    'In Progress': { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)', border: '1px solid var(--aos-brass)' },
    Blocked: { background: 'var(--aos-risk-tint)', color: 'var(--aos-risk)', border: '1px solid var(--aos-risk)' },
    'Not Started': { background: 'var(--bg-sunken)', color: 'var(--fg-3)', border: '1px solid var(--aos-mist)' },
};

const MsStatusIcon: React.FC<{ status: MilestoneStatus }> = ({ status }) => {
    if (status === 'Complete') return <CheckCircle2 size={13} style={{ color: 'var(--aos-success)', flexShrink: 0 }} />;
    if (status === 'Blocked') return <AlertCircle size={13} style={{ color: 'var(--aos-risk)', flexShrink: 0 }} />;
    if (status === 'In Progress') return <Circle size={13} style={{ color: 'var(--aos-brass)', flexShrink: 0 }} />;
    return <Circle size={13} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />;
};

// ─── Bulk Grid Modal (Operate bulk-update workspace) ─────────────────────────

const BulkGridModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const allMilestones = MOCK_INITIATIVES.flatMap(init =>
        init.milestones.map(m => ({ ...m, initiative: init.title, bucket: init.bucket }))
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(25,48,82,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: '0 8px 40px rgba(25,48,82,0.18)', width: '100%', maxWidth: 1200 }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--aos-mist)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 4 }}>Operate · Bulk Update</p>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>Sprint 1 — Milestone Status Grid</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Filter row */}
                <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--aos-mist)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-sunken)' }}>
                    {['3P Column', 'Initiative', 'Owner', 'Status', 'Timeframe'].map(f => (
                        <button key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 5, fontSize: 12, fontWeight: 500, color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                            <Filter size={11} /> {f} <ChevronDown size={11} />
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {[{ label: 'Flat', Icon: LayoutList }, { label: 'Grouped', Icon: ListTree }].map(({ label, Icon }, i) => (
                            <button key={label} style={{ padding: '5px 10px', background: i === 0 ? 'var(--bg-inverse)' : 'var(--bg-surface)', color: i === 0 ? 'var(--fg-on-dark)' : 'var(--fg-3)', border: '1px solid var(--aos-mist)', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Geist, sans-serif' }}>
                                <Icon size={12} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Geist, sans-serif' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)' }}>
                                {['', 'Milestone', 'Initiative', 'Status', 'Owner', 'Timeframe', 'Notes'].map((h, i) => (
                                    <th key={i} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', textAlign: 'left', whiteSpace: 'nowrap', fontFamily: "'Geist Mono', monospace" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allMilestones.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid var(--aos-mist)' }}>
                                    <td style={{ padding: '11px 14px', width: 32 }}><input type="checkbox" /></td>
                                    <td style={{ padding: '11px 14px', minWidth: 200 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <MsStatusIcon status={m.status} />
                                            <span style={{ fontWeight: 500, color: 'var(--fg-1)' }}>{m.title}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '11px 14px', minWidth: 180 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ ...chipBase, ...BUCKET_CHIP[m.bucket], fontSize: 10, alignSelf: 'flex-start' }}>{m.bucket}</span>
                                            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{m.initiative.length > 38 ? m.initiative.slice(0, 38) + '…' : m.initiative}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '11px 14px' }}><span style={{ ...chipBase, ...STATUS_CHIP[m.status] }}>{m.status}</span></td>
                                    <td style={{ padding: '11px 14px' }}>
                                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace" }}>{m.owner}</span>
                                    </td>
                                    <td style={{ padding: '11px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{m.timeframe}</td>
                                    <td style={{ padding: '11px 14px', color: 'var(--fg-4)', fontSize: 12, fontStyle: 'italic', minWidth: 160 }}>Add a note…</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--aos-mist)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Done</button>
                </div>
            </div>
        </div>
    );
};

// ─── Initiative Record Modal (Planning workspace single-initiative pop-up) ────

const InitiativeRecordModal: React.FC<{
    initiative: Initiative;
    note: string;
    onNoteChange: (n: string) => void;
    decision: Decision | undefined;
    onClose: () => void;
}> = ({ initiative, note, onNoteChange, decision, onClose }) => {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(25,48,82,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: '0 8px 40px rgba(25,48,82,0.18)', width: '100%', maxWidth: 900 }}>
                {/* Breadcrumb */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--aos-mist)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>
                        <span style={{ ...chipBase, ...BUCKET_CHIP[initiative.bucket], fontSize: 10 }}>{initiative.bucket}</span>
                        <ChevronRight size={14} />
                        <span style={{ fontWeight: 500, color: 'var(--fg-2)' }}>{initiative.capability}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px' }}>
                    {/* Left */}
                    <div style={{ padding: '24px', borderRight: '1px solid var(--aos-mist)' }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 20, lineHeight: 1.35, fontFamily: 'Geist, sans-serif' }}>{initiative.title}</h2>

                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 10 }}>Milestones</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                            {initiative.milestones.map(m => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-sunken)', borderRadius: 8, border: '1px solid var(--aos-mist)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <MsStatusIcon status={m.status} />
                                        <span style={{ fontSize: 13, fontWeight: 500, color: m.status === 'Complete' ? 'var(--fg-4)' : 'var(--fg-1)', textDecoration: m.status === 'Complete' ? 'line-through' : 'none', fontFamily: 'Geist, sans-serif' }}>{m.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--fg-4)' }}>{m.timeframe}</span>
                                        <span style={{ ...chipBase, ...STATUS_CHIP[m.status], fontSize: 10 }}>{m.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 8 }}>Rollover note</p>
                        <textarea
                            value={note}
                            onChange={e => onNoteChange(e.target.value)}
                            placeholder="What to carry forward, what got in the way, where it lands next sprint…"
                            style={{ width: '100%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 8, padding: '11px 13px', fontSize: 14, color: 'var(--fg-1)', minHeight: 88, resize: 'none', boxSizing: 'border-box', fontFamily: 'Geist, sans-serif', outline: 'none' }}
                        />
                    </div>

                    {/* Right — metadata */}
                    <div style={{ padding: '24px', background: 'var(--bg-sunken)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {([
                            { label: '3P Bucket', value: <span style={{ ...chipBase, ...BUCKET_CHIP[initiative.bucket] }}>{initiative.bucket}</span> },
                            { label: 'Capability', value: <span style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 500, fontFamily: 'Geist, sans-serif' }}>{initiative.capability}</span> },
                            {
                                label: 'Owner', value: (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace" }}>{initiative.ownerInitials}</span>
                                        <span style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 500, fontFamily: 'Geist, sans-serif' }}>{initiative.ownerName}</span>
                                    </div>
                                )
                            },
                            {
                                label: 'Progress', value: (
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>
                                        {initiative.progress.done}<span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>/{initiative.progress.total}</span>
                                        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 5 }}>milestones</span>
                                    </span>
                                )
                            },
                            {
                                label: 'Wind-down decision', value: decision
                                    ? <span style={{ ...chipBase, ...DECISION_ACTIVE[decision] }}>{decision}</span>
                                    : <span style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic', fontFamily: 'Geist, sans-serif' }}>Not set</span>
                            },
                        ] as { label: string; value: React.ReactNode }[]).map(({ label, value }) => (
                            <div key={label}>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 6, fontFamily: "'Geist Mono', monospace" }}>{label}</p>
                                {value}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '13px 24px', borderTop: '1px solid var(--aos-mist)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────────────

export const SprintWindDown: React.FC = () => {
    const [decisions, setDecisions] = useState<Record<string, Decision>>({
        i1: 'Complete',
        i2: 'Complete',
        i3: 'Roll Over',
        i4: 'Roll Over',
    });
    const [expanded, setExpanded] = useState<string | null>(null);
    const [milestoneStatuses, setMilestoneStatuses] = useState<Record<string, MilestoneStatus>>({});
    const [showBulkGrid, setShowBulkGrid] = useState(false);
    const [recordModal, setRecordModal] = useState<string | null>(null);
    // null = unassigned (holding zone); Bucket = placed in a column
    const [carryPositions, setCarryPositions] = useState<Record<string, Bucket | null>>({});
    const [dragOver, setDragOver] = useState<Bucket | 'staging' | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [cardNotes, setCardNotes] = useState<Record<string, string>>({});

    // ── Decision handling ──────────────────────────────────────────────────

    const handleDecision = (id: string, d: Decision) => {
        setDecisions(prev => ({ ...prev, [id]: d }));
        if (d === 'Roll Over') {
            // land in holding zone (null) unless already placed
            setCarryPositions(prev => ({ ...prev, [id]: prev[id] !== undefined ? prev[id] : null }));
        } else {
            setCarryPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const getMsStatus = (msId: string, defaultStatus: MilestoneStatus): MilestoneStatus =>
        milestoneStatuses[msId] ?? defaultStatus;

    const setMsStatus = (msId: string, status: MilestoneStatus) =>
        setMilestoneStatuses(prev => ({ ...prev, [msId]: status }));

    // ── DnD ───────────────────────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        setDragging(id);
    };

    const handleDragEnd = () => { setDragging(null); setDragOver(null); };

    const handleDragOver = (e: React.DragEvent, target: Bucket | 'staging') => {
        e.preventDefault();
        setDragOver(target);
    };

    const handleDrop = (e: React.DragEvent, target: Bucket | 'staging') => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) setCarryPositions(prev => ({ ...prev, [id]: target === 'staging' ? null : target }));
        setDragging(null);
        setDragOver(null);
    };

    // ── Computed values ────────────────────────────────────────────────────

    const decidedCount = Object.keys(decisions).length;
    const counts = {
        complete: Object.values(decisions).filter(d => d === 'Complete').length,
        rollover: Object.values(decisions).filter(d => d === 'Roll Over').length,
        release: Object.values(decisions).filter(d => d === 'Release').length,
        undecided: MOCK_INITIATIVES.length - decidedCount,
    };

    const rolledOver = MOCK_INITIATIVES.filter(i => decisions[i.id] === 'Roll Over');
    // staging = no bucket assigned yet (carryPositions[id] is null or undefined)
    const inStaging = rolledOver.filter(i => !carryPositions[i.id]);
    const inBucket = (b: Bucket) => rolledOver.filter(i => carryPositions[i.id] === b);

    const recordInit = recordModal ? MOCK_INITIATIVES.find(i => i.id === recordModal) ?? null : null;

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Sprint goal + supporting goals ─────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: 4, background: 'var(--aos-brass)', flexShrink: 0 }} />
                    <div style={{ padding: '18px 22px', flex: 1 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 6 }}>Sprint 1 · Primary goal</p>
                        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.5, fontFamily: 'Geist, sans-serif', maxWidth: 800 }}>{SPRINT_GOAL}</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {(SUPPORTING_GOALS.length > 0 ? SUPPORTING_GOALS.slice(0, 2) : ['N/A', 'N/A']).map((goal, i) => (
                        <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--aos-mist)', padding: '14px 18px' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 5 }}>Supporting goal {i + 1}</p>
                            <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>{goal}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Two-panel cockpit ──────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

                {/* ── LEFT: Completion decisions ─────────────────────────── */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--aos-mist)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sunken)' }}>
                        <div>
                            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif' }}>Completion decisions</p>
                            <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'Geist, sans-serif' }}>Mark each initiative Complete, Roll Over, or Release.</p>
                        </div>
                        <button
                            onClick={() => setShowBulkGrid(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'Geist, sans-serif', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}
                        >
                            <LayoutList size={14} /> View full grid
                        </button>
                    </div>

                    {BUCKETS.map(bucket => {
                        const inits = MOCK_INITIATIVES.filter(i => i.bucket === bucket);
                        return (
                            <div key={bucket} style={{ borderBottom: '1px solid var(--aos-mist)' }}>
                                <div style={{ padding: '7px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ ...chipBase, ...BUCKET_CHIP[bucket] }}>{bucket}</span>
                                    <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: "'Geist Mono', monospace" }}>{inits.length}</span>
                                </div>

                                {inits.map(init => {
                                    const isExp = expanded === init.id;
                                    const d = decisions[init.id];
                                    return (
                                        <div key={init.id} style={{ borderTop: '1px solid var(--aos-mist)' }}>
                                            {/* Row */}
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', background: isExp ? 'var(--bg-sunken)' : 'transparent' }}
                                                onClick={() => setExpanded(isExp ? null : init.id)}
                                            >
                                                <div style={{ color: 'var(--fg-4)', flexShrink: 0 }}>
                                                    {isExp ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{init.title}</p>
                                                    <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>{init.capability}</p>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--fg-2)' }}>
                                                        {init.progress.done}<span style={{ fontWeight: 400, color: 'var(--fg-4)' }}>/{init.progress.total}</span>
                                                    </span>
                                                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{init.ownerInitials}</span>
                                                </div>

                                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                    {(['Complete', 'Roll Over', 'Release'] as Decision[]).map(opt => (
                                                        <button key={opt} style={d === opt ? DECISION_ACTIVE[opt] : DECISION_IDLE} onClick={() => handleDecision(init.id, opt)}>
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Expanded milestone update */}
                                            {isExp && (
                                                <div style={{ padding: '4px 16px 12px 44px', background: 'var(--bg-sunken)', borderTop: '1px solid var(--aos-mist)' }}>
                                                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", margin: '10px 0' }}>Milestone status</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                        {init.milestones.map(m => {
                                                            const ms = getMsStatus(m.id, m.status);
                                                            return (
                                                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 7, border: '1px solid var(--aos-mist)' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                                        <MsStatusIcon status={ms} />
                                                                        <span style={{ fontSize: 13, color: ms === 'Complete' ? 'var(--fg-4)' : 'var(--fg-1)', fontWeight: 500, fontFamily: 'Geist, sans-serif', textDecoration: ms === 'Complete' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                                                                    </div>
                                                                    <select
                                                                        value={ms}
                                                                        onChange={e => setMsStatus(m.id, e.target.value as MilestoneStatus)}
                                                                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)', color: 'var(--fg-2)', cursor: 'pointer', fontFamily: "'Geist Mono', monospace", outline: 'none', flexShrink: 0, marginLeft: 8 }}
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        {(['Not Started', 'In Progress', 'Complete', 'Blocked'] as MilestoneStatus[]).map(s => (
                                                                            <option key={s} value={s}>{s}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* ── RIGHT: Carry-forward ───────────────────────────────── */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                    {/* Panel header */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)' }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>Carry forward</p>
                        <p style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>
                            Staged initiatives land in the queue below. Drag each into the bucket you expect it to land in next sprint — directional only, not binding.
                        </p>
                    </div>

                    {rolledOver.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <p style={{ fontSize: 13, color: 'var(--fg-4)', fontStyle: 'italic', fontFamily: 'Geist, sans-serif', lineHeight: 1.6 }}>Mark initiatives as Roll Over on the left to stage them here.</p>
                        </div>
                    ) : (
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                            {/* ── Holding zone ──────────────────────────────── */}
                            <div
                                onDragOver={e => handleDragOver(e, 'staging')}
                                onDrop={e => handleDrop(e, 'staging')}
                                onDragLeave={() => { if (dragOver === 'staging') setDragOver(null); }}
                                style={{
                                    borderRadius: 8,
                                    border: dragOver === 'staging' ? '2px solid var(--aos-brass)' : '1px solid var(--aos-mist)',
                                    background: dragOver === 'staging' ? 'var(--aos-brass-tint)' : 'var(--bg-sunken)',
                                    padding: '10px 12px',
                                    transition: 'all 0.15s',
                                    minHeight: 56,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: inStaging.length > 0 ? 8 : 0 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace" }}>
                                        Queued for next sprint
                                    </p>
                                    {inStaging.length > 0 && (
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--fg-4)' }}>{inStaging.length}</span>
                                    )}
                                </div>

                                {inStaging.length === 0 ? (
                                    <p style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', fontFamily: 'Geist, sans-serif' }}>
                                        {rolledOver.length > 0 ? 'All staged — drag back here to unassign.' : 'Items will appear here when marked Roll Over.'}
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {inStaging.map(init => (
                                            <div
                                                key={init.id}
                                                draggable
                                                onDragStart={e => handleDragStart(e, init.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setRecordModal(init.id)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    background: 'var(--bg-surface)', borderRadius: 6,
                                                    border: '1px solid var(--aos-mist)', padding: '5px 9px',
                                                    cursor: 'grab', opacity: dragging === init.id ? 0.4 : 1,
                                                    boxShadow: 'var(--shadow-soft-1)', transition: 'opacity 0.15s',
                                                    maxWidth: '100%',
                                                }}
                                            >
                                                <GripVertical size={11} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
                                                <span style={{ ...chipBase, ...BUCKET_CHIP[init.bucket], fontSize: 9 }}>{init.bucket}</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{init.title}</span>
                                                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{init.ownerInitials}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Bucket columns ────────────────────────────── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                {BUCKETS.map(bucket => {
                                    const cards = inBucket(bucket);
                                    const isOver = dragOver === bucket;
                                    return (
                                        <div
                                            key={bucket}
                                            onDragOver={e => handleDragOver(e, bucket)}
                                            onDrop={e => handleDrop(e, bucket)}
                                            onDragLeave={() => { if (dragOver === bucket) setDragOver(null); }}
                                            style={{ borderRadius: 8, border: isOver ? '2px solid var(--aos-brass)' : '2px dashed var(--aos-mist)', background: isOver ? 'var(--aos-brass-tint)' : 'var(--bg-sunken)', minHeight: 90, transition: 'all 0.15s', padding: '8px 7px' }}
                                        >
                                            <div style={{ marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ ...chipBase, ...BUCKET_CHIP[bucket], fontSize: 9 }}>{bucket}</span>
                                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--fg-4)' }}>{cards.length}</span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {cards.map(init => (
                                                    <div
                                                        key={init.id}
                                                        draggable
                                                        onDragStart={e => handleDragStart(e, init.id)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={() => setRecordModal(init.id)}
                                                        style={{ background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--aos-mist)', padding: '7px 8px', cursor: 'grab', opacity: dragging === init.id ? 0.4 : 1, boxShadow: 'var(--shadow-soft-1)', transition: 'opacity 0.15s' }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                                                            <GripVertical size={11} style={{ color: 'var(--fg-4)', flexShrink: 0, marginTop: 2 }} />
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.35, fontFamily: 'Geist, sans-serif', marginBottom: 3 }}>{init.title}</p>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                                                                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{init.capability}</span>
                                                                    <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{init.ownerInitials}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {cards.length === 0 && (
                                                    <p style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic', textAlign: 'center', padding: '10px 4px', fontFamily: 'Geist, sans-serif' }}>Drop here</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Finalize (earned navy moment) ──────────────────────────── */}
            <div style={{ background: 'var(--bg-inverse)', borderRadius: 14, padding: '32px 40px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 16 }}>Finalize · Sprint 1</p>

                <div style={{ display: 'flex', gap: 32, marginBottom: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {[
                        { label: 'Completing', count: counts.complete, color: 'var(--aos-success)' },
                        { label: 'Rolling over', count: counts.rollover, color: 'var(--aos-warning)' },
                        { label: 'Releasing', count: counts.release, color: 'var(--aos-risk)' },
                        { label: 'Undecided', count: counts.undecided, color: 'rgba(252,251,248,0.5)' },
                    ].map(({ label, count, color }) => (
                        <div key={label}>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{count}</p>
                            <p style={{ fontSize: 12, color: 'rgba(252,251,248,0.5)', marginTop: 4, fontFamily: 'Geist, sans-serif' }}>{label}</p>
                        </div>
                    ))}
                    <div style={{ borderLeft: '1px solid rgba(252,251,248,0.12)', paddingLeft: 32, marginLeft: 4 }}>
                        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 30, fontWeight: 700, color: 'var(--fg-on-dark)', lineHeight: 1 }}>{MOCK_INITIATIVES.length}</p>
                        <p style={{ fontSize: 12, color: 'rgba(252,251,248,0.5)', marginTop: 4, fontFamily: 'Geist, sans-serif' }}>Total</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button style={{ padding: '11px 28px', background: 'transparent', border: '1px solid rgba(252,251,248,0.25)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--fg-on-dark)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                        Save progress
                    </button>
                    <button
                        disabled={counts.undecided > 0}
                        style={{ padding: '11px 28px', background: counts.undecided > 0 ? 'rgba(184,146,42,0.3)' : 'var(--aos-brass)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: counts.undecided > 0 ? 'rgba(252,251,248,0.35)' : '#fff', cursor: counts.undecided > 0 ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif' }}
                    >
                        Lock &amp; Complete
                    </button>
                    {counts.undecided > 0 && (
                        <p style={{ fontSize: 12, color: 'rgba(252,251,248,0.45)', fontFamily: 'Geist, sans-serif' }}>
                            {counts.undecided} initiative{counts.undecided !== 1 ? 's' : ''} still need{counts.undecided === 1 ? 's' : ''} a decision.
                        </p>
                    )}
                </div>
            </div>

            {/* ── Modals ─────────────────────────────────────────────────── */}
            {showBulkGrid && <BulkGridModal onClose={() => setShowBulkGrid(false)} />}
            {recordInit && (
                <InitiativeRecordModal
                    initiative={recordInit}
                    note={cardNotes[recordInit.id] ?? ''}
                    onNoteChange={n => setCardNotes(prev => ({ ...prev, [recordInit.id]: n }))}
                    decision={decisions[recordInit.id]}
                    onClose={() => setRecordModal(null)}
                />
            )}
        </div>
    );
};
