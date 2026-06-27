import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
   Card,
   Button,
   Input,
   Select,
   Label,
   Switch,
   PlaceholderContent,
   Badge
} from '../components/ui';
import {
   BarChart3,
   Target,
   MapPin,
   ChevronDown,
   ChevronUp,
   Rocket,
   RotateCcw,
   ArrowUpRight,
   Users,
   DollarSign,
   TrendingUp,
   Scale,
   Activity,
   AlertTriangle,
   Download,
   Save,
   Link as LinkIcon,
   Lock,
   SlidersHorizontal,
   CheckCircle2,
   X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { ScenarioPlannerInputs } from '../components/tools/growth-velocity/ScenarioPlannerInputs';
import { HelperTextPanel } from '../components/tools/growth-velocity/HelperTextPanel';
import { formatNumberWithCommas, parseFormattedNumber } from '../lib/formatUtils';
import { PRESETS, calculatePresetTargets } from '../lib/presetScenarios';
import { Info } from 'lucide-react';
import { ScenarioCompareMode } from '../components/tools/growth-velocity/ScenarioCompareMode';
import {
   GVIInputs,
   ResolvedVariables,
   GVIScoreResult,
   resolveVariables,
   calculateGVIScore
} from '../lib/gviCalculations';
import {
   generatePressureContent,
   generateDbImplications,
   generateDbPressureInsights,
   generateSynthesis,
   getBandDetails,
   getCompositionNote,
   PressureContent,
   SynthesisContent
} from '../lib/gviSynthesis';

// --- Helper Functions ---

// --- Components for Output Section (Standard Calculator) ---

const SynthesisSection: React.FC<{ content: SynthesisContent }> = ({ content }) => {
   const [expanded, setExpanded] = useState(false);

   return (
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] overflow-hidden mb-8">
         <div
            className="p-6 cursor-pointer hover:bg-[var(--bg-canvas)] transition-colors"
            onClick={() => setExpanded(!expanded)}
         >
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-bold text-[var(--fg-1)] uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--aos-insight)]" />
                  Strategic Synthesis
               </h3>
               {expanded ? <ChevronUp className="h-4 w-4 text-[var(--fg-4)]" /> : <ChevronDown className="h-4 w-4 text-[var(--fg-4)]" />}
            </div>
            <p className="text-lg font-medium text-[var(--fg-1)] leading-relaxed">
               {content.headline}
            </p>
            {!expanded && (
               <p className="text-xs text-[var(--aos-insight)] mt-2 font-medium">View full analysis ↓</p>
            )}
         </div>

         {expanded && (
            <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2">
               <div className="h-px w-full bg-[var(--aos-mist)] mb-4" />
               <p className="text-[var(--fg-2)] leading-relaxed">
                  {content.narrative}
               </p>
               <div className="mt-4 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(false); }} className="text-xs text-[var(--fg-4)]">
                     Close Analysis ↑
                  </Button>
               </div>
            </div>
         )}
      </div>
   );
};

// --- Components for Output Section (Standard Calculator) ---

const MetricCard: React.FC<{ icon: React.ElementType; label: string; value: string; context: string }> = ({
   icon: Icon, label, value, context
}) => (
   <Card className="p-6 flex flex-col h-full border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)]">
      <div className="flex items-center gap-3 mb-4">
         <div className="p-2 bg-[var(--bg-sunken)] rounded-lg text-[var(--fg-2)]">
            <Icon className="h-5 w-5" />
         </div>
         <span className="font-medium text-[var(--fg-2)] text-sm">{label}</span>
      </div>
      <div className="mt-auto">
         <div className="text-3xl font-bold text-[var(--fg-1)] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{value}</div>
         <div className="text-xs text-[var(--fg-3)]">{context}</div>
      </div>
   </Card>
);

interface PressureCardProps {
   content: PressureContent;
   icon: React.ElementType;
}

