export type StageLabel = 'Rising' | 'Striving' | 'Thriving' | 'Driving' | 'Arriving';
export type DeviationBucket = 'strongly_above' | 'above' | 'at_overall' | 'below' | 'strongly_below';

export interface DimensionScore {
    id: string;
    name: string;
    avgScore: number;
    delta: number;
    deviationBucket: DeviationBucket;
    bandSummaryLabel: string;
    signalTag: string;
    dimensionInsight?: string | null;
    isStrongStrength: boolean;
    isModerateStrength: boolean;
    isModerateGap: boolean;
    isStrongGap: boolean;
}

export interface FocusPriority {
    rank: 1 | 2 | 3;
    dimensionId: string;
    dimensionName: string;
    reasonCode: string; // e.g., "top_strong_strength", "primary_moderate_gap"
}

export interface AnalysisPayload {
    stageLabel: StageLabel;
    overallScore: number;
    completedAt: string; // ISO date string
    frontendStageLabel: string;
    overallBandId: string;
    dimensions: DimensionScore[];
    priorities: FocusPriority[];
    pdfUrl: string | null;
}

export interface StageContent {
    label: StageLabel;
    heroTagline: string;
    heroDescription: string;
    overview: {
        title: string;
        summary: string;
        keyThemes: string[];
    };
    journey: {
        summary: string;
        nextStageHint: string;
    };
}

export interface BandContent {
    id: string;
    positionLabel: string; // e.g. "Early Striving"
    introLine: string;
    narrative: string;
    whatGoodLooksLike: string[];
}

// ── View type: vw_ae_dashboard_results ─────────────────────────────────────
export interface AEDashboardRow {
    // Assessment identity
    ae_assessment_id: string;
    user_id: string;
    overall_score: number | string;
    submitted_at: string | null;

    // Stage
    ae_frontend_stage_id: string;
    ae_frontend_stage: string;           // e.g. "Thriving"
    ae_stage_tagline: string | null;
    ae_stage_description: string | null;
    ae_stage_sequence: number;

    // GPT insight fields
    tl_dr_paragraph: string | null;
    exec_summary_strength: string | null;
    exec_summary_friction: string | null;
    stage_brief_interpretation: string | null;
    strategic_insights_overall: string | null;

    // Dimension insights (GPT)
    financial_dimension_insight: string | null;
    clients_dimension_insight: string | null;
    ops_dimension_insight: string | null;
    team_dimension_insight: string | null;
    stewardship_dimension_insight: string | null;

    // Focus points (JSONB or null)
    focus_point_1: unknown | null;
    focus_point_2: unknown | null;
    focus_point_3: unknown | null;
    focus_point_4: unknown | null;

    // Signal headlines
    signal_headline_strength: string | null;
    signal_headline_friction: string | null;
    signal_headline_synthesis: string | null;

    // Financial
    financial_avg: number | string | null;
    financial_band_id: string | null;
    financial_band_label: string | null;
    financial_band_stage_meaning: string | null;
    financial_signal_tag: string | null;
    financial_primary_focus: string | null;
    financial_secondary_focus: string | null;
    financial_primary_insight_tag: string | null;
    financial_secondary_insight_tag: string | null;

    // Client Base
    client_avg: number | string | null;
    client_band_id: string | null;
    client_band_label: string | null;
    client_band_stage_meaning: string | null;
    client_signal_tag: string | null;
    client_primary_focus: string | null;
    client_secondary_focus: string | null;
    client_primary_insight_tag: string | null;
    client_secondary_insight_tag: string | null;

    // Ops
    ops_avg: number | string | null;
    ops_band_id: string | null;
    ops_band_label: string | null;
    ops_band_stage_meaning: string | null;
    ops_signal_tag: string | null;
    ops_primary_focus: string | null;
    ops_secondary_focus: string | null;
    ops_primary_insight_tag: string | null;
    ops_secondary_insight_tag: string | null;

    // Team
    team_avg: number | string | null;
    team_band_id: string | null;
    team_band_label: string | null;
    team_band_stage_meaning: string | null;
    team_signal_tag: string | null;
    team_primary_focus: string | null;
    team_secondary_focus: string | null;
    team_primary_insight_tag: string | null;
    team_secondary_insight_tag: string | null;

    // Stewardship
    stewardship_avg: number | string | null;
    stewardship_band_id: string | null;
    stewardship_band_label: string | null;
    stewardship_band_stage_meaning: string | null;
    stewardship_signal_tag: string | null;
    stewardship_primary_focus: string | null;
    stewardship_secondary_focus: string | null;
    stewardship_primary_insight_tag: string | null;
    stewardship_secondary_insight_tag: string | null;
}

// ── View type: vw_ae_stage_context ─────────────────────────────────────────
export interface AEStageContextRow {
    // Identity
    ae_assessment_id: string;
    user_id: string;
    overall_score: number | string;

    // Sub-stage
    ae_backend_stage_id: string;
    ae_backend_stage: string;
    ae_stage_min_score: number;
    ae_stage_max_score: number;

    // Stage
    ae_frontend_stage: string;
    ae_stage_tagline: string | null;
    ae_stage_description_short: string | null;
    ae_stage_description: string | null;
    ae_stage_cta_tagline: string | null;

    // New specific context fields
    stage_key_themes: string[] | null;
    stage_transition_quote: string | null;
    field_guide_url: string | null;

    // Next Stage
    next_ae_stage: string | null;
    next_stage_description: string | null;
    ae_next_stage_tagline: string | null;

    // Ladder overview
    ladder_rising_description: string | null;
    ladder_striving_description: string | null;
    ladder_thriving_description: string | null;
    ladder_driving_description: string | null;
    ladder_arriving_description: string | null;
}
