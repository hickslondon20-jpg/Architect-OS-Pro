import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { Button, LoadingSpinner, Select } from '../../../components/ui';
import { DependencyNotice } from '../../../components/pro-suite/roadmap/DependencyNotice';
import { UltimateVisionBlock } from '../../../components/pro-suite/roadmap/UltimateVisionBlock';
import { HorizonDeclarationCard } from '../../../components/pro-suite/roadmap/HorizonDeclarationCard';

const horizonConfigs = {
    '12_month': {
        monthOffset: 12,
        visionKey: '12m_financial_primary_objective',
        synthesisKey: 'horizon_12_summary',
    },
    '24_month': {
        monthOffset: 24,
        visionKey: '24m_identity_stand_for',
        synthesisKey: 'horizon_24_summary',
    },
    '36_month': {
        monthOffset: 36,
        visionKey: '36m_optionality_available',
        synthesisKey: 'horizon_36_summary',
    },
} as const;

type HorizonKey = keyof typeof horizonConfigs;

const formatTargetDateFromBase = (baseDate: string | null | undefined, monthOffset: number) => {
    const target = baseDate ? new Date(baseDate) : new Date();
    target.setMonth(target.getMonth() + monthOffset);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
    }).format(target);
};

const formatSavedDate = (dateValue: string | null | undefined) => {
    if (!dateValue) return null;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(dateValue));
};

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value).replace(/[$,%\s,]/g, ''));

    return Number.isFinite(parsed) ? parsed : null;
};

