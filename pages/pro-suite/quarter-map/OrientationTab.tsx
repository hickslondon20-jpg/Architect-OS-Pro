import React from 'react';
import { Compass, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const accomplishments = [
    {
        title: 'Define your growth horizons',
        description: 'Lock in your 12, 24, and 36-month vision with clear qualitative and quantitative goals.',
    },
    {
        title: 'See what your growth requires',
        description: 'Get strategic synthesis showing what your trajectory demands of your business at your current stage.',
    },
    {
        title: 'Create your 12-month plan',
        description: 'Break down your long-term vision into an executable annual roadmap with quarterly focus areas.',
    },
    {
        title: 'Set your quarterly priorities',
        description: 'Use the 3P Framework to select 9 capability areas for focused execution this quarter.',
    },
];

const journeySteps = [
    {
        id: 1,
        title: 'Strategic Horizons',
        description: 'Define your 3-year vision',
        active: true,
    },
    {
        id: 2,
        title: '12-Month Plan',
        description: 'Break down into roadmap',
        active: false,
    },
    {
        id: 3,
        title: 'Current Quarter',
        description: 'Select focus areas',
        active: false,
    },
];

export const OrientationTab: React.FC = () => {
    return (
        <div className="mx-auto max-w-[860px] space-y-8 text-center">
            <div className="space-y-5 pt-6 pb-2">
                <div className="flex justify-center">
                    <div
                        className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-xs)]"
                        style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}
                    >
                        <Compass className="h-8 w-8" style={{ color: 'var(--aos-brass)' }} />
                    </div>
                </div>
                <div className="space-y-3">
                    <h1 className="aos-h1">
                        Build Your Strategic Roadmap
                    </h1>
                    <p className="aos-body mx-auto max-w-2xl" style={{ color: 'var(--fg-2)' }}>
                        Define where you're going, what it will require, and how to get there — one quarter at a time.
                    </p>
                </div>
            </div>

            <div
                className="rounded-[var(--radius-xs)] p-6 text-left"
                style={{
                    background: 'var(--bg-surface)',
                    border: 'var(--border-hairline)',
                    boxShadow: 'var(--shadow-soft-1)',
                }}
            >
                <h2 className="aos-h3 mb-5">What You'll Accomplish</h2>
                <ul className="grid gap-4">
                    {accomplishments.map((item) => (
                        <li key={item.title} className="flex items-start gap-4">
                            <div
                                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                                style={{ background: 'var(--aos-success-tint)' }}
                            >
                                <Check className="h-4 w-4" style={{ color: 'var(--aos-success)' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>{item.title}</h3>
                                <p className="aos-small mt-1">{item.description}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-4 text-left">
                <h2 className="aos-h3">The Journey Ahead</h2>
                <div
                    className="rounded-[var(--radius-xs)] p-4"
                    style={{
                        background: 'var(--bg-surface)',
                        border: 'var(--border-hairline)',
                        boxShadow: 'var(--shadow-soft-1)',
                    }}
                >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                        {journeySteps.map((step, index) => (
                            <React.Fragment key={step.title}>
                                <div
                                    className="rounded-[var(--radius-xs)] p-4 text-center"
                                    style={{
                                        background: step.active ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                                        border: step.active ? 'var(--border-accent)' : 'var(--border-hairline)',
                                        boxShadow: step.active ? undefined : 'var(--shadow-soft-1)',
                                    }}
                                >
                                    <div
                                        className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                                        style={{
                                            background: step.active ? 'var(--aos-brass)' : 'var(--bg-surface)',
                                            color: step.active ? 'var(--aos-cloud)' : 'var(--fg-3)',
                                            border: step.active ? '1px solid var(--aos-brass)' : 'var(--border-hairline)',
                                        }}
                                    >
                                        {step.id}
                                    </div>
                                    <h3 className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>{step.title}</h3>
                                    <p className="aos-caption mt-1">{step.description}</p>
                                </div>
                                {index < journeySteps.length - 1 && (
                                    <div className="hidden items-center justify-center md:flex">
                                        <ArrowRight className="h-5 w-5" style={{ color: 'var(--fg-4)' }} />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-2xl space-y-4 pt-3 text-left">
                <h2 className="aos-h3">Why This Matters</h2>
                <p className="aos-small">
                    Most strategic plans become shelf-ware because they lack connection to execution. This planning flow ensures your diagnostic insights transform into a living roadmap that evolves with your business. By defining your destination, understanding what it requires, and committing to focused quarterly execution, you'll systematically advance through your agency's transformation journey.
                </p>
            </div>

            <div className="space-y-5 pt-4 pb-8">
                <Link
                    to="/pro/quarter-map/horizons"
                    className="inline-flex items-center justify-center rounded-[var(--radius-xs)] px-8 py-3 text-base font-semibold transition-all"
                    style={{
                        background: 'var(--aos-brass)',
                        color: 'var(--aos-cloud)',
                        border: 'var(--border-accent)',
                        boxShadow: 'var(--shadow-soft-1)',
                    }}
                >
                    Get Started
                </Link>

                <div>
                    <Link
                        to="/pro/sprint-planning"
                        className="text-sm transition-colors hover:underline"
                        style={{ color: 'var(--fg-3)' }}
                    >
                        I've done this before. Skip to my current plan →
                    </Link>
                </div>
            </div>
        </div>
    );
};
