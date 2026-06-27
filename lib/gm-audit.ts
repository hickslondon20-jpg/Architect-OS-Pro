/**
 * gm-audit.ts
 * Helper library for the Growth Mastery (M&R) Audit intake flow.
 * Handles stage resolution, question fetching, assessment creation/resume.
 */

import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GMCheckpoint {
    id: string;                  // gm_audit_question_id
    checkpointId: string;        // gm_checkpoint_id (backend key)
    displayId: string;           // checkpoint_id_display e.g. "1.1.1"
    displayTitle: string;        // checkpoint_title_display e.g. "Data & Reporting"
    statement: string;           // question_text
    helpText: string | null;     // question_help_text
    responseScaleId: string;
}

export interface GMCapabilityScreen {
    screen: number;            // 1–25
    dimensionId: string;       // gm_dim_1..5
    dimensionName: string;
    dimensionOrder: number;    // 1–5
    pillarId: string;
    pillarName: string;
    pillarOrder: number;       // 1–5 within dimension
    capabilityId: string;
    capabilityName: string;
    capabilityDescription: string;
    capabilityCode: string;    // e.g. "1.1"
    checkpoints: GMCheckpoint[];
}

export interface GMTransitionScreen {
    completedDimension: number;
    completedName: string;
    completedSummary: string;
    nextDimension: number;
    nextName: string;
    nextPreview: string;
}

