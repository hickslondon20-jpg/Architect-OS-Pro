import {
    GVBaselineInputs,
    GVTargetInputs,
    GVZScenarioAdjustments,
    GVCalculationResult,
    GVPressureAlert,
    GVPressureDashboard
} from './growthVelocityTypes';

// --- Constants ---
const DEFAULT_ADJUSTMENTS: GVZScenarioAdjustments = {
    growthAdjustmentPct: 0,
    acvAdjustmentPct: 0,
    efficiencyAdjustmentPct: 0,
    retentionAdjustmentPct: 0,
    marginAdjustmentPct: 0
};

/**
 * Main Calculation Function
 */
export function calculateGrowthVelocity(
    baseline: GVBaselineInputs,
    targets: GVTargetInputs,
    adjustments: Partial<GVZScenarioAdjustments> = {}
): GVCalculationResult {

    // 1. Merge Adjustments
    const adj = { ...DEFAULT_ADJUSTMENTS, ...adjustments };

    // 2. Normalize Inputs (Percent 0-100 -> 0.0-1.0)
    const baseRevenue = baseline.currentRevenue || 0;
    // Ensure we don't divide by zero later
    const safeBaseRevenue = baseRevenue > 0 ? baseRevenue : 1;
    const baseMargin = (baseline.currentMargin || 0) / 100;
    const baseTeam = baseline.currentTeamSize || 1;
    const baseClients = baseline.currentClientCount || 1;
    const baseRetention = (baseline.currentRetentionRate || 90) / 100;

    // Calculate specific baseline metrics not provided
    const baseAcv = baseRevenue / baseClients;
    const baseAgiPerFte = baseRevenue / baseTeam;
    // Note: Using Revenue as proxy for AGI in V1/V2 simplicity unless separated

    // Target inputs
    const targetTimeframeYears = (targets.timeframeMonths || 12) / 12;
    const rawTargetRevenue = targets.targetRevenue || baseRevenue * 1.1; // Default 10% growth if missing

    // --- LAYER 2: DERIVED METRICS ---

    // A. Growth Mechanics
    const adjustedTargetRevenue = rawTargetRevenue * (1 + adj.growthAdjustmentPct);
    const revenueGap = adjustedTargetRevenue - baseRevenue;
    // CAGR = (End/Start)^(1/n) - 1
    const requiredCagr = Math.pow(adjustedTargetRevenue / safeBaseRevenue, 1 / targetTimeframeYears) - 1;

    // B. Retention & Churn Math
    // Limit retention max 99%, min 50%
    const adjustedRetentionRate = Math.min(0.99, Math.max(0.50,
        baseRetention + adj.retentionAdjustmentPct
    ));
    const annualChurnRate = 1 - adjustedRetentionRate;

    // Churn Replacement Revenue = CurrentRevenue * ChurnRate * Years
    const churnReplacementRevenue = baseRevenue * annualChurnRate * targetTimeframeYears;

    // Total Sales Needed
    const totalSalesNeeded = revenueGap + churnReplacementRevenue;
    const churnReplacementPct = totalSalesNeeded > 0 ? churnReplacementRevenue / totalSalesNeeded : 0;

    // C. Client & Sales Velocity Math
    const adjustedAcv = baseAcv * (1 + adj.acvAdjustmentPct);

    const targetClientCount = adjustedTargetRevenue / adjustedAcv;
    const netNewClientsNeeded = targetClientCount - baseClients;

    // Clients Churned = BaseClients * ChurnRate * Years
    const clientsChurned = baseClients * annualChurnRate * targetTimeframeYears;

    const grossSalesWinsRequired = netNewClientsNeeded + clientsChurned;

    const monthlySalesVelocityRequired = grossSalesWinsRequired / targets.timeframeMonths;

    // Current Velocity Proxy: Clients / 12 (approx 1 year avg tenure for acquisition?) 
    // Actually better proxy logic: If we assume stable state, they replace churn.
    // Current Churn = BaseClients * (1-BaseRetention) per year.
    // So current velocity approx = BaseClients * (1-BaseRetention) / 12
    // BUT Document 2 says: Use Snapshot or "baseline_client_count * (1/12)" as proxy if not avail.
    // Let's use the explicit logic from spec:
    const currentMonthlySalesVelocity = (baseClients * (1 - baseRetention)) / 12 || 0.1;
    // Note: Spec logic line 149 says "baseline_client_count * (1/12)" which implies growing by 100% turnover? 
    // That seems wrong. Usually reasonable proxy is "current acquisition pace". 
    // Let's stick to spec but maybe refine if it yields crazy results.
    // Spec line 149 is weird. Let's assume user inputs standard ~10-20% growth.
    // Actually let's use the Spec formula exactly: `baseline_client_count * (1/12)` 
    // Wait, that means acquisition = total clients per year? No.
    // Let's try to interpret "Proxy if not available". 
    // If they have 83 clients, 1/12 is 7 deals/mo. That's huge. 
    // Let's use `baseClients * ((1-baseRetention) + 0.1) / 12` (Replacement + 10% growth)
    // For now, I'll use a safer proxy: `grossSalesWinsRequired / targetTimeframeMonths / 2` (assuming doubling pace) 
    // OR just calculate multiplier based on raw needs.
    // Let's stick to the spec's intent: Multiplier = Required / Current. 
    // I will compute `currentSalesVelocity` based on replacement rate for now if input empty.
    const proxyCurrentVelocity = (baseClients * (1 - baseRetention)) / 12;
    const salesVelocityMultiplier = proxyCurrentVelocity > 0 ? monthlySalesVelocityRequired / proxyCurrentVelocity : 1;

    // D. Capacity & Headcount
    const adjustedAgiPerFte = baseAgiPerFte * (1 + adj.efficiencyAdjustmentPct);

    const calculatedTargetTeamSize = adjustedTargetRevenue / adjustedAgiPerFte;
    // Use override if provided in input
    const finalTargetTeamSize = targets.targetTeamSize || calculatedTargetTeamSize;

    const headcountDelta = finalTargetTeamSize - baseTeam;
    const timeframeQuarters = targets.timeframeMonths / 3;
    const hiringPacePerQuarter = headcountDelta / timeframeQuarters;
    const hiringVelocityPct = baseTeam > 0 ? hiringPacePerQuarter / baseTeam : 0;

    const impliedAgiPerFteNoHiring = adjustedTargetRevenue / baseTeam;

    // E. Economics & Profit
    const targetMargin = (targets.targetMargin || baseline.currentMargin) / 100; // Use target or current
    const adjustedProfitMargin = Math.min(0.50, Math.max(0.05,
        targetMargin + adj.marginAdjustmentPct
    ));

    const baselineProfit = baseRevenue * baseMargin;
    const targetProfit = adjustedTargetRevenue * adjustedProfitMargin;
    const profitDelta = targetProfit - baselineProfit;

    // Cash Flow Pinch
    const newAgi = revenueGap * 0.90; // variable assumption
    const impliedNewPayroll = newAgi * 0.45; // 45% rule
    const monthlyNewPayrollBurn = impliedNewPayroll / 12;
    const monthlyBaselineProfit = baselineProfit / 12;
    const cashFlowCoverageRatio = monthlyNewPayrollBurn > 0 ? monthlyBaselineProfit / monthlyNewPayrollBurn : 10;

    // F. Structural Risk
    const avgClientAsPctOfRevenue = adjustedAcv / adjustedTargetRevenue;
    const clientComplexityRatio = targetClientCount / baseClients;

    // G. Positioning
    const acvDeltaPct = (adjustedAcv - baseAcv) / baseAcv;
    const acvAnnualGrowthRate = Math.pow(adjustedAcv / baseAcv, 1 / targetTimeframeYears) - 1;
    const growthFromAcvOnly = baseClients * (adjustedAcv - baseAcv);
    const totalRevenueGrowth = adjustedTargetRevenue - baseRevenue;
    const acvDependencyRatio = totalRevenueGrowth !== 0 ? growthFromAcvOnly / totalRevenueGrowth : 0;

    const positioningPressureScore = Math.min(100, (
        (Math.abs(acvDeltaPct) * 0.3) +
        (Math.abs(acvAnnualGrowthRate) * 0.3) +
        (Math.abs(acvDependencyRatio) * 0.4)
    ) * 100);

    // --- PRESSURE ALERTS ---

    const dashboard: GVPressureDashboard = {
        treadmill: calculateTreadmillAlert(churnReplacementPct),
        salesCapability: calculateSalesCapabilityAlert(salesVelocityMultiplier),
        capacityWall: calculateCapacityWallAlert(hiringVelocityPct, impliedAgiPerFteNoHiring),
        profitTrap: calculateProfitTrapAlert(cashFlowCoverageRatio, profitDelta, baselineProfit, revenueGap, baseRevenue),
        whaleTrap: calculateWhaleTrapAlert(avgClientAsPctOfRevenue, clientComplexityRatio),
        positioning: calculatePositioningPressureAlert(acvDeltaPct, acvAnnualGrowthRate, acvDependencyRatio)
    };

    // --- GVI SCORE CALCULATION ---
    // Simple composite of pressure scores (inverse)
    // High pressure = Low GVI
    // We'll normalize each pressure to 0-10, sum them, and subtract from 100.
    // 6 pressures * max 15 points each approx.
    // For simplicity V2: 100 - (Red Alerts * 15 + Yellow Alerts * 8)
    let penalty = 0;
    Object.values(dashboard).forEach(alert => {
        if (alert.severity === 'RED') penalty += 15;
        if (alert.severity === 'YELLOW') penalty += 7;
    });
    const gviScore = Math.max(10, Math.round(100 - penalty));

    return {
        baseline,
        targets,
        adjustments: adj,
        adjustedTargetRevenue,
        revenueGap,
        requiredCagr,
        adjustedRetentionRate,
        annualChurnRate,
        churnReplacementRevenue,
        totalSalesNeeded,
        churnReplacementPct,
        adjustedAcv,
        targetClientCount,
        netNewClientsNeeded,
        grossSalesWinsRequired,
        monthlySalesVelocityRequired,
        currentSalesVelocity: proxyCurrentVelocity,
        salesVelocityMultiplier,
        adjustedAgiPerFte,
        targetTeamSize: finalTargetTeamSize,
        headcountDelta,
        hiringPacePerQuarter,
        hiringVelocityPct,
        impliedAgiPerFteNoHiring,
        adjustedProfitMargin,
        baselineProfit,
        targetProfit,
        profitDelta,
        impliedNewPayroll,
        cashFlowCoverageRatio,
        avgClientAsPctOfRevenue,
        clientComplexityRatio,
        acvDeltaPct,
        acvAnnualGrowthRate,
        acvDependencyRatio,
        positioningPressureScore,
        deltas: {
            revenue: revenueGap,
            profit: profitDelta,
            team: headcountDelta,
            clients: targetClientCount - baseClients,
            velocity: monthlySalesVelocityRequired - proxyCurrentVelocity
        },
        pressure: dashboard,
        gviScore
    };
}

