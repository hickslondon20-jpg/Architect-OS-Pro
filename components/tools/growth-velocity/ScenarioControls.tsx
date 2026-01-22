import React from 'react';
import { Card, Label, Slider, Button, Badge } from '../../ui';
import { Rocket, BarChart3, TrendingUp, DollarSign } from 'lucide-react';

export interface ScenarioModifiers {
  revenueTarget: number;
  efficiency: number;
  retention: number;
  acv: number;
  margin: number;
}

interface ScenarioControlsProps {
  baselineRevenue: number;
  modifiers: ScenarioModifiers;
  onChange: (modifiers: ScenarioModifiers) => void;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  baselineRevenue,
  modifiers,
  onChange,
}) => {
  
  const handleSliderChange = (key: keyof ScenarioModifiers, value: number) => {
    onChange({ ...modifiers, [key]: value });
  };

  const applyPreset = (preset: 'steady' | 'rocket' | 'profit' | 'pivot') => {
    switch (preset) {
      case 'steady':
        onChange({ revenueTarget: 30, efficiency: 10, retention: 5, acv: 5, margin: 5 });
        break;
      case 'rocket':
        onChange({ revenueTarget: 100, efficiency: -10, retention: 0, acv: 0, margin: -10 });
        break;
      case 'profit':
        onChange({ revenueTarget: 10, efficiency: 30, retention: 10, acv: 15, margin: 15 });
        break;
      case 'pivot':
        onChange({ revenueTarget: 20, efficiency: 0, retention: -5, acv: 50, margin: 0 });
        break;
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  // Calculate projected revenue for display
  const projectedRevenue = baselineRevenue * (1 + modifiers.revenueTarget / 100);

  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
           <BarChart3 className="h-5 w-5 text-brand-600" /> Scenario Configuration
        </h3>
        <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Baseline:</span> {formatCurrency(baselineRevenue)} Revenue
        </div>
      </div>

      <div className="mb-8">
         <Label className="mb-3 text-xs uppercase text-slate-500 font-semibold tracking-wider">Quick Start Presets</Label>
         <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => applyPreset('steady')} className="text-xs h-9 justify-start">
               <TrendingUp className="h-3 w-3 mr-2 text-emerald-600" /> Steady Climb
            </Button>
            <Button variant="outline" onClick={() => applyPreset('rocket')} className="text-xs h-9 justify-start">
               <Rocket className="h-3 w-3 mr-2 text-orange-600" /> Rocket Ship
            </Button>
            <Button variant="outline" onClick={() => applyPreset('profit')} className="text-xs h-9 justify-start">
               <DollarSign className="h-3 w-3 mr-2 text-green-600" /> Profit Squeeze
            </Button>
            <Button variant="outline" onClick={() => applyPreset('pivot')} className="text-xs h-9 justify-start">
               <TrendingUp className="h-3 w-3 mr-2 text-blue-600" /> Up-Market Pivot
            </Button>
         </div>
      </div>

      <div className="space-y-8 flex-1">
         {/* Revenue Ambition */}
         <div>
            <div className="flex justify-between items-end mb-2">
               <Label className="mb-0">Revenue Ambition</Label>
               <div className="text-right">
                  <span className="text-lg font-bold text-brand-600">+{modifiers.revenueTarget}%</span>
                  <div className="text-xs text-slate-500">{formatCurrency(projectedRevenue)}</div>
               </div>
            </div>
            <Slider 
               min={-20} max={150} step={5} 
               value={modifiers.revenueTarget} 
               onChange={(val) => handleSliderChange('revenueTarget', val)} 
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
               <span>-20%</span>
               <span>+150%</span>
            </div>
         </div>

         {/* Efficiency */}
         <div>
            <div className="flex justify-between items-end mb-2">
               <Label className="mb-0">Headcount Efficiency</Label>
               <div className="text-right">
                  <span className={`text-sm font-bold ${modifiers.efficiency > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                     {modifiers.efficiency > 0 ? '+' : ''}{modifiers.efficiency}%
                  </span>
               </div>
            </div>
            <Slider 
               min={-30} max={50} step={5} 
               value={modifiers.efficiency} 
               onChange={(val) => handleSliderChange('efficiency', val)} 
            />
             <div className="flex justify-between text-xs text-slate-400 mt-1">
               <span>Less Efficient</span>
               <span>More Efficient</span>
            </div>
         </div>

         {/* Retention Impact */}
         <div>
            <div className="flex justify-between items-end mb-2">
               <Label className="mb-0">Churn Rate Impact</Label>
               <div className="text-right">
                  <span className={`text-sm font-bold ${modifiers.retention > 0 ? 'text-emerald-600' : modifiers.retention < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                     {modifiers.retention > 0 ? '+' : ''}{modifiers.retention}%
                  </span>
               </div>
            </div>
            <Slider 
               min={-20} max={20} step={2} 
               value={modifiers.retention} 
               onChange={(val) => handleSliderChange('retention', val)} 
            />
         </div>

         {/* Pricing Power (ACV) */}
         <div>
            <div className="flex justify-between items-end mb-2">
               <Label className="mb-0">ACV Adjustment</Label>
               <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                     {modifiers.acv > 0 ? '+' : ''}{modifiers.acv}%
                  </span>
               </div>
            </div>
            <Slider 
               min={-20} max={100} step={5} 
               value={modifiers.acv} 
               onChange={(val) => handleSliderChange('acv', val)} 
            />
         </div>
      </div>
    </Card>
  );
};