import React, { useState } from 'react';
import { EntryFormOverlay } from './EntryFormOverlay';
import { InheritedContextTags, TierType } from './InheritedContextTags';
import { Label, Input, Select } from '../../ui';
import { TeamMemberDropdown } from './TeamMemberDropdown';

export interface MilestoneEntryFormProps {
    isOpen: boolean;
    onClose: () => void;
    tier: TierType;
    capabilityName: string;
    initiativeName: string;
    existingMilestonesCount: number; // To determine if Dependencies field should show
    initialName?: string; // Passed from Quick Add
    onSave?: (data: any) => void;
}

export const MilestoneEntryForm: React.FC<MilestoneEntryFormProps> = ({
    isOpen,
    onClose,
    tier,
    capabilityName,
    initiativeName,
    existingMilestonesCount,
    initialName,
    onSave
}) => {
    const [name, setName] = useState(initialName || '');
    const [outcome, setOutcome] = useState('');
    const [measure, setMeasure] = useState('');
    const [owner, setOwner] = useState('');
    const [timeline, setTimeline] = useState('');
    const [dependencies, setDependencies] = useState<string[]>([]);

    const handleSave = () => {
        if (!name.trim()) {
            alert("Please add a name before saving.");
            return;
        }

        const data = {
            name,
            outcome,
            measure,
            owner,
            timeline,
            dependencies,
            tier,
            capabilityName,
            initiativeName
        };

        if (onSave) {
            onSave(data);
        } else {
            console.log('Saved Milestone Data:', data);
            onClose();
        }

        // Reset form
        setName('');
        setOutcome('');
        setMeasure('');
        setOwner('');
        setTimeline('');
        setDependencies([]);
    };

    const handleCancel = () => {
        const hasContent = name || outcome || measure || owner || timeline || dependencies.length > 0;
        if (hasContent) {
            const confirm = window.confirm("Discard this milestone?");
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
            saveLabel="Save Milestone"
            title="New Milestone"
        >
            <div className="space-y-6">

                {/* Auto-Inherited Context */}
                <InheritedContextTags
                    type="milestone"
                    tier={tier}
                    capabilityName={capabilityName}
                    initiativeName={initiativeName}
                // No onRemoveCapability passed because milestone context is locked
                />

                {/* Field 1: Name */}
                <div>
                    <Label htmlFor="milestone-name">Milestone Name</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">Name this as a progress marker - something that will be visibly true when complete</p>
                    <Input
                        id="milestone-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='e.g. "Audit current data sources" or "Design dashboard structure"'
                        autoFocus
                    />
                </div>

                {/* Field 2: Outcome */}
                <div>
                    <Label htmlFor="milestone-outcome">Outcome</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">What is the end state when this milestone is complete?</p>
                    <textarea
                        id="milestone-outcome"
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value)}
                        placeholder="Describe what will exist or be true - not what we'll do, but what we'll have."
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={3}
                    />
                </div>

                {/* Field 3: Measure */}
                <div>
                    <Label htmlFor="milestone-measure">Measure</Label>
                    <p className="mb-1.5 text-xs text-[var(--fg-3)]">How will we know this is genuinely done?</p>
                    <textarea
                        id="milestone-measure"
                        value={measure}
                        onChange={(e) => setMeasure(e.target.value)}
                        placeholder="What is the proof? What can someone point to and confirm this is complete?"
                        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] px-3 py-2 text-[var(--fg-1)] shadow-sm placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:ring-[var(--aos-brass)] sm:text-sm"
                        rows={2}
                    />
                    <p className="mt-2 inline-block rounded bg-[var(--aos-warning-tint)] px-2 py-1 text-[11px] text-[var(--aos-warning)]">
                        If you can't describe how to verify it, the milestone may not be specific enough yet.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Field 4: Owner */}
                    <div>
                        <Label htmlFor="milestone-owner">Owner</Label>
                        <p className="mb-1.5 text-xs text-[var(--fg-3)]">Who is accountable for this milestone?</p>
                        <TeamMemberDropdown
                            value={owner}
                            onChange={(id) => setOwner(id)}
                            placeholder="Select or type a name or role"
                        />
                    </div>

                    {/* Field 5: Timeline */}
                    <div>
                        <Label htmlFor="milestone-timeline" className="flex items-baseline gap-2">
                            <span>Timeline</span>
                            <span className="text-xs font-normal italic text-[var(--fg-3)]">Optional</span>
                        </Label>
                        <p className="mb-1.5 hidden text-xs text-[var(--fg-3)] opacity-0 sm:block">Spacer</p> {/* Alignment hack for grid */}
                        <Select
                            id="milestone-timeline"
                            value={timeline}
                            onChange={(e) => setTimeline(e.target.value)}
                        >
                            <option value="">Select target month</option>
                            <option value="month1">Month 1</option>
                            <option value="month2">Month 2</option>
                            <option value="month3">Month 3</option>
                        </Select>
                    </div>
                </div>

                {/* Field 6: Dependencies (Conditional) */}
                {existingMilestonesCount > 0 && (
                    <div className="border-t border-[var(--aos-mist)] pt-2">
                        <Label htmlFor="milestone-dependencies" className="flex items-baseline gap-2">
                            <span>Dependencies</span>
                            <span className="text-xs font-normal italic text-[var(--fg-3)]">Optional</span>
                        </Label>
                        <p className="mb-1.5 text-xs text-[var(--fg-3)]">What must be complete before this can begin?</p>
                        <Select
                            id="milestone-dependencies"
                            value={dependencies.length > 0 ? dependencies[0] : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                    setDependencies([val]); // Mock single select for now, real app might use multi-select
                                } else {
                                    setDependencies([]);
                                }
                            }}
                        >
                            <option value="">Select milestones that must be complete first</option>
                            <option value="m1">Audit current data sources</option>
                            <option value="m2">Draft initial dashboard wireframe</option>
                        </Select>
                    </div>
                )}

            </div>
        </EntryFormOverlay>
    );
};