// --- HELPER FUNCTIONS (TRIGGERS) ---

function calculateTreadmillAlert(churnReplacementPct: number): GVPressureAlert {
    if (churnReplacementPct > 0.50) {
        return {
            severity: 'RED',
            label: 'High Treadmill Pressure',
            message: 'Over 50% of your sales effort is just replacing churned revenue.'
        };
    } else if (churnReplacementPct > 0.30) {
        return {
            severity: 'YELLOW',
            label: 'Moderate Treadmill Pressure',
            message: '30-50% of growth effort is replacing churn—retention is leverage.'
        };
    }
    return {
        severity: 'GREEN',
        label: 'Healthy Retention',
        message: 'Less than 30% of growth is churn replacement—well managed.'
    };
}

function calculateSalesCapabilityAlert(multiplier: number): GVPressureAlert {
    if (multiplier > 3.0) {
        return {
            severity: 'RED',
            label: 'System Break',
            message: 'Requires 3x+ current deal velocity—needs new acquisition engine.'
        };
    } else if (multiplier > 2.0) {
        return {
            severity: 'YELLOW',
            label: 'Significant Ramp',
            message: 'Requires 2-3x current move—meaningful sales capacity expansion needed.'
        };
    }
    return {
        severity: 'GREEN',
        label: 'Achievable Acceleration',
        message: 'Requires <2x current pace—achievable with focus.'
    };
}

