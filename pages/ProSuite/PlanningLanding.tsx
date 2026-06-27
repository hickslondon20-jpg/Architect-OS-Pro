import React from 'react';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import { ArrowRight, Map, PlayCircle, Target } from 'lucide-react';

const planningSteps = [
    {
        label: 'Roadmap Review',
        description: 'Set the annual sequence and confirm what this quarter should serve.',
        href: '/pro/planning/roadmap/12-month-plan',
        icon: Map,
    },
    {
        label: 'Quarter Map',
        description: 'Commit the 3P capability focus for the current quarter.',
        href: '/pro/planning/quarter-map',
        icon: Target,
    },
    {
        label: 'Sprint Planning',
        description: 'Translate the quarter focus into initiatives and milestones.',
        href: '/pro/planning/sprint-planning',
        icon: PlayCircle,
    },
];

export const PlanningLanding: React.FC = () => {
    return (
        <div className="space-y-7">
            <div className="flex flex-col gap-3">
                <div className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>Planning & Strategy</div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="aos-h1">Turn insight into a sequenced quarter.</h1>
                        <p className="aos-body mt-3 max-w-2xl" style={{ color: 'var(--fg-2)' }}>
                            Orient the year, choose the quarter's focus, then convert that focus into a sprint your team can run.
                        </p>
                    </div>
                    <Link
                        to="/pro/planning/roadmap"
                        className="inline-flex w-fit items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                    >
                        Open Strategic Roadmap
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </div>
            </div>

            <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)]" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                                <Map className="h-6 w-6" style={{ color: 'var(--aos-brass)' }} />
                            </div>
                            <div>
                                <div className="aos-eyebrow mb-2">Planning Sequence</div>
                                <h2 className="aos-h3">Three steps from direction to execution</h2>
                                <p className="aos-small mt-2 max-w-2xl">
                                    This area keeps strategy from becoming a static plan. Each step narrows the frame: first the roadmap, then the quarter, then the sprint.
                                </p>
                            </div>
                        </div>
                        <div className="rounded-[var(--radius-xs)] px-4 py-3" style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}>
                            <div className="aos-eyebrow mb-1">How to use this</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                                Work left to right when planning a new quarter. Return directly to any step when you need to review or adjust.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {planningSteps.map((step, index) => {
                            const Icon = step.icon;

                            return (
                                <Link
                                    key={step.label}
                                    to={step.href}
                                    className="group rounded-[var(--radius-xs)] p-5 transition-colors"
                                    style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}
                                >
                                    <div className="mb-5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                                                style={{
                                                    background: index === 0 ? 'var(--aos-brass)' : 'var(--bg-surface)',
                                                    color: index === 0 ? 'var(--aos-cloud)' : 'var(--fg-3)',
                                                    border: index === 0 ? '1px solid var(--aos-brass)' : 'var(--border-hairline)',
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                            <Icon className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                                        </div>
                                        <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--aos-brass)' }} />
                                    </div>
                                    <h3 className="aos-h3">{step.label}</h3>
                                    <p className="aos-small mt-3">{step.description}</p>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>1. Sequence</div>
                            <p className="aos-small">Roadmap Review keeps the quarter tied to the longer arc.</p>
                        </div>
                        <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>2. Commit</div>
                            <p className="aos-small">Quarter Map turns direction into a bounded 3P focus.</p>
                        </div>
                        <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>3. Activate</div>
                            <p className="aos-small">Sprint Planning converts the focus into work the team can own.</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
