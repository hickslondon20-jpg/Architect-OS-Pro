import React, { useState } from 'react';
import { ChevronDown, Check, Plus, X } from 'lucide-react';

interface BulkActionBarProps {
    selectedCount: number;
    onStatusChange: (status: 'not_started' | 'on_track' | 'at_risk' | 'blocked' | 'complete') => void;
    onAddNote: (note: string) => void;
    onAddMilestone: (initiativeId: string, name: string) => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount,
    onStatusChange,
    onAddNote,
    onAddMilestone
}) => {
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isAddingMilestone, setIsAddingMilestone] = useState(false);
    const [newMilestoneName, setNewMilestoneName] = useState('');
    const [newMilestoneInitiative, setNewMilestoneInitiative] = useState('i1'); // Default to first

    // Handlers
    const handleStatusSelect = (status: 'not_started' | 'on_track' | 'at_risk' | 'blocked' | 'complete') => {
        onStatusChange(status);
        setStatusDropdownOpen(false);
    };

    const submitNote = () => {
        if (noteText.trim()) {
            onAddNote(noteText);
            setNoteText('');
            setIsAddingNote(false);
        }
    };

    const submitMilestone = () => {
        if (newMilestoneName.trim()) {
            onAddMilestone(newMilestoneInitiative, newMilestoneName);
            setNewMilestoneName('');
            setIsAddingMilestone(false);
        }
    };

    return (
        <div className="mb-4">
            {/* Main Bar */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="font-bold text-sm text-blue-900 ml-2">
                    {selectedCount} selected
                </div>

                <div className="flex items-center gap-2">
                    {/* Action 1: Bulk Status Change */}
                    {!isAddingNote && (
                        <div className="relative">
                            <button
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="px-3 py-1.5 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-1 shadow-sm"
                            >
                                Change Health
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {statusDropdownOpen && (
                                <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden py-1">
                                    <button onClick={() => handleStatusSelect('on_track')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-emerald-700">On Track</button>
                                    <button onClick={() => handleStatusSelect('at_risk')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-amber-700">At Risk</button>
                                    <button onClick={() => handleStatusSelect('blocked')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-red-700">Blocked</button>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button onClick={() => handleStatusSelect('complete')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-blue-700">Complete</button>
                                    <button onClick={() => handleStatusSelect('not_started')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-500">Not Started</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action 2: + Add Note */}
                    {isAddingNote ? (
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 leading-none">
                            <input
                                autoFocus
                                type="text"
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitNote()}
                                placeholder="Add a note to all selected..."
                                className="text-xs border border-blue-300 rounded px-2 py-1.5 w-60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <button
                                onClick={submitNote}
                                className="p-1.5 bg-blue-600 rounded text-white hover:bg-blue-700"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setIsAddingNote(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingNote(true)}
                            className="px-3 py-1.5 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-1 shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Note
                        </button>
                    )}

                    {/* Action 3: + Add Milestone (Button only here, form is below) */}
                    <button
                        onClick={() => setIsAddingMilestone(!isAddingMilestone)}
                        className={`px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 shadow-sm transition-colors ${isAddingMilestone
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
                            }`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Milestone
                    </button>
                </div>
            </div>

            {/* Inline Form for Add Milestone */}
            {isAddingMilestone && (
                <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initiative</label>
                        <select
                            value={newMilestoneInitiative}
                            onChange={(e) => setNewMilestoneInitiative(e.target.value)}
                            className="w-full text-xs border-slate-200 rounded-md py-1.5"
                        >
                            <option value="i1">Build Financial Dashboard</option>
                            <option value="i2">Define Leadership Roles</option>
                            <option value="i3">Redesign Pipeline Funnel</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label>
                        <input
                            type="text"
                            value={newMilestoneName}
                            onChange={(e) => setNewMilestoneName(e.target.value)}
                            placeholder="Enter milestone name..."
                            className="w-full text-xs border-slate-200 rounded-md py-1.5"
                        />
                    </div>
                    <div className="pt-4">
                        <button
                            onClick={submitMilestone}
                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
