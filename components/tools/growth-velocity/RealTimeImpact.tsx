import React from 'react';
import { Card, Badge } from '../../ui';
import { Activity, Users, DollarSign, TrendingUp, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ScenarioModifiers } from './ScenarioControls';

interface RealTimeImpactProps {
  baselineRevenue: number;
  baselineTeam: number;
  modifiers: ScenarioModifiers;
}

export const RealTimeImpact: React.FC<RealTimeImpactProps> = ({
  baselineRevenue,
  baselineTeam,
  modifiers,
}) => {

  // Calculations
  const targetRevenue = baselineRevenue * (1 + modifiers.revenueTarget / 100);
  
  // Efficiency impact: Positive efficiency means we need FEWER people for same revenue
  // Base efficiency = Revenue / Team
  const baseEfficiency = baselineRevenue / (baselineTeam || 1);
  const adjustedEfficiency = baseEfficiency * (1 + modifiers.efficiency / 100);
  
  // Implied Team Size
  const impliedTeamSize = Math.ceil(targetRevenue / adjustedEfficiency);
  const teamGrowth = impliedTeamSize - baselineTeam;
  
  // Profit (Simple Model)
  // Assume baseline 20% margin. 
  // Margin modifier adds directly to percentage points.
  const baseMargin = 0.20; 
  const targetMargin = Math.max(0.05, Math.min(0.60, baseMargin + (modifiers.margin / 100)));
  const profitPool = targetRevenue * targetMargin;

  // Sales Velocity (Deals needed)
  // Assume baseline ACV = $50k. 
  const baseACV = 50000;
  const targetACV = baseACV * (1 + modifiers.acv / 100);
  // Net new revenue needed = (Target - Baseline) + Churn Replacement
  // Assume baseline churn 10%, retention modifier reduces churn
  const baseChurnRate = 0.10;
  const adjustedChurnRate = Math.max(0.02, baseChurnRate - (modifiers.retention / 100));
  const churnReplacementDollars = baselineRevenue * adjustedChurnRate;
  const netNewNeeded = Math.max(0, targetRevenue - baselineRevenue) + churnReplacementDollars;
  const dealsNeeded = Math.ceil(netNewNeeded / targetACV);
  const monthlyDeals = (dealsNeeded / 12).toFixed(1);

  // Helper for currency
  const formatMoney = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return `$${(val / 1000).toFixed(0)}k`;
  };

  // Helper for Status
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

  // Determine statuses
  const hiringStatus = getStatus(teamGrowth, 5, 10); // >5 hires warning, >10 danger
  const salesStatus = getStatus(Number(monthlyDeals), 3, 5); // >3 deals/mo warning
  const profitStatus = getStatus(targetMargin * 100, 15, 10, true); // <15% warning, <10% danger

  const ImpactCard = ({ title, value, subtext, status, icon: Icon }: any) => {
     let borderClass = 'border-slate-200';
     let bgClass = 'bg-white';
     let textClass = 'text-slate-900';
     let iconClass = 'text-slate-400';

     if (status === 'warning') {
        borderClass = 'border-orange-200';
        bgClass = 'bg-orange-50';
        textClass = 'text-orange-900';
        iconClass = 'text-orange-500';
     } else if (status === 'danger') {
        borderClass = 'border-red-200';
        bgClass = 'bg-red-50';
        textClass = 'text-red-900';
        iconClass = 'text-red-500';
     } else if (status === 'good') {
        borderClass = 'border-emerald-200';
        bgClass = 'bg-emerald-50';
        iconClass = 'text-emerald-500';
     }

     return (
        <Card className={`p-4 ${borderClass} ${bgClass} transition-all duration-300`}>
           <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold uppercase text-slate-500">{title}</span>
              <Icon className={`h-4 w-4 ${iconClass}`} />
           </div>
           <div className={`text-2xl font-bold ${textClass} mb-1`}>{value}</div>
           <div className="text-xs text-slate-500">{subtext}</div>
        </Card>
     );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
       <ImpactCard 
          title="Target Revenue" 
          value={formatMoney(targetRevenue)} 
          subtext={`vs ${formatMoney(baselineRevenue)} baseline`}
          icon={TrendingUp}
          status="good"
       />
       <ImpactCard 
          title="Team Size" 
          value={`${impliedTeamSize} FTEs`} 
          subtext={`${teamGrowth >= 0 ? '+' : ''}${teamGrowth} new hires`}
          icon={Users}
          status={hiringStatus}
       />
       <ImpactCard 
          title="Profit Pool" 
          value={formatMoney(profitPool)} 
          subtext={`${(targetMargin * 100).toFixed(1)}% Margin`}
          icon={DollarSign}
          status={profitStatus}
       />
       <ImpactCard 
          title="Sales Velocity" 
          value={`${monthlyDeals}/mo`} 
          subtext="Deals required"
          icon={Activity}
          status={salesStatus}
       />
       <Card className="p-4 bg-slate-900 text-white flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Impact Score</div>
          <div className="text-3xl font-bold mb-1">
             {Math.max(0, 100 - (teamGrowth * 3) - (Number(monthlyDeals) * 5))}
          </div>
          <div className="text-xs text-slate-400">/ 100</div>
       </Card>
    </div>
  );
};