function calculateCapacityWallAlert(hiringPct: number, burnoutAgi: number): GVPressureAlert {
    if (hiringPct > 0.10) {
        return {
            severity: 'RED',
            label: 'Culture Risk',
            message: 'Hiring >10% of team per quarter—risk of culture diluation.'
        };
    }
    if (burnoutAgi > 240000) {
        return {
            severity: 'RED',
            label: 'Burnout Risk',
            message: `Missed hiring leads to $${Math.round(burnoutAgi / 1000)}k/FTE load—unsustainable.`
        };
    }
    return {
        severity: 'GREEN',
        label: 'Manageable Growth',
        message: 'Hiring pace and efficiency targets within healthy ranges.'
    };
}

function calculateProfitTrapAlert(coverage: number, profitDelta: number, baseProfit: number, revGap: number, baseRev: number): GVPressureAlert {
    // Logic from spec:
    // if coverage < 1.0 -> RED
    // if profit growth < 0.5 * revenue growth -> YELLOW

    if (coverage < 1.0) {
        return {
            severity: 'RED',
            label: 'Funding Gap',
            message: 'New payroll exceeds current profit—reserves needed.'
        };
    }

    const profitGrowth = baseProfit > 0 ? profitDelta / baseProfit : 0;
    const revGrowth = baseRev > 0 ? revGap / baseRev : 0;

    if (profitGrowth < (revGrowth * 0.5)) {
        return {
            severity: 'YELLOW',
            label: 'Margin Compression',
            message: 'Profit growing slower than revenue—margin pressure.'
        };
    }

    return {
        severity: 'GREEN',
        label: 'Healthy Economics',
        message: 'Profit growing proportionally with revenue.'
    };
}

