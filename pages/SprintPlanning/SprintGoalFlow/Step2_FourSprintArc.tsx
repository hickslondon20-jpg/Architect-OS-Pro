import React from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';

interface Props {
    onNext: () => void;
}

const arcData = [
    { label: 'Q1 2026', theme: 'Foundation Building & Operational Systems', desc: ['Stabilize delivery', 'Financial visibility', 'Role clarity'], active: true },
    { label: 'Q2 2026', theme: 'Sales Pipeline & Positioning Focus', desc: ['Outbound motion', 'ICP refinement', 'Case studies'], active: false },
    { label: 'Q3 2026', theme: 'Team Expansion & Margin Protection', desc: ['Hire senior account lead', 'Pricing floor update'], active: false },
    { label: 'Q4 2026', theme: 'Strategic Transition & Next Horizon Prep', desc: ['Leadership offsite', 'End-of-year review'], active: false },
];

export const Step2_FourSprintArc: React.FC<Props> = ({ onNext }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto">
            <div className="text-center space-y-2 mb-12">
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">The Four-Sprint Arc</h1>
                <p className="text-slate-500 text-lg">Where this sprint sits in your annual narrative.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-8">
                {arcData.map((sprint, i) => (
                    <div
                        key={i}
                        className={`
                            relative flex flex-col p-5 rounded-xl border transition-all duration-300
                            ${sprint.active
                                ? 'bg-white border-blue-200 shadow-md transform md:-translate-y-2 z-10'
                                : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}
                        `}
                    >
                        {sprint.active && (
                            <div className="absolute -top-3 inset-x-0 mx-auto w-fit bg-blue-600 text-white text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
                                You Are Here
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                            <CalendarDays className={`w-4 h-4 ${sprint.active ? 'text-blue-500' : 'text-slate-400'}`} />
                            <span className={`text-sm font-semibold tracking-wide ${sprint.active ? 'text-blue-900' : 'text-slate-500'}`}>
                                {sprint.label}
                            </span>
                        </div>

                        <div className={`font-medium mb-4 leading-snug flex-grow ${sprint.active ? 'text-slate-900 text-lg' : 'text-slate-700'}`}>
                            {sprint.theme}
                        </div>

                        <ul className="space-y-1.5 mb-4">
                            {sprint.desc.map((d, idx) => (
                                <li key={idx} className={`text-xs flex items-start gap-1.5 ${sprint.active ? 'text-slate-600' : 'text-slate-500'}`}>
                                    <span className="text-slate-300 mt-0.5">•</span>
                                    {d}
                                </li>
                            ))}
                        </ul>

                        <div className={`text-[10px] italic mt-auto ${sprint.active ? 'text-blue-600/60' : 'text-slate-400'}`}>
                            Hypothesis, not a plan
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-8 flex justify-center">
                <button
                    onClick={onNext}
                    className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-all hover:gap-3 group"
                >
                    Continue
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};
