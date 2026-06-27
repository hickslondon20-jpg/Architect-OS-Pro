import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Download,
    ChevronDown,
    History,
    ArrowRight,
    ChevronRight,
    X,
    Target,
    DollarSign,
    TrendingUp,
    Users,
    Loader2,
    AlertCircle,
    RefreshCw,
    FileText,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
const WEBHOOK_SECRET = 'ArchitectOS_9f3a2c1d_7b8e_4c99_a1e2_3d4f5g6h7i8j';
const POLL_INTERVAL_MS = 3000;

type DashboardStatus =
    | 'not_generated'
    | 'processing_call_1'
    | 'processing_call_2'
    | 'complete'
    | 'failed_call_1'
    | 'failed_call_2';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardStatusRow {
    status: DashboardStatus;
}

interface DashboardViewRow {
    // Meta
    dashboard_id?: string | null;
    snapshot_label?: string | null;
    snapshot_created_at?: string | null;
    generated_at?: string | null;
    dashboard_status?: string | null;
    pdf_url?: string | null;
    pdf_generated_at?: string | null;

    // Business Vitals (deterministic)
    annual_revenue_run_rate?: number | null;
    annual_agi_run_rate?: number | null;
    profit_margin_percentage?: number | null;
    total_team_size_fte?: number | null;
    active_client_count?: number | null;
    monthly_churn_rate?: number | null;

    // At-a-Glance (from sub-tab synthesis)
    mf_synthesis_signal?: string | null;
    mf_beat_1_headline?: string | null;
    mf_beat_1?: string | null;
    mf_beat_2_headline?: string | null;
    mf_beat_2?: string | null;
    mf_beat_3_headline?: string | null;
    mf_beat_3?: string | null;

    ef_synthesis_signal?: string | null;
    ef_beat_1_headline?: string | null;
    ef_beat_1?: string | null;
    ef_beat_2_headline?: string | null;
    ef_beat_2?: string | null;
    ef_beat_3_headline?: string | null;
    ef_beat_3?: string | null;

    rm_synthesis_signal?: string | null;
    rm_beat_1_headline?: string | null;
    rm_beat_1?: string | null;
    rm_beat_2_headline?: string | null;
    rm_beat_2?: string | null;
    rm_beat_3_headline?: string | null;
    rm_beat_3?: string | null;

    da_synthesis_signal?: string | null;
    da_beat_1_headline?: string | null;
    da_beat_1?: string | null;
    da_beat_2_headline?: string | null;
    da_beat_2?: string | null;
    da_beat_3_headline?: string | null;
    da_beat_3?: string | null;

    // GPT — Call 1
    executive_headline?: string | null;
    executive_summary?: string | null;
    signal_1_headline?: string | null;
    signal_1_body?: string | null;
    signal_1_so_what?: string | null;
    signal_2_headline?: string | null;
    signal_2_body?: string | null;
    signal_2_so_what?: string | null;
    signal_3_headline?: string | null;
    signal_3_body?: string | null;
    signal_3_so_what?: string | null;
    signal_4_headline?: string | null;
    signal_4_body?: string | null;
    signal_4_so_what?: string | null;
    signal_5_headline?: string | null;
    signal_5_body?: string | null;
    signal_5_so_what?: string | null;

    // GPT — Call 2
    implication_1_headline?: string | null;
    implication_1_body?: string | null;
    implication_2_headline?: string | null;
    implication_2_body?: string | null;
    implication_3_headline?: string | null;
    implication_3_body?: string | null;
    synthesis_statement?: string | null;

    // Frozen sub-tab record IDs — captured at dashboard generation time
    // These are sourced from agency_snapshots and exposed by the view.
    // The view's sub-tab beats already join on these IDs, so they are
    // correct by construction. Stored here for direct sub-tab queries if needed.
    market_footprint_id?: string | null;
    economic_foundation_id?: string | null;
    revenue_model_id?: string | null;
    delivery_architecture_id?: string | null;
}


