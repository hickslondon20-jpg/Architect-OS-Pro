import { GVIInputs, GVIScoreResult, ResolvedVariables } from './gviCalculations';
import { generatePressureContent } from './gviSynthesis';

export interface ComparisonScenario {
    id: string; // The saved scenario ID
    slotKey: 'slot_1' | 'slot_2' | 'slot_3';
    name: string;
    inputs: { raw: GVIInputs; resolved: ResolvedVariables };
    results: GVIScoreResult;
}

export interface BaselineSnapshot {
    currentAGI: number;
    currentGrossRevenue: number;
    currentProfitMargin: number;
    currentClientCount: number;
    currentACV: number;
    currentRetentionRate: number;
    currentFTEs: number;
}

export const generateDeterministicOutput = (
    baseline: BaselineSnapshot,
    scenarios: ComparisonScenario[]
) => {

    // 1. Initialize empty tables
    const pressureTable: Record<string, any> = {
        retention: { baseline: null },
        sales: { baseline: null },
        capacity: { baseline: null },
        margin: { baseline: null },
        concentration: { baseline: null },
        positioning: { baseline: null }
    };

    const pressureImplications: Record<string, any> = {
        retention: {},
        sales: {},
        capacity: {},
        margin: {},
        concentration: {},
        positioning: {}
    };

    const gviScores: Record<string, any> = {};

    const chartData = {
        revenueTrajectory: {
            baseline: [] as number[],
            slot_1: [] as number[],
            slot_2: [] as number[],
            slot_3: [] as number[],
            timeLabels: [] as string[]
        },
        efficiencyMap: {} as Record<string, any>,
        growthBridge: {} as Record<string, any>,
        operationalPulse: {} as Record<string, any>
    };

    // Find the max timeframe to normalize the X axis for revenue trajectory
    let maxTimeframe = 12;
    scenarios.forEach(s => {
        if (s.inputs?.raw?.timeframeMonths > maxTimeframe) {
            maxTimeframe = s.inputs.raw.timeframeMonths;
        }
    });

    const midpoint = Math.round(maxTimeframe / 2);
    chartData.revenueTrajectory.timeLabels = ['0', `${midpoint}mo`, `${maxTimeframe}mo`];

    // Set baseline trajectory as a flat line of current AGI across the max timeframe
    chartData.revenueTrajectory.baseline = [Number(baseline.currentAGI), Number(baseline.currentAGI), Number(baseline.currentAGI)];

    // Map status enum to colors
    const colorMap: Record<string, string> = {
        'low': 'GREEN',
        'moderate': 'YELLOW',
        'high': 'RED'
    };

    scenarios.forEach(scenario => {
        const slot = scenario.slotKey;
        const result = scenario.results;
        const resolved = scenario.inputs?.resolved;
        const raw = scenario.inputs?.raw;

        // Guard: skip malformed scenarios (e.g. old records missing scales/components)
        if (!result?.scales || !result?.components || !resolved || !raw) return;

        const pressure = generatePressureContent(result);

        // Fill Pressure Table (Mapping UI keys to the generated content)
        pressureTable.retention[slot] = colorMap[pressure.retention.status];
        pressureTable.sales[slot] = colorMap[pressure.sales.status];
        pressureTable.capacity[slot] = colorMap[pressure.hiring.status]; // UI calls it capacity, logic calls it hiring
        pressureTable.margin[slot] = colorMap[pressure.margin.status];
        pressureTable.concentration[slot] = colorMap[pressure.concentration.status];
        pressureTable.positioning[slot] = colorMap[pressure.positioning.status];

        // Fill Implications
        pressureImplications.retention[slot] = pressure.retention.insight;
        pressureImplications.sales[slot] = pressure.sales.insight;
        pressureImplications.capacity[slot] = pressure.hiring.insight;
        pressureImplications.margin[slot] = pressure.margin.insight;
        pressureImplications.concentration[slot] = pressure.concentration.insight;
        pressureImplications.positioning[slot] = pressure.positioning.insight;

        // Fill GVI Scores
        gviScores[slot] = {
            score: result.score,
            band: result.band,
            compositionLabel: result.compositionLabel
        };

        // --- Chart Data ---

        // Revenue Trajectory Line (simple linear interpolation for the midpoint)
        const targetRev = resolved.targetAGI;
        const currentRev = resolved.currentAGI;
        const diff = targetRev - currentRev;

        // If this scenario's timeframe is shorter than max, we assume it hits target and stays flat, 
        // or just interpolate based on its own timeframe and extend it.
        // For simplicity, we just calculate the slope based on this scenario's timeframe.
        const monthlyGrowth = diff / raw.timeframeMonths;
        const midpointRev = currentRev + (monthlyGrowth * midpoint);
        const finalRev = currentRev + (monthlyGrowth * maxTimeframe); // What it would be at max timeframe if pacing continued

        chartData.revenueTrajectory[slot] = [currentRev, midpointRev, finalRev];

        // Efficiency Map Scatter
        const revenueGrowthPct = currentRev > 0 ? (targetRev - currentRev) / currentRev : 0;
        chartData.efficiencyMap[slot] = {
            revenueGrowthPct: revenueGrowthPct,
            profitMarginPct: raw.targetMargin / 100, // raw input margin might be whole number (e.g. 20) — assume percentage 0-1
            label: scenario.name
        };

        // Growth Bridge Bar
        // Exact spec: Retained = currentAGI * retention, Churn = currentAGI * (1 - retention), Net New = targetAGI - currentAGI
        const retentionRate = raw.currentRetainer / 100;
        const retained = currentRev * retentionRate;
        const churned = currentRev * (1 - retentionRate);
        const netNew = targetRev - currentRev;

        chartData.growthBridge[slot] = {
            retainedRevenue: retained,
            churnReplacement: churned,
            netNew: netNew > 0 ? netNew : 0
        };

        // Operational Pulse Bar
        // Total new hires needed divided by quarters in timeframe
        const fteDiff = (resolved.targetFTEs || 0) - (resolved.currentFTEs || 0);
        const quarters = raw.timeframeMonths / 3;

        let avgNewHiresPerQtr = 0;
        let hiringLabel = '';

        // Spec: "If targetFTEs is null or zero in the mock data, the bar should show 0.0 with a label 'No hiring change.'"
        if (!raw.targetFTEs || raw.targetFTEs === 0) {
            avgNewHiresPerQtr = 0;
            hiringLabel = 'No hiring change.';
        } else if (fteDiff > 0) {
            avgNewHiresPerQtr = fteDiff / quarters;
        }

        chartData.operationalPulse[slot] = {
            avgNewHiresPerQtr,
            hiringLabel
        };

    });

    return {
        pressureTable,
        pressureImplications,
        chartData,
        gviScores
    };
};
