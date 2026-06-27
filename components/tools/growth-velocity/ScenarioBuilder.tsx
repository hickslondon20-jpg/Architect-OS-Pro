import React, { useState } from 'react';
import { RealTimeImpact } from './RealTimeImpact';
import { ScenarioControls, ScenarioModifiers } from './ScenarioControls';
import { ComparisonView } from './ComparisonView';

export const ScenarioBuilder: React.FC = () => {
   // Mock Baseline Data
   const baselineData = {
      revenue: 2500000,
      team: 12,
      margin: 0.20,
      clients: 45,
      retention: 85 // 85% retention, 15% churn
   };

   // Derived Baseline ACV
   const baselineACV = baselineData.revenue / baselineData.clients;

   // Initial State
   const [modifiers, setModifiers] = useState<ScenarioModifiers>({
      revenueTarget: 30, // +30%
      efficiency: 10,    // +10%
      retention: 5,      // +5% (e.g. 85 -> 90)
      acv: 5,           // +5%
      margin: 5,         // +5% (e.g. 20 -> 25)
      clientCount: 23,   // Derived initially based on Rev=30, ACV=5 -> (1.3/1.05)-1 = ~23%
      timeframe: 12      // 12 months default
   });

   const [isRun, setIsRun] = useState(false);
   const [velocityIndex, setVelocityIndex] = useState<number | null>(null);

   const handleRunScenario = () => {
      // simple mock calculation for Velocity Index
      // In real app, this would trigger the 32+ backend calcs.
      // Score = 100 - Penalties.
      // Penalty for high growth (+30% rev -> -10 pts)
      // Penalty for hiring (+5 staff -> -10 pts)
      const growthPenalty = Math.max(0, modifiers.revenueTarget * 0.5);
      const hiringPenalty = Math.max(0, (modifiers.revenueTarget - modifiers.efficiency) * 0.5);
      const score = Math.max(0, Math.min(100, 100 - (growthPenalty * 0.2) - (hiringPenalty * 0.5)));

      setVelocityIndex(Math.round(score));
      setIsRun(true);
   };

   const handleSaveScenario = () => {
      console.log("Saving scenario:", modifiers);
      // Todo: database call
   };

   const handleSetPrimary = () => {
      console.log("Setting as primary:", modifiers);
   };

   const handleAddToComparison = () => {
      console.log("Adding to comparison:", modifiers);
   };

   const handleModifierChange = (newModifiers: ScenarioModifiers) => {
      setModifiers(newModifiers);
      // Note: We do NOT reset isRun here, allowing "Re-Run" button to persist
   };

   return (
      <div className="space-y-8 pb-12">
         {/* Section 1: Scenario Configuration (Full Width) */}
         <section className="w-full">
            <ScenarioControls
               baselineRevenue={baselineData.revenue}
               baselineACV={baselineACV}
               baselineClientCount={baselineData.clients}
               modifiers={modifiers}
               isRun={isRun}
               onChange={handleModifierChange}
               onRunScenario={handleRunScenario}
               onSaveScenario={handleSaveScenario}
               onSetPrimary={handleSetPrimary}
               onAddToComparison={handleAddToComparison}
            />
         </section>

         {/* Section 2: Real-Time Impact (Full Width) */}
         <section className="w-full">
            <RealTimeImpact
               baselineRevenue={baselineData.revenue}
               baselineTeam={baselineData.team}
               baselineClientCount={baselineData.clients}
               modifiers={modifiers}
               velocityIndex={velocityIndex}
               isRun={isRun}
            />
         </section>

         {/* Section 3: Deep Analysis & Comparison (Full Width) */}
         <section className="w-full">
            <ComparisonView
               baselineData={{
                  revenue: baselineData.revenue,
                  team: baselineData.team,
                  clients: baselineData.clients,
                  retention: baselineData.retention / 100,
                  margin: baselineData.margin,
                  acv: baselineACV
               }}
               modifiers={modifiers}
            />
         </section>
      </div>
   );
};