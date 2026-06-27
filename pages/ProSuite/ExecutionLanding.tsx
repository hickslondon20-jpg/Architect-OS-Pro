import React from 'react';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, RotateCcw, Rocket } from 'lucide-react';

const executionElements = [
    {
        label: 'Orient',
        description: 'Re-anchor on the locked sprint: goal, 3P plan, owners, and team alignment.',
        href: '/pro/execution/orient',
        icon: Compass,
    },
    {
        label: 'Operate',
        description: 'Run the work: milestone updates, blockers, ownership, and standup rhythm.',
        href: '/pro/execution/operate',
        icon: CheckCircle2,
    },
    {
        label: 'Reflect',
        description: 'Close the sprint, decide what carries forward, and capture what the organization learned.',
        href: '/pro/execution/reflect',
        icon: RotateCcw,
    },
];

const executionSteps = [
    {
        label: '1. Orient',
        description: 'Start by aligning the team around what this sprint is here to accomplish.',
    },
    {
        label: '2. Operate',
        description: 'Return through the sprint to update progress, owners, blockers, and rhythm.',
    },
    {
        label: '3. Reflect',
        description: 'Close with decisions, learning, and the handoff into the next planning cycle.',
    },
];

export const ExecutionLanding: React.FC = () => {
    return (
        <div className="space-y-7">
            <div className="flex flex-col gap-3">
                <div className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>Execution</div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="aos-h1">Turn the plan into momentum.</h1>
                        <p className="aos-body mt-3 max-w-2xl" style={{ color: 'var(--fg-2)' }}>
                            Orient the team, operate the work, then close the sprint with decisions you can carry forward.
                        </p>
                    </div>
                    <Link
                        to="/pro/execution/orient"
                        className="inline-flex w-fit items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                    >
                        Open current sprint
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </div>
            </div>

            <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)]" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                                <Rocket className="h-6 w-6" style={{ color: 'var(--aos-brass)' }} />
                            </div>
                            <div>
                                <div className="aos-eyebrow mb-2">Execution Sequence</div>
                                <h2 className="aos-h3">Three elements to run the sprint</h2>
                                <p className="aos-small mt-2 max-w-2xl">
                                    Execution keeps the sprint from becoming a static plan. Each element gives the founder a clear place to align, move, and close.
                                </p>
                            </div>
                        </div>
                        <div className="rounded-[var(--radius-xs)] px-4 py-3" style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}>
                            <div className="aos-eyebrow mb-1">How to use this</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                                Move left to right when a sprint kicks off. Return to any element anytime to update or review.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {executionElements.map((element, index) => {
                            const Icon = element.icon;

                            return (
                                <Link
                                    key={element.label}
                                    to={element.href}
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
                                    <h3 className="aos-h3">{element.label}</h3>
                                    <p className="aos-small mt-3">{element.description}</p>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {executionSteps.map((step) => (
                            <div
                                key={step.label}
                                className="rounded-[var(--radius-xs)] p-4"
                                style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}
                            >
                                <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>{step.label}</div>
                                <p className="aos-small">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
};
