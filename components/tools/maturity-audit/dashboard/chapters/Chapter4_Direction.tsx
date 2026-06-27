import React from 'react';
import { Card, Button } from '../../../../ui';
import {
    FileText,
    Map,
    Check,
    ArrowRight,
    Download
} from 'lucide-react';

export const Chapter4_Direction: React.FC = () => {
    return (
        <div className="space-y-16 animate-in fade-in duration-500 pb-24 max-w-5xl mx-auto">

            {/* SECTION 1: Opening Synthesis */}
            <div className="text-left space-y-4 max-w-4xl">
                <p className="text-lg md:text-xl text-[var(--fg-1)] leading-relaxed font-normal">
                    You've moved through the diagnostic landscape — from your global structural health, to how your systems behave, to which capabilities hold the most strategic leverage. What emerges is a clear picture: you know where you are, and you know what matters most. Now the question becomes: how do you turn this clarity into systematic progress?
                </p>
            </div>

            {/* SECTION 2: How You'll Know You're Ready */}
            <div className="bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-xl p-8 md:p-10 relative">
                {/* Visual Anchor */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-surface)] px-4 py-1 border border-[var(--aos-mist)] rounded-full text-xs font-bold uppercase tracking-widest text-[var(--fg-4)]">
                    Target State: Thriving
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--fg-1)] mb-2">How You'll Know You're Ready</h2>
                    <p className="text-[var(--fg-3)]">Readiness isn't just about scores — it's about how your business operates day-to-day.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 max-w-4xl mx-auto">
                    {[
                        "Your team operates with clear role definitions and accountability structures, reducing daily founder dependencies",
                        "Financial visibility extends 90+ days forward with reliable forecasting rhythms",
                        "Client acquisition follows repeatable qualification and onboarding processes",
                        "Delivery is systematized enough that project outcomes don't depend on heroic individual efforts",
                        "Strategic decisions are informed by data patterns, not just founder instinct",
                        "You have capacity to focus on building leverage, not just maintaining operations"
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <div className="mt-1 p-0.5 bg-[var(--aos-success-tint)] rounded-full flex-shrink-0">
                                <Check className="h-3.5 w-3.5 text-[var(--aos-success)]" />
                            </div>
                            <p className="text-[var(--fg-2)] leading-relaxed">{item}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 3: The Gap Between Knowing and Doing */}
            <div className="max-w-3xl mx-auto text-center space-y-4">
                <h3 className="text-lg font-bold text-[var(--fg-1)]">The Gap Between Knowing & Doing</h3>
                <p className="text-base text-[var(--fg-2)] leading-relaxed font-light">
                    Understanding your priorities is the first step — but there's a critical gap between diagnostic clarity and systematic execution. Translating these insights into a roadmap that accounts for your unique capacity, dependencies, and constraints requires intentional structure. That's where strategic planning and disciplined execution rhythms come in.
                </p>
            </div>

            {/* SECTION 4: Two Paths Forward */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">

                {/* PATH A: Self-Directed (Report) */}
                <Card className="p-8 md:p-10 border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] flex flex-col items-center text-center hover:shadow-md transition-shadow group">
                    <div className="w-16 h-16 bg-[var(--bg-canvas)] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[var(--bg-sunken)] transition-colors">
                        <FileText className="h-8 w-8 text-[var(--fg-4)] group-hover:text-[var(--fg-2)] transition-colors" />
                    </div>

                    <h3 className="text-lg font-bold text-[var(--fg-1)] mb-4 uppercase tracking-wide">Explore The Full Diagnostic</h3>

                    <p className="text-[var(--fg-2)] leading-relaxed mb-8 flex-grow">
                        Your complete Maturity & Readiness Report includes dimension-level checkpoint rankings, detailed capability analysis, and strategic guidance tailored to your stage. Use it as a reference for your own planning process.
                    </p>

                    <Button variant="outline" className="w-full justify-center hover:bg-[var(--aos-brass-tint)]" style={{ border: 'var(--border-accent)', color: 'var(--aos-brass)' }}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Full Report
                    </Button>

                    <p className="text-xs text-[var(--fg-4)] mt-4 h-10 flex items-center">
                        Includes all 125 checkpoints ranked by dimension
                    </p>
                </Card>

                {/* PATH B: Structured Execution (Pro Platform) */}
                <Card className="p-8 md:p-10 border border-[var(--aos-insight-tint)] bg-[var(--aos-insight-tint)] shadow-[var(--shadow-soft-1)] flex flex-col items-center text-center hover:shadow-md transition-shadow group relative overflow-hidden">

                    <div className="w-16 h-16 bg-[var(--aos-brass-tint)] rounded-2xl flex items-center justify-center mb-6 group-hover:opacity-80 transition-opacity">
                        <Map className="h-8 w-8 text-[var(--aos-brass)]" />
                    </div>

                    <h3 className="text-lg font-bold text-[var(--fg-1)] mb-4 uppercase tracking-wide">Build Your Strategic Roadmap</h3>

                    <p className="text-[var(--fg-2)] leading-relaxed mb-8 flex-grow">
                        When you're ready to translate insights into a living execution plan, Architect OS Pro helps you break down capability gaps into quarterly initiatives, sequence priorities, and track progress systematically.
                    </p>

                    <Button className="w-full justify-center bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] shadow-[var(--shadow-soft-2)]">
                        Explore Architect OS Pro
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    <p className="text-xs text-[var(--fg-4)] mt-4 h-10 flex items-center">
                        Quarter Map, Milestone Builder & Virtual CSO Guidance
                    </p>
                </Card>

            </div>

            {/* SECTION 5: Closing Synthesis */}
            <div className="max-w-2xl mx-auto text-center pt-8">
                <p className="text-lg text-[var(--fg-4)] font-light italic">
                    "You've done the hard work of honest assessment. The path forward is clear — now it's about choosing the structure that helps you execute with focus and consistency."
                </p>
            </div>
        </div>
    );
};