export interface GMAssessment {
    assessmentId: string;
    status: string;
    calibrationStageId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage Resolution
// ─────────────────────────────────────────────────────────────────────────────

// Local map: derive stage name without a DB round-trip
const GM_STAGE_NAMES: Record<string, string> = {
    gm_stg_1: 'Rising',
    gm_stg_2: 'Striving',
    gm_stg_3: 'Thriving',
    gm_stg_4: 'Driving',
    gm_stg_5: 'Arriving',
};

/**
 * Reads the user's AE + GM stage IDs from public.users.
 * Single query — no gm_stages lookup needed since users stores both IDs.
 * Returns { aeStageId, gmStageId, stageName } or null if not yet staged.
 */
export async function getUserGMStage(userId: string): Promise<{
    aeStageId: string;
    gmStageId: string;
    stageName: string;
} | null> {
    console.log('[gm-audit] getUserGMStage called for userId:', userId);

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('ae_frontend_stage_id, gm_stage_id')
        .eq('user_id', userId)
        .maybeSingle();

    console.log('[gm-audit] users query result:', { userData, userError });

    if (userError) {
        console.error('[gm-audit] Error reading user stage:', userError.message);
        return null;
    }

    if (!userData?.ae_frontend_stage_id || !userData?.gm_stage_id) {
        console.warn('[gm-audit] Stage not set for user — ae_frontend_stage_id or gm_stage_id is null');
        return null;
    }

    const stageName = GM_STAGE_NAMES[userData.gm_stage_id] ?? userData.gm_stage_id;

    console.log('[gm-audit] Stage resolved:', { aeStageId: userData.ae_frontend_stage_id, gmStageId: userData.gm_stage_id, stageName });

    return {
        aeStageId: userData.ae_frontend_stage_id,
        gmStageId: userData.gm_stage_id,
        stageName,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Fetching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all 125 active audit questions for the given AE stage ID,
 * joined with dimension, pillar, and capability metadata.
 * Returns them grouped into 25 GMCapabilityScreen objects.
 */
export async function getGMAuditScreens(aeStageId: string): Promise<GMCapabilityScreen[]> {
    const { data, error } = await supabase
        .from('gm_audit_questions')
        .select(`
      gm_audit_question_id,
      gm_checkpoint_id,
      checkpoint_id_display,
      checkpoint_title_display,
      question_text,
      question_help_text,
      question_order,
      response_scale_id,
      gm_dimension_id,
      gm_pillar_id,
      gm_capability_id,
      gm_dimensions!gm_audit_questions_gm_dimension_id_fkey (
        dimension_name,
        dimension_order
      ),
      gm_pillars!gm_audit_questions_gm_pillar_id_fkey (
        pillar_name,
        pillar_order
      ),
      gm_capabilities!gm_audit_questions_gm_capability_id_fkey (
        capability_name,
        capability_summary,
        capability_order,
        capability_code
      )
    `)
        .eq('stage_id', aeStageId)
        .eq('is_active', true)
        .order('gm_dimension_id', { ascending: true })
        .order('gm_pillar_id', { ascending: true })
        .order('gm_capability_id', { ascending: true })
        .order('question_order', { ascending: true });

    if (error) {
        console.error('[gm-audit] Error fetching questions:', error.message);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Group by capability into screens
    const screenMap = new Map<string, GMCapabilityScreen>();
    let screenCounter = 0;

    for (const row of data as any[]) {
        const capId = row.gm_capability_id;
        const dim = row.gm_dimensions;
        const pillar = row.gm_pillars;
        const cap = row.gm_capabilities;

        if (!screenMap.has(capId)) {
            screenCounter++;
            screenMap.set(capId, {
                screen: screenCounter,
                dimensionId: row.gm_dimension_id,
                dimensionName: dim?.dimension_name ?? '',
                dimensionOrder: dim?.dimension_order ?? 0,
                pillarId: row.gm_pillar_id,
                pillarName: pillar?.pillar_name ?? '',
                pillarOrder: pillar?.pillar_order ?? 0,
                capabilityId: capId,
                capabilityName: cap?.capability_name ?? '',
                capabilityDescription: cap?.capability_summary ?? '',
                capabilityCode: cap?.capability_code ?? '',
                checkpoints: [],
            });
        }

        screenMap.get(capId)!.checkpoints.push({
            id: row.gm_audit_question_id,
            checkpointId: row.gm_checkpoint_id,
            displayId: row.checkpoint_id_display ?? '',
            displayTitle: row.checkpoint_title_display ?? '',
            statement: row.question_text,
            helpText: row.question_help_text ?? null,
            responseScaleId: row.response_scale_id,
        });
    }

    // Sort screens by dimension order → pillar order → capability order
    return Array.from(screenMap.values()).sort((a, b) => {
        if (a.dimensionOrder !== b.dimensionOrder) return a.dimensionOrder - b.dimensionOrder;
        if (a.pillarOrder !== b.pillarOrder) return a.pillarOrder - b.pillarOrder;
        return 0;
    });
}

/**
 * Builds the 4 dimension transition screens from the loaded capability screens.
 * Transitions appear after each dimension (between D1→D2, D2→D3, D3→D4, D4→D5).
 */
export function buildTransitionScreens(capabilityScreens: GMCapabilityScreen[]): GMTransitionScreen[] {
    if (capabilityScreens.length === 0) return [];

    // Get unique dimensions in order
    const dimensions = Array.from(
        new Map(
            capabilityScreens.map(s => [s.dimensionOrder, { id: s.dimensionId, name: s.dimensionName, order: s.dimensionOrder }])
        ).values()
    ).sort((a, b) => a.order - b.order);

    const transitions: GMTransitionScreen[] = [];
    for (let i = 0; i < dimensions.length - 1; i++) {
        const completed = dimensions[i];
        const next = dimensions[i + 1];
        transitions.push({
            completedDimension: completed.order,
            completedName: completed.name,
            completedSummary: `You've completed the ${completed.name} evaluation. Take a moment before continuing.`,
            nextDimension: next.order,
            nextName: next.name,
            nextPreview: `Up next: you'll evaluate your agency's ${next.name.toLowerCase()} systems and practices.`,
        });
    }
    return transitions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Record Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new gm_assessments record or returns an existing in-progress one.
 */
export async function createOrResumeGMAssessment(
    userId: string,
    gmStageId: string,
): Promise<GMAssessment | null> {
    // Check for an in-progress assessment first
    const { data: existing, error: fetchError } = await supabase
        .from('gm_assessments')
        .select('assessment_id, status, calibration_stage_id')
        .eq('respondent_user_id', userId)
        .eq('assessment_type', 'growth_mastery')
        .in('status', ['draft', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fetchError) {
        console.error('[gm-audit] Error checking existing assessment:', fetchError.message);
        return null;
    }

    if (existing) {
        return {
            assessmentId: existing.assessment_id,
            status: existing.status,
            calibrationStageId: existing.calibration_stage_id,
        };
    }

    // Create new assessment
    const { data: created, error: createError } = await supabase
        .from('gm_assessments')
        .insert({
            respondent_user_id: userId,
            assessment_type: 'growth_mastery',
            calibration_stage_id: gmStageId,
            status: 'draft',
            started_at: new Date().toISOString(),
        })
        .select('assessment_id, status, calibration_stage_id')
        .single();

    if (createError) {
        console.error('[gm-audit] Error creating assessment:', createError.message);
        return null;
    }

    return {
        assessmentId: created.assessment_id,
        status: created.status,
        calibrationStageId: created.calibration_stage_id,
    };
}

/**
 * Loads all previously saved responses for an assessment.
 * Returns a map of { [questionId]: responseOptionId }
 */
export async function loadSavedResponses(
    assessmentId: string
): Promise<Record<string, string>> {
    const { data, error } = await supabase
        .from('gm_assessment_responses')
        .select('question_id, response_option_id')
        .eq('assessment_id', assessmentId);

    if (error) {
        console.error('[gm-audit] Error loading saved responses:', error.message);
        return {};
    }

    const responseMap: Record<string, string> = {};
    for (const row of data ?? []) {
        if (row.question_id && row.response_option_id) {
            responseMap[row.question_id] = row.response_option_id;
        }
    }
    return responseMap;
}

/**
 * Upserts a batch of responses to gm_assessment_responses.
 * - questionCheckpointMap: { [questionId]: checkpointId } — needed for the checkpoint_id FK
 * - responses: { [questionId]: 'Y'|'S'|'N' } — the current UI state
 * - Only questions with a response value are saved (skips unanswered)
 * - Uses ON CONFLICT (assessment_id, question_id) DO UPDATE
 * - Also bumps the assessment status to 'in_progress' if it was 'draft'
 */
export async function saveResponses(
    assessmentId: string,
    responses: Record<string, string>,
    questionCheckpointMap: Record<string, string>, // { [questionId]: checkpointId }
): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const rows = Object.entries(responses)
        .filter(([questionId, optionKey]) => questionId && optionKey)
        .map(([questionId, optionKey]) => {
            const option = RESPONSE_OPTIONS[optionKey as ResponseKey];
            return {
                assessment_id: assessmentId,
                checkpoint_id: questionCheckpointMap[questionId] ?? null,
                question_id: questionId,
                response_option_id: option?.optionId ?? null,
                response_value: option?.score ?? null,
                response_text: option?.label ?? null,
                answered_at: now,
            };
        })
        .filter(r => r.response_option_id !== null);

    if (rows.length === 0) return { success: true };

    const { error } = await supabase
        .from('gm_assessment_responses')
        .upsert(rows, {
            onConflict: 'assessment_id,question_id',
            ignoreDuplicates: false,
        });

    if (error) {
        console.error('[gm-audit] Error saving responses:', error.message);
        return { success: false, error: error.message };
    }

    // Bump assessment status to 'in_progress' if still 'draft'
    await supabase
        .from('gm_assessments')
        .update({ status: 'in_progress', updated_at: now })
        .eq('assessment_id', assessmentId)
        .eq('status', 'draft');

    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Scoring Map
// ─────────────────────────────────────────────────────────────────────────────

/** Maps the UI option labels to response_option_ids and numeric scores */
export const RESPONSE_OPTIONS = {
    Y: { optionId: 'response_option_id_1', score: 2, label: 'Yes' },
    S: { optionId: 'response_option_id_2', score: 1, label: 'Somewhat' },
    N: { optionId: 'response_option_id_3', score: 0, label: 'No' },
} as const;

export type ResponseKey = keyof typeof RESPONSE_OPTIONS;

/** Converts a UI selection ('Y'|'S'|'N') to the stored response_option_id */
export function toOptionId(key: ResponseKey): string {
    return RESPONSE_OPTIONS[key].optionId;
}

/** Converts a stored response_option_id back to the UI key ('Y'|'S'|'N') */
export function fromOptionId(optionId: string): ResponseKey | null {
    for (const [key, val] of Object.entries(RESPONSE_OPTIONS)) {
        if (val.optionId === optionId) return key as ResponseKey;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Final Submission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finalises a GM assessment:
 * 1. Sets status = 'submitted' and submitted_at = now() on gm_assessments
 * 2. Calls gm_score_assessment(assessmentId) to populate all score tables
 * 3. Returns the scoring JSONB result (can be used to pre-load results page)
 */
export async function submitAssessment(
    assessmentId: string,
): Promise<{ success: boolean; scoreResult?: any; error?: string }> {
    const now = new Date().toISOString();

    // Step 1: Mark as submitted
    const { error: submitError } = await supabase
        .from('gm_assessments')
        .update({
            status: 'submitted',
            submitted_at: now,
            updated_at: now,
        })
        .eq('assessment_id', assessmentId);

    if (submitError) {
        console.error('[gm-audit] Failed to submit assessment:', submitError.message);
        return { success: false, error: submitError.message };
    }

    // Step 2: Invoke the scoring function
    const { data: scoreResult, error: scoreError } = await supabase
        .rpc('gm_score_assessment', { p_assessment_id: assessmentId });

    if (scoreError) {
        console.error('[gm-audit] Scoring function failed:', scoreError.message);
        // Assessment is still submitted — scoring failure is not fatal for the user
        return { success: true, error: `Submitted but scoring failed: ${scoreError.message}` };
    }

    console.log('[gm-audit] Assessment submitted and scored successfully:', assessmentId);
    return { success: true, scoreResult };
}
