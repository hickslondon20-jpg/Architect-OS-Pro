import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, Button, Input, Select, Label, Badge } from '../../ui';
import { RefreshCw, Edit2, TrendingUp, TrendingDown, Minus, Play, Check, ChevronRight } from 'lucide-react';
import { PRESETS, calculatePresetTargets } from '../../../lib/presetScenarios';
import { resolveVariables, calculateGVIScore, GVIInputs, GVIScoreResult, ResolvedVariables } from '../../../lib/gviCalculations';
import { generatePressureContent, generateSynthesis } from '../../../lib/gviSynthesis';

interface ScenarioPlannerInputsProps {
    onViewComparison?: () => void;
}

export const ScenarioPlannerInputs: React.FC<ScenarioPlannerInputsProps> = ({ onViewComparison }) => {
    // --- STATE - BLOCK 1: BASELINE ---
    const [isLoadingBaseline, setIsLoadingBaseline] = useState(true);
    const [source, setSource] = useState<'snapshot' | 'custom'>('snapshot');

    const [baseline, setBaseline] = useState({
        revenue: 0,
        agi: 0,
        margin: 0,
        clients: 0,
        acv: 0,
        retention: 0,
        team: 0
    });

    // --- STATE - BLOCK 2: TARGET ---
    const [timeframe, setTimeframe] = useState<number>(24);
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [targets, setTargets] = useState({
        revenue: 0,
        agi: 0,
        margin: 0,
        clients: 0,
        acv: 0,
        retention: 0,
        team: 0
    });

    // --- STATE - UI FOR TARGETS ---
    const [editingField, setEditingField] = useState<keyof typeof targets | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // --- STATE - BLOCK 3: RUN & SAVE ---
    const [isRunning, setIsRunning] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [runtimeScenarioId, setRuntimeScenarioId] = useState<string | null>(null);
    const [scenarioName, setScenarioName] = useState<string>('');
    const [resultScore, setResultScore] = useState<number | null>(null);
    const [resultBand, setResultBand] = useState<string>('');
    const [resultComposition, setResultComposition] = useState<string>('');

    // --- FETCH BASELINE DATA ---
    const fetchSnapshotData = async () => {
        setIsLoadingBaseline(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsLoadingBaseline(false);
                return;
            }

            // Fetch from 3 tables
            const { data: finData } = await supabase
                .from('agency_snapshot_economic_foundation')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const { data: revData } = await supabase
                .from('agency_snapshot_revenue_model')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const { data: teamData } = await supabase
                .from('agency_snapshot_team_delivery')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (finData || revData || teamData) {
                const agi = finData?.annual_agi_run_rate || 0;
                const clients = revData?.active_client_count || 0;
                const acv = (agi && clients) ? Math.round(agi / clients) : 0;
                const churn = revData?.monthly_churn_rate || 0;
                const retention = 100 - (churn * 12);

                const newBaseline = {
                    revenue: finData?.annual_revenue_run_rate || 0,
                    agi: agi,
                    margin: finData?.profit_margin_percentage || 0,
                    clients: clients,
                    acv: acv,
                    retention: retention > 0 ? retention : 0,
                    team: teamData?.total_team_size_fte || 0
                };

                setBaseline(newBaseline);
                // Initialize targets with baseline
                setTargets(newBaseline);
                setSource('snapshot');
            } else {
                setSource('custom');
            }
        } catch (error) {
            console.error("Error fetching snapshot data:", error);
            setSource('custom');
        } finally {
            setIsLoadingBaseline(false);
        }
    };

    useEffect(() => {
        fetchSnapshotData();
    }, []);

    const formatCurrency = (val: number) => `$${Math.round(val).toLocaleString()}`;
    const formatNumber = (val: number) => Math.round(val).toLocaleString();
    const formatPercent = (val: number) => `${Math.round(val)}%`;

    // --- HANDLERS - BLOCK 1 ---
    const handleBaselineChange = (field: keyof typeof baseline, value: string) => {
        setSource('custom');
        const numValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
        const newBaseline = { ...baseline, [field]: numValue };
        setBaseline(newBaseline);

        // Auto-update targets if they haven't been customized yet? 
        // For simplicity, we just update baseline now.
    };

    const handleSync = () => {
        fetchSnapshotData();
    };

    // --- HANDLERS - BLOCK 2 ---
    const handlePresetClick = (presetId: string) => {
        setSelectedPreset(presetId);

        // Format for calculatePresetTargets
        const currentInputs = {
            currentRevenue: baseline.agi.toString(), // AGI is what presets use as baseRevenue
            currentMargin: baseline.margin.toString(),
            currentTeam: baseline.team.toString(),
            currentClients: baseline.clients.toString(),
            currentRetention: baseline.retention.toString(),
            currentACV: baseline.acv.toString(),
            currentMarginType: 'percent' as const
        };

        const calculated = calculatePresetTargets(currentInputs, presetId);

        setTargets({
            ...baseline, // fallback to baseline if preset doesn't modify
            revenue: calculated.targetGrossRevenue ? parseFloat(calculated.targetGrossRevenue.replace(/,/g, '')) : baseline.revenue,
            agi: calculated.targetRevenue ? parseFloat(calculated.targetRevenue.replace(/,/g, '')) : baseline.agi,
            margin: calculated.targetMarginValue ? parseFloat(calculated.targetMarginValue) : baseline.margin,
            clients: calculated.targetClients ? parseFloat(calculated.targetClients.replace(/,/g, '')) : baseline.clients,
            acv: calculated.targetACV ? parseFloat(calculated.targetACV.replace(/,/g, '')) : baseline.acv,
            retention: calculated.targetRetention ? parseFloat(calculated.targetRetention) : baseline.retention,
            team: calculated.targetTeam ? parseFloat(calculated.targetTeam.replace(/,/g, '')) : baseline.team,
        });
    };

    const handleTargetSliderChange = (field: keyof typeof targets, percentageChange: number) => {
        setSelectedPreset('');
        const baseValue = baseline[field];
        let newValue = baseValue;

        if (field === 'margin' || field === 'retention') {
            // Absolute point change for percentages
            newValue = baseValue + percentageChange;
            // Clamp retention 0-100
            if (field === 'retention') newValue = Math.min(100, Math.max(0, newValue));
        } else {
            // Relative percentage change for absolute numbers
            newValue = baseValue * (1 + (percentageChange / 100));
        }

        setTargets({ ...targets, [field]: newValue });
    };

    const handleTargetEditClick = (field: keyof typeof targets) => {
        setEditingField(field);
        setEditValue(Math.round(targets[field]).toString());
    };

    const handleTargetEditBlur = (field: keyof typeof targets) => {
        setEditingField(null);
        setSelectedPreset('');
        const numValue = parseFloat(editValue.replace(/[^0-9.-]/g, '')) || 0;
        setTargets({ ...targets, [field]: numValue });
    };

    // Auto-generate name based on major changes
    const generateScenarioName = () => {
        let name = "Custom Scenario";
        if (selectedPreset) {
            const preset = PRESETS.find(p => p.id === selectedPreset);
            if (preset) name = `${preset.label} (${timeframe}mo)`;
        } else {
            const agiChange = baseline.agi ? ((targets.agi - baseline.agi) / baseline.agi) * 100 : 0;
            name = `Growth Plan ${Math.round(agiChange)}% AGI`;
        }
        return name;
    }

    // --- HANDLERS - BLOCK 3 ---
    const handleRunAnalysis = async () => {
        setIsRunning(true);

        // 1. Prepare Inputs
        const inputData: GVIInputs = {
            currentAGI: baseline.agi,
            currentClients: baseline.clients,
            currentRetainer: baseline.retention,
            currentFTEs: baseline.team,
            currentMargin: baseline.margin,

            targetAGI: targets.agi,
            targetClients: targets.clients,
            targetACV: targets.acv,
            targetFTEs: targets.team,
            targetMargin: targets.margin,
            timeframeMonths: timeframe
        };

        // 2. Run Calculation
        const resolved = resolveVariables(inputData);
        const result = calculateGVIScore(resolved);
        const initialPressure = generatePressureContent(result);

        // 3. Save to Supabase (Runtime Record)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('agency_id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                const agencyId = userData?.agency_id || null;

                // Normalize results to match spec contract — engine uses 'score', spec mandates 'gviScore'
                const normalizedResults = { ...result, gviScore: result.score };

                const insertPayload = {
                    user_id: user.id,
                    agency_id: agencyId,
                    inputs: { raw: inputData, resolved: resolved },
                    results: normalizedResults,
                    implications: initialPressure,
                    synthesis_content: null,
                    gvi_score: result.score,
                    status: 'pending',
                    is_saved: false
                };

                const { data, error } = await supabase
                    .from('gvs_growth_scenarios')
                    .insert([insertPayload])
                    .select()
                    .single();

                if (data) {
                    setRuntimeScenarioId(data.id);

                    // Trigger n8n webhook
                    const webhookUrl = import.meta.env.VITE_N8N_GVS_WEBHOOK_URL || 'https://architectos.app.n8n.cloud/webhook/gvs-run';
                    fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ record_id: data.id })
                    }).catch(e => console.error("Webhook failed:", e));

                    // Setup realtime subscription
                    const channel = supabase.channel(`gvs_updates_${data.id}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'gvs_growth_scenarios',
                                filter: `id=eq.${data.id}`
                            },
                            (payload) => {
                                const newRecord = payload.new as any;
                                if (newRecord.status === 'complete' && newRecord.synthesis_content) {
                                    // Normally we would set synthesis here, but for this ScenarioPlanner Inputs 
                                    // we only care about completion for the next view. 
                                    // Currently, ScenarioPlanner Inputs stops after the Save step.
                                }
                                if (newRecord.status === 'complete') {
                                    supabase.removeChannel(channel);
                                }
                            }
                        )
                        .subscribe();
                } else if (error) {
                    console.error("Failed to insert runtime record:", error);
                }
            }
        } catch (err) {
            console.error(err);
        }

        // 4. Update UI
        setResultScore(result.score);
        setResultBand(result.band);
        setResultComposition(result.compositionLabel);
        setScenarioName(generateScenarioName());

        setIsRunning(false);
    };

    const handleSaveScenario = async () => {
        if (!runtimeScenarioId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Mark runtime as saved — flip is_saved and set saved_at timestamp
            await supabase
                .from('gvs_growth_scenarios')
                .update({ is_saved: true, saved_at: new Date().toISOString() })
                .eq('id', runtimeScenarioId);

            const { data: userData } = await supabase
                .from('users')
                .select('agency_id')
                .eq('user_id', user.id)
                .maybeSingle();
            const agencyId = userData?.agency_id || null;

            // Note: Since ScenarioPlanner Inputs is just the input block, we construct a 
            // partial save wrapper. It would be ideal to have the raw inputData.
            const inputData: GVIInputs = {
                currentAGI: baseline.agi,
                currentClients: baseline.clients,
                currentRetainer: baseline.retention,
                currentFTEs: baseline.team,
                currentMargin: baseline.margin,
                targetAGI: targets.agi,
                targetClients: targets.clients,
                targetACV: targets.acv,
                targetFTEs: targets.team,
                targetMargin: targets.margin,
                timeframeMonths: timeframe
            };

            const resolved = resolveVariables(inputData);
            const result = calculateGVIScore(resolved);
            const initialPressure = generatePressureContent(result);

            // Insert into saved scenarios
            const normalizedResults = { ...result, gviScore: result.score };
            const insertPayload = {
                user_id: user.id,
                agency_id: agencyId,
                runtime_scenario_id: runtimeScenarioId,
                scenario_name: scenarioName,
                gvi_score: result.score,
                inputs: { raw: inputData, resolved: resolved },
                results: normalizedResults,
                implications: initialPressure,
                synthesis_content: generateSynthesis(result)
            };

            const { data, error } = await supabase
                .from('gvs_saved_growth_scenarios')
                .insert([insertPayload])
                .select()
                .single();

            if (data) {
                setIsSaved(true);
                setSaveError(null);
            } else if (error) {
                if (error.code === '23505') {
                    setSaveError("A scenario with this name and exact inputs already exists. Please use a different name or adjust the inputs.");
                } else {
                    console.error("Failed to save scenario:", error);
                    setSaveError("Failed to save scenario. Please try again.");
                }
            }
        } catch (err) {
            console.error(err);
            setSaveError("An unexpected error occurred while saving.");
        }
    };

    const handleBuildAnother = () => {
        // Reset Block 2 and 3
        setTargets(baseline);
        setSelectedPreset('');
        setResultScore(null);
        setIsSaved(false);
        setSaveError(null);
        setRuntimeScenarioId(null);
    };

    // --- RENDER HELPERS ---
    const renderTargetRow = (
        label: string,
        field: keyof typeof targets,
        formatter: (val: number) => string,
        isPercentageType: boolean = false,
        minSlider: number = -50,
        maxSlider: number = 150
    ) => {
        const baseValue = baseline[field];
        const targetValue = targets[field];

        let percentageChange = 0;
        if (isPercentageType) {
            percentageChange = targetValue - baseValue; // Absolute point change
        } else {
            percentageChange = baseValue !== 0 ? ((targetValue - baseValue) / baseValue) * 100 : 0;
        }

        const isPositive = percentageChange > 0;
        const isNegative = percentageChange < 0;
        const isZero = percentageChange === 0;

        return (
            <div className="py-4 border-b border-[var(--aos-mist)] last:border-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center group">
                {/* Label & Badge */}
                <div className="md:col-span-3 flex justify-between items-center">
                    <Label className="mb-0 text-sm font-medium text-[var(--fg-2)]">{label}</Label>
                    <Badge variant={isZero ? "secondary" : isPositive ? "default" : "destructive"}
                        className={isZero ? "bg-[var(--bg-canvas)] text-[var(--fg-2)]" : isPositive ? "bg-[var(--aos-success-tint)] text-[var(--aos-success)]" : "bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]"}>
                        {isPositive ? '+' : ''}{Math.round(percentageChange)}{isPercentageType ? 'pp' : '%'}
                    </Badge>
                </div>

                {/* Slider */}
                <div className="md:col-span-6 px-4">
                    <input
                        type="range"
                        min={minSlider}
                        max={maxSlider}
                        value={percentageChange}
                        onChange={(e) => handleTargetSliderChange(field, parseFloat(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer
                            ${isPositive ? 'bg-[var(--aos-success-tint)] accent-[var(--aos-success)]' :
                                isNegative ? 'bg-[var(--aos-warning-tint)] accent-[var(--aos-warning)]' : 'bg-[var(--aos-mist)] accent-[var(--fg-3)]'}`}
                    />
                    <div className="flex justify-between text-[10px] text-[var(--fg-4)] mt-1 px-1">
                        <span>{isPercentageType ? `${minSlider}pp` : `${minSlider}%`}</span>
                        <span>0</span>
                        <span>{isPercentageType ? `+${maxSlider}pp` : `+${maxSlider}%`}</span>
                    </div>
                </div>

                {/* Value & Baseline Ref */}
                <div className="md:col-span-3 text-right">
                    {editingField === field ? (
                        <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleTargetEditBlur(field)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTargetEditBlur(field)}
                            className="text-right py-1 h-8 mb-1 w-full max-w-[120px] ml-auto"
                            autoFocus
                        />
                    ) : (
                        <div
                            className="text-lg font-bold text-[var(--fg-1)] cursor-pointer flex items-center justify-end gap-2 hover:text-[var(--aos-insight)]"
                            onClick={() => handleTargetEditClick(field)}
                        >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="h-3 w-3" /></span>
                            {formatter(targetValue)}
                        </div>
                    )}
                    <div className="text-xs text-[var(--fg-4)] mt-0.5">
                        vs. {formatter(baseValue)} base
                    </div>
                </div>
            </div>
        );
    };


    if (isLoadingBaseline) {
        return <div className="p-12 text-center text-[var(--fg-3)]">Loading Baseline Data...</div>;
    }

    return (
        <div className="space-y-8 pb-32 max-w-5xl mx-auto">

            {/* --- BLOCK 1: BASELINE CONFIGURATION --- */}
            <Card className="p-6 overflow-hidden">
                <div className="flex justify-between items-start mb-6 border-b border-[var(--aos-mist)] pb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            1. Baseline Configuration
                        </h2>
                        <p className="text-sm text-[var(--fg-3)] mt-1">Review or adjust your agency's current state.</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {source === 'snapshot' ? (
                            <Badge className="bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]">
                                <Check className="h-3 w-3 mr-1" /> Using Snapshot Data
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[var(--aos-warning)] border-[var(--aos-warning)] bg-[var(--aos-warning-tint)]">
                                Custom Baseline
                            </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleSync} className="h-8 text-xs text-[var(--fg-3)] hover:text-[var(--fg-1)]">
                            <RefreshCw className="h-3 w-3 mr-1" /> Sync Snapshot
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Annual AGI</Label>
                        <Input value={baseline.agi} onChange={(e) => handleBaselineChange('agi', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Gross Revenue</Label>
                        <Input value={baseline.revenue} onChange={(e) => handleBaselineChange('revenue', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Profit Margin (%)</Label>
                        <Input value={baseline.margin} onChange={(e) => handleBaselineChange('margin', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Avg. Deal Value (ACV)</Label>
                        <Input value={baseline.acv} onChange={(e) => handleBaselineChange('acv', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Active Clients</Label>
                        <Input value={baseline.clients} onChange={(e) => handleBaselineChange('clients', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Retention Rate (%)</Label>
                        <Input value={baseline.retention} onChange={(e) => handleBaselineChange('retention', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs text-[var(--fg-3)] uppercase">Team Size (FTEs)</Label>
                        <Input value={baseline.team} onChange={(e) => handleBaselineChange('team', e.target.value)} />
                    </div>
                </div>
            </Card>

            {/* --- BLOCK 2: SCENARIO TARGET CONFIGURATION --- */}
            <Card className="p-6">
                <div className="flex justify-between items-end mb-8 border-b border-[var(--aos-mist)] pb-4">
                    <div>
                        <h2 className="text-xl font-bold">2. Scenario Targets</h2>
                        <p className="text-sm text-[var(--fg-3)] mt-1">Adjust sliders or use a preset to set future state goals.</p>
                    </div>

                    <div className="w-48 text-right">
                        <Label className="text-xs uppercase text-[var(--fg-3)]">Timeframe</Label>
                        <Select value={timeframe.toString()} onChange={(e) => setTimeframe(parseInt(e.target.value))} className="mt-1">
                            <option value="12">12 Months</option>
                            <option value="24">24 Months</option>
                            <option value="36">36 Months</option>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                    {PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => handlePresetClick(preset.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedPreset === preset.id
                                ? 'bg-[var(--aos-brass)] text-[var(--fg-on-dark)] border-[var(--aos-brass)] shadow-md transform scale-105'
                                : 'bg-[var(--bg-surface)] text-[var(--fg-2)] border-[var(--aos-mist)] hover:border-[var(--aos-brass-soft)] hover:bg-[var(--aos-brass-tint)]'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    {renderTargetRow('Target Annual AGI', 'agi', formatCurrency)}
                    {renderTargetRow('Target Gross Rev', 'revenue', formatCurrency)}
                    {renderTargetRow('Target Profit Margin', 'margin', formatPercent, true, -20, 30)}
                    {renderTargetRow('Target ACV', 'acv', formatCurrency)}
                    {renderTargetRow('Target Client Count', 'clients', formatNumber)}
                    {renderTargetRow('Target Retention Rate', 'retention', formatPercent, true, -20, 20)}
                    {renderTargetRow('Target Team Size', 'team', formatNumber)}
                </div>
            </Card>

            {/* --- BLOCK 3: RUN & SAVE CONFIGURATION --- */}
            <Card className="p-6 text-center border-[var(--aos-mist)] bg-[var(--bg-surface)]">
                {!resultScore && !isRunning && (
                    <div className="max-w-md mx-auto">
                        <Button
                            onClick={handleRunAnalysis}
                            className="w-full py-6 text-lg bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] text-[var(--fg-on-dark)] rounded-xl shadow-[var(--shadow-soft-2)] transition-all"
                        >
                            <Play className="h-5 w-5 mr-2 fill-current" /> Run Scenario Analysis
                        </Button>
                    </div>
                )}

                {isRunning && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--aos-brass)]"></div>
                        <p className="text-[var(--fg-2)] font-medium">Running Growth Formula & Simulating Pressures...</p>
                    </div>
                )}

                {resultScore && !isSaved && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="max-w-2xl mx-auto bg-[var(--bg-surface)] border border-[var(--aos-mist)] shadow-[var(--shadow-elevated)] rounded-2xl p-8">
                            <h3 className="text-2xl font-bold text-[var(--fg-1)] mb-2">Scenario Processed</h3>
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <span className="text-4xl font-extrabold text-[var(--aos-brass)]" style={{ fontFamily: 'var(--font-mono)' }}>{resultScore}</span>
                                <div className="text-left leading-tight">
                                    <div className="font-semibold text-[var(--fg-1)]">{resultBand}</div>
                                    <div className="text-sm text-[var(--fg-3)]">{resultComposition}</div>
                                </div>
                            </div>

                            <hr className="my-6 border-[var(--aos-mist)]" />

                            <div className="space-y-4 max-w-md mx-auto text-left">
                                <div>
                                    <Label className="text-[var(--fg-2)]">Save Scenario As:</Label>
                                    <Input
                                        type="text"
                                        value={scenarioName}
                                        onChange={(e) => setScenarioName(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                {saveError && (
                                    <div className="text-sm text-[var(--aos-risk)] bg-[var(--aos-risk-tint)] p-2 rounded-md border border-[var(--aos-risk)]">
                                        {saveError}
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={handleSaveScenario} className="flex-1 bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] text-[var(--fg-on-dark)]">Save Strategy</Button>
                                    <Button onClick={handleBuildAnother} variant="outline" className="flex-1">Discard Draft</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isSaved && (
                    <div className="animate-in zoom-in-95 duration-500 bg-[var(--aos-success-tint)] border border-[var(--aos-success)] rounded-2xl p-8 max-w-2xl mx-auto">
                        <div className="flex justify-center mb-4">
                            <div className="h-16 w-16 bg-[var(--bg-surface)] rounded-full flex items-center justify-center">
                                <Check className="h-8 w-8 text-[var(--aos-success)] font-bold" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Scenario Saved: {scenarioName}</h3>
                        <p className="text-[var(--fg-2)] mb-8 max-w-md mx-auto">
                            Head over to the Comparison View to see how this stacks up against your other strategies and find the optimal path forward.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button className="bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)]" onClick={() => {
                                window.scrollTo(0, 0);
                                onViewComparison?.();
                            }}>
                                View in Comparison <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                            <Button variant="outline" className="bg-[var(--bg-surface)]" onClick={handleBuildAnother}>
                                Build Another Scenario
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

        </div>
    );
};
