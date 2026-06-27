import React, { useState } from 'react';
import { Card } from '../../ui';
import { X, Sparkles, ChevronDown } from 'lucide-react';
import { PrioritizeForm } from '../InitiativeForms/PrioritizeForm';
import { PlantForm } from '../InitiativeForms/PlantForm';
import { IterateForm } from '../InitiativeForms/IterateForm';

interface InitiativeCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: () => void;
    preSelectedCapabilityName?: string;
    availableCapabilities?: { id: string, name: string }[];
    tier?: 'prioritize' | 'plant' | 'iterate';
    capabilityId?: string;
}

export const InitiativeCreationModal: React.FC<InitiativeCreationModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    preSelectedCapabilityName,
    availableCapabilities = [],
    tier,
    capabilityId
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-200">
                {tier === 'prioritize' && (
                    <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 relative overflow-hidden max-h-[90vh] overflow-y-auto">
                        <PrioritizeForm capabilityId={capabilityId || ''} onSave={onCreate} onCancel={onClose} />
                    </div>
                )}
                {tier === 'plant' && (
                    <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 relative overflow-hidden max-h-[90vh] overflow-y-auto">
                        <PlantForm capabilityId={capabilityId || ''} onSave={onCreate} onCancel={onClose} />
                    </div>
                )}
                {tier === 'iterate' && (
                    <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 relative overflow-hidden max-h-[90vh] overflow-y-auto">
                        <IterateForm capabilityId={capabilityId || ''} onSave={onCreate} onCancel={onClose} />
                    </div>
                )}

                {!tier && (
                    <Card className="w-full bg-white shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900">Create New Initiative</h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-6">
                                {/* Capability Selector */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Linked Capability</label>
                                    {preSelectedCapabilityName ? (
                                        <div>
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100">
                                                {preSelectedCapabilityName}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select className="w-full appearance-none bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                                <option value="">Select a capability...</option>
                                                {availableCapabilities.map(cap => (
                                                    <option key={cap.id} value={cap.id}>{cap.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    )}
                                </div>

                                {/* Initiative Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Initiative Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Name this initiative"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        autoFocus
                                    />
                                </div>

                                {/* AI Feedback Zone */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                                    <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <div className="text-sm text-indigo-900/70">
                                        AI will review your initiative name here...
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What will this initiative accomplish?"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all"
                                >
                                    Create Initiative
                                </button>
                            </div>
                        </form>
                    </Card>
                )}
            </div>
        </div>
    );
};
