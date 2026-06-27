import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, User } from 'lucide-react';
import { Button, Input, Label } from '../../ui';

// MOCK DATA structure - simulating our new team_members table
export interface MOCK_TeamMember {
    id: string;
    first_name: string;
    last_name: string;
    position?: string;
    deleted_at: string | null;
}

// Global mock state for now to share across components until Supabase wiring
export const MOCK_TEAM_MEMBERS: MOCK_TeamMember[] = [
    { id: 'tm_1', first_name: 'Sarah', last_name: 'Connor', position: 'VP Operations', deleted_at: null },
    { id: 'tm_2', first_name: 'Tom', last_name: 'Hanks', position: 'Lead Engineer', deleted_at: null },
    { id: 'tm_3', first_name: 'Founder', last_name: 'Person', position: 'CEO', deleted_at: null },
];

export interface TeamMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({ isOpen, onClose }) => {
    const [members, setMembers] = useState<MOCK_TeamMember[]>(MOCK_TEAM_MEMBERS);
    const [isAdding, setIsAdding] = useState(false);

    // Add form state
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPosition, setNewPosition] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editPosition, setEditPosition] = useState('');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Sync with global mock array just in case it mutated
            setMembers([...MOCK_TEAM_MEMBERS]);
        } else {
            document.body.style.overflow = 'unset';
            setIsAdding(false);
            setEditingId(null);
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const activeMembers = members.filter(m => m.deleted_at === null);

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFirstName.trim() || !newLastName.trim()) return;

        const newMember: MOCK_TeamMember = {
            id: `tm_${Date.now()}`, // fake UUID
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            position: newPosition.trim() || undefined,
            deleted_at: null
        };

        const updated = [...members, newMember];
        setMembers(updated);
        // Mutate global for now so other comps see it
        MOCK_TEAM_MEMBERS.push(newMember);

        setNewFirstName('');
        setNewLastName('');
        setNewPosition('');
        setIsAdding(false);
    };

    const handleSoftDelete = (id: string) => {
        if (!window.confirm("Are you sure you want to remove this team member? Past assignments will remain.")) return;

        const updated = members.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m);
        setMembers(updated);

        // Mutate global
        const globalRef = MOCK_TEAM_MEMBERS.find(m => m.id === id);
        if (globalRef) {
            globalRef.deleted_at = new Date().toISOString();
        }
    };

    const startEditing = (member: MOCK_TeamMember) => {
        setEditingId(member.id);
        setEditFirstName(member.first_name);
        setEditLastName(member.last_name);
        setEditPosition(member.position || '');
        setIsAdding(false);
    };

    const handleEditSave = (id: string) => {
        if (!editFirstName.trim() || !editLastName.trim()) return;

        const updated = members.map(m => {
            if (m.id === id) {
                return {
                    ...m,
                    first_name: editFirstName.trim(),
                    last_name: editLastName.trim(),
                    position: editPosition.trim() || undefined
                };
            }
            return m;
        });

        setMembers(updated);

        // Mutate global
        const globalRef = MOCK_TEAM_MEMBERS.find(m => m.id === id);
        if (globalRef) {
            globalRef.first_name = editFirstName.trim();
            globalRef.last_name = editLastName.trim();
            globalRef.position = editPosition.trim() || undefined;
        }

        setEditingId(null);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:px-4 mb-4">
            <div className="fixed inset-0 bg-[rgba(25,48,82,0.48)] backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div
                className="relative mx-4 flex max-h-[85vh] w-full flex-col rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200 sm:mx-0 sm:w-[600px]"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between rounded-t-[var(--radius-xs)] border-b border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] p-2 text-[var(--aos-brass)]">
                            <User className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold leading-tight text-[var(--fg-1)]">Team Members</h2>
                            <p className="text-xs font-medium text-[var(--fg-3)]">Manage options for owner assignments</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="-mr-2 rounded-full p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-[var(--bg-surface)] p-6 custom-scrollbar">
                    {/* Add Form / Button Toggle */}
                    {isAdding ? (
                        <div className="mb-8 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-5 shadow-[var(--shadow-soft-1)]">
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--fg-1)]">
                                <Plus className="h-4 w-4 text-[var(--aos-brass)]" />
                                Add New Team Member
                            </h3>
                            <form onSubmit={handleAddSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-[var(--fg-2)]">First Name <span className="text-[var(--aos-risk)]">*</span></Label>
                                        <Input
                                            value={newFirstName}
                                            onChange={e => setNewFirstName(e.target.value)}
                                            placeholder="Jane"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-[var(--fg-2)]">Last Name <span className="text-[var(--aos-risk)]">*</span></Label>
                                        <Input
                                            value={newLastName}
                                            onChange={e => setNewLastName(e.target.value)}
                                            placeholder="Smith"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-[var(--fg-2)]">Role / Position <span className="font-normal text-[var(--fg-3)]">(Optional)</span></Label>
                                    <Input
                                        value={newPosition}
                                        onChange={e => setNewPosition(e.target.value)}
                                        placeholder="e.g. Marketing Director"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-4">
                                    <Button type="button" variant="ghost" className="text-xs h-8 px-4" onClick={() => setIsAdding(false)}>Cancel</Button>
                                    <Button type="submit" variant="primary" className="h-8 px-5 text-xs shadow-sm">Add Member</Button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="mb-6 flex justify-end">
                            <Button
                                onClick={() => setIsAdding(true)}
                                variant="outline"
                                className="h-9 border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--aos-brass)] shadow-[var(--shadow-soft-1)] transition-all hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Team Member
                            </Button>
                        </div>
                    )}

                    {/* Team List */}
                    <div className="space-y-3">
                        {activeMembers.length === 0 ? (
                            <div className="my-4 rounded-[var(--radius-xs)] border-2 border-dashed border-[var(--aos-mist)] bg-[var(--bg-sunken)] py-12 text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-canvas)]">
                                    <User className="h-6 w-6 text-[var(--fg-3)]" />
                                </div>
                                <p className="text-sm font-medium text-[var(--fg-2)]">No team members yet.</p>
                                <p className="mx-auto mt-1 max-w-[200px] text-xs text-[var(--fg-3)]">Add people to assign them to initiatives and milestones.</p>
                            </div>
                        ) : (
                            activeMembers.map(member => (
                                <div key={member.id} className="group flex flex-col justify-between rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] transition-all duration-200 hover:border-[var(--aos-brass)] hover:bg-[var(--bg-canvas)] hover:shadow-md sm:flex-row sm:items-center">

                                    {editingId === member.id ? (
                                        // Edit Mode
                                        <div className="flex-1 w-full space-y-3 sm:space-y-0 sm:flex sm:gap-3 sm:items-center">
                                            <div className="grid grid-cols-2 gap-3 sm:w-[240px] shrink-0">
                                                <Input
                                                    value={editFirstName}
                                                    onChange={e => setEditFirstName(e.target.value)}
                                                    placeholder="First Name"
                                                    className="h-9 text-sm focus:ring-[var(--aos-brass)]"
                                                    autoFocus
                                                />
                                                <Input
                                                    value={editLastName}
                                                    onChange={e => setEditLastName(e.target.value)}
                                                    placeholder="Last Name"
                                                    className="h-9 text-sm focus:ring-[var(--aos-brass)]"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[140px]">
                                                <Input
                                                    value={editPosition}
                                                    onChange={e => setEditPosition(e.target.value)}
                                                    placeholder="Position (Opt)"
                                                    className="h-9 text-sm focus:ring-[var(--aos-brass)]"
                                                />
                                            </div>
                                            <div className="flex items-center justify-end gap-1.5 shrink-0 mt-3 sm:mt-0">
                                                <button
                                                    onClick={() => handleEditSave(member.id)}
                                                    className="rounded-[var(--radius-xs)] bg-[var(--aos-success)] p-1.5 text-[var(--fg-on-dark)] shadow-sm transition-colors hover:opacity-90"
                                                    title="Save"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-1.5 text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-sunken)]"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Read Mode
                                        <>
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                {/* Avatar */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-sm font-bold text-[var(--aos-brass)] shadow-sm">
                                                    {member.first_name[0]}{member.last_name[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="truncate font-semibold text-[var(--fg-1)]">
                                                        {member.first_name} {member.last_name}
                                                    </div>
                                                    {member.position && (
                                                        <div className="mt-0.5 truncate text-xs font-medium text-[var(--fg-3)]">{member.position}</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 flex w-full items-center justify-end gap-1.5 border-t border-[var(--aos-mist)] pt-3 transition-opacity group-hover:opacity-100 sm:mt-0 sm:w-auto sm:border-0 sm:pt-0 sm:opacity-0">
                                                <button
                                                    onClick={() => startEditing(member)}
                                                    className="rounded-[var(--radius-xs)] p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleSoftDelete(member.id)}
                                                    className="rounded-[var(--radius-xs)] p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between rounded-b-[var(--radius-xs)] border-t border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-6 py-4">
                    <p className="flex items-center gap-1.5 rounded-full border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--fg-3)]">
                        <User className="h-3.5 w-3.5 text-[var(--fg-3)]" />
                        {activeMembers.length} Active Member{activeMembers.length !== 1 ? 's' : ''}
                    </p>
                    <Button onClick={onClose} variant="primary" className="text-sm border shadow-sm px-6">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};