interface SnapshotHistoryRow {
    id: string;
    generated_at: string | null;
    snapshot_label: string | null;
    snapshot_created_at: string | null;
    pdf_url: string | null;
    run_number: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRevenue(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M/yr`;
    return `$${Math.round(val / 1000)}k/yr`;
}

function formatAGI(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M/yr`;
    return `$${Math.round(val / 1000)}k/yr`;
}

function formatPercent(val: number | null | undefined, suffix = '%'): string {
    if (val === null || val === undefined) return '—';
    return `${val.toFixed(1)}${suffix}`;
}

function formatInt(val: number | null | undefined, suffix = ''): string {
    if (val === null || val === undefined) return '—';
    return `${Math.round(val)}${suffix}`;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatSnapshotLabel(
    label: string | null | undefined,
    createdAt: string | null | undefined
): string {
    if (label) return label;
    if (createdAt) {
        const d = new Date(createdAt);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Snapshot';
    }
    return 'Agency Snapshot';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-4)] mb-4">
        {children}
    </p>
);

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE STATE VIEWS
// ─────────────────────────────────────────────────────────────────────────────

const NotGeneratedState: React.FC<{ onGenerate: () => void; loading: boolean }> = ({
    onGenerate,
    loading,
}) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 h-12 w-12 rounded-xl bg-[var(--bg-canvas)] flex items-center justify-center">
            <FileText className="h-6 w-6 text-[var(--fg-4)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--fg-1)] mb-2">
            Your Dashboard Has Not Been Generated Yet
        </h2>
        <p className="text-sm text-[var(--fg-3)] max-w-sm leading-relaxed mb-6">
            Complete all four sub-tabs, then generate your Agency Snapshot Dashboard to see your
            full strategic portrait.
        </p>
        <button
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] disabled:opacity-50 text-[var(--fg-on-dark)] text-sm font-medium rounded-md transition-colors shadow-[var(--shadow-soft-1)]"
        >
            {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
            ) : (
                'Generate Dashboard'
            )}
        </button>
    </div>
);

interface ProcessingStateProps { phase: 'call_1' | 'call_2'; }

const ProcessingState: React.FC<ProcessingStateProps> = ({ phase }) => {
    const message =
        phase === 'call_1'
            ? 'Analyzing your business profile across all four dimensions...'
            : 'Synthesizing your strategic portrait...';

    const step = phase === 'call_1' ? 1 : 2;

    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 relative">
                <div className="h-12 w-12 rounded-xl bg-[var(--aos-insight-tint)] flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-[var(--aos-insight)] animate-spin" />
                </div>
            </div>
            <h2 className="text-base font-semibold text-[var(--fg-1)] mb-2">{message}</h2>
            <p className="text-xs text-[var(--fg-4)] mb-6">Step {step} of 2 — this typically takes 30–60 seconds</p>
            <div className="flex items-center gap-2">
                <div className={`h-1.5 w-16 rounded-full ${phase === 'call_1' ? 'bg-[var(--aos-insight)]' : 'bg-[var(--aos-insight-tint)]'}`} />
                <div className={`h-1.5 w-16 rounded-full ${phase === 'call_2' ? 'bg-[var(--aos-insight)]' : 'bg-[var(--aos-mist)]'}`} />
            </div>
        </div>
    );
};

interface ErrorStateProps {
    phase: 'call_1' | 'call_2';
    onRegenerate: () => void;
    loading: boolean;
}

const ErrorState: React.FC<ErrorStateProps> = ({ phase, onRegenerate, loading }) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 h-12 w-12 rounded-xl bg-[var(--aos-risk-tint)] flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-[var(--aos-risk)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--fg-1)] mb-2">
            Dashboard Generation Failed
        </h2>
        <p className="text-sm text-[var(--fg-3)] max-w-sm leading-relaxed mb-1">
            {phase === 'call_1'
                ? 'An error occurred during analysis. Your data is safe — you can regenerate at any time.'
                : 'Analysis completed but synthesis encountered an error. The retry will resume from where it left off.'}
        </p>
        <p className="text-xs text-[var(--fg-4)] mb-6">Failed at step {phase === 'call_1' ? '1' : '2'} of 2</p>
        <button
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] disabled:opacity-50 text-[var(--fg-on-dark)] text-sm font-medium rounded-md transition-colors shadow-[var(--shadow-soft-1)]"
        >
            {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Retrying...</>
            ) : (
                <><RefreshCw className="h-4 w-4" /> Regenerate Dashboard</>
            )}
        </button>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEADER ZONE
// ─────────────────────────────────────────────────────────────────────────────

type DownloadButtonState = 'ready' | 'no_pdf' | 'error';

