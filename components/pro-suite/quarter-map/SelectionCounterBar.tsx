import React from 'react';
import { Target, Sprout, RefreshCw, Lock, ArrowRight, Save } from 'lucide-react';
import { Button } from '../../ui';

interface SelectionCounterBarProps {
    prioritizeCount: number;
    plantCount: number;
    iterateCount: number;
    onLock: () => void;
    onSaveDraft: () => void;
}

export const SelectionCounterBar: React.FC<SelectionCounterBarProps> = ({
    prioritizeCount, plantCount, iterateCount, onLock, onSaveDraft
}) => {

    const isComplete = prioritizeCount === 3 && plantCount === 3 && iterateCount === 3;
    const totalCount = prioritizeCount + plantCount + iterateCount;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--aos-mist)] p-3 sm:p-4 shadow-[var(--shadow-elevated)] animate-in slide-in-from-bottom-5 z-40">
            <div className="max-w-[1600px] mx-auto px-1 sm:px-5 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">

                <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                    <div className="flex items-center gap-2 shrink-0">
                        <Target className={`w-5 h-5 ${prioritizeCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`} />
                        <div className="flex flex-col">
                            <span className="aos-eyebrow">Prioritize</span>
                            <span className={`text-sm font-bold ${prioritizeCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}`}>{prioritizeCount}/3</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--aos-mist)] shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                        <Sprout className={`w-5 h-5 ${plantCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`} />
                        <div className="flex flex-col">
                            <span className="aos-eyebrow">Plant</span>
                            <span className={`text-sm font-bold ${plantCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}`}>{plantCount}/3</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--aos-mist)] shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                        <RefreshCw className={`w-5 h-5 ${iterateCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`} />
                        <div className="flex flex-col">
                            <span className="aos-eyebrow">Iterate</span>
                            <span className={`text-sm font-bold ${iterateCount === 3 ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}`}>{iterateCount}/3</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">

                    {!isComplete ? (
                        <div className="hidden lg:flex items-center text-sm text-[var(--fg-3)]">
                            Select {9 - totalCount} more capabilit{9 - totalCount === 1 ? 'y' : 'ies'} to complete plan
                        </div>
                    ) : (
                        <div className="hidden lg:flex items-center text-sm font-bold text-[var(--aos-success)] bg-[var(--aos-success-tint)] px-3 py-1 rounded-full border border-[var(--aos-success)]">
                            Plan Ready
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onSaveDraft} className="text-[var(--fg-2)] hidden sm:flex">
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                        <Button
                            className={`whitespace-nowrap ${isComplete ? 'bg-[var(--aos-brass)] text-[var(--aos-cloud)] hover:bg-[var(--aos-brass-soft)]' : 'bg-[var(--bg-sunken)] text-[var(--fg-4)] cursor-not-allowed hover:bg-[var(--bg-sunken)]'}`}
                            onClick={isComplete ? onLock : undefined}
                            disabled={!isComplete}
                        >
                            {isComplete && <Lock className="w-4 h-4 mr-2" />}
                            Lock & Proceed <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
