
import { GVIScoreResult } from './gviCalculations';
import { formatNumberWithCommas } from './formatUtils';

// --- Types ---

export interface PressureContent {
    title: string;
    status: 'high' | 'moderate' | 'low';
    score: number;
    maxScore: number;
    insight: string; // Short summary (collapsed state)
    contentBlock: string; // Detailed analysis (expanded state)
    watchSignal?: string; // Optional watch signal note
}

export interface SynthesisContent {
    headline: string;
    narrative: string;
}

export interface GVSImplicationEntry {
    pts: number;
    tier_label: string;
    status: 'active' | 'clean';
    watch_signal: boolean;
    watch_signal_note: string;
}

export type GVSImplications = Record<string, GVSImplicationEntry>;

export interface GVSLevelInsight {
    headline: string;
    rationale: string;
    status: string;
    friction_pts: number;
    watch_signal: boolean;
    watch_signal_note: string;
}

export type GVSPressureInsights = Record<string, GVSLevelInsight>;

export interface BandDetails {
    name: string;
    colorClass: string;
    textClass: string;
    gradientFrom: string;
    description: string;
}

// --- Band Logic (Section 8) ---

export const getBandDetails = (score: number): BandDetails => {
    if (score <= 20) {
        return {
            name: "Critical Strain",
            colorClass: "bg-red-600",
            textClass: "text-red-400",
            gradientFrom: "from-red-600",
            description: "The scenario places structural demands on the business that its current foundation is unlikely to absorb without material changes."
        };
    } else if (score <= 40) {
        return {
            name: "Heavy Friction",
            colorClass: "bg-orange-500",
            textClass: "text-orange-400",
            gradientFrom: "from-orange-500",
            description: "Current structural state and growth target demands are materially misaligned across several dimensions."
        };
    } else if (score <= 60) {
        return {
            name: "Active Pressure",
            colorClass: "bg-amber-500",
            textClass: "text-amber-400",
            gradientFrom: "from-amber-500",
            description: "Friction exists across multiple dimensions. Requires sequenced investment and deliberate management."
        };
    } else if (score <= 79) {
        return {
            name: "Healthy Velocity",
            colorClass: "bg-blue-500",
            textClass: "text-blue-400",
            gradientFrom: "from-blue-500",
            description: "Scenario activates pressure signals, but business retains enough structural capacity to absorb them."
        };
    } else {
        return {
            name: "High Momentum",
            colorClass: "bg-emerald-500",
            textClass: "text-emerald-400",
            gradientFrom: "from-emerald-500",
            description: "Growth target sits within the structural carrying capacity of the current business."
        };
    }
};

// --- Composition Logic (Section 6) ---

export const getCompositionNote = (label: string): string => {
    switch (label) {
        case "Ambition-Driven": return "The pressure in this scenario is a direct expression of the growth target's demands on a structurally sound business.";
        case "Mixed Pressure": return "This score reflects both structural constraints and execution demands working against each other.";
        case "Structure-Driven": return "The pressure in this scenario is primarily structural — current business constraints are contributing more to this score than the demands of the growth target itself.";
        case "Structural Constraint": return "This score is almost entirely driven by the current state of the business. The growth target is not the primary variable — the foundation is.";
        default: return "Review your constraints to unlock further velocity.";
    }
};

// --- Pressure Content Logic (Section 10 & 7) ---

