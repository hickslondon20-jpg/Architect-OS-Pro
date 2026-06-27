import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

type FilterType = 'initiative' | 'column' | 'owner' | 'status' | 'timeframe';

interface FilterOption {
    id: string;
    label: string;
}

const FILTER_OPTIONS = {
    initiative: [
        { id: 'i1', label: 'Build Financial Dashboard' },
        { id: 'i2', label: 'Define Leadership Roles' },
        { id: 'i3', label: 'Redesign Pipeline Funnel' },
    ],
    column: [
        { id: 'prioritize', label: 'Prioritize' },
        { id: 'plant', label: 'Plant' },
        { id: 'iterate', label: 'Progressively Iterate' },
    ],
    owner: [
        { id: 'founder', label: 'Founder' },
        { id: 'sarah', label: 'Sarah' },
        { id: 'tom', label: 'Tom' },
        { id: 'tech', label: 'Tech Lead' },
        { id: 'alex', label: 'Alex' },
    ],
    status: [
        { id: 'not_started', label: 'Not Started' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'complete', label: 'Complete' },
        { id: 'blocked', label: 'Blocked' },
    ],
    timeframe: [
        { id: 'jan', label: 'January' },
        { id: 'feb', label: 'February' },
        { id: 'mar', label: 'March' },
        { id: 'q1', label: 'Q1 (all)' },
    ]
};

export const FilterBar: React.FC = () => {
    // Selection State
    const [selectedInitiatives, setSelectedInitiatives] = useState<string[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedTimeframe, setSelectedTimeframe] = useState<string>('q1');

    // UI State
    const [activeDropdown, setActiveDropdown] = useState<FilterType | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handlers
    const toggleSelection = (id: string, current: string[], setter: (val: string[]) => void) => {
        if (current.includes(id)) {
            setter(current.filter(item => item !== id));
        } else {
            setter([...current, id]);
        }
    };

    const handleTimeframeSelect = (id: string) => {
        setSelectedTimeframe(id);
        setActiveDropdown(null);
    };

    const handleClearAll = () => {
        setSelectedInitiatives([]);
        setSelectedColumns([]);
        setSelectedOwners([]);
        setSelectedStatuses([]);
        setSelectedTimeframe('q1');
    };

    const hasActiveFilters =
        selectedInitiatives.length > 0 ||
        selectedColumns.length > 0 ||
        selectedOwners.length > 0 ||
        selectedStatuses.length > 0 ||
        selectedTimeframe !== 'q1';

    // Render Helpers
    const renderButton = (type: FilterType, label: string, count: number, isOpen: boolean) => (
        <button
            onClick={() => setActiveDropdown(isOpen ? null : type)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border flex items-center gap-2 transition-all ${isOpen || count > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
        >
            {label} {count > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full ml-1">{count} selected</span>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
    );

    const renderDropdownContent = (type: FilterType) => {
        const options = FILTER_OPTIONS[type];

        // Timeframe (Radio)
        if (type === 'timeframe') {
            return (
                <div className="py-1">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => handleTimeframeSelect(opt.id)}
                            className="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50"
                        >
                            <span className={selectedTimeframe === opt.id ? 'text-blue-700 font-medium' : 'text-slate-700'}>{opt.label}</span>
                            {selectedTimeframe === opt.id && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                        </button>
                    ))}
                </div>
            );
        }

        // Others (Checkbox)
        let current: string[] = [];
        let setter: any;
        if (type === 'initiative') { current = selectedInitiatives; setter = setSelectedInitiatives; }
        if (type === 'column') { current = selectedColumns; setter = setSelectedColumns; }
        if (type === 'owner') { current = selectedOwners; setter = setSelectedOwners; }
        if (type === 'status') { current = selectedStatuses; setter = setSelectedStatuses; }

        return (
            <div className="py-1 max-h-60 overflow-y-auto">
                {options.map(opt => {
                    const isSelected = current.includes(opt.id);
                    return (
                        <button
                            key={opt.id}
                            onClick={() => toggleSelection(opt.id, current, setter)}
                            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50"
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={isSelected ? 'text-slate-900 font-medium' : 'text-slate-700'}>{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex items-center justify-between mb-6 relative z-10" ref={dropdownRef}>
            <div className="flex items-center gap-2">
                {/* Initiative */}
                <div className="relative">
                    {renderButton('initiative', 'Initiative', selectedInitiatives.length, activeDropdown === 'initiative')}
                    {activeDropdown === 'initiative' && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {renderDropdownContent('initiative')}
                        </div>
                    )}
                </div>

                {/* Column */}
                <div className="relative">
                    {renderButton('column', '3P Column', selectedColumns.length, activeDropdown === 'column')}
                    {activeDropdown === 'column' && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {renderDropdownContent('column')}
                        </div>
                    )}
                </div>

                {/* Owner */}
                <div className="relative">
                    {renderButton('owner', 'Owner', selectedOwners.length, activeDropdown === 'owner')}
                    {activeDropdown === 'owner' && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {renderDropdownContent('owner')}
                        </div>
                    )}
                </div>

                {/* Status */}
                <div className="relative">
                    {renderButton('status', 'Status', selectedStatuses.length, activeDropdown === 'status')}
                    {activeDropdown === 'status' && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {renderDropdownContent('status')}
                        </div>
                    )}
                </div>

                {/* Timeframe */}
                <div className="relative">
                    <button
                        onClick={() => setActiveDropdown(activeDropdown === 'timeframe' ? null : 'timeframe')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border flex items-center gap-2 transition-all ${activeDropdown === 'timeframe' || selectedTimeframe !== 'q1'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        {selectedTimeframe === 'q1' ? 'Timeframe: Q1' : `Timeframe: ${FILTER_OPTIONS.timeframe.find(t => t.id === selectedTimeframe)?.label}`}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'timeframe' ? 'rotate-180' : ''}`} />
                    </button>
                    {activeDropdown === 'timeframe' && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                            {renderDropdownContent('timeframe')}
                        </div>
                    )}
                </div>
            </div>

            {hasActiveFilters && (
                <button
                    onClick={handleClearAll}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                    <X className="w-3 h-3" />
                    Clear All
                </button>
            )}
        </div>
    );
};
