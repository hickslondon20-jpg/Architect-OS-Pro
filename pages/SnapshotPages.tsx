import React, { useState, useEffect } from 'react';
import {
   Card,
   Button,
   Input,
   Select,
   Label,
   PlaceholderContent
} from '../components/ui';
import {
   Info,
   ChevronDown,
   ChevronUp,
   DollarSign,
   TrendingUp,
   Users,
   Building2,
   Activity,
   BarChart3,
   PieChart,
   Lightbulb,
   Loader2,
   Save,
   Sparkles,
   Check,
   AlertCircle,
   Target,
   RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FinancialProfile } from '../components/snapshot/FinancialProfile';
import { GrowthProfile } from '../components/snapshot/GrowthProfile';
import { TeamProfile } from '../components/snapshot/TeamProfile';
import { IdentityPositioningTab } from '../components/snapshot/IdentityPositioningTab';


// --- Shared Components ---

const ExpandableInsightCard: React.FC<{ headline: string, copy: string }> = ({ headline, copy }) => {
   const [isOpen, setIsOpen] = useState(false);

   return (
       <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg shadow-[var(--shadow-soft-1)] relative overflow-hidden group transition-all hover:border-[var(--aos-insight)] hover:shadow-[var(--shadow-soft-2)] mb-4">
           <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isOpen ? 'bg-[var(--aos-insight)]' : 'bg-[var(--aos-mist)] group-hover:bg-[var(--aos-insight)]'}`}></div>
           <button
               onClick={() => setIsOpen(!isOpen)}
               className="w-full text-left p-5 focus:outline-none flex flex-col"
           >
               <div className="flex justify-between items-start gap-4 w-full">
                   <h5 className={`font-bold text-sm leading-tight transition-colors ${isOpen ? 'text-[var(--fg-1)]' : 'text-[var(--fg-1)] group-hover:text-[var(--fg-1)]'}`}>
                       {headline}
                   </h5>
                   <div className="shrink-0 bg-[var(--bg-canvas)] p-1 rounded-md text-[var(--fg-4)] group-hover:text-[var(--aos-insight)] group-hover:bg-[var(--aos-insight-tint)] transition-colors">
                       {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                   </div>
               </div>
               {!isOpen && (
                   <div className="mt-2 text-xs font-semibold text-[var(--fg-4)] group-hover:text-[var(--aos-insight)] transition-colors flex items-center gap-1">
                       Read analysis
                   </div>
               )}
           </button>

           {isOpen && (
               <div className="px-5 pb-5 pt-2 border-t border-[var(--aos-mist)] animate-in slide-in-from-top-1 fade-in duration-200">
                   <p className="text-sm text-[var(--fg-2)] leading-relaxed">{copy}</p>
               </div>
           )}
       </div>
   );
};

// --- Shared Components ---

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; description?: string }> = ({ icon: Icon, title, description }) => (
   <div className="flex items-start gap-4 mb-6 pb-6 border-b border-[var(--aos-mist)]">
      <div className="p-2 bg-[var(--bg-canvas)] rounded-lg">
         <Icon className="h-6 w-6 text-[var(--fg-2)]" />
      </div>
      <div>
         <h2 className="text-lg font-semibold text-[var(--fg-1)]">{title}</h2>
         {description && <p className="text-sm text-[var(--fg-3)] mt-1">{description}</p>}
      </div>
   </div>
);

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
   <div className="mb-8">
      <h3 className="text-sm font-medium text-[var(--fg-1)] uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-4">
         {children}
      </div>
   </div>
);

const AdvancedSection: React.FC<{ children: React.ReactNode; description?: string }> = ({ children, description }) => {
   const [isOpen, setIsOpen] = useState(false);

   return (
      <div className="border border-[var(--aos-mist)] rounded-lg bg-[var(--bg-canvas)] mb-8 overflow-hidden">
         <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-sunken)] transition-colors"
         >
            <div>
               <span className="block text-sm font-medium text-[var(--fg-2)]">Enhanced Metrics (Optional)</span>
               <span className="block text-xs text-[var(--fg-3)] mt-1 font-normal">
                  {description || "Provide additional context for deeper financial insights"}
               </span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-[var(--fg-4)]" /> : <ChevronDown className="h-4 w-4 text-[var(--fg-4)]" />}
         </button>
         {isOpen && (
            <div className="p-4 border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] space-y-4">
               {children}
            </div>
         )}
      </div>
   );
};

const MetricCard: React.FC<{ label: string; value: string; subtext?: string; trend?: string }> = ({ label, value, subtext, trend }) => (
   <div className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)]">
      <div className="text-xs font-medium text-[var(--fg-3)] mb-1">{label}</div>
      <div className="text-2xl font-bold text-[var(--fg-1)] mb-1">{value}</div>
      {(subtext || trend) && (
         <div className="flex items-center justify-between text-xs">
            {subtext && <span className="text-[var(--fg-4)]">{subtext}</span>}
            {trend && <span className="text-[var(--aos-success)] font-medium">{trend}</span>}
         </div>
      )}
   </div>
);

const SnapshotLayout: React.FC<{ children: React.ReactNode; sidebarMetrics: React.ReactNode; sidebarClassName?: string }> = ({ children, sidebarMetrics, sidebarClassName }) => (
   <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
         <Card className="p-6 sm:p-8">
            {children}
         </Card>
      </div>
      <div className={`flex-shrink-0 ${sidebarClassName || 'lg:w-80'}`}>
         <div className="sticky top-24 space-y-4">
            <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--aos-mist)] p-4 shadow-[var(--shadow-soft-1)]">
               <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-[var(--fg-3)]" />
                  <h3 className="text-sm font-semibold text-[var(--fg-1)]">Calculated Metrics</h3>
               </div>
               <p className="text-xs text-[var(--fg-3)] mb-4">These metrics calculate automatically based on your inputs.</p>
               <p className="text-[10px] text-[var(--fg-4)] italic border-t border-[var(--aos-mist)] pt-2 mb-4">
                  *All figures are based on previously provided AGI figures for standardization.
               </p>
               <div className="space-y-3">
                  {sidebarMetrics}
               </div>
            </div>
         </div>
      </div>
   </div>
);

// --- Tab 1: Dashboard ---

// --- Tab 1: Dashboard ---

export { SnapshotDashboard } from '../components/snapshot/SnapshotDashboard';


// --- Tab 2: Financial Snapshot ---

// --- Helper Components for Financial Tab ---

const CurrencyInput: React.FC<{
   value: number | undefined;
   onChange: (value: number | undefined) => void;
   placeholder?: string;
}> = ({ value, onChange, placeholder = "$0" }) => {
   const [displayValue, setDisplayValue] = useState(value ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '');

   // Update display value when prop changes externally (e.g. initial load or reset)
   React.useEffect(() => {
      if (value !== undefined && value !== null) {
         setDisplayValue(`$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
      } else {
         setDisplayValue('');
      }
   }, [value]);

   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawArgs = e.target.value;
      // Allow digits, dots, commas, dollar sign
      const cleaned = rawArgs.replace(/[^0-9.]/g, '');

      // Check if it's a valid partial number (e.g. "1." or "1.0")
      // If user is typing, we might just want to let them type
      setDisplayValue(e.target.value);
   };

   const handleBlur = () => {
      // Parse the value
      const raw = displayValue.replace(/[^0-9.]/g, '');
      const num = parseFloat(raw);

      if (!isNaN(num)) {
         onChange(num);
         setDisplayValue(`$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
      } else {
         onChange(undefined);
         setDisplayValue('');
      }
   };

   return (
      <Input
         type="text"
         value={displayValue}
         onChange={handleChange}
         onBlur={handleBlur}
         placeholder={placeholder}
      />
   );
};

const PercentageInput: React.FC<{
   value: number | undefined;
   onChange: (value: number | undefined) => void;
   placeholder?: string;
}> = ({ value, onChange, placeholder = "0%" }) => {
   const [displayValue, setDisplayValue] = useState(value ? `${Math.round(value)}%` : '');

   // Update display value when prop changes externally
   React.useEffect(() => {
      if (value !== undefined && value !== null) {
         setDisplayValue(`${Math.round(value)}%`);
      } else {
         setDisplayValue('');
      }
   }, [value]);

   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setDisplayValue(e.target.value);
   };

   const handleBlur = () => {
      const raw = displayValue.replace(/[^0-9.-]/g, '');
      const num = parseFloat(raw);

      if (!isNaN(num)) {
         // Clamp between -100 and 100, then round to nearest integer
         const clamped = Math.round(Math.min(100, Math.max(-100, num)));
         onChange(clamped);
         setDisplayValue(`${clamped}%`);
      } else {
         onChange(undefined);
         setDisplayValue('');
      }
   };

   return (
      <Input
         type="text"
         value={displayValue}
         onChange={handleChange}
         onBlur={handleBlur}
         placeholder={placeholder}
      />
   );
};


// Compute canonical SHA-256 input_hash over the 13 EF intake fields (fixed key order, normalized)
async function computeEFInputHash(fields: {
   monthly_revenue: number | undefined;
   monthly_agi: number | undefined;
   monthly_payroll: number | undefined;
   profit_margin_percentage: number | undefined;
   cash_available: number | undefined;
   financial_health_status: string;
   monthly_passthrough_costs: number | undefined;
   monthly_overhead: number | undefined;
   owner_compensation: number | undefined;
   gross_margin_percentage: number | undefined;
   accounts_receivable: number | undefined;
   accounts_payable: number | undefined;
   cash_flow_health: string;
}): Promise<string> {
   const norm = (v: number | undefined): number | null => (v === undefined || v === null) ? null : v;
   const normStr = (s: string): string | null => (!s || s.trim() === '') ? null : s.trim();

   const canonical = {
      monthly_revenue: norm(fields.monthly_revenue),
      monthly_agi: norm(fields.monthly_agi),
      monthly_payroll: norm(fields.monthly_payroll),
      profit_margin_percentage: norm(fields.profit_margin_percentage),
      cash_available: norm(fields.cash_available),
      financial_health_status: normStr(fields.financial_health_status),
      monthly_passthrough_costs: norm(fields.monthly_passthrough_costs),
      monthly_overhead: norm(fields.monthly_overhead),
      owner_compensation: norm(fields.owner_compensation),
      gross_margin_percentage: norm(fields.gross_margin_percentage),
      accounts_receivable: norm(fields.accounts_receivable),
      accounts_payable: norm(fields.accounts_payable),
      cash_flow_health: normStr(fields.cash_flow_health),
   };

   const encoded = new TextEncoder().encode(JSON.stringify(canonical));
   const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
   return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type RMInputHashFields = {
   revenue_mix_mrr_percentage: number | undefined;
   active_client_count: number | undefined;
   client_tier_mix: string;
   monthly_churn_rate: number | undefined;
   average_client_lifetime_months: number | undefined;
   typical_win_rate: number | undefined;
   average_sales_cycle: string;
   channel_referrals_rank: string;
   channel_partnerships_rank: string;
   channel_content_rank: string;
   channel_paid_rank: string;
   channel_outbound_rank: string;
   concentration_top5_pct: number | undefined;
   concentration_top10_pct: number | undefined;
   concentration_top20_pct: number | undefined;
};

function buildRMCanonicalInput(fields: RMInputHashFields) {
   const norm = (v: number | undefined): number | null => (v === undefined || v === null) ? null : v;
   const normStr = (s: string): string | null => (!s || s.trim() === '') ? null : s.trim();

   return {
      revenue_mix_mrr_percentage: norm(fields.revenue_mix_mrr_percentage),
      active_client_count: norm(fields.active_client_count),
      client_tier_mix: normStr(fields.client_tier_mix),
      monthly_churn_rate: norm(fields.monthly_churn_rate),
      average_client_lifetime_months: norm(fields.average_client_lifetime_months),
      typical_win_rate: norm(fields.typical_win_rate),
      average_sales_cycle: normStr(fields.average_sales_cycle),
      channel_referrals_rank: normStr(fields.channel_referrals_rank),
      channel_partnerships_rank: normStr(fields.channel_partnerships_rank),
      channel_content_rank: normStr(fields.channel_content_rank),
      channel_paid_rank: normStr(fields.channel_paid_rank),
      channel_outbound_rank: normStr(fields.channel_outbound_rank),
      concentration_top5_pct: norm(fields.concentration_top5_pct),
      concentration_top10_pct: norm(fields.concentration_top10_pct),
      concentration_top20_pct: norm(fields.concentration_top20_pct),
   };
}

// Compute canonical SHA-256 input_hash over the 15 RM intake values (fixed key order, normalized)
async function computeRMInputHash(fields: RMInputHashFields): Promise<string> {
   const encoded = new TextEncoder().encode(JSON.stringify(buildRMCanonicalInput(fields)));
   const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
   return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type DAInputHashFields = {
   total_team_size_fte: number | undefined;
   billable_staff_count: number | undefined;
   non_billable_staff_count: number | undefined;
   team_structure_type: string;
   founder_time_allocation: string;
   average_team_utilization: string;
   average_contractor_count: number | undefined;
   key_leadership_roles: string[];
   management_layers: string;
   specialized_roles: string[];
   average_team_experience: string;
};

function buildDACanonicalInput(fields: DAInputHashFields) {
   const norm = (v: number | undefined): number | null => (v === undefined || v === null) ? null : v;
   const normStr = (s: string): string | null => (!s || s.trim() === '') ? null : s.trim();
   const normArray = (values: string[]): string[] => values.map(v => v.trim()).filter(Boolean).sort();

   return {
      total_team_size_fte: norm(fields.total_team_size_fte),
      billable_staff_count: norm(fields.billable_staff_count),
      non_billable_staff_count: norm(fields.non_billable_staff_count),
      team_structure_type: normStr(fields.team_structure_type),
      founder_time_allocation: normStr(fields.founder_time_allocation),
      average_team_utilization: normStr(fields.average_team_utilization),
      average_contractor_count: norm(fields.average_contractor_count),
      key_leadership_roles: normArray(fields.key_leadership_roles),
      management_layers: normStr(fields.management_layers),
      specialized_roles: normArray(fields.specialized_roles),
      average_team_experience: normStr(fields.average_team_experience),
   };
}

// Compute canonical SHA-256 input_hash over the 11 DA intake values (fixed key order, sorted arrays)
async function computeDAInputHash(fields: DAInputHashFields): Promise<string> {
   const encoded = new TextEncoder().encode(JSON.stringify(buildDACanonicalInput(fields)));
   const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
   return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const FinancialSnapshot: React.FC = () => {
   // --- State ---
   // Baseline Fields
   const [monthlyRevenue, setMonthlyRevenue] = useState<number | undefined>();
   const [monthlyAGI, setMonthlyAGI] = useState<number | undefined>();
   const [monthlyPayroll, setMonthlyPayroll] = useState<number | undefined>();
   const [profitMargin, setProfitMargin] = useState<number | undefined>();
   const [cashAvailable, setCashAvailable] = useState<number | undefined>();
   const [financialHealth, setFinancialHealth] = useState<string>("");

   // Enhanced Fields
   const [passThroughCosts, setPassThroughCosts] = useState<number | undefined>();
   const [sgaOverhead, setSgaOverhead] = useState<number | undefined>();
   const [ownerComp, setOwnerComp] = useState<number | undefined>();
   const [grossMargin, setGrossMargin] = useState<number | undefined>();
   const [ar, setAr] = useState<number | undefined>();
   const [ap, setAp] = useState<number | undefined>();
   const [cashFlowHealth, setCashFlowHealth] = useState<string>("");
   const [isLoading, setIsLoading] = useState(true);
   const [profileData, setProfileData] = useState<any>(null);
   const [showProfile, setShowProfile] = useState(false);

   // Row-keyed versioning state (replaces snapshotInstanceId)
   const [currentRowId, setCurrentRowId] = useState<string>('');
   const [isSynthesizing, setIsSynthesizing] = useState(false);
   const [synthesisStatus, setSynthesisStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
   const [synthesisBeats, setSynthesisBeats] = useState<any[]>([]);
   const [synthesisSignal, setSynthesisSignal] = useState<string>('');
   const [synthesisErrorMsg, setSynthesisErrorMsg] = useState<string>('');

   // --- Load Data on Mount ---
   React.useEffect(() => {
      const loadFinancialData = async () => {
         try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
               setIsLoading(false);
               return;
            }

            const { data, error } = await supabase
               .from('agency_snapshot_economic_foundation')
               .select('*')
               .eq('user_id', user.id)
               .eq('is_current', true)
               .maybeSingle();

            if (error) {
               console.error('Error loading financial data:', error);
            }

            if (data) {
               setCurrentRowId(data.id);
               setMonthlyRevenue(data.monthly_revenue);
               setMonthlyAGI(data.monthly_agi);
               setMonthlyPayroll(data.monthly_payroll);
               setProfitMargin(data.profit_margin_percentage);
               setCashAvailable(data.cash_available);
               setFinancialHealth(data.financial_health_status || "");

               setPassThroughCosts(data.monthly_passthrough_costs);
               setSgaOverhead(data.monthly_overhead);
               setOwnerComp(data.owner_compensation);
               setGrossMargin(data.gross_margin_percentage);
               setAr(data.accounts_receivable);
               setAp(data.accounts_payable);
               setCashFlowHealth(data.cash_flow_health || "");

               setProfileData(data);
               setShowProfile(true);
               if (data.synthesis_status) {
                  setSynthesisStatus(data.synthesis_status as any);
                  if (data.synthesis_status === 'complete') {
                     setSynthesisBeats([
                         { headline: data.synthesis_beat_1_headline, copy: data.synthesis_beat_1 },
                         { headline: data.synthesis_beat_2_headline, copy: data.synthesis_beat_2 },
                         { headline: data.synthesis_beat_3_headline, copy: data.synthesis_beat_3 },
                     ].filter(b => b.headline && b.copy));
                     setSynthesisSignal(data.synthesis_signal || '');
                  } else if (data.synthesis_status === 'error') {
                     setSynthesisErrorMsg(data.synthesis_error || '');
                  }
               }
            }
         } catch (err) {
            console.error('Unexpected error loading data:', err);
         } finally {
            setIsLoading(false);
         }
      };

      loadFinancialData();
   }, []);

   // --- Polling Effect (keyed on row id) ---
   useEffect(() => {
      let pollInterval: NodeJS.Timeout;

      if (synthesisStatus === 'running' && currentRowId) {
         pollInterval = setInterval(async () => {
            const { data, error } = await supabase
               .from('agency_snapshot_economic_foundation')
               .select('synthesis_status, synthesis_beat_1_headline, synthesis_beat_1, synthesis_beat_2_headline, synthesis_beat_2, synthesis_beat_3_headline, synthesis_beat_3, synthesis_signal, synthesis_error')
               .eq('id', currentRowId)
               .single();

            if (!error && data) {
               if (data.synthesis_status === 'complete') {
                  setSynthesisStatus('complete');
                  setSynthesisBeats([
                     { headline: data.synthesis_beat_1_headline, copy: data.synthesis_beat_1 },
                     { headline: data.synthesis_beat_2_headline, copy: data.synthesis_beat_2 },
                     { headline: data.synthesis_beat_3_headline, copy: data.synthesis_beat_3 },
                  ].filter(b => b.headline && b.copy));
                  setSynthesisSignal(data.synthesis_signal || '');
                  setIsSynthesizing(false);
               } else if (data.synthesis_status === 'error') {
                  setSynthesisStatus('error');
                  setSynthesisErrorMsg(data.synthesis_error || 'Synthesis failed on the server.');
                  setIsSynthesizing(false);
               }
            }
         }, 3000);
      }

      return () => {
         if (pollInterval) clearInterval(pollInterval);
      };
   }, [synthesisStatus, currentRowId]);

   // --- Calculations ---

   // 1. AGI Percentage: (monthly_agi / monthly_revenue) * 100
   const agiPercentage = (monthlyAGI !== undefined && monthlyRevenue !== undefined && monthlyRevenue > 0)
      ? (monthlyAGI / monthlyRevenue) * 100
      : undefined;

   // 2. Annual Revenue Run Rate: monthly_revenue * 12
   const annualRevenueRunRate = (monthlyRevenue !== undefined)
      ? monthlyRevenue * 12
      : undefined;

   // 3. Annual AGI Run Rate: monthly_agi * 12
   const annualAGIRunRate = (monthlyAGI !== undefined)
      ? monthlyAGI * 12
      : undefined;

   // 4. Monthly Operating Profit: monthly_agi * (profit_margin / 100)
   const monthlyOperatingProfit = (monthlyAGI !== undefined && profitMargin !== undefined)
      ? monthlyAGI * (profitMargin / 100)
      : undefined;

   // 5. Monthly Operating Expenses: monthly_agi - monthly_operating_profit
   const monthlyOperatingExpenses = (monthlyAGI !== undefined && monthlyOperatingProfit !== undefined)
      ? monthlyAGI - monthlyOperatingProfit
      : undefined;

   // 6. Cash Runway: cash_available / monthly_operating_expenses
   const cashRunway = (cashAvailable !== undefined && monthlyOperatingExpenses !== undefined)
      ? (monthlyOperatingExpenses > 0 ? cashAvailable / monthlyOperatingExpenses : undefined) // undefined or "N/A" equivalent
      : undefined;


   const formatCurrency = (val: number | undefined) => {
      if (val === undefined) return "$---";
      return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; // Spec says commas, usually run rates are whole numbers but spec layout says "$XXX,XXX"
   };

   const formatPercent = (val: number | undefined) => {
      if (val === undefined) return "---%";
      return `${val.toFixed(1)}%`;
   };

   const metrics = (
      <>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">AGI Percentage</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {formatPercent(agiPercentage)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">Annual Revenue</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {formatCurrency(annualRevenueRunRate)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">Annual AGI</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {formatCurrency(annualAGIRunRate)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">Monthly Op. Profit</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {formatCurrency(monthlyOperatingProfit)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">Monthly Op. Expenses</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {formatCurrency(monthlyOperatingExpenses)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0">
            <span className="text-sm text-[var(--fg-3)] font-medium">Cash Runway</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all">
               {cashRunway !== undefined
                  ? (annualAGIRunRate !== undefined && monthlyOperatingExpenses === 0 ? "N/A" : `${cashRunway.toFixed(1)} months`)
                  : "--- months"}
            </span>
         </div>

         <div className="mt-8 pt-8 border-t border-[var(--aos-mist)]">
            <div className="flex items-center justify-center font-medium text-[var(--fg-4)] mb-2">
               <Lightbulb className="h-4 w-4 mr-2" />
               <span className="uppercase tracking-wider text-xs">What This Tells Us</span>
            </div>
            <p className="text-center text-sm text-[var(--fg-4)] italic px-4">
               Click "Save Financial Data" below to generate contextual insights and benchmark comparisons for your financial profile.
            </p>
         </div>
      </>
   );

   // --- Save Handler (reactivate-or-insert) ---
   const handleSave = async () => {
      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) {
            alert("Please sign in to save data.");
            return;
         }

         const h = await computeEFInputHash({
            monthly_revenue: monthlyRevenue,
            monthly_agi: monthlyAGI,
            monthly_payroll: monthlyPayroll,
            profit_margin_percentage: profitMargin,
            cash_available: cashAvailable,
            financial_health_status: financialHealth,
            monthly_passthrough_costs: passThroughCosts,
            monthly_overhead: sgaOverhead,
            owner_compensation: ownerComp,
            gross_margin_percentage: grossMargin,
            accounts_receivable: ar,
            accounts_payable: ap,
            cash_flow_health: cashFlowHealth,
         });

         // Look up existing row with same input combination
         const { data: match, error: lookupError } = await supabase
            .from('agency_snapshot_economic_foundation')
            .select('*')
            .eq('user_id', user.id)
            .eq('input_hash', h)
            .limit(1)
            .maybeSingle();

         if (lookupError) {
            console.error('Error looking up hash:', lookupError);
            alert("Failed to save data.");
            return;
         }

         if (match) {
            // Resurfaced: re-promote the existing row (trigger demotes others)
            const { error: updateError } = await supabase
               .from('agency_snapshot_economic_foundation')
               .update({ is_current: true, updated_at: new Date().toISOString() })
               .eq('id', match.id);

            if (updateError) {
               console.error('Error reactivating row:', updateError);
               alert("Failed to save data.");
               return;
            }

            setCurrentRowId(match.id);
            setProfileData(match);
            setShowProfile(true);
            // Hydrate cached synthesis
            if (match.synthesis_status === 'complete') {
               setSynthesisStatus('complete');
               setSynthesisBeats([
                  { headline: match.synthesis_beat_1_headline, copy: match.synthesis_beat_1 },
                  { headline: match.synthesis_beat_2_headline, copy: match.synthesis_beat_2 },
                  { headline: match.synthesis_beat_3_headline, copy: match.synthesis_beat_3 },
               ].filter(b => b.headline && b.copy));
               setSynthesisSignal(match.synthesis_signal || '');
            } else {
               setSynthesisStatus(match.synthesis_status || 'idle');
            }
            alert("Economic Foundation data saved (prior version restored).");
         } else {
            // Net-new: insert (trigger assigns version_number; snapshot_instance_id left null)
            const { data, error } = await supabase
               .from('agency_snapshot_economic_foundation')
               .insert([{
                  user_id: user.id,
                  input_hash: h,
                  is_complete: true,
                  is_current: true,
                  monthly_revenue: monthlyRevenue,
                  monthly_agi: monthlyAGI,
                  monthly_payroll: monthlyPayroll,
                  profit_margin_percentage: profitMargin,
                  cash_available: cashAvailable,
                  financial_health_status: financialHealth || null,
                  monthly_passthrough_costs: passThroughCosts,
                  monthly_overhead: sgaOverhead,
                  owner_compensation: ownerComp,
                  gross_margin_percentage: grossMargin,
                  accounts_receivable: ar,
                  accounts_payable: ap,
                  cash_flow_health: cashFlowHealth || null,
                  agi_percentage_calculated: agiPercentage,
                  annual_revenue_run_rate: annualRevenueRunRate,
                  annual_agi_run_rate: annualAGIRunRate,
                  monthly_operating_profit: monthlyOperatingProfit,
                  monthly_operating_expenses: monthlyOperatingExpenses,
                  cash_runway_months: cashRunway,
               }])
               .select()
               .single();

            if (error) {
               console.error('Error saving data:', error);
               alert("Failed to save data.");
            } else if (data) {
               setCurrentRowId(data.id);
               setProfileData(data);
               setShowProfile(true);
               setSynthesisStatus('idle');
               setSynthesisBeats([]);
               setSynthesisSignal('');
               alert("Economic Foundation data saved successfully!");
            }
         }
      } catch (err) {
         console.error('Unexpected error saving data:', err);
         alert("An unexpected error occurred.");
      }
   };

   const handleRunSynthesis = async () => {
      if (!profileData || !currentRowId) {
         alert("Please save the Economic Foundation data first.");
         return;
      }
      setIsSynthesizing(true);
      setSynthesisStatus('running');

      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) throw new Error("Not authenticated");

         if (!import.meta.env.VITE_N8N_WEBHOOK_URL) throw new Error("Missing VITE_N8N_WEBHOOK_URL.");

         const response = await fetch(import.meta.env.VITE_N8N_WEBHOOK_URL + '/agency-snapshot/economic-foundation/synthesize', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: currentRowId, user_id: user.id })
         });

         if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Synthesis webhook error:', errData);
            setSynthesisStatus('error');
            setIsSynthesizing(false);
         }
         // If ok, polling effect picks up status changes via currentRowId
      } catch (err) {
         console.error('Error triggering synthesis:', err);
         setSynthesisStatus('error');
         setIsSynthesizing(false);
      }
   };

   return (
      <SnapshotLayout sidebarMetrics={metrics} sidebarClassName="lg:w-2/5">

         <SectionHeader
            icon={DollarSign}
            title="Economic Foundation"
            description="Core financial health indicators."
         />

         {/* Top Guidance Message */}
         <div className="bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-lg p-4 mb-6 flex gap-3">
            <Lightbulb className="h-5 w-5 text-[var(--aos-insight)] flex-shrink-0 mt-0.5" />
            <div>
               <h4 className="text-sm font-semibold text-[var(--fg-1)] mb-1">Ballpark figures are perfectly fine</h4>
               <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                  These numbers can be as exact or approximate as you prefer. Rounded estimates (like "$120K") work great for directional insights.
               </p>
            </div>
         </div>

         <FormSection title="Core Financial Metrics">
            <div className="grid grid-cols-1 gap-4">
               {/* Row 1 */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Monthly Revenue</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Your approximate monthly top-line revenue (all sources)
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={monthlyRevenue} onChange={setMonthlyRevenue} />
               </div>

               {/* Row 2 */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Monthly AGI (Agency Gross Income)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Revenue minus pass-through costs (what you actually retain)
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={monthlyAGI} onChange={setMonthlyAGI} />
               </div>

               {/* Row 3 */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Monthly Payroll (Unburdened)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Total monthly salaries/wages before taxes and benefits
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={monthlyPayroll} onChange={setMonthlyPayroll} />
               </div>

               {/* Row 4 */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Typical Profit Margin</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Your typical operating profit margin (net profit as % of revenue)
                        </div>
                     </div>
                  </div>
                  <PercentageInput value={profitMargin} onChange={setProfitMargin} />
               </div>

               {/* Row 5 */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Cash Available for Operations</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Cash currently available for operations, reinvestment, or runway
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={cashAvailable} onChange={setCashAvailable} />
               </div>

               {/* Row 6 */}
               <div>
                  <Label>Financial Health Status</Label>
                  <Select value={financialHealth} onChange={(e) => setFinancialHealth(e.target.value)}>
                     <option value="" disabled>Select status...</option>
                     <option value="stressed">Stressed (struggling with cash flow)</option>
                     <option value="tight">Tight (breaking even, limited flex)</option>
                     <option value="stable">Stable (profitable, manageable)</option>
                     <option value="healthy">Healthy (strong margins/runway)</option>
                     <option value="excellent">Excellent (highly profitable)</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">How would you describe your current financial health?</p>
               </div>
            </div>
         </FormSection>

         <AdvancedSection>
            <div className="grid grid-cols-1 gap-4">
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Pass-Through Costs (Monthly)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Monthly costs passed directly to clients (media spend, platform fees, etc.)
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={passThroughCosts} onChange={setPassThroughCosts} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>SG&A / Overhead (Monthly)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Monthly operational overhead (office, software, admin, marketing, etc.)
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={sgaOverhead} onChange={setSgaOverhead} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Owner/Founder Compensation</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           How much do you pay yourself monthly (salary + distributions)?
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={ownerComp} onChange={setOwnerComp} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Gross Margin (%)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Margin before overhead costs (AGI - Direct Costs) / AGI
                        </div>
                     </div>
                  </div>
                  <PercentageInput value={grossMargin} onChange={setGrossMargin} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Accounts Receivable</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Outstanding invoices not yet collected
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={ar} onChange={setAr} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Accounts Payable</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Outstanding bills not yet paid
                        </div>
                     </div>
                  </div>
                  <CurrencyInput value={ap} onChange={setAp} />
               </div>
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Cash Flow Health</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           How would you describe your cash flow timing?
                        </div>
                     </div>
                  </div>
                  <Select value={cashFlowHealth} onChange={(e) => setCashFlowHealth(e.target.value)}>
                     <option value="" disabled>Select status...</option>
                     <option value="tight">Always tight</option>
                     <option value="strained">Occasionally strained</option>
                     <option value="smooth">Generally smooth</option>
                     <option value="predictable">Very predictable</option>
                  </Select>
               </div>
            </div>
         </AdvancedSection>

         {/* Action Buttons */}
         <div className="pt-6 border-t border-[var(--aos-mist)]">
            <div className="flex flex-col sm:flex-row gap-4">
               <Button 
                  className="w-full sm:w-auto min-w-[140px]" 
                  variant="secondary" 
                  onClick={handleSave} 
                  disabled={isLoading || isSynthesizing}
               >
                  {isLoading ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                     <><Save className="mr-2 h-4 w-4" /> Save Data</>
                  )}
               </Button>
               
               <Button
                  className={`w-full sm:w-auto min-w-[200px] text-[var(--fg-on-dark)] transition-colors ${(isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete')
                      ? 'bg-[var(--aos-brass)] opacity-50 cursor-not-allowed'
                      : 'bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] shadow-sm'
                  }`}
                  onClick={() => handleRunSynthesis()}
                  disabled={isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete'}
               >
                  {isSynthesizing ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing Profile...</>
                  ) : (
                     <><Sparkles className="mr-2 h-4 w-4" /> Submit for Synthesis</>
                  )}
               </Button>
            </div>

            {/* Status Messages for Synthesis */}
            {synthesisStatus === 'complete' && (
               <div className="mt-4 p-3 bg-[var(--aos-success-tint)] text-[var(--aos-success)] rounded-md border border-[var(--aos-success)] flex items-center gap-2 text-sm animate-in fade-in">
                  <Check className="h-4 w-4" />
                  Synthesis complete! View your economic foundation analysis below.
               </div>
            )}
            {synthesisStatus === 'error' && (
               <div className="mt-4 p-3 bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] rounded-md border border-[var(--aos-risk)] flex items-center gap-2 text-sm animate-in fade-in">
                  <AlertCircle className="h-4 w-4" />
                  There was an error running synthesis. Please try again.
               </div>
            )}

            {(isLoading || isSynthesizing) && (
               <div className="mt-4 p-4 bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-lg flex items-center gap-3 animate-in fade-in">
                  <Loader2 className="h-5 w-5 text-[var(--fg-3)] animate-spin" />
                  <div>
                     <p className="text-sm font-medium text-[var(--fg-1)]">
                        {isSynthesizing ? "Running AI Synthesis..." : "Saving your configuration..."}
                     </p>
                     <p className="text-xs text-[var(--fg-3)]">This typically takes a few seconds.</p>
                  </div>
               </div>
            )}

            {showProfile && (
               <div className="mt-8 animate-in slide-in-from-top-4 fade-in duration-700">
                  <FinancialProfile profileData={profileData} />

                  {/* SYNTHESIS RENDER BLOCK */}
                  <div className="mt-8 p-6 bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl">
                     <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="h-5 w-5 text-[var(--aos-warning)]" />
                        <h4 className="text-base font-bold text-[var(--fg-1)]">Economic Foundation Insights</h4>
                     </div>
                     
                     {(!synthesisStatus || synthesisStatus === 'idle') && (
                        <p className="text-sm text-[var(--fg-3)] italic">Contextual insights will appear here after GPT synthesis is enabled.</p>
                     )}

                     {synthesisStatus === 'running' && (
                        <div className="flex items-center gap-3 py-4 text-sm text-[var(--fg-2)] animate-pulse">
                           <Loader2 className="h-5 w-5 animate-spin text-[var(--aos-warning)]" />
                           <span>Synthesizing economic patterns and financial health...</span>
                        </div>
                     )}

                     {synthesisStatus === 'complete' && synthesisBeats.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                           {synthesisBeats.map((beat, i) => (
                              <ExpandableInsightCard key={i} headline={beat.headline} copy={beat.copy} />
                           ))}
                           
                           {synthesisSignal && (
                              <div className="mt-6 p-6 bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-xl shadow-inner">
                                 <div className="flex items-center gap-2 mb-3">
                                    <Target className="h-4 w-4 text-[var(--aos-insight)]" />
                                    <span className="text-xs font-bold text-[var(--fg-1)] tracking-widest uppercase">The Signal</span>
                                 </div>
                                 <p className="text-[15px] font-medium text-[var(--fg-1)] leading-relaxed italic">
                                    "{synthesisSignal}"
                                 </p>
                              </div>
                           )}
                        </div>
                     )}

                     {synthesisStatus === 'error' && (
                        <div className="flex items-start gap-4 p-5 bg-[var(--aos-risk-tint)] border border-[var(--aos-risk)] rounded-xl animate-in fade-in">
                           <div className="p-2 bg-[var(--aos-risk-tint)] rounded-full shrink-0">
                              <AlertCircle className="h-5 w-5 text-[var(--aos-risk)]" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-[var(--fg-1)] mb-1">Synthesis failed</p>
                              <p className="text-xs text-[var(--aos-risk)] mb-4">{synthesisErrorMsg || "An unexpected error occurred during synthesis."}</p>
                              <Button
                                 size="sm"
                                 className="bg-[var(--aos-risk)] hover:opacity-90 text-[var(--fg-on-dark)]"
                                 onClick={() => handleRunSynthesis()}
                                 disabled={isSynthesizing}
                              >
                                 <RefreshCw className="h-3 w-3 mr-2" />
                                 Try Again
                              </Button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </SnapshotLayout>
   );
};

// --- Tab 3: Revenue Model ---

export const GrowthPipeline: React.FC = () => {
   // --- State ---
   // Baseline Fields
   const [recurringRevPercentage, setRecurringRevPercentage] = useState<number | undefined>();
   const [activeClientCount, setActiveClientCount] = useState<number | undefined>();
   const [clientTierMix, setClientTierMix] = useState<string>("");
   const [monthlyChurnRate, setMonthlyChurnRate] = useState<number | undefined>();
   const [avgClientLifetime, setAvgClientLifetime] = useState<number | undefined>();

   // Enhanced Fields
   const [winRate, setWinRate] = useState<number | undefined>();
   const [salesCycle, setSalesCycle] = useState<string>("");

   // Channel Mix Ranks (1-5 or "Not at all")
   const [channelReferrals, setChannelReferrals] = useState<string>("");
   const [channelPartnerships, setChannelPartnerships] = useState<string>("");
   const [channelContent, setChannelContent] = useState<string>("");
   const [channelPaid, setChannelPaid] = useState<string>("");
   const [channelOutbound, setChannelOutbound] = useState<string>("");

   // Concentration Index
   const [concentrationTop5, setConcentrationTop5] = useState<number | undefined>();
   const [concentrationTop10, setConcentrationTop10] = useState<number | undefined>();
   const [concentrationTop20, setConcentrationTop20] = useState<number | undefined>();

   const [isLoading, setIsLoading] = useState(false);
   const [profileData, setProfileData] = useState<any>(null);
   const [showProfile, setShowProfile] = useState(false);

   const [currentRowId, setCurrentRowId] = useState<string>('');
   const [savedInputFingerprint, setSavedInputFingerprint] = useState<string>('');
   const [isSynthesizing, setIsSynthesizing] = useState(false);
   const [synthesisStatus, setSynthesisStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
   const [synthesisBeats, setSynthesisBeats] = useState<any[]>([]);
   const [synthesisSignal, setSynthesisSignal] = useState<string>('');
   const [synthesisErrorMsg, setSynthesisErrorMsg] = useState<string>('');

   const { user } = useAuth();
   const [monthlyAGI, setMonthlyAGI] = useState<number | null>(null);

   // Fetch Financial Data
   React.useEffect(() => {
      if (!user) return;
      const fetchFinancialData = async () => {
         try {
            // 1. Fetch Monthly AGI
            const { data, error } = await supabase
               .from('agency_snapshot_economic_foundation')
               .select('monthly_agi')
               .eq('user_id', user.id)
               .eq('is_current', true)
               .maybeSingle();

            if (error && error.code !== 'PGRST116') {
               console.error('Error fetching financial data:', error);
            }

            if (data) {
               setMonthlyAGI(data.monthly_agi);
            }

            // 2. Fetch current Growth Snapshot
            const { data: growthData, error: growthError } = await supabase
               .from('agency_snapshot_revenue_model')
               .select('*')
               .eq('user_id', user.id)
               .eq('is_current', true)
               .maybeSingle();

            if (growthError) {
               console.error('Error fetching revenue model:', growthError);
            }

            if (growthData) {
               // Populate form fields
               setRecurringRevPercentage(growthData.revenue_mix_mrr_percentage);
               setActiveClientCount(growthData.active_client_count);
               setClientTierMix(growthData.client_tier_mix || "");
               setMonthlyChurnRate(growthData.monthly_churn_rate);
               setAvgClientLifetime(growthData.average_client_lifetime_months);

               setWinRate(growthData.typical_win_rate);
               setSalesCycle(growthData.average_sales_cycle || "");

               setChannelReferrals(growthData.channel_referrals_rank || "");
               setChannelPartnerships(growthData.channel_partnerships_rank || "");
               setChannelContent(growthData.channel_content_rank || "");
               setChannelPaid(growthData.channel_paid_rank || "");
               setChannelOutbound(growthData.channel_outbound_rank || "");

               setConcentrationTop5(growthData.concentration_top5_pct);
               setConcentrationTop10(growthData.concentration_top10_pct);
               setConcentrationTop20(growthData.concentration_top20_pct);

               setProfileData(growthData);
               setShowProfile(true);
               setCurrentRowId(growthData.id);
               setSavedInputFingerprint(JSON.stringify(buildRMCanonicalInput({
                  revenue_mix_mrr_percentage: growthData.revenue_mix_mrr_percentage,
                  active_client_count: growthData.active_client_count,
                  client_tier_mix: growthData.client_tier_mix || "",
                  monthly_churn_rate: growthData.monthly_churn_rate,
                  average_client_lifetime_months: growthData.average_client_lifetime_months,
                  typical_win_rate: growthData.typical_win_rate,
                  average_sales_cycle: growthData.average_sales_cycle || "",
                  channel_referrals_rank: growthData.channel_referrals_rank || "",
                  channel_partnerships_rank: growthData.channel_partnerships_rank || "",
                  channel_content_rank: growthData.channel_content_rank || "",
                  channel_paid_rank: growthData.channel_paid_rank || "",
                  channel_outbound_rank: growthData.channel_outbound_rank || "",
                  concentration_top5_pct: growthData.concentration_top5_pct,
                  concentration_top10_pct: growthData.concentration_top10_pct,
                  concentration_top20_pct: growthData.concentration_top20_pct,
               })));
               if (growthData.synthesis_status) {
                  setSynthesisStatus(growthData.synthesis_status as any);
                  if (growthData.synthesis_status === 'complete') {
                     setSynthesisBeats([
                        { headline: growthData.synthesis_beat_1_headline, copy: growthData.synthesis_beat_1 },
                        { headline: growthData.synthesis_beat_2_headline, copy: growthData.synthesis_beat_2 },
                        { headline: growthData.synthesis_beat_3_headline, copy: growthData.synthesis_beat_3 }
                     ].filter(b => b.headline && b.copy));
                     setSynthesisSignal(growthData.synthesis_signal || '');
                  }
               }
            }

         } catch (err) {
            console.error('Unexpected error fetching data:', err);
         }
      };
      fetchFinancialData();
   }, [user]);

   // --- Calculations ---

   // 1. ACV = Monthly AGI / Active Client Count
   const calculatedACV = (monthlyAGI && activeClientCount && activeClientCount > 0)
      ? monthlyAGI / activeClientCount
      : null;

   // 2. MRR ($)
   const calculatedMRR = (monthlyAGI && recurringRevPercentage !== undefined)
      ? monthlyAGI * (recurringRevPercentage / 100)
      : null;
   const calculatedMRRAnnual = calculatedMRR !== null ? calculatedMRR * 12 : null;

   // 3. Project AGI ($)
   const calculatedProjectAGI = (monthlyAGI && recurringRevPercentage !== undefined)
      ? monthlyAGI * ((100 - recurringRevPercentage) / 100)
      : null;
   const calculatedProjectAGIAnnual = calculatedProjectAGI !== null ? calculatedProjectAGI * 12 : null;

   // 4. Annual Churn Rate = Monthly Churn * 12
   const calculatedAnnualChurn = (monthlyChurnRate !== undefined)
      ? monthlyChurnRate * 12
      : null;

   // 5. Churned Clients Annually = Active Clients * (Annual Churn % / 100)
   const calculatedChurnedClients = (activeClientCount && calculatedAnnualChurn !== null)
      ? Math.round(activeClientCount * (calculatedAnnualChurn / 100))
      : null;

   // 6. Implied Replacement Rate
   const calculatedReplacementRate = monthlyChurnRate;

   // 7. Replacement Revenue (Monthly & Annual)
   // Monthly = MRR * (Monthly Churn / 100)
   const calculatedReplacementRevMonthly = (calculatedMRR !== null && monthlyChurnRate !== undefined)
      ? calculatedMRR * (monthlyChurnRate / 100)
      : null;
   const calculatedReplacementRevAnnual = calculatedReplacementRevMonthly !== null ? calculatedReplacementRevMonthly * 12 : null;

   // 7. Replacement Clients (Monthly & Annual)
   // Monthly = Active Clients * (Monthly Churn / 100)
   const calculatedReplacementClientsMonthly = (activeClientCount && monthlyChurnRate !== undefined)
      ? activeClientCount * (monthlyChurnRate / 100)
      : null;
   const calculatedReplacementClientsAnnual = calculatedReplacementClientsMonthly !== null ? calculatedReplacementClientsMonthly * 12 : null;

   // 7. Concentration Risk
   const getRiskScore = () => {
      const top5 = concentrationTop5 || 0;
      const top10 = concentrationTop10 || 0;
      const top20 = concentrationTop20 || 0;

      if (top5 > 70 || top10 > 85 || top20 > 95) return { score: "HIGH", color: "text-[var(--aos-risk)]" };
      if (top5 > 50 || top10 > 70 || top20 > 85) return { score: "MEDIUM", color: "text-[var(--aos-warning)]" };
      if (top5 > 0 || top10 > 0 || top20 > 0) return { score: "LOW", color: "text-[var(--aos-success)]" };
      return { score: "---", color: "text-[var(--fg-1)]" };
   };
   const risk = getRiskScore();

   // Formatting Helpers
   const formatCurrency = (val: number | null) => val !== null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
      : '$---';

   const formatPercent = (val: number | null | undefined) => (val !== null && val !== undefined)
      ? `${val.toFixed(1)}%`
      : '---%';

   // --- Handlers ---

   // Auto-calculate Project % based on Recurring %
   const projectRevPercentage = recurringRevPercentage !== undefined ? 100 - recurringRevPercentage : undefined;

   // Check for duplicates in Channel Mix
   const channelValues = [channelReferrals, channelPartnerships, channelContent, channelPaid, channelOutbound];
   const activeRanks = channelValues.filter(v => v !== "" && v !== "0");
   const hasDuplicates = new Set(activeRanks).size !== activeRanks.length;
   const currentRMInput: RMInputHashFields = {
      revenue_mix_mrr_percentage: recurringRevPercentage,
      active_client_count: activeClientCount,
      client_tier_mix: clientTierMix,
      monthly_churn_rate: monthlyChurnRate,
      average_client_lifetime_months: avgClientLifetime,
      typical_win_rate: winRate,
      average_sales_cycle: salesCycle,
      channel_referrals_rank: channelReferrals,
      channel_partnerships_rank: channelPartnerships,
      channel_content_rank: channelContent,
      channel_paid_rank: channelPaid,
      channel_outbound_rank: channelOutbound,
      concentration_top5_pct: concentrationTop5,
      concentration_top10_pct: concentrationTop10,
      concentration_top20_pct: concentrationTop20,
   };
   const currentRMInputFingerprint = JSON.stringify(buildRMCanonicalInput(currentRMInput));
   const hasUnsavedChanges = currentRMInputFingerprint !== savedInputFingerprint;
   const isSaveDisabled = hasDuplicates || isLoading || isSynthesizing || !hasUnsavedChanges;

   const handleSave = async () => {
      if (!user) return;
      if (hasDuplicates) {
         alert("Please fix duplicate channel ranks before saving.");
         return;
      }

      setIsLoading(true);
      try {
         // Prepare Calculations
         const calc_acv = (monthlyAGI && activeClientCount && activeClientCount > 0) ? monthlyAGI / activeClientCount : null;
         const calc_mrr_amt = (monthlyAGI && recurringRevPercentage !== undefined) ? monthlyAGI * (recurringRevPercentage / 100) : null;
         const calc_project_amt = (monthlyAGI && recurringRevPercentage !== undefined) ? monthlyAGI * ((100 - recurringRevPercentage) / 100) : null;
         const calc_annual_churn = (monthlyChurnRate !== undefined) ? monthlyChurnRate * 12 : null;
         const calc_churned_clients = (activeClientCount && calc_annual_churn !== null) ? Math.round(activeClientCount * (calc_annual_churn / 100)) : null;
         const calc_replacement = monthlyChurnRate; // Same as monthly churn

         // Risk Score String
         let calc_risk = null;
         const t5 = concentrationTop5 || 0;
         const t10 = concentrationTop10 || 0;
         const t20 = concentrationTop20 || 0;
         if (concentrationTop5 !== undefined || concentrationTop10 !== undefined || concentrationTop20 !== undefined) {
            if (t5 > 70 || t10 > 85 || t20 > 95) calc_risk = 'HIGH';
            else if (t5 > 50 || t10 > 70 || t20 > 85) calc_risk = 'MEDIUM';
            else calc_risk = 'LOW';
         }

         const payload = {
            user_id: user.id,
            input_hash: await computeRMInputHash(currentRMInput),
            is_current: true,
            is_complete: true,
            // Baseline
            revenue_mix_mrr_percentage: recurringRevPercentage ?? null,
            active_client_count: activeClientCount ?? null,
            client_tier_mix: clientTierMix || null,
            monthly_churn_rate: monthlyChurnRate ?? null,
            average_client_lifetime_months: avgClientLifetime ?? null,
            // Enhanced
            typical_win_rate: winRate ?? null,
            average_sales_cycle: salesCycle || null,
            channel_referrals_rank: channelReferrals || null,
            channel_partnerships_rank: channelPartnerships || null,
            channel_content_rank: channelContent || null,
            channel_paid_rank: channelPaid || null,
            channel_outbound_rank: channelOutbound || null,
            concentration_top5_pct: concentrationTop5 ?? null,
            concentration_top10_pct: concentrationTop10 ?? null,
            concentration_top20_pct: concentrationTop20 ?? null,
            // Calculated
            average_client_value_monthly: calc_acv,
            current_mrr: calc_mrr_amt,
            project_revenue_monthly: calc_project_amt,
            annual_churn_rate_percent: calc_annual_churn,
            churned_clients_per_year: calc_churned_clients,

            // NEW FIELDS for Dual-Column Metrics
            recurring_revenue_annual: calc_mrr_amt !== null ? calc_mrr_amt * 12 : null,
            project_revenue_annual: calc_project_amt !== null ? calc_project_amt * 12 : null,

            replacement_revenue_monthly: (calc_mrr_amt !== null && monthlyChurnRate !== undefined) ? calc_mrr_amt * (monthlyChurnRate / 100) : null,
            replacement_revenue_annual: (calc_mrr_amt !== null && monthlyChurnRate !== undefined) ? (calc_mrr_amt * (monthlyChurnRate / 100)) * 12 : null,

            replacement_clients_monthly: (activeClientCount && monthlyChurnRate !== undefined) ? activeClientCount * (monthlyChurnRate / 100) : null,
            replacement_clients_annual: (activeClientCount && monthlyChurnRate !== undefined) ? (activeClientCount * (monthlyChurnRate / 100)) * 12 : null,

            calculated_replacement_rate: monthlyChurnRate ?? null, // Kept for legacy if needed
            concentration_risk_level: calc_risk,

            revenue_model_synthesis: null // Placeholder for Phase 3
         };

         const { data: match, error: lookupError } = await supabase
            .from('agency_snapshot_revenue_model')
            .select('*')
            .eq('user_id', user.id)
            .eq('input_hash', payload.input_hash)
            .limit(1)
            .maybeSingle();

         if (lookupError) {
            console.error('Error looking up revenue model hash:', lookupError);
            alert('Failed to save data. Please try again.');
            return;
         }

         if (match) {
            const { error: updateError } = await supabase
               .from('agency_snapshot_revenue_model')
               .update({ is_current: true, updated_at: new Date().toISOString() })
               .eq('id', match.id);

            if (updateError) {
               console.error('Error reactivating revenue model:', updateError);
               alert('Failed to save data. Please try again.');
               return;
            }

            setCurrentRowId(match.id);
            setProfileData(match);
            setShowProfile(true);
            setSavedInputFingerprint(currentRMInputFingerprint);
            if (match.synthesis_status === 'complete') {
               setSynthesisStatus('complete');
               setSynthesisBeats([
                  { headline: match.synthesis_beat_1_headline, copy: match.synthesis_beat_1 },
                  { headline: match.synthesis_beat_2_headline, copy: match.synthesis_beat_2 },
                  { headline: match.synthesis_beat_3_headline, copy: match.synthesis_beat_3 },
               ].filter(b => b.headline && b.copy));
               setSynthesisSignal(match.synthesis_signal || '');
            } else {
               setSynthesisStatus(match.synthesis_status || 'idle');
               setSynthesisBeats([]);
               setSynthesisSignal('');
            }
            setSynthesisErrorMsg(match.synthesis_error || '');
            alert('Revenue Model data saved (prior version restored).');
         } else {
            const { data, error } = await supabase
               .from('agency_snapshot_revenue_model')
               .insert([payload])
               .select()
               .single();

            if (error) {
               console.error('Error saving growth snapshot:', error);
               alert('Failed to save data. Please try again.');
            } else if (data) {
               setCurrentRowId(data.id);
               setProfileData(data);
               setShowProfile(true);
               setSavedInputFingerprint(currentRMInputFingerprint);
               setSynthesisStatus('idle');
               setSynthesisBeats([]);
               setSynthesisSignal('');
               setSynthesisErrorMsg('');
               alert('Revenue Model data saved successfully!');
            }
         }

      } catch (err) {
         console.error('Unexpected error saving data:', err);
         alert('An unexpected error occurred.');
      } finally {
         setIsLoading(false);
      }
   };

   const pollSynthesisStatus = async (rowId: string, retries = 0) => {
      try {
         const { data, error } = await supabase
            .from('agency_snapshot_revenue_model')
            .select('*')
            .eq('id', rowId)
            .single();

         if (error) throw error;

         if (data.synthesis_status === 'complete') {
            setSynthesisStatus('complete');
            setIsSynthesizing(false);
            setSynthesisBeats([
               { headline: data.synthesis_beat_1_headline, copy: data.synthesis_beat_1 },
               { headline: data.synthesis_beat_2_headline, copy: data.synthesis_beat_2 },
               { headline: data.synthesis_beat_3_headline, copy: data.synthesis_beat_3 },
            ].filter(b => b.headline && b.copy));
            setSynthesisSignal(data.synthesis_signal || '');
            return;
         } else if (data.synthesis_status === 'error') {
            setSynthesisStatus('error');
            setSynthesisErrorMsg(data.synthesis_error || 'An unexpected error occurred during synthesis.');
            setIsSynthesizing(false);
            return;
         }

         // Still running
         if (retries < 20) {
            setTimeout(() => pollSynthesisStatus(rowId, retries + 1), 3000);
         } else {
            setSynthesisStatus('error');
            setSynthesisErrorMsg('Synthesis timed out. Please try again.');
            setIsSynthesizing(false);
         }
      } catch (err) {
         console.error('Error polling synthesis status:', err);
         setSynthesisStatus('error');
         setSynthesisErrorMsg('Failed to check synthesis status.');
         setIsSynthesizing(false);
      }
   };

   const handleRunSynthesis = async () => {
      if (!profileData || !currentRowId) {
         alert("Please save the Revenue Model data first.");
         return;
      }
      setIsSynthesizing(true);
      setSynthesisStatus('running');
      setSynthesisErrorMsg('');

      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) throw new Error("Not authenticated");

         if (!import.meta.env.VITE_N8N_WEBHOOK_URL) throw new Error("Missing VITE_N8N_WEBHOOK_URL.");

         const response = await fetch(import.meta.env.VITE_N8N_WEBHOOK_URL + '/agency-snapshot/revenue-model/synthesize', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: currentRowId, user_id: user.id })
         });

         if (response.ok) {
            // Start polling
            setTimeout(() => pollSynthesisStatus(currentRowId, 0), 2000);
         } else {
            const errText = await response.text();
            console.error('Synthesis webhook error:', errText);
            setSynthesisStatus('error');
            setSynthesisErrorMsg('Failed to trigger synthesis workflow.');
            setIsSynthesizing(false);
         }
      } catch (err) {
         console.error('Error triggering synthesis:', err);
         setSynthesisStatus('error');
         setSynthesisErrorMsg('Network error while triggering synthesis.');
         setIsSynthesizing(false);
      }
   };

   // --- Ranks for Channel Mix ---
   const rankOptions = [
      { value: "1", label: "1st" },
      { value: "2", label: "2nd" },
      { value: "3", label: "3rd" },
      { value: "4", label: "4th" },
      { value: "5", label: "5th" },
      { value: "0", label: "Not at all" },
   ];

   const getRankSelect = (value: string, onChange: (val: string) => void) => (
      <Select
         value={value}
         onChange={(e) => onChange(e.target.value)}
         className={`w-full ${hasDuplicates && value !== "0" && activeRanks.filter(r => r === value).length > 1 ? "border-[var(--aos-risk)] focus:border-[var(--aos-risk)] focus:ring-[var(--aos-risk-tint)]" : ""}`}
      >
         <option value="" disabled>Rank...</option>
         {rankOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
         ))}
      </Select>
   );

   // --- Metrics Panel (Calculated) ---
   const metrics = (
      <>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2 mb-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Avg Client Value (ACV)</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all text-right">
               {monthlyAGI ? formatCurrency(calculatedACV) : <span className="text-[var(--fg-4)]">$---</span>}
            </span>
         </div>

         {/* DUAL METRIC: Revenue Breakdown */}
         <div className="py-2 border-b border-[var(--aos-mist)] mb-2">
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 mb-1">
               <span></span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Monthly</span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Annually</span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 items-center mb-1">
               <span className="text-sm text-[var(--fg-3)] font-medium">Recurring Rev</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedMRR) : <span className="text-[var(--fg-4)]">$---</span>}</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedMRRAnnual) : <span className="text-[var(--fg-4)]">$---</span>}</span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 items-center">
               <span className="text-sm text-[var(--fg-3)] font-medium">Project Rev</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedProjectAGI) : <span className="text-[var(--fg-4)]">$---</span>}</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedProjectAGIAnnual) : <span className="text-[var(--fg-4)]">$---</span>}</span>
            </div>
         </div>

         {/* Churn Metrics */}
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Annual Churn Rate</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all text-right">
               {formatPercent(calculatedAnnualChurn)}
            </span>
         </div>
         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2 mb-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Churned Clients/Year</span>
            <span className="text-sm font-bold text-[var(--fg-1)] animate-in fade-in transition-all text-right">
               {calculatedChurnedClients !== null ? `~${calculatedChurnedClients}` : '---'}
            </span>
         </div>

         {/* DUAL METRIC: Replacement Needs */}
         <div className="py-2 border-b border-[var(--aos-mist)] mb-2">
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 mb-1">
               <span></span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Monthly</span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Annually</span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 items-center mb-1">
               <span className="text-sm text-[var(--fg-3)] font-medium">Rep. Revenue</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedReplacementRevMonthly) : <span className="text-[var(--fg-4)]">$---</span>}</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{monthlyAGI ? formatCurrency(calculatedReplacementRevAnnual) : <span className="text-[var(--fg-4)]">$---</span>}</span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 items-center">
               <span className="text-sm text-[var(--fg-3)] font-medium">Rep. Clients</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{calculatedReplacementClientsMonthly !== null ? `~${calculatedReplacementClientsMonthly.toFixed(1)}` : '---'}</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">{calculatedReplacementClientsAnnual !== null ? `~${calculatedReplacementClientsAnnual.toFixed(1)}` : '---'}</span>
            </div>
         </div>

         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Concentration Risk</span>
            <span className={`text-sm font-bold animate-in fade-in transition-all text-right ${risk.color}`}>
               {risk.score}
            </span>
         </div>



         {/* Removed Placeholder Content Block */}
      </>
   );

   return (
      <SnapshotLayout sidebarMetrics={metrics} sidebarClassName="lg:w-2/5">
         <SectionHeader
            icon={Users}
            title="Revenue Model"
            description="Understanding your revenue engine and client dynamics."
         />

         {/* Top Guidance Message */}
         <div className="bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-lg p-4 mb-6 flex gap-3">
            <Lightbulb className="h-5 w-5 text-[var(--aos-insight)] flex-shrink-0 mt-0.5" />
            <div>
               <h4 className="text-sm font-semibold text-[var(--fg-1)] mb-1">Ballpark figures are fine</h4>
               <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                  Directional understanding of your model is more important than precision.
               </p>
            </div>
         </div>

         <FormSection title="Baseline Growth Metrics">
            <div className="grid grid-cols-1 gap-4">
               {/* Model Profile */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Revenue Mix (% MRR vs Project)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Recurring = retainers, subscriptions, ongoing contracts. Project = one-time engagements, fixed-scope work.
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="relative">
                        <PercentageInput value={recurringRevPercentage} onChange={setRecurringRevPercentage} placeholder="0%" />
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-4)] pointer-events-none">Recurring</span>
                     </div>
                     <div className="relative">
                        <Input type="text" value={projectRevPercentage !== undefined ? `${projectRevPercentage}%` : ''} disabled className="bg-[var(--bg-canvas)]" />
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-4)] pointer-events-none">Project</span>
                     </div>
                  </div>
                  <p className="text-xs text-[var(--fg-3)] mt-1">What % of your revenue is recurring/retainer vs. project-based?</p>
               </div>

               {/* Client Profile */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Active Client Count</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Count clients you're currently billing or delivering work for.
                        </div>
                     </div>
                  </div>
                  <Input
                     type="number"
                     placeholder="0"
                     value={activeClientCount ?? ''}
                     onChange={(e) => {
                        const val = e.target.value;
                        setActiveClientCount(val === '' ? undefined : parseInt(val));
                     }}
                  />
                  <p className="text-xs text-[var(--fg-3)] mt-1">Current number of active paying clients</p>
               </div>

               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Client Tier Mix</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Think about the typical size of the organizations you serve, not what they pay you.
                        </div>
                     </div>
                  </div>
                  <Select value={clientTierMix} onChange={(e) => setClientTierMix(e.target.value)}>
                     <option value="" disabled>Select client tier...</option>
                     <option value="local">Local/regional businesses (typically &lt;50 employees)</option>
                     <option value="mid">Mid-size organizations (typically 50-500 employees)</option>
                     <option value="enterprise">Enterprise clients (typically 500+ employees)</option>
                     <option value="mixed">Mixed across tiers</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">What tier do most of your clients fall into?</p>
               </div>

               {/* Retention Profile */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Monthly Churn Rate</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Monthly churn = (Clients lost in a month / Active clients at start) × 100. Estimate if you don't track precisely.
                        </div>
                     </div>
                  </div>
                  <PercentageInput value={monthlyChurnRate} onChange={setMonthlyChurnRate} placeholder="0%" />
                  <p className="text-xs text-[var(--fg-3)] mt-1">What % of clients do you typically lose each month?</p>
               </div>

               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Average Client Lifetime</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Average duration of your client relationships. If most stay 2-3 years, enter 24-36 months.
                        </div>
                     </div>
                  </div>
                  <div className="relative">
                     <Input
                        type="number"
                        placeholder="0"
                        value={avgClientLifetime || ''}
                        onChange={(e) => setAvgClientLifetime(parseInt(e.target.value) || undefined)}
                     />
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--fg-4)] pointer-events-none">months</span>
                  </div>
                  <p className="text-xs text-[var(--fg-3)] mt-1">How many months does a typical client stay with you?</p>
               </div>
            </div>
         </FormSection>

         <AdvancedSection>
            <div className="grid grid-cols-1 gap-4">
               {/* Acquisition Efficiency */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Typical Win Rate</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Win rate = (Proposals won / Total proposals sent) × 100. Industry average is 30-35%.
                        </div>
                     </div>
                  </div>
                  <PercentageInput value={winRate} onChange={setWinRate} placeholder="0%" />
                  <p className="text-xs text-[var(--fg-3)] mt-1">What % of proposals do you typically close?</p>
               </div>

               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Average Sales Cycle Length</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Time from first conversation to signed contract.
                        </div>
                     </div>
                  </div>
                  <Select value={salesCycle} onChange={(e) => setSalesCycle(e.target.value)}>
                     <option value="" disabled>Select sales cycle...</option>
                     <option value="very_short">Very short (&lt;2 weeks)</option>
                     <option value="short">Short (2-4 weeks)</option>
                     <option value="moderate">Moderate (1-2 months)</option>
                     <option value="long">Long (2-3 months)</option>
                     <option value="very_long">Very long (3+ months)</option>
                     <option value="varies">Varies significantly</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">Typical time from first conversation to signed contract</p>
               </div>

               {/* Channel Mix */}
               <div>
                  <div className="flex items-center gap-1 mb-2">
                     <Label>Channel Mix (Rank Order)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Rank by importance to new client acquisition. Multiple can be 'Not at all'.
                        </div>
                     </div>
                  </div>
                  <div className={`space-y-2 bg-[var(--bg-canvas)] p-4 rounded-lg border ${hasDuplicates ? "border-[var(--aos-risk)]" : "border-[var(--aos-mist)]"}`}>
                     <div className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm text-[var(--fg-2)]">Referrals and Word of Mouth</span>
                        {getRankSelect(channelReferrals, setChannelReferrals)}
                     </div>
                     <div className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm text-[var(--fg-2)]">Partnerships and Alliances</span>
                        {getRankSelect(channelPartnerships, setChannelPartnerships)}
                     </div>
                     <div className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm text-[var(--fg-2)]">Content and Authority (Organic)</span>
                        {getRankSelect(channelContent, setChannelContent)}
                     </div>
                     <div className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm text-[var(--fg-2)]">Paid Acquisition</span>
                        {getRankSelect(channelPaid, setChannelPaid)}
                     </div>
                     <div className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm text-[var(--fg-2)]">Outbound and Prospecting</span>
                        {getRankSelect(channelOutbound, setChannelOutbound)}
                     </div>
                  </div>
                  {hasDuplicates ? (
                     <p className="text-xs text-[var(--aos-risk)] mt-2 font-medium flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Duplicate ranks detected. Please assign unique ranks (1st-5th). "Not at all" can be used multiple times.
                     </p>
                  ) : (
                     <p className="text-xs text-[var(--fg-3)] mt-2">Rank your primary acquisition channels from most to least important</p>
                  )}
               </div>

               {/* Concentration Index */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Concentration Index (% Revenue)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Measures client concentration risk. Higher concentration = more vulnerability.
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <Label className="text-xs text-[var(--fg-3)] mb-1 block">Top 5 Clients</Label>
                        <PercentageInput value={concentrationTop5} onChange={setConcentrationTop5} placeholder="0%" />
                     </div>
                     <div className="flex-1">
                        <Label className="text-xs text-[var(--fg-3)] mb-1 block">Top 10 Clients</Label>
                        <PercentageInput value={concentrationTop10} onChange={setConcentrationTop10} placeholder="0%" />
                     </div>
                     <div className="flex-1">
                        <Label className="text-xs text-[var(--fg-3)] mb-1 block">Top 20 Clients</Label>
                        <PercentageInput value={concentrationTop20} onChange={setConcentrationTop20} placeholder="0%" />
                     </div>
                  </div>
                  <p className="text-xs text-[var(--fg-3)] mt-1">What % of revenue comes from your top clients?</p>
               </div>
            </div>
         </AdvancedSection>

         <div className="pt-4 border-t border-[var(--aos-mist)] mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
               <Button className="w-full sm:w-auto min-w-[140px]" variant="secondary" onClick={handleSave} disabled={isSaveDisabled}>
                  {isLoading ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : !hasUnsavedChanges ? (
                     "Saved"
                  ) : (
                     <><Save className="mr-2 h-4 w-4" /> Save Data</>
                  )}
               </Button>
               
               <Button 
                  className={`w-full sm:w-auto min-w-[200px] text-[var(--fg-on-dark)] transition-colors ${(hasDuplicates || isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete')
                      ? 'bg-[var(--aos-brass)] opacity-50 cursor-not-allowed'
                      : 'bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] shadow-sm'
                  }`}
                  onClick={() => handleRunSynthesis()} 
                  disabled={hasDuplicates || isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete'}
               >
                  {isSynthesizing ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing Profile...</>
                  ) : (
                     <><Sparkles className="mr-2 h-4 w-4" /> Submit for Synthesis</>
                  )}
               </Button>
            </div>

            {/* Status Messages */}
            {synthesisStatus === 'complete' && (
               <div className="mt-4 p-3 bg-[var(--aos-success-tint)] text-[var(--aos-success)] rounded-md border border-[var(--aos-success)] flex items-center gap-2 text-sm animate-in fade-in">
                  <Check className="h-4 w-4" />
                  Synthesis complete! View your revenue model analysis below.
               </div>
            )}
            {synthesisStatus === 'error' && (
               <div className="mt-4 p-3 bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] rounded-md border border-[var(--aos-risk)] flex items-center gap-2 text-sm animate-in fade-in">
                  <AlertCircle className="h-4 w-4" />
                  There was an error running synthesis. Please try again.
               </div>
            )}
            {(isLoading || isSynthesizing) && (
               <div className="mt-4 p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)] flex items-center gap-3 animate-in fade-in">
                  <Loader2 className="h-5 w-5 text-[var(--fg-3)] animate-spin" />
                  <div>
                     <p className="text-sm font-medium text-[var(--fg-1)]">
                        {isSynthesizing ? "Running AI Synthesis..." : "Saving your configuration..."}
                     </p>
                     <p className="text-xs text-[var(--fg-3)]">This typically takes a few seconds.</p>
                  </div>
               </div>
            )}

            {showProfile && (
               <div className="mt-8 pt-8 border-t border-[var(--aos-mist)] animate-in slide-in-from-top-4 fade-in duration-700">
                  <GrowthProfile profileData={profileData} />
                  
                  {/* SYNTHESIS RENDER BLOCK */}
                  <div className="mt-8 p-6 bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl">
                     <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="h-5 w-5 text-[var(--aos-warning)]" />
                        <h4 className="text-base font-bold text-[var(--fg-1)]">Revenue Model Insights</h4>
                     </div>
                     
                     {(!synthesisStatus || synthesisStatus === 'idle') && (
                        <p className="text-sm text-[var(--fg-3)] italic">Contextual insights will appear here after GPT synthesis is enabled.</p>
                     )}

                     {synthesisStatus === 'running' && (
                        <div className="flex items-center gap-3 py-4 text-sm text-[var(--fg-2)] animate-pulse">
                           <Loader2 className="h-5 w-5 animate-spin text-[var(--aos-warning)]" />
                           <span>Synthesizing revenue architecture and margin dynamics...</span>
                        </div>
                     )}

                     {synthesisStatus === 'complete' && synthesisBeats.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                           {synthesisBeats.map((beat, i) => (
                              <ExpandableInsightCard key={i} headline={beat.headline} copy={beat.copy} />
                           ))}
                           
                           {synthesisSignal && (
                              <div className="mt-6 p-6 bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-xl shadow-inner">
                                 <div className="flex items-center gap-2 mb-3">
                                    <Target className="h-4 w-4 text-[var(--aos-insight)]" />
                                    <span className="text-xs font-bold text-[var(--fg-1)] tracking-widest uppercase">The Signal</span>
                                 </div>
                                 <p className="text-[15px] font-medium text-[var(--fg-1)] leading-relaxed italic">
                                    "{synthesisSignal}"
                                 </p>
                              </div>
                           )}
                        </div>
                     )}

                     {synthesisStatus === 'error' && (
                        <div className="flex items-start gap-4 p-5 bg-[var(--aos-risk-tint)] border border-[var(--aos-risk)] rounded-xl animate-in fade-in">
                           <div className="p-2 bg-[var(--aos-risk-tint)] rounded-full shrink-0">
                              <AlertCircle className="h-5 w-5 text-[var(--aos-risk)]" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-[var(--fg-1)] mb-1">Synthesis failed</p>
                              <p className="text-xs text-[var(--aos-risk)] mb-4">{synthesisErrorMsg || "An unexpected error occurred during synthesis."}</p>
                              <Button variant="secondary" onClick={() => handleRunSynthesis()}>
                                 Retry Synthesis
                              </Button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </SnapshotLayout>
   );
};

// --- Tab 4: Delivery Architecture ---

export const DeliveryArchitectureTab: React.FC = () => {
   // --- State ---
   // Baseline Fields
   const [teamSize, setTeamSize] = useState<number | undefined>();
   const [billableCount, setBillableCount] = useState<number | undefined>();
   const [nonBillableCount, setNonBillableCount] = useState<number | undefined>();
   const [structureType, setStructureType] = useState<string>("");
   const [founderTime, setFounderTime] = useState<string>("");
   const [utilization, setUtilization] = useState<string>("");
   const [contractorCount, setContractorCount] = useState<number | undefined>();

   // Enhanced Fields
   const [leadershipRoles, setLeadershipRoles] = useState<string[]>([]);
   const [managementLayers, setManagementLayers] = useState<string>("");
   const [specializedRoles, setSpecializedRoles] = useState<string[]>([]);
   const [experienceLevel, setExperienceLevel] = useState<string>("");

   const [isLoading, setIsLoading] = useState(false);
   const [profileData, setProfileData] = useState<any>(null);
   const [showProfile, setShowProfile] = useState(false);

   const [currentRowId, setCurrentRowId] = useState<string>('');
   const [isSynthesizing, setIsSynthesizing] = useState(false);
   const [synthesisStatus, setSynthesisStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
   const [synthesisBeats, setSynthesisBeats] = useState<any[]>([]);
   const [synthesisSignal, setSynthesisSignal] = useState<string>('');
   const [synthesisErrorMsg, setSynthesisErrorMsg] = useState<string>('');

   const [monthlyAGI, setMonthlyAGI] = useState<number | undefined>();

   // --- Load Data on Mount ---
   useEffect(() => {
      const loadTeamData = async () => {
         setIsLoading(true);
         try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
               setIsLoading(false);
               return;
            }

            // 1. Fetch Team Data
            const { data: teamData, error: teamError } = await supabase
               .from('agency_snapshot_delivery_architecture')
               .select('*')
               .eq('user_id', user.id)
               .eq('is_current', true)
               .maybeSingle();

            if (teamError) console.error('Error loading team delivery data:', teamError);

            if (teamData) {
               setTeamSize(teamData.total_team_size_fte);
               setBillableCount(teamData.billable_staff_count);
               setNonBillableCount(teamData.non_billable_staff_count);
               setContractorCount(teamData.average_contractor_count);
               setStructureType(teamData.team_structure_type || "");
               setFounderTime(teamData.founder_time_allocation || "");
               setUtilization(teamData.average_team_utilization || "");
               setLeadershipRoles(teamData.key_leadership_roles || []);
               setManagementLayers(teamData.management_layers || "");
               setSpecializedRoles(teamData.specialized_roles || []);
               setExperienceLevel(teamData.average_team_experience || "");

               setProfileData(teamData);
               setShowProfile(true);
               setCurrentRowId(teamData.id);
               if (teamData.synthesis_status) {
                  setSynthesisStatus(teamData.synthesis_status as any);
                  if (teamData.synthesis_status === 'complete') {
                     setSynthesisBeats([
                        { headline: teamData.synthesis_beat_1_headline, copy: teamData.synthesis_beat_1 },
                        { headline: teamData.synthesis_beat_2_headline, copy: teamData.synthesis_beat_2 },
                        { headline: teamData.synthesis_beat_3_headline, copy: teamData.synthesis_beat_3 }
                     ].filter(b => b.headline && b.copy));
                     setSynthesisSignal(teamData.synthesis_signal || '');
                  }
               }
            }

            // 2. Fetch Financial Data (for AGI/FTE calc)
            const { data: finData, error: finError } = await supabase
               .from('agency_snapshot_economic_foundation')
               .select('monthly_agi')
               .eq('user_id', user.id)
               .eq('is_current', true)
               .maybeSingle();

            if (finError) console.error('Error loading financial data for calc:', finError);

            if (finData) {
               setMonthlyAGI(finData.monthly_agi);
            }

         } catch (err) {
            console.error('Unexpected error loading team data:', err);
         } finally {
            setIsLoading(false);
         }
      };

      loadTeamData();
   }, []);

   // --- Handlers ---
   const handleMultiSelect = (
      current: string[],
      setter: (val: string[]) => void,
      value: string
   ) => {
      if (current.includes(value)) {
         setter(current.filter((item) => item !== value));

      } else {
         setter([...current, value]);
      }
   };

   // --- Calculations ---
   // AGI per FTE (Monthly) = Monthly AGI / Team Size
   const agiPerFteMonthly = (monthlyAGI !== undefined && teamSize !== undefined && teamSize > 0)
      ? monthlyAGI / teamSize
      : undefined;

   // AGI per FTE (Annual) = (Monthly AGI * 12) / Team Size
   const agiPerFteAnnual = (agiPerFteMonthly !== undefined)
      ? agiPerFteMonthly * 12
      : undefined;

   // Billable Ratio = Billable / Non-Billable
   const billableRatio = (billableCount !== undefined && nonBillableCount !== undefined && nonBillableCount > 0)
      ? billableCount / nonBillableCount
      : undefined;

   // Contractor Percentage = Contractor / (Team Size + Contractor)
   const contractorPercentage = (contractorCount !== undefined && teamSize !== undefined && (teamSize + contractorCount) > 0)
      ? (contractorCount / (teamSize + contractorCount)) * 100
      : undefined;

   const handleSave = async () => {
      setIsLoading(true);
      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) {
            alert("Please sign in to save data.");
            setIsLoading(false);
            return;
         }

         const currentDAInput: DAInputHashFields = {
            total_team_size_fte: teamSize,
            billable_staff_count: billableCount,
            non_billable_staff_count: nonBillableCount,
            team_structure_type: structureType,
            founder_time_allocation: founderTime,
            average_team_utilization: utilization,
            average_contractor_count: contractorCount,
            key_leadership_roles: leadershipRoles,
            management_layers: managementLayers,
            specialized_roles: specializedRoles,
            average_team_experience: experienceLevel,
         };
         const h = await computeDAInputHash(currentDAInput);

         const { data: match, error: lookupError } = await supabase
            .from('agency_snapshot_delivery_architecture')
            .select('*')
            .eq('user_id', user.id)
            .eq('input_hash', h)
            .limit(1)
            .maybeSingle();

         if (lookupError) throw lookupError;

         if (match) {
            const { error: updateError } = await supabase
               .from('agency_snapshot_delivery_architecture')
               .update({ is_current: true, updated_at: new Date().toISOString() })
               .eq('id', match.id);

            if (updateError) throw updateError;

            setCurrentRowId(match.id);
            setProfileData(match);
            setShowProfile(true);
            if (match.synthesis_status === 'complete') {
               setSynthesisStatus('complete');
               setSynthesisBeats([
                  { headline: match.synthesis_beat_1_headline, copy: match.synthesis_beat_1 },
                  { headline: match.synthesis_beat_2_headline, copy: match.synthesis_beat_2 },
                  { headline: match.synthesis_beat_3_headline, copy: match.synthesis_beat_3 },
               ].filter(b => b.headline && b.copy));
               setSynthesisSignal(match.synthesis_signal || '');
            } else {
               setSynthesisStatus(match.synthesis_status || 'idle');
               setSynthesisBeats([]);
               setSynthesisSignal('');
            }
            setSynthesisErrorMsg(match.synthesis_error || '');
            alert("Delivery Architecture data saved (prior version restored).");
         } else {
            const { data, error: insertError } = await supabase
               .from('agency_snapshot_delivery_architecture')
               .insert([{
                  user_id: user.id,
                  input_hash: h,
                  is_complete: true,
                  is_current: true,
                  total_team_size_fte: teamSize,
                  billable_staff_count: billableCount,
                  non_billable_staff_count: nonBillableCount,
                  average_contractor_count: contractorCount,
                  team_structure_type: structureType || null,
                  founder_time_allocation: founderTime || null,
                  average_team_utilization: utilization || null,
                  key_leadership_roles: leadershipRoles,
                  management_layers: managementLayers || null,
                  specialized_roles: specializedRoles,
                  average_team_experience: experienceLevel || null,
                  // Saved Calculated Metrics
                  agi_per_fte_monthly: agiPerFteMonthly,
                  agi_per_fte_annual: agiPerFteAnnual,
                  billable_ratio_calculated: billableRatio,
                  contractor_percentage_calculated: contractorPercentage,
               }])
               .select()
               .single();

            if (insertError) throw insertError;

            if (data) {
               setCurrentRowId(data.id);
               setProfileData(data);
               setShowProfile(true);
               setSynthesisStatus('idle');
               setSynthesisBeats([]);
               setSynthesisSignal('');
               setSynthesisErrorMsg('');
               alert("Delivery Architecture data saved!");
            }
         }

      } catch (err) {
         console.error('Error saving team data:', err);
         alert("Failed to save data. Please try again.");
      } finally {
         setIsLoading(false);
      }
   };

   const pollSynthesisStatus = async (rowId: string, retries = 0) => {
      try {
         const { data, error } = await supabase
            .from('agency_snapshot_delivery_architecture')
            .select('*')
            .eq('id', rowId)
            .single();

         if (error) throw error;

         if (data.synthesis_status === 'complete') {
            setSynthesisStatus('complete');
            setIsSynthesizing(false);
            setSynthesisBeats([
               { headline: data.synthesis_beat_1_headline, copy: data.synthesis_beat_1 },
               { headline: data.synthesis_beat_2_headline, copy: data.synthesis_beat_2 },
               { headline: data.synthesis_beat_3_headline, copy: data.synthesis_beat_3 },
            ].filter(b => b.headline && b.copy));
            setSynthesisSignal(data.synthesis_signal || '');
            return;
         } else if (data.synthesis_status === 'error') {
            setSynthesisStatus('error');
            setSynthesisErrorMsg(data.synthesis_error || 'An unexpected error occurred during synthesis.');
            setIsSynthesizing(false);
            return;
         }

         // Still running
         if (retries < 20) {
            setTimeout(() => pollSynthesisStatus(rowId, retries + 1), 3000);
         } else {
            setSynthesisStatus('error');
            setSynthesisErrorMsg('Synthesis timed out. Please try again.');
            setIsSynthesizing(false);
         }
      } catch (err) {
         console.error('Error polling synthesis status:', err);
         setSynthesisStatus('error');
         setSynthesisErrorMsg('Failed to check synthesis status.');
         setIsSynthesizing(false);
      }
   };

   const handleRunSynthesis = async () => {
      if (!profileData || !currentRowId) {
         alert("Please save the Delivery Architecture data first.");
         return;
      }
      setIsSynthesizing(true);
      setSynthesisStatus('running');
      setSynthesisErrorMsg('');

      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) throw new Error("Not authenticated");

         if (!import.meta.env.VITE_N8N_WEBHOOK_URL) throw new Error("Missing VITE_N8N_WEBHOOK_URL.");

         const response = await fetch(import.meta.env.VITE_N8N_WEBHOOK_URL + '/agency-snapshot/delivery/synthesize', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: currentRowId, user_id: user.id })
         });

         if (response.ok) {
            // Start polling
            setTimeout(() => pollSynthesisStatus(currentRowId, 0), 2000);
         } else {
            const errText = await response.text();
            console.error('Synthesis webhook error:', errText);
            setSynthesisStatus('error');
            setSynthesisErrorMsg('Failed to trigger synthesis workflow.');
            setIsSynthesizing(false);
         }
      } catch (err) {
         console.error('Error triggering synthesis:', err);
         setSynthesisStatus('error');
         setSynthesisErrorMsg('Network error while triggering synthesis.');
         setIsSynthesizing(false);
      }
   };

   const formatCurrency = (val: number | undefined) => {
      if (val === undefined) return "$---";
      return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })} `;
   };

   // --- Metrics Panel (Calculated) ---
   const metrics = (
      <>
         {/* DUAL METRIC: AGI per FTE */}
         <div className="py-2 border-b border-[var(--aos-mist)] mb-2">
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 mb-1">
               <span></span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Monthly</span>
               <span className="text-xs text-[var(--fg-4)] uppercase tracking-wider text-right">Annually</span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 items-center">
               <span className="text-sm text-[var(--fg-3)] font-medium">AGI per FTE</span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">
                  <span className={agiPerFteMonthly !== undefined ? "text-[var(--fg-1)]" : "text-[var(--fg-4)]"}>
                     {formatCurrency(agiPerFteMonthly)}
                  </span>
               </span>
               <span className="text-sm font-bold text-[var(--fg-1)] text-right">
                  <span className={agiPerFteAnnual !== undefined ? "text-[var(--fg-1)]" : "text-[var(--fg-4)]"}>
                     {formatCurrency(agiPerFteAnnual)}
                  </span>
               </span>
            </div>
         </div>

         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Billable:Non-Billable</span>
            <span className="text-sm font-bold text-[var(--fg-1)] text-right">
               <span className={billableRatio !== undefined ? "text-[var(--fg-1)]" : "text-[var(--fg-4)]"}>
                  {billableRatio !== undefined ? billableRatio.toFixed(1) : "---"}
               </span>
               <span className="text-xs font-normal text-[var(--fg-4)] mx-1">:</span>
               <span className="text-[var(--fg-1)]">1</span>
            </span>
         </div>

         <div className="flex justify-between items-center py-2 border-b border-[var(--aos-mist)] last:border-0 gap-2">
            <span className="text-sm text-[var(--fg-3)] font-medium">Contractor vs Full-Time</span>
            <span className="text-sm font-bold text-[var(--fg-1)] text-right">
               {contractorCount !== undefined && teamSize !== undefined && teamSize > 0 ? (
                  <>
                     <span className="text-[var(--fg-1)]">{Math.round((contractorCount / (teamSize + contractorCount)) * 100)}%</span>
                     <span className="text-xs text-[var(--fg-4)] font-normal mx-1">/</span>
                     <span className="text-[var(--fg-1)]">{Math.round((teamSize / (teamSize + contractorCount)) * 100)}%</span>
                  </>
               ) : (
                  <span className="text-[var(--fg-4)]">---%</span>
               )}
            </span>
         </div>

         <div className="mt-8 pt-8 border-t border-[var(--aos-mist)]">
            <div className="flex items-center justify-center font-medium text-[var(--fg-4)] mb-2">
               <Lightbulb className="h-4 w-4 mr-2" />
               <span className="uppercase tracking-wider text-xs">What This Tells Us</span>
            </div>
            {/* Empty State */}
            <div className="text-center py-6">
               <div className="inline-flex items-center justify-center p-3 bg-[var(--bg-canvas)] rounded-full mb-3">
                  <Users className="h-6 w-6 text-[var(--fg-4)]" />
               </div>
               <p className="text-center text-sm text-[var(--fg-4)] italic px-4">
                  Click "Save Delivery Architecture Data" below to generate contextual insights and benchmark comparisons for your team structure.
               </p>
            </div>
         </div>
      </>
   );

   return (
      <SnapshotLayout sidebarMetrics={metrics} sidebarClassName="lg:w-2/5">
         <SectionHeader
            icon={Users}
            title="Delivery Architecture"
            description="Human capital structure, efficiency, and capacity."
         />

         {/* Top Guidance Message */}
         <div className="bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-lg p-4 mb-6 flex gap-3 relative group">
            {/* Dismiss button could go here, but optional per spec */}
            <Lightbulb className="h-5 w-5 text-[var(--aos-insight)] flex-shrink-0 mt-0.5" />
            <div>
               <h4 className="text-sm font-semibold text-[var(--fg-1)] mb-1">Ballpark figures are perfectly fine</h4>
               <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                  These numbers can be as exact or approximate as you prefer. Rounded estimates work great for directional insights.
               </p>
            </div>
         </div>

         <FormSection title="Baseline Fields">
            <div className="grid grid-cols-1 gap-4">
               {/* Team Size */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Total Team Size (FTE)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           FTE = Full-Time Equivalent. Count part-time staff proportionally (e.g., 2 half-time = 1 FTE). Include yourself.
                        </div>
                     </div>
                  </div>
                  <Input
                     type="number"
                     placeholder="0"
                     value={teamSize ?? ''}
                     onChange={(e) => setTeamSize(e.target.value === '' ? undefined : parseInt(e.target.value))}
                  />
                  <p className="text-xs text-[var(--fg-3)] mt-1">Full-time equivalent employee count</p>
               </div>

               {/* Billable & Non-Billable (Grouped) */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Billable Count */}
                  <div>
                     <div className="flex items-center gap-1 mb-1">
                        <Label>Billable Staff Count</Label>
                        <div className="group relative">
                           <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                              Staff whose time is 80%+ billable to clients. Includes deliverers, creatives, devs, etc.
                           </div>
                        </div>
                     </div>
                     <Input
                        type="number"
                        placeholder="0"
                        value={billableCount ?? ''}
                        onChange={(e) => setBillableCount(e.target.value === '' ? undefined : parseInt(e.target.value))}
                     />
                     <p className="text-xs text-[var(--fg-3)] mt-1">Client-facing delivery staff</p>
                  </div>

                  {/* Non-Billable Count */}
                  <div>
                     <div className="flex items-center gap-1 mb-1">
                        <Label>Non-Billable Staff Count</Label>
                        <div className="group relative">
                           <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                              Staff who support the business but don't bill directly. Ops, finance, HR, admin, etc.
                           </div>
                        </div>
                     </div>
                     <Input
                        type="number"
                        placeholder="0"
                        value={nonBillableCount ?? ''}
                        onChange={(e) => setNonBillableCount(e.target.value === '' ? undefined : parseInt(e.target.value))}
                     />
                     <p className="text-xs text-[var(--fg-3)] mt-1">Support/Admin/Ops staff</p>
                  </div>
               </div>

               {/* Contractors (Moved Up) */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Average Contractor Count (Optional)</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Average number of contractors you engage in a typical month.
                        </div>
                     </div>
                  </div>
                  <Input
                     type="number"
                     placeholder="0"
                     value={contractorCount ?? ''}
                     onChange={(e) => setContractorCount(e.target.value === '' ? undefined : parseInt(e.target.value))}
                  />
                  <p className="text-xs text-[var(--fg-3)] mt-1">Typical monthly contractor count</p>
               </div>

               {/* Team Structure */}
               <div>
                  <Label>Team Structure Type</Label>
                  <Select value={structureType} onChange={(e) => setStructureType(e.target.value)}>
                     <option value="" disabled>Select team structure...</option>
                     <option value="all_generalists">All generalists (everyone does everything)</option>
                     <option value="mostly_generalists">Mostly generalists with some specialists</option>
                     <option value="balanced_mix">Balanced mix of generalists and specialists</option>
                     <option value="mostly_specialists">Mostly specialists with dedicated roles</option>
                     <option value="fully_specialized">Fully specialized (distinct role for each function)</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">How would you describe your delivery model?</p>
               </div>

               {/* Founder Time */}
               <div>
                  <Label>Founder Time Allocation</Label>
                  <Select value={founderTime} onChange={(e) => setFounderTime(e.target.value)}>
                     <option value="" disabled>Select time allocation...</option>
                     <option value="mostly_client_work">Mostly client work (I'm still the primary deliverer)</option>
                     <option value="mix_client_ops">Mix of client work and operations</option>
                     <option value="mostly_operations">Mostly operations (managing team, building processes)</option>
                     <option value="mostly_strategy_sales">Mostly sales and strategy (growth-focused)</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">Where do you spend most of your time?</p>
               </div>

               {/* Utilization (Optional) */}
               <div>
                  <Label>Average Team Utilization (Optional)</Label>
                  <Select value={utilization} onChange={(e) => setUtilization(e.target.value)}>
                     <option value="" disabled>Select utilization rate...</option>
                     <option value="under_60">&lt;60% (significant capacity available)</option>
                     <option value="60_to_70">60-70% (healthy capacity)</option>
                     <option value="70_to_80">70-80% (well-utilized)</option>
                     <option value="80_to_85">80-85% (near capacity)</option>
                     <option value="over_85">85%+ (at/over capacity)</option>
                  </Select>
                  <p className="text-xs text-[var(--fg-3)] mt-1">What's your typical team utilization?</p>
               </div>
            </div>
         </FormSection>

         <AdvancedSection description="Provide additional context for deeper team insights">
            <div className="grid grid-cols-1 gap-6">
               {/* Leadership Roles */}
               <div>
                  <Label className="mb-2 block">Key Leadership Roles Present</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {[
                        { val: "coo", label: "COO / General Manager" },
                        { val: "head_of_delivery", label: "Head of Delivery / Ops Director" },
                        { val: "creative_director", label: "Creative Director" },
                        { val: "strategy_lead", label: "Strategy Lead / Director" },
                        { val: "account_director", label: "Account Director" },
                        { val: "media_lead", label: "Media Director" },
                        { val: "operations_manager", label: "Operations Manager" },
                        { val: "finance_lead", label: "CFO / Finance Director" },
                        { val: "hr_lead", label: "HR Director / People Ops" },
                        { val: "biz_dev_lead", label: "Biz Dev / Sales Director" },
                     ].map(role => (
                        <label key={role.val} className="flex items-center gap-2 p-2 border border-[var(--aos-mist)] rounded hover:bg-[var(--bg-canvas)] cursor-pointer">
                           <input
                              type="checkbox"
                              checked={leadershipRoles.includes(role.val)}
                              onChange={() => handleMultiSelect(leadershipRoles, setLeadershipRoles, role.val)}
                              className="rounded border-[var(--aos-mist)] text-[var(--aos-insight)] focus:ring-[var(--aos-brass-tint)]"
                           />
                           <span className="text-sm text-[var(--fg-2)]">{role.label}</span>
                        </label>
                     ))}
                  </div>
                  <p className="text-xs text-[var(--fg-3)] mt-2">Select all formal leadership roles that exist in your organization</p>
               </div>

               {/* Management Layers */}
               <div>
                  <div className="flex items-center gap-1 mb-1">
                     <Label>Management Layers</Label>
                     <div className="group relative">
                        <Info className="h-3 w-3 text-[var(--fg-4)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded hidden group-hover:block z-10 shadow-lg border border-[var(--aos-slate-blue)]">
                           Example: 1-2 levels = Team → Founder.
                        </div>
                     </div>
                  </div>
                  <Select value={managementLayers} onChange={(e) => setManagementLayers(e.target.value)}>
                     <option value="" disabled>Select management layers...</option>
                     <option value="one_to_two">1-2 levels (flat structure)</option>
                     <option value="three_to_four">3-4 levels (moderate hierarchy)</option>
                     <option value="five_plus">5+ levels (complex hierarchy)</option>
                  </Select>
               </div>

               {/* Specialized Roles (Conditional) */}
               {structureType !== 'all_generalists' && (
                  <div>
                     <Label className="mb-2 block">Specialized Roles Present (Optional)</Label>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                           { val: "strategist", label: "Strategist" },
                           { val: "copywriter", label: "Copywriter" },
                           { val: "designer", label: "Designer / Art Director" },
                           { val: "developer", label: "Developer / Engineer" },
                           { val: "media_buyer", label: "Media Buyer" },
                           { val: "seo_specialist", label: "SEO Specialist" },
                           { val: "data_analyst", label: "Data Analyst" },
                           { val: "content_producer", label: "Content Producer" },
                           { val: "account_manager", label: "Account Manager" },
                           { val: "project_manager", label: "Project Manager" },
                        ].map(role => (
                           <label key={role.val} className="flex items-center gap-2 p-2 border border-[var(--aos-mist)] rounded hover:bg-[var(--bg-canvas)] cursor-pointer">
                              <input
                                 type="checkbox"
                                 checked={specializedRoles.includes(role.val)}
                                 onChange={() => handleMultiSelect(specializedRoles, setSpecializedRoles, role.val)}
                                 className="rounded border-[var(--aos-mist)] text-[var(--aos-insight)] focus:ring-[var(--aos-brass-tint)]"
                              />
                              <span className="text-sm text-[var(--fg-2)]">{role.label}</span>
                           </label>
                        ))}
                     </div>
                  </div>
               )}

               {/* Experience Level */}
               <div>
                  <Label>Average Team Experience Level (Optional)</Label>
                  <Select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                     <option value="" disabled>Select experience level...</option>
                     <option value="mostly_junior">Mostly junior (0-3 years)</option>
                     <option value="mix_junior_mid">Mix of junior and mid-level</option>
                     <option value="mostly_mid">Mostly mid-level (3-7 years)</option>
                     <option value="mix_mid_senior">Mix of mid-level and senior</option>
                     <option value="mostly_senior">Mostly senior (7+ years)</option>
                  </Select>
               </div>
            </div>
         </AdvancedSection>

         <div className="pt-4 border-t border-[var(--aos-mist)] mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
               <Button className="w-full sm:w-auto min-w-[140px]" variant="secondary" onClick={handleSave} disabled={isLoading || isSynthesizing || synthesisStatus === 'complete'}>
                  {isLoading ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : synthesisStatus === 'complete' ? (
                     "Saved"
                  ) : (
                     <><Save className="mr-2 h-4 w-4" /> Save Data</>
                  )}
               </Button>
               
               <Button
                  className={`w-full sm:w-auto min-w-[200px] text-[var(--fg-on-dark)] transition-colors ${(isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete')
                      ? 'bg-[var(--aos-brass)] opacity-50 cursor-not-allowed'
                      : 'bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] shadow-sm'
                  }`}
                  onClick={() => handleRunSynthesis()}
                  disabled={isLoading || isSynthesizing || !currentRowId || synthesisStatus === 'complete'}
               >
                  {isSynthesizing ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing Profile...</>
                  ) : (
                     <><Sparkles className="mr-2 h-4 w-4" /> Submit for Synthesis</>
                  )}
               </Button>
            </div>

            {/* Status Messages */}
            {synthesisStatus === 'complete' && (
               <div className="mt-4 p-3 bg-[var(--aos-success-tint)] text-[var(--aos-success)] rounded-md border border-[var(--aos-success)] flex items-center gap-2 text-sm animate-in fade-in">
                  <Check className="h-4 w-4" />
                  Synthesis complete! View your delivery architecture analysis below.
               </div>
            )}
            {synthesisStatus === 'error' && (
               <div className="mt-4 p-3 bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] rounded-md border border-[var(--aos-risk)] flex items-center gap-2 text-sm animate-in fade-in">
                  <AlertCircle className="h-4 w-4" />
                  There was an error running synthesis. Please try again.
               </div>
            )}
            {(isLoading || isSynthesizing) && (
               <div className="mt-4 p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)] flex items-center gap-3 animate-in fade-in">
                  <Loader2 className="h-5 w-5 text-[var(--fg-3)] animate-spin" />
                  <div>
                     <p className="text-sm font-medium text-[var(--fg-1)]">
                        {isSynthesizing ? "Running AI Synthesis..." : "Saving your configuration..."}
                     </p>
                     <p className="text-xs text-[var(--fg-3)]">This typically takes a few seconds.</p>
                  </div>
               </div>
            )}

            {showProfile && (
               <div className="mt-8 pt-8 border-t border-[var(--aos-mist)] animate-in slide-in-from-top-4 fade-in duration-700">
                  <TeamProfile profileData={profileData} />
                  
                  {/* SYNTHESIS RENDER BLOCK */}
                  <div className="mt-8 p-6 bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl">
                     <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="h-5 w-5 text-[var(--aos-warning)]" />
                        <h4 className="text-base font-bold text-[var(--fg-1)]">Delivery Architecture Insights</h4>
                     </div>
                     
                     {(!synthesisStatus || synthesisStatus === 'idle') && (
                        <p className="text-sm text-[var(--fg-3)] italic">Contextual insights will appear here after GPT synthesis is enabled.</p>
                     )}

                     {synthesisStatus === 'running' && (
                        <div className="flex items-center gap-3 py-4 text-sm text-[var(--fg-2)] animate-pulse">
                           <Loader2 className="h-5 w-5 animate-spin text-[var(--aos-warning)]" />
                           <span>Synthesizing structural efficiency and leverage...</span>
                        </div>
                     )}

                     {synthesisStatus === 'complete' && synthesisBeats.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                           {synthesisBeats.map((beat, i) => (
                              <ExpandableInsightCard key={i} headline={beat.headline} copy={beat.copy} />
                           ))}
                           
                           {synthesisSignal && (
                              <div className="mt-6 p-6 bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-xl shadow-inner">
                                 <div className="flex items-center gap-2 mb-3">
                                    <Target className="h-4 w-4 text-[var(--aos-insight)]" />
                                    <span className="text-xs font-bold text-[var(--fg-1)] tracking-widest uppercase">The Signal</span>
                                 </div>
                                 <p className="text-[15px] font-medium text-[var(--fg-1)] leading-relaxed italic">
                                    "{synthesisSignal}"
                                 </p>
                              </div>
                           )}
                        </div>
                     )}

                     {synthesisStatus === 'error' && (
                        <div className="flex items-start gap-4 p-5 bg-[var(--aos-risk-tint)] border border-[var(--aos-risk)] rounded-xl animate-in fade-in">
                           <div className="p-2 bg-[var(--aos-risk-tint)] rounded-full shrink-0">
                              <AlertCircle className="h-5 w-5 text-[var(--aos-risk)]" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-[var(--fg-1)] mb-1">Synthesis failed</p>
                              <p className="text-xs text-[var(--aos-risk)] mb-4">{synthesisErrorMsg || "An unexpected error occurred during synthesis."}</p>
                              <Button variant="secondary" onClick={() => handleRunSynthesis()}>
                                 Retry Synthesis
                              </Button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </SnapshotLayout>
   );
};

// --- Tab 5: Identity & Positioning ---

export const IdentityPositioning: React.FC = () => {
   return <IdentityPositioningTab />;
};
