import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Activity, FileText } from 'lucide-react';
import { PrioritizeForm } from '../../../components/SprintPlanning/InitiativeForms/PrioritizeForm';
import { PlantForm } from '../../../components/SprintPlanning/InitiativeForms/PlantForm';
import { IterateForm } from '../../../components/SprintPlanning/InitiativeForms/IterateForm';

export const CapabilityContextPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);

    // MOCK DATA
    const capName = "Delivery Workflow";
    const tier = "Prioritize"; // Change to Prioritize, Plant, or Iterate to test
    const stageFit = "At Stage";
    const score = 71;

    // Constraints Mock Data
    const existingInitiativesCount = 1; // existing in THIS capability
    const totalPrioritizeCount = 5; // existing Prioritize across ALL capabilities

    // Constraint Logic
    const isHardBlocked = tier === 'Prioritize' && totalPrioritizeCount >= 6;
    const showSoftWarning =
        (tier === 'Prioritize' && existingInitiativesCount >= 2) ||
        (tier === 'Plant' && existingInitiativesCount >= 1) ||
        (tier === 'Iterate' && existingInitiativesCount >= 1);

    // Based on PRD
    const diagnosticSignals = [
        "Inconsistent margin on standard retainers.",
        "Founder still required for QA on 80% of deliverables."
    ];

    const historicalContext = "No active initiatives in the last 6 months. Was marked as 'Plant' in Q3 2025.";

    const handleSaveInitiative = (data: any) => {
        console.log("Saving initiative:", data);
        setIsCreating(false);
        // Normally save to DB here then update local state
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pt-8 pb-20 px-4 md:px-0">
            <div className="max-w-4xl w-full mx-auto space-y-8">

                {/* Back Navigation */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sprint Board
                </button>

                {/* Header Section */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-8 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider
                                    ${tier === 'Prioritize' ? 'bg-blue-100 text-blue-800' :
                                        tier === 'Plant' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {tier} Tier
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                    {stageFit} ({score}%)
                                </span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{capName}</h1>
                        </div>

                        {!isCreating && (
                            <div className="flex flex-col items-end gap-2">
                                <button
                                    onClick={() => !isHardBlocked && setIsCreating(true)}
                                    disabled={isHardBlocked}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all
                                        ${isHardBlocked
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    <Target className="w-4 h-4" />
                                    Create New Initiative
                                </button>
                                {isHardBlocked && (
                                    <span className="text-xs text-rose-500 font-medium max-w-[200px] text-right">
                                        Hard cap of 6 Prioritize initiatives reached.
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isCreating ? (
                    <div className="bg-white border text-left border-slate-200 shadow-sm rounded-xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {showSoftWarning && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                                <Target className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-yellow-800 text-sm">Capacity Warning</h4>
                                    <p className="text-sm text-yellow-700 mt-1">
                                        {tier === 'Prioritize' && `You already have ${existingInitiativesCount} Prioritize initiatives here. Are you sure you have capacity for another?`}
                                        {tier === 'Plant' && `You already have ${existingInitiativesCount} Plant initiative here. Adding multiple plant initiatives to one capability risks splitting focus.`}
                                        {tier === 'Iterate' && `You already have ${existingInitiativesCount} Iteration here. Adding multiple iteration initiatives to one capability risks splitting focus.`}
                                    </p>
                                </div>
                            </div>
                        )}
                        {tier === 'Prioritize' && <PrioritizeForm capabilityId={id || ''} onSave={handleSaveInitiative} onCancel={() => setIsCreating(false)} />}
                        {tier === 'Plant' && <PlantForm capabilityId={id || ''} onSave={handleSaveInitiative} onCancel={() => setIsCreating(false)} />}
                        {tier === 'Iterate' && <IterateForm capabilityId={id || ''} onSave={handleSaveInitiative} onCancel={() => setIsCreating(false)} />}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                        {/* Left Column: Context */}
                        <div className="space-y-6">
                            {/* Diagnostic Signals */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                                    <Activity className="w-4 h-4 text-rose-500" />
                                    Diagnostic Signals
                                </h3>
                                <ul className="space-y-3">
                                    {diagnosticSignals.map((sig, i) => (
                                        <li key={i} className="flex gap-3 text-slate-700 items-start">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-2" />
                                            <span className="leading-relaxed text-sm">{sig}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Synthesis Extraction */}
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                    Review Synthesis Note
                                </h3>
                                <p className="text-indigo-900/80 text-sm leading-relaxed italic border-l-2 border-indigo-200 pl-4">
                                    "The workflow issue is the primary bottleneck preventing the founder from shifting focus to business development. Solving this creates capacity."
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Active/Historical */}
                        <div className="space-y-6">
                            <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 text-slate-500">
                                    Historical Context
                                </h3>
                                <p className="text-slate-600 text-sm">
                                    {historicalContext}
                                </p>
                            </div>

                            {/* Empty state for existing initiatives list */}
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                                <p className="text-slate-500 font-medium mb-1">No active initiatives</p>
                                <p className="text-slate-400 text-sm">Create an initiative to start tracking progress.</p>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
