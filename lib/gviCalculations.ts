import { GVBaselineInputs, GVTargetInputs } from './growthVelocityTypes';

// --- Types ---

export interface GVIInputs {
    currentAGI: number;
    currentClients: number;
    currentRetainer: number; // retention rate 0-100
    currentFTEs: number;
    currentMargin: number; // 0-100

    targetAGI: number;
    targetClients?: number;
    targetACV?: number;
    targetFTEs?: number;
    targetMargin?: number; // 0-100
    timeframeMonths: number;
}

export interface ResolvedVariables {
    // Explicit or Implied
    currentACV: number;
    currentAGI: number;
    currentClients: number;
    currentRetention: number; // 0.0-1.0
    currentFTEs: number;
    currentMargin: number; // 0.0-1.0

    targetAGI: number;
    targetClients: number;
    targetACV: number;
    targetFTEs: number;
    targetMargin: number; // 0.0-1.0
    timeframeYears: number;

    // Flags for derived values
    isTargetACVImplied: boolean;
    isTargetACVProxy: boolean;
    isTargetFTEsImplied: boolean;
    isTargetFTEsProxy: boolean;
    isTargetClientsImplied: boolean;
    
    // Arrays for DB storage
    derived_fields: string[];
    proxy_fields: string[];
}

export interface GVIScoreResult {
    score: number;
    band: string;
    compositionLabel: string;
    frictionShare: number;
    resolved: ResolvedVariables;
    scales: {
        retention: 'high' | 'moderate' | 'low';
        sales: 'high' | 'moderate' | 'low';
        hiring: 'high' | 'moderate' | 'low';
        margin: 'high' | 'moderate' | 'low';
        padding: 'high' | 'moderate' | 'low';
    };

    components: {
        massMultiplier: number; // 1.0, 1.5, 2.0
        cagr: number;
        massLabel: string;

        pace: {
            sales: number;
            hiring: number;
            capacity: number;
            total: number;
            cappedTotal: number;
            pace_cap_fired: boolean;
            pace_subtotal_raw: number;
            pace_subtotal_capped: number;
            pace_post_multiplier: number;
        };

        friction: {
            retention: number;
            profit: number;
            concentration: number;
            positioning: number;
            total: number;
        };
    };

    totalDeductions: number;

    watchSignals: {
        retention: boolean;
        profit: boolean;
        concentration: boolean;
        positioning: boolean;
        salesPace: boolean;
        hiringPace: boolean;
        capacity: boolean;
    };

    // Raw metrics for debugging/display
    metrics: {
        salesPaceRatio: number;
        hiringPaceRate: number;
        targetAGIPerFTE: number;
        retentionRate: number;
        profitMargin: number;
        clientCount: number;
        acvDelta: number;
        // UI Specific Metrics
        netNewRevenue: number;
        requiredMonthlySalesVelocity: number;
        currentMonthlySalesVelocity: number;
    };
}



// --- 1. Variable Resolution ---

export function resolveVariables(inputs: GVIInputs): ResolvedVariables {
    const timeframeYears = inputs.timeframeMonths / 12;

    // Current State Resolution
    const currentAGI = inputs.currentAGI;
    const currentClients = inputs.currentClients;
    const currentFTEs = inputs.currentFTEs;
    const currentMargin = inputs.currentMargin / 100;
    const currentRetention = inputs.currentRetainer / 100;

    // Derived Current ACV
    const currentACV = currentAGI / (currentClients || 1);

    // Target State Resolution
    const targetAGI = inputs.targetAGI;
    let targetClients = inputs.targetClients;
    let targetACV = inputs.targetACV;
    let targetFTEs = inputs.targetFTEs;
    const targetMargin = inputs.targetMargin !== undefined ? inputs.targetMargin / 100 : currentMargin; // Hold constant if not provided

    const flags = {
        isTargetACVImplied: false,
        isTargetACVProxy: false,
        isTargetFTEsImplied: false,
        isTargetFTEsProxy: false,
        isTargetClientsImplied: false,
    };

    const derived_fields: string[] = [];
    const proxy_fields: string[] = [];

    // Current State Logic (always derived for consistency)
    derived_fields.push('currentACV');

    // Logic Table from Spec Section 5

    // Target ACV & Client Count Resolution
    if (targetACV && targetClients) {
        // Both Explicit - Verify consistency? No, spec says "Explicit -> Use as-is". 
        // But usually AGI is the anchor. 
        // Spec says: 
        // Target ACV Explicit: Target ACV field
        // Implied From: Target AGI / Target Client Count
        // Proxy: Hold Current ACV constant
        // NOTE: If user provides all 3 (AGI, Clients, ACV), which wins? 
        // Usually AGI is the goal. 
        // If targetACV is provided, we use it.
    } else if (targetACV && !targetClients) {
        // Target Clients Implied
        targetClients = targetAGI / targetACV;
        flags.isTargetClientsImplied = true;
        derived_fields.push('targetClients');
    } else if (!targetACV && targetClients) {
        // Target ACV Implied
        targetACV = targetAGI / targetClients;
        flags.isTargetACVImplied = true;
        derived_fields.push('targetACV');
    } else {
        // Neither provided -> Proxy
        // Default Proxy Option B: Hold ACV constant (Volume-Led) per spec Section 5.
        targetACV = currentACV; // Hold constant
        targetClients = targetAGI / targetACV;
        flags.isTargetACVProxy = true;
        flags.isTargetClientsImplied = true; // Effectively implied from the proxy ACV
        proxy_fields.push('targetACV');
        derived_fields.push('targetClients');
    }

    // Target FTEs Resolution
    if (!targetFTEs) {
        // Implied/Proxy: Target AGI / $180k benchmark
        targetFTEs = targetAGI / 180000;
        flags.isTargetFTEsProxy = true; // Spec calls this "Apply benchmark - flag in output"
        proxy_fields.push('targetFTEs');
    }

    return {
        currentACV,
        currentAGI,
        currentClients,
        currentRetention,
        currentFTEs,
        currentMargin,

        targetAGI,
        targetClients: targetClients!,
        targetACV: targetACV!,
        targetFTEs: targetFTEs!,
        targetMargin,
        timeframeYears,

        ...flags,
        derived_fields,
        proxy_fields
    };
}


