import React from 'react';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
    onNext: () => void;
    selectedFraming: string;
    draftedGoal: string;
    onDraftChange: (goal: string) => void;
}

export const Step4_GoalDrafting: React.FC<Props> = ({ onNext, selectedFraming, draftedGoal, onDraftChange }) => {

    // We would look up the actual styling/text for selectedFraming here, but we'll mock the text for the wireframe.
    const framingLabels: Record<string, string> = {
        stabilize: 'Stabilize and create visibility',
        elevate: 'Elevate the service delivery model',
        scale: 'Scale outbound and positioning'
    };

    const framingLabel = framingLabels[selectedFraming] || 'Directional Focus';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-3xl mx-auto">

            {/* Persistent Reference Strip */}
            <div className="bg-slate-100/50 border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm mb-12 shadow-sm">
                <span className="font-medium text-slate-500 uppercase tracking-wider text-[10px]">Your Focus</span>
                <span className="text-slate-700 font-medium">— {framingLabel}</span>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-slate-900">Sprint Goal (Draft)</h2>
                </div>

                <p className="text-slate-600 font-medium italic mb-2">
                    "At the end of the next 12 weeks, it will be true that…"
                </p>

                <div className="relative">
                    <textarea
                        value={draftedGoal}
                        onChange={(e) => onDraftChange(e.target.value)}
                        placeholder="We have reduced delivery time by 20% and established standard..."
                        className="w-full min-h-[160px] p-5 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none shadow-sm leading-relaxed"
                        spellCheck="false"
                    />
                </div>

                <p className="text-sm text-slate-500 pl-1 mt-2">
                    One to two sentences. Describe a change in how your business operates — not a list of tasks.
                </p>
            </div>

            {/* Guardrails (Always Visible) */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 mt-10">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Sprint Goal Guardrails
                </h3>
                <ul className="space-y-3">
                    <li className="flex gap-3 text-slate-700 items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                        <span className="leading-relaxed"><strong>Outcome-focused, not activity-focused.</strong> E.g. "We have a documented pipeline" vs "Write pipeline docs."</span>
                    </li>
                    <li className="flex gap-3 text-slate-700 items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                        <span className="leading-relaxed"><strong>Describes a changed operating reality.</strong> How does the business function differently?</span>
                    </li>
                    <li className="flex gap-3 text-slate-700 items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                        <span className="leading-relaxed"><strong>Specific enough to verify.</strong> You'd know at the end of the 12 weeks whether it is true or not.</span>
                    </li>
                </ul>
            </div>

            <div className="pt-8 flex justify-center">
                <button
                    onClick={onNext}
                    disabled={draftedGoal.trim().length === 0}
                    className={`flex items-center gap-2 px-8 py-3 rounded-md font-medium transition-all group
                        ${draftedGoal.trim().length > 0
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:gap-3 cursor-pointer shadow-md'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                    Continue
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};
