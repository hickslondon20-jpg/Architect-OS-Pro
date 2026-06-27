import React, { useState } from 'react';
import { Check, Circle, X, AlertTriangle, ArrowUp, ArrowDown, Activity } from 'lucide-react';

export interface MilestoneRow {
    id: string;
    initiativeName: string;
    name: string;
    status: 'complete' | 'on_track' | 'at_risk' | 'blocked' | 'not_started';
    ownerName: string;
    ownerInitials: string;
    timeframe: string;
    notes: string;
}

interface MilestoneTableProps {
    data: MilestoneRow[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onOpenModal: (text: string) => void;
    onStatusClick?: (id: string) => void;
}

type SortField = 'name' | 'status' | 'ownerName' | 'timeframe';
type SortDirection = 'asc' | 'desc';

export const MilestoneTable: React.FC<MilestoneTableProps> = ({
    data,
    selectedIds,
    onToggleSelect,
    onOpenModal,
    onStatusClick
}) => {
    // Sort State
    const [sortField, setSortField] = useState<SortField>('timeframe'); // Default sort by timeframe?
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Sort Logic
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedData = [...data].sort((a, b) => {
        const aValue = a[fieldToProp(sortField)];
        const bValue = b[fieldToProp(sortField)];

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    function fieldToProp(field: SortField): keyof MilestoneRow {
        return field; // Direct match for simple fields
    }

    // Checking Selection
    const isSelected = (id: string) => selectedIds.includes(id);

    // Render Status Icon Helper (Updated for Health)
    const renderStatus = (status: MilestoneRow['status']) => {
        switch (status) {
            case 'complete':
                return <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div><span className="text-sm font-medium text-slate-700">Complete</span></div>;
            case 'on_track':
                return <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /></div><span className="text-sm font-medium text-slate-700">On Track</span></div>;
            case 'at_risk':
                return <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-3 h-3 text-amber-600" /></div><span className="text-sm font-medium text-slate-700">At Risk</span></div>;
            case 'blocked':
                return <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><X className="w-3 h-3 text-red-600" /></div><span className="text-sm font-medium text-slate-700">Blocked</span></div>;
            default:
                return <div className="flex items-center gap-2"><Circle className="w-5 h-5 text-slate-300" /><span className="text-sm font-medium text-slate-400">Not Started</span></div>;
        }
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <div className="w-3 h-3" />; // Spacer
        return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
    };

    const HeaderCell = ({ field, label, width }: { field: SortField | '', label: string, width?: string }) => (
        <th
            className={`text-left text-xs font-bold text-slate-500 uppercase tracking-wider py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group ${width}`}
            onClick={() => field && handleSort(field as SortField)}
        >
            <div className="flex items-center gap-1">
                {label}
                {field && renderSortIcon(field as SortField)}
            </div>
        </th>
    );

    return (
        <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="w-12 py-3 px-4"></th> {/* Checkbox */}
                        <HeaderCell field="name" label="Milestone" />
                        <HeaderCell field="status" label="Status" />
                        <HeaderCell field="ownerName" label="Owner" />
                        <HeaderCell field="timeframe" label="Timeframe" />
                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, index) => (
                        <tr
                            key={row.id}
                            className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${isSelected(row.id) ? 'bg-blue-50/30' : (index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white')}`}
                        >
                            <td className="py-4 px-4 align-top">
                                <button
                                    onClick={() => onToggleSelect(row.id)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected(row.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                                >
                                    {isSelected(row.id) && <Check className="w-3 h-3 text-white" />}
                                </button>
                            </td>
                            <td className="py-4 px-4 align-top">
                                <div className="text-xs text-slate-500 mb-0.5">{row.initiativeName}</div>
                                <button
                                    onClick={() => onOpenModal(row.name)}
                                    className="font-bold text-slate-900 text-sm hover:text-blue-600 hover:underline text-left block"
                                >
                                    {row.name}
                                </button>
                            </td>
                            <td className="py-4 px-4 align-top cursor-pointer" onClick={() => onStatusClick?.(row.id)}>
                                {renderStatus(row.status)}
                            </td>
                            <td className="py-4 px-4 align-top">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                        {row.ownerInitials}
                                    </div>
                                    <span className="text-sm text-slate-700">{row.ownerName}</span>
                                </div>
                            </td>
                            <td className="py-4 px-4 align-top text-sm text-slate-700">
                                {row.timeframe}
                            </td>
                            <td className="py-4 px-4 align-top text-sm text-slate-500 max-w-xs truncate">
                                {row.notes}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
