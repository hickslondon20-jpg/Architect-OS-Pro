import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

export const SprintPostureSynthesis: React.FC = () => {
    const navigate = useNavigate();

    // MOCK STATE - Simulating webhook loading
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate n8n webhook delay
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // MOCK DATA - returned from n8n
    const synthesisDoc = {
        title: "Q1 Synthesis: The Stabilization Sprint",
        narrative: "This sprint represents a critical pivot from pure sales motion into operational stability. By heavily biasing toward the 'Delivery Workflow' as a Prioritize tier initiative, you are intentionally trading short-term pipeline expansion for the long-term capacity required to scale. The selected Plant initiatives indicate a healthy awareness of future structural needs, specifically around leadership definition. A risk factor is the relatively light effort on iterative pipeline health constraints; carefully watch your leading indicators there to ensure you do not starve the funnel while fixing the floor.",
        keyDirectives: [
            "Protect the Delivery Workflow initiative at all costs; it is the bottleneck.",
            "Ensure the founder is actively delegating QA tasks as defined in the binary done state.",
            "Do not allow the Pipeline Health iterations to slip past the 2-week timebox."
        ]
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">Architecting Sprint Posture...</h2>
                <p className="text-slate-400 text-center max-w-md">
                    Analyzing intention vs. reality based on your selected capabilities, historical staging, and initiative tiers...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pt-16 pb-20 px-4 md:px-0">
            <div className="max-w-4xl w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                <div className="text-center space-y-4 mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-2">
                        <CheckCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Q1 Sprint Locked</h1>
                    <p className="text-xl text-slate-500">Your strategic posture has been synthesized.</p>
                </div>

                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-8 md:p-10 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Sparkles className="w-48 h-48 text-indigo-600" />
                    </div>

                    <div className="relative z-10 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-indigo-950 mb-4">{synthesisDoc.title}</h2>
                            <p className="text-slate-700 text-lg leading-relaxed">
                                {synthesisDoc.narrative}
                            </p>
                        </div>

                        <div className="pt-6 border-t border-indigo-50">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                                Strategic Directives
                            </h3>
                            <ul className="space-y-4">
                                {synthesisDoc.keyDirectives.map((directive, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                                            {i + 1}
                                        </div>
                                        <span className="text-slate-800 font-medium pt-0.5">{directive}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-8">
                    <button
                        onClick={() => navigate('/pro/planning/sprint-planning/board')}
                        className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-md group"
                    >
                        Return to Sprint Board
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

            </div>
        </div>
    );
};
