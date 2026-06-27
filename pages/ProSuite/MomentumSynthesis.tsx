import React, { useState } from 'react';
import { PageHeader } from '../../components/ui';
import { Compass, RotateCw, AlertCircle, Quote, Clock, ChevronDown, ChevronRight, History } from 'lucide-react';

const SPRINT_GOAL = "We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.";

// --- Mock Data --- //
const MOCK_HISTORY = [
    {
        id: 1,
        date: "Feb 15, 2026 at 4:30 PM",
        preview: "At the midpoint of the sprint, the focus on standardizing operations is yielding visible results, though team accountability...",
        status: "Read"
    },
    {
        id: 2,
        date: "Jan 28, 2026 at 9:15 AM",
        preview: "You are four weeks into this stability sprint. Early momentum is strong in process documentation, but client onboarding...",
        status: "Read"
    }
];

export const MomentumSynthesis: React.FC = () => {
    const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <PageHeader
                title="Momentum Synthesis"
                subtitle="Your periodic strategic read on the quarter. Generated on demand."
            />

            {/* Top Section — Sprint Context */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Sprint Goal Banner */}
                <div className="bg-slate-50 border-b border-slate-200 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Sprint 1 Goal</p>
                    <p className="text-lg text-slate-900 font-medium leading-relaxed max-w-4xl">{SPRINT_GOAL}</p>
                </div>

                {/* Context Strip */}
                <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6 text-sm font-medium w-full md:w-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg">
                            <Clock size={16} />
                            Day 36 of 84
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                            <History size={16} />
                            <span className="hidden sm:inline">Last generated:</span> Mar 4, 2026 at 9:00 AM
                        </div>
                    </div>

                    <button className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <RotateCw size={18} />
                        Generate New Synthesis
                    </button>
                </div>
            </div>

            {/* Primary Content — Synthesis Display */}
            <div className="max-w-4xl mx-auto space-y-8 mt-12">

                {/* Section 1 — Progress Narrative */}
                <div className="prose prose-slate max-w-none">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Compass size={18} />
                        </div>
                        Strategic Read
                    </h3>
                    <div className="space-y-6 text-slate-700 leading-relaxed text-lg">
                        <p>
                            You are approaching the midpoint of this stability sprint, and the initial structural work is holding. The completion of your core Standard Operating Procedure matrix provides the exact scaffolding you aimed for at sprint launch. This signifies a shift: your operations team is beginning to rely on documented systems rather than your direct, daily problem-solving.
                        </p>
                        <p>
                            Currently in motion is the migration to the new client portal and the rollout of updated accountability charts. While both are marked "In Progress," the pace here is slower. You are successfully maintaining your reduced publishing schedule without losing market visibility, which validates the hypothesis that continuous broadcasting isn't required when your existing pipeline is full.
                        </p>
                        <p>
                            However, the technical specifications for your internal automation dashboard have not yet been started. Given that this was a 'Plant' initiative meant to establish groundwork for Q2, delaying it entirely means Q2 will likely inherit this foundational debt. This isn't necessarily a failure of execution, but it does represent a tradeoff being made in real-time.
                        </p>
                    </div>
                </div>

                {/* Section 2 — Attention Signal */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 md:p-8 mt-12 relative overflow-hidden">
                    {/* Decorative subtle pulse */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -mr-10 -mt-10"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-amber-800 font-bold mb-4 uppercase tracking-wider text-sm">
                            <AlertCircle size={16} className="text-amber-600" />
                            Observation
                        </div>
                        <p className="text-amber-900 text-lg font-medium leading-relaxed max-w-3xl">
                            Three milestones within 'Client Onboarding Playbook' are currently flagged as Blocked. Two of these share the identical blocker note: "Waiting on API keys from legacy CRM." This is no longer an execution delay; it is an external dependency bottleneck requiring founder escalation.
                        </p>
                    </div>
                </div>

                {/* Section 3 — Encouragement Layer */}
                <div className="bg-slate-50 rounded-xl p-8 mt-12 border border-slate-100">
                    <div className="flex gap-4">
                        <Quote size={24} className="text-slate-300 shrink-0 mt-1" />
                        <p className="text-slate-600 italic leading-relaxed text-lg">
                            The space you are creating by standardizing the delivery floor is real. It is difficult to feel the impact of a quiet process when you are used to the noise of firefighting, but the fact that 12 SOP gaps have been identified and closed without your direct authorship is evidence of a maturing system. You are successfully transitioning from the primary operator of the machine to the architect of it.
                        </p>
                    </div>
                </div>

            </div>

            {/* Bottom of Page — Generation History */}
            <div className="max-w-4xl mx-auto mt-20">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 pb-2 border-b border-slate-200">
                    Previous Syntheses
                </h3>

                <div className="space-y-3">
                    {MOCK_HISTORY.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-shadow hover:shadow-sm"
                        >
                            <button
                                onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                                className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-slate-400">
                                        {expandedHistory === item.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 mb-0.5">{item.date}</p>
                                        <p className="text-sm text-slate-500 line-clamp-1 max-w-2xl">{item.preview}</p>
                                    </div>
                                </div>
                            </button>

                            {expandedHistory === item.id && (
                                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50">
                                    <p className="text-slate-600 text-sm leading-relaxed italic">
                                        [Expanded synthesis content would render here, displaying the full historical narrative block for reference.]
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};