const PressureCard: React.FC<PressureCardProps> = ({ content, icon: Icon }) => {
   const [expanded, setExpanded] = useState(false);
   const { title, status, score, maxScore, insight, contentBlock, watchSignal } = content;

   const statusConfig = {
      high: { color: 'text-[var(--aos-risk)]', bg: 'bg-[var(--aos-risk-tint)]', border: 'border-[var(--aos-risk)]', badge: 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]', label: 'CRITICAL' },
      moderate: { color: 'text-[var(--aos-warning)]', bg: 'bg-[var(--aos-warning-tint)]', border: 'border-[var(--aos-warning)]', badge: 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]', label: 'WARNING' },
      low: { color: 'text-[var(--aos-success)]', bg: 'bg-[var(--aos-success-tint)]', border: 'border-[var(--aos-success)]', badge: 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]', label: 'STABLE' },
   };

   const config = statusConfig[status];

   return (
      <div
         className={`rounded-xl border ${config.border} ${config.bg} transition-all duration-300 cursor-pointer overflow-hidden ${expanded ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm'}`}
         onClick={() => setExpanded(!expanded)}
      >
         <div className="p-5">
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-[var(--bg-surface)] bg-opacity-60 ${config.color}`}>
                     <Icon className="h-5 w-5" />
                  </div>
                  <div>
                     <h4 className={`font-bold text-[var(--fg-1)] ${expanded ? 'text-lg' : 'text-base'}`}>{title}</h4>
                     <p className="text-xs text-[var(--fg-3)] font-medium">{score}/{maxScore} Friction Pts</p>
                  </div>
               </div>
               <Badge className={`${config.badge} border-none`}>{config.label}</Badge>
            </div>

            {/* Collapsed View: Truncated Insight or Summary */}
            {!expanded && (
               <div className="flex items-center justify-between text-xs text-[var(--fg-3)] mt-2">
                  <span className="truncate max-w-[200px]">{insight}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
               </div>
            )}
         </div>

         {/* Expanded Content */}
         {expanded && (
            <div className={`px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200`}>
               <div className="h-px w-full bg-[var(--aos-mist)] mb-4" />
               {/* Insight Reiteration */}
               <p className="text-sm font-semibold text-[var(--fg-1)] mb-2">{insight}</p>

               {/* Content Block */}
               <p className="text-sm text-[var(--fg-2)] leading-relaxed mb-4">
                  {contentBlock}
               </p>

               {/* Watch Signal */}
               {watchSignal && (
                  <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--aos-mist)] mb-4">
                     <p className="text-xs text-[var(--fg-3)] italic flex gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-[var(--aos-warning)]" />
                        {watchSignal}
                     </p>
                  </div>
               )}

               <div className="flex items-center justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[var(--fg-4)] hover:text-[var(--fg-2)] uppercase tracking-wider">
                     Close Details <ChevronUp className="h-3 w-3 ml-1" />
                  </Button>
               </div>
            </div>
         )}
      </div>
   );
};

interface GVIDisplayProps {
   result: GVIScoreResult;
}

const GVIDisplay: React.FC<GVIDisplayProps> = ({ result }) => {
   const { score, startBand, compositionLabel } = result as any; // Handle flexible types
   const bandDetails = getBandDetails(score);
   const compositionNote = getCompositionNote(compositionLabel);

   const { colorClass, textClass, gradientFrom, name: bandName } = bandDetails;

   const getTransparencyNotes = (res: GVIScoreResult) => {
      const notes = [];
      const frictionStart = Math.round(res.frictionShare * 100);

      if (res.metrics.retentionRate < 0.85) notes.push(`• Low retention (${Math.round(res.metrics.retentionRate * 100)}%) reduces score significantly.`);
      if (frictionStart > 20) notes.push(`• High friction consumes ${frictionStart}% of growth energy.`);
      if (res.metrics.salesPaceRatio > 3.0) notes.push(`• Extreme sales velocity gap (>${res.metrics.salesPaceRatio.toFixed(1)}x) limits score.`);
      return notes;
   };

   const notes = getTransparencyNotes(result);

   return (
      <div className="bg-[var(--bg-inverse)] rounded-xl p-8 text-[var(--fg-on-dark)] flex flex-col items-center text-center relative overflow-hidden h-full">
         <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientFrom} via-[var(--aos-slate-blue)] to-[var(--bg-inverse)]`} />

         <h3 className="text-xs font-semibold text-[var(--aos-steel-blue)] uppercase tracking-widest mb-6">Growth Velocity Index</h3>

         <div className="relative mb-6">
            <div className="text-7xl font-bold tracking-tighter" style={{ fontFamily: 'var(--font-mono)' }}>{score}</div>
            <div className="text-lg text-[var(--aos-steel-blue)] font-medium">/100</div>
         </div>

         <div className="w-full max-w-xs h-3 bg-[var(--aos-slate-blue)] rounded-full mb-6 overflow-hidden">
            <div className={`h-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${score}%` }} />
         </div>

         {/* Band Label */}
         <div className={`text-2xl font-bold mb-1 ${textClass}`}>
            {bandName}
         </div>

         {/* Composition Label */}
         <div className="text-sm font-medium text-[var(--aos-steel-blue)] mb-4 opacity-90">
            {compositionLabel}
         </div>

         {/* Composition Note */}
         <p className="text-[var(--aos-steel-blue)] text-sm max-w-sm leading-relaxed border-t border-[var(--aos-slate-blue)] pt-4 mt-auto">
            {compositionNote}
         </p>

         {/* Transparency Notes */}
         {notes.length > 0 && (
            <div className="mt-4 text-xs text-[var(--aos-steel-blue)] text-left w-full max-w-sm space-y-1 bg-[var(--aos-obsidian-deep)] p-3 rounded-lg">
               {notes.map((note, i) => (
                  <div key={i}>{note}</div>
               ))}
            </div>
         )}
      </div>
   );
};



const ProcessingOverlay: React.FC<{ stage: number }> = ({ stage }) => {
   const stages = [
      "Analyzing growth targets...",
      "Calculating pressure implications...",
      "Running constraint analysis...",
      "Generating strategic synthesis..."
   ];

   return (
      <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(25, 48, 82, 0.8)' }}>
         <div className="bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-elevated)] p-8 max-w-md w-full text-center">
            <div className="h-16 w-16 bg-[var(--bg-inverse)] rounded-lg flex items-center justify-center mx-auto mb-6">
               <span className="text-[var(--fg-on-dark)] font-bold text-3xl">A</span>
            </div>

            <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Architect OS</h3>
            <p className="text-[var(--fg-3)] mb-8 min-h-[1.5rem] transition-opacity duration-300">
               {stages[stage] || "Processing..."}
            </p>

            <div className="w-full bg-[var(--bg-canvas)] rounded-full h-2 mb-2 overflow-hidden">
               <div
                  className="bg-[var(--aos-brass)] h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(stage + 1) * 25}%` }}
               />
            </div>
            <div className="flex justify-between text-xs text-[var(--fg-4)] font-medium">
               <span>0%</span>
               <span>{(stage + 1) * 25}%</span>
            </div>
         </div>
      </div>
   );
};

