import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, History, Sparkles, LayoutGrid, X, Check } from 'lucide-react';

// Reflection & Review v2 — checkpoint-level cockpit (Handoff #13 rev, 2026-06-21).
// Checkpoint re-rating is shared state between the accordion table and the View Full Grid modal.
// No wiring — Save is local state; Submit is a placeholder for working-score write (V-11).

type Rating = 'No' | 'Somewhat' | 'Yes';

interface Checkpoint {
    label: string;
    previousResponse: Rating;
}

interface WorkedCapability {
    name: string;
    bucket: 'Prioritize' | 'Plant' | 'Iterate';
    description: string;
    whatGoodLooksLike: string;
    checkpoints: Checkpoint[];
}

const STAGES = ['Surviving', 'Rising', 'Driving', 'Thriving', 'Compounding'] as const;

function scoreFromRating(r: Rating): number {
    return r === 'Yes' ? 100 : r === 'Somewhat' ? 50 : 0;
}

function computeCapScore(cap: WorkedCapability, overrides: Record<number, Rating>): number {
    const total = cap.checkpoints.reduce((s, cp, i) => s + scoreFromRating(overrides[i] ?? cp.previousResponse), 0);
    return total / cap.checkpoints.length;
}

function stageIndex(maturity: number): number {
    return Math.min(4, Math.floor(maturity / 20));
}

const PRIORITIZE_IDXS = [0, 1, 2];

const CHIP_BASE: React.CSSProperties = {
    display: 'inline-block',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontFamily: "'Geist Mono', monospace",
    flexShrink: 0,
};

