import React, { useState } from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip
} from 'recharts';
import { Card, Badge, Button } from '../../../../ui';
import { ArrowRight, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface Chapter2Props {
    onNext: () => void;
}

interface DimensionData {
    id: string;
    name: string;
    score: number; // Maturity %
    readiness: number; // Readiness %
    label: string; // "Stage Fit"
    variance: 'Below' | 'At' | 'Ahead';
    color: 'emerald' | 'blue' | 'amber' | 'orange' | 'red';
    microInsight: string;
    summary: string;
}

export const Chapter2_Systems: React.FC<Chapter2Props> = ({ onNext }) => {
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    // Mock Data updated for Stewardship and new metrics
    const data = [
        { subject: 'Financial', A: 64, fullMark: 100 },
        { subject: 'Clients', A: 56, fullMark: 100 },
        { subject: 'Operations', A: 52, fullMark: 100 },
        { subject: 'Team', A: 48, fullMark: 100 },
        { subject: 'Stewardship', A: 43, fullMark: 100 }, // Renamed from Strategy
    ];

    const dimensions: DimensionData[] = [
        {
            id: 'fin',
            name: 'Financial Health',
            score: 64,
            readiness: 82,
            label: 'At Stage',
            variance: 'At',
            color: 'emerald',
            microInsight: "Strong controls are in place, but forecasting accuracy needs to tighten to support the next leap.",
            summary: "Your financial systems are robust for your current size. The focus now shifts from basic bookkeeping to forward-looking accrual accounting and deal-level profitability analysis to support scaling decisions."
        },
        {
            id: 'cli',
            name: 'Client Portfolio',
            score: 56,
            readiness: 70,
            label: 'At Stage',
            variance: 'At',
            color: 'blue',
            microInsight: "Retention is high, but acquisition reliability varies month-to-month, creating cash flow lumps.",
            summary: "You have a solid base of core clients. To advance, you must move from 'taking everything' to defined ideal client profiles (ICPs) and systematic upsell processes."
        },
        {
            id: 'ops',
            name: 'Operations',
            score: 52,
            readiness: 45,
            label: 'Below Stage',
            variance: 'Below',
            color: 'amber',
            microInsight: "Delivery success still relies heavily on founder oversight rather than documented standard procedures.",
            summary: "Operations are functional but fragile. The lack of standardized workflows means quality depends on who is doing the work. Documentation is the critical missing link here."
        },
        {
            id: 'team',
            name: 'Team Structure',
            score: 48,
            readiness: 30,
            label: 'Below Stage',
            variance: 'Below',
            color: 'orange',
            microInsight: "Role clarity is the primary friction point; too many generalists are creating bottlenecks.",
            summary: "Your team is eager but structurally misaligned. You have outgrown the 'everyone does everything' model. Specialized roles and clear accountability charts are urgent needs."
        },
        {
            id: 'strat',
            name: 'Strategic Stewardship', // Updated Name
            score: 43,
            readiness: 40,
            label: 'Emerging', // Or Below
            variance: 'Below',
            color: 'red',
            microInsight: "Strategic planning is reactive to client demands rather than proactive for agency equity growth.",
            summary: "You are stewarding the work, not the business. Moving to Thriving requires carving out dedicated 'on the business' time by delegating day-to-day delivery decisions."
        },
    ];

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="max-w-4xl mx-auto text-center space-y-4">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--bg-canvas)] text-[var(--fg-2)] text-xs font-bold uppercase tracking-wider border border-[var(--aos-mist)]">
                    Chapter 2
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--fg-1)] tracking-tight">
                    The Shape of Your Business
                </h1>
                <p className="text-lg text-[var(--fg-2)] max-w-2xl mx-auto">
                    Your "Business Shape" is asymmetrical. You have strong financial foundations but are over-reliant on heroics in Operations and Team structure.
                </p>
            </div>

            {/* Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">

                {/* Left: Radar Chart */}
                <Card className="p-8 border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] flex flex-col items-center min-h-[500px] justify-center relative overflow-hidden">
                    <div className="absolute top-6 left-6 z-10 p-4 max-w-xs pointer-events-none">
                        <h3 className="text-sm font-bold text-[var(--aos-steel-blue)] uppercase tracking-wider mb-1">System Balance</h3>
                        <p className="text-sm text-[var(--fg-3)]">
                            A balanced shape indicates sustainable growth. Spikes indicate robust areas; dips indicate bottlenecks.
                        </p>
                    </div>

                    <div className="w-full h-[400px] mt-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name="Maturity"
                                    dataKey="A"
                                    stroke="#0f172a"
                                    strokeWidth={3}
                                    fill="#0f172a"
                                    fillOpacity={0.1}
                                />
                                <Tooltip
                                    formatter={(value: number) => [`${value}%`, 'Maturity']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Right: Dimension Cards */}
                <div className="space-y-4 relative">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--aos-mist)] mb-4">
                        <span className="text-sm font-bold text-[var(--fg-3)] uppercase tracking-wider">Dimension Breakdown</span>
                    </div>

                    {dimensions.map((dim) => (
                        <div key={dim.id} className="relative">
                            {/* Base Card (The "Briefing Note") */}
                            <Card
                                onClick={() => setExpandedCard(expandedCard === dim.id ? null : dim.id)}
                                className={`p-5 border bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] hover:shadow-md transition-all cursor-pointer group relative z-10
                                    ${expandedCard === dim.id ? 'border-[var(--aos-brass)] ring-1 ring-[var(--aos-brass)]' : 'border-[var(--aos-mist)] hover:border-[var(--aos-steel-blue)]'}
                                `}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {/* Score Badge */}
                                        <div className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center font-bold text-sm border
                                            ${dim.color === 'emerald' ? 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]' :
                                                dim.color === 'blue' ? 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]' :
                                                    dim.color === 'amber' ? 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]' :
                                                        dim.color === 'orange' ? 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]' :
                                                            'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] border-[var(--aos-risk)]'
                                            }`}
                                        >
                                            <span className="text-base leading-none">{dim.score}%</span>
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-[var(--fg-1)]">{dim.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] items-center px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border
                                                    ${dim.variance === 'At' ? 'bg-[var(--bg-canvas)] text-[var(--fg-2)] border-[var(--aos-mist)]' :
                                                        dim.variance === 'Ahead' ? 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]' :
                                                            'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]'}
                                                `}>
                                                    {dim.variance} Stage Fit
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {expandedCard === dim.id ? <X className="h-5 w-5 text-[var(--fg-4)]" /> : <ArrowRight className="h-5 w-5 text-[var(--fg-on-dark)]" />}
                                    </div>
                                </div>
                            </Card>

                            {/* Expanded Details Overlay (Pops "out" below the card or overlaying) */}
                            {expandedCard === dim.id && (
                                <div className="mt-2 p-6 bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-xl shadow-inner animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-4 mb-4 border-b border-[var(--aos-mist)] pb-4">
                                        <div>
                                            <div className="text-xs text-[var(--fg-3)] uppercase font-bold tracking-wider mb-1">Maturity</div>
                                            <div className="text-2xl font-black text-[var(--fg-1)]">{dim.score}%</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--fg-3)] uppercase font-bold tracking-wider mb-1">Readiness</div>
                                            <div className="text-2xl font-black text-[var(--fg-1)]">{dim.readiness}%</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Micro Insight */}
                                        <div className="flex gap-3">
                                            <Info className="h-5 w-5 text-[var(--aos-insight)] flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-[var(--fg-1)] leading-snug">
                                                    "{dim.microInsight}"
                                                </p>
                                            </div>
                                        </div>

                                        {/* Static Summary */}
                                        <p className="text-xs text-[var(--fg-2)] leading-relaxed pl-8">
                                            {dim.summary}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* System Level Takeaways (New Section) */}
            <div className="max-w-6xl mx-auto">
                <Card className="p-8 border border-[var(--aos-mist)] bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <CheckCircle className="h-40 w-40 text-[var(--fg-on-dark)]" />
                    </div>

                    <div className="relative z-10 space-y-4" style={{ color: 'var(--fg-on-dark)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 rounded-full bg-[var(--aos-success)] animate-pulse"></div>
                            <span className="text-xs font-bold text-[var(--aos-success)] uppercase tracking-widest">System-Level Analysis</span>
                        </div>

                        <h3 className="text-2xl font-bold text-[var(--fg-on-dark)] tracking-tight">Your System-Level Takeaways</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-[var(--aos-slate-blue)]">
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-[var(--aos-steel-blue)] uppercase tracking-wide">Backbone</h4>
                                <p className="text-[var(--fg-on-dark)] leading-relaxed text-sm">
                                    Operational systems and client acquisition form the structural backbone of your agency, providing stability.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-[var(--aos-steel-blue)] uppercase tracking-wide">Primary Drag</h4>
                                <p className="text-[var(--fg-on-dark)] leading-relaxed text-sm">
                                    Team development presents the most significant readiness opportunity, currently creating friction in delivery.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-[var(--aos-steel-blue)] uppercase tracking-wide">Leverage Point</h4>
                                <p className="text-[var(--fg-on-dark)] leading-relaxed text-sm">
                                    Stewardship systems show early but uneven maturity patterns that influence your financial reliability.
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Action */}
            <div className="flex justify-center pt-8 pb-12">
                <Button
                    onClick={onNext}
                    className="group bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] px-8 py-6 text-lg rounded-full shadow-[var(--shadow-soft-2)]"
                >
                    Identify Key Levers
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
            </div>
        </div>
    );
};
