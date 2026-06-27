import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, Button, Input, Badge } from '../../ui';
import { Check, ChevronDown, ChevronRight, ChevronUp, Plus, Rocket, Scale, Search, Bookmark, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

import { generateDeterministicOutput, BaselineSnapshot, ComparisonScenario } from '../../../lib/gviCompare';
import { formatNumberWithCommas } from '../../../lib/formatUtils';
import { ComparisonCharts } from './compare/ComparisonCharts';

// --- Types ---
interface SavedScenario {
    id: string;
    scenario_name: string;
    gvi_score: number;
    results: any;
    inputs: any;
    implications: any;
    synthesis_content: any;
    created_at: string;
}

interface ScenarioCompareModeProps {
    onSwitchToBuild: () => void;
}

export const ScenarioCompareMode: React.FC<ScenarioCompareModeProps> = ({ onSwitchToBuild }) => {
    const { user } = useAuth();
    const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);
    const [expandedPressureRows, setExpandedPressureRows] = useState<Record<string, boolean>>({});

    const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);

    // GPT Synthesis state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [synthesisContent, setSynthesisContent] = useState<any>(null);
    const [runtimeRecordId, setRuntimeRecordId] = useState<string | null>(null);

    // Save Comparison state
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingExpanded, setIsSavingExpanded] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Initialize default name dynamically based on current date
    const currentDate = new Date();
    const defaultName = `Comparison — ${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
    const [comparisonName, setComparisonName] = useState(defaultName);

    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchScenarios = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('gvs_saved_growth_scenarios')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) setScenarios(data);
                if (error) console.error("Error fetching scenarios:", error);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingScenarios(false);
            }
        };

        const fetchBaseline = async () => {
            if (!user) return;
            try {
                const { data: finData } = await supabase.from('agency_snapshot_economic_foundation').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                const { data: revData } = await supabase.from('agency_snapshot_revenue_model').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                const { data: teamData } = await supabase.from('agency_snapshot_team_delivery').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();

                const agi = finData?.annual_agi_run_rate || 0;
                const clients = revData?.active_client_count || 0;
                const acv = (agi && clients) ? Math.round(agi / clients) : 0;
                const churn = revData?.monthly_churn_rate || 0;

                setBaseline({
                    currentAGI: agi,
                    currentGrossRevenue: finData?.annual_revenue_run_rate || 0,
                    currentProfitMargin: (finData?.profit_margin_percentage || 0) / 100, // as decimal
                    currentClientCount: clients,
                    currentACV: acv,
                    currentRetentionRate: 1 - (churn * 12),
                    currentFTEs: teamData?.total_team_size_fte || 0
                });
            } catch (err) {
                console.error("Error fetching baseline:", err);
            }
        };

        fetchScenarios();
        fetchBaseline();
    }, [user]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Derived State ---
    const selectedScenarios = selectedIds.map(id => scenarios.find(s => s.id === id)!).filter(Boolean);
    const availableScenarios = scenarios.filter(s => s.scenario_name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Recalculate deterministic data synchronously during render
    const deterministicData = React.useMemo(() => {
        if (!baseline || selectedScenarios.length === 0) {
            return null;
        }

        const compScenarios: ComparisonScenario[] = selectedScenarios.map((s, idx) => ({
            id: s.id,
            slotKey: `slot_${idx + 1}` as any,
            name: s.scenario_name,
            inputs: s.inputs,
            results: s.results
        }));

        return generateDeterministicOutput(baseline, compScenarios);
    }, [selectedScenarios, baseline]);

    useEffect(() => {
        // Reset synthesis when selection changes
        setSynthesisContent(null);
        setRuntimeRecordId(null);
        setIsSaved(false);
        setSaveError(null);
    }, [selectedIds]);

    // --- Handlers ---
    const toggleSelection = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        } else {
            if (selectedIds.length >= 3) return; // Prevent more than 3
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const getComposerLabel = (score: number) => {
        if (score >= 80) return { band: 'Healthy Velocity', label: 'Balanced Power' };
        if (score >= 60) return { band: 'Healthy Velocity', label: 'Ambition-Driven' };
        if (score >= 40) return { band: 'Active Pressure', label: 'Mixed Pressure' };
        return { band: 'Critical Overheating', label: 'Structurally Strained' };
    };

    const handleGenerateSynthesis = async () => {
        if (!user || selectedScenarios.length === 0) return;
        setIsGenerating(true);
        setGenerateError(null);

        try {
            // 1. Compute scenario_ids_hash for deduplication
            const sortedIds = [...selectedIds].sort();
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sortedIds)));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const scenarioIdsHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 2. Deduplication check
            const { data: existingRuns } = await supabase
                .from('gvs_comparison_runs')
                .select('*')
                .eq('user_id', user.id)
                .eq('scenario_ids_hash', scenarioIdsHash)
                .eq('status', 'complete')
                .limit(1);

            if (existingRuns && existingRuns.length > 0 && existingRuns[0].synthesis_content) {
                // Duplicate found — load immediately
                setSynthesisContent(existingRuns[0].synthesis_content);
                setRuntimeRecordId(existingRuns[0].id);
                setIsSaved(existingRuns[0].is_saved);
                setIsGenerating(false);
                return;
            }

            // 3. Not found — prepare snapshots and write new record
            // Get user's agency_id from their first snapshot (or null if none)
            const { data: userData } = await supabase
                .from('agency_snapshot_economic_foundation')
                .select('agency_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            const agencyId = userData?.agency_id || null;

            const scenarioSnapshots: any = {};
            selectedScenarios.forEach((s, idx) => {
                scenarioSnapshots[`slot_${idx + 1}`] = s;
            });

            const { data: runtimeRecord, error: insertError } = await supabase
                .from('gvs_comparison_runs')
                .insert([{
                    user_id: user.id,
                    agency_id: agencyId, // Can be null, spec allows it
                    scenario_ids: sortedIds,
                    scenario_snapshots: scenarioSnapshots,
                    baseline_snapshot: baseline,
                    deterministic_output: deterministicData,
                    status: 'pending'
                }])
                .select('id')
                .single();

            if (insertError) throw insertError;
            const newRecordId = runtimeRecord.id;
            setRuntimeRecordId(newRecordId);

            // 4. Trigger n8n webhook
            const webhookUrl = import.meta.env.VITE_N8N_GVS_COMPARISON_WEBHOOK_URL;
            if (webhookUrl) {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ record_id: newRecordId, user_id: user.id })
                });
            } else {
                console.warn("N8N Webhook URL missing. Simulation mode.");
                // Fake processing delay if no webhook config
                setTimeout(async () => {
                    const fakeSynthesis: any = {
                        "headlineTension": "The central trade-off across these scenarios is between growth velocity and structural capacity — each path reaches the revenue target through a fundamentally different operational profile.",
                        "comparativeNarrative": "These three scenarios represent meaningfully different theories of growth. The conservative path preserves structural stability at the cost of timeline. The active path accelerates revenue through sales intensity without requiring a hiring transformation. The aggressive path maximizes the revenue ceiling but introduces capacity constraints that exceed current team absorption — making it a structural investment decision, not purely a growth decision.",
                        "scenarioImplications": {
                            "slot_1": "Growth Plan 0% AGI holds the current revenue baseline — useful as a control scenario to understand what happens structurally if no growth is pursued.",
                            "slot_2": "Test Scenario 2/23/2026 targets a meaningful revenue step-up through a combination of client growth and ACV increase — the sales velocity requirement is the primary execution constraint.",
                            "slot_3": "Aggressive Scale (24mo) delivers the highest revenue ceiling but creates a Capacity pressure that the other scenarios avoid — a team scaling decision precedes commitment to this path."
                        },
                        "tradeoffInsights": [
                            "Slot 1 vs Slot 2: Test Scenario adds significant revenue in the same timeframe at the cost of higher sales execution intensity — neither creates structural risk.",
                            "Slot 2 vs Slot 3: Aggressive Scale adds approximately $500K more revenue than Test Scenario but introduces a hiring pace that risks culture absorption — a meaningful operational trade-off.",
                            "Slot 1 vs Slot 3: The spread between the conservative and aggressive paths is large enough that the choice reflects a fundamental theory of growth, not just an execution preference."
                        ]
                    };
                    try {
                        await supabase.from('gvs_comparison_runs').update({
                            status: 'complete',
                            synthesis_content: fakeSynthesis
                        }).eq('id', newRecordId);

                        // Wait a bit to simulate processing time, then fetch locally to trigger state
                        setSynthesisContent(fakeSynthesis);
                        setIsGenerating(false);
                    } catch (err) {
                        setGenerateError("Generation Failed — Retry ↺");
                        setIsGenerating(false);
                    }
                }, 3000);
            }

            // 5. Subscribe to Realtime updates for when processing finishes
            const channel = supabase.channel(`gvs_comparison_runs_${newRecordId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'gvs_comparison_runs', filter: `id=eq.${newRecordId}` },
                    (payload) => {
                        if (payload.new.status === 'complete' && payload.new.synthesis_content) {
                            setSynthesisContent(payload.new.synthesis_content);
                            setIsGenerating(false);
                            supabase.removeChannel(channel);
                        } else if (payload.new.status === 'error') {
                            setSynthesisContent(null);
                            setIsGenerating(false);
                            setGenerateError("Generation Failed — Retry ↺");
                            console.error("GPT Comparison failed.");
                            supabase.removeChannel(channel);
                        }
                    }
                )
                .subscribe();

        } catch (error) {
            console.error("Comparison generation error:", error);
            setGenerateError("Generation Failed — Retry ↺");
            setIsGenerating(false);
        }
    };

    const handleSaveComparison = async () => {
        if (!user || !runtimeRecordId || !synthesisContent || isSaved) return;
        setIsSaving(true);
        try {
            // Get agency_id again
            const { data: userData } = await supabase
                .from('agency_snapshot_economic_foundation')
                .select('agency_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            const agencyId = userData?.agency_id || null;

            const scenarioSnapshots: any = {};
            selectedScenarios.forEach((s, idx) => {
                scenarioSnapshots[`slot_${idx + 1}`] = s;
            });

            // Write to saved comparisons
            const { error: saveError } = await supabase
                .from('gvs_saved_comparisons')
                .insert([{
                    user_id: user.id,
                    agency_id: agencyId,
                    runtime_comparison_id: runtimeRecordId,
                    comparison_name: comparisonName,
                    scenario_ids: [...selectedIds].sort(),
                    scenario_snapshots: scenarioSnapshots,
                    baseline_snapshot: baseline,
                    deterministic_output: deterministicData,
                    synthesis_content: synthesisContent
                }]);

            if (saveError) throw saveError;

            // Update runtime record
            await supabase
                .from('gvs_comparison_runs')
                .update({ is_saved: true, saved_at: new Date().toISOString() })
                .eq('id', runtimeRecordId);

            setIsSaved(true);
            setIsSavingExpanded(false);
            setSaveError(null);
        } catch (error: any) {
            if (error?.code === '23505') {
                setSaveError("A comparison with this name already exists. Please choose a different name.");
            } else {
                console.error("Error saving comparison:", error);
                setSaveError("Failed to save comparison. Please try again.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Components ---

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-32">

            {/* Section A: Scenario Selector */}
            <Card className="p-6 overflow-visible relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--fg-1)]">
                            Comparison Setup
                        </h2>
                        <p className="text-sm text-[var(--fg-3)] mt-1">Select up to 3 scenarios to compare against your baseline.</p>
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <Button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            variant="outline"
                            className="w-full md:w-auto flex items-center justify-between gap-2 border-[var(--aos-mist)]"
                            disabled={selectedIds.length >= 3}
                        >
                            <span><Plus className="h-4 w-4 inline-block mr-1" /> Add Scenario {selectedIds.length > 0 && `(${selectedIds.length}/3)`}</span>
                            <ChevronDown className="h-4 w-4 text-[var(--fg-4)]" />
                        </Button>

                        {/* Custom Dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-[var(--bg-surface)] border border-[var(--aos-mist)] shadow-xl rounded-xl overflow-hidden z-50">
                                <div className="p-3 border-b border-[var(--aos-mist)] bg-[var(--bg-canvas)]">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-4)]" />
                                        <Input
                                            placeholder="Search scenarios..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-9 text-sm"
                                            autoFocus
                                        />
                                    </div>
                                    {selectedIds.length >= 3 && (
                                        <div className="mt-2 text-xs text-[var(--aos-warning)] font-medium">
                                            Maximum 3 scenarios. Remove one to add another.
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {availableScenarios.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-[var(--fg-3)]">No scenarios found.</div>
                                    ) : (
                                        availableScenarios.map(scenario => {
                                            const isSelected = selectedIds.includes(scenario.id);
                                            const isDisabled = !isSelected && selectedIds.length >= 3;
                                            const analysis = getComposerLabel(scenario.gvi_score || 0);

                                            return (
                                                <div
                                                    key={scenario.id}
                                                    onClick={() => !isDisabled && toggleSelection(scenario.id)}
                                                    className={`
                                                        p-4 border-b border-[var(--aos-mist)] last:border-0 cursor-pointer transition-colors flex items-center gap-3
                                                        ${isSelected ? 'bg-[var(--aos-brass-tint)] hover:bg-[var(--aos-brass-tint)]' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--bg-canvas)]'}
                                                    `}
                                                >
                                                    <div className={`
                                                        w-5 h-5 rounded-full border flex items-center justify-center shrink-0
                                                        ${isSelected ? 'bg-[var(--aos-brass)] border-[var(--aos-brass)] text-[var(--fg-on-dark)]' : 'border-[var(--aos-mist)] bg-[var(--bg-surface)]'}
                                                    `}>
                                                        {isSelected && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-[var(--fg-1)] truncate">{scenario.scenario_name}</div>
                                                        <div className="text-xs text-[var(--fg-3)] flex items-center gap-1 mt-0.5 truncate">
                                                            <span className="font-medium text-[var(--fg-2)]">GVI: {scenario.gvi_score}</span>
                                                            <span className="text-[var(--fg-4)]">&bull;</span>
                                                            <span>{analysis.band}</span>
                                                            <span className="text-[var(--fg-4)]">&bull;</span>
                                                            <span>{scenario.inputs?.raw?.timeframeMonths || 24}mo</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected Chips Row */}
                {selectedScenarios.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[var(--aos-mist)]">
                        <div className="flex flex-wrap gap-2">
                            {selectedScenarios.map(scen => (
                                <Badge
                                    key={scen.id}
                                    variant="secondary"
                                    className="px-3 py-1.5 text-sm bg-[var(--bg-canvas)] hover:bg-[var(--bg-sunken)] text-[var(--fg-1)] border items-center gap-2 group cursor-default transition-colors"
                                >
                                    <span
                                        className="h-4 w-4 bg-[var(--bg-sunken)] group-hover:bg-[var(--aos-mist)] text-[var(--fg-2)] group-hover:text-[var(--fg-1)] rounded-full flex items-center justify-center cursor-pointer"
                                        onClick={(e) => toggleSelection(scen.id, e)}
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                    {scen.scenario_name}
                                </Badge>
                            ))}
                            {selectedIds.length === 3 && (
                                <span className="text-sm text-[var(--fg-4)] py-1.5 px-2 flex items-center">
                                    All 3 selected
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {/* Empty State vs Full Comparison View */}
            {selectedScenarios.length === 0 ? (
                <div className="border border-dashed border-[var(--aos-mist)] rounded-2xl p-12 text-center bg-[var(--bg-canvas)]/50">
                    <div className="mx-auto w-16 h-16 bg-[var(--bg-surface)] rounded-full flex items-center justify-center shadow-sm border border-[var(--aos-mist)] mb-6">
                        <Scale className="h-8 w-8 text-[var(--fg-4)]" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Select Scenarios to Compare</h3>
                    <p className="text-[var(--fg-3)] max-w-md mx-auto mb-6">
                        Select up to 3 scenarios from the dropdown above. Your current agency baseline will be automatically included as the reference for comparison.
                    </p>
                    {scenarios.length === 0 && !isLoadingScenarios && (
                        <div className="mt-6 flex flex-col items-center">
                            <p className="text-sm font-medium text-[var(--fg-2)] mb-3">No saved scenarios yet?</p>
                            <Button
                                variant="outline"
                                className="bg-[var(--bg-surface)]"
                                onClick={onSwitchToBuild}
                            >
                                <Rocket className="h-4 w-4 mr-2" />
                                Build your first scenario
                            </Button>
                        </div>
                    )}
                </div>
            ) : deterministicData ? (
                <div className="space-y-12 pb-12">
                    {/* SECTION B: Snapshot Strip */}
                    <div>
                        <h3 className="text-lg font-bold text-[var(--fg-1)] mb-4 flex items-center gap-2">
                            <Scale className="h-5 w-5 text-[var(--fg-3)]" /> Comparison Snapshots
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Baseline Card */}
                            <Card className="p-4 border-[var(--aos-mist)] bg-[var(--bg-canvas)] relative overflow-hidden flex flex-col">
                                <span className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] mb-1">BASELINE (REFERENCE)</span>
                                <h4 className="font-bold text-[var(--fg-1)] text-lg mb-4">Current State</h4>
                                <div className="space-y-2 mt-auto text-sm text-[var(--fg-2)]">
                                    <div className="flex justify-between"><span>Annual AGI:</span> <span className="font-semibold text-[var(--fg-1)]">${formatNumberWithCommas(baseline?.currentAGI || 0)}</span></div>
                                    <div className="flex justify-between"><span>Margin:</span> <span className="font-semibold text-[var(--fg-1)]">{Math.round((baseline?.currentProfitMargin || 0) * 100)}%</span></div>
                                    <div className="flex justify-between"><span>Retention:</span> <span className="font-semibold text-[var(--fg-1)]">{Math.round((baseline?.currentRetentionRate || 0) * 100)}%</span></div>
                                </div>
                            </Card>

                            {/* Scenario Cards */}
                            {selectedScenarios.map((scen, idx) => {
                                const slotKey = `slot_${idx + 1}`;
                                const slotData = deterministicData.gviScores[slotKey];
                                const isRed = slotData.band.includes('Pressure') || slotData.band.includes('Strain');
                                const isExpanded = expandedScenarioId === scen.id;
                                return (
                                    <Card
                                        key={scen.id}
                                        className={`p-4 border-[var(--aos-mist)] hover:shadow-md transition-shadow relative flex flex-col group cursor-grab active:cursor-grabbing ${draggedIdx === idx ? 'opacity-50 border-dashed border-2 border-[var(--aos-mist)]' : ''}`}
                                        style={{ userSelect: 'none' }}
                                        draggable={true}
                                        onDragStart={(e) => setDraggedIdx(idx)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (draggedIdx === null || draggedIdx === idx) {
                                                setDraggedIdx(null);
                                                return;
                                            }
                                            const newIds = [...selectedIds];
                                            const temp = newIds[draggedIdx];
                                            newIds[draggedIdx] = newIds[idx];
                                            newIds[idx] = temp;
                                            setSelectedIds(newIds);
                                            setDraggedIdx(null);
                                        }}
                                        onDragEnd={() => setDraggedIdx(null)}
                                    >
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Drag Handle Placeholder */}
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" /><div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" />
                                            </div>
                                            <div className="flex gap-0.5 mt-0.5">
                                                <div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" /><div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" />
                                            </div>
                                            <div className="flex gap-0.5 mt-0.5">
                                                <div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" /><div className="w-1 h-1 bg-[var(--fg-4)] rounded-full" />
                                            </div>
                                        </div>

                                        <span className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] mb-1 uppercase">SLOT {idx + 1}</span>
                                        <h4 className="font-bold text-[var(--fg-1)] text-lg truncate pr-4">{scen.scenario_name}</h4>

                                        <div className="mt-4 mb-2 flex items-baseline gap-2">
                                            <span className={`text-4xl font-extrabold ${isRed ? 'text-[var(--aos-warning)]' : 'text-[var(--aos-brass)]'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                                                {slotData.score}
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-[var(--fg-2)]">{slotData.band}</div>
                                        <div className="text-xs text-[var(--fg-3)] mb-4">{slotData.compositionLabel}</div>

                                        {/* Simple summary of targets for context */}
                                        <div className="space-y-1 mt-auto pt-4 border-t border-[var(--aos-mist)] text-xs text-[var(--fg-2)]">
                                            <div className="flex justify-between"><span>Target AGI:</span> <span className="font-semibold text-[var(--fg-1)]">${formatNumberWithCommas(Math.round(scen.inputs?.resolved?.targetAGI || 0))}</span></div>
                                            <div className="flex justify-between"><span>Target Margin:</span> <span className="font-semibold text-[var(--fg-1)]">{Math.round(scen.inputs?.raw?.targetMargin || 0)}%</span></div>
                                            <div className="mt-3 pt-2">
                                                <Button size="sm" variant="ghost" className="w-full text-xs text-[var(--aos-insight)] hover:text-[var(--fg-1)] bg-[var(--aos-insight-tint)] hover:bg-[var(--bg-canvas)] h-8 font-medium" onClick={(e) => { e.stopPropagation(); setExpandedScenarioId(isExpanded ? null : scen.id); }}>
                                                    {isExpanded ? 'Collapse ↑' : 'Expand Details ↓'}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Expanded Detail Panel */}
                        {expandedScenarioId && (() => {
                            const expCard = selectedScenarios.find(s => s.id === expandedScenarioId);
                            if (!expCard) return null;
                            const slotIdx = selectedScenarios.findIndex(s => s.id === expandedScenarioId);
                            const slotKey = `slot_${slotIdx + 1}` as any;
                            const slotData = deterministicData.gviScores[slotKey];

                            // Safe fallbacks for implications structure
                            const impls = expCard.implications || {};
                            const getStatusColor = (status: string) => {
                                if (status === 'high') return 'bg-[var(--aos-risk)]';
                                if (status === 'moderate') return 'bg-[var(--aos-warning)]';
                                return 'bg-[var(--aos-success)]';
                            };

                            const pressures = [
                                { key: 'retention', label: 'Retention', data: impls.retention },
                                { key: 'sales', label: 'Sales', data: impls.sales },
                                { key: 'capacity', label: 'Capacity', data: impls.hiring || impls.capacity },
                                { key: 'margin', label: 'Margin', data: impls.margin },
                                { key: 'concentration', label: 'Concentration', data: impls.concentration },
                                { key: 'positioning', label: 'Positioning', data: impls.positioning }
                            ];

                            return (
                                <div className="mt-8 animate-in slide-in-from-top-4 duration-300">
                                    <Card className="overflow-hidden border-[var(--aos-brass-soft)] shadow-[var(--shadow-soft-2)] relative">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--aos-brass)]" />

                                        {/* Header */}
                                        <div className="bg-[var(--bg-canvas)] border-b border-[var(--aos-mist)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-[var(--fg-1)]">{expCard.scenario_name}</h3>
                                                <div className="text-sm text-[var(--fg-3)] mt-1 flex items-center gap-2">
                                                    <span className="font-semibold text-[var(--aos-brass)]" style={{ fontFamily: 'var(--font-mono)' }}>GVI: {slotData.score}</span>
                                                    <span className="text-[var(--fg-4)]">&bull;</span>
                                                    <span className="font-medium text-[var(--fg-2)]">{slotData.band}</span>
                                                    <span className="text-[var(--fg-4)]">&bull;</span>
                                                    <span>{slotData.compositionLabel}</span>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setExpandedScenarioId(null)} className="text-[var(--fg-3)] hover:text-[var(--fg-1)] self-start md:self-center">
                                                Collapse <ChevronUp className="h-4 w-4 ml-1" />
                                            </Button>
                                        </div>

                                        <div className="p-6 md:p-8 space-y-8 bg-[var(--bg-surface)]">
                                            {/* Synthesis Headline */}
                                            <div>
                                                <h4 className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest mb-3">Synthesis Headline</h4>
                                                <h3 className="text-xl font-bold text-[var(--fg-1)] leading-snug">
                                                    {expCard.synthesis_content?.headlineTension || "Strategic analysis will appear here after running Generate Strategic Comparison."}
                                                </h3>
                                            </div>

                                            {/* Pressure Profile */}
                                            <div>
                                                <h4 className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest mb-4">Pressure Profile</h4>
                                                <div className="space-y-3 bg-[var(--bg-canvas)] p-5 rounded-xl border border-[var(--aos-mist)]">
                                                    {pressures.map((p) => {
                                                        const status = p.data?.status || 'low';
                                                        const insight = p.data?.insight || 'No data available.';
                                                        return (
                                                            <div key={p.key} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
                                                                <div className="w-32 font-medium text-[var(--fg-2)] shrink-0 flex items-center justify-between">
                                                                    <span>{p.label}</span>
                                                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)} shadow-sm`} />
                                                                </div>
                                                                <div className="text-[var(--fg-2)] leading-relaxed md:ml-4">{insight}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Scenario Narrative */}
                                            <div>
                                                <h4 className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest mb-3">Scenario Narrative</h4>
                                                <p className="text-[var(--fg-2)] leading-relaxed text-sm md:text-base">
                                                    {expCard.synthesis_content?.comparativeNarrative || "Full strategic narrative generates when you run the comparison analysis. This will include a detailed breakdown of the structural implications, pressure dynamics, and key considerations for this growth path."}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })()}
                    </div>

                    {/* SECTION C: Comparison Pressure Table */}
                    <div>
                        <h3 className="text-lg font-bold text-[var(--fg-1)] mb-4 flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-[var(--fg-3)]" /> Comparison Pressure Profile
                        </h3>
                        <Card className="overflow-hidden border-[var(--aos-mist)]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[var(--bg-canvas)] border-b border-[var(--aos-mist)] text-xs uppercase text-[var(--fg-3)] font-semibold">
                                        <tr>
                                            <th className="px-6 py-4 w-1/4">Pressure Type</th>
                                            {selectedScenarios.map((scen, idx) => (
                                                <th key={scen.id} className="px-6 py-4 w-1/4">
                                                    <div className="truncate">{scen.scenario_name}</div>
                                                    <div className="text-[10px] text-[var(--fg-4)] font-normal normal-case mt-0.5">GVI: {deterministicData.gviScores[`slot_${idx + 1}`].score}</div>
                                                </th>
                                            ))}
                                            {selectedScenarios.length < 3 && Array.from({ length: 3 - selectedScenarios.length }).map((_, i) => (
                                                <th key={`empty-${i}`} className="px-6 py-4 w-1/4 text-[var(--fg-4)]">Empty Slot</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--aos-mist)]">
                                        {['retention', 'sales', 'capacity', 'margin', 'concentration', 'positioning'].map((pressureKey) => {
                                            const displayNames: any = { retention: "Retention Drag", sales: "Sales Velocity", capacity: "Hiring Capacity", margin: "Margin Squeeze", concentration: "Concentration Risk", positioning: "Positioning Shift" };
                                            return (
                                                <tr key={pressureKey} className="hover:bg-[var(--bg-canvas)] transition-colors">
                                                    <td className="px-6 py-4 font-medium text-[var(--fg-1)] bg-[var(--bg-canvas)]/50 align-top">
                                                        <div className="flex flex-col gap-2 items-start">
                                                            <span>{displayNames[pressureKey]}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-[10px] uppercase tracking-wider text-[var(--fg-3)] hover:text-[var(--aos-insight)] p-0"
                                                                onClick={() => setExpandedPressureRows(prev => ({ ...prev, [pressureKey]: !prev[pressureKey] }))}
                                                            >
                                                                {expandedPressureRows[pressureKey] ? 'Hide Details ↑' : 'Show Details ↓'}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    {selectedScenarios.map((scen, idx) => {
                                                        const slotKey = `slot_${idx + 1}` as any;
                                                        const status = deterministicData.pressureTable[pressureKey][slotKey];
                                                        const insight = deterministicData.pressureImplications[pressureKey][slotKey];
                                                        return (
                                                            <td key={scen.id} className="px-6 py-4 align-top">
                                                                <div className="flex flex-col gap-2 items-start">
                                                                    <Badge className={`w-fit ${status === 'RED' ? 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]' : status === 'YELLOW' ? 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]' : 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]'}`}>
                                                                        {status === 'RED' ? '✕ High Risk' : status === 'YELLOW' ? '⚠ Moderate' : '✓ Standard'}
                                                                    </Badge>
                                                                    {expandedPressureRows[pressureKey] && (
                                                                        <span className="text-xs text-[var(--fg-2)] font-medium leading-relaxed mt-1 block animate-in fade-in slide-in-from-top-1">
                                                                            {insight}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    {selectedScenarios.length < 3 && Array.from({ length: 3 - selectedScenarios.length }).map((_, i) => (
                                                        <td key={`empty-cell-${i}`} className="px-6 py-4 text-[var(--aos-mist)]">—</td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    {/* SECTION D: Visual Analysis */}
                    <div>
                        <h3 className="text-lg font-bold text-[var(--fg-1)] mb-4 flex items-center gap-2">
                            <Scale className="h-5 w-5 text-[var(--fg-3)]" /> Visual Analysis
                        </h3>
                        <ComparisonCharts
                            chartData={deterministicData.chartData}
                            selectedNames={{
                                slot_1: selectedScenarios[0]?.scenario_name,
                                slot_2: selectedScenarios[1]?.scenario_name,
                                slot_3: selectedScenarios[2]?.scenario_name
                            }}
                        />
                    </div>

                    {/* GPT TRIGGER DIVIDER */}
                    {!synthesisContent && (
                        <div className="py-12 my-8 border-t border-[var(--aos-mist)] text-center">
                            <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Ready to go deeper?</h3>
                            <p className="text-[var(--fg-3)] max-w-lg mx-auto mb-8">
                                Generate a strategic analysis comparing these scenarios — trade-offs, implications, and the central tension across all three paths.
                            </p>
                            <Button
                                onClick={handleGenerateSynthesis}
                                disabled={isGenerating}
                                className={`min-w-[250px] transition-colors ${generateError ? 'bg-[var(--aos-risk)] hover:opacity-90 text-[var(--fg-on-dark)]' : 'bg-[var(--bg-inverse)] hover:bg-[var(--aos-obsidian-hover)] text-[var(--fg-on-dark)]'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-[var(--aos-mist)] border-t-white rounded-full animate-spin mr-2" />
                                        Generating Analysis...
                                    </>
                                ) : generateError ? (
                                    <>{generateError}</>
                                ) : (
                                    <>↗ Generate Strategic Comparison</>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* SECTION E: Strategic Comparison Synthesis */}
                    {synthesisContent && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <Card className="border-[var(--aos-mist)] bg-[var(--bg-surface)] overflow-hidden">

                                {/* Section Header */}
                                <div className="px-8 py-6 border-b border-[var(--aos-mist)] flex items-center gap-2">
                                    <Rocket className="h-5 w-5 text-[var(--fg-3)]" />
                                    <h3 className="text-lg font-bold text-[var(--fg-1)]">Strategic Analysis</h3>
                                </div>

                                <div className="p-8 space-y-10">
                                    {/* Headline Tension */}
                                    <div>
                                        <div className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] uppercase mb-3">Central Tension</div>
                                        <h3 className="text-xl font-bold text-[var(--fg-1)] leading-snug max-w-3xl">
                                            {synthesisContent.headlineTension}
                                        </h3>
                                    </div>

                                    {/* Comparative Narrative */}
                                    <div>
                                        <div className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] uppercase mb-3">Comparative Analysis</div>
                                        <p className="text-[var(--fg-2)] text-base max-w-4xl leading-relaxed">
                                            {synthesisContent.comparativeNarrative}
                                        </p>
                                    </div>

                                    {/* Implications + Trade-offs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-[var(--aos-mist)]">
                                        {/* Left: Scenario Implications */}
                                        <div>
                                            <div className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] uppercase mb-4">Scenario Implications</div>
                                            <div className="space-y-3">
                                                {selectedScenarios.map((scen, idx) => {
                                                    const slotKey = `slot_${idx + 1}`;
                                                    const implication = synthesisContent.scenarioImplications?.[slotKey];
                                                    if (!implication) return null;
                                                    return (
                                                        <div key={scen.id} className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--aos-mist)]">
                                                            <div className="font-semibold text-[var(--aos-brass)] text-sm mb-1.5">{scen.scenario_name}</div>
                                                            <div className="text-sm text-[var(--fg-2)] leading-relaxed">{implication}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right: Trade-offs */}
                                        <div>
                                            <div className="text-[10px] font-bold tracking-wider text-[var(--fg-4)] uppercase mb-4">Key Trade-offs</div>
                                            <div className="space-y-4">
                                                {synthesisContent.tradeoffInsights?.map((insight: string, idx: number) => (
                                                    <div key={idx} className="flex gap-3 items-start">
                                                        <div className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] shrink-0" />
                                                        <p className="text-sm text-[var(--fg-2)] leading-relaxed">{insight}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Save Comparison UI */}
                                    <div className="pt-6 border-t border-[var(--aos-mist)]">
                                        {isSaved ? (
                                            <div className="flex items-center gap-3 text-[var(--aos-success)] bg-[var(--aos-success-tint)] px-5 py-4 rounded-xl border border-[var(--aos-success)]">
                                                <Check className="h-4 w-4 shrink-0" />
                                                <span className="font-medium text-sm">
                                                    "{comparisonName}" saved. This comparison is now in your saved library.
                                                </span>
                                            </div>
                                        ) : isSavingExpanded ? (
                                            <div className="bg-[var(--bg-canvas)] p-6 rounded-xl border border-[var(--aos-mist)] animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-sm font-medium text-[var(--fg-2)] mb-3">
                                                    Name this comparison to save it:
                                                </label>
                                                <Input
                                                    value={comparisonName}
                                                    onChange={(e) => setComparisonName(e.target.value)}
                                                    className="bg-[var(--bg-surface)] border-[var(--aos-mist)] text-[var(--fg-1)] h-11 placeholder:text-[var(--fg-4)] mb-5 w-full max-w-xl"
                                                    placeholder="e.g. 2026 Strategic Paths"
                                                    autoFocus
                                                />
                                                {saveError && (
                                                    <div className="text-sm text-[var(--aos-risk)] bg-[var(--aos-risk-tint)] p-3 rounded-md border border-[var(--aos-risk)] mb-5 max-w-xl">
                                                        {saveError}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        onClick={handleSaveComparison}
                                                        disabled={isSaving || !comparisonName.trim()}
                                                        className="bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] text-[var(--fg-on-dark)] px-8"
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <div className="h-4 w-4 border-2 border-[var(--aos-brass-tint)] border-t-[var(--fg-on-dark)] rounded-full animate-spin mr-2 shrink-0" />
                                                                Saving...
                                                            </>
                                                        ) : "Save Comparison"}
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setIsSavingExpanded(false);
                                                            setSaveError(null);
                                                        }}
                                                        variant="ghost"
                                                        disabled={isSaving}
                                                        className="text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-canvas)]"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={() => setIsSavingExpanded(true)}
                                                variant="outline"
                                                className="border-[var(--aos-mist)] text-[var(--fg-2)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                                            >
                                                <Bookmark className="h-4 w-4 mr-2" />
                                                Save This Comparison
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 text-[var(--fg-4)] animate-pulse">
                    Computing comparison models...
                </div>
            )}
        </div>
    );
};
