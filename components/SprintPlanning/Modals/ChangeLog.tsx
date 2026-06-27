import React, { useState } from 'react';
import { History, ChevronDown, ChevronRight } from 'lucide-react';

export interface ChangeEntry {
    id: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    user: {
        name: string;
        avatarInitials: string;
    };
    timestamp: string; // e.g., '3 days ago'
    note?: string;
}

export interface ChangeLogProps {
    changes: ChangeEntry[];
}

export const ChangeLog: React.FC<ChangeLogProps> = ({ changes }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatFieldName = (name: string) => {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    };

    return (
        <div className="mb-8 border-t border-slate-200 pt-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between text-left group"
            >
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer group-hover:text-slate-600 transition-colors">
                        Change History
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {changes.length} {changes.length === 1 ? 'change' : 'changes'}
                    </span>
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-2">
                    {changes.length === 0 ? (
                        <p className="text-sm text-slate-500 italic px-2">No changes recorded yet.</p>
                    ) : (
                        changes.map((change) => (
                            <div key={change.id} className="relative pl-4 border-l-2 border-slate-200 pb-2 last:pb-0">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-200" />
                                <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700">
                                            {change.user.avatarInitials}
                                        </div>
                                        {change.user.name}
                                    </div>
                                    <span>•</span>
                                    <span>{change.timestamp}</span>
                                </div>
                                <div className="text-sm text-slate-700 leading-snug">
                                    <span className="font-medium text-slate-900">{formatFieldName(change.fieldName)}</span> updated
                                </div>
                                {change.oldValue && (
                                    <div className="mt-1.5 p-2 bg-slate-50 rounded-md border border-slate-100 text-xs text-slate-600 font-medium">
                                        <span className="line-through opacity-60 mr-2">{change.oldValue}</span>
                                        <span className="text-indigo-600">{change.newValue}</span>
                                    </div>
                                )}
                                {change.note && (
                                    <div className="mt-1.5 pl-3 border-l-2 border-indigo-200 text-xs italic text-slate-600">
                                        "{change.note}"
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
