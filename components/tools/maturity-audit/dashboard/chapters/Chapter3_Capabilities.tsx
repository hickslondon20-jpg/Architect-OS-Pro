import React, { useState } from 'react';
import { Card, Badge, Button } from '../../../../ui';
import {
    ArrowRight,
    Target,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    X,
    Layers,
    TrendingUp
} from 'lucide-react';

interface Chapter3Props {
    onNext: () => void;
}

// --- Mock Types ---
interface Capability {
    id: number;
    rank: number;
    name: string;
    dimension: string;
    maturity: number;
    stageFit: 'Below Stage' | 'At Stage' | 'Ahead Stage';
    weightedGap: number;
    priority: 'High Priority' | 'Medium Priority' | 'Strength';
    staticDescription: string; // What good looks like
    personalizedInsight: string;
    rationale: string; // Why it's a leverage point/strength
}

// --- Mock Data Generator tool ---
const generateMockCapabilities = (): Capability[] => {
    const caps: Capability[] = [];

    // Core Dimensions and Names
    const dimensions = ['Team Structure', 'Financial Health', 'Operations', 'Client Portfolio', 'Strategic Stewardship'];
    const names = [
        "Role Clarity & Delegation", "Leadership Cadence", "Client Qualification Discipline",
        "Weekly Financial Review", "Service Delivery Process", "Cash Flow Forecasting",
        "Team Development Rhythms", "Strategic Planning Cadence", "Delivery Documentation",
        "Pipeline Management", "Pricing Strategy", "Employee Onboarding",
        "Client Onboarding Process", "Quality Assurance & Review", "Tech Stack Optimization",
        "Goal Setting & tracking", "Meeting Rhythms", "Profitability Analysis",
        "Proposal Development", "Account Management", "Feedback Loops",
        "Resource Planning", "Brand Positioning", "Marketing Consistency", "Legal & Compliance"
    ];

    for (let i = 1; i <= 25; i++) {
        const dimIndex = i % 5;
        let priority: Capability['priority'] = 'Medium Priority';
        let stageFit: Capability['stageFit'] = 'At Stage';
        let maturity = Math.floor(Math.random() * (85 - 40) + 40);
        let weightedGap = parseFloat((Math.random() * (7 - 2) + 2).toFixed(1));

        // Logic to skew data based on rank
        if (i <= 8) {
            priority = 'High Priority';
            stageFit = 'Below Stage';
            maturity = Math.floor(Math.random() * (55 - 30) + 30); // Lower maturity for high priority
            weightedGap = parseFloat((Math.random() * (10 - 7) + 7).toFixed(1));
        } else if (i > 20) {
            priority = 'Strength';
            stageFit = 'Ahead Stage';
            maturity = Math.floor(Math.random() * (95 - 75) + 75); // Higher maturity for strengths
            weightedGap = parseFloat((Math.random() * (2 - 0.5) + 0.5).toFixed(1));
        }

        caps.push({
            id: i,
            rank: i,
            name: names[i - 1] || `Capability ${i}`,
            dimension: dimensions[dimIndex],
            maturity,
            stageFit,
            weightedGap,
            priority,
            staticDescription: "At the Striving stage, good looks like having clear role definitions where every team member knows their explicit accountabilities, reducing reliance on founder direction for daily decisions.",
            personalizedInsight: `Your score of ${maturity}% reflects emerging structures, but inconsistent follow-through creates friction. Because this capability sits ${stageFit}, it exerts disproportionate drag on your readiness.`,
            rationale: i <= 5
                ? "High gap-to-impact ratio; fixing this unlocks capacity across all other functions."
                : "Provides necessary stability but is not currently a bottleneck."
        });
    }
    return caps;
};

const mockCapabilities = generateMockCapabilities();

// --- Components ---

