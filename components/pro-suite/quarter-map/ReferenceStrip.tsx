import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info, Map } from 'lucide-react';
import { ReferenceContext } from './types';

interface ReferenceStripProps {
    context?: ReferenceContext;
}

export const ReferenceStrip: React.FC<ReferenceStripProps> = ({ context }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!context) {
        return null;
    }

    return (
        <div
            className="overflow-hidden rounded-[var(--radius-xs)] transition-all duration-300"
            style={{
                background: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                boxShadow: 'var(--shadow-soft-1)',
            }}
        >
            <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--bg-sunken)]"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div>
                    <h2 className="flex items-center gap-2 text-[var(--t-body-size)] font-semibold text-[var(--fg-1)]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                            <Map className="h-4 w-4" />
                        </span>
                        Reference: Your 12-Month Trajectory
                    </h2>
                </div>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-[var(--aos-brass)]" /> : <ChevronRight className="h-5 w-5 text-[var(--fg-3)]" />}
            </button>

            {isExpanded && (
                <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-sunken)] px-4 pb-5 pt-4 md:px-6">
                    <div className="grid grid-cols-1 gap-6 text-[var(--t-small-size)] md:grid-cols-2">
                        <div>
                            <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--fg-1)]">
                                <Info className="h-4 w-4 text-[var(--aos-brass)]" /> Focus Theme
                            </div>
                            <p className="leading-[var(--t-small-lh)] text-[var(--fg-2)]">{context.twelveMonthTheme}</p>
                        </div>
                        <div>
                            <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--fg-1)]">
                                <Map className="h-4 w-4 text-[var(--aos-brass)]" /> Key Areas
                            </div>
                            <ul className="space-y-1 text-[var(--fg-2)]">
                                {context.focusAreas.map((area, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-[var(--radius-full)] bg-[var(--aos-brass)]" />
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
