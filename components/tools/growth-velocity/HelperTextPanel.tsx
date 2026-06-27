import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';

export const HelperTextPanel: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-6 border border-[var(--aos-mist)] rounded-lg bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-soft-1)] animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Header / Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-[var(--bg-canvas)] hover:bg-[var(--bg-sunken)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-[var(--aos-insight)]" />
                    <span className="font-medium text-[var(--fg-1)]">How to use this calculator</span>
                </div>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[var(--fg-3)]" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--fg-3)]" />
                )}
            </button>

            {/* Expanded Content */}
            {isOpen && (
                <div className="p-5 bg-[var(--bg-surface)] border-t border-[var(--aos-mist)] space-y-4 text-sm text-[var(--fg-2)]">

                    <p>
                        This calculator helps you model different growth scenarios. Start with a preset or manually adjust
                        future state targets. Leave fields blank to see what needs to change to hit your goals.
                    </p>

                    <div className="flex gap-3 p-3 bg-[var(--aos-insight-tint)] rounded-md border border-[var(--aos-insight)] text-[var(--fg-1)]">
                        <span className="text-xl">💡</span>
                        <p>
                            <strong className="font-semibold">Tip:</strong> Test 1-2 variables at a time for clearest insights.
                            For example: <span className="italic">"What if I increase ACV by 20%?"</span> or <span className="italic">"What if I improve retention to 95%?"</span>
                        </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--aos-mist)] space-y-2">
                        <p>
                            For any target fields left blank, we'll assume constant performance from your current state.
                            Benchmarks will be applied where necessary to ensure realistic projections.
                        </p>

                        <p className="flex items-center gap-2 text-[var(--fg-2)]">
                            Complete your Agency Snapshot for more accurate results and context-aware insights.
                            <Link to="/snapshot" className="text-[var(--aos-insight)] font-medium hover:underline flex items-center gap-1">
                                Complete Snapshot <ArrowRight className="h-3 w-3" />
                            </Link>
                        </p>
                    </div>

                </div>
            )}
        </div>
    );
};
