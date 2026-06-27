import React, { useState } from 'react';
import { BookOpen, Clock, ArrowRight, Sparkles } from 'lucide-react';

// "Looking Ahead" forward-seeding questions relocated here from SprintWindDown.tsx (Handoff #12, 2026-06-20).
// Previously parked as a comment in SprintWindDown.tsx after Handoff #11.
// See docs/execution-hub-audit-inventory.md — relocation now complete.
const LOOKING_AHEAD_PROMPTS = [
    'What surprised you most this sprint — what went better or harder than expected?',
    'Which capability area ended up needing more attention than you gave it?',
    'If you were starting the sprint over, what would you classify differently?',
];

// ─── Mock data ───────────────────────────────────────────────────────────────

const SPRINT_GOAL = 'We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.';

const SUPPORTING_GOALS = [
    'Delivery team executes client work without founder intervention on routine decisions.',
    'All onboarding milestones run on documented SOPs, not tribal knowledge.',
];

const MOCK_TEAM = [
    {
        initials: 'TL',
        name: 'Tech Lead',
        initiatives: 2,
        milestonesTagged: 9,
        milestonesComplete: 8,
        synthesis: 'Delivered the full SOP library on schedule and led the onboarding pilot with the first new client. The milestone completion rate here was the highest on the team, and the documentation quality set a new standard for the project.',
    },
    {
        initials: 'SJ',
        name: 'Sarah J.',
        initiatives: 2,
        milestonesTagged: 5,
        milestonesComplete: 3,
        synthesis: 'Drove the client intake redesign from mapping through testing in a single sprint, and initiated the market segment research. The intake form work is already reducing friction in onboarding calls based on initial feedback.',
    },
    {
        initials: 'FD',
        name: 'Founder',
        initiatives: 2,
        milestonesTagged: 8,
        milestonesComplete: 3,
        synthesis: 'Held the leadership cadence work while simultaneously running point on the reporting dashboard. The deliberate decision to roll over the dashboard to protect the delivery floor focus was the right tradeoff given where the team was.',
    },
];

const CAPABILITY_FOCUS = [
    { name: 'Delivery Architecture', bucket: 'Prioritize', note: 'Primary focus; SOPs and onboarding documentation delivered.' },
    { name: 'Client Experience', bucket: 'Prioritize', note: 'Intake form redesigned and tested with 3 clients.' },
    { name: 'Financial Operations', bucket: 'Plant', note: 'Reporting dashboard started; rolled over to maintain delivery focus.' },
    { name: 'Leadership Cadence', bucket: 'Iterate', note: 'Cadence audit and redesign completed; evaluation phase ahead.' },
];

const QUALITATIVE_OUTCOMES = [
    'Delivery team is running client work without daily founder check-ins for the first time.',
    'Onboarding process is now documented — new clients can be onboarded without tribal knowledge.',
    'Leadership meeting structure is cleaner; decisions are happening faster in standups.',
];

type GoalStatus = 'Yes' | 'Partially' | 'We Learned';

// ─── Style helpers ───────────────────────────────────────────────────────────

const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    fontFamily: "'Geist Mono', monospace",
    whiteSpace: 'nowrap' as const,
};

const BUCKET_CHIP: Record<string, React.CSSProperties> = {
    Prioritize: { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' },
    Plant: { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)' },
    Iterate: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
};

const GOAL_STATUS_STYLE: Record<GoalStatus, React.CSSProperties> = {
    Yes: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)', border: '1px solid var(--aos-success)' },
    Partially: { background: 'var(--aos-warning-tint)', color: 'var(--aos-warning)', border: '1px solid var(--aos-warning)' },
    'We Learned': { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)', border: '1px solid var(--aos-insight)' },
};

const GOAL_IDLE: React.CSSProperties = {
    padding: '4px 11px',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--aos-mist)',
    background: 'var(--bg-surface)',
    color: 'var(--fg-3)',
    fontFamily: 'Geist, sans-serif',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
};

