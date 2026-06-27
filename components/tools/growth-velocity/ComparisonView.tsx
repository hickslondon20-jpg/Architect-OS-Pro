import React, { useState, useMemo } from 'react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../ui';
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
   LineChart, Line, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import { ScenarioModifiers } from './ScenarioControls';
import { SavedScenarioSelector, SavedScenario } from './SavedScenarioSelector';
import { PressureDashboard, ComparisonScenario } from './PressureDashboard';
import { runGrowthSimulation } from '../../../lib/growthCalculations';
import { TrendingUp, Users, Target, Activity, Circle } from 'lucide-react';

interface ComparisonViewProps {
   baselineData: {
      revenue: number;
      team: number;
      clients: number;
      retention: number;
      margin: number;
      acv?: number;
   };
   modifiers: ScenarioModifiers; // Active scenario modifiers
}

// Mock Saved Scenarios (Move to context/db later)
const MOCK_SAVED_SCENARIOS: SavedScenario[] = [
   { id: '1', name: 'Steady Climb', date: 'Jan 15' },
   { id: '2', name: 'Rocket Ship', date: 'Jan 12' },
   { id: '3', name: 'Conservative Path', date: 'Jan 10' }
];

// Mock modifiers for saved scenarios (since we don't have DB yet)
const MOCK_SAVED_MODIFIERS: Record<string, ScenarioModifiers> = {
   '1': { revenueTarget: 20, efficiency: 5, retention: 2, acv: 5, margin: 2, clientCount: 15, timeframe: 18 },
   '2': { revenueTarget: 60, efficiency: -10, retention: 0, acv: 0, margin: -5, clientCount: 60, timeframe: 24 },
   '3': { revenueTarget: 10, efficiency: 10, retention: 5, acv: 0, margin: 5, clientCount: 10, timeframe: 12 }
};

// --- Custom Legend Component ---
const ChartLegend = ({ items }: { items: { label: string; color: string; type?: 'line' | 'rect' | 'circle' }[] }) => (
   <div className="flex flex-wrap items-center gap-4 mb-2 text-xs text-slate-600">
      {items.map((item, i) => (
         <div key={i} className="flex items-center gap-1.5">
            <span
               className="inline-block"
               style={{
                  width: item.type === 'line' ? 12 : 8,
                  height: item.type === 'line' ? 2 : 8,
                  backgroundColor: item.color,
                  borderRadius: item.type === 'line' ? 0 : '2px'
               }}
            />
            <span>{item.label}</span>
         </div>
      ))}
   </div>
);

