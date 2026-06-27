import React, { useState, useEffect } from 'react';
import { Card } from '../../ui';
import { Check, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { GMCapabilityScreen } from '../../../lib/gm-audit';

interface AuditNavigationProps {
    currentScreen: number;
    totalScreens: number;
    currentDimension: number;        // 1–5
    completedDimensions: number[];
    responses: Record<string, string>; // { [questionId]: 'Y'|'S'|'N' }
    capabilityScreens: GMCapabilityScreen[];
    onJumpToStep: (step: number) => void;
}

export const AuditNavigation: React.FC<AuditNavigationProps> = ({
    currentScreen,
    totalScreens,
    currentDimension,
    completedDimensions,
    responses,
    capabilityScreens,
    onJumpToStep
}) => {
    const progressPercentage = Math.round((currentScreen / totalScreens) * 100);

    const [expandedDimensions, setExpandedDimensions] = useState<number[]>([currentDimension]);

    // When the active dimension advances, collapse old ones and open only the new current.
    // Users can still manually expand a completed dimension to navigate back into it.
    useEffect(() => {
        setExpandedDimensions([currentDimension]);
    }, [currentDimension]);

    const toggleDimension = (dimOrder: number) => {
        setExpandedDimensions(prev =>
            prev.includes(dimOrder)
                ? prev.filter(id => id !== dimOrder)
                : [...prev, dimOrder]
        );
    };

    // Build unique dimensions from live capability screens
    interface DimEntry { order: number; name: string; }
    const dimEntries: DimEntry[] = capabilityScreens.map(s => ({ order: s.dimensionOrder, name: s.dimensionName }));
    const dimMap = new Map<number, DimEntry>();
    dimEntries.forEach(d => { if (!dimMap.has(d.order)) dimMap.set(d.order, d); });
    const dimensions: DimEntry[] = Array.from(dimMap.values()).sort((a, b) => a.order - b.order);

    const getCapabilityStatus = (screen: GMCapabilityScreen) => {
        const answered = screen.checkpoints.filter(cp => responses[cp.id]).length;
        if (answered === screen.checkpoints.length) return 'complete';
        if (answered > 0) return 'in-progress';
        return 'empty';
    };

    // Convert a capability screen index (0-24) to absolute wizard step
    // D1: steps 1-5, step 6 = transition, D2: steps 7-11, step 12 = transition, etc.
    const capIndexToStep = (capIndex: number) => {
        const transitionsBefore = Math.floor(capIndex / 5);
        return capIndex + transitionsBefore + 1;
    };

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            <div className="flex items-center justify-between text-sm text-[var(--fg-2)] mb-2">
                <span className="font-medium">Progress: {currentScreen}/{totalScreens}</span>
                <span className="font-bold text-[var(--aos-brass)]">{progressPercentage}%</span>
            </div>
            <div className="h-3 w-full bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                <div
                    className="h-full bg-[var(--aos-brass)] transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>

            {/* Accordion Sidebar */}
            <Card className="hidden lg:block bg-[var(--bg-surface)] border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] overflow-hidden">
                <div className="divide-y divide-[var(--aos-mist)]">
                    {dimensions.map((dim) => {
                        const isExpanded = expandedDimensions.includes(dim.order);
                        const isComplete = completedDimensions.includes(dim.order);
                        const isLocked = !isComplete && dim.order > currentDimension && dim.order !== 1;

                        // Get capabilities for this dimension from live data
                        const dimCaps = capabilityScreens
                            .filter(s => s.dimensionOrder === dim.order)
                            .sort((a, b) => a.screen - b.screen);

                        return (
                            <div key={dim.order} className="bg-[var(--bg-surface)]">
                                {/* Dimension Header */}
                                <div
                                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors
                                        ${dim.order === currentDimension ? 'bg-[var(--bg-sunken)]' : ''}`}
                                    onClick={() => !isLocked && toggleDimension(dim.order)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isLocked ? (
                                            <Lock className="h-4 w-4 text-[var(--fg-4)]" />
                                        ) : isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-[var(--fg-3)]" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-[var(--fg-3)]" />
                                        )}
                                        <span className={`font-semibold text-sm
                                            ${dim.order === currentDimension ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}
                                            ${isLocked ? 'text-[var(--fg-4)]' : ''}`}>
                                            D{dim.order}: {dim.name}
                                        </span>
                                    </div>
                                    {isComplete && <Check className="h-4 w-4 text-[var(--aos-success)]" />}
                                </div>

                                {/* Capability List */}
                                {isExpanded && !isLocked && (
                                    <div className="bg-[var(--bg-sunken)] pb-2">
                                        {dimCaps.map((cap) => {
                                            const status = getCapabilityStatus(cap);
                                            const absoluteStep = capIndexToStep(cap.screen - 1);
                                            const isActive = currentScreen === absoluteStep;

                                            return (
                                                <div
                                                    key={cap.capabilityId}
                                                    onClick={() => onJumpToStep(absoluteStep)}
                                                    className={`pl-11 pr-4 py-2 text-sm flex items-center justify-between cursor-pointer border-l-2
                                                        ${isActive
                                                            ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] font-medium'
                                                            : 'border-transparent text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-canvas)]'}`}
                                                >
                                                    <span className="truncate pr-2">{cap.capabilityCode} {cap.capabilityName}</span>

                                                    {status === 'complete' && <Check className="h-3.5 w-3.5 text-[var(--aos-success)] shrink-0" />}
                                                    {status === 'in-progress' && <div className="h-3 w-3 rounded-full bg-[var(--aos-warning)] shrink-0" />}
                                                    {status === 'empty' && <div className="h-3 w-3 rounded-full border border-[var(--fg-4)] shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