const SSC_CONFIG = [
    { key: 'start', label: 'Start', prompt: 'What should you begin doing next sprint that you weren\'t doing this one?', color: 'var(--aos-success)', tint: 'var(--aos-success-tint)' },
    { key: 'stop', label: 'Stop', prompt: 'What slowed you down, created friction, or isn\'t serving the work anymore?', color: 'var(--aos-risk)', tint: 'var(--aos-risk-tint)' },
    { key: 'continue', label: 'Continue', prompt: 'What worked well and should carry into the next sprint without change?', color: 'var(--aos-insight)', tint: 'var(--aos-insight-tint)' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const Retrospective: React.FC = () => {
    const [goalStatus, setGoalStatus] = useState<Record<number, GoalStatus>>({ 0: 'Yes' });
    const [sscText, setSscText] = useState<Record<string, string>>({});
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [locked, setLocked] = useState(false);
    const [view, setView] = useState<'current' | 'historic'>('current');

    const handleLock = () => setLocked(true);

    return (
        <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Current / Historic toggle ─────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 8, padding: 4 }}>
                    {(['current', 'historic'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: 'none',
                                background: view === v ? 'var(--bg-inverse)' : 'transparent',
                                color: view === v ? 'var(--fg-on-dark)' : 'var(--fg-3)',
                                fontFamily: 'Geist, sans-serif',
                                transition: 'all 0.15s',
                                textTransform: 'capitalize' as const,
                            }}
                        >
                            {v === 'current' ? 'Sprint 1' : 'Archive'}
                        </button>
                    ))}
                </div>
                {!locked && (
                    <p style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic', fontFamily: 'Geist, sans-serif' }}>
                        Required: Start · Stop · Continue — everything else is optional.
                    </p>
                )}
                {locked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...chipBase, background: 'var(--aos-success-tint)', color: 'var(--aos-success)', fontSize: 10 }}>Approved</span>
                        <span style={{ fontSize: 12, color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif' }}>Sprint 1 retro locked</span>
                    </div>
                )}
            </div>

            {/* ── Historic shell ────────────────────────────────────────── */}
            {view === 'historic' && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', padding: '64px 40px', textAlign: 'center', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Clock size={20} style={{ color: 'var(--fg-4)' }} />
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif', marginBottom: 8 }}>No archived retrospectives yet</p>
                    <p style={{ fontSize: 13, color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
                        Locked retrospective memos will appear here once Sprint 1 is approved. You'll be able to browse and download past retros as a record of how your agency evolved.
                    </p>
                </div>
            )}

            {view === 'current' && (<>

            {/* ── 1. Goals ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Primary goal */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: 4, background: 'var(--aos-brass)', flexShrink: 0 }} />
                    <div style={{ padding: '14px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 4 }}>Sprint 1 · Primary goal</p>
                            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>{SPRINT_GOAL}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            {(['Yes', 'Partially', 'We Learned'] as GoalStatus[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setGoalStatus(prev => ({ ...prev, 0: s }))}
                                    style={goalStatus[0] === s
                                        ? { ...GOAL_IDLE, ...GOAL_STATUS_STYLE[s] }
                                        : GOAL_IDLE
                                    }
                                >{s}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Supporting goals */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {SUPPORTING_GOALS.map((goal, i) => (
                        <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--aos-mist)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 3 }}>Supporting {i + 1}</p>
                                <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.45, fontFamily: 'Geist, sans-serif' }}>{goal}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                                {(['Yes', 'Partially', 'We Learned'] as GoalStatus[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setGoalStatus(prev => ({ ...prev, [i + 1]: s }))}
                                        style={goalStatus[i + 1] === s
                                            ? { ...GOAL_IDLE, ...GOAL_STATUS_STYLE[s], fontSize: 10, padding: '3px 9px' }
                                            : { ...GOAL_IDLE, fontSize: 10, padding: '3px 9px' }
                                        }
                                    >{s}</button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 2. Sprint by the numbers ──────────────────────────────── */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', padding: '20px 24px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 16 }}>Sprint by the numbers</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36 }}>
                    {[
                        { label: 'Initiatives launched', val: '4', color: 'var(--fg-1)' },
                        { label: 'Completed', val: '2', color: 'var(--aos-success)' },
                        { label: 'Rolled over', val: '1', color: 'var(--aos-warning)' },
                        { label: 'Released', val: '1', color: 'var(--aos-risk)' },
                        { label: 'Milestones', val: '9 / 14', color: 'var(--aos-insight)' },
                        { label: 'Sprint days', val: '84', color: 'var(--fg-2)' },
                    ].map(({ label, val, color }) => (
                        <div key={label}>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 30, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{val}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace" }}>{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 3. Two-column band ────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, alignItems: 'start' }}>

                {/* Left: Accomplishment recap (read-only, pre-scoring) */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>Accomplishment recap</p>
                        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>Where you started · what you focused on · what changed. Read-only — capability re-scoring is in Reflection & Review.</p>
                    </div>

                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Baseline */}
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 10 }}>Maturity baseline you started at</p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Overall readiness', val: 'Stage 2', note: 'Operator' },
                                    { label: 'Avg capability score', val: '49', note: '/ 100' },
                                    { label: 'AE Ladder', val: 'Level 2', note: 'Emerging' },
                                ].map(({ label, val, note }) => (
                                    <div key={label} style={{ background: 'var(--bg-inverse)', borderRadius: 8, padding: '10px 14px', minWidth: 100 }}>
                                        <p style={{ fontSize: 10, color: 'rgba(252,251,248,0.5)', fontFamily: 'Geist, sans-serif', marginBottom: 4 }}>{label}</p>
                                        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--fg-on-dark)', lineHeight: 1 }}>{val}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--aos-brass)', marginLeft: 3 }}>{note}</span></p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Capability areas + initiatives */}
                        <div style={{ borderTop: '1px solid var(--aos-mist)', paddingTop: 16 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 10 }}>Capability areas + initiatives focused on</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {CAPABILITY_FOCUS.map(cap => (
                                    <div key={cap.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: 'var(--bg-surface)', borderRadius: 7, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                                        <span style={{ ...chipBase, ...BUCKET_CHIP[cap.bucket], flexShrink: 0 }}>{cap.bucket}</span>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>{cap.name}</p>
                                            <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>{cap.note}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Qualitative outcomes */}
                        <div style={{ borderTop: '1px solid var(--aos-mist)', paddingTop: 16 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 10 }}>Qualitative outcomes</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {QUALITATIVE_OUTCOMES.map((outcome, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'var(--bg-surface)', borderRadius: 7, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--aos-brass)', flexShrink: 0, marginTop: 6 }} />
                                        <p style={{ fontSize: 13, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif', lineHeight: 1.5 }}>{outcome}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Team by the numbers + AI synthesis */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>The team</p>
                        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>By the numbers + synthesized contribution.</p>
                    </div>

                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {MOCK_TEAM.map(member => (
                            <div key={member.initials} style={{ background: 'var(--bg-surface)', borderRadius: 9, boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)', padding: '12px 14px' }}>
                                {/* Identity + metrics */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{member.initials}</div>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', flex: 1 }}>{member.name}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                                    {[
                                        { label: 'Initiatives', val: String(member.initiatives) },
                                        { label: 'Milestones', val: `${member.milestonesComplete}/${member.milestonesTagged}` },
                                    ].map(({ label, val }) => (
                                        <div key={label}>
                                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1 }}>{val}</p>
                                            <p style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'Geist, sans-serif', marginTop: 2 }}>{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* AI synthesis placeholder */}
                                <div style={{ background: 'var(--bg-surface)', borderRadius: 7, border: '1px solid var(--aos-mist)', padding: '9px 11px' }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Sparkles size={9} /> AI synthesis · placeholder
                                    </p>
                                    <p style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif', lineHeight: 1.55 }}>{member.synthesis}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── 4. Start / Stop / Continue ───────────────────────────── */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>Start · Stop · Continue</p>
                    <p style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>What you take forward, what you leave behind, what you keep doing. This is the only required input.</p>
                </div>

                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {SSC_CONFIG.map(item => (
                        <div key={item.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: item.tint }}>
                                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: item.color, fontFamily: "'Geist Mono', monospace" }}>{item.label}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif', lineHeight: 1.5, marginBottom: 8 }}>{item.prompt}</p>
                            <textarea
                                value={sscText[item.key] ?? ''}
                                onChange={e => setSscText(prev => ({ ...prev, [item.key]: e.target.value }))}
                                placeholder="Your reflection…"
                                style={{ width: '100%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--fg-1)', minHeight: 100, resize: 'none', boxSizing: 'border-box', fontFamily: 'Geist, sans-serif', outline: 'none' }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 5. What else did we learn (optional + Looking Ahead) ──── */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--aos-mist)', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 2 }}>What else did we learn?</p>
                        <p style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>Optional. Anything the numbers don't capture.</p>
                    </div>
                    <span style={{ ...chipBase, background: 'var(--bg-sunken)', color: 'var(--fg-4)', border: '1px solid var(--aos-mist)', fontSize: 10 }}>Optional</span>
                </div>

                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Free text */}
                    <div>
                        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif', marginBottom: 8 }}>Additional notes, surprises, or observations from this sprint.</p>
                        <textarea
                            value={additionalNotes}
                            onChange={e => setAdditionalNotes(e.target.value)}
                            placeholder="Anything else worth capturing…"
                            style={{ width: '100%', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--fg-1)', minHeight: 110, resize: 'none', boxSizing: 'border-box', fontFamily: 'Geist, sans-serif', outline: 'none' }}
                        />
                    </div>

                    {/* Looking Ahead prompts (relocated from Wind-Down) */}
                    <div style={{ padding: '4px 0' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 10 }}>Prompts to consider</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {LOOKING_AHEAD_PROMPTS.map((q, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 700, color: 'var(--aos-brass)', flexShrink: 0, marginTop: 1 }}>0{i + 1}</span>
                                    <p style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif', lineHeight: 1.5 }}>{q}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 6. Lock / Approve (above The Story) ──────────────────── */}
            {!locked && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', padding: '20px 24px', boxShadow: 'var(--shadow-soft-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 3 }}>Approve &amp; generate the retrospective memo</p>
                        <p style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'Geist, sans-serif' }}>
                            Locking generates the AI story memo below and adds this sprint to your archive. S/S/C is required; all other input is included if provided.
                        </p>
                    </div>
                    <button
                        onClick={handleLock}
                        style={{ padding: '11px 28px', background: 'var(--aos-brass)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Geist, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        Lock &amp; Approve
                    </button>
                </div>
            )}

            {/* ── 7. The Story (navy earned moment) ────────────────────── */}
            <div style={{ background: 'var(--bg-inverse)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BookOpen size={15} style={{ color: 'var(--fg-on-dark)' }} />
                        </div>
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 2 }}>The Story · Sprint 1</p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-on-dark)', fontFamily: 'Geist, sans-serif' }}>Generated retrospective memo</p>
                        </div>
                    </div>
                    {locked && <span style={{ ...chipBase, background: 'rgba(255,255,255,0.08)', color: 'var(--fg-on-dark)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 10 }}>Approved · Locked</span>}
                    {!locked && <span style={{ fontSize: 12, color: 'rgba(252,251,248,0.4)', fontFamily: 'Geist, sans-serif', fontStyle: 'italic' }}>Approve above to generate</span>}
                </div>

                {!locked ? (
                    <div style={{ padding: '32px 36px', textAlign: 'center' }}>
                        <p style={{ fontSize: 13, color: 'rgba(252,251,248,0.4)', fontStyle: 'italic', fontFamily: 'Geist, sans-serif' }}>Your retrospective memo will appear here once approved.</p>
                    </div>
                ) : (
                    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 15, lineHeight: 1.75, color: 'var(--fg-on-dark)', maxWidth: '70ch' }}>
                            <p>
                                You set out to stabilize the delivery floor by standardizing core processes — and you achieved it. For the first time, your team is running client work without daily founder intervention, not because they got better at improvising, but because the process now carries them.
                            </p>
                            <p style={{ color: 'rgba(252,251,248,0.7)' }}>
                                The SOP library and onboarding documentation were completed on schedule and have already reduced friction in new client handoffs. The intake redesign tested well. The leadership cadence is cleaner and faster. Three distinct capability areas moved forward in a single sprint — that's coherent, not scattered.
                            </p>
                            <p style={{ color: 'rgba(252,251,248,0.7)' }}>
                                The financial reporting dashboard was rolled over deliberately. That wasn't a failure of execution — it was a deliberate trade. You chose operational stability over executive visibility for one sprint, and the stability is now visible in the numbers. The rollover is the next clear priority.
                            </p>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '16px 20px' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--aos-brass)', fontFamily: "'Geist Mono', monospace", marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <ArrowRight size={10} /> Forward guidance
                            </p>
                            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--fg-on-dark)' }}>
                                With the delivery floor holding, the bandwidth now exists to address the financial tooling gap. Moving the reporting dashboard into Prioritize for the next sprint is the clearest path to regaining executive visibility without disrupting the system you just built.
                            </p>
                        </div>

                        <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <p style={{ fontSize: 18, fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'rgba(255,255,255,0.85)' }}>
                                "The process is no longer you; the process is the system."
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 8. What's Next ───────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--aos-mist)', boxShadow: 'var(--shadow-soft-1)', padding: '20px 24px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: "'Geist Mono', monospace", marginBottom: 4 }}>What's next</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'Geist, sans-serif', marginBottom: 8 }}>Capability recalibration &amp; sprint pre-staging</p>
                <p style={{ fontSize: 13, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif', lineHeight: 1.6, maxWidth: '72ch', marginBottom: 16 }}>
                    The story is done — the sprint is accounted for. Move to Reflection &amp; Review to re-score your capabilities against what you observed this sprint, then head into Planning to stage your next sprint using the carry-forward from Wind-Down as a starting point.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif' }}>Next: Reflection &amp; Review</span>
                        <ArrowRight size={13} style={{ color: 'var(--fg-3)' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'Geist, sans-serif' }}>Then: Sprint Planning</span>
                        <ArrowRight size={13} style={{ color: 'var(--fg-3)' }} />
                    </div>
                </div>
            </div>

            </>)}
        </div>
    );
};