// --- 2. Scoring Function ---

export function calculateGVIScore(resolved: ResolvedVariables): GVIScoreResult {
    // A. Mass Multiplier
    // CAGR = (Target / Current)^(1/Years) - 1
    const cagr = Math.pow(resolved.targetAGI / resolved.currentAGI, 1 / resolved.timeframeYears) - 1;

    let massMultiplier = 1.0;
    let massLabel = "Organic";
    if (cagr >= 0.40) {
        massMultiplier = 2.0;
        massLabel = "Aggressive Scaling";
    } else if (cagr >= 0.15) {
        massMultiplier = 1.5;
        massLabel = "Active Growth";
    }
    // else < 15% -> 1.0

    // B. Pace Deductions

    // 3.1 Sales Pace
    // Churn Replacement/yr = Current Clients * (1 - Retention)
    const churnReplacement = resolved.currentClients * (1 - resolved.currentRetention);
    // Required Total/yr = Churn Replacement + (Target Clients - Current Clients) / Years
    const netNewPerYear = (resolved.targetClients - resolved.currentClients) / resolved.timeframeYears;
    const requiredTotalPerYear = churnReplacement + netNewPerYear;

    // Ratio = Required Total / Churn Replacement
    // Handle divide by zero if churn replacement is 0 (100% retention)
    // If 100% retention, replacement is 0. Ratio would be Infinite.
    // Spec says "Measures required new client acquisition velocity relative to estimated current baseline pace."
    // If baseline pace is 0 (no churn), any growth is infinite increase? 
    // Let's assume a floor for baseline pace or 1.0x if 0?
    // Use SAFE baseline. If churn rep is 0, use 1? Or 0.1?
    // Actually, standard logic: if denominator is 0, and numerator > 0, score is max.
    const salesPaceRatio = churnReplacement > 0.01
        ? requiredTotalPerYear / churnReplacement
        : (requiredTotalPerYear > 0 ? 10 : 0); // If no churn replacement needed, and we need sales, it's high ratio. 

    let salesPaceScore = 0;
    if (salesPaceRatio >= 3.0) salesPaceScore = 15;
    else if (salesPaceRatio >= 2.0) salesPaceScore = 10;
    else if (salesPaceRatio >= 1.5) salesPaceScore = 5;

    // 3.2 Hiring Pace
    // Net New Per Quarter = (Target FTEs - Current FTEs) / (Years * 4)
    const netNewFTEsPerQuarter = (resolved.targetFTEs - resolved.currentFTEs) / (resolved.timeframeYears * 4);
    const hiringPaceRate = resolved.currentFTEs > 0 ? netNewFTEsPerQuarter / resolved.currentFTEs : 1.0; // If starting from 0, max.

    let hiringPaceScore = 0;
    if (hiringPaceRate > 0.30) hiringPaceScore = 15;
    else if (hiringPaceRate > 0.20) hiringPaceScore = 10;
    else if (hiringPaceRate > 0.10) hiringPaceScore = 5;

    // 3.3 Capacity Utilization
    // Target AGI per FTE
    const targetAGIPerFTE = resolved.targetAGI / (resolved.targetFTEs || 1);

    let capacityScore = 0;
    if (targetAGIPerFTE < 140000) capacityScore = 15;
    else if (targetAGIPerFTE < 160000) capacityScore = 8;
    // >= 160k -> 0

    // Pace Total & Cap
    const rawPaceTotal = salesPaceScore + hiringPaceScore + capacityScore;
    const cappedPaceTotal = Math.min(rawPaceTotal, 25);
    const weightedPaceTotal = cappedPaceTotal * massMultiplier;

    // C. Structural Friction

    // 4.1 Retention Friction
    let retentionScore = 0;
    if (resolved.currentRetention < 0.75) retentionScore = 20;
    else if (resolved.currentRetention < 0.85) retentionScore = 10;

    // 4.2 Profit Friction
    let profitScore = 0;
    if (resolved.currentMargin < 0.10) profitScore = 18;
    else if (resolved.currentMargin < 0.15) profitScore = 13;
    else if (resolved.currentMargin < 0.20) profitScore = 8;
    else if (resolved.currentMargin < 0.25) profitScore = 3;

    // 4.3 Concentration Friction
    // Proxy: If (1.5 * Avg ACV) / Current AGI > 0.15  --> Simplified to < 10 clients
    let concentrationScore = 0;
    if (resolved.currentClients < 10) concentrationScore = 10;

    // 4.4 Positioning Pressure
    const acvDelta = (resolved.targetACV - resolved.currentACV) / resolved.currentACV;
    let positioningScore = 0;
    if (acvDelta >= 0.50) positioningScore = 10;
    else if (acvDelta >= 0.25) positioningScore = 5;

    const frictionTotal = retentionScore + profitScore + concentrationScore + positioningScore;

    // Determine Scales for UI
    const retentionScale = retentionScore > 15 ? 'high' : retentionScore > 5 ? 'moderate' : 'low';
    const marginScale = profitScore > 10 ? 'high' : profitScore > 3 ? 'moderate' : 'low';

    // Sales Scale (based on pace ratio)
    const salesScale = salesPaceRatio > 3 ? 'high' : salesPaceRatio > 1.5 ? 'moderate' : 'low';

    // Hiring Scale
    const hiringScale = hiringPaceRate > 2 ? 'high' : hiringPaceRate > 1 ? 'moderate' : 'low';

    // D. Final Score
    // GVI = 100 - (Pace * Mass) - Friction
    const rawGVI = 100 - weightedPaceTotal - frictionTotal;
    const gviScore = Math.max(0, Math.min(100, Math.round(rawGVI)));

    // E. Composition Label
    // Friction Share = Friction Total / ((Pace Total * Mass) + Friction Total)
    const totalDeductions = weightedPaceTotal + frictionTotal;
    const frictionShare = totalDeductions > 0 ? frictionTotal / totalDeductions : 0;

    let compositionLabel = "Ambition-Driven";
    if (frictionShare >= 0.80) compositionLabel = "Structural Constraint";
    else if (frictionShare >= 0.51) compositionLabel = "Structure-Driven";
    else if (frictionShare >= 0.21) compositionLabel = "Mixed Pressure";

    // F. Band Label
    let band = "High Momentum";
    if (gviScore <= 20) band = "Critical Strain";
    else if (gviScore <= 40) band = "Heavy Friction";
    else if (gviScore <= 60) band = "Active Pressure";
    else if (gviScore <= 79) band = "Healthy Velocity";

    // G. Watch Signals (Section 7)
    const watchSignals = {
        retention: resolved.currentRetention >= 0.85 && resolved.currentRetention < 0.88,
        profit: resolved.currentMargin >= 0.20 && resolved.currentMargin < 0.23,
        concentration: resolved.currentClients >= 10 && resolved.currentClients <= 11, // 10-11 clients
        positioning: acvDelta >= 0.20 && acvDelta < 0.25, // 20-24%
        salesPace: salesPaceRatio >= 1.3 && salesPaceRatio < 1.49,
        hiringPace: hiringPaceRate >= 0.08 && hiringPaceRate <= 0.10, // 8-10% (11% is penalty)
        capacity: targetAGIPerFTE >= 160000 && targetAGIPerFTE < 175000
    };

    return {
        score: gviScore,
        band,
        compositionLabel,
        frictionShare,
        totalDeductions,
        resolved,
        scales: {
            retention: retentionScale,
            sales: salesScale,
            hiring: hiringScale,
            margin: marginScale,
            padding: 'low' // Placeholder for now
        },
        components: {
            massMultiplier,
            cagr,
            massLabel,
            pace: {
                sales: salesPaceScore,
                hiring: hiringPaceScore,
                capacity: capacityScore,
                total: rawPaceTotal,
                cappedTotal: cappedPaceTotal,
                pace_cap_fired: rawPaceTotal > 25,
                pace_subtotal_raw: rawPaceTotal,
                pace_subtotal_capped: cappedPaceTotal,
                pace_post_multiplier: weightedPaceTotal
            },
            friction: {
                retention: retentionScore,
                profit: profitScore,
                concentration: concentrationScore,
                positioning: positioningScore,
                total: frictionTotal
            }
        },
        watchSignals,
        metrics: {
            salesPaceRatio,
            hiringPaceRate,
            targetAGIPerFTE,
            retentionRate: resolved.currentRetention,
            profitMargin: resolved.currentMargin,
            clientCount: resolved.currentClients,
            acvDelta,
            // UI Specific Metrics
            netNewRevenue: resolved.targetAGI - resolved.currentAGI,
            requiredMonthlySalesVelocity: requiredTotalPerYear / 12,
            currentMonthlySalesVelocity: (resolved.currentClients * (1 - resolved.currentRetention)) / 12
        }
    };
}
