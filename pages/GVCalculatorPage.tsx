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
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScenarioBuilder } from '../components/tools/growth-velocity/ScenarioBuilder';

// --- Components for Output Section (Standard Calculator) ---

const MetricCard: React.FC<{ icon: React.ElementType; label: string; value: string; context: string }> = ({ 
  icon: Icon, label, value, context 
}) => (
  <Card className="p-6 flex flex-col h-full border-slate-200 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
        <Icon className="h-5 w-5" />
      </div>
      <span className="font-medium text-slate-600 text-sm">{label}</span>
    </div>
    <div className="mt-auto">
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-xs text-slate-500">{context}</div>
    </div>
  </Card>
);

const PressureCard: React.FC<{ 
  icon: React.ElementType; 
  label: string; 
  status: 'high' | 'moderate' | 'low' | 'na'; 
  insight: string 
}> = ({ icon: Icon, label, status, insight }) => {
  const statusConfig = {
    high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'HIGH', badge: 'bg-red-100 text-red-700' },
    moderate: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'MODERATE', badge: 'bg-yellow-100 text-yellow-800' },
    low: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'LOW', badge: 'bg-emerald-100 text-emerald-700' },
    na: { color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', label: 'N/A', badge: 'bg-slate-200 text-slate-600' },
  };

  const config = statusConfig[status];

  return (
    <div className={`p-5 rounded-lg border ${config.border} ${config.bg} h-full`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={`text-sm font-semibold ${config.color}`}>{label}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${config.badge}`}>
          {config.label}
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
    </div>
  );
};

const GVIDisplay: React.FC<{ score: number }> = ({ score }) => {
  // Determine lift level
  let label = "LIGHT LIFT";
  let colorClass = "bg-emerald-500";
  
  if (score < 40) {
    label = "CRUSHING LIFT";
    colorClass = "bg-red-500";
  } else if (score < 60) {
    label = "HEAVY LIFT";
    colorClass = "bg-orange-500";
  } else if (score < 80) {
    label = "MODERATE LIFT";
    colorClass = "bg-yellow-500";
  }

  return (
    <div className="bg-slate-900 rounded-xl p-8 text-white flex flex-col items-center text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500" />
      
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-6">Growth Velocity Index</h3>
      
      <div className="relative mb-6">
        <div className="text-7xl font-bold tracking-tighter">{score}</div>
        <div className="text-lg text-slate-400 font-medium">/100</div>
      </div>

      <div className="w-full max-w-xs h-3 bg-slate-800 rounded-full mb-4 overflow-hidden">
         <div className={`h-full ${colorClass}`} style={{ width: `${score}%` }} />
      </div>

      <div className={`text-xl font-bold mb-2 ${
        score < 40 ? "text-red-400" : 
        score < 60 ? "text-orange-400" :
        score < 80 ? "text-yellow-400" : "text-emerald-400"
      }`}>
        {label}
      </div>
      
      <p className="text-slate-400 text-sm max-w-sm">
        Your ambition creates significant pressure across multiple operational areas.
      </p>
    </div>
  );
};

const ComparisonTable: React.FC = () => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-6 py-3 font-medium">Metric</th>
          <th className="px-6 py-3 font-medium">Current</th>
          <th className="px-6 py-3 font-medium">Target</th>
          <th className="px-6 py-3 font-medium">Delta</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr className="bg-white">
          <td className="px-6 py-4 font-medium text-slate-900">Revenue (AGI)</td>
          <td className="px-6 py-4 text-slate-600">$2.0M</td>
          <td className="px-6 py-4 text-slate-600">$4.0M</td>
          <td className="px-6 py-4 text-emerald-600 font-medium">+$2.0M (+100%)</td>
        </tr>
        <tr className="bg-slate-50/50">
          <td className="px-6 py-3 pl-10 text-slate-500">↳ MRR Revenue</td>
          <td className="px-6 py-3 text-slate-500">$1.4M (70%)</td>
          <td className="px-6 py-3 text-slate-500">$2.8M (70%)</td>
          <td className="px-6 py-3 text-emerald-600 text-xs font-medium">+$1.4M</td>
        </tr>
        <tr className="bg-slate-50/50">
          <td className="px-6 py-3 pl-10 text-slate-500">↳ Project Revenue</td>
          <td className="px-6 py-3 text-slate-500">$600k (30%)</td>
          <td className="px-6 py-3 text-slate-500">$1.2M (30%)</td>
          <td className="px-6 py-3 text-emerald-600 text-xs font-medium">+$600k</td>
        </tr>
        <tr className="bg-white">
          <td className="px-6 py-4 font-medium text-slate-900">Team Size</td>
          <td className="px-6 py-4 text-slate-600">16 FTEs</td>
          <td className="px-6 py-4 text-slate-600">25 FTEs</td>
          <td className="px-6 py-4 text-slate-900 font-medium">+9 hires</td>
        </tr>
        <tr className="bg-white">
          <td className="px-6 py-4 font-medium text-slate-900">Client Count</td>
          <td className="px-6 py-4 text-slate-600">83</td>
          <td className="px-6 py-4 text-slate-600">133</td>
          <td className="px-6 py-4 text-slate-900 font-medium">+50 clients</td>
        </tr>
        <tr className="bg-white">
          <td className="px-6 py-4 font-medium text-slate-900">Sales Velocity</td>
          <td className="px-6 py-4 text-slate-600">1.4 deals/mo</td>
          <td className="px-6 py-4 text-slate-600">4.8 deals/mo</td>
          <td className="px-6 py-4 text-orange-600 font-medium">+3.4x pace</td>
        </tr>
         <tr className="bg-white">
          <td className="px-6 py-4 font-medium text-slate-900">Profit Pool</td>
          <td className="px-6 py-4 text-slate-600">$240k</td>
          <td className="px-6 py-4 text-slate-600">$480k</td>
          <td className="px-6 py-4 text-emerald-600 font-medium">+$240k (+100%)</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const ProcessingOverlay: React.FC<{ stage: number }> = ({ stage }) => {
  const stages = [
    "Analyzing growth targets...",
    "Calculating pressure implications...",
    "Running constraint analysis...",
    "Generating strategic synthesis..."
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="h-16 w-16 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-3xl">A</span>
        </div>
        
        <h3 className="text-xl font-bold text-slate-900 mb-2">Architect OS</h3>
        <p className="text-slate-500 mb-8 min-h-[1.5rem] transition-opacity duration-300">
           {stages[stage] || "Processing..."}
        </p>

        <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
          <div 
             className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out" 
             style={{ width: `${(stage + 1) * 25}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-medium">
           <span>0%</span>
           <span>{(stage + 1) * 25}%</span>
        </div>
      </div>
    </div>
  );
};

