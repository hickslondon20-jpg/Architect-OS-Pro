import { Edit2, ExternalLink, CheckCircle2, Circle, X, PlayCircle, Loader2, ChevronDown, Plus, ChevronUp, ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { FieldEditor } from './FieldEditor';
import { ChangeLog, ChangeEntry } from './ChangeLog';
import { UnifiedModalContainer } from './UnifiedModalContainer';
import { BreadcrumbNav } from './BreadcrumbNav';
import { InlineQuickAdd } from './InlineQuickAdd';
import { MilestoneDetailModal } from './MilestoneDetailModal';
import { AdvisorContextLevel } from '../Board/StrategicAdvisorPanel';
import { TeamMemberDropdown } from './TeamMemberDropdown';
import { MOCK_TEAM_MEMBERS } from './TeamMembersModal';

// MOCK DATA for Modal
const MOCK_MILESTONES_DETAIL = [
    { id: 'm1', name: 'Audit current data sources', status: 'complete', owner: 'tm_1', timeline: 'January', outcome: 'Complete inventory of all data systems', measure: 'All systems documented in shared sheet', notes: '' },
    { id: 'm2', name: 'Design dashboard structure', status: 'in_progress', owner: 'tm_1', timeline: 'February', outcome: 'Approved mockup from leadership', measure: 'Sign-off from founder on layout and KPIs', notes: 'Waiting on CFO feedback on margin thresholds' },
    { id: 'm3', name: 'Build & populate dashboard', status: 'not_started', owner: 'tm_2', timeline: 'Feb-Mar', outcome: 'Live dashboard showing 3 months of accurate data', measure: 'Data matches source systems within 2% variance', notes: '', dependsOn: ['m2'] },
    { id: 'm4', name: 'Train team on dashboard use', status: 'not_started', owner: 'tm_1', timeline: 'March', outcome: 'All team members can read and interpret reports independently', measure: 'Each team member completes a 15-minute walkthrough', notes: '', dependsOn: ['m3'] },
    { id: 'm5', name: 'Dashboard review & refinement', status: 'not_started', owner: 'tm_3', timeline: 'March', outcome: 'Final sign-off on dashboard version 1.0', measure: 'Founder approves for team-wide rollout', notes: '', dependsOn: ['m4'] },
];

const MilestoneRow: React.FC<{ milestone: any; onOpenFull: (id: string) => void }> = ({ milestone, onOpenFull }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLabelDropdown, setShowLabelDropdown] = useState(false);

    // Status Icon Helper
    const StatusIcon = () => {
        if (milestone.status === 'complete') return <div className="text-green-500"><CheckCircle2 className="w-5 h-5 fill-current text-white bg-green-500 rounded-full" /></div>;
        if (milestone.status === 'in_progress') return <div className="text-blue-500"><div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center relative"><div className="w-2.5 h-5 bg-current absolute left-0 rounded-l-full" /></div></div>;
        return <div className="text-slate-300"><Circle className="w-5 h-5" /></div>;
    };

    if (isExpanded) {
        return (
            <div className="bg-white border border-blue-200 rounded-lg shadow-sm p-4 relative animate-in slide-in-from-top-1 duration-200">
                <button
                    onClick={() => setIsExpanded(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="mb-4 pr-8">
                    <input type="text" defaultValue={milestone.name} className="font-bold text-slate-900 w-full border-none p-0 focus:ring-0" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Outcome</label>
                        <input type="text" defaultValue={milestone.outcome} className="w-full text-sm border-slate-200 rounded-md focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Measure</label>
                        <input type="text" defaultValue={milestone.measure} className="w-full text-sm border-slate-200 rounded-md focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Owner</label>
                        <TeamMemberDropdown
                            value={milestone.owner}
                            onChange={(val) => { /* mock update logic */ }}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Timeline</label>
                        <select className="w-full text-sm border-slate-200 rounded-md bg-slate-50" defaultValue={milestone.timeline}>
                            <option>January</option>
                            <option>February</option>
                            <option>March</option>
                            <option>Jan-Feb</option>
                            <option>Feb-Mar</option>
                        </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Dependencies</label>
                        <div className="flex flex-wrap gap-1">
                            {(milestone.dependsOn || []).map((dep: string) => (
                                <span key={dep} className="text-xs px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                                    {dep}
                                </span>
                            ))}
                            {(!milestone.dependsOn || milestone.dependsOn.length === 0) && <span className="text-xs text-slate-400 italic py-1">None</span>}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <input type="text" defaultValue={milestone.notes} placeholder="Add a note or flag a blocker" className="w-full text-sm border-slate-200 rounded-md placeholder:italic" />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        <button className={`px-3 py-1 text-xs rounded-full font-medium border ${milestone.status === 'not_started' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Not Started</button>
                        <button className={`px-3 py-1 text-xs rounded-full font-medium border ${milestone.status === 'in_progress' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>In Progress</button>
                        <button className={`px-3 py-1 text-xs rounded-full font-medium border ${milestone.status === 'complete' ? 'bg-green-100 border-green-300 text-green-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Complete</button>
                    </div>

                    <button
                        onClick={() => onOpenFull(milestone.id)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        Open Full Detail View →
                    </button>
                </div>
            </div>
        );
    }

    const ownerMember = MOCK_TEAM_MEMBERS.find(m => m.id === milestone.owner);
    const ownerInitials = ownerMember ? `${ownerMember.first_name[0]}${ownerMember.last_name[0]}` : '?';

    return (
        <div
            className="group flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200"
            onClick={() => setIsExpanded(true)}
            title={`Outcome: ${milestone.outcome}`}
        >
            <StatusIcon />
            <div className="flex-1 font-medium text-slate-700 group-hover:text-blue-700 transition-colors">{milestone.name}</div>
            <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0 uppercase">
                    {ownerInitials}
                </div>
                <div className="text-xs text-slate-400 w-16 text-right">{milestone.timeline}</div>
            </div>
        </div>
    );
};

interface InitiativeDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    initiativeId: string;
    initialFocus?: string;
    breadcrumbOverride?: React.ReactNode;
    onMilestoneClick?: (milestoneId: string) => void;
    onAddMilestone?: (name?: string) => void;
    advisorContext?: { level: AdvisorContextLevel; name?: string };
}

export const InitiativeDetailModal: React.FC<InitiativeDetailModalProps> = ({
    isOpen,
    onClose,
    initiativeId,
    initialFocus,
    breadcrumbOverride,
    onMilestoneClick,
    onAddMilestone,
    advisorContext
}) => {
    const [showLabelDropdown, setShowLabelDropdown] = useState(false);
    const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);

    // Mock State for Edit Modes
    const [title, setTitle] = useState("Build Financial Dashboard");
    const [description, setDescription] = useState("We need consolidated financial visibility before we can make confident scaling decisions this quarter. This dashboard will pull together revenue, margin, and utilization data into a single view that leadership can trust.");
    const [owner, setOwner] = useState("tm_1");
    const [successDefinition, setSuccessDefinition] = useState("A live dashboard showing daily margin by product line, accessible to the executive team.");
    const [sprintGoalConnection, setSprintGoalConnection] = useState("This enables our goal of margin visibility before Q2 pricing decisions.");
    const [constraintsOrRisks, setConstraintsOrRisks] = useState("Pending API access from the accounting platform.");
    const [targetCompletion, setTargetCompletion] = useState("End of March");

    // Mock Change Log State
    const [changes, setChanges] = useState<ChangeEntry[]>([
        {
            id: 'c1',
            fieldName: 'targetCompletion',
            oldValue: 'End of February',
            newValue: 'End of March',
            user: { name: 'Founder', avatarInitials: 'F' },
            timestamp: '2 days ago',
            note: 'Moved out one month due to data pipeline blocker.'
        }
    ]);

    const handleFieldChange = (field: string, newValue: string, oldValue: string, note?: string) => {
        const newEntry: ChangeEntry = {
            id: `c_${Date.now()}`,
            fieldName: field,
            oldValue,
            newValue,
            user: { name: 'Sarah', avatarInitials: 'S' }, // Mock current user
            timestamp: 'Just now',
            note
        };
        setChanges(prev => [newEntry, ...prev]);
    };

    // Initial Focus Effect
    useEffect(() => {
        if (isOpen && initialFocus === 'labels') {
            setTimeout(() => {
                const el = document.getElementById('labels-section');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Optional: Add highlight animation trigger here
                }
            }, 300); // Wait for animation
        }
    }, [isOpen, initialFocus]);

    if (!isOpen) return null;

    const leftContent = (
        <div className="h-full">
            {/* INITIATIVE TITLE */}
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

            {/* DESCRIPTION / OUTCOME */}
            <div className="mb-8">
                <FieldEditor
                    value={description}
                    onSave={(val, note) => {
                        handleFieldChange('description', val, description, note);
                        setDescription(val);
                    }}
                    isMultiline={true}
                    promptForChangeNote={true}
                    label="What We Are Addressing"
                    textClassName="text-slate-600 leading-relaxed text-base"
                />
            </div>

            {/* WHAT SUCCESS LOOKS LIKE */}
            <div className="mb-8">
                <FieldEditor
                    value={successDefinition}
                    onSave={(val, note) => {
                        handleFieldChange('successDefinition', val, successDefinition, note);
                        setSuccessDefinition(val);
                    }}
                    isMultiline={true}
                    promptForChangeNote={true}
                    label="What Success Looks Like"
                    textClassName="text-slate-600 leading-relaxed text-base"
                />
            </div>


            {/* MILESTONES SECTION */}
            <div className="space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestones</div>

                <div className="space-y-1">
                    {/* Mock Milestone Rows - implementing directly here for the specific layout requirements */}
                    {MOCK_MILESTONES_DETAIL.map((ms) => (
                        <MilestoneRow
                            key={ms.id}
                            milestone={ms}
                            onOpenFull={(id) => {
                                if (onMilestoneClick) onMilestoneClick(id);
                                else setSelectedMilestone(id);
                            }}
                        />
                    ))}
                </div>

                <div className="pt-2 space-y-3">
                    <InlineQuickAdd
                        placeholder="+ Quick Add Milestone"
                        onAdd={(val) => {
                            if (onAddMilestone) onAddMilestone(val);
                        }}
                    />
                    <button
                        onClick={() => {
                            if (onAddMilestone) onAddMilestone();
                        }}
                        className="w-full py-2.5 bg-white border border-slate-900 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium flex items-center justify-center group"
                    >
                        <Plus className="w-4 h-4 mr-2 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        Add Milestone
                    </button>
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

            {/* 3P CLASSIFICATION */}
            <div className="mb-6">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">3P Classification</label>
                <div className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors">
                    Prioritize
                    <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
                </div>
            </div>

            {/* LABELS (Now in Right Panel per PRD) */}
            <div className="mb-8 relative" id="labels-section">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Checkpoint Labels</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {/* Mock Label 1 */}
                    <div className="flex items-center px-2 py-1 rounded bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-colors group">
                        <span className="mr-1">1.1.2</span> Visibility Across Core Drivers
                        <button className="ml-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    {/* Mock Label 2 */}
                    <div className="flex items-center px-2 py-1 rounded bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-colors group">
                        <span className="mr-1">1.1.1</span> Data Integrity & Reporting
                        <button className="ml-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
                <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                    onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                >
                    + Add Label
                </button>

                {/* LABEL SEARCH DROPDOWN */}
                {showLabelDropdown && (
                    <div className="absolute top-full left-0 w-80 bg-white border border-slate-200 shadow-xl rounded-lg z-30 mt-2 p-3 animate-in zoom-in-95 duration-100">
                        <input
                            type="text"
                            placeholder="Search capabilities or checkpoints..."
                            className="w-full text-sm border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-3"
                            autoFocus
                        />

                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {/* PRIORITIZE */}
                            <div className="bg-slate-50 rounded-md overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase flex items-center justify-between cursor-pointer">
                                    Prioritize
                                    <ChevronDown className="w-3 h-3" />
                                </div>
                                <div className="p-2 space-y-1">
                                    <div className="flex items-start gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer">
                                        <div className="mt-0.5 w-3 h-3 border border-slate-300 rounded-sm" />
                                        <div>
                                            <div className="text-xs font-medium text-slate-800 leading-tight">1.1.3 Cash Flow Projection Accuracy</div>
                                            <div className="text-[10px] text-slate-500">Cash Flow Forecasting</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer">
                                        <div className="mt-0.5 w-3 h-3 border border-slate-300 rounded-sm" />
                                        <div>
                                            <div className="text-xs font-medium text-slate-800 leading-tight">2.1.1 Pipeline Stage Definition</div>
                                            <div className="text-[10px] text-slate-500">Pipeline Health</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SPRINT GOAL CONNECTION */}
            <div className="mb-6">
                <FieldEditor
                    value={sprintGoalConnection}
                    label="Sprint Goal Connection"
                    onSave={(val, note) => {
                        handleFieldChange('sprintGoalConnection', val, sprintGoalConnection, note);
                        setSprintGoalConnection(val);
                    }}
                    isMultiline={true}
                    textClassName="text-sm text-slate-600 italic leading-relaxed"
                />
            </div>

            {/* KNOWN CONSTRAINTS OR RISKS */}
            <div className="mb-6">
                <FieldEditor
                    value={constraintsOrRisks}
                    label="Known Constraints or Risks"
                    onSave={(val, note) => {
                        handleFieldChange('constraintsOrRisks', val, constraintsOrRisks, note);
                        setConstraintsOrRisks(val);
                    }}
                    isMultiline={true}
                    textClassName="text-sm text-slate-600 leading-relaxed"
                />
            </div>

            {/* TARGET COMPLETION */}
            <div className="mb-6">
                <FieldEditor
                    value={targetCompletion}
                    label="Target Completion"
                    onSave={(val, note) => {
                        handleFieldChange('targetCompletion', val, targetCompletion, note);
                        setTargetCompletion(val);
                    }}
                    textClassName="text-sm font-medium text-slate-900"
                />
            </div>

            {/* STATUS */}
            <div className="mb-8">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <button className="px-3 py-1.5 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">Not Started</button>
                    <button className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 transition-all">In Progress</button>
                    <button className="px-3 py-1.5 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">At Risk</button>
                    <button className="px-3 py-1.5 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">Blocked</button>
                    <button className="px-3 py-1.5 rounded-md bg-transparent text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">Complete</button>
                </div>
            </div>

            {/* CHANGE LOG */}
            <ChangeLog changes={changes} />

            {/* COMMENTS & ACTIVITY */}
            <div className="flex-1 flex flex-col min-h-[200px]">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Comments & Activity</label>

                <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] mb-4 pr-2">
                    {/* Comment 1 */}
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-slate-600">F</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs text-slate-500">
                                <span className="font-semibold text-slate-900">Founder</span> • Jan 20, 9:00 AM
                            </div>
                            <p className="text-sm text-slate-700 leading-snug">
                                Prioritizing this one because Q1 revenue visibility depends on it.
                            </p>
                        </div>
                    </div>

                    {/* Comment 2 */}
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-700">S</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs text-slate-500">
                                <span className="font-semibold text-slate-900">Sarah</span> • Jan 28, 2:14 PM
                            </div>
                            <p className="text-sm text-slate-700 leading-snug">
                                Audit is done. Moving to design phase next week.
                            </p>
                        </div>
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
        <>
            <UnifiedModalContainer
                isOpen={isOpen}
                onClose={onClose}
                leftPanelContent={leftContent}
                rightPanelContent={rightContent}
                breadcrumbContent={breadcrumbOverride || <BreadcrumbNav />}
                advisorContext={advisorContext}
            />

            {/* Render Milestone Modal if selected locally (fallback if manager not used) */}
            <MilestoneDetailModal
                isOpen={!!selectedMilestone}
                onClose={() => setSelectedMilestone(null)}
                milestoneId={selectedMilestone || ''}
            />
        </>
    );
};
