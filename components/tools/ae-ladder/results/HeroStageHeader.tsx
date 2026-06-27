import React, { useState } from 'react';
import { Card, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Badge } from '../../../ui';
import { Info, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { StageLabel, DimensionScore } from '../types';

interface HeroStageHeaderProps {
    stageLabel: StageLabel;
    tagline: string;
    description: string;
    overallScore: number;
    completedAt: string;
    overallSynthesis?: string | null;
}

export const HeroStageHeader: React.FC<HeroStageHeaderProps> = ({
    stageLabel,
    tagline,
    description,
    overallScore,
    completedAt,
    overallSynthesis
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Card className="flex flex-col bg-[var(--bg-inverse)] border-l-4 border-l-[var(--aos-brass)] relative overflow-hidden transition-all duration-300">
            <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

                {/* Left: Stage Badging & Identity */}
                <div className="space-y-3 z-10 w-full md:flex-1" style={{ maxWidth: '860px' }}>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="default" className="uppercase tracking-wide font-semibold bg-[var(--aos-parchment)] text-[var(--aos-obsidian)] shadow-sm" style={{ fontSize: 'var(--t-body-size)', padding: '6px 14px' }}>
                            {stageLabel}
                        </Badge>
                        <span className="text-sm font-medium text-[var(--aos-steel-blue)] flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            Assessed on {new Date(completedAt).toLocaleDateString()}
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--fg-on-dark)]">
                        {tagline}
                    </h1>

                    <p className="text-lg text-[var(--aos-steel-blue)] leading-relaxed" style={{ maxWidth: '780px' }}>
                        {description}
                    </p>
                </div>

                {/* Right: Score Visual */}
                <div className="flex flex-col items-center md:items-end z-10 w-full md:w-auto">
                    <div className="flex flex-col items-center bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)]">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-3)] mb-1">Overall Score</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-[var(--aos-brass)]" style={{ fontFamily: 'var(--font-mono)' }}>{overallScore.toFixed(2)}</span>
                            <span className="text-[var(--fg-3)] text-sm font-medium">/ 5.0</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-12 -translate-y-12 pointer-events-none" />

            {/* Expandable Synthesis Section */}
            <div className="border-t border-[var(--aos-mist)] bg-white/5 relative z-10 mt-auto">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-3 px-6 md:px-8 flex items-center justify-between text-sm font-medium text-[var(--aos-steel-blue)] hover:text-[var(--fg-on-dark)] transition-colors group"
                >
                    <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--aos-brass)] group-hover:bg-[var(--aos-brass-soft)] transition-colors" />
                        Deep-Dive Synthesis
                    </span>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </button>

                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}
                >
                    <div className="px-6 md:px-8 text-sm text-[var(--fg-on-dark)] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', maxWidth: '920px' }}>
                        {overallSynthesis ? (
                            overallSynthesis
                        ) : (
                            <div className="flex items-center gap-2 text-[var(--aos-steel-blue)] h-full animate-pulse" style={{ fontFamily: 'inherit', fontStyle: 'normal' }}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deep-Dive Synthesis generating...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};