const BUCKET_CHIP: Record<string, React.CSSProperties> = {
    Prioritize: { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' },
    Plant: { background: 'var(--aos-warning-tint)', color: 'var(--aos-warning)' },
    Iterate: { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
};

const WORKED_CAPABILITIES: WorkedCapability[] = [
    {
        name: 'Delivery Architecture',
        bucket: 'Prioritize',
        description: 'SOPs, handoffs, and execution without founder intervention.',
        whatGoodLooksLike: 'Documented SOPs for all core delivery phases. The team executes client work to spec without founder intervention on routine decisions. Handoffs are predictable and consistent across engagements.',
        checkpoints: [
            { label: 'Core delivery phases are documented end-to-end', previousResponse: 'Yes' },
            { label: 'Team handles routine delivery without founder routing', previousResponse: 'Somewhat' },
            { label: 'Handoffs between delivery phases are consistent and predictable', previousResponse: 'Yes' },
            { label: 'New clients are onboarded without relying on tribal knowledge', previousResponse: 'Somewhat' },
            { label: 'Delivery outcomes meet client spec consistently across engagements', previousResponse: 'Somewhat' },
        ],
    },
    {
        name: 'Client Experience',
        bucket: 'Prioritize',
        description: 'Intentional touchpoints across intake, delivery, and close.',
        whatGoodLooksLike: 'Every client touchpoint is designed intentionally. Onboarding, check-ins, and handoffs feel like a premium product experience. Clients feel informed and confident without prompting.',
        checkpoints: [
            { label: 'Client intake process is structured and consistent', previousResponse: 'Yes' },
            { label: 'Onboarding experience is intentional and premium', previousResponse: 'Somewhat' },
            { label: 'Check-in cadence is defined and maintained', previousResponse: 'No' },
            { label: 'Clients receive proactive updates without having to ask', previousResponse: 'Somewhat' },
            { label: 'Delivery close is deliberate and leaves a strong final impression', previousResponse: 'Yes' },
        ],
    },
    {
        name: 'Financial Operations',
        bucket: 'Prioritize',
        description: 'Real-time visibility into revenue, margin, and utilization.',
        whatGoodLooksLike: 'Real-time visibility into revenue, margin, and utilization. Financial decisions are grounded in current data, not lagging memory or estimates. Reporting takes minutes, not hours.',
        checkpoints: [
            { label: 'Revenue is visible in real time, not at month-end', previousResponse: 'No' },
            { label: 'Delivery margin is tracked per engagement', previousResponse: 'No' },
            { label: 'Utilization rate is reviewed on at least a bi-weekly basis', previousResponse: 'Somewhat' },
            { label: 'Financial reporting can be produced in under an hour', previousResponse: 'No' },
            { label: 'Cash flow visibility extends at least 60 days out', previousResponse: 'No' },
        ],
    },
    {
        name: 'Market Footprint',
        bucket: 'Plant',
        description: 'Deliberate positioning and pipeline within defined market segments.',
        whatGoodLooksLike: 'Clear point of view on which segments and channels are most valuable. Positioning is deliberate, not reactive. Adding to the right pipeline, not just any pipeline.',
        checkpoints: [
            { label: 'Target market segment is defined and actively pursued', previousResponse: 'Somewhat' },
            { label: 'Positioning is differentiated from direct competitors', previousResponse: 'Somewhat' },
            { label: 'Channel strategy is deliberate and documented', previousResponse: 'No' },
            { label: 'ICP is specific enough to filter leads at intake', previousResponse: 'No' },
            { label: 'Pipeline additions are screened against ICP, not accepted by default', previousResponse: 'Somewhat' },
        ],
    },
    {
        name: 'Team Infrastructure',
        bucket: 'Plant',
        description: 'Defined roles and hiring criteria tied to capability gaps.',
        whatGoodLooksLike: 'Roles clearly defined and documented. Hiring criteria tied to capability gaps, not just workload. The team understands how their work connects to the agency\'s growth stage.',
        checkpoints: [
            { label: 'All active roles have a written scope and definition', previousResponse: 'No' },
            { label: 'Hiring criteria are tied to capability gaps, not just bandwidth', previousResponse: 'No' },
            { label: 'Team members understand how their work connects to growth goals', previousResponse: 'Somewhat' },
            { label: 'Next-hire criteria are defined in advance, before the need becomes urgent', previousResponse: 'No' },
            { label: 'Org structure supports delivery without constant founder routing', previousResponse: 'Somewhat' },
        ],
    },
    {
        name: 'Ops Instrumentation',
        bucket: 'Plant',
        description: 'Defined metrics tracked and reviewed on cadence.',
        whatGoodLooksLike: 'Operational metrics defined, tracked, and reviewed on cadence. You know delivery utilization, project margins, and team capacity with fidelity to make proactive decisions.',
        checkpoints: [
            { label: 'Core ops metrics are defined and documented', previousResponse: 'Somewhat' },
            { label: 'Metrics are reviewed on a regular, defined cadence', previousResponse: 'No' },
            { label: 'Delivery utilization is tracked per team member', previousResponse: 'Somewhat' },
            { label: 'Project margin is visible within 2 weeks of delivery close', previousResponse: 'No' },
            { label: 'Team capacity is forecast at least 30 days ahead', previousResponse: 'No' },
        ],
    },
    {
        name: 'Leadership Cadence',
        bucket: 'Iterate',
        description: 'Consistent operating rhythm for alignment, blockers, and motion.',
        whatGoodLooksLike: 'Consistent weekly operating rhythm — predictable structure for the team to align, surface blockers, and stay in motion. Meetings have clear purpose; team leaves knowing what to do next.',
        checkpoints: [
            { label: 'Weekly operating rhythm is defined and documented', previousResponse: 'Somewhat' },
            { label: 'Team meetings run on a consistent format with a clear agenda', previousResponse: 'No' },
            { label: 'Team members leave standups knowing their immediate next action', previousResponse: 'No' },
            { label: 'Blockers are surfaced and resolved within the cadence, not between sessions', previousResponse: 'Somewhat' },
            { label: 'Operating rhythm has run consistently for 6+ consecutive weeks', previousResponse: 'No' },
        ],
    },
    {
        name: 'Pricing Architecture',
        bucket: 'Iterate',
        description: 'Pricing reflects stage and value; moving toward predictable structures.',
        whatGoodLooksLike: 'Pricing reflects stage, position, and value delivered. Discounting is intentional, not defensive. Moving toward retainer or productized structures for predictable revenue.',
        checkpoints: [
            { label: 'Pricing reflects the value delivered at your current stage', previousResponse: 'Yes' },
            { label: 'Discounting decisions are intentional and tied to a clear rationale', previousResponse: 'No' },
            { label: 'At least one retainer or productized offer is active', previousResponse: 'Somewhat' },
            { label: 'Pricing has been reviewed and adjusted in the last 6 months', previousResponse: 'No' },
            { label: 'Clients rarely push back on price relative to value', previousResponse: 'Somewhat' },
        ],
    },
    {
        name: 'Pipeline Coverage',
        bucket: 'Iterate',
        description: 'Consistent qualified pipeline with improving conversion visibility.',
        whatGoodLooksLike: 'Consistently more qualified pipeline than you can close in the next 60–90 days. You understand conversion rate, average deal size, and where deals stall — and actively improving each.',
        checkpoints: [
            { label: 'Pipeline consistently covers 3× next-quarter close target', previousResponse: 'Somewhat' },
            { label: 'Conversion rate is tracked and reviewed at least monthly', previousResponse: 'Somewhat' },
            { label: 'Average deal size and common stall points are clearly understood', previousResponse: 'Somewhat' },
            { label: 'Follow-up cadence is systematized, not ad hoc', previousResponse: 'No' },
            { label: 'New pipeline is added through a consistent, documented process', previousResponse: 'Yes' },
        ],
    },
];

// ─── Inline evolution visual ─────────────────────────────────────────────────

function InlineEvolution({ startScore, currentScore }: { startScore: number; currentScore: number }) {
    const delta = currentScore - startScore;
    const moved = Math.abs(delta) > 0.1;
    const pctChange = startScore > 0 ? ((delta / startScore) * 100) : (moved ? 100 : 0);
    const deltaColor = delta > 0 ? 'var(--aos-success)' : delta < 0 ? 'var(--aos-risk)' : 'var(--fg-4)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Line visual */}
            <div style={{ width: 96, position: 'relative' }}>
                <div style={{ height: 4, background: 'var(--bg-sunken)', borderRadius: 999, position: 'relative', overflow: 'visible' }}>
                    {/* Movement fill */}
                    {moved && (
                        <div style={{
                            position: 'absolute', top: 0,
                            left: `${Math.min(startScore, currentScore)}%`,
                            width: `${Math.abs(delta)}%`,
                            height: '100%',
                            background: deltaColor,
                            borderRadius: 999, opacity: 0.7,
                        }} />
                    )}
                    {/* Start dot */}
                    <div style={{
                        position: 'absolute', top: '50%',
                        left: `${Math.max(0, Math.min(100, startScore))}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 7, height: 7, borderRadius: '50%',
                        background: moved ? 'var(--fg-4)' : 'var(--fg-3)',
                        border: '1.5px solid var(--bg-surface)',
                        zIndex: 1,
                    }} />
                    {/* End dot */}
                    <div style={{
                        position: 'absolute', top: '50%',
                        left: `${Math.max(0, Math.min(100, currentScore))}%`,
                        transform: 'translate(-50%, -50%)',
                        width: moved ? 9 : 7, height: moved ? 9 : 7, borderRadius: '50%',
                        background: moved ? deltaColor : 'var(--fg-3)',
                        border: '1.5px solid var(--bg-surface)',
                        zIndex: 2,
                    }} />
                </div>
            </div>

            {/* Numbers + delta */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 110 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fg-3)' }}>
                    {startScore.toFixed(0)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>→</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, color: moved ? deltaColor : 'var(--fg-3)' }}>
                    {currentScore.toFixed(0)}
                </span>
                {moved && (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: deltaColor, fontWeight: 600 }}>
                        {delta > 0 ? '+' : ''}{pctChange.toFixed(0)}%
                    </span>
                )}
                {!moved && (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--fg-4)' }}>—</span>
                )}
            </div>
        </div>
    );
}

// ─── Checkpoint row (shared between accordion and grid modal) ─────────────────

function ratingBtnStyle(r: Rating, active: boolean): React.CSSProperties {
    const base: React.CSSProperties = {
        padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 5,
        cursor: 'pointer', border: '1px solid var(--aos-mist)',
        background: 'var(--bg-surface)', color: 'var(--fg-3)',
        fontFamily: 'inherit', transition: 'all 0.1s',
    };
    if (!active) return base;
    if (r === 'Yes') return { ...base, background: 'var(--aos-success-tint)', color: 'var(--aos-success)', border: '1px solid var(--aos-success)' };
    if (r === 'Somewhat') return { ...base, background: 'var(--aos-warning-tint)', color: 'var(--aos-warning)', border: '1px solid var(--aos-warning)' };
    return { ...base, background: 'var(--aos-risk-tint)', color: 'var(--aos-risk)', border: '1px solid var(--aos-risk)' };
}

interface CheckpointRowProps {
    checkpoint: Checkpoint;
    cpIdx: number;
    capIdx: number;
    override: Rating | undefined;
    onRate: (capIdx: number, cpIdx: number, rating: Rating) => void;
    compact?: boolean;
}

function CheckpointRow({ checkpoint, cpIdx, capIdx, override, onRate, compact }: CheckpointRowProps) {
    const effectiveRating = override ?? checkpoint.previousResponse;
    const isOverridden = override !== undefined && override !== checkpoint.previousResponse;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: compact ? '10px 16px' : '11px 14px',
            background: 'var(--bg-surface)',
            borderRadius: compact ? 0 : 6,
            borderBottom: compact ? '1px solid var(--aos-mist)' : 'none',
            border: compact ? 'none' : isOverridden ? '1px solid var(--aos-brass)' : '1px solid var(--aos-mist)',
        }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--fg-4)', flexShrink: 0, width: 16 }}>
                {cpIdx + 1}
            </span>
            <p style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5, flex: 1 }}>{checkpoint.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ ...CHIP_BASE, padding: '2px 7px', fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}>
                    was: {checkpoint.previousResponse}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['No', 'Somewhat', 'Yes'] as Rating[]).map(r => (
                        <button key={r} onClick={() => onRate(capIdx, cpIdx, r)} style={ratingBtnStyle(r, effectiveRating === r)}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Capability row (accordion) ───────────────────────────────────────────────

interface CapabilityRowProps {
    cap: WorkedCapability;
    capIdx: number;
    expanded: boolean;
    onToggle: () => void;
    overrides: Record<number, Rating>;
    startScore: number;
    currentScore: number;
    onRate: (capIdx: number, cpIdx: number, rating: Rating) => void;
    isLast: boolean;
}

function CapabilityRow({ cap, capIdx, expanded, onToggle, overrides, startScore, currentScore, onRate, isLast }: CapabilityRowProps) {
    return (
        <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--aos-mist)' }}>
            {/* Collapsed header — white, not parchment */}
            <button
                onClick={onToggle}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px', background: 'var(--bg-surface)',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    borderBottom: expanded ? '1px solid var(--aos-mist)' : 'none',
                }}
            >
                <span style={{ ...CHIP_BASE, ...BUCKET_CHIP[cap.bucket] }}>{cap.bucket}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>{cap.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{cap.description}</p>
                </div>
                <InlineEvolution startScore={startScore} currentScore={currentScore} />
                {expanded
                    ? <ChevronUp size={15} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                    : <ChevronDown size={15} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                }
            </button>

            {/* Expanded body — white */}
            {expanded && (
                <div style={{ padding: '14px 20px 18px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* What good looks like — parchment callout (structural, earned) */}
                    <div style={{ background: 'var(--bg-sunken)', borderRadius: 7, padding: '11px 14px', borderLeft: '3px solid var(--aos-brass)' }}>
                        <p style={{ ...CHIP_BASE, color: 'var(--fg-3)', display: 'block', marginBottom: 5 }}>What good looks like</p>
                        <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>{cap.whatGoodLooksLike}</p>
                    </div>

                    {/* Previous score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ ...CHIP_BASE, color: 'var(--fg-3)', fontSize: 10 }}>Previous score</span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>
                            {startScore.toFixed(0)} / 100
                        </span>
                    </div>

                    {/* Checkpoints */}
                    <div>
                        <p style={{ ...CHIP_BASE, color: 'var(--fg-3)', display: 'block', marginBottom: 8, fontSize: 10 }}>
                            Checkpoints — bump only what changed
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {cap.checkpoints.map((cp, cpIdx) => (
                                <CheckpointRow
                                    key={cpIdx}
                                    checkpoint={cp}
                                    cpIdx={cpIdx}
                                    capIdx={capIdx}
                                    override={overrides[cpIdx]}
                                    onRate={onRate}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stage bar ────────────────────────────────────────────────────────────────

function StageBar({ startMaturity, currentMaturity, currentStageIdx }: { startMaturity: number; currentMaturity: number; currentStageIdx: number }) {
    const startPct = Math.max(0, Math.min(100, startMaturity));
    const currPct = Math.max(0, Math.min(100, currentMaturity));
    const moved = Math.abs(currPct - startPct) > 0.1;

    return (
        <div>
            <div style={{ position: 'relative', height: 8, display: 'flex', borderRadius: 999, overflow: 'hidden' }}>
                {STAGES.map((_, i) => (
                    <div key={i} style={{
                        flex: 1, height: '100%',
                        background: i < currentStageIdx ? 'rgba(184,146,42,0.45)' : i === currentStageIdx ? 'var(--aos-brass)' : 'rgba(255,255,255,0.08)',
                        borderRight: i < 4 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                    }} />
                ))}
                {moved && (
                    <div style={{
                        position: 'absolute', top: '50%', left: `${startPct}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)',
                    }} />
                )}
                <div style={{
                    position: 'absolute', top: '50%', left: `${currPct}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 12, height: 12, borderRadius: '50%',
                    background: 'white', border: '2px solid var(--aos-brass)',
                }} />
            </div>
            <div style={{ display: 'flex', marginTop: 8 }}>
                {STAGES.map((stage, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace", fontSize: 10,
                            fontWeight: i === currentStageIdx ? 700 : 400,
                            color: i === currentStageIdx ? 'var(--aos-brass)' : i < currentStageIdx ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                            letterSpacing: '0.02em', textTransform: 'uppercase',
                        }}>
                            {stage}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── View Full Grid modal ─────────────────────────────────────────────────────

interface GridModalProps {
    open: boolean;
    onClose: () => void;
    checkpointRatings: Record<number, Record<number, Rating>>;
    onRate: (capIdx: number, cpIdx: number, rating: Rating) => void;
    changeCount: number;
}

function GridModal({ open, onClose, checkpointRatings, onRate, changeCount }: GridModalProps) {
    if (!open) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(25,48,82,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{
                background: 'var(--bg-surface)', borderRadius: 14,
                width: '100%', maxWidth: 960, maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-raised)',
                overflow: 'hidden',
            }}>
                {/* Modal header */}
                <div style={{
                    padding: '18px 24px', borderBottom: '1px solid var(--aos-mist)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
                }}>
                    <div>
                        <p style={{ ...CHIP_BASE, color: 'var(--aos-brass)', display: 'block', marginBottom: 6 }}>
                            Reflect · Checkpoint Grid
                        </p>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)' }}>
                            Capability Checkpoint Grid
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 3 }}>
                            9 capabilities · 45 checkpoints · defaults carried — bump only what changed
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 7, padding: 8, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                    >
                        <X size={16} style={{ color: 'var(--fg-3)', display: 'block' }} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {WORKED_CAPABILITIES.map((cap, ci) => (
                        <div key={ci}>
                            {/* Capability group header — parchment structural divider */}
                            <div style={{
                                background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)',
                                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
                                position: 'sticky', top: 0, zIndex: 10,
                            }}>
                                <span style={{ ...CHIP_BASE, ...BUCKET_CHIP[cap.bucket] }}>{cap.bucket}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{cap.name}</span>
                                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>— {cap.description}</span>
                            </div>
                            {/* Checkpoint rows */}
                            {cap.checkpoints.map((cp, cpIdx) => (
                                <CheckpointRow
                                    key={cpIdx}
                                    checkpoint={cp}
                                    cpIdx={cpIdx}
                                    capIdx={ci}
                                    override={(checkpointRatings[ci] ?? {})[cpIdx]}
                                    onRate={onRate}
                                    compact
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Modal footer */}
                <div style={{
                    padding: '14px 24px', borderTop: '1px solid var(--aos-mist)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                    background: 'var(--bg-surface)',
                }}>
                    <p style={{ fontSize: 13, color: changeCount > 0 ? 'var(--aos-brass)' : 'var(--fg-4)' }}>
                        {changeCount > 0 ? `${changeCount} checkpoint${changeCount !== 1 ? 's' : ''} updated` : 'No changes yet'}
                    </p>
                    <button
                        onClick={onClose}
                        style={{ background: 'var(--aos-brass)', color: 'white', border: 'none', borderRadius: 7, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const ReflectionReview: React.FC = () => {
    const [view, setView] = useState<'current' | 'historic'>('current');
    const [expandedCap, setExpandedCap] = useState<number | null>(null);
    const [checkpointRatings, setCheckpointRatings] = useState<Record<number, Record<number, Rating>>>({});
    const [showGrid, setShowGrid] = useState(false);
    const [saved, setSaved] = useState(false);

    const startScores = useMemo(() =>
        WORKED_CAPABILITIES.map(cap =>
            cap.checkpoints.reduce((s, cp) => s + scoreFromRating(cp.previousResponse), 0) / cap.checkpoints.length
        ), []);

    const currScores = useMemo(() =>
        WORKED_CAPABILITIES.map((cap, ci) => computeCapScore(cap, checkpointRatings[ci] ?? {})),
        [checkpointRatings]);

    const startMaturity = startScores.reduce((a, b) => a + b, 0) / startScores.length;
    const currMaturity = currScores.reduce((a, b) => a + b, 0) / currScores.length;
    const startReadiness = PRIORITIZE_IDXS.reduce((s, i) => s + startScores[i], 0) / PRIORITIZE_IDXS.length;
    const currReadiness = PRIORITIZE_IDXS.reduce((s, i) => s + currScores[i], 0) / PRIORITIZE_IDXS.length;
    const startStageIdx = stageIndex(startMaturity);
    const currStageIdx = stageIndex(currMaturity);

    const changeCount = useMemo(() =>
        Object.values(checkpointRatings).reduce((total, overrides) => total + Object.keys(overrides).length, 0),
        [checkpointRatings]);

    const onRate = useCallback((capIdx: number, cpIdx: number, rating: Rating) => {
        setSaved(false);
        setCheckpointRatings(prev => {
            const capOverrides = { ...(prev[capIdx] ?? {}) };
            const defaultRating = WORKED_CAPABILITIES[capIdx].checkpoints[cpIdx].previousResponse;
            if (rating === defaultRating) {
                delete capOverrides[cpIdx];
            } else {
                capOverrides[cpIdx] = rating;
            }
            return { ...prev, [capIdx]: capOverrides };
        });
    }, []);

    const CHIP_LABEL: React.CSSProperties = { ...CHIP_BASE, color: 'var(--fg-3)', fontSize: 10, background: 'transparent', padding: 0, letterSpacing: '0.06em' };

    return (
        <>
            <GridModal
                open={showGrid}
                onClose={() => setShowGrid(false)}
                checkpointRatings={checkpointRatings}
                onRate={onRate}
                changeCount={changeCount}
            />

            <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Reflection &amp; Review</h2>
                        <p style={{ fontSize: 14, color: 'var(--fg-3)', maxWidth: '62ch', lineHeight: 1.5 }}>
                            Re-score the 9 capabilities worked this sprint at the checkpoint level. Defaults carry forward — bump only what changed. Your working score updates live.
                        </p>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--bg-sunken)', border: '1px solid var(--aos-mist)', borderRadius: 8, padding: 3, flexShrink: 0 }}>
                        {(['current', 'historic'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                style={{
                                    padding: '6px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                                    background: view === v ? 'var(--bg-surface)' : 'transparent',
                                    color: view === v ? 'var(--fg-1)' : 'var(--fg-3)',
                                    boxShadow: view === v ? 'var(--shadow-soft-1)' : 'none',
                                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                                }}
                            >
                                {v === 'current' ? <Sparkles size={13} /> : <History size={13} />}
                                {v === 'current' ? 'This sprint' : 'Past sprints'}
                            </button>
                        ))}
                    </div>
                </div>

                {view === 'historic' ? (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 12, padding: '64px 40px', textAlign: 'center', boxShadow: 'var(--shadow-soft-1)' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <History size={22} style={{ color: 'var(--fg-4)' }} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 8 }}>No past reflections yet</h3>
                        <p style={{ fontSize: 14, color: 'var(--fg-4)', maxWidth: '40ch', margin: '0 auto', lineHeight: 1.6 }}>
                            After you close your first sprint, past Reflection &amp; Review sessions will appear here as a browsable archive.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── Vitals — obsidian ── */}
                        <div style={{ background: 'var(--bg-inverse)', borderRadius: 12, padding: '28px 32px', boxShadow: 'var(--shadow-raised)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                {/* Starting state */}
                                <div style={{ flex: 1 }}>
                                    <p style={{ ...CHIP_LABEL, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 14 }}>Starting state</p>
                                    <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end' }}>
                                        <div>
                                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 42, fontWeight: 700, color: 'white', lineHeight: 1 }}>{startMaturity.toFixed(1)}</p>
                                            <p style={{ fontSize: 11, color: 'var(--aos-steel-blue)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Maturity</p>
                                        </div>
                                        <div>
                                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 42, fontWeight: 700, color: 'white', lineHeight: 1 }}>{startReadiness.toFixed(1)}</p>
                                            <p style={{ fontSize: 11, color: 'var(--aos-steel-blue)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Readiness</p>
                                        </div>
                                        <div style={{ paddingBottom: 8 }}>
                                            <span style={{ ...CHIP_BASE, background: 'rgba(255,255,255,0.08)', color: 'var(--aos-steel-blue)', fontSize: 11 }}>
                                                {STAGES[startStageIdx]}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
                                    <ArrowRight size={18} style={{ color: 'var(--aos-brass)' }} />
                                </div>

                                {/* Updated state */}
                                <div style={{ flex: 1 }}>
                                    <p style={{ ...CHIP_LABEL, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 14 }}>Updated state</p>
                                    <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end' }}>
                                        <div>
                                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 42, fontWeight: 700, color: 'var(--aos-brass)', lineHeight: 1 }}>{currMaturity.toFixed(1)}</p>
                                            <p style={{ fontSize: 11, color: 'var(--aos-steel-blue)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Maturity</p>
                                        </div>
                                        <div>
                                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 42, fontWeight: 700, color: 'var(--aos-brass)', lineHeight: 1 }}>{currReadiness.toFixed(1)}</p>
                                            <p style={{ fontSize: 11, color: 'var(--aos-steel-blue)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Readiness</p>
                                        </div>
                                        <div style={{ paddingBottom: 8 }}>
                                            <span style={{ ...CHIP_BASE, background: currStageIdx > startStageIdx ? 'rgba(184,146,42,0.2)' : 'rgba(255,255,255,0.08)', color: currStageIdx > startStageIdx ? 'var(--aos-brass)' : 'var(--aos-steel-blue)', fontSize: 11 }}>
                                                {STAGES[currStageIdx]}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <p style={{ ...CHIP_LABEL, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 12 }}>Stage progression</p>
                                <StageBar startMaturity={startMaturity} currentMaturity={currMaturity} currentStageIdx={currStageIdx} />
                            </div>
                        </div>

                        {/* ── Capability re-rating table ── */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-soft-1)' }}>
                            {/* Table header bar — parchment structural divider */}
                            <div style={{
                                background: 'var(--bg-sunken)', borderBottom: '1px solid var(--aos-mist)',
                                padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                            }}>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>Capability re-rating</h3>
                                    <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                                        9 capabilities · 5 checkpoints each · expand a row or use the grid to review all at once
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowGrid(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)',
                                        borderRadius: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                                        color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                                    }}
                                >
                                    <LayoutGrid size={14} />
                                    View full grid
                                </button>
                            </div>

                            {/* Column header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '8px 20px', borderBottom: '1px solid var(--aos-mist)',
                                background: 'var(--bg-surface)',
                            }}>
                                <div style={{ width: 72, flexShrink: 0 }} />
                                <div style={{ flex: 1 }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 240 }}>
                                    <span style={{ ...CHIP_LABEL, color: 'var(--fg-4)' }}>Start</span>
                                    <div style={{ width: 96 }} />
                                    <span style={{ ...CHIP_LABEL, color: 'var(--fg-4)' }}>Now</span>
                                    <span style={{ ...CHIP_LABEL, color: 'var(--fg-4)', width: 40, textAlign: 'right' }}>Δ</span>
                                </div>
                                <div style={{ width: 15 }} />
                            </div>

                            {/* Capability rows */}
                            {WORKED_CAPABILITIES.map((cap, ci) => (
                                <CapabilityRow
                                    key={ci}
                                    cap={cap}
                                    capIdx={ci}
                                    expanded={expandedCap === ci}
                                    onToggle={() => setExpandedCap(prev => prev === ci ? null : ci)}
                                    overrides={checkpointRatings[ci] ?? {}}
                                    startScore={startScores[ci]}
                                    currentScore={currScores[ci]}
                                    onRate={onRate}
                                    isLast={ci === WORKED_CAPABILITIES.length - 1}
                                />
                            ))}
                        </div>

                        {/* ── Save progress ── */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                                {changeCount > 0
                                    ? `${changeCount} checkpoint${changeCount !== 1 ? 's' : ''} updated — save to preserve your progress before submitting.`
                                    : 'No changes from your previous assessment — bump any checkpoint to recalibrate.'}
                            </p>
                            <button
                                onClick={() => setSaved(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    background: saved ? 'var(--aos-success-tint)' : 'var(--bg-surface)',
                                    border: `1px solid ${saved ? 'var(--aos-success)' : 'var(--aos-mist)'}`,
                                    borderRadius: 7, padding: '9px 18px', fontSize: 13, fontWeight: 600,
                                    color: saved ? 'var(--aos-success)' : 'var(--fg-2)',
                                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
                                }}
                            >
                                {saved && <Check size={14} />}
                                {saved ? 'Progress saved' : 'Save progress'}
                            </button>
                        </div>

                        {/* ── Sprint closed / Lock & Submit ── */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', borderRadius: 12, padding: '32px 36px', boxShadow: 'var(--shadow-soft-1)', textAlign: 'center' }}>
                            <p style={{ ...CHIP_BASE, color: 'var(--aos-brass)', display: 'block', marginBottom: 10 }}>Sprint closed</p>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>Ready for the next one</h3>
                            <p style={{ fontSize: 14, color: 'var(--fg-3)', maxWidth: '52ch', margin: '0 auto 24px', lineHeight: 1.6 }}>
                                Submitting locks your re-ratings and updates your working capability score. Your rollover decisions and sprint learnings have already pre-seeded the next planning session.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <button style={{ background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--aos-mist)', padding: '11px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Save &amp; return later
                                </button>
                                <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--aos-brass)', color: 'white', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Lock &amp; submit
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};