interface PageHeaderZoneProps {
    snapshotLabel: string;
    generatedAt: string | null | undefined;
    downloadState: DownloadButtonState;
    onDownloadReport: () => void;
    onViewHistory: () => void;
}

const PageHeaderZone: React.FC<PageHeaderZoneProps> = ({
    snapshotLabel,
    generatedAt,
    downloadState,
    onDownloadReport,
    onViewHistory,
}) => {
    const downloadLabel =
        downloadState === 'error'
            ? 'PDF Error'
            : downloadState === 'no_pdf'
            ? 'Generating PDF...'
            : 'Download Report';

    const downloadIcon =
        downloadState === 'error' ? (
            <AlertTriangle className="h-3.5 w-3.5" />
        ) : downloadState === 'no_pdf' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
            <Download className="h-3.5 w-3.5" />
        );

    const downloadClass =
        downloadState === 'error'
            ? 'bg-[var(--aos-risk)] hover:opacity-90 text-[var(--fg-on-dark)]'
            : downloadState === 'no_pdf'
            ? 'bg-[var(--aos-insight)] opacity-60 text-[var(--fg-on-dark)] cursor-not-allowed'
            : 'bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] text-[var(--fg-on-dark)]';

    return (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-[var(--aos-mist)]">
            <div>
                <h1 className="text-xl font-semibold text-[var(--fg-1)] leading-snug">
                    {snapshotLabel}
                </h1>
                {generatedAt && (
                    <p className="text-xs text-[var(--fg-4)] mt-1">
                        Last updated: {formatDate(generatedAt)}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <button
                    onClick={onDownloadReport}
                    disabled={downloadState === 'no_pdf'}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-[var(--shadow-soft-1)] ${downloadClass}`}
                >
                    {downloadIcon}
                    {downloadLabel}
                </button>
                <button
                    onClick={onViewHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--fg-2)] hover:text-[var(--fg-1)] border border-[var(--aos-mist)] hover:border-[var(--fg-3)] bg-[var(--bg-surface)] rounded-md transition-colors"
                >
                    <History className="h-3.5 w-3.5" />
                    Previous Snapshots
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// PREVIOUS SNAPSHOTS MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface PreviousSnapshotsModalProps {
    rows: SnapshotHistoryRow[];
    loading: boolean;
    onClose: () => void;
}

const PreviousSnapshotsModal: React.FC<PreviousSnapshotsModalProps> = ({
    rows,
    loading,
    onClose,
}) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <div className="absolute inset-0 backdrop-blur-[2px]" style={{ backgroundColor: 'rgba(25, 48, 82, 0.4)' }} />
        <div
            className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-elevated)] overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--aos-mist)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--fg-1)]">Previous Snapshots</h2>
                <button
                    onClick={onClose}
                    className="text-[var(--fg-4)] hover:text-[var(--fg-1)] transition-colors p-1 rounded-md hover:bg-[var(--bg-canvas)]"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 text-[var(--fg-4)] animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-[var(--fg-3)] text-center py-10">No previous snapshots found.</p>
                ) : (
                    <div className="divide-y divide-[var(--aos-mist)]">
                        {rows.map((row, i) => {
                            const label = formatSnapshotLabel(row.snapshot_label, row.snapshot_created_at);
                            const date = row.generated_at ? formatDate(row.generated_at) : '—';
                            const isFirst = i === 0;
                            return (
                                <div key={row.id} className="py-3.5 flex items-center justify-between gap-4">
                                    <div>
                                        <p className={`text-sm font-medium ${isFirst ? 'text-[var(--fg-1)]' : 'text-[var(--fg-2)]'}`}>
                                            {label}
                                            {isFirst && (
                                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--aos-insight)] bg-[var(--aos-insight-tint)] px-1.5 py-0.5 rounded">
                                                    Current
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-[var(--fg-4)] mt-0.5">{date}</p>
                                    </div>
                                    {row.pdf_url ? (
                                        <a
                                            href={row.pdf_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--aos-insight)] hover:text-[var(--fg-1)] transition-colors shrink-0"
                                        >
                                            <Download className="h-3 w-3" /> PDF
                                        </a>
                                    ) : (
                                        <span className="text-xs text-[var(--fg-4)] shrink-0">No PDF</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--aos-mist)] flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-[var(--fg-on-dark)] bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] rounded-md transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS VITALS STRIP — Element 3
// ─────────────────────────────────────────────────────────────────────────────

const Vital: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <div className="flex flex-col items-center px-6 first:pl-0 last:pr-0">
        <span className="text-[22px] font-semibold text-[var(--fg-1)] tracking-tight leading-none mb-1.5">
            {value}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-4)]">{label}</span>
    </div>
);

const VitalDivider: React.FC = () => (
    <div className="w-px h-10 bg-[var(--aos-mist)] shrink-0" />
);

const BusinessVitalsStrip: React.FC<{ data: DashboardViewRow }> = ({ data }) => {
    const vitals = [
        { value: formatRevenue(data.annual_revenue_run_rate), label: 'Revenue' },
        { value: formatAGI(data.annual_agi_run_rate), label: 'AGI' },
        { value: formatPercent(data.profit_margin_percentage), label: 'Margin' },
        { value: formatInt(data.total_team_size_fte, ' FTE'), label: 'Team' },
        { value: formatInt(data.active_client_count), label: 'Clients' },
        { value: formatPercent(data.monthly_churn_rate, '%/mo'), label: 'Churn' },
    ];

    return (
        <div>
            <SectionLabel>Business Vitals</SectionLabel>
            <div className="bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-lg px-6 py-5">
                <div className="flex items-center justify-between overflow-x-auto">
                    {vitals.map((v, i) => (
                        <React.Fragment key={v.label}>
                            {i > 0 && <VitalDivider />}
                            <Vital value={v.value} label={v.label} />
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENCY AT-A-GLANCE — Element 4
// ─────────────────────────────────────────────────────────────────────────────

interface Beat { headline: string | null; body: string | null; }

// Accordion card for the modal — open by default
const ModalBeatCard: React.FC<{ headline: string | null; body: string | null }> = ({
    headline,
    body,
}) => {
    const [open, setOpen] = useState(true);

    if (!headline && !body) return null;

    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 hover:bg-[var(--bg-canvas)] transition-colors"
            >
                {headline && (
                    <h4 className="text-[15px] font-semibold text-[var(--fg-1)] leading-snug">{headline}</h4>
                )}
                <ChevronDown
                    className={`h-4 w-4 text-[var(--fg-4)] shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <div style={{ maxHeight: open ? '800px' : '0', overflow: 'hidden', transition: 'max-height 300ms ease' }}>
                {body && (
                    <div className="px-6 pb-6 pt-2 border-t border-[var(--aos-mist)]">
                        <p className="text-sm text-[var(--fg-2)] leading-relaxed">{body}</p>
                    </div>
                )}
            </div>
        </div>
    );
};


interface ModalRect { left: number; top: number; width: number }

interface DimensionCardProps {
    title: string;
    icon: React.ReactNode;
    synthesisSig: string | null | undefined;
    beats: Beat[];
    gridRect?: ModalRect | null;
}

const DimensionCard: React.FC<DimensionCardProps> = ({ title, icon, synthesisSig, beats, gridRect }) => {
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        if (modalOpen) { document.body.style.overflow = 'hidden'; }
        else { document.body.style.overflow = ''; }
        return () => { document.body.style.overflow = ''; };
    }, [modalOpen]);

    const validBeats = beats.filter(b => b.headline || b.body);

    // Modal inline style: if we have a measured grid rect, pin left/width to it.
    // Otherwise fall back to centered 4xl.
    const modalStyle: React.CSSProperties = gridRect
        ? { position: 'fixed', left: gridRect.left, width: gridRect.width, maxWidth: 'none' }
        : {};

    return (
        <>
            <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg p-5 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[var(--fg-3)]">{icon}</span>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fg-3)]">{title}</h3>
                    </div>
                    <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                        {synthesisSig ?? (
                            <span className="text-[var(--fg-4)] italic">
                                Complete and synthesize your {title} tab to see this analysis.
                            </span>
                        )}
                    </p>
                </div>
                {validBeats.length > 0 && (
                    <button
                        onClick={() => setModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--aos-insight)] hover:text-[var(--fg-1)] transition-colors self-start"
                    >
                        View Full Analysis <ChevronRight className="h-3 w-3" />
                    </button>
                )}
            </div>


            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ padding: gridRect ? '24px 0' : '24px' }}
                    onClick={() => setModalOpen(false)}
                >
                    <div className="absolute inset-0 backdrop-blur-[2px]" style={{ backgroundColor: 'rgba(25, 48, 82, 0.4)' }} />
                    <div
                        className="relative bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-elevated)] overflow-hidden"
                        style={{
                            ...modalStyle,
                            ...(gridRect ? {} : { width: '100%', maxWidth: '64rem' }),
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--aos-mist)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[var(--fg-3)]">{icon}</span>
                                <h2 className="text-sm font-semibold text-[var(--fg-1)]">{title} Insights</h2>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-[var(--fg-4)] hover:text-[var(--fg-1)] transition-colors p-1 rounded-md hover:bg-[var(--bg-canvas)]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="px-8 py-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {validBeats.map((beat, i) => (
                                <ModalBeatCard key={i} headline={beat.headline} body={beat.body} />
                            ))}

                            {/* The Signal — bottom, sub-tab style */}
                            {synthesisSig && (
                                <div className="mt-4 rounded-lg bg-[var(--bg-canvas)] border border-[var(--aos-mist)] px-6 py-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[var(--fg-4)]">{icon}</span>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-4)]">
                                            The Signal
                                        </p>
                                    </div>
                                    <p className="text-sm text-[var(--fg-2)] leading-relaxed italic">
                                        "{synthesisSig}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 border-t border-[var(--aos-mist)] flex justify-end">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-5 py-2 text-sm font-medium text-[var(--fg-on-dark)] bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] rounded-md transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};