export const Chapter3_Capabilities: React.FC<Chapter3Props> = ({ onNext }) => {
    const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);

    // Helpers
    const getPriorityColor = (p: string) => {
        if (p === 'High Priority') return 'text-[var(--aos-risk)] bg-[var(--aos-risk-tint)] border-[var(--aos-risk)]';
        if (p === 'Medium Priority') return 'text-[var(--aos-warning)] bg-[var(--aos-warning-tint)] border-[var(--aos-warning)]';
        return 'text-[var(--aos-success)] bg-[var(--aos-success-tint)] border-[var(--aos-success)]';
    };

    const getStageFitColor = (f: string) => {
        if (f === 'Below Stage') return 'text-[var(--aos-warning)] bg-[var(--aos-warning-tint)]';
        if (f === 'At Stage') return 'text-[var(--aos-insight)] bg-[var(--aos-insight-tint)]';
        return 'text-[var(--aos-success)] bg-[var(--aos-success-tint)]';
    };

    const getBarColor = (p: string) => {
        if (p === 'High Priority') return 'bg-[var(--aos-risk)]';
        if (p === 'Medium Priority') return 'bg-[var(--aos-warning)]';
        return 'bg-[var(--aos-success)]';
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-24 relative">

            {/* SECTION 1: Headline Framing */}
            <div className="max-w-4xl mx-auto text-left space-y-3 px-4 md:px-0">
                <h1 className="text-3xl md:text-4xl font-bold text-[var(--fg-1)] tracking-tight">
                    Where Structural Leverage Lives
                </h1>
                <p className="text-lg text-[var(--fg-3)] font-normal leading-relaxed max-w-3xl">
                    Of the 25 core capabilities that shape your business, these are the ones exerting the most influence on your readiness and growth trajectory right now.
                </p>
            </div>

            {/* SECTION 2 & 3: Top Leverage & Strengths Cards */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 md:px-0">
                {/* Top Leverage Card */}
                <Card className="p-0 border border-[var(--aos-mist)] bg-[var(--bg-canvas)] shadow-[var(--shadow-soft-1)] relative overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Target className="h-24 w-24 text-[var(--fg-4)]" />
                        </div>
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                            <div className="p-2 bg-[var(--aos-brass-tint)] rounded-lg">
                                <Target className="h-5 w-5 text-[var(--aos-brass)]" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--fg-1)]">Your Top Leverage Capabilities</h3>
                        </div>
                        <p className="text-sm text-[var(--fg-2)] relative z-10">
                            These five capabilities have the largest weighted impact on your readiness due to urgency, stage fit, and structural gaps.
                        </p>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--bg-canvas)] text-[var(--fg-3)] font-bold uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-3 w-1/2">Capability</th>
                                    <th className="px-6 py-3 w-1/2">Why it Matters (Rationale)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--aos-mist)] bg-[var(--bg-surface)]">
                                {mockCapabilities.slice(0, 5).map((cap, i) => (
                                    <tr key={cap.id} className="hover:bg-[var(--bg-canvas)]">
                                        <td className="px-6 py-4 font-bold text-[var(--fg-1)] align-top">
                                            <div className="flex gap-3">
                                                <span className="text-[var(--fg-4)] font-normal text-xs mt-0.5">{i + 1}.</span>
                                                {cap.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--fg-2)] text-xs leading-relaxed align-top">
                                            {cap.rationale}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Strengths Card */}
                <Card className="p-0 border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] relative overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <CheckCircle2 className="h-24 w-24 text-[var(--fg-4)]" />
                        </div>
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                            <div className="p-2 bg-[var(--aos-brass-tint)] rounded-lg">
                                <CheckCircle2 className="h-5 w-5 text-[var(--aos-brass)]" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--fg-1)]">Your Capability Strengths</h3>
                        </div>
                        <p className="text-sm text-[var(--fg-2)] relative z-10">
                            These capabilities are performing at or ahead of stage expectations and provide structural stability.
                        </p>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--bg-canvas)] text-[var(--fg-3)] font-bold uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-3 w-1/2">Capability</th>
                                    <th className="px-6 py-3 w-1/2">Why it Matters (Rationale)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--aos-mist)] bg-[var(--bg-surface)]">
                                {mockCapabilities.slice(20, 23).map((cap) => (
                                    <tr key={cap.id} className="hover:bg-[var(--bg-canvas)]">
                                        <td className="px-6 py-4 font-bold text-[var(--fg-1)] align-top">
                                            <div className="flex gap-3">
                                                <CheckCircle2 className="h-4 w-4 text-[var(--fg-3)] flex-shrink-0 mt-0.5" />
                                                {cap.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--fg-2)] text-xs leading-relaxed align-top">
                                            Performing ahead of stage expectations; provides a reliable foundation for growth.
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* SECTION 4: Full Capability Priority Stack */}
            <div className="max-w-7xl mx-auto px-4 md:px-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--fg-3)] uppercase tracking-widest">Full Capability Priority Stack</h3>
                    <Badge color="gray">{mockCapabilities.length} Capabilities Assessed</Badge>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg shadow-[var(--shadow-soft-1)] overflow-hidden">
                    {/* Header Row */}
                    <div className="hidden md:flex items-center px-6 py-4 bg-[var(--bg-canvas)] border-b border-[var(--aos-mist)] text-xs font-bold text-[var(--fg-3)] uppercase tracking-wider">
                        <div className="w-16 text-center">Rank</div>
                        <div className="w-1/4">Capability & Dimension</div>
                        <div className="flex-grow pl-8">What Good Looks Like (Context)</div>
                        <div className="w-32 text-center">Stage Fit</div>
                        <div className="w-40 text-right pr-4">Priority</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-[var(--aos-mist)]">
                        {mockCapabilities.map((cap) => (
                            <button
                                key={cap.id}
                                onClick={() => setSelectedCapability(cap)}
                                className="w-full group flex flex-col md:flex-row md:items-start px-6 py-6 hover:bg-[var(--bg-canvas)] transition-colors text-left"
                            >
                                {/* Rank */}
                                <div className="flex items-center md:block mb-2 md:mb-0 w-full md:w-16 flex-shrink-0">
                                    <span className="md:hidden text-xs font-bold text-[var(--fg-4)] mr-2">Rank</span>
                                    <div className="text-sm font-bold text-[var(--fg-4)] group-hover:text-[var(--fg-2)] text-center md:mt-1">{cap.rank}</div>
                                </div>

                                {/* Name & Dimension */}
                                <div className="w-full md:w-1/4 mb-3 md:mb-0 pr-4 flex-shrink-0">
                                    <div className="text-base font-bold text-[var(--fg-1)] group-hover:text-[var(--aos-insight)] transition-colors mb-1">
                                        {cap.name}
                                    </div>
                                    <div className="text-xs text-[var(--fg-3)] font-medium uppercase tracking-wide flex items-center gap-1.5">
                                        <Layers className="h-3 w-3" />
                                        {cap.dimension}
                                    </div>
                                </div>

                                {/* Description (What Good Looks Like) - Replaces Maturity Bar */}
                                <div className="flex-grow mb-3 md:mb-0 pl-0 md:pl-4 pr-8">
                                    <p className="text-sm text-[var(--fg-2)] leading-relaxed line-clamp-2 md:line-clamp-3">
                                        {cap.staticDescription}
                                    </p>
                                </div>

                                {/* Stage Fit Badge */}
                                <div className="w-full md:w-32 mb-3 md:mb-0 flex items-center justify-start md:justify-center flex-shrink-0 md:mt-1">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${getStageFitColor(cap.stageFit)}`}>
                                        {cap.stageFit}
                                    </span>
                                </div>

                                {/* Priority Flag */}
                                <div className="w-full md:w-40 md:text-right md:pr-4 flex items-center md:justify-end flex-shrink-0 md:mt-1">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(cap.priority)}`}>
                                        {cap.priority === 'High Priority' && <AlertTriangle className="h-3.5 w-3.5" />}
                                        {cap.priority === 'Medium Priority' && <AlertCircle className="h-3.5 w-3.5" />}
                                        {cap.priority === 'Strength' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                        {cap.priority}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION 6: Closing Synthesis */}
            <div className="max-w-4xl mx-auto px-4 md:px-0 pt-8">
                <div className="bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-xl p-8 shadow-[var(--shadow-soft-1)]">
                    <p className="text-base md:text-lg text-[var(--fg-2)] leading-relaxed">
                        Your capability profile reveals concentrated leverage in <strong className="text-[var(--fg-1)]">Team and Stewardship systems</strong>, where foundational structures like role clarity and leadership cadence are still forming. Meanwhile, <strong className="text-[var(--fg-1)]">Operations and Financial capabilities</strong> provide stability that can be leveraged once these structural constraints are addressed. Focusing on the five high-priority capabilities will give you the clearest path toward readiness and stage advancement.
                    </p>
                </div>
            </div>

            {/* SECTION 7: CTA Button */}
            <div className="flex justify-center pt-8">
                <Button
                    onClick={onNext} // Navigate to Ch4
                    className="group bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] px-8 py-6 text-lg rounded-full shadow-[var(--shadow-soft-2)]"
                >
                    Explore Root Causes
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
            </div>


            {/* SECTION 5: Capability Detail Pop-up Modal */}
            {selectedCapability && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div
                        className="absolute inset-0 backdrop-blur-sm"
                        style={{ backgroundColor: 'rgba(25, 48, 82, 0.4)' }}
                        onClick={() => setSelectedCapability(null)}
                    />
                    <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-[var(--aos-mist)] flex items-start justify-between bg-[var(--bg-surface)] sticky top-0 z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-[var(--bg-canvas)] text-[var(--fg-2)]">{selectedCapability.dimension}</Badge>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${getStageFitColor(selectedCapability.stageFit)}`}>
                                        {selectedCapability.stageFit}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-[var(--fg-1)] leading-tight">
                                    {selectedCapability.name}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedCapability(null)}
                                className="p-2 hover:bg-[var(--bg-canvas)] rounded-full text-[var(--fg-4)] hover:text-[var(--fg-1)] transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)]">
                                    <div className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-wider mb-1">Maturity Score</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-black text-[var(--fg-1)]" style={{ fontFamily: 'var(--font-mono)' }}>{selectedCapability.maturity}%</div>
                                        <div className="h-1.5 flex-grow bg-[var(--aos-mist)] rounded-full max-w-[60px] ml-2">
                                            <div className={`h-full rounded-full ${getBarColor(selectedCapability.priority)}`} style={{ width: `${selectedCapability.maturity}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)]">
                                    <div className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-wider mb-1">Weighted Gap</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-black text-[var(--fg-1)]" style={{ fontFamily: 'var(--font-mono)' }}>{selectedCapability.weightedGap}</div>
                                        <span className="text-xs font-medium text-[var(--fg-3)]">/ 10.0</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Section: What this represents */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--aos-mist)]">
                                        <Layers className="h-4 w-4 text-[var(--aos-insight)]" />
                                        <h4 className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest">What This Capability Represents</h4>
                                    </div>
                                    <p className="text-[var(--fg-2)] leading-relaxed">
                                        {selectedCapability.staticDescription}
                                    </p>
                                </div>

                                {/* Section: Why this matters (Insight) */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--aos-mist)]">
                                        <TrendingUp className="h-4 w-4 text-[var(--aos-insight)]" />
                                        <h4 className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest">Why This Matters For You</h4>
                                    </div>
                                    <div className="bg-[var(--aos-insight-tint)] p-5 rounded-lg border border-[var(--aos-insight)]">
                                        <p className="text-[var(--fg-1)] leading-relaxed font-medium">
                                            {selectedCapability.personalizedInsight}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer Note */}
                                <div className="pt-4 border-t border-[var(--aos-mist)]">
                                    <p className="text-xs text-[var(--fg-4)] font-medium">
                                        Underlying Checkpoints: 5 assessed • <span className="underline cursor-pointer hover:text-[var(--aos-insight)]">See details in library</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