export const generatePressureContent = (result: GVIScoreResult): Record<string, PressureContent> => {
    const { components, watchSignals, metrics, scales } = result;
    const { pace, friction } = components;

    // Helper to determine status color/level
    const getStatus = (score: number, max: number): 'high' | 'moderate' | 'low' => {
        const ratio = score / max;
        if (ratio > 0.6) return 'high';
        if (ratio > 0.3) return 'moderate';
        return 'low';
    };

    // 1. Retention Pressure
    const retentionStatus = scales.retention;
    const retentionContent: PressureContent = {
        title: "Retention Pressure",
        status: retentionStatus as any,
        score: friction.retention,
        maxScore: 20,
        insight: metrics.retentionRate < 0.85
            ? `Retention drag computes to ${Math.round((1 - metrics.retentionRate) * 100)}% annual replacement burden.`
            : "Retention is healthy, creating a stable platform for growth.",
        contentBlock: metrics.retentionRate < 0.75
            ? "Below 75%, the replacement treadmill is severe enough that a growth scenario is mathematically a different problem — not just a harder version."
            : metrics.retentionRate < 0.85
                ? "Annual replacement burden meaningfully elevates required acquisition volume above what a standard growth scenario would demand."
                : "Healthy retention minimizes the replacement burden, allowing sales capacity to focus on net new growth.",
        watchSignal: watchSignals.retention
            ? "Retention is within the proximity zone (85-88%). A small decline would trigger structural friction."
            : undefined
    };

    // 2. Sales Pressure
    const salesStatus = scales.sales;
    const salesContent: PressureContent = {
        title: "Sales Pressure",
        status: salesStatus as any,
        score: pace.sales,
        maxScore: 15,
        insight: `Sales velocity must increase ${metrics.salesPaceRatio.toFixed(1)}x over baseline.`,
        contentBlock: metrics.salesPaceRatio >= 3.0
            ? "Tripling acquisition velocity is a structural transformation requirement — a fundamentally different sales motion, not an incremental lift."
            : metrics.salesPaceRatio >= 2.0
                ? "Doubling required acquisition rate introduces non-linear strain on pipeline and conversion capacity."
                : metrics.salesPaceRatio >= 1.5
                    ? "Moderate acceleration signals sales function demand beginning to exceed steady-state capacity."
                    : "Sales velocity requirements are within manageable range of current capacity.",
        watchSignal: watchSignals.salesPace
            ? `Sales velocity ratio is ${metrics.salesPaceRatio.toFixed(2)}x — approaching the 1.5x moderate pressure threshold.`
            : undefined
    };

    // 3. Hiring Pressure (Maps to Capacity Pressure in UI)
    const hiringStatus = scales.hiring;
    const hiringContent: PressureContent = {
        title: "Capacity Pressure",
        status: hiringStatus as any,
        score: pace.hiring,
        maxScore: 15,
        insight: `Hiring velocity of ${(metrics.hiringPaceRate * 100).toFixed(1)}% per quarter required.`,
        contentBlock: metrics.hiringPaceRate > 0.30
            ? "Growth at this pace effectively rebuilds the team every three quarters — a categorically different risk profile."
            : metrics.hiringPaceRate > 0.20
                ? "Management bandwidth and institutional knowledge transfer begin to degrade simultaneously."
                : metrics.hiringPaceRate > 0.10
                    ? "Elevated headcount growth places meaningful demand on onboarding and integration."
                    : "Hiring pace is within manageable range for organic culture absorption.",
        watchSignal: watchSignals.hiringPace
            ? `Hiring rate is ${(metrics.hiringPaceRate * 100).toFixed(1)}% — approaching the 11% elevated pressure threshold.`
            : undefined
    };

    // 4. Margin Pressure
    const marginStatus = scales.margin;
    const marginContent: PressureContent = {
        title: "Margin Pressure",
        status: marginStatus as any,
        score: friction.profit,
        maxScore: 18,
        insight: metrics.profitMargin < 0.20
            ? "Profit margins are compressed, limiting growth funding."
            : "Healthy margins provide capital buffer for execution.",
        contentBlock: metrics.profitMargin < 0.10
            ? "Below 10%, growth investment must effectively be borrowed against future revenue — there is no fuel reserve."
            : metrics.profitMargin < 0.15
                ? "Low-teen margins eliminate the financial buffer to absorb mid-execution setbacks."
                : metrics.profitMargin < 0.20
                    ? "Below 20%, capital available to fund sales capacity and talent is meaningfully constrained."
                    : metrics.profitMargin < 0.25
                        ? "Adequate margin leaves limited buffer to absorb execution variance."
                        : "Full tank. Strong margins provide the capital resilience needed for aggressive growth.",
        watchSignal: watchSignals.profit
            ? "Margin is between 20-23% — just above the pressure threshold."
            : undefined
    };

    // 5. Concentration Risk
    const concentrationContent: PressureContent = {
        title: "Concentration Risk",
        status: friction.concentration > 0 ? 'high' : 'low',
        score: friction.concentration,
        maxScore: 10,
        insight: friction.concentration > 0
            ? "Portfolio is concentrated (<10 clients)."
            : "Client portfolio is well distributed.",
        contentBlock: friction.concentration > 0
            ? "At fewer than ten clients, a single client departure is a trajectory event during a growth push, not just a revenue event."
            : "A distributed portfolio protects the growth trajectory from single-client volatility.",
        watchSignal: watchSignals.concentration
            ? "Client count is 10-11. One departure would trigger concentration friction."
            : undefined
    };

    // 6. Positioning Pressure
    // acvDelta is already computed in the engine as a ratio — reuse it
    const acvDelta = metrics.acvDelta ?? 0;

    const positioningStatus = friction.positioning >= 10 ? 'high' : friction.positioning >= 5 ? 'moderate' : 'low';
    const positioningContent: PressureContent = {
        title: "Positioning Pressure",
        status: positioningStatus as any,
        score: friction.positioning,
        maxScore: 10,
        insight: `Target ACV represents a ${(acvDelta * 100).toFixed(1)}% shift from baseline.`,
        contentBlock: friction.positioning >= 10
            ? "A 50%+ ACV increase requires qualitative market repositioning — different buyer, different sales motion."
            : friction.positioning >= 5
                ? "A meaningful upmarket shift implies real conversion and retention risk as the business evolves."
                : "Pricing evolution is within standard range and does not require fundamental repositioning.",
        watchSignal: watchSignals.positioning
            ? `Target ACV represents a ${(metrics.acvDelta * 100).toFixed(1)}% increase over current — just below the 25% upmarket shift threshold. If actual pricing moves above $${formatNumberWithCommas(Math.round(result.resolved.currentACV * 1.25))} during execution, this crosses into scored territory.`
            : undefined
    };

    // 7. Capacity Utilization
    const capacityStatus = pace.capacity >= 15 ? 'high' : pace.capacity >= 8 ? 'moderate' : 'low';
    const capacityContent: PressureContent = {
        title: "Capacity Economics",
        status: capacityStatus as any,
        score: pace.capacity,
        maxScore: 15,
        insight: `Target AGI per FTE is $${formatNumberWithCommas(Math.round(metrics.targetAGIPerFTE))}.`,
        contentBlock: pace.capacity >= 15
            ? "Capacity economics are significantly below healthy levels, indicating material delivery model strain or pricing misalignment."
            : pace.capacity >= 8
                ? "Capacity leverage is under pressure, leaving limited room for operational variance or team investment."
                : "Capacity leverage remains healthy, ensuring a sustainable structural cushion between revenue and delivery cost.",
        watchSignal: watchSignals.capacity
            ? `Target AGI per FTE is $${formatNumberWithCommas(Math.round(metrics.targetAGIPerFTE))} — approaching the $160K healthy leverage floor.`
            : undefined
    };

    return {
        retention: retentionContent,
        sales: salesContent,
        hiring: hiringContent,
        margin: marginContent,
        concentration: concentrationContent,
        positioning: positioningContent,
        capacity: capacityContent
    };
};

