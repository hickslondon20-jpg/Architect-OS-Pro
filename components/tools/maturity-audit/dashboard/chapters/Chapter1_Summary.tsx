import React from 'react';
import { Card, Badge, Button } from '../../../../ui';
import { ArrowRight, Clock } from 'lucide-react';
import { QuadrantWidget } from '../QuadrantWidget';

interface Chapter1Props {
    onNext: () => void;
}

export const Chapter1_Summary: React.FC<Chapter1Props> = ({ onNext }) => {
    // Mock Data for Score Cards
    const maturityScore = 74;
    const readinessScore = 76;
    const stage = "Striving";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. Hero Headline ("The So What") */}
            <Card className="p-6 relative overflow-hidden border-l-4 border-l-[var(--aos-brass)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
                <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start">
                    <div className="space-y-4 max-w-4xl">
                        <div className="flex items-center gap-3">
                            <Badge color="blue" className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                Executive Summary
                            </Badge>
                            <span className="text-xs font-medium text-[var(--fg-3)] flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[var(--fg-4)]" />
                                Assessed on {new Date().toLocaleDateString()}
                            </span>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--fg-1)] leading-tight">
                            Your agency is structurally aligned with growth, but friction in Team Systems holds you back.
                        </h1>

                        <p className="text-base md:text-lg text-[var(--fg-2)] leading-relaxed max-w-3xl">
                            You have solid structural maturity ({maturityScore}%) and strong readiness momentum ({readinessScore}%), indicating you’re well-positioned to advance beyond {stage}.
                        </p>
                    </div>
                </div>

                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-50" style={{ backgroundColor: 'var(--aos-brass-tint)' }} />
            </Card>

            {/* 2. The Two Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 hover:shadow-md transition-all duration-300 group border border-[var(--aos-mist)] bg-[var(--bg-surface)]">
                    <div className="flex items-start justify-between mb-4">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--aos-success-tint)] text-[var(--aos-success)] uppercase tracking-wide border border-[var(--aos-success)]">
                            Structure
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-wider">Maturity Score</div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black text-[var(--fg-1)] tracking-tight" style={{ fontFamily: 'var(--font-mono)' }}>{maturityScore}%</span>
                            <span className="text-sm font-bold text-[var(--aos-success)] bg-[var(--aos-success-tint)] px-2 py-0.5 rounded">Confident</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--aos-mist)]">
                        <p className="text-[var(--fg-2)] leading-relaxed text-xs font-medium">
                            Measures how fully your systems, processes, and operating rhythms are developed relative to best practice.
                        </p>
                    </div>
                </Card>

                <Card className="p-6 hover:shadow-md transition-all duration-300 group border border-[var(--aos-mist)] bg-[var(--bg-surface)]">
                    <div className="flex items-start justify-between mb-4">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] uppercase tracking-wide border border-[var(--aos-insight)]">
                            Momentum
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-wider">Readiness Score</div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black text-[var(--fg-1)] tracking-tight" style={{ fontFamily: 'var(--font-mono)' }}>{readinessScore}%</span>
                            <span className="text-sm font-bold text-[var(--aos-insight)] bg-[var(--aos-insight-tint)] px-2 py-0.5 rounded">Stable</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--aos-mist)]">
                        <p className="text-[var(--fg-2)] leading-relaxed text-xs font-medium">
                            Measures how well your current structure can support advancement to your next AE stage.
                        </p>
                    </div>
                </Card>
            </div>



            {/* 3. The Quadrant Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Widget */}
                <Card className="lg:col-span-2 p-6 border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] overflow-hidden min-h-[450px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-bold text-[var(--fg-4)] uppercase tracking-wider">Strategic Matrix</div>
                        <Badge color="gray">Interactive</Badge>
                    </div>
                    <QuadrantWidget maturityScore={maturityScore} readinessScore={readinessScore} />
                </Card>

                {/* Contextual Insight Sidecar */}
                <Card className="p-8 border-l-4 border-l-[var(--aos-success)] bg-[var(--aos-success-tint)] flex flex-col justify-center shadow-[var(--shadow-soft-1)]">
                    <Badge color="green" className="self-start mb-4">Scale-Ready Zone</Badge>
                    <h3 className="text-2xl font-extrabold text-[var(--fg-1)] mb-4 tracking-tight">
                        You can confidently accelerate.
                    </h3>
                    <p className="text-[var(--fg-2)] leading-relaxed mb-6">
                        Your position in the <strong>Scale-Ready Zone</strong> reflects strong system maturity and aligned readiness.
                    </p>
                    <p className="text-sm text-[var(--fg-2)] border-t border-[var(--aos-mist)] pt-4">
                        <strong>Opportunity:</strong> Leverage your strengths in Financial & Operations to offset the drag in Team Systems.
                    </p>
                </Card>
            </div>

            {/* 4. Stage Perspective & Forward Look */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Section C: What Good Looks Like */}
                <Card className="p-8 border border-[var(--aos-mist)] bg-[var(--bg-canvas)] shadow-[var(--shadow-soft-1)]">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-[var(--fg-4)] uppercase tracking-wider">
                            Stage Context: {stage}
                        </span>
                        <div className="h-2 w-2 rounded-full bg-[var(--aos-success)]"></div>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--fg-1)] mb-3">
                        What Good Looks Like at This Stage
                    </h3>
                    <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                        At the <strong>{stage}</strong> stage, healthy agencies begin transitioning from founder-driven execution to systems-supported operations. Predictable delivery, reliable financial visibility, and clearer team roles emerge as core structural markers. Momentum is created by stabilizing client acquisition and strengthening delivery consistency.
                    </p>
                </Card>

                {/* Section D: Next Stage Requirements */}
                <Card className="p-8 border border-[var(--aos-insight-tint)] bg-[var(--aos-insight-tint)] shadow-[var(--shadow-soft-1)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowRight className="h-24 w-24 text-[var(--aos-insight)] -rotate-45" />
                    </div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-xs font-bold text-[var(--aos-insight)] uppercase tracking-wider">
                            The Path Forward
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--fg-1)] mb-3 relative z-10">
                        What Advancing to the Next Stage Requires
                    </h3>
                    <p className="text-sm text-[var(--fg-2)] leading-relaxed relative z-10">
                        To evolve into <strong>Thriving</strong>, agencies typically reinforce business independence, increase operational leverage, and strengthen leadership capacity. The shift is from managing projects to managing systems. You must prove that the business can grow without your direct intervention in every deal.
                    </p>
                </Card>
            </div>

            {/* 5. Action */}
            <div className="flex justify-center pt-8 pb-12">
                <Button
                    variant="primary"
                    onClick={onNext}
                    className="h-14 px-8 text-lg rounded-full shadow-[var(--shadow-soft-2)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 transition-all gap-2 font-bold"
                >
                    Explore System Insights
                    <ArrowRight className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
};
