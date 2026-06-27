import React, { useState } from 'react';
import { EntryFormOverlay } from './EntryFormOverlay';
import { InheritedContextTags, TierType } from './InheritedContextTags';
import { Label, Input } from '../../ui';

export interface InitiativeEntryFormProps {
    isOpen: boolean;
    onClose: () => void;
    tier: TierType;
    capabilityName: string;
    sprintGoal: string;
    initialName?: string; // Passed from Quick Add
    onSave?: (data: any) => void;
    onRemoveCapability?: () => void;
}

export const InitiativeEntryForm: React.FC<InitiativeEntryFormProps> = ({
    isOpen,
    onClose,
    tier,
    capabilityName,
    sprintGoal,
    initialName,
    onSave,
    onRemoveCapability
}) => {
    const [name, setName] = useState(initialName || '');
    const [addressing, setAddressing] = useState('');
    const [successState, setSuccessState] = useState('');
    const [sprintConnection, setSprintConnection] = useState('');
    const [constraints, setConstraints] = useState('');

    // Dynamic placeholders based on tier
    const getAddressingPlaceholder = (t: TierType) => {
        switch (t) {
            case 'prioritize': return "What critical gap or capability failure is this initiative directly closing?";
            case 'plant': return "What foundation are we intentionally laying now for a future priority?";
            case 'iterate': return "What existing area needs ongoing refinement as the business evolves?";
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert("Please add a name before saving.");
            return;
        }

        const data = {
            name,
            addressing,
            successState,
            sprintConnection,
            constraints,
            tier,
            capabilityName
        };

        if (onSave) {
            onSave(data);
        } else {
            console.log('Saved Initiative Data:', data);
            onClose();
        }

        // Reset form (optional, depending on desired UX on re-open)
        setName('');
        setAddressing('');
        setSuccessState('');
        setSprintConnection('');
        setConstraints('');
    };

    const handleCancel = () => {
        const hasContent = name || addressing || successState || sprintConnection || constraints;
        if (hasContent) {
            const confirm = window.confirm("Discard this initiative?");
            if (confirm) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    return (
        <EntryFormOverlay
            isOpen={isOpen}
            onClose={handleCancel}
            onSave={handleSave}
            saveLabel="Save Initiative"
            title="New Initiative"
        >
            <div className="space-y-6">

                {/* Auto-Inherited Context */}
                <InheritedContextTags
                    type="initiative"
                    tier={tier}
                    capabilityName={capabilityName}
                    onRemoveCapability={onRemoveCapability}
                />

                {/* Field 1: Name */}
                <div>
                    <Label htmlFor="initiative-name">Initiative Name</Label>
                    <Input
                        id="initiative-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='e.g. "Build Financial Dashboard" or "Define ICP v2"'
                        autoFocus
                    />
                </div>

                {/* Field 2: What We Are Addressing */}
                <div>
                    <Label htmlFor="initiative-addressing">What We Are Addressing</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">The current gap or challenge this initiative responds to</p>
                    <textarea
                        id="initiative-addressing"
                        value={addressing}
                        onChange={(e) => setAddressing(e.target.value)}
                        placeholder={getAddressingPlaceholder(tier)}
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={3}
                    />
                </div>

                {/* Field 3: What Success Looks Like */}
                <div>
                    <Label htmlFor="initiative-success">What Success Looks Like</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">The definition of done at the initiative level - what will be true when this is complete?</p>
                    <textarea
                        id="initiative-success"
                        value={successState}
                        onChange={(e) => setSuccessState(e.target.value)}
                        placeholder="Describe the end state, not the activity. What will have changed in the business?"
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={3}
                    />
                </div>

                {/* Field 4: Sprint Goal Connection */}
                <div>
                    <Label htmlFor="initiative-sprint-connection">Sprint Goal Connection</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">How does this initiative advance your sprint goal?</p>

                    {/* Sprint Goal Reference Banner */}
                    <div className="mb-3 rounded-r-md border-l-2 border-[var(--aos-brass)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--fg-2)]">
                        <span className="font-semibold mr-1">Your Sprint Goal:</span>
                        "{sprintGoal}"
                    </div>

                    <textarea
                        id="initiative-sprint-connection"
                        value={sprintConnection}
                        onChange={(e) => setSprintConnection(e.target.value)}
                        placeholder="This enables our goal of [X] by [Y]."
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={2}
                    />
                </div>

                {/* Field 5: Known Constraints or Risks */}
                <div>
                    <Label htmlFor="initiative-constraints" className="flex items-baseline gap-2">
                        <span>Known Constraints or Risks</span>
                        <span className="text-xs font-normal italic text-[var(--fg-3)]">Optional</span>
                    </Label>
                    <textarea
                        id="initiative-constraints"
                        value={constraints}
                        onChange={(e) => setConstraints(e.target.value)}
                        placeholder="Anything that might slow this down, require outside resources, or create dependencies?"
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={2}
                    />
                </div>

            </div>
        </EntryFormOverlay>
    );
};