export const generateDbPressureInsights = (result: GVIScoreResult): GVSPressureInsights => {
    const pc = generatePressureContent(result);
    const imp = generateDbImplications(result);
    
    const mapStatus = (pts: number, status: string) => {
        if (pts === 0) return 'clean';
        if (status === 'high' || status === 'moderate') return 'warning';
        return 'stable';
    };
    
    return {
        retention: { 
            headline: pc.retention.insight, 
            rationale: pc.retention.contentBlock,
            status: mapStatus(imp.retention.pts, pc.retention.status),
            friction_pts: imp.retention.pts,
            watch_signal: imp.retention.watch_signal,
            watch_signal_note: imp.retention.watch_signal_note
        },
        sales: { 
            headline: pc.sales.insight, 
            rationale: pc.sales.contentBlock,
            status: mapStatus(imp.sales_pace.pts, pc.sales.status),
            friction_pts: imp.sales_pace.pts,
            watch_signal: imp.sales_pace.watch_signal,
            watch_signal_note: imp.sales_pace.watch_signal_note
        },
        hiring: { 
            headline: pc.hiring.insight, 
            rationale: pc.hiring.contentBlock,
            status: mapStatus(imp.hiring_pace.pts, pc.hiring.status),
            friction_pts: imp.hiring_pace.pts,
            watch_signal: imp.hiring_pace.watch_signal,
            watch_signal_note: imp.hiring_pace.watch_signal_note
        },
        margin: { 
            headline: pc.margin.insight, 
            rationale: pc.margin.contentBlock,
            status: mapStatus(imp.profit_margin.pts, pc.margin.status),
            friction_pts: imp.profit_margin.pts,
            watch_signal: imp.profit_margin.watch_signal,
            watch_signal_note: imp.profit_margin.watch_signal_note
        },
        concentration: { 
            headline: pc.concentration.insight, 
            rationale: pc.concentration.contentBlock,
            status: mapStatus(imp.concentration.pts, pc.concentration.status),
            friction_pts: imp.concentration.pts,
            watch_signal: imp.concentration.watch_signal,
            watch_signal_note: imp.concentration.watch_signal_note
        },
        positioning: { 
            headline: pc.positioning.insight, 
            rationale: pc.positioning.contentBlock,
            status: mapStatus(imp.positioning.pts, pc.positioning.status),
            friction_pts: imp.positioning.pts,
            watch_signal: imp.positioning.watch_signal,
            watch_signal_note: imp.positioning.watch_signal_note
        }
    };
};

