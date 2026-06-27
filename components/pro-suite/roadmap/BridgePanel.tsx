import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface BridgePanelProps {
    focusStatement: string;
    onProceed?: () => void;
}

export const BridgePanel: React.FC<BridgePanelProps> = ({ focusStatement, onProceed }) => {
    return (
        <div className="my-10 flex flex-col items-center rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-8 text-center shadow-[var(--shadow-soft-1)]">
            <div className="aos-eyebrow mb-4 text-[var(--aos-brass)]">
                YOUR QUARTER FOCUS
            </div>

            <p className="mb-8 max-w-2xl text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                {focusStatement}
            </p>

            <div className="flex w-full max-w-md flex-col items-center gap-3">
                <div className="mb-1 text-[var(--t-caption-size)] font-medium text-[var(--fg-3)]">
                    The following areas emerged as your highest-leverage focus for Q1.
                </div>
                {onProceed ? (
                    <button
                        onClick={onProceed}
                        className="inline-flex w-full items-center justify-center rounded-[var(--radius-xs)] bg-[var(--aos-brass)] px-6 py-3 font-medium text-[var(--aos-cloud)] transition-colors hover:bg-[var(--aos-brass-soft)]"
                    >
                        Build My Quarter Map <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                ) : (
                    <Link
                        to="/pro/planning/quarter-map/current-quarter"
                        className="inline-flex w-full items-center justify-center rounded-[var(--radius-xs)] bg-[var(--aos-brass)] px-6 py-3 font-medium text-[var(--aos-cloud)] transition-colors hover:bg-[var(--aos-brass-soft)]"
                    >
                        Build My Quarter Map <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                )}
                <div className="mt-1 px-4 text-center text-[var(--t-caption-size)] font-medium text-[var(--fg-3)]">
                    You'll select your 9 focus capability areas using the 3P Framework - Prioritize, Plant, and Progressively Iterate.
                </div>
            </div>
        </div>
    );
};