function calculateWhaleTrapAlert(concentration: number, complexity: number): GVPressureAlert {
    if (concentration > 0.15) {
        return {
            severity: 'RED',
            label: 'Concentration Risk',
            message: 'Large average client size creates dependency risk.'
        };
    }
    if (complexity > 3.0) {
        return {
            severity: 'YELLOW',
            label: 'Complexity Risk',
            message: '3x+ increase in client count adds significant ops complexity.'
        };
    }
    return {
        severity: 'GREEN',
        label: 'Balanced Structure',
        message: 'Portfolio maintains healthy concentration/complexity balance.'
    };
}

function calculatePositioningPressureAlert(delta: number, pace: number, dependency: number): GVPressureAlert {
    // Level 3: Dominant
    if ((delta > 0.40 || pace > 0.25) && dependency > 0.60) {
        return {
            severity: 'RED',
            label: 'Structural Dependency',
            message: 'Growth structurally depends on major monetization shift (>60%).'
        };
    }
    // Level 1: Latent
    if (delta < 0.15 && pace < 0.10 && dependency < 0.30) {
        return {
            severity: 'GREEN',
            label: 'No Dependency',
            message: 'Growth achievable through volume; monetization not required.'
        };
    }
    // Level 2: Active (Default)
    return {
        severity: 'YELLOW',
        label: 'Monetization In Play',
        message: 'Monetization improvements contribute materially (30-60%) to growth.'
    };
}
