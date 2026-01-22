import React, { useState } from 'react';
import { ScenarioControls, ScenarioModifiers } from './ScenarioControls';
import { RealTimeImpact } from './RealTimeImpact';
import { ComparisonView } from './ComparisonView';

export const ScenarioBuilder: React.FC = () => {
  // Local state for the scenario modeling
  // In a real app, this might initialize from the "Standard Calculator" result
  const [modifiers, setModifiers] = useState<ScenarioModifiers>({
    revenueTarget: 30, // % growth target
    efficiency: 0,     // % efficiency gain
    retention: 0,      // % retention improvement
    acv: 0,            // % ACV increase
    margin: 0          // % margin expansion
  });

  // Mock baseline data (would come from Snapshot/Tab 1)
  const baselineData = {
    revenue: 2000000,
    teamSize: 10,
    clientCount: 40,
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top: Heads-Up Display */}
      <section>
         <RealTimeImpact 
            baselineRevenue={baselineData.revenue} 
            baselineTeam={baselineData.teamSize} 
            modifiers={modifiers} 
         />
      </section>

      {/* Main Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
         
         {/* Left: Controls */}
         <div className="lg:col-span-4 xl:col-span-3">
            <ScenarioControls 
               baselineRevenue={baselineData.revenue} 
               modifiers={modifiers} 
               onChange={setModifiers} 
            />
         </div>

         {/* Right: Visualization & Deep Dive */}
         <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <ComparisonView 
               baselineRevenue={baselineData.revenue} 
               modifiers={modifiers} 
            />
         </div>
      </section>
    </div>
  );
};