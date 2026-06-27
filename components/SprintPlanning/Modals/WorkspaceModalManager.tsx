import React, { useState, useEffect } from 'react';
import { CapabilityWorkspacePanel } from './CapabilityWorkspacePanel';
import { InitiativeDetailModal } from './InitiativeDetailModal';
import { MilestoneDetailModal } from './MilestoneDetailModal';
import { BreadcrumbNav } from './BreadcrumbNav';
import { InitiativeEntryForm } from './InitiativeEntryForm';
import { MilestoneEntryForm } from './MilestoneEntryForm';

export interface WorkspaceModalManagerProps {
    isOpen: boolean;
    onClose: () => void;

    // Entry points
    initialCapabilityId?: string;
    initialInitiativeId?: string;

    // Data required for the panels
    capabilities: any[];
    initiatives: any[];
    onCreateInitiative?: (data: any) => void;
}

export const WorkspaceModalManager: React.FC<WorkspaceModalManagerProps> = ({
    isOpen,
    onClose,
    initialCapabilityId,
    initialInitiativeId,
    capabilities,
    initiatives,
    onCreateInitiative
}) => {
    const [capId, setCapId] = useState<string | undefined>(undefined);
    const [initId, setInitId] = useState<string | undefined>(undefined);
    const [msId, setMsId] = useState<string | undefined>(undefined);

    // State for Entry Forms
    const [isInitiativeFormOpen, setIsInitiativeFormOpen] = useState(false);
    const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);
    const [quickAddName, setQuickAddName] = useState<string>('');

    // Sync initial state when opened
    useEffect(() => {
        if (isOpen) {
            setCapId(initialCapabilityId);
            setInitId(initialInitiativeId);
            setMsId(undefined);
        } else {
            setCapId(undefined);
            setInitId(undefined);
            setMsId(undefined);
        }
    }, [isOpen, initialCapabilityId, initialInitiativeId]);

    if (!isOpen) return null;

    // Build data context for breadcrumbs & modals
    const activeCap = capId ? (capabilities.find(c => c.id === capId) || { id: capId, name: 'Unknown Capability' }) : null;
    const activeInit = initId ? (initiatives.find(i => i.id === initId) || { id: initId, name: 'Unknown Initiative' }) : null;
    // Mocking finding a milestone since they are hardcoded inside InitiativeDetailModal for now
    const activeMs = msId ? { id: msId, name: 'Design dashboard structure' } : null;

    // Reconstruct tier for active capability (since our mock data in SprintBoard lacks it on the base object)
    let activeCapWithTier = null;
    if (activeCap) {
        // We'll pass a default tier if not found, since the component requires it
        activeCapWithTier = { ...activeCap, tier: activeCap.tier || 'prioritize' };
    }

    const activeCapabilityInitiatives = activeCap
        ? initiatives.filter(initiative => initiative.capabilityId === activeCap.id)
        : [];

    // Determine current level for rendering
    let currentLevel: 'capability' | 'initiative' | 'milestone' = 'capability';
    if (msId) currentLevel = 'milestone';
    else if (initId) currentLevel = 'initiative';
    else if (capId) currentLevel = 'capability';

    // Build Breadcrumb Nodes
    const breadcrumbNodes = [];
    if (activeCap) {
        breadcrumbNodes.push({ id: 'tier', label: activeCapWithTier?.tier || 'Prioritize', level: 'tier' });
        breadcrumbNodes.push({ id: activeCap.id, label: activeCap.name, level: 'capability' });
    }
    if (activeInit) {
        breadcrumbNodes.push({ id: activeInit.id, label: activeInit.name, level: 'initiative' });
    }
    if (activeMs) {
        let shortName = activeMs.name;
        if (shortName.length > 20) shortName = shortName.substring(0, 20) + '...';
        breadcrumbNodes.push({ id: activeMs.id, label: shortName, level: 'milestone' });
    }

    const handleBackClick = () => {
        if (currentLevel === 'milestone') {
            setMsId(undefined);
        } else if (currentLevel === 'initiative') {
            if (initialInitiativeId && !initialCapabilityId) {
                // If we opened directly into an initiative, "back" might just close the modal
                onClose();
            } else {
                setInitId(undefined);
            }
        } else {
            onClose();
        }
    };

    const handleNodeClick = (node: any) => {
        if (node.level === 'tier') {
            // Can't really jump back to tier right now, maybe just close?
            onClose();
        } else if (node.level === 'capability') {
            setInitId(undefined);
            setMsId(undefined);
        } else if (node.level === 'initiative') {
            setMsId(undefined);
        }
    };

    const breadcrumbContent = (
        <BreadcrumbNav
            nodes={breadcrumbNodes}
            onBackClick={handleBackClick}
            onNodeClick={handleNodeClick}
        />
    );

    return (
        <>
            {/* Render Capability Panel */}
            {currentLevel === 'capability' && (
                <CapabilityWorkspacePanel
                    isOpen={true}
                    onClose={onClose}
                    capability={activeCapWithTier}
                    initiatives={activeCapabilityInitiatives}
                    onAddInitiative={(capId, tier, name) => {
                        console.log('Add initiative requested for ', capId, ' with name: ', name);
                        setQuickAddName(name || '');
                        setIsInitiativeFormOpen(true);
                    }}
                    onInitiativeClick={(initiativeId) => {
                        setInitId(initiativeId);
                    }}
                    breadcrumbOverride={breadcrumbContent} // New prop needed
                    advisorContext={{ level: 'capability', name: activeCapWithTier?.name }}
                />
            )}

            {/* Render Initiative Panel */}
            {currentLevel === 'initiative' && (
                <InitiativeDetailModal
                    isOpen={true}
                    onClose={onClose}
                    initiativeId={initId!}
                    initialFocus={undefined}
                    onMilestoneClick={(milestoneId) => {
                        setMsId(milestoneId);
                    }}
                    onAddMilestone={(name) => {
                        console.log('Add milestone requested for ', initId, ' with name: ', name);
                        setQuickAddName(name || '');
                        setIsMilestoneFormOpen(true);
                    }}
                    breadcrumbOverride={breadcrumbContent} // New prop needed
                    advisorContext={{ level: 'initiative', name: activeInit?.name }}
                />
            )}

            {/* Render Milestone Panel */}
            {currentLevel === 'milestone' && (
                <MilestoneDetailModal
                    isOpen={true}
                    onClose={onClose}
                    milestoneId={msId!}
                    breadcrumbOverride={breadcrumbContent} // New prop needed
                    advisorContext={{ level: 'milestone', name: activeMs?.name }}
                />
            )}

            {/* Render Entry Form Overlays */}
            {isInitiativeFormOpen && activeCapWithTier && (
                <InitiativeEntryForm
                    isOpen={isInitiativeFormOpen}
                    onClose={() => {
                        setIsInitiativeFormOpen(false);
                        setQuickAddName(''); // clear on close
                    }}
                    tier={activeCapWithTier.tier}
                    capabilityName={activeCapWithTier.name}
                    sprintGoal="Finalize ICP v2 messaging and validate with 5 friendlies to ensure we are attracting the right fit." // Mock
                    initialName={quickAddName}
                    onSave={(data) => {
                        console.log('Saved Initiative Data:', data);
                        onCreateInitiative?.({
                            ...data,
                            capabilityId: activeCapWithTier.id,
                        });
                        setIsInitiativeFormOpen(false);
                        setQuickAddName(''); // clear on save
                    }}
                />
            )}

            {isMilestoneFormOpen && activeInit && (
                <MilestoneEntryForm
                    isOpen={isMilestoneFormOpen}
                    onClose={() => {
                        setIsMilestoneFormOpen(false);
                        setQuickAddName(''); // clear on close
                    }}
                    tier={activeCapWithTier?.tier || 'prioritize'}
                    capabilityName={activeCapWithTier?.name || 'Unassigned'}
                    initiativeName={activeInit.name}
                    existingMilestonesCount={2} // MOCKED
                    initialName={quickAddName}
                    onSave={(data) => {
                        console.log('Saved Milestone Data:', data);
                        setIsMilestoneFormOpen(false);
                        setQuickAddName(''); // clear on save
                        // Future: actually save to state/backend
                    }}
                />
            )}
        </>
    );
};
