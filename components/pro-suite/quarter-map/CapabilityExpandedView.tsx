import React from 'react';
import { X, MapPin, Target, Sprout, RefreshCw, Archive } from 'lucide-react';
import { Capability, BucketType } from './types';
import { Button } from '../../ui';

interface CapabilityExpandedViewProps {
    capability: Capability;
    onClose: () => void;
    onAdd: (capabilityId: string, bucket: BucketType) => void;
    currentBucket?: BucketType;
    onRemove?: (capabilityId: string) => void;
}

export const CapabilityExpandedView: React.FC<CapabilityExpandedViewProps> = ({
    capability, onClose, onAdd, currentBucket, onRemove
}) => {

    // Helper descriptions from AE Stage fit
    const getStageContext = (stageFit: string) => {
        if (stageFit === 'Ahead of Stage') {
            return "This capability is currently operating ahead of your agency's overall maturity stage. You have strong structural advantage here. Decide if you want to double-down on this advantage (Prioritize/Iterate) or let it ride while " +
                "you bring other areas up to parity.";
        }
        if (stageFit === 'At Stage') {
            return "This capability is aligned with your current agency stage. To continue growing and reach the next horizon, this area will eventually need to be fortified. " +
                "Is this the quarter to push it to the next level?";
        }
        return "This capability is lagging behind your overall agency maturity. This is a structural vulnerability. " +
            "It is highly recommended you address lagging capabilities to stabilize your foundation before pushing for aggressive top-line growth.";
    };

    const getStageClass = (stage: string) => {
        if (stage === 'Ahead of Stage') return 'bg-[var(--aos-success-tint)] text-[var(--aos-success)]';
        if (stage === 'At Stage') return 'bg-[var(--bg-sunken)] text-[var(--fg-2)]';
        return 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200" style={{ background: 'rgba(25, 48, 82, 0.5)' }}>
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-xs)] bg-[var(--bg-surface)] animate-in zoom-in-95 duration-200" style={{ boxShadow: 'var(--shadow-elevated)' }}>

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-[var(--aos-mist)] bg-[var(--bg-sunken)]">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded border bg-[var(--bg-surface)] text-[var(--fg-2)] border-[var(--aos-mist)]">
                                {capability.dimension}
                            </span>
                            <span className={`inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStageClass(capability.stageFit)}`}>
                                {capability.stageFit}
                            </span>
                            <span className="text-xs font-bold text-[var(--fg-3)]">
                                Priority Rank: #{capability.rank}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-[var(--fg-1)]">
                            {capability.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--fg-3)] hover:text-[var(--fg-1)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sunken)] p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-8">

                    {/* Description */}
                    <div>
                        <h3 className="aos-eyebrow mb-2">Overview</h3>
                        <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                            {capability.description || "Capability defining the structural elements necessary to perform functional tasks effectively and consistently within this dimension."}
                        </p>
                    </div>

                    {/* Maturity State */}
                    <div className="bg-[var(--bg-sunken)] p-4 rounded-lg border border-[var(--aos-mist)]">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-[var(--fg-1)] flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[var(--fg-3)]" /> Current Assessment State
                            </h3>
                            <span className="font-mono font-bold text-[var(--aos-brass)]">{Math.round(capability.maturity)}%</span>
                        </div>
                        <div className="w-full bg-[var(--aos-mist)] h-2 rounded-full overflow-hidden mb-4">
                            <div className="bg-[var(--aos-brass)] h-full" style={{ width: `${capability.maturity}%` }}></div>
                        </div>
                        <div className="text-sm text-[var(--fg-2)] bg-[var(--bg-surface)] p-3 border border-[var(--aos-mist)] rounded">
                            <span className="font-bold block mb-1">Stage Context:</span>
                            {getStageContext(capability.stageFit)}
                        </div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-[var(--aos-mist)] bg-[var(--bg-surface)]">
                    <h3 className="aos-eyebrow mb-3">
                        {currentBucket ? "Currently in" : "Assign to Sprint Plan"}
                    </h3>

                    {currentBucket ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {currentBucket === 'PRIORITIZE' && <span className="flex items-center gap-2 text-sm font-bold text-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-3 py-1.5 border border-[var(--aos-brass)] rounded-md"><Target className="w-4 h-4" /> PRIORITIZE</span>}
                                {currentBucket === 'PLANT' && <span className="flex items-center gap-2 text-sm font-bold text-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-3 py-1.5 border border-[var(--aos-brass)] rounded-md"><Sprout className="w-4 h-4" /> PLANT</span>}
                                {currentBucket === 'ITERATE' && <span className="flex items-center gap-2 text-sm font-bold text-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-3 py-1.5 border border-[var(--aos-brass)] rounded-md"><RefreshCw className="w-4 h-4" /> ITERATE</span>}
                                {currentBucket === 'PARKING_LOT' && <span className="flex items-center gap-2 text-sm font-bold text-[var(--fg-2)] bg-[var(--bg-sunken)] px-3 py-1.5 border border-[var(--aos-mist)] rounded-md"><Archive className="w-4 h-4" /> PARKING LOT</span>}
                            </div>
                            <Button variant="outline" className="border-[var(--aos-risk)] text-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)]" onClick={() => {
                                if (onRemove) onRemove(capability.id);
                                onClose();
                            }}>
                                <X className="w-4 h-4 mr-2" /> Remove
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            <button onClick={() => { onAdd(capability.id, 'PRIORITIZE'); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-[var(--aos-mist)] hover:bg-[var(--aos-brass-tint)] hover:border-[var(--aos-brass)] transition-colors bg-[var(--bg-surface)] text-[var(--fg-2)] group" style={{ boxShadow: 'var(--shadow-soft-1)' }}>
                                <Target className="w-5 h-5 text-[var(--aos-brass)]" />
                                <span className="text-xs font-bold">Prioritize</span>
                            </button>
                            <button onClick={() => { onAdd(capability.id, 'PLANT'); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-[var(--aos-mist)] hover:bg-[var(--aos-brass-tint)] hover:border-[var(--aos-brass)] transition-colors bg-[var(--bg-surface)] text-[var(--fg-2)] group" style={{ boxShadow: 'var(--shadow-soft-1)' }}>
                                <Sprout className="w-5 h-5 text-[var(--aos-brass)]" />
                                <span className="text-xs font-bold">Plant</span>
                            </button>
                            <button onClick={() => { onAdd(capability.id, 'ITERATE'); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-[var(--aos-mist)] hover:bg-[var(--aos-brass-tint)] hover:border-[var(--aos-brass)] transition-colors bg-[var(--bg-surface)] text-[var(--fg-2)] group" style={{ boxShadow: 'var(--shadow-soft-1)' }}>
                                <RefreshCw className="w-5 h-5 text-[var(--aos-brass)]" />
                                <span className="text-xs font-bold">Iterate</span>
                            </button>
                            <button onClick={() => { onAdd(capability.id, 'PARKING_LOT'); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-[var(--aos-mist)] hover:bg-[var(--bg-sunken)] hover:border-[var(--aos-brass)] transition-colors bg-[var(--bg-surface)] text-[var(--fg-3)] group" style={{ boxShadow: 'var(--shadow-soft-1)' }}>
                                <Archive className="w-5 h-5 group-hover:text-[var(--fg-1)]" />
                                <span className="text-xs font-bold">Park</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
