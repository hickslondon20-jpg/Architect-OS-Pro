import React from 'react';
import { ArrowLeft, Lock, AlertTriangle } from 'lucide-react';

interface Props {
    onBack: () => void;
    onLock: () => void;
    draftedGoal: string;
}

export const Step5_RealityCheckLock: React.FC<Props> = ({ onBack, onLock, draftedGoal }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl mx-auto pb-12">

            <div className="text-center space-y-2 mb-10">
                <Lock className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Reality Check</h1>
                <p className="text-slate-500 text-lg">Read this through one last time.</p>
            </div>

            {/* Committed Goal Block */}
            <div className="bg-white border-2 border-slate-900 rounded-xl p-8 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />

                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    Drafted Sprint Goal
                </h3>

                <p className="text-xl text-slate-900 font-medium leading-relaxed">
                    "{draftedGoal}"
                </p>
            </div>

            {/* Reflection Prompts (Static) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 mt-10 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    If you lock this, is it true?
                </h3>

                <ul className="space-y-4 list-disc list-outside pl-5">
                    <li className="text-slate-700 leading-snug">
                        If this were the only thing we accomplished, would it be a meaningful win?
                    </li>
                    <li className="text-slate-700 leading-snug">
                        Does this address a real pressure we identified in our diagnostic?
                    </li>
                    <li className="text-slate-700 leading-snug">
                        Is this achievable in 12 weeks without heroic effort?
                    </li>
                    <li className="text-slate-700 leading-snug">
                        Does this create momentum for the sprint that follows?
                    </li>
                </ul>

                <p className="text-sm text-slate-500 italic pt-2 border-t border-slate-200 mt-6">
                    If you answered no to any of these, consider refining before locking.
                </p>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 text-slate-600 font-medium hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Refine My Goal
                </button>
                <button
                    onClick={onLock}
                    className="flex items-center gap-2 px-10 py-3 bg-slate-900 text-white rounded-md font-medium hover:bg-indigo-600 transition-all shadow-md group"
                >
                    <Lock className="w-4 h-4 text-indigo-300 group-hover:text-white transition-colors" />
                    Lock My Sprint Goal
                </button>
            </div>

        </div>
    );
};
