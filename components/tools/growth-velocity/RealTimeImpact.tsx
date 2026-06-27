import React from 'react';
import { Card } from '../../ui';
import { Activity, Users, DollarSign, TrendingUp, BarChart3, PieChart, Target, AlertCircle } from 'lucide-react';
import { ScenarioModifiers } from './ScenarioControls';

interface RealTimeImpactProps {
   baselineRevenue: number;
   baselineTeam: number;
   baselineClientCount?: number;
   modifiers: ScenarioModifiers;
   velocityIndex?: number | null;
   isRun?: boolean;
}

export const RealTimeImpact: React.FC<RealTimeImpactProps> = ({
   baselineRevenue,
   baselineTeam,
   baselineClientCount = 50, // Default if not provided
   modifiers,
   velocityIndex = null,
   isRun = false
}) => {

   // --- Calculations ---

   // 1. Revenue
   const targetRevenue = baselineRevenue * (1 + modifiers.revenueTarget / 100);

   // 2. Efficiency (Revenue per Head)
   // Positive efficiency adds to capacity without adding heads
   const baseEfficiency = baselineRevenue / (baselineTeam || 1);
   const adjustedEfficiency = baseEfficiency * (1 + modifiers.efficiency / 100);
   const impliedTeamSize = Math.ceil(targetRevenue / adjustedEfficiency);
   const teamGrowth = impliedTeamSize - baselineTeam;

   // 3. Profit
   const baseMargin = 0.20;
   const targetMargin = Math.max(0.05, Math.min(0.60, baseMargin + (modifiers.margin / 100)));
   const profitPool = targetRevenue * targetMargin;
   const baselineProfit = baselineRevenue * baseMargin;

   // 4. ACV
   const baseACV = baselineRevenue / baselineClientCount;
   const targetACV = baseACV * (1 + modifiers.acv / 100);

   // 5. Client Count
   // Derived from Revenue / ACV
   // OR driven by clientCount modifier if we treat it as an input?
   // In ScenarioControls, we coupled them. Here we can use the modifier directly for display consistency.
   // baselineClientCount * (1 + modifiers.clientCount / 100) should match targetRevenue / targetACV roughly.
   const targetClientCount = Math.round(baselineClientCount * (1 + modifiers.clientCount / 100));
   const clientGrowth = targetClientCount - baselineClientCount;

   // 6. Sales Velocity
   // Churn calculation
   const baseChurnRate = 0.15; // 15% default annual churn
   const adjustedChurnRate = Math.max(0.02, baseChurnRate - (modifiers.retention / 100));
   const churnReplacementDollars = baselineRevenue * adjustedChurnRate;
   const netNewNeeded = Math.max(0, targetRevenue - baselineRevenue) + churnReplacementDollars;
   const dealsNeeded = Math.ceil(netNewNeeded / targetACV);
   const monthlyDeals = (dealsNeeded / (modifiers.timeframe || 12)).toFixed(1); // Use timeframe modifier

   // Helpers
   const formatMoney = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      return `$${(val / 1000).toFixed(0)}k`;
   };

   const formatNumber = (val: number) => {
      // 1k formatting
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return val.toString();
   };

   const getStatus = (val: number, thresholdWarn: number, thresholdDanger: number, reverse = false) => {
      if (!reverse) {
         if (val > thresholdDanger) return 'danger';
         if (val > thresholdWarn) return 'warning';
         return 'good';
      } else {
         if (val < thresholdDanger) return 'danger';
         if (val < thresholdWarn) return 'warning';
         return 'good';
      }
   };

   const hiringStatus = getStatus(teamGrowth, 5, 10);
   const salesStatus = getStatus(Number(monthlyDeals), 3, 5);
   const profitStatus = getStatus(targetMargin * 100, 15, 10, true);

   // Component for Cards
   const ImpactCard = ({ title, mainValue, subDetail, status, icon: Icon, delay }: any) => {
      let borderClass = 'border-slate-200';
      let bgClass = 'bg-white';
      let textClass = 'text-slate-900';
      let iconClass = 'text-slate-400';

      if (status === 'warning') {
         borderClass = 'border-orange-200';
         bgClass = 'bg-orange-50/50';
         textClass = 'text-orange-900';
         iconClass = 'text-orange-500';
      } else if (status === 'danger') {
         borderClass = 'border-red-200';
         bgClass = 'bg-red-50/50';
         textClass = 'text-red-900';
         iconClass = 'text-red-500';
      } else if (status === 'good') {
         borderClass = 'border-emerald-200';
         bgClass = 'bg-emerald-50/50';
         iconClass = 'text-emerald-500';
      }

      return (
         <Card className={`p-4 ${borderClass} ${bgClass} shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-32`}>
            <div className="flex justify-between items-start">
               <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
               <Icon className={`h-4 w-4 ${iconClass}`} />
            </div>
            <div>
               <div className={`text-2xl font-bold ${textClass} tracking-tight`}>{mainValue}</div>
               <div className="text-xs text-slate-500 font-medium mt-1">{subDetail}</div>
            </div>
         </Card>
      );
   };

   return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

         {/* Left Side: 6 Metric Cards */}
         <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Row 1 */}
            <ImpactCard
               title="Target Revenue"
               mainValue={formatMoney(targetRevenue)}
               subDetail={`+${modifiers.revenueTarget}% Growth`}
               icon={TrendingUp}
               status="good"
            />
            <ImpactCard
               title="Team Size"
               mainValue={`${impliedTeamSize} FTEs`}
               subDetail={`${teamGrowth >= 0 ? '+' : ''}${teamGrowth} New Hires`}
               icon={Users}
               status={hiringStatus}
            />
            <ImpactCard
               title="Profit Pool"
               mainValue={formatMoney(profitPool)}
               subDetail={`${(targetMargin * 100).toFixed(1)}% Margin`}
               icon={DollarSign}
               status={profitStatus}
            />

            {/* Row 2 */}
            <ImpactCard
               title="Target ACV"
               mainValue={formatMoney(targetACV)}
               subDetail={`${modifiers.acv >= 0 ? '+' : ''}${modifiers.acv}% vs Base`}
               icon={BarChart3}
               status={modifiers.acv > 50 ? 'warning' : 'good'}
            />
            <ImpactCard
               title="Client Count"
               mainValue={`${targetClientCount}`}
               subDetail={`${clientGrowth >= 0 ? '+' : ''}${clientGrowth} Clients`}
               icon={Users}
               status={clientGrowth > 50 ? 'warning' : 'good'}
            />
            <ImpactCard
               title="Sales Velocity"
               mainValue={`${monthlyDeals}/mo`}
               subDetail={`Deals per month`}
               icon={Activity}
               status={salesStatus}
            />
         </div>

         {/* Right Side: Velocity Index Score */}
         <div className="lg:col-span-1 h-full">
            <Card className={`h-full border-2 ${isRun ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-slate-50'} flex flex-col items-center justify-center text-center p-6 transition-all duration-500 relative overflow-hidden`}>

               {!isRun ? (
                  <>
                     <Target className="h-12 w-12 text-slate-300 mb-4" />
                     <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Velocity Index</div>
                     <div className="text-xs text-slate-400 mt-2 px-4">Run scenario to calculate viability score</div>
                  </>
               ) : (
                  <>
                     <div className="absolute top-0 left-0 w-full h-1 bg-brand-600"></div>
                     <div className="text-sm font-bold text-brand-700 uppercase tracking-widest mb-2">Velocity Index</div>
                     <div className="text-6xl font-black text-slate-900 tracking-tighter mb-2">
                        {velocityIndex}
                     </div>
                     <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white/50 px-3 py-1 rounded-full border border-brand-100">
                        {velocityIndex && velocityIndex > 80 ? 'High Viability' : velocityIndex && velocityIndex > 50 ? 'Moderate Risk' : 'High Risk'}
                     </div>
                  </>
               )}
            </Card>
         </div>

      </div>
   );
};