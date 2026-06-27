import React, { useEffect, useState } from 'react';
import { LockedState } from './shared/LockedState';
import { HeroStageHeader } from './results/HeroStageHeader';
import { ScoreSnapshot } from './results/ScoreSnapshot';
import { StrengthsGaps } from './results/StrengthsGaps';
import { SignalsIdentity } from './results/SignalsIdentity';
import { FocusPriorities } from './results/FocusPriorities';
import { AEDashboardRow, AEStageContextRow } from './types';
import { Button } from '../../ui';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { FrameworkLadder } from './results/FrameworkLadder';
import { StageContextMeaning } from './results/StageContextMeaning';
import { StageContextPosition } from './results/StageContextPosition';
import { NextMilestoneCTA } from './results/NextMilestoneCTA';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

export const AEResultsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [data, setData] = useState<AEDashboardRow | null>(null);
    const [stageContext, setStageContext] = useState<AEStageContextRow | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Step 1: Find the most recent completed assessment for this user
                const { data: assessmentMeta, error: metaError } = await supabase
                    .from('ae_assessments')
                    .select('ae_assessment_id, assessment_complete_flag')
                    .eq('user_id', user.id)
                    .eq('assessment_complete_flag', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (metaError) throw metaError;

                if (!assessmentMeta) {
                    // No completed assessment — show locked state
                    setIsLocked(true);
                    setIsLoading(false);
                    return;
                }

                // Step 2: Fetch full dashboard payload from the view
                const { data: viewData, error: viewError } = await supabase
                    .from('vw_ae_dashboard_results')
                    .select('*')
                    .eq('ae_assessment_id', assessmentMeta.ae_assessment_id)
                    .single();

                if (viewError) throw viewError;

                console.log('[AE Dashboard] vw_ae_dashboard_results payload:', viewData);
                setData(viewData as AEDashboardRow);

                // Step 3: Fetch Stage Context payload
                const { data: contextData, error: contextError } = await supabase
                    .from('vw_ae_stage_context')
                    .select('*')
                    .eq('ae_assessment_id', assessmentMeta.ae_assessment_id)
                    .single();

                if (contextError) {
                    console.error('[AE Dashboard] Error fetching stage context:', contextError);
                    // Non-fatal error for now, continue rendering dashboard
                } else {
                    console.log('[AE Dashboard] vw_ae_stage_context payload:', contextData);
                    setStageContext(contextData as AEStageContextRow);
                }
            } catch (err: any) {
                console.error('[AE Dashboard] Error fetching dashboard data:', err);
                setError(err.message || 'Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-[var(--aos-brass)] animate-spin" />
                <p className="text-[var(--fg-3)] text-sm">Loading your results...</p>
            </div>
        );
    }

    if (isLocked) {
        return <LockedState title="Detailed Insights Locked" message="Your personalized results dashboard is locked. Complete the assessment to reveal your stage, scores, and focus priorities." />;
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-[var(--aos-risk)] font-medium">Error loading dashboard</p>
                <p className="text-[var(--fg-3)] text-sm">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    // Stage Deep Dive tab still uses the static content map

    const dimensionsList = [
        {
            id: 'financial',
            name: 'Financial & Business Health',
            avgScore: parseFloat(String(data.financial_avg ?? 0)),
            delta: 0,
            deviationBucket: 'at_overall' as const,
            bandSummaryLabel: data.financial_band_label ?? '',
            signalTag: data.financial_signal_tag ?? '',
            dimensionInsight: data.financial_dimension_insight ?? null,
            isStrongStrength: false,
            isModerateStrength: false,
            isModerateGap: false,
            isStrongGap: false,
        },
        {
            id: 'clients',
            name: 'Client Base & Positioning',
            avgScore: parseFloat(String(data.client_avg ?? 0)),
            delta: 0,
            deviationBucket: 'at_overall' as const,
            bandSummaryLabel: data.client_band_label ?? '',
            signalTag: data.client_signal_tag ?? '',
            dimensionInsight: data.clients_dimension_insight ?? null,
            isStrongStrength: false,
            isModerateStrength: false,
            isModerateGap: false,
            isStrongGap: false,
        },
        {
            id: 'ops',
            name: 'Operational Systems',
            avgScore: parseFloat(String(data.ops_avg ?? 0)),
            delta: 0,
            deviationBucket: 'at_overall' as const,
            bandSummaryLabel: data.ops_band_label ?? '',
            signalTag: data.ops_signal_tag ?? '',
            dimensionInsight: data.ops_dimension_insight ?? null,
            isStrongStrength: false,
            isModerateStrength: false,
            isModerateGap: false,
            isStrongGap: false,
        },
        {
            id: 'team',
            name: 'Team & Leadership',
            avgScore: parseFloat(String(data.team_avg ?? 0)),
            delta: 0,
            deviationBucket: 'at_overall' as const,
            bandSummaryLabel: data.team_band_label ?? '',
            signalTag: data.team_signal_tag ?? '',
            dimensionInsight: data.team_dimension_insight ?? null,
            isStrongStrength: false,
            isModerateStrength: false,
            isModerateGap: false,
            isStrongGap: false,
        },
        {
            id: 'stewardship',
            name: 'Strategic Stewardship',
            avgScore: parseFloat(String(data.stewardship_avg ?? 0)),
            delta: 0,
            deviationBucket: 'at_overall' as const,
            bandSummaryLabel: data.stewardship_band_label ?? '',
            signalTag: data.stewardship_signal_tag ?? '',
            dimensionInsight: data.stewardship_dimension_insight ?? null,
            isStrongStrength: false,
            isModerateStrength: false,
            isModerateGap: false,
            isStrongGap: false,
        },
    ];

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-700">
            <Tabs defaultValue="overview" className="w-full">
                <div className="flex justify-center mb-8">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="overview">Results Overview</TabsTrigger>
                        <TabsTrigger value="deep-dive">Stage Context</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-12 focus-visible:outline-none ring-offset-background">
                    {/* 1. Hero */}
                    <HeroStageHeader
                        stageLabel={data.ae_frontend_stage as any}
                        tagline={data.ae_stage_tagline ?? data.ae_frontend_stage}
                        description={data.stage_brief_interpretation ?? data.ae_stage_description ?? ''}
                        overallScore={parseFloat(String(data.overall_score))}
                        completedAt={data.submitted_at ?? new Date().toISOString()}
                        overallSynthesis={data.strategic_insights_overall}
                    />

                    {/* 2. Score Snapshot */}
                    <ScoreSnapshot
                        dimensions={dimensionsList}
                        overallScore={parseFloat(String(data.overall_score))}
                    />

                    {/* 3. Strengths & Gaps (Executive Summary) */}
                    <StrengthsGaps
                        execSummaryStrength={data.exec_summary_strength}
                        execSummaryFriction={data.exec_summary_friction}
                    />

                    {/* 4. Signals Identity */}
                    <SignalsIdentity
                        stageDescription={data.ae_stage_description}
                        headlineStrength={data.signal_headline_strength}
                        headlineFriction={data.signal_headline_friction}
                        headlineSynthesis={data.signal_headline_synthesis}
                    />

                    {/* 5. Focus Priorities */}
                    <FocusPriorities
                        focusPoints={[
                            data.focus_point_1,
                            data.focus_point_2,
                            data.focus_point_3,
                            data.focus_point_4
                        ]}
                    />

                    {/* 6. Download & CTA */}
                    {stageContext && (
                        <div className="pt-8 mt-12 border-t border-[var(--aos-mist)]">
                            <NextMilestoneCTA context={stageContext} />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="deep-dive" className="space-y-12 focus-visible:outline-none ring-offset-background w-full pt-4">
                    {stageContext ? (
                        <>
                            <FrameworkLadder context={stageContext} />
                            <StageContextMeaning context={stageContext} />
                            <StageContextPosition context={stageContext} />
                            <NextMilestoneCTA context={stageContext} />
                        </>
                    ) : (
                        <div className="text-center py-12 text-[var(--fg-3)]">
                            Stage context data not available.
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};
