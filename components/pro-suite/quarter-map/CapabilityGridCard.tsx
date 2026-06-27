import React from 'react';
import { Plus, Target, Sprout, RefreshCw, Archive } from 'lucide-react';
import { Capability, BucketType } from './types';

interface CapabilityGridCardProps {
    capability: Capability;
    onAdd: (capabilityId: string, bucket: BucketType) => void;
    onClick: (capabilityId: string) => void;
    isAdded?: boolean;
}

export const CapabilityGridCard: React.FC<CapabilityGridCardProps> = ({ capability, onAdd, onClick, isAdded }) => {

    const getStageClass = (stage: string) => {
        if (stage === 'Ahead of Stage') return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]';
        if (stage === 'At Stage') return 'bg-[var(--bg-sunken)] text-[var(--fg-2)]';
        return 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]';
    };

    const getCollapsedDimension = (dim: string) => {
        const mapping: Record<string, string> = {
            'Financial & Business Health': 'Financial',
            'Financial Health': 'Financial',
            'Client Base & Market Positioning': 'Positioning',
            'Client Portfolio': 'Positioning',
            'Operational Efficiency & Scalability': 'Ops',
            'Operations': 'Ops',
            'Team Structure & Leadership': 'Team',
            'Team Structure': 'Team',
            'Vision & Strategic Stewardship': 'Stewardship',
            'Strategic Stewardship': 'Stewardship',
        };
        return mapping[dim] || dim;
    };

    const getDimensionColor = (dim: string) => {
        const normalized = getCollapsedDimension(dim);
        const colors: Record<string, string> = {
            'Financial': 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] border-[var(--aos-insight)]',
            'Positioning': 'bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] border-[var(--aos-brass)]',
            'Ops': 'bg-[var(--bg-sunken)] text-[var(--fg-2)] border-[var(--aos-mist)]',
            'Team': 'bg-[var(--aos-sage-soft)] text-[var(--aos-deep-teal)] border-[var(--aos-sage)]',
            'Stewardship': 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]',
        };
        return colors[normalized] || 'bg-[var(--bg-sunken)] text-[var(--fg-2)] border-[var(--aos-mist)]';
    };

    if (isAdded) {
        return null;
    }

    return (
        <div
            className="p-3 rounded-lg transition-all group flex flex-col h-full cursor-pointer relative"
            style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}
            onClick={() => onClick(capability.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getDimensionColor(capability.dimension)}`}>
                            {getCollapsedDimension(capability.dimension)}
                        </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--fg-1)] leading-tight mt-1 pr-6 line-clamp-2" title={capability.name}>{capability.name}</span>
                </div>

                <div className="absolute right-2 top-2 group/add" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 rounded-md bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] hover:text-[var(--aos-cloud)] transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>

                    <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-surface)] rounded-lg border py-1 z-50 hidden group-hover/add:block animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: 'var(--aos-mist)', boxShadow: 'var(--shadow-elevated)' }}>
                        <div className="px-3 py-1.5 aos-eyebrow">Add to...</div>
                        <button onClick={() => onAdd(capability.id, 'PRIORITIZE')} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--aos-brass-tint)] text-[var(--fg-2)] flex items-center gap-2">
                            <Target className="w-4 h-4 text-[var(--aos-brass)]" /> Prioritize
                        </button>
                        <button onClick={() => onAdd(capability.id, 'PLANT')} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--aos-brass-tint)] text-[var(--fg-2)] flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-[var(--aos-brass)]" /> Plant
                        </button>
                        <button onClick={() => onAdd(capability.id, 'ITERATE')} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--aos-brass-tint)] text-[var(--fg-2)] flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-[var(--aos-brass)]" /> Iterate
                        </button>
                        <div className="h-px bg-[var(--aos-mist)] my-1 w-full"></div>
                        <button onClick={() => onAdd(capability.id, 'PARKING_LOT')} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-sunken)] text-[var(--fg-2)] flex items-center gap-2">
                            <Archive className="w-4 h-4 text-[var(--fg-3)]" /> Parking Lot
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-auto">
                <div className="flex items-center justify-between text-[10px] border-t border-[var(--aos-mist)] pt-2 pb-0.5">
                    <div className="flex items-center gap-1.5 w-1/2">
                        <span className="text-[var(--fg-3)] font-medium">Maturity</span>
                        <div className="flex-1 bg-[var(--bg-sunken)] h-1 rounded-full overflow-hidden">
                            <div className="bg-[var(--aos-brass)] h-full" style={{ width: `${capability.maturity}%` }} />
                        </div>
                    </div>
                    <span className={`inline-flex items-center rounded-[var(--radius-full)] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider ${getStageClass(capability.stageFit)}`}>
                        {capability.stageFit}
                    </span>
                </div>
            </div>
        </div>
    );
};