const AgencyAtAGlance: React.FC<{ data: DashboardViewRow }> = ({ data }) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const [gridRect, setGridRect] = useState<ModalRect | null>(null);

    // Measure the grid on mount + resize so the modal always snaps to it.
    useEffect(() => {
        const measure = () => {
            if (gridRef.current) {
                const rect = gridRef.current.getBoundingClientRect();
                setGridRect({ left: rect.left, top: rect.top, width: rect.width });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const dimensions: DimensionCardProps[] = [
        {
            title: 'Market Footprint',
            icon: <Target className="h-4 w-4" />,
            synthesisSig: data.mf_synthesis_signal,
            beats: [
                { headline: data.mf_beat_1_headline ?? null, body: data.mf_beat_1 ?? null },
                { headline: data.mf_beat_2_headline ?? null, body: data.mf_beat_2 ?? null },
                { headline: data.mf_beat_3_headline ?? null, body: data.mf_beat_3 ?? null },
            ],
        },
        {
            title: 'Economic Foundation',
            icon: <DollarSign className="h-4 w-4" />,
            synthesisSig: data.ef_synthesis_signal,
            beats: [
                { headline: data.ef_beat_1_headline ?? null, body: data.ef_beat_1 ?? null },
                { headline: data.ef_beat_2_headline ?? null, body: data.ef_beat_2 ?? null },
                { headline: data.ef_beat_3_headline ?? null, body: data.ef_beat_3 ?? null },
            ],
        },
        {
            title: 'Revenue Model',
            icon: <TrendingUp className="h-4 w-4" />,
            synthesisSig: data.rm_synthesis_signal,
            beats: [
                { headline: data.rm_beat_1_headline ?? null, body: data.rm_beat_1 ?? null },
                { headline: data.rm_beat_2_headline ?? null, body: data.rm_beat_2 ?? null },
                { headline: data.rm_beat_3_headline ?? null, body: data.rm_beat_3 ?? null },
            ],
        },
        {
            title: 'Delivery Architecture',
            icon: <Users className="h-4 w-4" />,
            synthesisSig: data.da_synthesis_signal,
            beats: [
                { headline: data.da_beat_1_headline ?? null, body: data.da_beat_1 ?? null },
                { headline: data.da_beat_2_headline ?? null, body: data.da_beat_2 ?? null },
                { headline: data.da_beat_3_headline ?? null, body: data.da_beat_3 ?? null },
            ],
        },
    ];

    return (
        <div>
            <SectionLabel>Agency At-a-Glance</SectionLabel>
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dimensions.map(d => <DimensionCard key={d.title} {...d} gridRect={gridRect} />)}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-DIMENSIONAL SIGNALS — Element 5
// ─────────────────────────────────────────────────────────────────────────────

interface SignalCardProps {
    index: number;
    headline: string;
    body: string | null | undefined;
    soWhat: string | null | undefined;
}

const SignalCard: React.FC<SignalCardProps> = ({ index, headline, body, soWhat }) => (
    <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg overflow-hidden">
        <div className="p-5">
            <div className="flex items-start gap-4 mb-3">
                <span className="text-[11px] font-semibold text-[var(--fg-4)] tracking-widest pt-0.5 shrink-0 w-6">
                    {String(index).padStart(2, '0')}
                </span>
                <h3 className="text-sm font-semibold text-[var(--fg-1)] leading-snug">{headline}</h3>
            </div>
            {body && (
                <p className="text-sm text-[var(--fg-2)] leading-relaxed pl-10 mb-4">{body}</p>
            )}
            {soWhat && (
                <div className="ml-10 bg-[var(--bg-canvas)] border-l-2 border-[var(--aos-mist)] rounded-r px-4 py-3">
                    <p className="text-xs text-[var(--fg-2)] leading-relaxed">
                        <span className="font-semibold text-[var(--fg-1)]">→ So what:</span>{' '}
                        {soWhat}
                    </p>
                </div>
            )}
        </div>
    </div>
);

const CrossDimensionalSignals: React.FC<{ data: DashboardViewRow }> = ({ data }) => {
    const signals = [
        { headline: data.signal_1_headline, body: data.signal_1_body, soWhat: data.signal_1_so_what },
        { headline: data.signal_2_headline, body: data.signal_2_body, soWhat: data.signal_2_so_what },
        { headline: data.signal_3_headline, body: data.signal_3_body, soWhat: data.signal_3_so_what },
        { headline: data.signal_4_headline, body: data.signal_4_body, soWhat: data.signal_4_so_what },
        { headline: data.signal_5_headline, body: data.signal_5_body, soWhat: data.signal_5_so_what },
    ].filter(s => s.headline);

    if (signals.length === 0) return null;

    return (
        <div>
            <SectionLabel>Critical Insights</SectionLabel>
            <div className="space-y-3">
                {signals.map((s, i) => (
                    <SignalCard
                        key={i}
                        index={i + 1}
                        headline={s.headline!}
                        body={s.body}
                        soWhat={s.soWhat}
                    />
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATING REALITIES — Element 6
// ─────────────────────────────────────────────────────────────────────────────

const ImplicationCard: React.FC<{ headline: string; body: string | null | undefined }> = ({
    headline,
    body,
}) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full text-left p-5 flex items-start justify-between gap-3 hover:bg-[var(--bg-canvas)] transition-colors"
            >
                <h3 className="text-sm font-semibold text-[var(--fg-1)] leading-snug">{headline}</h3>
                <ChevronDown
                    className={`h-4 w-4 text-[var(--fg-4)] shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <div style={{ maxHeight: open ? '400px' : '0', overflow: 'hidden', transition: 'max-height 200ms ease' }}>
                {body && (
                    <div className="px-5 pb-5 pt-1 border-t border-[var(--aos-mist)]">
                        <p className="text-sm text-[var(--fg-2)] leading-relaxed">{body}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const OperatingRealities: React.FC<{ data: DashboardViewRow }> = ({ data }) => {
    const implications = [
        { headline: data.implication_1_headline, body: data.implication_1_body },
        { headline: data.implication_2_headline, body: data.implication_2_body },
        { headline: data.implication_3_headline, body: data.implication_3_body },
    ].filter(i => i.headline);

    if (implications.length === 0) return null;

    return (
        <div className="bg-[var(--bg-canvas)] rounded-xl px-6 py-6 -mx-1">
            <SectionLabel>Operating Realities</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {implications.map((imp, i) => (
                    <ImplicationCard key={i} headline={imp.headline!} body={imp.body} />
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEXT STEPS CTA — Element 8
// ─────────────────────────────────────────────────────────────────────────────

const NextStepsCTA: React.FC<{ annualRevenue: number | null | undefined }> = ({ annualRevenue }) => {
    const revenueInsert = annualRevenue ? ` at ${formatRevenue(annualRevenue)} in annual revenue` : '';

    return (
        <div>
            <SectionLabel>Next Steps</SectionLabel>
            <p className="text-sm text-[var(--fg-2)] leading-relaxed mb-5">
                This snapshot establishes your current operational baseline{revenueInsert}. To understand
                your growth potential and model what your next stage looks like from here, explore the
                Growth Velocity Calculator.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] text-[var(--fg-on-dark)] text-sm font-medium rounded-md transition-colors shadow-[var(--shadow-soft-1)]">
                    Explore Growth Velocity Calculator <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={() => document.getElementById('agency-at-a-glance')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1 px-2 py-2.5 text-sm font-medium text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors"
                >
                    Review Your Analysis
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface CompletedDashboardProps {
    data: DashboardViewRow;
    downloadState: DownloadButtonState;
    onDownloadReport: () => void;
    onViewHistory: () => void;
}

const CompletedDashboard: React.FC<CompletedDashboardProps> = ({
    data,
    downloadState,
    onDownloadReport,
    onViewHistory,
}) => {
    const snapshotLabel = formatSnapshotLabel(data.snapshot_label, data.snapshot_created_at);

    return (
        <div>
            <PageHeaderZone
                snapshotLabel={snapshotLabel}
                generatedAt={data.generated_at}
                downloadState={downloadState}
                onDownloadReport={onDownloadReport}
                onViewHistory={onViewHistory}
            />

            <div className="mt-8 space-y-10">
                {data.executive_headline && (
                    <div>
                        <h2 className="text-2xl font-semibold text-[var(--fg-1)] leading-snug">
                            {data.executive_headline}
                        </h2>
                    </div>
                )}

                {data.executive_summary && (
                    <div>
                        <SectionLabel>Your Business Model</SectionLabel>
                        <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                            {data.executive_summary}
                        </p>
                    </div>
                )}

                <hr className="border-[var(--aos-mist)]" />

                <BusinessVitalsStrip data={data} />

                <div id="agency-at-a-glance">
                    <AgencyAtAGlance data={data} />
                </div>

                <hr className="border-[var(--aos-mist)]" />

                <CrossDimensionalSignals data={data} />

                <OperatingRealities data={data} />

                {data.synthesis_statement && (
                    <div className="pt-4 border-t border-[var(--aos-mist)]">
                        <SectionLabel>Synthesis</SectionLabel>
                        <p className="text-sm font-medium text-[var(--fg-2)] leading-relaxed">
                            {data.synthesis_statement}
                        </p>
                    </div>
                )}

                <div className="border-t border-[var(--aos-mist)] pt-8">
                    <NextStepsCTA annualRevenue={data.annual_revenue_run_rate} />
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const SnapshotDashboard: React.FC = () => {
    const { user } = useAuth();

    // ── State ──────────────────────────────────────────────────────────────
    const [uiStatus, setUiStatus] = useState<DashboardStatus | null>(null); // null = initial load
    const [viewData, setViewData] = useState<DashboardViewRow | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFiringWebhook, setIsFiringWebhook] = useState(false);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyRows, setHistoryRows] = useState<SnapshotHistoryRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Computed download button state ─────────────────────────────────────
    const downloadState: DownloadButtonState = viewData?.pdf_url
        ? 'ready'
        : viewData?.pdf_generated_at
        ? 'error'
        : 'no_pdf';

    // ── Cleanup on unmount ────────────────────────────────────────────────
    useEffect(() => {
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, []);

    // ── Load full view data (only called once status = complete) ──────────
    const loadViewData = useCallback(async (dashboardId: string) => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('agency_snapshot_dashboard_view')
                .select('*')
                .eq('user_id', user.id)
                .eq('dashboard_id', dashboardId)
                .maybeSingle();

            if (error) throw error;
            if (data) setViewData(data as DashboardViewRow);
        } catch (err) {
            console.error('Error loading dashboard view data:', err);
        }
    }, [user]);

    // ── Status polling (polls agency_snapshot_dashboard table directly) ───
    const pollStatus = useCallback(async () => {
        if (!user) {
            setIsInitialLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('agency_snapshot_dashboard')
                .select('id, status')
                .eq('user_id', user.id)
                .eq('is_current', true)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setUiStatus('not_generated');
                return;
            }

            const status = data.status as DashboardStatus;
            setUiStatus(status);

            if (status === 'complete') {
                // Load full data from the view — one-time, no more polling
                await loadViewData(data.id);
            } else if (status === 'processing_call_1' || status === 'processing_call_2') {
                // Continue polling
                pollRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
            }
            // failed_* states — stop polling, show error UI
        } catch (err) {
            console.error('Error polling dashboard status:', err);
            // Retry on transient error (initial load flag still clears via finally)
            pollRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
        } finally {
            // Always clear the initial loading spinner after the first attempt,
            // regardless of success or failure. Subsequent poll retries are silent.
            setIsInitialLoading(false);
        }
    }, [user, loadViewData]);

    // ── Initial load on mount ─────────────────────────────────────────────
    useEffect(() => {
        if (user) {
            pollStatus();
        } else {
            // Auth still resolving — clear loading after 2s to prevent infinite spinner
            const t = setTimeout(() => setIsInitialLoading(false), 2000);
            return () => clearTimeout(t);
        }
    }, [user, pollStatus]);

    // ── Fire synthesis webhook ─────────────────────────────────────────────
    const fireSynthesisWebhook = useCallback(async (force: boolean) => {
        if (!user || isFiringWebhook) return;

        setIsFiringWebhook(true);
        // Optimistically show processing state
        setUiStatus('processing_call_1');

        try {
            fetch(`${WEBHOOK_URL}/agency-snapshot/dashboard/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-architectos-secret': WEBHOOK_SECRET,
                },
                body: JSON.stringify({ user_id: user.id, force }),
            }).catch(console.error);

            // Start polling — the DB record starts as processing_call_1
            if (pollRef.current) clearTimeout(pollRef.current);
            pollRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
        } catch (err) {
            console.error('Error firing synthesis webhook:', err);
        } finally {
            setIsFiringWebhook(false);
        }
    }, [user, isFiringWebhook, pollStatus]);

    // ── Download report handler ───────────────────────────────────────────
    const handleDownloadReport = useCallback(() => {
        if (viewData?.pdf_url) {
            window.open(viewData.pdf_url, '_blank');
        }
        // no_pdf and error states: button is visually differentiated — no action
    }, [viewData]);

    // ── Previous snapshots ────────────────────────────────────────────────
    const handleViewHistory = useCallback(async () => {
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('agency_snapshot_dashboard')
                .select('id, generated_at, pdf_url, run_number, snapshot_id')
                .eq('user_id', user!.id)
                .order('generated_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            // Also pull snapshot labels by joining snapshots
            // agency_snapshot_dashboard_view already has snapshot_label but we need it per row
            // Use the view for the current row's label; for historical rows derive from created_at
            const rows: SnapshotHistoryRow[] = (data ?? []).map((row: any) => ({
                id: row.id,
                generated_at: row.generated_at,
                snapshot_label: null, // will be formatted by formatSnapshotLabel fallback
                snapshot_created_at: row.generated_at, // use generated_at as fallback label source
                pdf_url: row.pdf_url,
                run_number: row.run_number,
            }));

            setHistoryRows(rows);
        } catch (err) {
            console.error('Error loading snapshot history:', err);
            setHistoryRows([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [user]);

    // ── Initial load skeleton ─────────────────────────────────────────────
    if (isInitialLoading) {
        return (
            <div className="w-full flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 text-[var(--fg-4)] animate-spin" />
            </div>
        );
    }

    // ── Route by status ───────────────────────────────────────────────────
    return (
        <div className="w-full">
            {/* Previous Snapshots Modal */}
            {historyOpen && (
                <PreviousSnapshotsModal
                    rows={historyRows}
                    loading={historyLoading}
                    onClose={() => setHistoryOpen(false)}
                />
            )}

            {uiStatus === 'not_generated' && (
                <NotGeneratedState
                    onGenerate={() => fireSynthesisWebhook(false)}
                    loading={isFiringWebhook}
                />
            )}

            {uiStatus === 'processing_call_1' && <ProcessingState phase="call_1" />}
            {uiStatus === 'processing_call_2' && <ProcessingState phase="call_2" />}

            {uiStatus === 'failed_call_1' && (
                <ErrorState
                    phase="call_1"
                    onRegenerate={() => fireSynthesisWebhook(true)}
                    loading={isFiringWebhook}
                />
            )}

            {uiStatus === 'failed_call_2' && (
                <ErrorState
                    phase="call_2"
                    onRegenerate={() => fireSynthesisWebhook(true)}
                    loading={isFiringWebhook}
                />
            )}

            {uiStatus === 'complete' && viewData && (
                <CompletedDashboard
                    data={viewData}
                    downloadState={downloadState}
                    onDownloadReport={handleDownloadReport}
                    onViewHistory={handleViewHistory}
                />
            )}

            {/* Edge case: complete but view data not yet loaded */}
            {uiStatus === 'complete' && !viewData && (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-6 w-6 text-[var(--fg-4)] animate-spin" />
                </div>
            )}
        </div>
    );
};
