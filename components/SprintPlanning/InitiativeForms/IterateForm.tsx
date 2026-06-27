import React, { useState } from 'react';
import { Target, Plus } from 'lucide-react';
import { TeamMemberDropdown } from '../Team/TeamMemberDropdown';

interface Props {
    capabilityId: string;
    onSave: (data: any) => void;
    onCancel: () => void;
}

export const IterateForm: React.FC<Props> = ({ capabilityId, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [existingSystem, setExistingSystem] = useState('');
    const [adjustment, setAdjustment] = useState('');
    const [timeBox, setTimeBox] = useState('');
    const [signal, setSignal] = useState('');
    const [ownerId, setOwnerId] = useState<string | undefined>();
    const [currentStep, setCurrentStep] = useState(1);

    // Milestones (Iterate technically shouldn't need a huge list, but min 1 for structure)
    const [milestones, setMilestones] = useState([{ id: '1', text: '', ownerId: undefined as string | undefined }]);
    const addMilestone = () => setMilestones([...milestones, { id: Date.now().toString(), text: '', ownerId: undefined }]);
    const updateMilestone = (id: string, text: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, text } : m));
    };
    const updateMilestoneOwner = (id: string, ownerId: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, ownerId } : m));
    };

    const handleSave = () => {
        // App uses the term "Refinement" internally for the Iterate tier's name per PRD
        onSave({
            tier: 'iterate',
            capabilityId,
            name: `Refinement: ${name}`,
            existingSystem,
            adjustment,
            timeBox,
            signal,
            ownerId,
            milestones
        });
    };

    const isValid = name.trim() && existingSystem.trim() && adjustment.trim() && signal.trim() && timeBox.trim() && !!ownerId && milestones.filter(m => m.text.trim()).length >= 1;

    const renderNextButton = (stepNum: number, disabled: boolean) => {
        if (currentStep !== stepNum) return null;
        return (
            <div className="mt-4">
                <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    disabled={disabled}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-5">
                <div className="flex gap-3">
                    <Target className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-900 leading-snug">Iterate Tier Refinement</h4>
                        <p className="text-sm text-amber-800/80 mt-1">This is an adjustment to something that already works. Do not build from scratch here.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-8 pb-4">
                {/* Step 1: Identity */}
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-400">1.</span>
                        <h3 className="text-sm font-semibold text-slate-700">Refinement Identity</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-5 border-l-2 border-slate-100">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Focus</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., Reduce onboarding friction"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium text-slate-900"
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

                {/* Step 2: Base Reality */}
                {currentStep >= 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">2.</span>
                            <h3 className="text-sm font-semibold text-slate-700">What already exists?</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
                            <p className="text-sm text-slate-500 mb-3 italic">Define the current system you are tweaking.</p>
                            <textarea
                                value={existingSystem}
                                onChange={e => setExistingSystem(e.target.value)}
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-slate-700"
                            />
                            {renderNextButton(2, existingSystem.trim().length === 0)}
                        </div>
                    </div>
                )}

                {/* Step 3: Specific Adjustment */}
                {currentStep >= 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">3.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Specific Adjustment Defined</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
                            <p className="text-sm text-slate-500 mb-3 italic">What exact change are you making?</p>
                            <textarea
                                value={adjustment}
                                onChange={e => setAdjustment(e.target.value)}
                                className="w-full p-3 min-h-[80px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-slate-700"
                            />
                            {renderNextButton(3, adjustment.trim().length === 0)}
                        </div>
                    </div>
                )}

                {/* Step 4: Time-Box & Signal */}
                {currentStep >= 4 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">4.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Measurement & Boundaries</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-5 border-l-2 border-slate-100">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Time-Box</label>
                                <select
                                    value={timeBox}
                                    onChange={e => setTimeBox(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium text-slate-900 bg-white"
                                >
                                    <option value="" disabled>Select Time-Box</option>
                                    <option value="1 Sprint (2 weeks)">1 Sprint (2 weeks)</option>
                                    <option value="2 Sprints (4 weeks)">2 Sprints (4 weeks)</option>
                                    <option value="Half Quarter (6 weeks)">Half Quarter (6 weeks)</option>
                                    <option value="Full Quarter (12 weeks)">Full Quarter (12 weeks)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Signal to Watch</label>
                                <input
                                    type="text"
                                    value={signal}
                                    onChange={e => setSignal(e.target.value)}
                                    placeholder="e.g., Usage rate +10%"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium text-slate-900"
                                />
                            </div>
                        </div>
                        <div className="pl-5">
                            {renderNextButton(4, timeBox.trim().length === 0 || signal.trim().length === 0)}
                        </div>
                    </div>
                )}

                {/* Step 5: Milestones */}
                {currentStep >= 5 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-400">5.</span>
                            <h3 className="text-sm font-semibold text-slate-700">Execution Plan (Milestones)</h3>
                        </div>
                        <div className="pl-5 border-l-2 border-slate-100">
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
                                                className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                                className="mt-4 flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
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
                    disabled={!isValid || currentStep < 5}
                    className="px-6 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    Save Refinement
                </button>
            </div>
        </div>
    );
};
