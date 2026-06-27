import { ScenarioModifiers } from "../components/tools/growth-velocity/ScenarioControls";

// --- Types ---

export interface PressureAlert {
    severity: 'RED' | 'YELLOW' | 'GREEN';
    label: string;
    message: string;
}

export interface SimulationResult {
    metrics: {
        targetRevenue: number;
        requiredCAGR: number;
        netNewClients: number;
        monthlyVelocity: number;
        velocityMultiplier: number;
        targetTeamSize: number;
        headcountDelta: number;
        hiringPace: number;
        targetProfit: number;
        profitDelta: number;
        targetMargin: number;
        targetACV: number;
    };
    pressures: {
        retention: PressureAlert;
        sales: PressureAlert;
        capacity: PressureAlert;
        economic: PressureAlert;
        structural: PressureAlert;
        positioning: PressureAlert; // positioning result might have more details like signals
    };
}

// --- Calculation Engine ---

export const runGrowthSimulation = (
    baseline: {
        revenue: number;
        team: number;
        clients: number;
        retention: number; // e.g. 0.85
        margin: number; // e.g. 0.20
        acv?: number;
    },
    modifiers: ScenarioModifiers
): SimulationResult => {

    // 1. Layer 1: Inputs & Adjustments
    const baselineACV = baseline.acv || (baseline.revenue / (baseline.clients || 1));
    const timeframeMonths = modifiers.timeframe || 12;
    const timeframeYears = timeframeMonths / 12;

    // Adjusted Inputs
    const adjustedTargetRevenue = baseline.revenue * (1 + modifiers.revenueTarget / 100);
    const adjustedEfficiency = (baseline.revenue / baseline.team) * (1 + modifiers.efficiency / 100);
    const adjustedRetention = Math.min(0.99, Math.max(0.50, (baseline.retention) + (modifiers.retention / 100))); // modifier is percentage points? Or % change?
    // Spec says: "baseline_retention_rate + retention_adjustment_pct". "Retention Improvement ... -20% to +20%".
    // If baseline is 0.85 and modifier is 5 (5%), does it mean 0.90? Yes.
    // Code in spec: baseline_retention_rate + retention_adjustment_pct. 
    // Modifiers from slider are integers usually (e.g. 5). So 5/100 = 0.05.

    const targetACV = baselineACV * (1 + modifiers.acv / 100);
    const adjustedMargin = Math.min(0.60, Math.max(0.05, baseline.margin + (modifiers.margin / 100)));

    // 2. Layer 2: Derived Metrics

    // Growth Mechanics
    const revenueGap = adjustedTargetRevenue - baseline.revenue;
    const requiredCAGR = Math.pow(adjustedTargetRevenue / baseline.revenue, 1 / timeframeYears) - 1;

    // Retention & Churn
    const annualChurnRate = 1 - adjustedRetention;
    const churnReplacementRevenue = baseline.revenue * annualChurnRate * timeframeYears;
    const totalSalesRevenueNeeded = Math.max(0, revenueGap) + churnReplacementRevenue;
    const churnReplacementPct = totalSalesRevenueNeeded > 0 ? churnReplacementRevenue / totalSalesRevenueNeeded : 0;

    // Client & Sales Velocity
    const targetClientCount = Math.ceil(adjustedTargetRevenue / targetACV);
    const netNewClientsNeeded = Math.max(0, targetClientCount - baseline.clients);
    const clientsChurned = Math.round(baseline.clients * annualChurnRate * timeframeYears);
    const grossSalesWinsRequired = netNewClientsNeeded + clientsChurned;
    const monthlySalesVelocityRequired = grossSalesWinsRequired / timeframeMonths;
    // Proxy current velocity
    const currentMonthlyVelocity = (baseline.clients * (1 - baseline.retention)) / 12 + (baseline.clients * 0.10 / 12); // Rough proxy: replace churn + 10% growth
    // Actually spec says: baseline_client_count * (1 / 12) if not available.
    const proxyCurrentVelocity = Math.max(1, baseline.clients * 0.15 / 12); // Assume 15% churn replacement pace as baseline if unknown
    const salesVelocityMultiplier = monthlySalesVelocityRequired / proxyCurrentVelocity;

    // Capacity & Headcount
    const targetTeamSize = Math.ceil(adjustedTargetRevenue / adjustedEfficiency);
    const headcountDelta = targetTeamSize - baseline.team;
    const timeframeQuarters = timeframeMonths / 3;
    const hiringPacePerQuarter = headcountDelta / timeframeQuarters;
    const hiringVelocityPct = hiringPacePerQuarter / baseline.team;
    const impliedAGIPerFTENoHiring = adjustedTargetRevenue / baseline.team;

    // Economic & Profit
    const baselineProfit = baseline.revenue * baseline.margin;
    const targetProfit = adjustedTargetRevenue * adjustedMargin;
    const profitDelta = targetProfit - baselineProfit;
    const newAGI = Math.max(0, revenueGap) * 0.90; // Assume 90% AGI on new rev
    const impliedNewPayroll = newAGI * 0.45; // 45% rule
    const monthlyNewPayrollBurn = impliedNewPayroll / 12;
    const monthlyBaselineProfit = baselineProfit / 12;
    const cashFlowCoverageRatio = monthlyNewPayrollBurn > 0 ? monthlyBaselineProfit / monthlyNewPayrollBurn : 100;

    // Structural Risk
    const avgClientAsPctOfRevenue = targetACV / adjustedTargetRevenue;
    const clientComplexityRatio = targetClientCount / (baseline.clients || 1);

    // Positioning Pressure
    const acvDeltaPct = (targetACV - baselineACV) / baselineACV;
    const acvAnnualGrowthRate = Math.pow(targetACV / baselineACV, 1 / timeframeYears) - 1;
    const totalRevenueGrowth = adjustedTargetRevenue - baseline.revenue;
    const growthFromACVOnly = baseline.clients * (targetACV - baselineACV);
    const acvDependencyRatio = totalRevenueGrowth > 0 ? growthFromACVOnly / totalRevenueGrowth : 0;


    // 3. Pressure Alerts Calculation

    // 1. Treadmill (Retention)
    let retentionAlert: PressureAlert;
    if (churnReplacementPct > 0.50) {
        retentionAlert = { severity: 'RED', label: 'High Treadmill', message: `Over 50% of your sales effort (${((churnReplacementPct) * 100).toFixed(0)}%) is just replacing churn.` };
    } else if (churnReplacementPct > 0.30) {
        retentionAlert = { severity: 'YELLOW', label: 'Moderate Treadmill', message: '30-50% sales effort is replacing churn.' };
    } else {
        retentionAlert = { severity: 'GREEN', label: 'Healthy', message: 'Retention is well-managed (<30% replacement load).' };
    }

    // 2. Sales Capability
    let salesAlert: PressureAlert;
    if (salesVelocityMultiplier > 3.0) {
        salesAlert = { severity: 'RED', label: 'System Break', message: `Requires ${salesVelocityMultiplier.toFixed(1)}x current deal velocity.` };
    } else if (salesVelocityMultiplier > 2.0) {
        salesAlert = { severity: 'YELLOW', label: 'Significant Ramp', message: `Requires ${salesVelocityMultiplier.toFixed(1)}x current pace.` };
    } else {
        salesAlert = { severity: 'GREEN', label: 'Achievable', message: `Requires ${salesVelocityMultiplier.toFixed(1)}x pace - achievable.` };
    }

    // 3. Capacity Wall
    let capacityAlert: PressureAlert;
    if (hiringVelocityPct > 0.10 || impliedAGIPerFTENoHiring > 240000) {
        capacityAlert = { severity: 'RED', label: 'Culture/Burnout Risk', message: 'Hiring too fast (>10%/qtr) or team size too small.' };
    } else if (hiringVelocityPct > 0.05) {
        capacityAlert = { severity: 'YELLOW', label: 'Stretch', message: 'Hiring pace is aggressive but manageable.' };
    } else {
        capacityAlert = { severity: 'GREEN', label: 'Healthy', message: 'Hiring pace is sustainable.' };
    }

    // 4. Profit Trap
    let economicAlert: PressureAlert;
    const profitGrowthPct = profitDelta / baselineProfit;
    const revenueGrowthPct = revenueGap / baseline.revenue;

    if (cashFlowCoverageRatio < 1.0) {
        economicAlert = { severity: 'RED', label: 'Funding Gap', message: 'New payroll exceeds current profit.' };
    } else if (profitGrowthPct < (revenueGrowthPct * 0.5)) {
        economicAlert = { severity: 'YELLOW', label: 'Margin Compression', message: 'Profit growing slower than revenue.' };
    } else {
        economicAlert = { severity: 'GREEN', label: 'Healthy', message: 'Economics remain sound.' };
    }

    // 5. Structural (Whale)
    let structuralAlert: PressureAlert;
    if (avgClientAsPctOfRevenue > 0.15) {
        structuralAlert = { severity: 'RED', label: 'Concentration Risk', message: 'Single client >15% of revenue.' };
    } else if (clientComplexityRatio > 3.0) {
        structuralAlert = { severity: 'YELLOW', label: 'Complexity Risk', message: 'Client count tripling creates complexity.' };
    } else {
        structuralAlert = { severity: 'GREEN', label: 'Balanced', message: 'Portfolio structure is healthy.' };
    }

    // 6. Positioning
    let positioningAlert: PressureAlert;
    const magHigh = acvDeltaPct > 0.40;
    const paceHigh = acvAnnualGrowthRate > 0.25;
    const depHigh = acvDependencyRatio > 0.60;

    const magLow = acvDeltaPct < 0.15;
    const paceLow = acvAnnualGrowthRate < 0.10;
    const depLow = acvDependencyRatio < 0.30;

    if ((magHigh || paceHigh) && depHigh) {
        positioningAlert = { severity: 'RED', label: 'Dominant Dependency', message: 'Plan fails without massive pricing/positioning shift.' };
    } else if (magLow && paceLow && depLow) {
        positioningAlert = { severity: 'GREEN', label: 'Latent', message: 'Monetization changes not required.' };
    } else {
        positioningAlert = { severity: 'YELLOW', label: 'Active Evolution', message: 'Monetization helps but not sole dependency.' };
    }


    return {
        metrics: {
            targetRevenue: adjustedTargetRevenue,
            requiredCAGR: requiredCAGR,
            netNewClients: netNewClientsNeeded,
            monthlyVelocity: monthlySalesVelocityRequired,
            velocityMultiplier: salesVelocityMultiplier,
            targetTeamSize: targetTeamSize,
            headcountDelta: headcountDelta,
            hiringPace: hiringPacePerQuarter,
            targetProfit: targetProfit,
            profitDelta: profitDelta,
            targetMargin: adjustedMargin,
            targetACV: targetACV
        },
        pressures: {
            retention: retentionAlert,
            sales: salesAlert,
            capacity: capacityAlert,
            economic: economicAlert,
            structural: structuralAlert,
            positioning: positioningAlert
        }
    };
};
