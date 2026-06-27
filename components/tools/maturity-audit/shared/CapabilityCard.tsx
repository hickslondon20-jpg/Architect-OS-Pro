import React from 'react';
import { Card, Button } from '../../../ui';
import { GMCapabilityScreen } from '../../../../lib/gm-audit';
import { ArrowLeft } from 'lucide-react';

interface CapabilityCardProps {
    data: GMCapabilityScreen;
    responses: Record<string, string>;
    onResponseChange: (checkpointId: string, value: string) => void;
    onNext: () => void;
    onBack: () => void;
    onSave: () => void;
    isFirstScreen: boolean;
    isLastScreen: boolean;
    isEndOfDimension: boolean;
    isSaving?: boolean;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
    data,
    responses,
    onResponseChange,
    onNext,
    onBack,
    onSave,
    isFirstScreen,
    isLastScreen,
    isEndOfDimension,
    isSaving = false,
}) => {
    // Validation: Removed strict blocking per user request. 
    // "Next" allows partial save. Status is tracked in sidebar.

    // Determine button text
    let nextLabel = 'Next';
    if (isLastScreen) nextLabel = 'Submit Assessment';
    else if (isEndOfDimension) nextLabel = 'Save Dimension';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between text-sm uppercase tracking-wide text-[var(--fg-3)] font-semibold mb-2">
                    <span>{data.dimensionName}</span>
                    <span>Dimension {data.dimensionOrder}</span>
                </div>
                <div className="h-px w-full bg-[var(--aos-mist)] mb-6" />

                <h2 className="text-2xl font-bold text-[var(--fg-1)] mb-3">
                    CAPABILITY {data.capabilityCode}: {data.capabilityName}
                </h2>
                <p className="text-[var(--fg-2)] text-lg leading-relaxed max-w-3xl">
                    {data.capabilityDescription}
                </p>
            </div>

            {/* Checkpoints Table Header */}
            <div className="flex justify-end pr-6 mb-2">
                <div className="flex gap-8 text-sm font-semibold text-[var(--fg-3)] w-[160px] justify-between px-2">
                    <span>Y</span>
                    <span>S</span>
                    <span>N</span>
                </div>
            </div>

            {/* Checkpoints List */}
            <div className="space-y-4">
                {data.checkpoints.map((cp) => (
                    <Card key={cp.id} className="p-5 border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] hover:border-[var(--aos-steel-blue)] transition-colors">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-[var(--fg-1)]">
                                        {cp.displayId && cp.displayTitle
                                            ? `${cp.displayId}: ${cp.displayTitle}`
                                            : cp.checkpointId}
                                    </h3>
                                    {cp.helpText && (
                                        <div className="relative group/tooltip shrink-0">
                                            <span className="text-[var(--fg-4)] hover:text-[var(--fg-2)] cursor-help text-sm leading-none">
                                                ⓘ
                                            </span>
                                            <div className="
                                                absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20
                                                w-72 bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs rounded-lg px-3 py-2 shadow-xl
                                                leading-relaxed pointer-events-none
                                                opacity-0 group-hover/tooltip:opacity-100
                                                transition-opacity duration-150
                                            ">
                                                {cp.helpText}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--bg-inverse)]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                                    {cp.statement}
                                </p>
                            </div>

                            {/* Radio Inputs */}
                            <div className="flex gap-8 w-[160px] justify-between shrink-0 pt-1 px-2">
                                {['Y', 'S', 'N'].map((option) => (
                                    <label key={option} className="cursor-pointer group">
                                        <input
                                            type="radio"
                                            name={cp.id}
                                            value={option}
                                            checked={responses[cp.id] === option}
                                            onChange={() => onResponseChange(cp.id, option)}
                                            className="sr-only"
                                        />
                                        <div className={`
                                            w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center
                                            ${responses[cp.id] === option
                                                ? 'border-[var(--aos-brass)] bg-[var(--aos-brass)]'
                                                : 'border-[var(--aos-mist)] group-hover:border-[var(--aos-steel-blue)] bg-[var(--bg-surface)]'}`}>
                                            {responses[cp.id] === option && (
                                                <div className="w-2.5 h-2.5 bg-white rounded-full" />
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-8 border-t border-[var(--aos-mist)] mt-8">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    disabled={isFirstScreen}
                    className={isFirstScreen ? 'opacity-0 pointer-events-none' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>

                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={onSave} disabled={isSaving} className="border-[var(--aos-mist)]">
                        {isSaving ? 'Saving…' : 'Save Progress'}
                    </Button>
                    <Button
                        onClick={onNext}
                        disabled={isSaving}
                        className="bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] min-w-[140px] disabled:opacity-60">
                        {nextLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};
