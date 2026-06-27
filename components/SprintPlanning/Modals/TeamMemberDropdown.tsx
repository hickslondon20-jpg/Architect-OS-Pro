import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Plus, User, Check, X } from 'lucide-react';
import { MOCK_TEAM_MEMBERS, MOCK_TeamMember } from './TeamMembersModal';
import { Input, Button, Label } from '../../ui';

export interface TeamMemberDropdownProps {
    value?: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
}

export const TeamMemberDropdown: React.FC<TeamMemberDropdownProps> = ({
    value,
    onChange,
    placeholder = "Select an owner...",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Add form state
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPosition, setNewPosition] = useState('');

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync active members (filter out deleted)
    const activeMembers = MOCK_TEAM_MEMBERS.filter(m => m.deleted_at === null);

    const selectedMember = activeMembers.find(m => m.id === value);

    const filteredMembers = activeMembers.filter(m => {
        const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsAdding(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFirstName.trim() || !newLastName.trim()) return;

        const newMember: MOCK_TeamMember = {
            id: `tm_${Date.now()}`,
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            position: newPosition.trim() || undefined,
            deleted_at: null
        };

        MOCK_TEAM_MEMBERS.push(newMember); // Mutate global mock

        onChange(newMember.id);

        // Reset and close
        setNewFirstName('');
        setNewLastName('');
        setNewPosition('');
        setIsAdding(false);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Dropdown Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md shadow-sm bg-white hover:bg-slate-50 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 ${isOpen ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-slate-300'
                    }`}
            >
                {selectedMember ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                        </div>
                        <span className="font-medium text-slate-900 truncate">
                            {selectedMember.first_name} {selectedMember.last_name}
                        </span>
                    </div>
                ) : (
                    <span className="text-slate-500">{placeholder}</span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {isAdding ? (
                        // INLINE ADD FORM
                        <div className="p-4 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                                    <Plus className="w-4 h-4 text-blue-600" />
                                    New Team Member
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleAddSubmit} className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs">First Name</Label>
                                        <Input
                                            value={newFirstName}
                                            onChange={e => setNewFirstName(e.target.value)}
                                            className="h-8 text-sm"
                                            placeholder="Jane"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Last Name</Label>
                                        <Input
                                            value={newLastName}
                                            onChange={e => setNewLastName(e.target.value)}
                                            className="h-8 text-sm"
                                            placeholder="Smith"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Position <span className="text-slate-400 font-normal">(Opt)</span></Label>
                                    <Input
                                        value={newPosition}
                                        onChange={e => setNewPosition(e.target.value)}
                                        className="h-8 text-sm"
                                        placeholder="Role"
                                    />
                                </div>
                                <div className="pt-2">
                                    <Button type="submit" className="w-full text-xs h-8 bg-slate-900 text-white hover:bg-slate-800">
                                        Save & Select
                                    </Button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        // SELECTION LIST
                        <div className="flex flex-col max-h-[300px]">
                            {/* Search */}
                            <div className="p-2 border-b border-slate-100 shrink-0 sticky top-0 bg-white">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-8 pr-3 py-1.5 text-sm border-none bg-slate-100 rounded-md focus:ring-1 focus:ring-slate-300 focus:bg-white transition-colors placeholder-slate-400"
                                        placeholder="Search members..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
                                {filteredMembers.length > 0 ? (
                                    filteredMembers.map(member => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => handleSelect(member.id)}
                                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                                                    {member.first_name[0]}{member.last_name[0]}
                                                </div>
                                                <div className="flex flex-col items-start truncate">
                                                    <span className={`text-sm font-medium ${value === member.id ? 'text-blue-700' : 'text-slate-700'} group-hover:text-slate-900 truncate`}>
                                                        {member.first_name} {member.last_name}
                                                    </span>
                                                    {member.position && (
                                                        <span className="text-[10px] text-slate-400 truncate mt-0.5">
                                                            {member.position}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {value === member.id && (
                                                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-4 text-center text-sm text-slate-500">
                                        No team members found.
                                    </div>
                                )}
                            </div>

                            {/* Sticky Add Button */}
                            <div className="p-2 border-t border-slate-100 bg-slate-50 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(true)}
                                    className="w-full flex items-center justify-center gap-2 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add New Member
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
