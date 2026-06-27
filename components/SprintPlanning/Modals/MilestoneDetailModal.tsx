import React, { useState } from 'react';
import { ArrowRight, Square, CheckSquare, CircleDashed, Activity, Ban, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { UnifiedModalContainer } from './UnifiedModalContainer';
import { BreadcrumbNav } from './BreadcrumbNav';
import { FieldEditor } from './FieldEditor';
import { ChangeLog, ChangeEntry } from './ChangeLog';
import { InlineQuickAdd } from './InlineQuickAdd';
import { AdvisorContextLevel } from '../Board/StrategicAdvisorPanel';
import { TeamMemberDropdown } from './TeamMemberDropdown';

export interface MilestoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    milestoneId: string;
    breadcrumbOverride?: React.ReactNode;
    advisorContext?: { level: AdvisorContextLevel; name?: string };
}

export const MilestoneDetailModal: React.FC<MilestoneDetailModalProps> = ({
    isOpen,
    onClose,
    milestoneId,
    breadcrumbOverride,
    advisorContext
}) => {
    // Mock State
    const [title, setTitle] = useState("Design dashboard structure");
    const [outcome, setOutcome] = useState("Approved mockup from leadership");
    const [measure, setMeasure] = useState("Sign-off from founder on layout and KPIs");
    const [notes, setNotes] = useState("Waiting on CFO feedback on margin thresholds before finalizing the draft.");
    const [owner, setOwner] = useState("tm_1");
    const [timeline, setTimeline] = useState("Month 2");

    // Mock To-Dos
    const [todos, setTodos] = useState([
        { id: '1', text: 'Identify core metrics', completed: true },
        { id: '2', text: 'Draft wireframe layout', completed: true },
        { id: '3', text: 'Review with CFO', completed: false },
        { id: '4', text: 'Finalize Figma mockup', completed: false }
    ]);

    // Mock Change Log State
    const [changes, setChanges] = useState<ChangeEntry[]>([
        {
            id: 'c1',
            fieldName: 'status',
            oldValue: 'Not Started',
            newValue: 'In Progress',
            user: { name: 'Sarah', avatarInitials: 'S' },
            timestamp: '3 days ago'
        }
    ]);

    const handleFieldChange = (field: string, newValue: string, oldValue: string, note?: string) => {
        const newEntry: ChangeEntry = {
            id: `c_${Date.now()}`,
            fieldName: field,
            oldValue,
            newValue,
            user: { name: 'Founder', avatarInitials: 'F' }, // Mock current user
            timestamp: 'Just now',
            note
        };
        setChanges(prev => [newEntry, ...prev]);
    };

    const toggleTodo = (id: string) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    if (!isOpen) return null;

    // Custom breadcrumb for this deep view
    const deepBreadcrumbNodes = [
        { id: '1', label: 'Prioritize', level: 'tier' },
        { id: '2', label: 'Cash Flow Forecasting', level: 'capability' },
        { id: '3', label: 'Build Financial Dashboard', level: 'initiative' },
        { id: '4', label: 'Design ... structure', level: 'milestone' } // Truncated for space
    ];

    const leftContent = (
        <div className="h-full">
            {/* CONTEXT TAGS (Read-Only) */}
            <div className="flex flex-wrap items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-wider">
                <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded border border-slate-200">
                    Initiative: Build Financial Dashboard
                </div>
                <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded border border-slate-200">
                    Capability: Cash Flow Forecasting
                </div>
                <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                    Prioritize
                </div>
            </div>

            {/* MILESTONE TITLE */}
            <div className="mb-6">
                <FieldEditor
                    value={title}
                    onSave={(val, note) => {
                        handleFieldChange('title', val, title, note);
                        setTitle(val);
                    }}
                    textClassName="text-3xl font-bold text-slate-900 leading-tight"
                />
            </div>

            {/* OUTCOME & MEASURE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Outcome</label>
                    <FieldEditor
                        value={outcome}
                        onSave={(val, note) => {
                            handleFieldChange('outcome', val, outcome, note);
                            setOutcome(val);
                        }}
                        isMultiline={true}
                        textClassName="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Measure</label>
                    <FieldEditor
                        value={measure}
                        onSave={(val, note) => {
                            handleFieldChange('measure', val, measure, note);
                            setMeasure(val);
                        }}
                        isMultiline={true}
                        textClassName="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100"
                    />
                </div>
            </div>

            {/* TO-DOS */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Sub-Tasks / To-Dos</h3>
                    <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <div className="space-y-2">
                    {todos.map((todo) => (
                        <div key={todo.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg group transition-colors">
                            <button onClick={() => toggleTodo(todo.id)} className="text-slate-400 hover:text-blue-600 transition-colors">
                                {todo.completed ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                            </button>
                            <span className={`text-sm flex-1 ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                {todo.text}
                            </span>
                            <button className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="pt-2">
                    <InlineQuickAdd
                        placeholder="+ Add Sub-Task"
                        onAdd={(val) => {
                            const newTodo = { id: `td_${Date.now()}`, text: val, completed: false };
                            setTodos([...todos, newTodo]);
                            handleFieldChange('sub-tasks', `Added: ${val}`, '');
                        }}
                    />
                </div>
            </div>

            {/* NOTES / BLOCKERS */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1 block flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Notes & Blockers
                </label>
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
                    <FieldEditor
                        value={notes}
                        onSave={(val, note) => {
                            handleFieldChange('notes', val, notes, note);
                            setNotes(val);
                        }}
                        isMultiline={true}
                        textClassName="text-sm text-amber-900 leading-relaxed"
                    />
                </div>
            </div>
        </div>
    );

    const rightContent = (
        <div className="h-full flex flex-col">
            {/* OWNER */}
            <div className="mb-6">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Owner</label>
                <TeamMemberDropdown
                    value={owner}
                    onChange={(id) => {
                        handleFieldChange('owner', id, owner, 'Reassigned owner');
                        setOwner(id);
                    }}
                    className="w-full sm:w-64"
                />
            </div>

            {/* TIMELINE */}
            <div className="mb-6">
                <FieldEditor
                    value={timeline}
                    label="Timeline"
                    onSave={(val, note) => {
                        handleFieldChange('timeline', val, timeline, note);
                        setTimeline(val);
                    }}
                    textClassName="text-sm font-medium text-slate-900"
                />
            </div>

            {/* DEPENDENCIES */}
            <div className="mb-6">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dependencies</label>
                <div className="flex flex-col gap-2">
                    <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 truncate">Audit current data sources</span>
                        <span className="ml-auto text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Done</span>
                    </div>
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline self-start">
                        + Add Dependency
                    </button>
                </div>
            </div>

            {/* STATUS */}
            <div className="mb-8">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Status</label>
                <div className="flex flex-col gap-2 text-xs font-medium">
                    <button className="w-full text-left px-3 py-2 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-2">
                        <CircleDashed className="w-4 h-4 text-slate-400" />
                        Not Started
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-md bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        In Progress
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        Complete
                    </button>
                </div>
            </div>

            {/* CHANGE LOG */}
            <ChangeLog changes={changes} />

            {/* COMMENTS & ACTIVITY */}
            <div className="flex-1 flex flex-col min-h-[200px]">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Comments & Activity</label>

                <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] mb-4 pr-2">
                    <div className="flex items-center justify-center h-full text-sm italic text-slate-400">
                        No activity on this milestone yet.
                    </div>
                </div>

                {/* Input Area */}
                <div className="mt-auto relative">
                    <input
                        type="text"
                        placeholder="Add a comment..."
                        className="w-full text-sm border-slate-200 rounded-lg pr-10 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 p-1">
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <UnifiedModalContainer
            isOpen={isOpen}
            onClose={onClose}
            leftPanelContent={leftContent}
            rightPanelContent={rightContent}
            breadcrumbContent={breadcrumbOverride || <BreadcrumbNav nodes={deepBreadcrumbNodes} />}
            advisorContext={advisorContext}
        />
    );
};
