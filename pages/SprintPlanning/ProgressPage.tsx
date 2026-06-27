import React, { useState } from 'react';
import { QuarterOverviewCard } from '../../components/SprintPlanning/Progress/QuarterOverviewCard';
import { FilterBar } from '../../components/SprintPlanning/Progress/FilterBar';
import { MilestoneTable, MilestoneRow } from '../../components/SprintPlanning/Progress/MilestoneTable';
import { BulkActionBar } from '../../components/SprintPlanning/Progress/BulkActionBar';
import { InitiativeDetailModal } from '../../components/SprintPlanning/Modals/InitiativeDetailModal';
import { ChevronDown } from 'lucide-react';

export const ProgressPage: React.FC = () => {
    // Phase 1 State
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    // State for Phase 4-6
    const [milestones, setMilestones] = useState<MilestoneRow[]>(INITIAL_DATA);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [detailModalState, setDetailModalState] = useState<{ isOpen: boolean; initiativeId: string } | null>(null);

    // Download Handler Mock
    const handleDownload = (type: 'pdf' | 'csv') => {
        setIsGenerating(type);
        setTimeout(() => {
            setIsGenerating(null);
            setIsDownloadOpen(false);
        }, 1500);
    };

    // Table Handlers
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    // Bulk Actions
    const handleBulkStatusChange = (status: 'not_started' | 'in_progress' | 'complete') => {
        setMilestones(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, status } : m));
    };

    const handleBulkAddNote = (note: string) => {
        setMilestones(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, notes: note } : m));
    };

    const handleAddMilestone = (initiativeId: string, name: string) => {
        const newId = `new_m${Date.now()}`;
        const newRow: MilestoneRow = {
            id: newId,
            initiativeName: initiativeId === 'i1' ? 'Build Financial Dashboard' : (initiativeId === 'i2' ? 'Define Leadership Roles' : 'Redesign Pipeline Funnel'),
            name: name,
            status: 'not_started',
            ownerName: '—',
            ownerInitials: '',
            timeframe: '—',
            notes: '—'
        };
        setMilestones(prev => [...prev, newRow]);
    };

    // Modal Handler
    const handleOpenModal = (milestoneName: string) => {
        // Mock: Open modal for Initiative 1 default or simple map
        setDetailModalState({ isOpen: true, initiativeId: 'i1' });
    };

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            {/* Persistent Sprint Goal Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                <p className="text-sm font-medium text-slate-500 mb-1">SPRINT GOAL</p>
                <p className="text-lg text-slate-900 font-medium">We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.</p>
            </div>

            {/* Phase 1: Header Row */}
            <div className="flex justify-between items-center pt-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Q1 2025 PROGRESS</h2>

                <div className="relative">
                    <button
                        onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                    >
                        {isGenerating ? 'Generating...' : 'Download'}
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Phase 8: Dropdown Placeholder */}
                    {isDownloadOpen && !isGenerating && (
                        <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-100 rounded-lg shadow-xl z-20 py-1 animated fade-in-down animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => handleDownload('pdf')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 font-medium"
                            >
                                PDF Report
                            </button>
                            <button
                                onClick={() => handleDownload('csv')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 font-medium"
                            >
                                CSV Export
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Phase 2: Quarter Overview Card */}
            <QuarterOverviewCard />

            {/* Phase 3: Filter Bar */}
            <FilterBar />

            {/* Phase 5: Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <BulkActionBar
                    selectedCount={selectedIds.length}
                    onStatusChange={handleBulkStatusChange}
                    onAddNote={handleBulkAddNote}
                    onAddMilestone={handleAddMilestone}
                />
            )}

            {/* Phase 4: Milestone Table */}
            <MilestoneTable
                data={milestones}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpenModal={handleOpenModal}
            />

            {/* Phase 6: Modal Integration */}
            <InitiativeDetailModal
                isOpen={detailModalState?.isOpen || false}
                onClose={() => setDetailModalState(null)}
                initiativeId={detailModalState?.initiativeId || ''}
            />
        </div>
    );
};

// INITIAL MOCK DATA
const INITIAL_DATA: MilestoneRow[] = [
    // Initiative 1: Build Financial Dashboard
    { id: 'm1', initiativeName: 'Build Financial Dashboard', name: 'Audit current data sources', status: 'complete', ownerName: 'Sarah', ownerInitials: 'S', timeframe: 'January', notes: '—' },
    { id: 'm2', initiativeName: 'Build Financial Dashboard', name: 'Design dashboard structure', status: 'in_progress', ownerName: 'Sarah', ownerInitials: 'S', timeframe: 'February', notes: 'Waiting on CFO feedback' },
    { id: 'm3', initiativeName: 'Build Financial Dashboard', name: 'Build & populate dashboard', status: 'not_started', ownerName: 'Tech Lead', ownerInitials: 'TL', timeframe: 'Feb-Mar', notes: 'Depends on: Design dashboard' },
    { id: 'm4', initiativeName: 'Build Financial Dashboard', name: 'Train team on dashboard use', status: 'not_started', ownerName: 'Sarah', ownerInitials: 'S', timeframe: 'March', notes: '—' },
    { id: 'm5', initiativeName: 'Build Financial Dashboard', name: 'Document reporting cadence', status: 'not_started', ownerName: 'Founder', ownerInitials: 'F', timeframe: 'March', notes: 'Weekly digest format TBD' },

    // Initiative 2: Define Leadership Roles
    { id: 'm6', initiativeName: 'Define Leadership Roles', name: 'Draft org chart', status: 'in_progress', ownerName: 'Founder', ownerInitials: 'F', timeframe: 'January', notes: 'Drafting now' },
    { id: 'm7', initiativeName: 'Define Leadership Roles', name: 'Define role expectations', status: 'not_started', ownerName: 'Founder', ownerInitials: 'F', timeframe: 'February', notes: '—' },
    { id: 'm8', initiativeName: 'Define Leadership Roles', name: 'Assign interim leads', status: 'not_started', ownerName: 'Founder', ownerInitials: 'F', timeframe: 'February', notes: 'Pending org chart sign-off' },

    // Initiative 3: Redesign Pipeline Funnel
    { id: 'm9', initiativeName: 'Redesign Pipeline Funnel', name: 'Audit current funnel stages', status: 'complete', ownerName: 'Founder', ownerInitials: 'F', timeframe: 'January', notes: 'Phase 1 complete' },
    { id: 'm10', initiativeName: 'Redesign Pipeline Funnel', name: 'Define new stage criteria', status: 'in_progress', ownerName: 'Tom', ownerInitials: 'T', timeframe: 'January', notes: '—' },
    { id: 'm11', initiativeName: 'Redesign Pipeline Funnel', name: 'Build stage tracking view', status: 'not_started', ownerName: 'Tech Lead', ownerInitials: 'TL', timeframe: 'Feb-Mar', notes: 'Depends on: Define stages' },
    { id: 'm12', initiativeName: 'Redesign Pipeline Funnel', name: 'Train sales team on new flow', status: 'not_started', ownerName: 'Tom', ownerInitials: 'T', timeframe: 'March', notes: '—' },
];