export const ComparisonView: React.FC<ComparisonViewProps> = ({ baselineData, modifiers }) => {
   const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>(['1']);
   const [activeTab, setActiveTab] = useState('visual');

   const handleToggleScenario = (id: string) => {
      setSelectedScenarioIds(prev =>
         prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 3)
      );
   };

   // --- Simulation Engine ---
   const comparisonData: ComparisonScenario[] = useMemo(() => {
      const baselineMods: ScenarioModifiers = { revenueTarget: 0, efficiency: 0, retention: 0, acv: 0, margin: 0, clientCount: 0, timeframe: 12 };
      const baselineResult = runGrowthSimulation(baselineData, baselineMods);
      const activeResult = runGrowthSimulation(baselineData, modifiers);
      const savedResults = selectedScenarioIds.map(id => {
         const mods = MOCK_SAVED_MODIFIERS[id] || baselineMods;
         const result = runGrowthSimulation(baselineData, mods);
         const name = MOCK_SAVED_SCENARIOS.find(s => s.id === id)?.name || 'Unknown';
         return { id, name, isBaseline: false, result, mods };
      });

      return [
         { id: 'baseline', name: 'Baseline', isBaseline: true, result: baselineResult, mods: baselineMods },
         { id: 'active', name: 'Active Scenario', isBaseline: false, result: activeResult, mods: modifiers },
         ...savedResults
      ];
   }, [baselineData, modifiers, selectedScenarioIds]);

   // --- Generators ---
   const trajectoryData = useMemo(() => {
      const maxMonths = Math.max(...comparisonData.map(s => (s as any).mods?.timeframe || 12), 36);
      const data = [];
      for (let m = 0; m <= maxMonths; m++) {
         const point: any = { month: m };
         comparisonData.forEach(s => {
            const tf = (s as any).mods?.timeframe || 12;
            const startVal = baselineData.revenue;
            const endVal = s.result?.metrics.targetRevenue || startVal;
            if (m <= tf) point[s.name] = startVal + (endVal - startVal) * (m / tf);
            else point[s.name] = endVal;
         });
         data.push(point);
      }
      return data;
   }, [comparisonData, baselineData.revenue]);

   const scatterData = comparisonData.map(s => ({
      name: s.name,
      growth: ((s.result?.metrics.targetRevenue || baselineData.revenue) - baselineData.revenue) / baselineData.revenue * 100,
      margin: (s.result?.metrics.targetMargin || 0) * 100,
      fill: s.id === 'active' ? '#0f172a' : s.isBaseline ? '#94a3b8' : '#3b82f6',
      radius: s.id === 'active' ? 8 : 6
   }));

   const hiringPulseData = comparisonData.filter(s => !s.isBaseline).map(s => ({
      name: s.name.split('(')[0], // Simplified Name
      'Avg Hires/Qtr': s.result?.metrics.hiringPace || 0
   }));

   const bridgeData = comparisonData.filter(s => !s.isBaseline).map(s => {
      const totalRev = s.result?.metrics.targetRevenue || 0;
      const tfYears = ((s as any).mods?.timeframe || 12) / 12;
      const retentionRate = (baselineData.retention || 85) / 100 + ((s as any).mods?.retention || 0) / 100;
      const churnRate = Math.max(0, 1 - retentionRate);
      const churnVol = baselineData.revenue * churnRate * tfYears;
      const netRef = Math.max(0, totalRev - baselineData.revenue);

      return {
         name: s.name.split('(')[0],
         'Retained Revenue': baselineData.revenue,
         'Churn Replacement': churnVol,
         'Net Growth': netRef
      };
   });

   const formatMoney = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
   const formatNum = (val: number) => val.toLocaleString();

   // Palette for consistent colors
   const COLORS = {
      active: '#0f172a',
      baseline: '#94a3b8',
      saved: ['#3b82f6', '#8b5cf6', '#f59e0b']
   };

   const getScenarioColor = (id: string, index: number) => {
      if (id === 'active') return COLORS.active;
      if (id === 'baseline') return COLORS.baseline;
      return COLORS.saved[(index - 2) % 3] || COLORS.saved[0]; // -2 because baseline+active are first
   };

   // Legend Data Builders
   const trajectoryLegend = comparisonData.map((s, i) => ({
      label: s.name, color: getScenarioColor(s.id, i), type: 'line' as const
   }));

   const bridgeLegend = [
      { label: 'Retained Revenue', color: '#e2e8f0', type: 'rect' as const },
      { label: 'Churn Replacement', color: '#f87171', type: 'rect' as const },
      { label: 'Net Growth', color: '#22c55e', type: 'rect' as const },
   ];

   return (
      <div className="space-y-6">
         {/* Selector */}
         <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
               <span className="text-sm font-semibold text-slate-700">Compare:</span>
               <SavedScenarioSelector
                  scenarios={MOCK_SAVED_SCENARIOS}
                  selectedIds={selectedScenarioIds}
                  onToggleScenario={handleToggleScenario}
               />
            </div>
            <Button size="sm" onClick={() => setActiveTab('visual')}>Update Views</Button>
         </div>

         <Card className="p-6 bg-white border-slate-200 shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
               <TabsList className="grid w-[400px] grid-cols-2 mb-8">
                  <TabsTrigger value="visual">Visual Analysis</TabsTrigger>
                  <TabsTrigger value="grid">Data Grid</TabsTrigger>
               </TabsList>

               <TabsContent value="visual" className="space-y-16">

                  {/* Top Row: Strategic Trajectory & Tradeoffs */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                     {/* Chart 1: Trajectory */}
                     <div className="h-[450px] flex flex-col">
                        <div className="mb-6">
                           <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-5 w-5 text-brand-600" />
                              <h4 className="text-base font-bold text-slate-900">Revenue Trajectory (The Climb)</h4>
                           </div>
                           <p className="text-sm text-slate-500">Projected growth path over time. Steeper slopes require higher velocity.</p>
                        </div>

                        <ChartLegend items={trajectoryLegend} />

                        <div className="flex-1 min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={trajectoryData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                 <XAxis dataKey="month" label={{ value: 'Months', position: 'insideBottomRight', offset: -10 }} fontSize={12} stroke="#94a3b8" dy={10} />
                                 <YAxis tickFormatter={formatMoney} fontSize={12} stroke="#94a3b8" width={60} />
                                 <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                 {comparisonData.map((s, i) => (
                                    <Line
                                       key={s.id}
                                       type="monotone"
                                       dataKey={s.name}
                                       stroke={getScenarioColor(s.id, i)}
                                       activeDot={{ r: 6 }}
                                       strokeWidth={s.id === 'active' ? 3 : 2}
                                       strokeDasharray={s.id === 'baseline' ? "5 5" : ""}
                                       dot={false}
                                    />
                                 ))}
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     {/* Chart 2: Efficiency Map */}
                     <div className="h-[450px] flex flex-col">
                        <div className="mb-6">
                           <div className="flex items-center gap-2 mb-2">
                              <Target className="h-5 w-5 text-brand-600" />
                              <h4 className="text-base font-bold text-slate-900">Efficiency Map (Growth vs. Margin)</h4>
                           </div>
                           <p className="text-sm text-slate-500">Strategic positioning. Right-Up is ideal (Unicorn). Right-Down is 'Burn to Grow'.</p>
                        </div>

                        <ChartLegend items={[{ label: 'Scenario Positioning', color: '#8884d8', type: 'circle' }]} />

                        <div className="flex-1 min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                                 <CartesianGrid />
                                 <XAxis type="number" dataKey="growth" name="Revenue Growth" unit="%" label={{ value: 'Revenue Growth (%)', position: 'insideBottom', offset: -30, fill: '#64748b' }} />
                                 <YAxis type="number" dataKey="margin" name="Profit Margin" unit="%" label={{ value: 'Profit Margin (%)', angle: -90, position: 'insideLeft', offset: 0, fill: '#64748b' }} width={60} />
                                 <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px' }} />

                                 <ReferenceLine x={0} stroke="#cbd5e1" />
                                 <ReferenceLine y={baselineData.margin * 100} stroke="#cbd5e1" label={{ value: "Base Margin", position: 'insideTopLeft', fill: '#94a3b8', fontSize: 12 }} strokeDasharray="3 3" />

                                 <Scatter name="Scenarios" data={scatterData} fill="#8884d8" />
                              </ScatterChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>

                  {/* Bottom Row: Operational & Source Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                     {/* Chart 3: Hiring Pulse */}
                     <div className="h-[400px] flex flex-col">
                        <div className="mb-6">
                           <div className="flex items-center gap-2 mb-2">
                              <Users className="h-5 w-5 text-brand-600" />
                              <h4 className="text-base font-bold text-slate-900">Operational Pulse (Hiring Intensity)</h4>
                           </div>
                           <p className="text-sm text-slate-500">Average net new hires required <strong>per quarter</strong> to sustain growth.</p>
                        </div>

                        <div className="flex-1 min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={hiringPulseData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                 <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} />
                                 <YAxis fontSize={12} stroke="#94a3b8" width={40} />
                                 <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px' }} />
                                 <Bar dataKey="Avg Hires/Qtr" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={50} />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     {/* Chart 4: Growth Bridge */}
                     <div className="h-[400px] flex flex-col">
                        <div className="mb-6">
                           <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-5 w-5 text-brand-600" />
                              <h4 className="text-base font-bold text-slate-900">Growth Bridge (The Treadmill)</h4>
                           </div>
                           <p className="text-sm text-slate-500">Breakdown of revenue composition. Red is replacing churn (maintenance).</p>
                        </div>

                        <ChartLegend items={bridgeLegend} />

                        <div className="flex-1 min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={bridgeData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                 <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} />
                                 <YAxis tickFormatter={formatMoney} fontSize={12} width={60} stroke="#94a3b8" />
                                 <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: '8px' }} />

                                 <Bar dataKey="Retained Revenue" stackId="a" fill="#e2e8f0" radius={[0, 0, 4, 4]} />
                                 <Bar dataKey="Churn Replacement" stackId="a" fill="#f87171" />
                                 <Bar dataKey="Net Growth" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />

                                 <ReferenceLine y={baselineData.revenue} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Baseline", position: 'right', fill: '#94a3b8', fontSize: 11 }} />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>

               </TabsContent>

               <TabsContent value="grid">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="w-[200px]">Metric</TableHead>
                           {comparisonData.map(s => (
                              <TableHead key={s.id} className={s.id === 'active' ? 'bg-blue-50 text-blue-900' : ''}>
                                 {s.name}
                                 {s.id === 'active' && <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100">Primary</Badge>}
                              </TableHead>
                           ))}
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        <TableRow>
                           <TableCell className="font-medium">Timeframe</TableCell>
                           {comparisonData.map(s => {
                              const months = (s.id === 'active' ? modifiers.timeframe :
                                 s.id === 'baseline' ? 0 :
                                    (s as any).mods?.timeframe || 12);
                              return (
                                 <TableCell key={s.id} className={s.id === 'active' ? 'bg-blue-50/50' : ''}>
                                    {s.id === 'baseline' ? '--' : `${months} Months`}
                                 </TableCell>
                              );
                           })}
                        </TableRow>

                        {[
                           { label: 'Revenue (AGI)', fmt: formatMoney, key: 'targetRevenue' },
                           { label: 'Profit Pool ($)', fmt: formatMoney, key: 'targetProfit' },
                           { label: 'Margin (%)', fmt: (v: number) => (v * 100).toFixed(1) + '%', key: 'targetMargin' },
                           { label: 'Team Size (FTEs)', fmt: formatNum, key: 'targetTeamSize' },
                           { label: 'Client Count', fmt: formatNum, key: (r: any) => Math.ceil(r.targetRevenue / r.targetACV) },
                           { label: 'Target ACV', fmt: (v: number) => `$${(v / 1000).toFixed(1)}k`, key: 'targetACV' },
                           { label: 'Net New Clients', fmt: formatNum, key: 'netNewClients' },
                           { label: 'Sales Velocity (mo)', fmt: (v: number) => v.toFixed(1), key: 'monthlyVelocity' },
                           { label: 'Velocity Multiplier', fmt: (v: number) => v.toFixed(1) + 'x', key: 'velocityMultiplier' },
                           { label: 'Hiring Pace (/qtr)', fmt: (v: number) => v.toFixed(1), key: 'hiringPace' }
                        ].map((row, i) => (
                           <TableRow key={i}>
                              <TableCell className="font-medium">{row.label}</TableCell>
                              {comparisonData.map(s => {
                                 const val = typeof row.key === 'function' ? row.key(s.result?.metrics) : (s.result?.metrics as any)?.[row.key];
                                 return (
                                    <TableCell key={s.id} className={s.id === 'active' ? 'bg-blue-50/50' : ''}>
                                       {val !== undefined ? row.fmt(val) : '--'}
                                    </TableCell>
                                 );
                              })}
                           </TableRow>
                        ))}

                        <TableRow>
                           <TableCell className="font-medium">Action</TableCell>
                           {comparisonData.map(s => (
                              <TableCell key={s.id} className={s.id === 'active' ? 'bg-blue-50/50' : ''}>
                                 {!s.isBaseline && s.id !== 'active' && (
                                    <Button variant="ghost" size="sm" className="text-xs text-brand-600 hover:bg-brand-50">Set Primary</Button>
                                 )}
                              </TableCell>
                           ))}
                        </TableRow>
                     </TableBody>
                  </Table>
               </TabsContent>
            </Tabs>
         </Card>

         <PressureDashboard scenarios={comparisonData} />
      </div>
   );
};