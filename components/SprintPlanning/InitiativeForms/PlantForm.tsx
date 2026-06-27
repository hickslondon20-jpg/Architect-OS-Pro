import React, { useState } from 'react';
import { Target, Plus } from 'lucide-react';
import { TeamMemberDropdown } from '../Team/TeamMemberDropdown';

interface Props {
    capabilityId: string;
    onSave: (data: any) => void;
    onCancel: () => void;
}

export const PlantForm: React.FC<Props> = ({ capabilityId, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [futureUnlocks, setFutureUnlocks] = useState('');
    const [binaryDone, setBinaryDone] = useState('');
    const [ownerId, setOwnerId] = useState<string | undefined>();
    const [currentStep, setCurrentStep] = useState(1);

    // Milestones (Plant needs min 1)
    const [milestones, setMilestones] = useState([{ id: '1', text: '', ownerId: undefined as string | undefined }]);
    const addMilestone = () => setMilestones([...milestones, { id: Date.now().toString(), text: '', ownerId: undefined }]);
    const updateMilestone = (id: string, text: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, text } : m));
    };
    const updateMilestoneOwner = (id: string, ownerId: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, ownerId } : m));
    };

    const handleSave = () => {
        onSave({ tier: 'plant', capabilityId, name, futureUnlocks, binaryDone, ownerId, milestones });
    };

    const isValid = name.trim() && futureUnlocks.trim() && binaryDone.trim() && !!ownerId && milestones.filter(m => m.text.trim()).length >= 1;

    const renderNextButton = (stepNum: number, disabled: boolean) => {
        if (currentStep !== stepNum) return null;
        return (
            <div className="mt-4">
                <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    disabled={disabled}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-5">
                <div className="flex gap-3">
                    <Target className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-teal-900 leading-snug">Plant Tier Initiative</h4>
                        <p className="text-sm text-teal-800/80 mt-1">This is seed work. It's about laying a foundation now that will be capitalized on in a future quarter.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-8 pb-4">
                {/* Step 1: Base Details */}
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-400">1.</span>
                        <h3 className="text-sm font-semibold text-slate-700">Initiative Identity</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-5 border-l-2 border-slate-100">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., Audit existing CRM data"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium text-slate-900"
                                disabled={currentStep > 1 && false}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Owner</label>
                            <TeamMemberDropdown selectedId={ownerId} onSelect={setOwnerId} />
                        </div>
                    </div>
                    <div className="pl-5">
                        {renderNextButton(1, name.trim().length === 0 || !ownerId)}
                    </div>
                </div>

                {/* Step 2: Future Reality Unlocked */}
                {currentStep >= 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">2.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Future Reality Unlocked</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
                            <p className="text-sm text-slate-500 mb-3 italic">Why are we doing this now? What future work does this make possible?</p>
                            <textarea
                                value={futureUnlocks}
                                onChange={e => setFutureUnlocks(e.target.value)}
                                className="w-full p-3 min-h-[100px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-slate-700"
                            />
                            {renderNextButton(2, futureUnlocks.trim().length === 0)}
                        </div>
                    </div>
                )}

                {/* Step 3: Binary Definition of Done */}
                {currentStep >= 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">3.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Binary Definition of Done</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
                            <p className="text-sm text-slate-500 mb-3 italic">Because this is ground-level work, how do we prove it is finished?</p>
                            <textarea
                                value={binaryDone}
                                onChange={e => setBinaryDone(e.target.value)}
                                placeholder="e.g., 'A CSV is generated with all duplicate contacts flagged.'"
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-slate-700"
                            />
                            {renderNextButton(3, binaryDone.trim().length === 0)}
                        </div>
                    </div>
                )}

                {/* Step 4: Milestones */}
                {currentStep >= 4 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">4.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Execution Plan (Milestones)</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Milestones (Min. 1)</label>
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
                                                className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                                className="mt-4 flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                            >
                                <Plus className="w-4 h-4" /> Add Milestone
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 sticky bottom-0 bg-white pb-2">
                <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isValid || currentStep < 4}
                    className="px-6 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    Save Initiative
                </button>
            </div>
        </div>
    );
};
