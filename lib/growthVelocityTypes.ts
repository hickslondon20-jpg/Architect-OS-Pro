export interface GVBaselineInputs {
    currentRevenue: number;
    currentMargin: number; // 0-100
    currentTeamSize: number;
    currentClientCount: number;
    currentRetentionRate: number; // 0-100
    currentMrrMix: number; // 0-100
    currentProjectMix: number; // 0-100
}

export interface GVTargetInputs {
    targetRevenue: number;
    timeframeMonths: number;
    targetMargin: number; // 0-100
    targetTeamSize?: number; // Optional override
    // Advanced Features
    targetMrrMix?: number; // 0-100
    targetProjectMix?: number; // 0-100
}

export interface GVZScenarioAdjustments {
    growthAdjustmentPct: number;    // -0.5 to 1.0
    acvAdjustmentPct: number;       // -0.5 to 1.0
    efficiencyAdjustmentPct: number;// -0.3 to 0.5
    retentionAdjustmentPct: number; // -0.2 to 0.2
    marginAdjustmentPct: number;    // -0.2 to 0.2
}

export interface GVPressureAlert {
    severity: 'RED' | 'YELLOW' | 'GREEN';
    level?: 'Dominant' | 'Active' | 'Latent' | string;
    label: string;
    message: string;
    signals?: Record<string, { value: string; interpretation: string }>;
    implications?: string[];
}

export interface GVPressureDashboard {
    treadmill: GVPressureAlert;
    salesCapability: GVPressureAlert;
    capacityWall: GVPressureAlert;
    profitTrap: GVPressureAlert;
    whaleTrap: GVPressureAlert;
    positioning: GVPressureAlert;
}

export interface GVCalculationResult {
    // Inputs Used
    baseline: GVBaselineInputs;
    targets: GVTargetInputs;
    adjustments: GVZScenarioAdjustments;

    // Derived Metrics (Layer 2)
    adjustedTargetRevenue: number;
    revenueGap: number;
    requiredCagr: number;

    // Retention & Churn
    adjustedRetentionRate: number;
    annualChurnRate: number;
    churnReplacementRevenue: number;
    totalSalesNeeded: number;
    churnReplacementPct: number;

    // Sales Velocity
    adjustedAcv: number;
    targetClientCount: number;
    netNewClientsNeeded: number;
    grossSalesWinsRequired: number;
    monthlySalesVelocityRequired: number;
    currentSalesVelocity: number;
    salesVelocityMultiplier: number;

    // Capacity
    adjustedAgiPerFte: number;
    targetTeamSize: number;
    headcountDelta: number;
    hiringPacePerQuarter: number;
    hiringVelocityPct: number;
    impliedAgiPerFteNoHiring: number;

    // Economics
    adjustedProfitMargin: number;
    baselineProfit: number;
    targetProfit: number;
    profitDelta: number;
    impliedNewPayroll: number;
    cashFlowCoverageRatio: number;

    // Structural Risk
    avgClientAsPctOfRevenue: number;
    clientComplexityRatio: number; // Target / Baseline client count

    // Positioning
    acvDeltaPct: number;
    acvAnnualGrowthRate: number;
    acvDependencyRatio: number;
    positioningPressureScore: number;

    // Output Deltas (Layer 3 Display)
    deltas: {
        revenue: number;
        profit: number;
        team: number;
        clients: number;
        velocity: number;
    };

    // Pressure System
    pressure: GVPressureDashboard;

    // GVI Score
    gviScore: number; // 0-100
}