// --- Standard Calculator Component (Page 1) ---

export const GVCalculator: React.FC = () => {
   const [inputs, setInputs] = useState({
    // Current State
    currentRevenue: '',
    currentMargin: '',
    currentTeam: '',
    currentClients: '',
    currentRetention: '90',
    mrrMix: '70',
    projectMix: '30',
    syncSnapshot: true,
    
    // Target State
    targetTimeframe: '12',
    targetRevenue: '',
    targetMarginType: 'percent', // 'percent' or 'dollar'
    targetMarginValue: '',
    targetTeam: '',
    targetClients: '',
    targetRetention: '',
    targetACV: '',

    // Advanced
    overrideMrrMix: '',
    overrideProjectMix: '',
    repeatClientRate: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    setProcessingStage(0);
    setShowOutput(false);

    // Simulate processing steps
    const interval = setInterval(() => {
      setProcessingStage(prev => {
        if (prev >= 3) {
          clearInterval(interval);
          setTimeout(() => {
            setIsProcessing(false);
            setShowOutput(true);
            // Scroll to output
            document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 500);
          return 3;
        }
        return prev + 1;
      });
    }, 800);
  };

  const handleQuickStart = (value: string) => {
    // Placeholder logic for quick start
    if (value === 'aggressive') {
       setInputs(prev => ({ ...prev, targetRevenue: '4000000', targetMarginValue: '20' }));
    } else if (value === 'efficiency') {
       setInputs(prev => ({ ...prev, targetRevenue: '2500000', targetMarginValue: '35' }));
    }
  };

  return (
    <div className="pb-20">
      {isProcessing && <ProcessingOverlay stage={processingStage} />}
      
      <div className="max-w-5xl mx-auto mb-12 animate-in fade-in duration-300">
         {/* Page Header */}
         <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-slate-100 rounded-lg">
               <BarChart3 className="h-6 w-6 text-slate-600" />
            </div>
            <div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Growth Velocity Calculator</h1>
               <p className="text-slate-500">Model your growth and identify strategic constraints</p>
            </div>
         </div>

         {/* Warnings */}
         <div className="space-y-4 mb-8">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
               <span className="text-xl">💡</span>
               <div className="text-sm text-blue-900">
                  <span className="font-semibold block mb-1">INFO</span>
                  Complete your Agency Snapshot for more accurate results and context-aware insights. 
                  <Link to="/snapshot" className="ml-2 underline hover:text-blue-700">Complete Snapshot &rarr;</Link>
               </div>
            </div>
         </div>
         
         {/* Main Form Card */}
         <Card className="p-6 md:p-8">
            {/* Quick Start */}
            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
               <Label className="mb-2 block">Quick Start Presets (Optional)</Label>
               <Select onChange={(e) => handleQuickStart(e.target.value)} defaultValue="">
                  <option value="" disabled>-- Select a scenario preset --</option>
                  <option value="aggressive">Aggressive Growth</option>
                  <option value="efficiency">Efficiency Play</option>
                  <option value="premium">Premium Pivot</option>
                  <option value="cash">Cash Preservation</option>
               </Select>
               <p className="text-xs text-slate-500 mt-2">Not sure what to test? Select a strategic archetype and adjust from there.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
               {/* Left Column: Current State */}
               <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                     <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-slate-500" />
                        <div>
                           <h3 className="font-semibold text-slate-900">Current State</h3>
                           <p className="text-xs text-slate-500">Where you are today</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <Label htmlFor="sync-toggle" className="mb-0 text-xs font-normal text-slate-500">Sync Snapshot</Label>
                        <Switch 
                           id="sync-toggle"
                           checked={inputs.syncSnapshot} 
                           onCheckedChange={(checked) => handleInputChange('syncSnapshot', checked)} 
                        />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <Label>Revenue (AGI)</Label>
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                           <Input 
                              type="number" 
                              className="pl-7" 
                              placeholder="0" 
                              value={inputs.currentRevenue}
                              onChange={(e) => handleInputChange('currentRevenue', e.target.value)}
                           />
                        </div>
                     </div>
                     <div>
                        <Label>Profit Margin</Label>
                        <div className="relative">
                           <Input 
                              type="number" 
                              className="pr-8" 
                              placeholder="0" 
                              value={inputs.currentMargin}
                              onChange={(e) => handleInputChange('currentMargin', e.target.value)}
                           />
                           <span className="absolute right-3 top-2.5 text-slate-400">%</span>
                        </div>
                     </div>
                     <div>
                        <Label>Profit (Implied)</Label>
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                           <Input disabled className="pl-7 bg-slate-50 text-slate-500" placeholder="Calculated" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <Label>Team (FTEs)</Label>
                           <Input 
                              type="number" 
                              placeholder="0" 
                              value={inputs.currentTeam}
                              onChange={(e) => handleInputChange('currentTeam', e.target.value)}
                           />
                        </div>
                        <div>
                           <Label>Client Count</Label>
                           <Input 
                              type="number" 
                              placeholder="0" 
                              value={inputs.currentClients}
                              onChange={(e) => handleInputChange('currentClients', e.target.value)}
                           />
                        </div>
                     </div>
                  </div>
               </div>

               {/* Right Column: Target State */}
               <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                     <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-brand-600" />
                        <div>
                           <h3 className="font-semibold text-slate-900">Future Targets</h3>
                           <p className="text-xs text-slate-500">Where you want to be</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <Label>Timeframe</Label>
                        <Select 
                           value={inputs.targetTimeframe}
                           onChange={(e) => handleInputChange('targetTimeframe', e.target.value)}
                        >
                           <option value="12">12 months</option>
                           <option value="18">18 months</option>
                           <option value="24">24 months</option>
                           <option value="36">36 months</option>
                        </Select>
                     </div>
                     <div>
                        <Label>Target Revenue (AGI)</Label>
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                           <Input 
                              type="number" 
                              className="pl-7" 
                              placeholder="0" 
                              value={inputs.targetRevenue}
                              onChange={(e) => handleInputChange('targetRevenue', e.target.value)}
                           />
                        </div>
                     </div>
                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                           <Label className="mb-0">Target Profit</Label>
                           <div className="flex text-xs bg-slate-100 rounded p-0.5">
                              <button 
                                 onClick={() => handleInputChange('targetMarginType', 'percent')}
                                 className={`px-2 py-0.5 rounded ${inputs.targetMarginType === 'percent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                              >
                                 %
                              </button>
                              <button 
                                 onClick={() => handleInputChange('targetMarginType', 'dollar')}
                                 className={`px-2 py-0.5 rounded ${inputs.targetMarginType === 'dollar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                              >
                                 $
                              </button>
                           </div>
                        </div>
                        <div className="relative">
                           {inputs.targetMarginType === 'dollar' && <span className="absolute left-3 top-2.5 text-slate-400">$</span>}
                           <Input 
                              type="number" 
                              className={inputs.targetMarginType === 'dollar' ? 'pl-7' : 'pr-8'} 
                              placeholder="0" 
                              value={inputs.targetMarginValue}
                              onChange={(e) => handleInputChange('targetMarginValue', e.target.value)}
                           />
                           {inputs.targetMarginType === 'percent' && <span className="absolute right-3 top-2.5 text-slate-400">%</span>}
                        </div>
                     </div>
                     <div>
                        <Label>Target Team (FTEs)</Label>
                        <Input 
                           type="number" 
                           placeholder="Leave blank to calculate" 
                           value={inputs.targetTeam}
                           onChange={(e) => handleInputChange('targetTeam', e.target.value)}
                        />
                        <p className="text-xs text-slate-400 mt-1">Defaults to benchmark efficiency (~$200k/FTE)</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Run Button */}
            <div className="mt-8 flex justify-center">
               <Button 
                  onClick={handleRunAnalysis}
                  disabled={!inputs.targetRevenue}
                  className="px-12 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
               >
                  <Rocket className="mr-2 h-5 w-5" /> Run Scenario Analysis
               </Button>
            </div>
         </Card>
      </div>

      {/* Output Section */}
      {showOutput && (
        <div id="output-section" className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
           
           {/* Top Row: GVI + Metrics */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                 <GVIDisplay score={45} />
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 <MetricCard icon={TrendingUp} label="CAGR" value="42%" context="Annual growth rate required" />
                 <MetricCard icon={Users} label="Target AGI per FTE" value="$160k" context="vs. current $125k (+28%)" />
                 <MetricCard icon={DollarSign} label="Net New Revenue" value="$1.8M" context="After churn replacement" />
                 <MetricCard icon={Target} label="Sales Velocity" value="4.8/mo" context="vs. current 1.4/mo (3.4x)" />
                 <MetricCard icon={Users} label="Hiring Velocity" value="1.5/qtr" context="9% quarterly team growth" />
                 <MetricCard icon={Scale} label="Profit Pool" value="$480k" context="vs. current $240k (+100%)" />
              </div>
           </div>

           {/* Pressure Dashboard */}
           <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <Activity className="h-5 w-5 text-slate-600" /> Pressure Dashboard
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <PressureCard 
                    icon={RotateCcw} label="Retention Pressure" status="high" 
                    insight="Churn consumes 45% of required growth. High friction detected."
                 />
                 <PressureCard 
                    icon={Target} label="Sales Pressure" status="high" 
                    insight="Requires 3.4x your current acquisition velocity. New capability needed."
                 />
                 <PressureCard 
                    icon={Users} label="Capacity Pressure" status="moderate" 
                    insight="Hiring pace crosses culture strain threshold. Focused management required."
                 />
                 <PressureCard 
                    icon={DollarSign} label="Economic Pressure" status="moderate" 
                    insight="Margins compress under hiring load. Cash flow attention needed."
                 />
                 <PressureCard 
                    icon={Scale} label="Structural Risk" status="low" 
                    insight="Client distribution remains healthy. No concentration concerns."
                 />
                 <PressureCard 
                    icon={Target} label="Channel Pressure" status="high" 
                    insight="Current referral channel insufficient for required pace. New channel needed."
                 />
              </div>
           </div>

           {/* Charts & Table */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                 <Card className="overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700">Metrics Comparison</div>
                    <ComparisonTable />
                 </Card>
              </div>

              {/* Strategic Synthesis */}
              <div className="lg:col-span-1 space-y-6">
                 <Card className="p-6 border-l-4 border-l-slate-800">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                       <Activity className="h-4 w-4" /> Reality Check
                    </h3>
                    <div className="prose prose-sm text-slate-600">
                       <p>
                          To achieve $4M revenue in 18 months requires doubling your business. However, your 80% retention rate means $600k of that growth goes to replacing churned clients. Your true sales target is $2.6M, not $2M.
                       </p>
                    </div>
                 </Card>
              </div>
           </div>

           {/* Actions */}
           <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row justify-center gap-4 bg-white/80 backdrop-blur p-4 rounded-xl border border-slate-200 shadow-xl max-w-3xl mx-auto">
              <Button onClick={() => {}} className="shadow-md">
                 <Save className="mr-2 h-4 w-4" /> Save Scenario
              </Button>
              <Link to="/clarity-compass/vision-state">
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
      )}
    </div>
  );
};


// --- Scenario Planner Component (Page 2) ---

export const GVScenarioPlanner: React.FC = () => {
  return (
    <div className="pb-20">
      <div className="max-w-full mx-auto mb-12">
         {/* Header */}
         <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-slate-100 rounded-lg">
               <SlidersHorizontal className="h-6 w-6 text-brand-600" />
            </div>
            <div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scenario Planner</h1>
               <p className="text-slate-500">Advanced growth modeling and scenario comparison.</p>
            </div>
         </div>

         <ScenarioBuilder />
      </div>
    </div>
  );
};