// --- Synthesis Logic (Section 5 Replacement & Section 7 Watch Signals) ---

export const generateSynthesis = (result: GVIScoreResult): SynthesisContent => {
    const { score, compositionLabel, band, watchSignals, components } = result;

    // Headline Logic
    let headline = "";
    if (compositionLabel === "Ambition-Driven") {
        headline = `A structurally sound business facing aggressive execution demands — not a foundation problem.`;
    } else if (compositionLabel === "Structural Constraint") {
        headline = `Structural constraints are carrying more weight than the growth target itself.`;
    } else if (compositionLabel === "Structure-Driven") {
        headline = `The pressure in this scenario is primarily structural rather than execution-driven.`;
    } else {
        headline = `Execution demands and structural constraints are working against each other simultaneously.`;
    }

    // Narrative Logic
    const targetRev = `$${formatNumberWithCommas(result.resolved.targetAGI)}`;

    // Calculate top deductions for narrative focus
    const deductions = [
        { label: "retention friction", score: components.friction.retention },
        { label: "profit margin pressure", score: components.friction.profit },
        { label: "sales velocity requirements", score: components.pace.sales },
        { label: "hiring pace", score: components.pace.hiring },
        { label: "concentration risk", score: components.friction.concentration },
        { label: "positioning pressure", score: components.friction.positioning }
    ].sort((a, b) => b.score - a.score);

    const topDrivers = deductions.filter(d => d.score > 0).slice(0, 2).map(d => d.label).join(" and ");

    let narrative = `To achieve ${targetRev} revenue requires a GVI score of ${score}. This places you in the ${band} zone, driven by ${compositionLabel.toLowerCase()} factors`;

    if (topDrivers) {
        narrative += `, primarily ${topDrivers}. `;
    } else {
        narrative += `. `;
    }

    narrative += getCompositionNote(compositionLabel);

    // Watch Signals (Section 7)
    const signals = [];
    if (watchSignals.retention) signals.push("Retention is near the friction threshold.");
    if (watchSignals.profit) signals.push("Profit margins are approaching the pressure zone.");
    if (watchSignals.concentration) signals.push("Client concentration is borderline high.");
    if (watchSignals.salesPace) signals.push("Sales velocity is approaching moderate pressure.");
    if (watchSignals.hiringPace) signals.push("Hiring pace is nearing the elevated risk threshold.");

    if (signals.length > 0) {
        narrative += " " + signals.join(" ");
    }

    return {
        headline,
        narrative
    };
};

/**
 * Generates the implications object specifically formatted for DB storage
 * as per the GVI Formula Specification.
 */
