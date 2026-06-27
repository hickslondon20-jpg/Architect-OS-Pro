import React from 'react';
import { Card, CardContent } from '../../../components/ui';
import { ArrowRight, Activity, Map, Sparkles } from 'lucide-react';

interface Props {
    onNext: () => void;
    disabled?: boolean;
}

export const Step1_ContextReAnchor: React.FC<Props> = ({ onNext, disabled }) => {
    // Phase 2: Mocked Data matching PRD specs
    const stageName = "Striving";
    const stageDesc = "Finding fit, fighting for margin, moving from project to process.";
    const topCapabilities = ["Delivery Workflow", "Client Satisfaction"];
    const bottomCapabilities = ["Cash Flow Forecasting", "Role Clarity"];

    const visionStatement = "To become the undisputed category leader in sustainable brand packaging for CPG, known for strategic rigor and flawless execution.";
    const visionTarget = "$2.5M run rate, 25% EBITDA, 4-person leadership team.";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-12">
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Before you plan, anchor.</h1>
                <p className="text-slate-500 text-lg">Where you stand today, and where you are headed.</p>
            </div>

            <div className="space-y-6">
                {/* Panel A: Where You Are Today */}
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h2 className="font-medium text-slate-900">Where You Are Today</h2>
                    </div>
                    <CardContent className="p-6 space-y-6">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">CURRENT STAGE</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-semibold text-slate-900">{stageName}</span>
                                <span className="text-slate-500">— {stageDesc}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="text-sm font-medium text-slate-500 mb-3 hover:text-green-600 transition-colors">STRENGTHS</div>
                                <ul className="space-y-2">
                                    {topCapabilities.map((cap, i) => (
                                        <li key={i} className="flex items-center gap-2 text-slate-700">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            {cap}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-500 mb-3 hover:text-red-600 transition-colors">PRESSURE AREAS</div>
                                <ul className="space-y-2">
                                    {bottomCapabilities.map((cap, i) => (
                                        <li key={i} className="flex items-center gap-2 text-slate-700">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                            {cap}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Panel B: Where You're Headed */}
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Map className="w-5 h-5 text-indigo-600" />
                        <h2 className="font-medium text-slate-900">Where You're Headed This Year</h2>
                    </div>
                    <CardContent className="p-6 space-y-5">
                        <blockquote className="border-l-2 border-indigo-200 pl-4 text-slate-700 italic">
                            "{visionStatement}"
                        </blockquote>
                        <div className="flex items-center gap-3 text-slate-600 bg-indigo-50/50 py-2 px-4 rounded-md w-fit">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="font-medium text-indigo-900 inline-block">{visionTarget}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Panel C: What This Sprint Represents */}
                <div className="text-center py-8 space-y-6">
                    <p className="text-lg text-slate-700 leading-relaxed max-w-lg mx-auto">
                        This sprint is the next 12 weeks of that journey. You are not solving everything. You are deciding what must change first.
                    </p>
                    <div className="inline-flex items-center justify-center px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-medium text-sm tracking-wide">
                        Q1 2026 — 12 WEEKS
                    </div>
                </div>
            </div>

            <div className="pt-8 flex justify-center">
                <button
                    onClick={onNext}
                    disabled={disabled}
                    className={`flex items-center gap-2 px-8 py-3 rounded-md font-medium transition-all group
                        ${disabled
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:gap-3 cursor-pointer'}`}
                >
                    Continue
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};
