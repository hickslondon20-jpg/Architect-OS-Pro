import React, { useState } from 'react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Button } from '../../ui';
import { ScenarioModifiers } from './ScenarioControls';
import { Check, X } from 'lucide-react';

interface ComparisonViewProps {
  baselineRevenue: number;
  modifiers: ScenarioModifiers;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ baselineRevenue, modifiers }) => {
  // Mock Saved Scenarios
  const savedScenarios = [
     { id: '1', name: 'Conservative', revenueTarget: 15, margin: 25 },
     { id: '2', name: 'Moonshot', revenueTarget: 80, margin: 10 },
  ];

  const targetRevenue = baselineRevenue * (1 + modifiers.revenueTarget / 100);
  const baselineProfit = baselineRevenue * 0.2;
  const targetProfit = targetRevenue * 0.25; // simplified

  // Simple CSS Chart components since we can't use Recharts
  const SimpleBar = ({ height, color, label, value }: any) => (
    <div className="flex flex-col items-center gap-2 group">
       <span className="text-xs font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{value}</span>
       <div className={`w-12 rounded-t-sm transition-all duration-500 ${color}`} style={{ height }} />
       <span className="text-xs text-slate-500 font-medium">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Scenario Analysis</h3>
          <div className="flex gap-2">
             <Button variant="outline" className="px-3 py-1 text-xs">Save Scenario</Button>
          </div>
       </div>

       <Tabs defaultValue="visual">
          <div className="flex justify-between items-center mb-6">
             <TabsList>
                <TabsTrigger value="visual">Visual Analysis</TabsTrigger>
                <TabsTrigger value="grid">Data Grid</TabsTrigger>
             </TabsList>
          </div>

          <TabsContent value="visual" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue & Profit Chart */}
                <Card className="p-6">
                   <h4 className="text-sm font-semibold text-slate-900 mb-6">Revenue & Profit Impact</h4>
                   <div className="h-64 flex items-end justify-center gap-8 border-b border-slate-100 pb-2">
                      <div className="flex gap-1 items-end">
                         <SimpleBar height="40%" color="bg-slate-300" label="Base Rev" value="$2M" />
                         <SimpleBar height="15%" color="bg-slate-400" label="Base Profit" value="$400k" />
                      </div>
                      
                      <div className="flex gap-1 items-end relative">
                         {/* Dynamic Heights */}
                         <SimpleBar 
                            height={`${Math.min(100, 40 * (1 + modifiers.revenueTarget/100))}%`} 
                            color="bg-brand-600" 
                            label="Target Rev" 
                            value={`$${(targetRevenue/1000000).toFixed(1)}M`} 
                         />
                         <SimpleBar 
                            height={`${Math.min(100, 15 * (1 + modifiers.revenueTarget/100) * (1 + modifiers.margin/100))}%`} 
                            color="bg-emerald-500" 
                            label="Target Profit" 
                            value={`$${(targetProfit/1000000).toFixed(2)}M`} 
                         />
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                            <Badge color="blue">Active</Badge>
                         </div>
                      </div>

                      {savedScenarios.map(s => (
                         <div key={s.id} className="flex gap-1 items-end opacity-50">
                            <SimpleBar height={`${40 * (1 + s.revenueTarget/100)}%`} color="bg-slate-300" label={s.name} value="" />
                         </div>
                      ))}
                   </div>
                </Card>

                {/* Treadmill Chart (Mock) */}
                <Card className="p-6">
                   <h4 className="text-sm font-semibold text-slate-900 mb-6">The "Treadmill" (Churn vs. Net Growth)</h4>
                   <div className="h-64 flex flex-col justify-center items-center text-center p-8 bg-slate-50 rounded border border-dashed border-slate-200">
                      <p className="text-slate-500 text-sm mb-2">Churn Replacement Load</p>
                      <div className="w-full max-w-xs h-8 bg-slate-200 rounded-full overflow-hidden flex mb-2">
                         <div className="bg-red-400 h-full" style={{ width: `${Math.max(10, 30 - modifiers.retention)}%` }} title="Churn Replacement" />
                         <div className="bg-emerald-500 h-full flex-1" title="Net Growth" />
                      </div>
                      <div className="flex justify-between w-full max-w-xs text-xs text-slate-500 px-1">
                         <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-400 rounded-full" /> Churn</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Net Growth</span>
                      </div>
                   </div>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="grid">
             <Card className="overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                         <th className="px-6 py-3">Metric</th>
                         <th className="px-6 py-3">Baseline</th>
                         <th className="px-6 py-3 bg-blue-50/50 text-brand-700 border-x border-blue-100">Active Scenario</th>
                         {savedScenarios.map(s => <th key={s.id} className="px-6 py-3">{s.name}</th>)}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      <tr>
                         <td className="px-6 py-4 font-medium text-slate-900">Revenue</td>
                         <td className="px-6 py-4 text-slate-500">$2.0M</td>
                         <td className="px-6 py-4 font-bold text-brand-700 bg-blue-50/30 border-x border-blue-50">
                            ${(targetRevenue/1000000).toFixed(2)}M
                         </td>
                         {savedScenarios.map(s => (
                            <td key={s.id} className="px-6 py-4 text-slate-500">
                               ${(2 * (1 + s.revenueTarget/100)).toFixed(1)}M
                            </td>
                         ))}
                      </tr>
                      <tr>
                         <td className="px-6 py-4 font-medium text-slate-900">Profit Margin</td>
                         <td className="px-6 py-4 text-slate-500">20%</td>
                         <td className="px-6 py-4 font-bold text-brand-700 bg-blue-50/30 border-x border-blue-50">
                            {(20 + modifiers.margin).toFixed(0)}%
                         </td>
                         {savedScenarios.map(s => (
                            <td key={s.id} className="px-6 py-4 text-slate-500">{s.margin}%</td>
                         ))}
                      </tr>
                   </tbody>
                </table>
             </Card>
          </TabsContent>
       </Tabs>
    </div>
  );
};