import React, { useState } from 'react';
import { User, UserPlus, Check } from 'lucide-react';

interface TeamMember {
    id: string;
    first_name: string;
    last_name: string;
    position?: string;
}

interface Props {
    selectedId?: string;
    onSelect: (id: string) => void;
}

// MOCK DATA
const MOCK_TEAM: TeamMember[] = [
    { id: '1', first_name: 'Sarah', last_name: 'Jenkins', position: 'COO' },
    { id: '2', first_name: 'Tom', last_name: 'Baker', position: 'Head of Sales' },
];

export const TeamMemberDropdown: React.FC<Props> = ({ selectedId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [teamMembers, setTeamMembers] = useState(MOCK_TEAM);

    // New Member Form State
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPosition, setNewPosition] = useState('');

    const handleSaveNewMember = () => {
        if (!newFirstName.trim() || !newLastName.trim()) return;

        const newId = `new_${Date.now()}`;
        const newMember: TeamMember = {
            id: newId,
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            position: newPosition.trim() || undefined
        };

        // Update local list
        setTeamMembers([...teamMembers, newMember]);

        // Auto-select the new member
        onSelect(newId);

        // Reset and close
        setNewFirstName('');
        setNewLastName('');
        setNewPosition('');
        setIsAddingNew(false);
        setIsOpen(false);
    };

    // Derived state for display
    const selectedMember = teamMembers.find(m => m.id === selectedId);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className={selectedMember ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                        {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'Assign Owner...'}
                    </span>
                </div>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close dropdown */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => {
                            setIsOpen(false);
                            setIsAddingNew(false);
                        }}
                    />

                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {isAddingNew ? (
                            <div className="p-3 space-y-3 bg-slate-50">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">New Team Member</h4>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="First Name"
                                        value={newFirstName}
                                        onChange={e => setNewFirstName(e.target.value)}
                                        className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        placeholder="Last Name"
                                        value={newLastName}
                                        onChange={e => setNewLastName(e.target.value)}
                                        className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Position (Optional)"
                                        value={newPosition}
                                        onChange={e => setNewPosition(e.target.value)}
                                        className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingNew(false)}
                                        className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveNewMember}
                                        disabled={!newFirstName.trim() || !newLastName.trim()}
                                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Save & Assign
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="max-h-60 overflow-y-auto py-1">
                                    {teamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => {
                                                onSelect(member.id);
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {member.first_name} {member.last_name}
                                                </div>
                                                {member.position && (
                                                    <div className="text-slate-500 text-xs">{member.position}</div>
                                                )}
                                            </div>
                                            {selectedId === member.id && (
                                                <Check className="w-4 h-4 text-blue-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="border-t border-slate-100 bg-slate-50 p-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingNew(true)}
                                        className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Add New Team Member
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
