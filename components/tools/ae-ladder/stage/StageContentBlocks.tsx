import React from 'react';
import { Card, Button } from '../../../ui';
import { PlayCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { StageContent, BandContent } from '../types';

export const LadderOverviewBlock: React.FC = () => (
    <Card className="p-6 bg-[var(--bg-sunken)] border border-[var(--aos-mist)] shadow-none text-center space-y-4">
        <h3 className="text-lg font-semibold text-[var(--fg-1)]">The Agency Engine (AE) Ladder</h3>
        <p className="text-[var(--fg-2)] max-w-2xl mx-auto">
            The AE Ladder is the roadmap for agency maturity, defining the 5 stages of evolution:
            Rising, Striving, Thriving, Driving, and Arriving. Understanding your stage is the first step to
            unlocking the next level of growth.
        </p>
        <Button variant="outline" className="gap-2">
            <PlayCircle className="w-4 h-4" /> Watch Framework Overview
        </Button>
    </Card>
);

export const StageSummaryBlock: React.FC<{ stage: StageContent }> = ({ stage }) => (
    <section className="space-y-6">
        <div className="border-l-4 border-l-[var(--aos-brass)] pl-6">
            <h2 className="text-3xl font-bold tracking-tight mb-2 text-[var(--fg-1)]">{stage.overview.title}</h2>
            <p className="text-lg text-[var(--fg-2)]">{stage.overview.summary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Card className="p-6 space-y-4">
                <h4 className="font-semibold text-[var(--fg-1)]">Key Themes at This Stage</h4>
                <ul className="space-y-3">
                    {stage.overview.keyThemes.map((theme, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--aos-brass)] mt-2" />
                            <span className="text-sm text-[var(--fg-2)]">{theme}</span>
                        </li>
                    ))}
                </ul>
            </Card>

            <Card className="p-6 space-y-4 bg-[var(--aos-brass-tint)] border-[var(--aos-brass)]">
                <h4 className="font-semibold text-[var(--fg-1)]">Your Journey Context</h4>
                <div className="space-y-4 text-sm text-[var(--fg-2)]">
                    <p>{stage.journey.summary}</p>
                    <p className="font-medium border-t border-[var(--aos-mist)] pt-3" style={{ fontStyle: 'italic' }}>
                        "{stage.journey.nextStageHint}"
                    </p>
                </div>
            </Card>
        </div>
    </section>
);

export const StagePositionBlock: React.FC<{ band: BandContent }> = ({ band }) => (
    <div className="mt-12 space-y-6">
        <div className="flex items-center gap-3">
            <div className="h-px bg-[var(--aos-mist)] flex-1" />
            <span className="text-xs uppercase tracking-widest font-bold text-[var(--fg-3)]">Where You Sit Within This Stage</span>
            <div className="h-px bg-[var(--aos-mist)] flex-1" />
        </div>

        <div className="text-center max-w-3xl mx-auto space-y-4">
            <h3 className="text-2xl font-bold text-[var(--fg-1)]">{band.positionLabel}</h3>
            <p className="text-lg font-medium text-[var(--aos-brass)]">{band.introLine}</p>
            <p className="text-[var(--fg-2)]">{band.narrative}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {band.whatGoodLooksLike.map((item, i) => (
                <Card key={i} className="p-4 text-center bg-[var(--bg-sunken)] border-[var(--aos-mist)] border-dashed">
                    <p className="text-sm font-medium text-[var(--fg-2)]">{item}</p>
                </Card>
            ))}
        </div>
    </div>
);

export const TrainingTeaserBlock: React.FC = () => (
    <div className="mt-16 bg-[var(--bg-inverse)] rounded-2xl p-8 md:p-12 text-center space-y-6 relative overflow-hidden" style={{ color: 'var(--fg-on-dark)' }}>
        <div className="relative z-10 space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--fg-on-dark)]">Ready to Master Your Stage?</h2>
            <p className="text-[var(--aos-steel-blue)] max-w-xl mx-auto text-lg">
                Dive deeper into the AE Ladder Masterclass to get the full playbook for navigating Striving and breaking through to Thriving.
            </p>
            <Button size="lg" variant="secondary" className="gap-2 font-semibold">
                Open Masterclass Portal <ExternalLink className="w-4 h-4" />
            </Button>
        </div>

        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
    </div>
);
