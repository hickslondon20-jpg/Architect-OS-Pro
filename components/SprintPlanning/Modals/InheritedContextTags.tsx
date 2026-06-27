import React from 'react';
import { X } from 'lucide-react';

export type TierType = 'prioritize' | 'plant' | 'iterate';

export interface InheritedContextTagsProps {
    type: 'initiative' | 'milestone';
    tier: TierType;
    capabilityName: string;
    initiativeName?: string; // Only needed if type === 'milestone'
    onRemoveCapability?: () => void; // Provided if capability tag is removable
}

export const InheritedContextTags: React.FC<InheritedContextTagsProps> = ({
    type,
    tier,
    capabilityName,
    initiativeName,
    onRemoveCapability
}) => {
    // 3P Tag Helpers
    const getTierLabel = (t: TierType) => {
        switch (t) {
            case 'prioritize': return 'PRIORITIZE';
            case 'plant': return 'PLANT';
            case 'iterate': return 'PROGRESSIVELY ITERATE';
        }
    };

    const getTierColorClass = (t: TierType) => {
        switch (t) {
            case 'prioritize': return 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]';
            case 'plant': return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]';
            case 'iterate': return 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]';
        }
    };

    const tierLabel = getTierLabel(tier);
    const tierColorClass = getTierColorClass(tier);

    // Shared Tag Styles
    const baseTagClass = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-semibold border";
    const readOnlyTagClass = `${baseTagClass} bg-[var(--bg-canvas)] border-[var(--aos-mist)] text-[var(--fg-2)]`;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            {/* Context type: Initiative form shows 2 tags. Milestone form shows 3 tags. */}

            {/* 1. Milestone specific context (Initiative Name) */}
            {type === 'milestone' && initiativeName && (
                <div className={readOnlyTagClass}>
                    {initiativeName}
                </div>
            )}

            {/* 2. Capability Area context */}
            <div className={`${type === 'initiative' ? `${baseTagClass} bg-[var(--bg-canvas)] border-[var(--aos-mist)] text-[var(--fg-2)]` : readOnlyTagClass} ${onRemoveCapability ? 'pr-1.5' : ''}`}>
                {capabilityName}
                {type === 'initiative' && onRemoveCapability && (
                    <button
                        onClick={onRemoveCapability}
                        className="ml-1 rounded p-0.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
                        aria-label="Remove capability"
                        title="Change capability area [dropdown TBD]"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* 3. 3P Classification context */}
            <div className={`${baseTagClass} ${tierColorClass} tracking-wider uppercase`}>
                {tierLabel}
            </div>
        </div>
    );
};