const compactCurrency = (value: unknown) => {
    const amount = toNumber(value);
    if (amount === null || amount <= 0) return null;

    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}M`;
    if (amount >= 1000) return `$${Math.round(amount / 1000)}k`;
    return `$${Math.round(amount).toLocaleString()}`;
};

const compactNumber = (value: unknown, suffix = '') => {
    const amount = toNumber(value);
    if (amount === null || amount <= 0) return null;

    return `${Number.isInteger(amount) ? amount : amount.toFixed(1)}${suffix}`;
};

const compactPercent = (value: unknown) => {
    const rawAmount = toNumber(value);
    if (rawAmount === null || rawAmount <= 0) return null;
    const amount = rawAmount > 0 && rawAmount <= 1 ? rawAmount * 100 : rawAmount;

    return `${amount.toFixed(amount % 1 === 0 ? 0 : 1)}%`;
};

export const StrategicHorizonsTab: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [dependencies, setDependencies] = useState({
        mrAudit: false,
        aeLadder: false,
        clarityCompass: false
    });

    const [clarityData, setClarityData] = useState<{
        version: any;
        synthesis: any;
        snapshots: any[];
        draft: any;
    } | null>(null);
    const [clarityVersions, setClarityVersions] = useState<any[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string>('');
    const [gvsScenarios, setGvsScenarios] = useState<any[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const fetchDependenciesAndData = async () => {
            if (!user) return;

            try {
                // Check M&R Audit / Growth Mastery completion
                const { data: mrData } = await supabase
                    .from('gm_assessments')
                    .select('assessment_id, status')
                    .eq('respondent_user_id', user.id)
                    .in('status', ['submitted', 'scored', 'reported'])
                    .order('scored_at', { ascending: false, nullsFirst: false })
                    .order('submitted_at', { ascending: false, nullsFirst: false })
                    .limit(1);

                // Check AE Ladder
                const { data: aeData } = await supabase
                    .from('ae_assessments')
                    .select('ae_assessment_id, assessment_complete_flag')
                    .eq('user_id', user.id)
                    .eq('assessment_complete_flag', true)
                    .limit(1);

                const { data: completedVersions } = await supabase
                    .from('cc_versions')
                    .select('id, version_name, version_number, created_at, is_current_version, full_intake_payload')
                    .eq('user_id', user.id)
                    .eq('synthesis_status', 'complete')
                    .order('created_at', { ascending: false })
                    .limit(25);

                const versionOptions = completedVersions || [];
                setClarityVersions(versionOptions);

                const selectedVersion = selectedVersionId
                    ? versionOptions.find((version) => version.id === selectedVersionId)
                    : null;

                // Prefer the user's selected saved version, then the current completed
                // version, then the latest completed version if a newer current version
                // is still pending synthesis.
                const clarityVersion = selectedVersion
                    || versionOptions.find((version) => version.is_current_version)
                    || versionOptions[0]
                    || null;

                if (clarityVersion && !selectedVersionId) {
                    setSelectedVersionId(clarityVersion.id);
                }

                const { data: clarityVersionWithPayload } = clarityVersion?.full_intake_payload
                    ? { data: clarityVersion }
                    : clarityVersion
                        ? await supabase
                        .from('cc_versions')
                        .select('id, version_name, created_at, full_intake_payload')
                        .eq('id', clarityVersion.id)
                        .maybeSingle()
                        : { data: null };

                const { data: clarityDraft } = await supabase
                    .from('cc_drafts_global')
                    .select('form_data, scenario_tags, version_name, updated_at')
                    .eq('user_id', user.id)
                    .maybeSingle();

                let synthesis = null;
                let snapshots: any[] = [];
                let scenarios: any[] = [];

                if (clarityVersionWithPayload) {
                    const { data: synthesisData } = await supabase
                        .from('cc_synthesis')
                        .select('*')
                        .eq('version_id', clarityVersionWithPayload.id)
                        .eq('is_current', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    synthesis = synthesisData;

                    const { data: snapshotData } = await supabase
                        .from('cc_version_horizon_snapshots')
                        .select('horizon, field_selections, scenario_id')
                        .eq('version_id', clarityVersionWithPayload.id);

                    snapshots = snapshotData || [];
                }

                const draftScenarioIds = Object.values(clarityDraft?.scenario_tags || {});
                const scenarioIds = Array.from(new Set([
                    ...snapshots.map((snapshot) => snapshot.scenario_id),
                    ...draftScenarioIds
                ].filter(Boolean)));

                if (scenarioIds.length > 0) {
                    const { data: scenarioData } = await supabase
                        .from('gvs_saved_growth_scenarios')
                        .select('id, scenario_name, horizon_tag, gvi_score, inputs, results, synthesis_content')
                        .in('id', scenarioIds);

                    scenarios = scenarioData || [];
                }

                setDependencies({
                    mrAudit: !!(mrData && mrData.length > 0),
                    aeLadder: !!(aeData && aeData.length > 0),
                    clarityCompass: !!(clarityVersionWithPayload || clarityDraft)
                });

                if (clarityVersionWithPayload || clarityDraft) {
                    setClarityData({
                        version: clarityVersionWithPayload,
                        synthesis,
                        snapshots,
                        draft: clarityDraft
                    });
                }

                setGvsScenarios(scenarios);

            } catch (error) {
                console.error("Error fetching roadmap dependencies:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDependenciesAndData();
    }, [user, selectedVersionId]);

    const isFullyUnlocked = dependencies.mrAudit && dependencies.aeLadder && dependencies.clarityCompass;

    const handleConfirmAndGenerate = () => {
        setIsGenerating(true);
        // Simulate API call to generate synthesis
        setTimeout(() => {
            setIsGenerating(false);
            navigate('/pro/planning/roadmap/12-month-plan');
        }, 3000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingSpinner className="h-8 w-8" style={{ color: 'var(--aos-brass)' }} />
            </div>
        );
    }

    const ultimateVisionText = clarityData?.synthesis?.ultimate_vision_oneliner || null;

    const getHorizonData = (horizonId: HorizonKey) => {
        const config = horizonConfigs[horizonId];
        const snapshot = clarityData?.snapshots.find((item) => item.horizon === horizonId);
        const fieldSelections = snapshot?.field_selections || {};
        const fallbackFormData = clarityData?.version?.full_intake_payload?.formData || {};
        const draftFormData = clarityData?.draft?.form_data || {};
        const draftScenarioTags = clarityData?.draft?.scenario_tags || {};
        const draftScenarioId = draftScenarioTags[horizonId.replace('_', '-')];
        const scenarioId = snapshot?.scenario_id || draftScenarioId;
        const scenario = gvsScenarios.find((item) => item.id === scenarioId);
        const scenarioTarget = scenario?.gvi_score ? `GVI score ${scenario.gvi_score}` : undefined;

        return {
            dateStr: formatTargetDateFromBase(
                clarityData?.version?.created_at || clarityData?.draft?.updated_at,
                config.monthOffset
            ),
            vision: fieldSelections[config.visionKey] || fallbackFormData[config.visionKey] || draftFormData[config.visionKey] || null,
            scenarioName: scenario?.scenario_name,
            scenarioTarget,
            synthesis: clarityData?.synthesis?.[config.synthesisKey],
            vitals: getScenarioVitals(scenario)
        };
    };

    const getScenarioVitals = (scenario: any) => {
        const raw = scenario?.inputs?.raw || {};
        const resolved = scenario?.inputs?.resolved || scenario?.results?.resolved || {};

        return [
            {
                label: 'Revenue',
                value: compactCurrency(raw.targetGrossRevenue || resolved.targetGrossRevenue)
            },
            {
                label: 'AGI',
                value: compactCurrency(raw.targetAGI || resolved.targetAGI || raw.targetRevenue)
            },
            {
                label: 'Margin',
                value: compactPercent(raw.targetMargin || resolved.targetMargin)
            },
            {
                label: 'Team',
                value: compactNumber(raw.targetFTEs || resolved.targetFTEs, ' FTE')
            }
        ];
    };

    const h12 = getHorizonData('12_month');
    const h24 = getHorizonData('24_month');
    const h36 = getHorizonData('36_month');
    const lockedAtLabel = formatSavedDate(clarityData?.version?.created_at || clarityData?.draft?.updated_at);
    const selectedVersion = clarityVersions.find((version) => version.id === selectedVersionId) || clarityData?.version;

    return (
        <div className="mx-auto max-w-4xl space-y-8 pb-16 pt-3 animate-in fade-in duration-500">
            <div className="mx-auto max-w-2xl text-center">
                <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>Roadmap Input</div>
                <h2 className="aos-h1">Horizon Declaration</h2>
                <p className="aos-body mt-3" style={{ color: 'var(--fg-2)' }}>
                    Review your directional intent below. Confirming this configuration will generate your synthesis and quarter focus.
                </p>
            </div>

            <div className="space-y-6">
                <div
                    className="rounded-[var(--radius-xs)] p-5"
                    style={{
                        background: 'var(--bg-surface)',
                        border: 'var(--border-hairline)',
                        boxShadow: 'var(--shadow-soft-1)',
                    }}
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="aos-eyebrow mb-2">Clarity Compass Source</div>
                            <h3 className="aos-h3">Select the saved vision set for this roadmap</h3>
                            <p className="aos-small mt-2">
                                These declarations are populated from saved Clarity Compass instances. Choose the version that should serve as the source for the Ultimate, 12-, 24-, and 36-month horizons below.
                            </p>
                        </div>
                        <div className="w-full lg:w-80">
                            <Select
                                value={selectedVersionId}
                                onChange={(event) => setSelectedVersionId(event.target.value)}
                                disabled={clarityVersions.length === 0}
                            >
                                {clarityVersions.length === 0 ? (
                                    <option value="">No saved versions found</option>
                                ) : (
                                    clarityVersions.map((version) => (
                                        <option key={version.id} value={version.id}>
                                            {version.version_name || `Version ${version.version_number || ''}`} - {formatSavedDate(version.created_at)}
                                        </option>
                                    ))
                                )}
                            </Select>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 border-t pt-4 text-xs md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--aos-mist)', color: 'var(--fg-3)' }}>
                        <span>
                            {selectedVersion
                                ? `Currently reviewing ${selectedVersion.version_name || 'saved Clarity Compass version'}${formatSavedDate(selectedVersion.created_at) ? `, saved ${formatSavedDate(selectedVersion.created_at)}` : ''}.`
                                : 'Create and save a Clarity Compass version to populate this declaration.'}
                        </span>
                        <Link to="/foundations/clarity-compass" className="font-medium underline underline-offset-2" style={{ color: 'var(--aos-brass)' }}>
                            Create or update in Clarity Compass &rarr;
                        </Link>
                    </div>
                </div>

                <UltimateVisionBlock text={ultimateVisionText} />

                <div className="space-y-5">
                    <HorizonDeclarationCard
                        horizonLabel="12-Month Horizon"
                        targetDate={h12.dateStr}
                        visionStatement={h12.vision}
                        scenarioName={h12.scenarioName}
                        scenarioTarget={h12.scenarioTarget}
                        oneLineSynthesis={h12.synthesis}
                        vitals={h12.vitals}
                        refinementHref="/foundations/clarity-compass"
                    />

                    <HorizonDeclarationCard
                        horizonLabel="24-Month Horizon"
                        targetDate={h24.dateStr}
                        visionStatement={h24.vision}
                        scenarioName={h24.scenarioName}
                        scenarioTarget={h24.scenarioTarget}
                        oneLineSynthesis={h24.synthesis}
                        vitals={h24.vitals}
                        refinementHref="/foundations/clarity-compass"
                    />

                    <HorizonDeclarationCard
                        horizonLabel="36-Month Horizon"
                        targetDate={h36.dateStr}
                        visionStatement={h36.vision}
                        scenarioName={h36.scenarioName}
                        scenarioTarget={h36.scenarioTarget}
                        oneLineSynthesis={h36.synthesis}
                        vitals={h36.vitals}
                        refinementHref="/foundations/clarity-compass"
                    />
                </div>

                <p
                    className="rounded-[var(--radius-xs)] px-4 py-3 text-xs leading-relaxed"
                    style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)', color: 'var(--fg-3)' }}
                >
                    {lockedAtLabel && <>Horizon dates are anchored to the saved declaration from {lockedAtLabel}. </>}
                    Blank vitals mean the tagged Growth Velocity scenario does not include that data; update or tag a scenario in Clarity Compass to include it.
                </p>

                <div className="border-t pt-6" style={{ borderColor: 'var(--aos-mist)' }}>
                    {!isFullyUnlocked && (
                        <div className="mb-6">
                            <DependencyNotice
                                missingDependencies={[
                                    ...(!dependencies.mrAudit ? [{ id: "mr-audit", label: "M&R Audit", path: "/diagnostics/mr-audit/assessment" }] : []),
                                    ...(!dependencies.aeLadder ? [{ id: "ae-ladder", label: "AE Stage", path: "/diagnostics/ae-ladder/assessment" }] : []),
                                    ...(!dependencies.clarityCompass ? [{ id: "clarity-compass", label: "Clarity Compass", path: "/foundations/clarity-compass" }] : [])
                                ]}
                            />
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto px-8"
                            onClick={() => navigate('/foundations/clarity-compass')}
                        >
                            Refine Vision
                        </Button>
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-full sm:w-auto px-12"
                            onClick={handleConfirmAndGenerate}
                            disabled={!isFullyUnlocked || isGenerating}
                        >
                            {isGenerating ? (
                                <><LoadingSpinner className="mr-2 h-4 w-4" /> Generating Synthesis...</>
                            ) : (
                                "Lock In Horizon"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
