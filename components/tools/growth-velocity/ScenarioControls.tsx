import React, { useEffect } from 'react';
import { Card, Label, Slider, Button, Badge, Select } from '../../ui';
import { Rocket, BarChart3, TrendingUp, DollarSign, Clock, Check, Save, Plus, ArrowRight } from 'lucide-react';
import { PRESETS, ScenarioPreset } from '../../../lib/presetScenarios';

export interface ScenarioModifiers {
   revenueTarget: number;
   efficiency: number;
   retention: number;
   acv: number;
   margin: number;
   clientCount: number;
   timeframe: number;
}

interface ScenarioControlsProps {
   baselineRevenue: number;
   baselineACV: number;
   baselineClientCount: number;
   modifiers: ScenarioModifiers;
   isRun: boolean;
   onChange: (modifiers: ScenarioModifiers) => void;
   onRunScenario: () => void;
   onSaveScenario: () => void;
   onSetPrimary: () => void;
   onAddToComparison: () => void;
}

// Temporary Presets definition if not available in lib/presetScenarios yet
const LOCAL_PRESETS: Record<string, { label: string; description: string; modifiers: Partial<ScenarioModifiers> }> = {
   'modest': {
      label: 'Modest Growth',
      description: 'Sustainable growth (+15%) with current efficiency. Tests incremental improvements.',
      modifiers: { revenueTarget: 15, efficiency: 0, retention: 2, acv: 5, margin: 0, clientCount: 10 }
   },
   'aggressive': {
      label: 'Aggressive Expansion',
      description: 'Rapid scaling (+50%). Requires significant team growth and client acquisition.',
      modifiers: { revenueTarget: 50, efficiency: -5, retention: 0, acv: 0, margin: -3, clientCount: 40 }
   },
   'efficiency': {
      label: 'Efficiency Focused',
      description: 'Profitability optimization (+20% Rev). Grow revenue while improving margins.',
      modifiers: { revenueTarget: 20, efficiency: 10, retention: 5, acv: 30, margin: 5, clientCount: -5 }
   },
   'retention': {
      label: 'Client Retention Play',
      description: 'Reduce churn and maximize existing client value (+10% Rev).',
      modifiers: { revenueTarget: 10, efficiency: 0, retention: 10, acv: 8, margin: 0, clientCount: 2 }
   },
   'premium': {
      label: 'Premium Positioning',
      description: 'Move upmarket with higher-value clients. Improve margins through pricing power.',
      modifiers: { revenueTarget: 25, efficiency: 5, retention: 5, acv: 30, margin: 4, clientCount: -5 }
   },
   'scale': {
      label: 'Scale & Volume',
      description: 'High-volume growth strategy. Acquire many clients at current pricing.',
      modifiers: { revenueTarget: 35, efficiency: 5, retention: 0, acv: 0, margin: -2, clientCount: 40 }
   }
};

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
   baselineRevenue,
   baselineACV,
   baselineClientCount,
   modifiers,
   isRun,
   onChange,
   onRunScenario,
   onSaveScenario,
   onSetPrimary,
   onAddToComparison
}) => {
   const [selectedPreset, setSelectedPreset] = React.useState<string>("");

   const handleSliderChange = (key: keyof ScenarioModifiers, value: number) => {
      let newModifiers = { ...modifiers, [key]: value };

      // Coupled Logic for Revenue <-> Client Count <-> ACV
      // Revenue = Clients * ACV
      // (1 + Rev%) = (1 + Client%) * (1 + ACV%)

      // Logic: If Revenue changes, update Client Count (hold ACV constant)
      if (key === 'revenueTarget') {
         const revenueMult = 1 + value / 100;
         const acvMult = 1 + modifiers.acv / 100;
         const clientMult = revenueMult / acvMult;
         newModifiers.clientCount = Math.round((clientMult - 1) * 100);
      }
      // Logic: If ACV changes, update Client Count (hold Revenue constant)
      // OR update Revenue (hold Client Count)?
      // Usually changing Price changes Revenue.
      else if (key === 'acv') {
         // Strategy: Update Revenue? Or maintain Revenue and force Client count down?
         // Let's update Revenue, as Revenue is the outcome of ACV * Clients
         const acvMult = 1 + value / 100;
         const clientMult = 1 + modifiers.clientCount / 100;
         const revenueMult = acvMult * clientMult;
         newModifiers.revenueTarget = Math.round((revenueMult - 1) * 100);
      }
      // Logic: If Client Count changes, update Revenue (hold ACV constant)
      else if (key === 'clientCount') {
         const clientMult = 1 + value / 100;
         const acvMult = 1 + modifiers.acv / 100;
         const revenueMult = clientMult * acvMult;
         newModifiers.revenueTarget = Math.round((revenueMult - 1) * 100);
      }

      onChange(newModifiers);
   };

   const applyPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetKey = e.target.value;
      if (!presetKey) return;

      const preset = LOCAL_PRESETS[presetKey];
      if (preset) {
         setSelectedPreset(presetKey);
         onChange({
            ...modifiers,
            ...preset.modifiers
         });
      }
   };

   const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
      return `$${val}`;
   };

   // Calculate projected revenue for display
   const projectedRevenue = baselineRevenue * (1 + modifiers.revenueTarget / 100);
   const projectedClients = Math.round(baselineClientCount * (1 + modifiers.clientCount / 100));

   return (
      <Card className="p-6 bg-white border-slate-200">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
            <div>
               <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-brand-600" /> Scenario Configuration
               </h3>
               <p className="text-slate-500 text-sm mt-1">Adjust parameters to model future growth scenarios.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
               <div className="w-full sm:w-48">
                  <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-1 block">Timeframe</Label>
                  <Select
                     value={modifiers.timeframe.toString()}
                     onChange={(e) => onChange({ ...modifiers, timeframe: parseInt(e.target.value) })}
                     className="bg-slate-50 border-slate-200"
                  >
                     <option value="12">12 Months</option>
                     <option value="18">18 Months</option>
                     <option value="24">24 Months</option>
                     <option value="36">36 Months</option>
                  </Select>
               </div>
               <div className="w-full sm:w-64">
                  <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-1 block">Quick Presets</Label>
                  <Select
                     value={selectedPreset}
                     onChange={applyPreset}
                     className="bg-slate-50 border-slate-200"
                  >
                     <option value="" disabled>Select a preset...</option>
                     {Object.entries(LOCAL_PRESETS).map(([key, p]) => (
                        <option key={key} value={key}>{p.label}</option>
                     ))}
                  </Select>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 mb-8">
            {/* Revenue Ambition */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">Revenue Ambition</Label>
                  <div className="text-right">
                     <span className="text-2xl font-bold text-brand-600">+{modifiers.revenueTarget}%</span>
                     <div className="text-xs text-slate-500 font-medium">{formatCurrency(projectedRevenue)}</div>
                  </div>
               </div>
               <Slider
                  min={-20} max={150} step={5}
                  value={modifiers.revenueTarget}
                  onChange={(val) => handleSliderChange('revenueTarget', val)}
                  className="py-2"
               />
            </div>

            {/* Efficiency */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">Headcount Efficiency</Label>
                  <div className="text-right">
                     <span className={`text-xl font-bold ${modifiers.efficiency > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {modifiers.efficiency > 0 ? '+' : ''}{modifiers.efficiency}%
                     </span>
                  </div>
               </div>
               <Slider
                  min={-30} max={50} step={5}
                  value={modifiers.efficiency}
                  onChange={(val) => handleSliderChange('efficiency', val)}
                  className="py-2"
               />
            </div>

            {/* Retention Impact */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">Churn Rate Impact</Label>
                  <div className="text-right">
                     <span className={`text-xl font-bold ${modifiers.retention > 0 ? 'text-emerald-600' : modifiers.retention < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        {modifiers.retention > 0 ? '+' : ''}{modifiers.retention}%
                     </span>
                  </div>
               </div>
               <Slider
                  min={-20} max={20} step={2}
                  value={modifiers.retention}
                  onChange={(val) => handleSliderChange('retention', val)}
                  className="py-2"
               />
            </div>

            {/* Pricing Power (ACV) */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">ACV Adjustment</Label>
                  <div className="text-right">
                     <span className="text-xl font-bold text-slate-900">
                        {modifiers.acv > 0 ? '+' : ''}{modifiers.acv}%
                     </span>
                  </div>
               </div>
               <Slider
                  min={-20} max={100} step={5}
                  value={modifiers.acv}
                  onChange={(val) => handleSliderChange('acv', val)}
                  className="py-2"
               />
            </div>

            {/* Client Count Target (NEW) */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">Client Count Target</Label>
                  <div className="text-right">
                     <span className="text-xl font-bold text-slate-900">
                        {modifiers.clientCount > 0 ? '+' : ''}{modifiers.clientCount}%
                     </span>
                     <div className="text-xs text-slate-500 font-medium">{projectedClients} Clients</div>
                  </div>
               </div>
               <Slider
                  min={-20} max={150} step={5}
                  value={modifiers.clientCount}
                  onChange={(val) => handleSliderChange('clientCount', val)}
                  className="py-2"
               />
            </div>

            {/* Margin Impact */}
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-brand-200 transition-colors">
               <div className="flex justify-between items-end mb-4">
                  <Label className="mb-0 text-base font-medium text-slate-700">Margin Impact</Label>
                  <div className="text-right">
                     <span className={`text-xl font-bold ${modifiers.margin > 0 ? 'text-emerald-600' : modifiers.margin < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        {modifiers.margin > 0 ? '+' : ''}{modifiers.margin}%
                     </span>
                  </div>
               </div>
               <Slider
                  min={-20} max={20} step={2}
                  value={modifiers.margin}
                  onChange={(val) => handleSliderChange('margin', val)}
                  className="py-2"
               />
            </div>
         </div>

         {/* Actions */}
         <div className="flex justify-center border-t border-slate-100 pt-6">
            {!isRun ? (
               <Button className="w-full md:w-auto md:px-12 py-3 bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20 text-lg h-auto" onClick={onRunScenario}>
                  Run Scenario Analysis <ArrowRight className="ml-2 h-5 w-5" />
               </Button>
            ) : (
               <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                  <Button className="w-full md:w-auto bg-slate-900 text-white hover:bg-slate-800 shadow-lg" onClick={onRunScenario}>
                     Update Analysis
                  </Button>
                  <div className="flex gap-2 w-full md:w-auto">
                     <Button variant="outline" className="flex-1 md:flex-none" onClick={onSaveScenario}>
                        <Save className="h-4 w-4 mr-2" /> Save Scenario
                     </Button>
                     <Button variant="outline" className="flex-1 md:flex-none" onClick={onAddToComparison}>
                        <Plus className="h-4 w-4 mr-2" /> Compare
                     </Button>
                  </div>
                  <Button variant="ghost" className="text-slate-500 hover:text-brand-600" onClick={onSetPrimary}>
                     Set as Primary Path
                  </Button>
               </div>
            )}
         </div>
      </Card>
   );
};