interface ComparisonTableProps {
   data: ResolvedVariables;
   inputs: GVIInputs;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ data, inputs }) => {
   // Helper to format currency
   const fmt = (val: number) => `$${formatNumberWithCommas(Math.round(val))}`;
   const pct = (val: number) => `${Math.round(val * 100)}%`;

   const rows = [
      { label: 'Gross Revenue', current: fmt(inputs.currentAGI * (100 / inputs.currentMargin)), target: fmt(inputs.targetAGI * (100 / (inputs.targetMargin || inputs.currentMargin))), isGross: true },
      { label: 'Annual Revenue (AGI)', current: fmt(data.currentAGI), target: fmt(data.targetAGI), highlight: true },
      { label: 'Profit Margin', current: pct(data.currentMargin), target: pct(data.targetMargin) },
      { label: 'Active Clients', current: Math.round(data.currentClients), target: Math.round(data.targetClients) },
      { label: 'Avg Client Value (ACV)', current: fmt(data.currentAGI / (data.currentClients || 1)), target: fmt(data.targetACV) },
      { label: 'Team Size (FTEs)', current: data.currentFTEs, target: parseFloat(data.targetFTEs.toFixed(1)) },
      { label: 'Revenue per FTE', current: fmt(data.currentAGI / (data.currentFTEs || 1)), target: fmt(data.targetAGI / (data.targetFTEs || 1)) },
   ];

   return (
      <div className="overflow-x-auto">
         <table className="w-full text-sm text-left">
            <thead className="text-xs text-[var(--fg-3)] uppercase bg-[var(--bg-canvas)] border-b border-[var(--aos-mist)]">
               <tr>
                  <th className="px-4 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium text-right">Current</th>
                  <th className="px-4 py-3 font-medium text-right">Target</th>
                  <th className="px-4 py-3 font-medium text-right">Growth</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-[var(--aos-mist)]">
               {rows.map((row, idx) => {
                  if (row.isGross) {
                     // Skip rendering Gross if inputs aren't clean numbers yet, or handle it
                     // Actually, let's just render it. Logic above is approximate if margin is 0/undefined.
                     // If margin is 0, we can't reverse engineer Gross easily. 
                     // Use inputs.currentGrossRevenue directly if available.
                  }

                  // Use inputs directly for Gross if possible
                  let currentValStr = row.current;
                  let targetValStr = row.target;

                  if (row.isGross) {
                     // Override calculation with raw input strings if they exist?
                     // inputs.currentGrossRevenue is string.
                  }

                  const currentVal = parseFloat(String(row.current).replace(/[^0-9.-]+/g, ""));
                  const targetVal = parseFloat(String(row.target).replace(/[^0-9.-]+/g, ""));
                  const growth = currentVal > 0 ? ((targetVal - currentVal) / currentVal) * 100 : 0;

                  return (
                     <tr key={idx} className="hover:bg-[var(--bg-canvas)]">
                        <td className={`px-4 py-3 font-medium text-[var(--fg-2)] ${row.highlight ? 'text-[var(--aos-insight)]' : ''}`}>
                           {row.label}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--fg-2)] font-medium bg-[var(--bg-canvas)]">
                           {row.current}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--fg-1)] font-bold bg-[var(--aos-brass-tint)]">
                           {row.target}
                        </td>
                        <td className="px-4 py-3 text-right">
                           <Badge
                              className={`${growth >= 0 ? 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]' : 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)]'} border-none`}
                           >
                              {growth > 0 ? '+' : ''}{Math.round(growth)}%
                           </Badge>
                        </td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
      </div>
   );
};

// --- Standard Calculator Component (Page 1) ---

