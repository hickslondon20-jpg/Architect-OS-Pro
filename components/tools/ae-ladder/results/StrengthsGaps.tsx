import React from 'react';
import { Card } from '../../../ui';
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';

interface StrengthsGapsProps {
    execSummaryStrength?: string | null;
    execSummaryFriction?: string | null;
}

export const StrengthsGaps: React.FC<StrengthsGapsProps> = ({
    execSummaryStrength,
    execSummaryFriction
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths Card */}
            <Card className="p-6 border-l-4 border-l-[var(--aos-success)] bg-[var(--aos-success-tint)]">
                <div className="flex items-center gap-2 mb-4">
                    <ArrowUpCircle className="w-5 h-5 text-[var(--aos-success)]" />
                    <h3 className="text-lg font-bold text-[var(--fg-1)]">Core Lever (Strength)</h3>
                </div>

                <div className="text-sm text-[var(--fg-2)] leading-relaxed min-h-[80px]">
                    {execSummaryStrength ? (
                        execSummaryStrength
                    ) : (
                        <div className="flex items-center gap-2 text-[var(--fg-3)] italic h-full animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Insights generating...
                        </div>
                    )}
                </div>
            </Card>

            {/* Gaps Card */}
            <Card className="p-6 border-l-4 border-l-[var(--aos-warning)] bg-[var(--aos-warning-tint)]">
                <div className="flex items-center gap-2 mb-4">
                    <ArrowDownCircle className="w-5 h-5 text-[var(--aos-warning)]" />
                    <h3 className="text-lg font-bold text-[var(--fg-1)]">Primary Friction (Gap)</h3>
                </div>

                <div className="text-sm text-[var(--fg-2)] leading-relaxed min-h-[80px]">
                    {execSummaryFriction ? (
                        execSummaryFriction
                    ) : (
                        <div className="flex items-center gap-2 text-[var(--fg-3)] italic h-full animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Insights generating...
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
