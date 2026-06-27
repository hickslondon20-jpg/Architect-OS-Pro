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