export const GVCalculator: React.FC = () => {
   const { user } = useAuth();
   const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
   const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
   const [runtimeScenarioId, setRuntimeScenarioId] = useState<string | null>(null);
   const [isSavingScenario, setIsSavingScenario] = useState(false);
   const [selectedLoadId, setSelectedLoadId] = useState('');

   useEffect(() => {
      const fetchScenarios = async () => {
         if (!user) return;
         setIsLoadingScenarios(true);
         const { data, error } = await supabase
            .from('gvs_saved_growth_scenarios')
            .select('id, scenario_name, created_at, gvi_score')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
         if (!error && data) {
            setSavedScenarios(data);
         }
         setIsLoadingScenarios(false);
      };
      // Only fetch if user changes to a defined object
      if (user) {
         fetchScenarios();
      }
   }, [user]);

   const [inputs, setInputs] = useState({
      // Current State
      currentGrossRevenue: '',
      currentRevenue: '', // AGI
      currentMarginType: 'percent', // 'percent' or 'dollar'
      currentMargin: '',
      currentTeam: '',
      currentClients: '',
      currentRetention: '85', // Default 85%
      currentACV: '',
      syncSnapshot: true,

      // Target State
      targetTimeframe: '12',
      targetGrossRevenue: '',
      targetRevenue: '', // AGI Target
      targetMarginType: 'percent', // 'percent' or 'dollar'
      targetMarginValue: '',
      targetTeam: '',
      targetClients: '',
      targetRetention: '',
      targetACV: '',
   });

   const [selectedPresetId, setSelectedPresetId] = useState('');
   const [loadedScenarioName, setLoadedScenarioName] = useState<string | null>(null);

   const [isProcessing, setIsProcessing] = useState(false);
   const [processingStage, setProcessingStage] = useState(0);
   const [showOutput, setShowOutput] = useState(false);
   const [scoreResult, setScoreResult] = useState<GVIScoreResult | null>(null);
   const [synthesisContent, setSynthesisContent] = useState<SynthesisContent | null>(null);
   const [pressureContent, setPressureContent] = useState<Record<string, PressureContent> | null>(null);
   const [parsedInputs, setParsedInputs] = useState<GVIInputs | null>(null);

   // ── Snapshot Sync ─────────────────────────────────────────────────────────
   const fetchSnapshotData = async () => {
      if (!user) return;
      try {
         // Fetch current EF record (financial baseline)
         const { data: efData } = await supabase
            .from('agency_snapshot_economic_foundation')
            .select('annual_revenue_run_rate, annual_agi_run_rate, profit_margin_percentage')
            .eq('user_id', user.id)
            .eq('is_current', true)
            .maybeSingle();

         // Fetch current RM record (clients + churn)
         const { data: rmData } = await supabase
            .from('agency_snapshot_revenue_model')
            .select('active_client_count, monthly_churn_rate')
            .eq('user_id', user.id)
            .eq('is_current', true)
            .maybeSingle();

         // Fetch current DA record (team size)
         const { data: daData } = await supabase
            .from('agency_snapshot_delivery_architecture')
            .select('total_team_size_fte')
            .eq('user_id', user.id)
            .eq('is_current', true)
            .maybeSingle();

         if (!efData && !rmData && !daData) return;

         const grossRevenue = efData?.annual_revenue_run_rate ?? 0;
         const agi = efData?.annual_agi_run_rate ?? 0;
         const margin = efData?.profit_margin_percentage ?? 0;
         const clients = rmData?.active_client_count ?? 0;
         const monthlyChurn = rmData?.monthly_churn_rate ?? 0;
         // Convert monthly churn to annual retention % (e.g. 1.25% monthly → ~85% annual)
         const retention = monthlyChurn > 0
            ? Math.round(Math.max(0, Math.min(100, (1 - monthlyChurn / 100) ** 12 * 100)))
            : 85;
         const team = daData?.total_team_size_fte ?? 0;
         const acv = agi > 0 && clients > 0 ? Math.round(agi / clients) : 0;

         setInputs(prev => ({
            ...prev,
            currentGrossRevenue: grossRevenue > 0 ? String(Math.round(grossRevenue)) : prev.currentGrossRevenue,
            currentRevenue: agi > 0 ? String(Math.round(agi)) : prev.currentRevenue,
            currentMargin: margin > 0 ? String(Math.round(margin)) : prev.currentMargin,
            currentClients: clients > 0 ? String(clients) : prev.currentClients,
            currentRetention: String(retention),
            currentTeam: team > 0 ? String(team) : prev.currentTeam,
            currentACV: acv > 0 ? String(acv) : prev.currentACV,
         }));
      } catch (err) {
         console.error('GVS: Failed to fetch snapshot data for sync:', err);
      }
   };

   // Fetch on mount when syncSnapshot is on
   useEffect(() => {
      if (user && inputs.syncSnapshot) {
         fetchSnapshotData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [user]);

   const handleInputChange = (field: string, value: string | boolean) => {
      setInputs(prev => ({ ...prev, [field]: value }));
      // Re-fetch snapshot data when sync toggle is turned back on
      if (field === 'syncSnapshot' && value === true) {
         fetchSnapshotData();
      }
   };



   const handleRunAnalysis = async () => {
      // 1. Prepare Inputs
      const inputData: GVIInputs = {
         currentAGI: parseFloat(parseFormattedNumber(inputs.currentRevenue)) || 0,
         currentClients: parseFloat(inputs.currentClients) || 0,
         currentRetainer: parseFloat(inputs.currentRetention) || 85,
         currentFTEs: parseFloat(inputs.currentTeam) || 0,
         currentMargin: parseFloat(inputs.currentMargin) || 0,

         targetAGI: parseFloat(parseFormattedNumber(inputs.targetRevenue)) || 0,
         targetClients: inputs.targetClients ? parseFloat(inputs.targetClients) : undefined,
         targetACV: inputs.targetACV ? parseFloat(parseFormattedNumber(inputs.targetACV)) : undefined,
         targetFTEs: inputs.targetTeam ? parseFloat(inputs.targetTeam) : undefined,
         targetMargin: inputs.targetMarginValue ? parseFloat(inputs.targetMarginValue) : undefined,
         timeframeMonths: parseInt(inputs.targetTimeframe) || 12
      };

      setIsProcessing(true);
      setProcessingStage(0);
      setShowOutput(false);

      // Simulate stages for UX
      for (let i = 1; i <= 3; i++) {
         await new Promise(r => setTimeout(r, 600));
         setProcessingStage(i);
      }

      // 2. Run Calculation
      const resolved = resolveVariables(inputData);
      const result = calculateGVIScore(resolved);
      const initialPressure = generatePressureContent(result);

      // 3. Save to Supabase (Runtime Record)
      if (user) {
         try {
            const { data: userData } = await supabase
               .from('users')
               .select('agency_id')
               .eq('user_id', user.id)
               .maybeSingle();
            const agencyId = userData?.agency_id || null;

            const dbImplications = generateDbImplications(result);

            const insertPayload = {
               user_id: user.id,
               agency_id: agencyId,
               inputs: { 
                  raw: inputData, 
                  resolved: resolved,
                  derived_fields: resolved.derived_fields,
                  proxy_fields: resolved.proxy_fields
               },
               results: {
                  gvi_score: result.score,
                  band_label: result.band,
                  composition_label: result.compositionLabel,
                  friction_share_pct: Math.round(result.frictionShare * 100),
                  cagr: result.components.cagr,
                  mass_multiplier: result.components.massMultiplier,
                  mass_label: result.components.massLabel,
                  pace: {
                     ...result.components.pace,
                     sales_pts: result.components.pace.sales,
                     hiring_pts: result.components.pace.hiring,
                     capacity_pts: result.components.pace.capacity,
                     sales_pace_ratio: result.metrics.salesPaceRatio,
                     hiring_pace_rate: result.metrics.hiringPaceRate,
                     target_agi_per_fte: result.metrics.targetAGIPerFTE
                  },
                  friction: {
                     ...result.components.friction,
                     retention_pts: result.components.friction.retention,
                     profit_pts: result.components.friction.profit,
                     concentration_pts: result.components.friction.concentration,
                     positioning_pts: result.components.friction.positioning,
                     acv_delta_pct: Math.round(result.metrics.acvDelta * 100)
                  },
                  total_deductions: result.totalDeductions,
                  watch_signals: result.watchSignals
               },
               implications: dbImplications,
               pressure_insights: generateDbPressureInsights(result),
               synthesis_content: null,
               gvi_score: result.score,
               status: 'pending',
               is_saved: false
            };

            console.log("DEBUG: GVS Insert Payload:", JSON.stringify(insertPayload, null, 2));

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
                           setSynthesisContent(newRecord.synthesis_content);

                           setPressureContent(prev => {
                              if (!prev) return prev;
                              const updated = { ...prev };
                              const updatedPressures = newRecord.synthesis_content.pressureCardContent;
                              if (updatedPressures) {
                                 Object.keys(updatedPressures).forEach(key => {
                                    if (updated[key]) {
                                       updated[key] = {
                                          ...updated[key],
                                          contentBlock: updatedPressures[key].expandedBody || updated[key].contentBlock,
                                          watchSignal: updatedPressures[key].watchSignalNote || updated[key].watchSignal
                                       };
                                    }
                                 });
                              }
                              return updated;
                           });
                        }
                        // Unsubscribe after completion
                        if (newRecord.status === 'complete') {
                           supabase.removeChannel(channel);
                        }
                     }
                  )
                  .subscribe();
            } else if (error) {
               console.error("Failed to insert runtime record:", error);
            }
         } catch (err) {
            console.error(err);
         }
      }

      // 4. Update UI
      setScoreResult(result);
      setParsedInputs(inputData);
      setSynthesisContent(generateSynthesis(result));
      setPressureContent(initialPressure);

      setTimeout(() => {
         setIsProcessing(false);
         setShowOutput(true);
         // Scroll to output
         document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
   };

   const handleSaveScenario = async () => {
      if (!runtimeScenarioId || !user || !scoreResult || !parsedInputs) return;
      setIsSavingScenario(true);

      const scenarioName = prompt("Enter a name for this scenario:", `Scenario ${new Date().toLocaleDateString()}`);
      if (!scenarioName) {
         setIsSavingScenario(false);
         return;
      }

      try {
         // Mark runtime as saved
         await supabase
            .from('gvs_growth_scenarios')
            .update({ is_saved: true })
            .eq('id', runtimeScenarioId);

         const { data: userData } = await supabase
            .from('users')
            .select('agency_id')
            .eq('user_id', user.id)
            .maybeSingle();
         const agencyId = userData?.agency_id || null;

         const horizonTag = inputs.targetTimeframe === '12' ? '12_month' : 
                          inputs.targetTimeframe === '24' ? '24_month' :
                          inputs.targetTimeframe === '36' ? '36_month' : 'ultimate_vision';

         const dbImplications = generateDbImplications(scoreResult);

         // Insert into saved scenarios
         const insertPayload = {
            user_id: user.id,
            agency_id: agencyId,
            scenario_name: scenarioName,
            horizon_tag: horizonTag,
            gvi_score: scoreResult.score,
            inputs: { 
               raw: parsedInputs, 
               resolved: scoreResult.resolved,
               derived_fields: scoreResult.resolved.derived_fields,
               proxy_fields: scoreResult.resolved.proxy_fields
            },
            results: {
               gvi_score: scoreResult.score,
               band_label: scoreResult.band,
               composition_label: scoreResult.compositionLabel,
               friction_share_pct: Math.round(scoreResult.frictionShare * 100),
               cagr: scoreResult.components.cagr,
               mass_multiplier: scoreResult.components.massMultiplier,
               mass_label: scoreResult.components.massLabel,
               pace: {
                  ...scoreResult.components.pace,
                  sales_pts: scoreResult.components.pace.sales,
                  hiring_pts: scoreResult.components.pace.hiring,
                  capacity_pts: scoreResult.components.pace.capacity,
                  sales_pace_ratio: scoreResult.metrics.salesPaceRatio,
                  hiring_pace_rate: scoreResult.metrics.hiringPaceRate,
                  target_agi_per_fte: scoreResult.metrics.targetAGIPerFTE
               },
               friction: {
                  ...scoreResult.components.friction,
                  retention_pts: scoreResult.components.friction.retention,
                  profit_pts: scoreResult.components.friction.profit,
                  concentration_pts: scoreResult.components.friction.concentration,
                  positioning_pts: scoreResult.components.friction.positioning,
                  acv_delta_pct: Math.round(scoreResult.metrics.acvDelta * 100)
               },
               total_deductions: scoreResult.totalDeductions,
               watch_signals: scoreResult.watchSignals
            },
            implications: dbImplications,
            pressure_insights: generateDbPressureInsights(scoreResult),
            synthesis_content: synthesisContent
            // created_at is default now
         };

         const { data, error } = await supabase
            .from('gvs_saved_growth_scenarios')
            .insert([insertPayload])
            .select()
            .single();

         if (data) {
            setSavedScenarios(prev => [data, ...prev]);
            alert("Scenario saved successfully!");
         } else if (error) {
            console.error("Failed to save scenario:", error);
            alert("Failed to save scenario.");
         }
      } catch (err) {
         console.error(err);
         alert("An error occurred while saving.");
      } finally {
         setIsSavingScenario(false);
      }
   };

   const handleLoadScenario = async (id: string) => {
      if (!id || !user) return;

      const scenarioToLoad = savedScenarios.find(s => s.id === id);
      if (scenarioToLoad) {
         setLoadedScenarioName(scenarioToLoad.scenario_name);
      }

      const { data, error } = await supabase
         .from('gvs_saved_growth_scenarios')
         .select('*')
         .eq('id', id)
         .single();

      if (data && !error) {
         // Populate inputs
         if (data.inputs?.raw) {
            const raw = data.inputs.raw;
            setInputs({
               currentGrossRevenue: '',
               currentRevenue: String(raw.currentAGI || ''),
               currentMarginType: 'percent',
               currentMargin: String(raw.currentMargin || ''),
               currentTeam: String(raw.currentFTEs || ''),
               currentClients: String(raw.currentClients || ''),
               currentRetention: String(raw.currentRetainer || '85'),
               currentACV: '', // it'll recalculate visually based on inputs if possible
               syncSnapshot: true,

               targetTimeframe: String(raw.timeframeMonths || 12),
               targetGrossRevenue: '',
               targetRevenue: String(raw.targetAGI || ''),
               targetMarginType: 'percent',
               targetMarginValue: String(raw.targetMargin || ''),
               targetTeam: String(raw.targetFTEs || ''),
               targetClients: String(raw.targetClients || ''),
               targetRetention: '',
               targetACV: String(raw.targetACV || '')
            });
         }

         // Populate outputs
         setParsedInputs(data.inputs?.raw);
         setScoreResult(data.results);
         setPressureContent(data.implications);
         setSynthesisContent(data.synthesis_content || (data.results ? generateSynthesis(data.results) : null));
         setLoadedScenarioName(data.scenario_name);
         setShowOutput(true);

         // Scroll to output
         setTimeout(() => {
            document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
         }, 100);

         // Clear currently loaded load id from UI select and save runtime ID equivalent if possible (not needed for viewer)
         setSelectedLoadId('');
      } else {
         console.error("Failed to load scenario", error);
         alert("Failed to load scenario data.");
      }
   };

   const handlePresetApply = () => {
      if (!selectedPresetId) return;

      const targets = calculatePresetTargets({
         currentRevenue: inputs.currentRevenue,
         currentMargin: inputs.currentMargin,
         currentTeam: inputs.currentTeam,
         currentClients: inputs.currentClients,
         currentRetention: inputs.currentRetention,
         currentACV: inputs.currentACV,
         currentMarginType: inputs.currentMarginType as 'percent' | 'dollar'
      }, selectedPresetId);

      setInputs(prev => ({
         ...prev,
         ...targets
      }));
   };

   return (
      <div className="pb-20">
         {isProcessing && <ProcessingOverlay stage={processingStage} />}

         <div className="max-w-5xl mx-auto mb-12 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex items-center gap-3 mb-8">
               <div className="p-3 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg">
                  <BarChart3 className="h-6 w-6 text-[var(--fg-2)]" />
               </div>
               <div>
                  <h1 className="text-2xl font-bold text-[var(--fg-1)] tracking-tight">Growth Velocity Calculator</h1>
                  <p className="text-[var(--fg-3)]">Model your growth and identify strategic constraints</p>
               </div>
            </div>

            {/* Warnings & Helpers */}
            {/* Warnings & Helpers - Consolidated */}
            <HelperTextPanel />

            {/* Main Form Card */}
            <Card className="p-6 md:p-8">
               {/* Shortcuts & Load Bar */}
               <div className="mb-8">
                  <div className="flex items-center justify-between mb-2">
                     <Label className="text-xs text-[var(--fg-3)] font-normal uppercase tracking-wider">Start from a preset or load a previous scenario</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Left: Quick Start Presets */}
                     <div className="p-4 bg-[var(--bg-sunken)] rounded-lg border border-[var(--aos-mist)]">
                        <Label className="mb-2 block text-[var(--fg-1)] font-medium">Quick Start Presets</Label>
                        <div className="flex gap-2">
                           <Select
                              value={selectedPresetId}
                              onChange={(e) => setSelectedPresetId(e.target.value)}
                              className="bg-[var(--bg-surface)]"
                           >
                              <option value="">-- Select a preset --</option>
                              {PRESETS.map(preset => (
                                 <option key={preset.id} value={preset.id}>{preset.label}</option>
                              ))}
                           </Select>
                           <Button
                              disabled={!selectedPresetId}
                              onClick={handlePresetApply}
                              variant="secondary"
                              size="sm"
                           >
                              Apply
                           </Button>
                        </div>
                        {selectedPresetId && (
                           <p className="mt-2 text-xs text-[var(--fg-3)]">
                              {PRESETS.find(p => p.id === selectedPresetId)?.description}
                           </p>
                        )}
                     </div>

                     {/* Right: Load Saved Scenario */}
                     <div className="p-4 bg-[var(--bg-sunken)] rounded-lg border border-[var(--aos-mist)]">
                        <Label className="mb-2 block text-[var(--fg-1)] font-medium">Load Saved Scenario</Label>
                        <div className="flex gap-2">
                           <Select
                              className="bg-[var(--bg-surface)]"
                              value={selectedLoadId}
                              onChange={(e) => setSelectedLoadId(e.target.value)}
                           >
                              <option value="">-- Select a past scenario --</option>
                              {savedScenarios.map(s => (
                                 <option key={s.id} value={s.id}>
                                    {s.scenario_name} ({s.gvi_score}/100) - {new Date(s.created_at).toLocaleDateString()}
                                 </option>
                              ))}
                           </Select>
                           <Button
                              size="sm"
                              variant="secondary"
                              disabled={!selectedLoadId}
                              onClick={() => handleLoadScenario(selectedLoadId)}
                           >
                              Load
                           </Button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--fg-3)]">
                           Restore a previously saved simulation.
                        </p>
                     </div>
                  </div>

                  {/* Loaded Confirmation Banner */}
                  {loadedScenarioName && (
                     <div className="mt-4 p-3 bg-[var(--aos-success-tint)] border border-[var(--aos-success)] rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 text-sm text-[var(--aos-success)]">
                           <CheckCircle2 className="h-4 w-4" />
                           <span className="font-medium">Loaded: {loadedScenarioName}</span>
                        </div>
                        <button
                           onClick={() => setLoadedScenarioName(null)}
                           className="text-[var(--aos-success)] hover:opacity-70 transition-opacity"
                        >
                           <X className="h-4 w-4" />
                        </button>
                     </div>
                  )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                  {/* Left Column: Current State */}
                  <div>
                     <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--aos-mist)]">
                        <div className="flex items-center gap-2">
                           <MapPin className="h-5 w-5 text-[var(--fg-3)]" />
                           <div>
                              <h3 className="font-semibold text-[var(--fg-1)]">Current State — Where You Are Today</h3>
                              <p className="text-xs text-[var(--fg-3)]">All values are annual figures</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Label htmlFor="sync-toggle" className="mb-0 text-xs font-normal text-[var(--fg-3)]">Sync Snapshot</Label>
                           <Switch
                              id="sync-toggle"
                              checked={inputs.syncSnapshot}
                              onCheckedChange={(checked) => handleInputChange('syncSnapshot', checked)}
                           />
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-4">
                           {/* 1. Annual Gross Revenue (New) */}
                           <div>
                              <Label>Annual Gross Revenue</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="0"
                                    value={formatNumberWithCommas(inputs.currentGrossRevenue)}
                                    onChange={(e) => handleInputChange('currentGrossRevenue', parseFormattedNumber(e.target.value))}
                                 />
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Total revenue before pass-through deductions</p>
                              </div>
                           </div>

                           {/* 2. Annual AGI */}
                           <div>
                              <Label>Annual AGI (Adjusted Gross Income)</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="0"
                                    value={formatNumberWithCommas(inputs.currentRevenue)}
                                    onChange={(e) => {
                                       const newVal = parseFormattedNumber(e.target.value);
                                       handleInputChange('currentRevenue', newVal);
                                       // Auto-calc ACV if clients exists
                                       if (inputs.currentClients && newVal) {
                                          const acv = Math.round(parseFloat(newVal) / parseFloat(inputs.currentClients));
                                          if (!isNaN(acv)) handleInputChange('currentACV', String(acv));
                                       }
                                    }}
                                 />
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Revenue after subcontracting, media, and pass-through costs</p>
                              </div>
                           </div>

                           {/* 3. Profit Margin */}
                           <div>
                              <Label>Profit Margin (%)</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    className="pr-8"
                                    placeholder="0%"
                                    value={inputs.currentMargin}
                                    onChange={(e) => handleInputChange('currentMargin', e.target.value)}
                                 />
                                 <span className="absolute right-3 top-2.5 text-[var(--fg-4)]">%</span>
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Operating profit as a percentage of AGI</p>
                              </div>
                           </div>

                           {/* 4. Active Client Count */}
                           <div>
                              <Label>Active Client Count</Label>
                              <Input
                                 type="number"
                                 placeholder="0"
                                 value={inputs.currentClients}
                                 onChange={(e) => {
                                    const newVal = e.target.value;
                                    handleInputChange('currentClients', newVal);
                                    // Auto-calc ACV if AGI exists
                                    if (inputs.currentRevenue && newVal) {
                                       const acv = Math.round(parseFloat(inputs.currentRevenue) / parseFloat(newVal));
                                       if (!isNaN(acv)) handleInputChange('currentACV', String(acv));
                                    }
                                 }}
                              />
                              <p className="mt-1 text-xs text-[var(--fg-3)]">Total current active clients</p>
                           </div>

                           {/* 5. Average Client Value (ACV) */}
                           <div>
                              <Label>Annual Client Value (ACV)</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="Auto-calculated"
                                    value={formatNumberWithCommas(inputs.currentACV)}
                                    onChange={(e) => handleInputChange('currentACV', parseFormattedNumber(e.target.value))}
                                 />
                                 {/* Show pencil if manually edited could be a nice touch, simplified for now */}
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Auto-calculated from AGI ÷ Client Count. You can override this.</p>
                              </div>
                           </div>

                           {/* 6. Annual Retention Rate */}
                           <div>
                              <Label>Annual Retention Rate (%)</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    className="pr-8"
                                    placeholder="85%"
                                    value={inputs.currentRetention}
                                    onChange={(e) => handleInputChange('currentRetention', e.target.value)}
                                 />
                                 <span className="absolute right-3 top-2.5 text-[var(--fg-4)]">%</span>
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Percentage of clients retained year over year</p>
                              </div>
                           </div>

                           {/* 7. Team Headcount */}
                           <div>
                              <Label>Team Headcount (FTEs)</Label>
                              <Input
                                 type="number"
                                 placeholder="0"
                                 value={inputs.currentTeam}
                                 onChange={(e) => handleInputChange('currentTeam', e.target.value)}
                              />
                              <p className="mt-1 text-xs text-[var(--fg-3)]">Total full-time equivalents including founders</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Target State */}
                  <div>
                     <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--aos-mist)]">
                        <div className="flex items-center gap-2">
                           <Target className="h-5 w-5 text-[var(--aos-insight)]" />
                           <div>
                              <h3 className="font-semibold text-[var(--fg-1)]">Growth Targets — Where You Want to Go</h3>
                              <p className="text-xs text-[var(--fg-3)]">Optional fields assume current state</p>
                           </div>
                        </div>
                        {/* Timeframe Selector (Moved to Header for alignment) */}
                        <div className="flex items-center gap-2">
                           <Label htmlFor="timeframe-select" className="mb-0 text-xs font-normal text-[var(--aos-insight)]">Timeframe</Label>
                           <Select
                              id="timeframe-select"
                              value={inputs.targetTimeframe}
                              onChange={(e) => handleInputChange('targetTimeframe', e.target.value)}
                              className="h-8 py-1 pl-2 pr-8 text-xs w-32 bg-[var(--bg-surface)]"
                           >
                              <option value="12">12 Months</option>
                              <option value="24">24 Months</option>
                              <option value="36">36 Months</option>
                           </Select>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-4">
                           {/* 1. Annual Gross Revenue Target */}
                           <div>
                              <Label>Annual Gross Revenue Target</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="Leave blank to hold constant"
                                    value={formatNumberWithCommas(inputs.targetGrossRevenue)}
                                    onChange={(e) => handleInputChange('targetGrossRevenue', parseFormattedNumber(e.target.value))}
                                 />
                                 {!inputs.targetGrossRevenue && (
                                    <span className="absolute right-3 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>

                           {/* 2. Annual AGI Target */}
                           <div>
                              <Label>Annual AGI Target</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="Leave blank to hold constant"
                                    value={formatNumberWithCommas(inputs.targetRevenue)}
                                    onChange={(e) => handleInputChange('targetRevenue', parseFormattedNumber(e.target.value))}
                                 />
                                 {!inputs.targetRevenue && (
                                    <span className="absolute right-3 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>

                           {/* 3. Profit Margin Target */}
                           <div>
                              <Label>Profit Margin Target (%)</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    className="pr-24"
                                    placeholder="Leave blank to hold constant"
                                    value={inputs.targetMarginValue}
                                    onChange={(e) => handleInputChange('targetMarginValue', e.target.value)}
                                 />
                                 <span className="absolute right-3 top-2.5 text-[var(--fg-4)]">%</span>
                                 {!inputs.targetMarginValue && (
                                    <span className="absolute right-8 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>

                           {/* 4. Target Client Count */}
                           <div>
                              <Label>Target Client Count</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    placeholder="Leave blank to hold constant"
                                    value={inputs.targetClients}
                                    onChange={(e) => handleInputChange('targetClients', e.target.value)}
                                 />
                                 {!inputs.targetClients && (
                                    <span className="absolute right-3 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>

                           {/* 5. Target ACV */}
                           <div>
                              <Label>Target Annual Client Value (ACV)</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-[var(--fg-4)]">$</span>
                                 <Input
                                    type="text"
                                    className="pl-7"
                                    placeholder="Leave blank to calculate"
                                    value={formatNumberWithCommas(inputs.targetACV)}
                                    onChange={(e) => handleInputChange('targetACV', parseFormattedNumber(e.target.value))}
                                 />
                                 <p className="mt-1 text-xs text-[var(--fg-3)]">Auto-calculated if Client Count and AGI targets are both entered</p>
                              </div>
                           </div>

                           {/* 6. Target Retention Rate */}
                           <div>
                              <Label>Target Retention Rate (%)</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    className="pr-8"
                                    placeholder="Leave blank to hold constant"
                                    value={inputs.targetRetention}
                                    onChange={(e) => handleInputChange('targetRetention', e.target.value)}
                                 />
                                 <span className="absolute right-3 top-2.5 text-[var(--fg-4)]">%</span>
                                 {!inputs.targetRetention && (
                                    <span className="absolute right-8 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>

                           {/* 7. Target Team Headcount */}
                           <div>
                              <Label>Target Team Headcount (FTEs)</Label>
                              <div className="relative">
                                 <Input
                                    type="number"
                                    placeholder="Leave blank to hold constant"
                                    value={inputs.targetTeam}
                                    onChange={(e) => handleInputChange('targetTeam', e.target.value)}
                                 />
                                 {!inputs.targetTeam && (
                                    <span className="absolute right-3 top-2.5 text-[10px] text-[var(--fg-4)] font-medium bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded">Assuming current</span>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>






               {/* Actions Row */}
               <div className="mt-8 flex gap-4">
                  <Button
                     variant="outline"
                     className="flex-1 border-[var(--aos-mist)] text-[var(--fg-2)] hover:bg-[var(--bg-canvas)]"
                     onClick={() => setInputs(prev => ({
                        ...prev,
                        targetGrossRevenue: '',
                        targetRevenue: '',
                        targetMarginValue: '',
                        targetTeam: '',
                        targetClients: '',
                        targetRetention: '',
                        targetACV: ''
                     }))}
                  >
                     <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button
                     onClick={handleRunAnalysis}
                     disabled={!inputs.targetRevenue}
                     className="flex-[3] py-4 text-lg shadow-lg hover:shadow-xl transition-all"
                  >
                     <Rocket className="mr-2 h-5 w-5" /> Run Scenario Analysis
                  </Button>
               </div>
            </Card>
         </div>

         {/* Output Section */}
         {
            showOutput && scoreResult && (
               <div id="output-section" className="w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">

                  {/* Synthesis Section */}
                  {synthesisContent && <SynthesisSection content={synthesisContent} />}

                  {/* Top Row: GVI + Metrics */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-1">
                        <GVIDisplay result={scoreResult} />
                     </div>
                     <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MetricCard
                           icon={TrendingUp}
                           label="CAGR"
                           value={`${Math.round(scoreResult.components.cagr).toFixed(1)}%`}
                           context="Annual compound growth"
                        />
                        <MetricCard
                           icon={Users}
                           label="Target AGI per FTE"
                           value={`$${formatNumberWithCommas(Math.round(scoreResult.metrics.targetAGIPerFTE / 1000))}k`}
                           context={`vs. current $${formatNumberWithCommas(Math.round(scoreResult.resolved.currentAGI / scoreResult.resolved.currentFTEs / 1000))}k`}
                        />
                        <MetricCard
                           icon={DollarSign}
                           label="Net New Revenue"
                           value={`$${formatNumberWithCommas(Math.round(scoreResult.metrics.netNewRevenue / 1000))}k`}
                           context="Requires replacing churn"
                        />
                        <MetricCard
                           icon={Target}
                           label="Sales Velocity"
                           value={`${scoreResult.metrics.requiredMonthlySalesVelocity.toFixed(1)}/mo`}
                           context={`vs. current ${scoreResult.metrics.currentMonthlySalesVelocity?.toFixed(1) || '0.0'}/mo`}
                        />
                        <MetricCard
                           icon={Users}
                           label="Hiring Velocity"
                           value={`${scoreResult.metrics.hiringPaceRate.toFixed(1)}/qtr`}
                           context={`${Math.round((scoreResult.metrics.hiringPaceRate * 4) / scoreResult.resolved.targetFTEs * 100)}% annual change`}
                        />
                        <MetricCard
                           icon={Scale}
                           label="Profit Pool"
                           value={`$${formatNumberWithCommas(Math.round((scoreResult.resolved.targetAGI * scoreResult.metrics.profitMargin)))}`}
                           context={`vs. current $${formatNumberWithCommas(Math.round(scoreResult.resolved.currentAGI * scoreResult.resolved.currentMargin))}`}
                        />
                     </div>
                  </div>

                  {/* Pressure Dashboard */}
                  <div>
                     <h2 className="text-xl font-bold text-[var(--fg-1)] mb-6 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[var(--fg-2)]" /> Pressure Dashboard
                     </h2>
                     {pressureContent && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           <PressureCard content={pressureContent.retention} icon={RotateCcw} />
                           <PressureCard content={pressureContent.sales} icon={Target} />
                           <PressureCard content={pressureContent.hiring} icon={Users} />
                           <PressureCard content={pressureContent.margin} icon={DollarSign} />
                           <PressureCard content={pressureContent.concentration} icon={Scale} />
                           <PressureCard content={pressureContent.positioning} icon={ArrowUpRight} />
                        </div>
                     )}
                  </div>

                  {/* Charts & Table */}
                  <div className="space-y-8">
                     <Card className="overflow-hidden">
                        <div className="p-4 border-b border-[var(--aos-mist)] bg-[var(--bg-canvas)] font-semibold text-[var(--fg-2)]">Metrics Comparison</div>
                        {parsedInputs && <ComparisonTable data={scoreResult.resolved} inputs={parsedInputs} />}
                     </Card>
                  </div>

                  {/* Actions */}
                  <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row justify-center gap-4 bg-[var(--bg-surface)]/80 backdrop-blur p-4 rounded-xl border border-[var(--aos-mist)] shadow-xl max-w-3xl mx-auto">
                     <Button onClick={handleSaveScenario} disabled={isSavingScenario} className="shadow-md">
                        <Save className="mr-2 h-4 w-4" /> {isSavingScenario ? 'Saving...' : 'Save Scenario'}
                     </Button>
                     <Link to="/foundations/clarity-compass/vision-state">
                        <Button variant="outline">
                           <LinkIcon className="mr-2 h-4 w-4" /> Attach to Vision Horizon
                        </Button>
                     </Link>
                     <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Download Analysis
                     </Button>
                     <Button variant="outline" className="opacity-70">
                        <Lock className="mr-2 h-4 w-4" /> Compare Scenarios <Badge color="gray" className="ml-2">Pro</Badge>
                     </Button>
                  </div>
               </div>
            )
         }
      </div>
   );
};



// --- Scenario Planner Component (Page 2) ---

export const GVScenarioPlanner: React.FC = () => {
   const [mode, setMode] = useState<'build' | 'compare'>('build');

   return (
      <div className="pb-20">
         <div className="max-w-full mx-auto mb-12">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
               <div className="p-3 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg">
                  <SlidersHorizontal className="h-6 w-6 text-[var(--aos-insight)]" />
               </div>
               <div>
                  <h1 className="text-2xl font-bold text-[var(--fg-1)] tracking-tight">Scenario Planner</h1>
                  <p className="text-[var(--fg-3)]">Advanced growth modeling and scenario comparison.</p>
               </div>
            </div>

            {/* Pill Toggle */}
            <div className="flex justify-start mb-8">
               <div className="inline-flex bg-[var(--bg-canvas)]/80 hover:bg-[var(--bg-canvas)] p-1 rounded-full border border-[var(--aos-mist)]/60 transition-colors">
                  <button
                     onClick={() => setMode('build')}
                     className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${mode === 'build'
                        ? 'bg-[var(--bg-surface)] text-[var(--fg-1)] shadow-sm ring-1 ring-[var(--aos-mist)]'
                        : 'text-[var(--fg-3)] hover:text-[var(--fg-2)]'
                        }`}
                  >
                     Build Scenario
                  </button>
                  <button
                     onClick={() => setMode('compare')}
                     className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${mode === 'compare'
                        ? 'bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] shadow-sm'
                        : 'text-[var(--fg-2)] hover:text-[var(--fg-1)]'
                        }`}
                  >
                     Compare
                  </button>
               </div>
            </div>

            {mode === 'build' ? (
               <ScenarioPlannerInputs onViewComparison={() => setMode('compare')} />
            ) : (
               <ScenarioCompareMode onSwitchToBuild={() => setMode('build')} />
            )}
         </div>
      </div>
   );
};
