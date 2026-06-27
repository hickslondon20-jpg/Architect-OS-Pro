import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

export const SprintReviewLockPage: React.FC = () => {
    const navigate = useNavigate();

    // MOCK BOARD STATE - checking if all 9 capabilities have an initiative
    const completedCapabilities = 9;
    const isBoardComplete = completedCapabilities === 9;

    // Self-Review Questions State
    const [q1, setQ1] = useState('');
    const [q2, setQ2] = useState('');
    const [q3, setQ3] = useState('');

    const isReviewComplete = q1.trim() && q2.trim() && q3.trim();
    const canLock = isBoardComplete && isReviewComplete;

    const handleLock = () => {
        // Trigger save to DB (set all to locked), fire n8n webhook, route to synthesis
        console.log("LOCKING SPRINT");
        navigate('/pro/planning/sprint-planning/synthesis');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pt-12 pb-20 px-4 md:px-0">
            <div className="max-w-3xl w-full mx-auto space-y-8">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sprint Board
                </button>

                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Review & Lock Sprint</h1>
                    <p className="text-slate-500 mt-2 text-lg">Finalize your plan before committing for the quarter.</p>
                </div>

                {/* Status Card */}
                <div className={`p-6 rounded-xl border-2 ${isBoardComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className="flex gap-4 items-start">
                        {isBoardComplete ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <h3 className={`font-bold text-lg ${isBoardComplete ? 'text-emerald-900' : 'text-rose-900'}`}>
                                {isBoardComplete ? "Board is complete" : "Board is incomplete"}
                            </h3>
                            <p className={isBoardComplete ? 'text-emerald-700' : 'text-rose-700'}>
                                {completedCapabilities} of 9 focus areas have assigned initiatives.
                                {!isBoardComplete && " You must create an initiative for every focus area before locking the sprint."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Qualitative Review Form */}
                <div className={`bg-white border text-left border-slate-200 shadow-sm rounded-xl p-6 md:p-8 ${!isBoardComplete && 'opacity-50 pointer-events-none'}`}>
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        Pre-Lock Reflection
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">1. Do you honestly have the capacity to execute the Prioritize initiatives this quarter?</label>
                            <textarea
                                value={q1}
                                onChange={e => setQ1(e.target.value)}
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">2. Are the binary definitions of done for your Plant initiatives strict enough?</label>
                            <textarea
                                value={q2}
                                onChange={e => setQ2(e.target.value)}
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">3. Does this sprint actively advance the 12-Month Theme?</label>
                            <textarea
                                value={q3}
                                onChange={e => setQ3(e.target.value)}
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleLock}
                        disabled={!canLock}
                        className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        Lock My Sprint
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div>
    );
};