export const generateDbImplications = (result: GVIScoreResult): GVSImplications => {
    const { components, watchSignals, metrics } = result;
    const { pace, friction } = components;

    const implications: GVSImplications = {};

    // 1. Retention
    implications.retention = {
        pts: friction.retention,
        tier_label: friction.retention >= 20 ? "Treadmill effect" : friction.retention >= 10 ? "Replacement drag" : "Healthy retention",
        status: friction.retention > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.retention,
        watch_signal_note: watchSignals.retention 
            ? `Retention is ${(metrics.retentionRate * 100).toFixed(1)}% — within the proximity zone. A decline below 85% will trigger structural friction.` 
            : ""
    };

    // 2. Sales Pace
    implications.sales_pace = {
        pts: pace.sales,
        tier_label: pace.sales >= 15 ? "Structural transformation required" : pace.sales >= 10 ? "Significant acceleration" : pace.sales >= 5 ? "Moderate stretch" : "Within current capacity",
        status: pace.sales > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.salesPace,
        watch_signal_note: watchSignals.salesPace ? `Sales velocity ratio is ${metrics.salesPaceRatio.toFixed(2)}x — approaching the 1.5x moderate pressure threshold.` : ""
    };

    // 3. Hiring Pace
    implications.hiring_pace = {
        pts: pace.hiring,
        tier_label: pace.hiring >= 15 ? "Structural integration risk" : pace.hiring >= 10 ? "Culture strain threshold" : pace.hiring >= 5 ? "Elevated pace" : "Manageable growth",
        status: pace.hiring > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.hiringPace,
        watch_signal_note: watchSignals.hiringPace ? `Hiring rate is ${(metrics.hiringPaceRate * 100).toFixed(1)}% — approaching the 11% elevated pressure threshold.` : ""
    };

    // 4. Capacity Utilization
    implications.capacity_utilization = {
        pts: pace.capacity,
        tier_label: pace.capacity >= 15 ? "Delivery model strain" : pace.capacity >= 8 ? "Efficiency under pressure" : "Healthy leverage",
        status: pace.capacity > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.capacity,
        watch_signal_note: watchSignals.capacity ? `Target AGI per FTE is $${formatNumberWithCommas(Math.round(metrics.targetAGIPerFTE))} — approaching the $160K healthy leverage floor.` : ""
    };

    // 5. Profit Margin
    implications.profit_margin = {
        pts: friction.profit,
        tier_label: friction.profit >= 18 ? "Empty tank" : friction.profit >= 13 ? "Low fuel" : friction.profit >= 8 ? "Half tank" : friction.profit >= 3 ? "Adequate fuel" : "Full tank",
        status: friction.profit > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.profit,
        watch_signal_note: watchSignals.profit 
            ? `Margin is ${(metrics.profitMargin * 100).toFixed(1)}% — within the proximity zone. A decline below 20% will trigger financial friction.` 
            : ""
    };

    // 6. Concentration
    implications.concentration = {
        pts: friction.concentration,
        tier_label: friction.concentration > 0 ? "Concentration risk" : "Distributed portfolio",
        status: friction.concentration > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.concentration,
        watch_signal_note: watchSignals.concentration 
            ? `Client count is ${metrics.clientCount} — one client departure would bring this below the 10-client risk boundary.` 
            : ""
    };

    // 7. Positioning
    const thresholdACV = result.resolved.currentACV * 1.25;
    implications.positioning = {
        pts: friction.positioning,
        tier_label: friction.positioning >= 10 ? "Repositioning event" : friction.positioning >= 5 ? "Upmarket shift" : "Pricing evolution",
        status: friction.positioning > 0 ? 'active' : 'clean',
        watch_signal: watchSignals.positioning,
        watch_signal_note: watchSignals.positioning 
            ? `Target ACV represents a ${(metrics.acvDelta * 100).toFixed(1)}% increase over current — just below the 25% upmarket shift threshold. If actual pricing moves above $${formatNumberWithCommas(Math.round(thresholdACV))} during execution, this crosses into scored territory.` 
            : ""
    };

    return implications;
};
