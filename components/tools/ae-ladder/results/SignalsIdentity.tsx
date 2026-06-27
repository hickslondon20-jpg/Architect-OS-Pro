import React from 'react';
import { Card, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ui';
import { DimensionScore } from '../types';
import { Info } from 'lucide-react';

interface SignalsIdentityProps {
    stageDescription?: string | null;
    headlineStrength?: string | null;
    headlineFriction?: string | null;
    headlineSynthesis?: string | null;
}

export const SignalsIdentity: React.FC<SignalsIdentityProps> = ({
    stageDescription,
    headlineStrength,
    headlineFriction,
    headlineSynthesis
}) => {
    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-[var(--fg-1)]">Stage Identity & Synthesis</h3>
                <p className="text-sm text-[var(--fg-3)]">How your current operational reality maps to the Growth Velocity framework.</p>
            </div>

            <Card className="p-6 md:p-8 bg-[var(--bg-surface)] border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Left side: Stage Core Identity */}
                    <div className="md:col-span-5 space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--fg-3)]">Core Identity</h4>
                        <p className="text-[var(--fg-2)] leading-relaxed">
                            {stageDescription || "Loading stage description..."}
                        </p>
                    </div>

                    {/* Right side: AI Signal Synthesis */}
                    <div className="md:col-span-7 space-y-5 md:border-l md:border-[var(--aos-mist)] md:pl-8">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--fg-3)]">Current Reality Signals</h4>

                        <ul className="space-y-4">
                            <li className="flex gap-3 items-start">
                                <span className="text-[var(--aos-success)] font-bold mt-0.5">+</span>
                                <span className="text-[var(--fg-2)] leading-snug">
                                    {headlineStrength || "—"}
                                </span>
                            </li>
                            <li className="flex gap-3 items-start">
                                <span className="text-[var(--aos-risk)] font-bold mt-0.5">−</span>
                                <span className="text-[var(--fg-2)] leading-snug">
                                    {headlineFriction || "—"}
                                </span>
                            </li>
                            <li className="flex gap-3 items-start">
                                <span className="text-[var(--aos-brass)] font-bold mt-0.5">↳</span>
                                <span className="text-[var(--fg-1)] font-medium leading-snug">
                                    {headlineSynthesis || "—"}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </Card>
        </section>
    );
};
