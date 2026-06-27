import { resolveVariables, calculateGVIScore, GVIInputs } from '../lib/gviCalculations';

// Test Scenarios from Spec (Section 9)

const scenarioA: GVIInputs = {
    // Current
    currentAGI: 2400000,
    currentMargin: 32,
    currentClients: 14,
    currentRetainer: 91, // Retention
    currentFTEs: 13,

    // Target (18 months)
    targetAGI: 4200000,
    targetClients: 20,
    targetACV: 210000,
    targetFTEs: 22,
    timeframeMonths: 18
};

const scenarioB: GVIInputs = {
    // Current
    currentAGI: 1100000,
    currentMargin: 19,
    currentClients: 11,
    currentRetainer: 82,
    currentFTEs: 7,

    // Target (24 months)
    targetAGI: 1800000,
    targetClients: 15,
    targetACV: 120000,
    targetFTEs: 11,
    timeframeMonths: 24
};

const scenarioC: GVIInputs = {
    // Current
    currentAGI: 750000,
    currentMargin: 16,
    currentClients: 9,
    currentRetainer: 79,
    currentFTEs: 6,

    // Target (18 months)
    targetAGI: 1600000,
    targetClients: 16,
    targetACV: 100000,
    targetFTEs: 12,
    timeframeMonths: 18
};

function runTest(name: string, inputs: GVIInputs) {
    console.log(`\n\n=== Running ${name} ===`);
    const resolved = resolveVariables(inputs);

    // Log resolved variables for debugging
    // console.log("Resolved Variables:", JSON.stringify(resolved, null, 2));

    const result = calculateGVIScore(resolved);

    console.log(`Score: ${result.score} / Band: ${result.band}`);
    console.log(`Composition: ${result.compositionLabel} (Friction Share: ${(result.frictionShare * 100).toFixed(1)}%)`);
    console.log("Components:");
    console.log(`  Mass Multiplier: ${result.components.massMultiplier}x (CAGR: ${(result.components.cagr * 100).toFixed(1)}%)`);
    console.log(`  Pace Total: ${result.components.pace.total} (Capped: ${result.components.pace.cappedTotal})`);
    console.log(`    Sales: ${result.components.pace.sales} (Ratio: ${result.metrics.salesPaceRatio.toFixed(2)}x)`);
    console.log(`    Hiring: ${result.components.pace.hiring} (Rate: ${(result.metrics.hiringPaceRate * 100).toFixed(1)}%)`);
    console.log(`    Capacity: ${result.components.pace.capacity} (Target AGI/FTE: $${Math.round(result.metrics.targetAGIPerFTE)})`);
    console.log(`  Friction Total: ${result.components.friction.total}`);
    console.log(`    Retention: ${result.components.friction.retention}`);
    console.log(`    Profit: ${result.components.friction.profit}`);
    console.log(`    Concentration: ${result.components.friction.concentration}`);
    console.log(`    Positioning: ${result.components.friction.positioning} (ACV Delta: ${(result.metrics.acvDelta * 100).toFixed(1)}%)`);

    console.log("Watch Signals:", JSON.stringify(result.watchSignals, null, 2));
}

runTest("Scenario A (High Performer)", scenarioA);
runTest("Scenario B (Moderate)", scenarioB);
runTest("Scenario C (Modest / Heavy Friction)", scenarioC);
