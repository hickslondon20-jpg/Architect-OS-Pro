import { describe, it, expect } from 'vitest';
import { calculateGrowthVelocity } from './growthVelocityEngine';
import { GVBaselineInputs, GVTargetInputs } from './growthVelocityTypes';

describe('Growth Velocity Engine', () => {
    const baseline: GVBaselineInputs = {
        currentRevenue: 2000000, // $2M
        currentMargin: 20,       // 20%
        currentTeamSize: 10,     // 10 FTEs
        currentClientCount: 80,  // ACV = $25k
        currentRetentionRate: 90,// 10% churn
        currentMrrMix: 70,
        currentProjectMix: 30
    };

    const target: GVTargetInputs = {
        targetRevenue: 3000000, // $3M
        timeframeMonths: 12,
        targetMargin: 25,
        targetTeamSize: undefined // Auto-calc
    };

    it('calculates basic growth mechanics correctly', () => {
        const result = calculateGrowthVelocity(baseline, target);

        expect(result.adjustedTargetRevenue).toBe(3000000);
        expect(result.revenueGap).toBe(1000000);
        expect(result.requiredCagr).toBeCloseTo(0.50, 2); // 50% growth
    });

    it('calculates churn replacement correctly', () => {
        // 10% churn of $2M = $200k
        const result = calculateGrowthVelocity(baseline, target);
        expect(result.annualChurnRate).toBeCloseTo(0.10, 2);
        expect(result.churnReplacementRevenue).toBeCloseTo(200000, 0);
        // Total Sales Needed = gap ($1M) + churn ($200k) = $1.2M
        expect(result.totalSalesNeeded).toBeCloseTo(1200000, 0);
    });

    it('applies scenario adjustments correctly', () => {
        const adjustments = {
            growthAdjustmentPct: 0.10, // Target +10% -> $3.3M
            retentionAdjustmentPct: 0.05 // Retention 90->95% (Churn 5%)
        };

        const result = calculateGrowthVelocity(baseline, target, adjustments);

        // Target Revenue: $3M * 1.1 = $3.3M
        expect(result.adjustedTargetRevenue).toBeCloseTo(3300000, 0);

        // Churn: 5% of $2M = $100k
        expect(result.annualChurnRate).toBeCloseTo(0.05, 2);
        expect(result.churnReplacementRevenue).toBeCloseTo(100000, 0);
    });

    it('triggers RED Treadmill Alert on high churn', () => {
        // Engine clamps retention at 50% min.
        // To get >50% replacement, Gap must be small relative to churn.
        // Revenue $2M. Max Churn 50% = $1M.
        // If Target $2.5M -> Gap $0.5M. Total Need $1.5M.
        // Replacement = 1.0 / 1.5 = 66% -> RED.

        const lowGrowthTarget = { ...target, targetRevenue: 2500000 };
        const badBaseline = { ...baseline, currentRetentionRate: 40 }; // Clamped to 50%

        const resultWorse = calculateGrowthVelocity(badBaseline, lowGrowthTarget);

        expect(resultWorse.pressure.treadmill.severity).toBe('RED');
    });

    it('triggers RED Sales Capability Alert on high velocity multiplier', () => {
        // Target $10M (5x growth) in 12 months
        // Current velocity support $2M maintain + minimal growth.
        // Gap $8M. 
        const highTarget = { ...target, targetRevenue: 10000000 };
        const result = calculateGrowthVelocity(baseline, highTarget);

        expect(result.salesVelocityMultiplier).toBeGreaterThan(3.0);
        expect(result.pressure.salesCapability.severity).toBe('RED');
    });

    it('calculates positioning pressure correctly', () => {
        // Increase ACV by 50% (Adjustment)
        const result = calculateGrowthVelocity(baseline, target, { acvAdjustmentPct: 0.50 });

        // Delta > 40% -> Magnitude High
        expect(result.acvDeltaPct).toBeCloseTo(0.50, 2);
        // Should trigger structural dependency alert
        // Dependency ratio: 
        // ACV from 25k -> 37.5k. 
        // Clients: 80. Growth from ACV = 80 * 12.5k = $1M.
        // Total Growth $1M (wait, adjusted target revenue also changes if we assume fixed target? 
        // No, logic is `adjustedTargetRevenue = rawTarget * (1+growthAdj)`. ACV adj changes CLIENT COUNT).
        // Spec: "Growth from ACV only = baseline_client_count * (adjusted_acv - baseline_acv)"
        // So $1M growth comes purely from ACV on existing base.
        // Total Revenue Growth = $1M.
        // Dependency = 100%. 
        // Delta > 40% AND Dependency > 60% -> RED.

        expect(result.pressure.positioning.severity).toBe('RED');
    });
});
