import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';

export interface FieldEditorProps {
    value: string;
    onSave: (newValue: string, note?: string) => void;
    label?: string;
    isMultiline?: boolean;
    textClassName?: string;
    promptForChangeNote?: boolean;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({
    value,
    onSave,
    label,
    isMultiline = false,
    textClassName = "",
    promptForChangeNote = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [showPrompt, setShowPrompt] = useState(false);
    const [changeNote, setChangeNote] = useState('');

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    const handleInitialSave = () => {
        if (tempValue.trim() === value.trim()) {
            // No change made
            setIsEditing(false);
            return;
        }

        if (promptForChangeNote) {
            setShowPrompt(true);
        } else {
            finalizeSave('');
        }
    };

    const finalizeSave = (note: string) => {
        onSave(tempValue, note);
        setShowPrompt(false);
        setChangeNote('');
        setIsEditing(false);
    };

    if (showPrompt) {
        return (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl animate-in fade-in zoom-in-95 duration-200 shadow-sm relative z-20 my-2">
                <p className="text-sm font-semibold text-indigo-900 mb-2">
                    What prompted this change? <span className="text-indigo-500 font-normal italic">(Optional)</span>
                </p>
                <input
                    type="text"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    className="w-full text-sm border-indigo-200 bg-white rounded-lg px-3 py-2 mb-3 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Briefly explain the adjustment..."
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') finalizeSave(changeNote);
                        if (e.key === 'Escape') finalizeSave('');
                    }}
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => finalizeSave('')}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-white rounded-md transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        onClick={() => finalizeSave(changeNote)}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-sm"
                    >
                        Add Context
                    </button>
                </div>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="space-y-2 relative z-10 animate-in fade-in duration-200 my-1 bg-white p-3 -mx-3 rounded-xl border border-blue-100 shadow-sm">
                {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
                {isMultiline ? (
                    <textarea
                        className={`w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none min-h-[100px] ${textClassName}`}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                    />
                ) : (
                    <input
                        className={`w-full text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none ${textClassName}`}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInitialSave();
                            if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
                        }}
                    />
                )}
                <div className="flex gap-2 justify-end mt-2">
                    <button
                        onClick={() => { setTempValue(value); setIsEditing(false); }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInitialSave}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative -mx-2 px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all">
            <div className={`pr-8 ${textClassName}`}>
                {value}
            </div>
            <button
                onClick={() => setIsEditing(true)}
                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Edit field"
            >
                <Pencil className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
