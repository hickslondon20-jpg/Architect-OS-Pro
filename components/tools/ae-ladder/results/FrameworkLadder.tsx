import React from 'react';
import { Card } from '../../../ui';
import { AEStageContextRow } from '../types';

interface FrameworkLadderProps {
    context: AEStageContextRow;
}

export const FrameworkLadder: React.FC<FrameworkLadderProps> = ({ context }) => {
    const rungs = [
        { label: 'Rising', description: context.ladder_rising_description, isCurrent: context.ae_frontend_stage === 'Rising' },
        { label: 'Striving', description: context.ladder_striving_description, isCurrent: context.ae_frontend_stage === 'Striving' },
        { label: 'Thriving', description: context.ladder_thriving_description, isCurrent: context.ae_frontend_stage === 'Thriving' },
        { label: 'Driving', description: context.ladder_driving_description, isCurrent: context.ae_frontend_stage === 'Driving' },
        { label: 'Arriving', description: context.ladder_arriving_description, isCurrent: context.ae_frontend_stage === 'Arriving' },
    ];

    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold tracking-tight mb-4 text-[var(--fg-1)]">
                The Agency Engine (AE) Ladder
            </h2>
            <p className="text-base text-[var(--fg-2)] leading-relaxed mb-8">
                The AE Ladder is the roadmap for agency maturity, defining the 5 stages of evolution: Rising, Striving, Thriving, Driving, and Arriving. Understanding your stage is the first step to unlocking the next level of growth.
            </p>

            <div className="space-y-4">
                {rungs.map((rung, i) => (
                    <div
                        key={rung.label}
                        className={`flex gap-6 p-5 rounded-lg border transition-all ${rung.isCurrent
                                ? 'bg-[var(--aos-brass-tint)] border-[var(--aos-brass)] ring-1 ring-[var(--aos-brass)]'
                                : 'bg-[var(--bg-canvas)] border-[var(--aos-mist)] hover:bg-[var(--bg-sunken)]'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-2 w-16 shrink-0 mt-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rung.isCurrent
                                    ? 'bg-[var(--aos-brass)] text-white'
                                    : 'bg-[var(--bg-sunken)] text-[var(--fg-3)]'
                                }`}>
                                {i + 1}
                            </div>
                            {i < rungs.length - 1 && (
                                <div className={`w-0.5 h-full min-h-[40px] ${rung.isCurrent ? 'bg-[var(--aos-brass)]' : 'bg-[var(--aos-mist)]'
                                    }`} />
                            )}
                        </div>
                        <div className="flex flex-col gap-1 pb-4">
                            <h3 className={`text-lg font-semibold ${rung.isCurrent ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-2)]'}`}>
                                {rung.label}
                                {rung.isCurrent && (
                                    <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                                        Current Stage
                                    </span>
                                )}
                            </h3>
                            <p className={`text-sm leading-relaxed ${rung.isCurrent ? 'text-[var(--fg-1)]' : 'text-[var(--fg-3)]'}`}>
                                {rung.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};
