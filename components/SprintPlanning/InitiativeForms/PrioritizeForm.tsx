import React, { useState } from 'react';
import { Target, AlertCircle, Plus } from 'lucide-react';
import { TeamMemberDropdown } from '../Team/TeamMemberDropdown';

interface Props {
    capabilityId: string;
    onSave: (data: any) => void;
    onCancel: () => void;
}

export const PrioritizeForm: React.FC<Props> = ({ capabilityId, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [outcome, setOutcome] = useState('');
    const [connection, setConnection] = useState('');
    const [constraints, setConstraints] = useState('');

    const [ownerId, setOwnerId] = useState<string | undefined>();
    const [currentStep, setCurrentStep] = useState(1);

    // Milestones (require at least 2 for Prioritize tier)
    const [milestones, setMilestones] = useState([{ id: '1', text: '', ownerId: undefined as string | undefined }]);

    const addMilestone = () => setMilestones([...milestones, { id: Date.now().toString(), text: '', ownerId: undefined }]);

    const updateMilestone = (id: string, text: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, text } : m));
    };

    const updateMilestoneOwner = (id: string, ownerId: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, ownerId } : m));
    };

    const handleSave = () => {
        onSave({ tier: 'prioritize', capabilityId, name, outcome, connection, constraints, ownerId, milestones });
    };

    const isValid = name.trim() && outcome.trim() && connection.trim() && !!ownerId && milestones.filter(m => m.text.trim()).length >= 2;

    const renderNextButton = (stepNum: number, disabled: boolean) => {
        if (currentStep !== stepNum) return null;
        return (
            <div className="mt-3">
                <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    disabled={disabled}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
                <div className="flex gap-3">
                    <Target className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900 leading-snug">Prioritize Tier Initiative</h4>
                        <p className="text-sm text-blue-800/80 mt-1">This is a major strategic focus. It requires clear outcome definition and at least two sequenced milestones.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-8 pb-4">
                {/* Step 1: Name */}
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-semibold text-slate-700">1. Initiative Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g., Rebuild Core Delivery Workflow"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
                        disabled={currentStep > 1 && false} // Let them edit if they want, but progressive disclosure focuses on next steps
                    />
                    {renderNextButton(1, name.trim().length === 0)}
                </div>

                {/* Step 2: Owner */}
                {currentStep >= 2 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-semibold text-slate-700">2. Initiative Owner</label>
                        <TeamMemberDropdown selectedId={ownerId} onSelect={setOwnerId} />
                        {renderNextButton(2, !ownerId)}
                    </div>
                )}

                {/* Step 3: Outcome Statement */}
                {currentStep >= 3 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-semibold text-slate-700">3. Outcome Statement</label>
                        <p className="text-sm text-slate-500 italic">What specific change in the business indicates this is complete?</p>
                        <textarea
                            value={outcome}
                            onChange={e => setOutcome(e.target.value)}
                            className="w-full p-3 min-h-[100px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                        />
                        {renderNextButton(3, outcome.trim().length === 0)}
                    </div>
                )}

                {/* Step 4: Sprint Goal Connection */}
                {currentStep >= 4 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-semibold text-slate-700">4. Sprint Goal Connection</label>
                        <textarea
                            value={connection}
                            onChange={e => setConnection(e.target.value)}
                            placeholder="How does this directly serve the Q1 Sprint Goal?"
                            className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                        />
                        {renderNextButton(4, connection.trim().length === 0)}
                    </div>
                )}

                {/* Step 5: Known Constraints */}
                {currentStep >= 5 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-semibold text-slate-700">5. Known Constraints (Optional)</label>
                        <textarea
                            value={constraints}
                            onChange={e => setConstraints(e.target.value)}
                            placeholder="e.g., Requires hiring a contractor before Phase 2."
                            className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
                        />
                        {renderNextButton(5, false)}
                    </div>
                )}

                {/* Step 6: Milestones */}
                {currentStep >= 6 && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">6. Milestones (Min. 2)</label>
                        <div className="space-y-3">
                            {milestones.map((m, i) => (
                                <div key={m.id} className="flex gap-3 items-start">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 mt-1">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={m.text}
                                            onChange={e => updateMilestone(m.id, e.target.value)}
                                            placeholder={`Milestone ${i + 1} description`}
                                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="w-1/3 shrink-0">
                                        <TeamMemberDropdown
                                            selectedId={m.ownerId}
                                            onSelect={(id) => updateMilestoneOwner(m.id, id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addMilestone}
                            className="mt-4 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                            <Plus className="w-4 h-4" /> Add Milestone
                        </button>

                        {milestones.filter(m => m.text.trim()).length < 2 && (
                            <div className="flex items-center gap-2 mt-4 text-amber-600 text-sm bg-amber-50 p-3 rounded-md border border-amber-100">
                                <AlertCircle className="w-4 h-4" />
                                Prioritize-tier initiatives require at least 2 defined milestones.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 sticky bottom-0 bg-white pb-2">
                <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isValid || currentStep < 6}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    Save Initiative
                </button>
            </div>
        </div>
    );
};
