import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Flag, LayoutDashboard, ShieldAlert, Users } from 'lucide-react';
import { Card, ProgressBar } from '../../components/ui';

const sprint = {
    name: 'Sprint 1: Delivery Floor Stabilization',
    quarter: 'Q1 2026',
    status: 'Active sprint',
    dates: 'Jan 1 - Mar 31, 2026',
    daysRemaining: 56,
    goal: 'We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.',
    supportingOutcomes: [
        'Client onboarding is consistent enough for the team to run without founder intervention.',
        'Delivery operating standards are documented, assigned, and visible in weekly rhythm.',
    ],
    theme: 'Establishing the bedrock for scalable delivery.',
};

const threeP = [
    {
        label: 'Prioritize',
        focus: 'Operations + Team Leadership',
        description: 'Process standardization and role clarity drive the active sprint work.',
        initiatives: 3,
    },
    {
        label: 'Plant',
        focus: 'Financial Stewardship',
        description: 'Early specs for the internal automation dashboard prepare future leverage.',
        initiatives: 2,
    },
    {
        label: 'Iterate',
        focus: 'Client Success + Positioning',
        description: 'Maintain account reviews and a reduced publishing rhythm while the floor stabilizes.',
        initiatives: 2,
    },
];

const owners = [
    { name: 'Sarah Hicks', role: 'CEO', scope: 'Sprint owner', initiatives: 4 },
    { name: 'Marcus Webb', role: 'Operations', scope: 'Process systems', initiatives: 3 },
    { name: 'Elena Rostova', role: 'Client Success', scope: 'Account rhythm', initiatives: 1 },
    { name: 'David Kim', role: 'Design', scope: 'Internal dashboard', initiatives: 1 },
];

const postureStyles = [
    { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' },
    { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)' },
    { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
];

export const OrientOverviewPage: React.FC = () => {
    return (
        <div className="space-y-7 pb-16">
            <div className="flex flex-col gap-3">
                <div className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>Overview / Synthesis</div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="aos-h1">Re-anchor the sprint before the work moves.</h1>
                        <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
                            A sprint-level mini-dashboard for the goal, 3P posture, accountability, and placeholder progress signals.
                        </p>
                    </div>
                    <Link
                        to="/pro/execution/operate"
                        className="inline-flex w-fit items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                    >
                        Open tracker
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="overflow-hidden lg:col-span-2" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="p-6" style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)' }}>
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-3xl">
                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                    <span className="font-mono rounded-[var(--radius-xs)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' }}>
                                        {sprint.quarter}
                                    </span>
                                    <span className="font-mono rounded-[var(--radius-xs)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: 'var(--aos-success-tint)', color: 'var(--aos-success)' }}>
                                        {sprint.status}
                                    </span>
                                </div>
                                <h2 className="aos-h2" style={{ color: 'var(--fg-on-dark)' }}>{sprint.name}</h2>
                                <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--aos-steel-blue)' }}>
                                    <Clock3 className="h-4 w-4" style={{ color: 'var(--aos-brass-soft)' }} />
                                    {sprint.dates} · <span className="font-mono">{sprint.daysRemaining}</span> days remaining
                                </p>
                            </div>
                            <div className="rounded-[var(--radius-xs)] px-4 py-3" style={{ border: '1px solid var(--aos-slate-blue)' }}>
                                <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass-soft)' }}>Sprint Theme</div>
                                <p className="text-sm italic leading-relaxed" style={{ color: 'var(--fg-on-dark)' }}>
                                    "{sprint.theme}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-b-[var(--radius-xs)]">
                        <div className="flex items-center gap-2 px-6 py-3" style={{ background: 'var(--bg-sunken)', borderTop: 'var(--border-hairline)', borderBottom: 'var(--border-hairline)' }}>
                            <Flag className="h-4 w-4" style={{ color: 'var(--aos-brass)' }} />
                            <div className="aos-eyebrow">Sprint Goal</div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', borderLeft: '4px solid var(--aos-brass)', border: 'var(--border-hairline)', borderLeftWidth: '4px', borderLeftColor: 'var(--aos-brass)', boxShadow: 'var(--shadow-soft-2)' }}>
                                <p className="text-lg font-semibold leading-relaxed" style={{ color: 'var(--fg-1)' }}>{sprint.goal}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <p className="aos-eyebrow px-1 pb-1 md:col-span-2" style={{ color: 'var(--fg-3)' }}>Supporting outcomes</p>
                                {sprint.supportingOutcomes.map((outcome) => (
                                    <div key={outcome} className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                        <p className="aos-small">{outcome}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="mb-4 flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                        <div className="aos-eyebrow">Progress Signal</div>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <div className="mb-2 flex items-center justify-between text-sm font-medium" style={{ color: 'var(--fg-2)' }}>
                                <span>Completion</span>
                                <span className="font-mono">38%</span>
                            </div>
                            <ProgressBar value={38} max={100} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="rounded-[var(--radius-xs)] p-3" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                <div className="font-mono text-2xl font-semibold" style={{ color: 'var(--fg-1)' }}>9</div>
                                <div className="aos-eyebrow mt-1">Initiatives</div>
                            </div>
                            <div className="rounded-[var(--radius-xs)] p-3" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                <div className="font-mono text-2xl font-semibold" style={{ color: 'var(--fg-1)' }}>42</div>
                                <div className="aos-eyebrow mt-1">Milestones</div>
                            </div>
                            <div className="rounded-[var(--radius-xs)] p-3" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                <div className="font-mono text-2xl font-semibold" style={{ color: 'var(--aos-warning)' }}>1</div>
                                <div className="aos-eyebrow mt-1">Blocker</div>
                            </div>
                            <div className="rounded-[var(--radius-xs)] p-3" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                <div className="font-mono text-2xl font-semibold" style={{ color: 'var(--aos-success)' }}>4</div>
                                <div className="aos-eyebrow mt-1">Owners</div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <section className="space-y-4">
                <div>
                    <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>3P At-a-Glance</div>
                    <h2 className="aos-h3">Capability posture and initiative shape</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {threeP.map((item, index) => (
                        <Card key={item.label} className="p-5" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-semibold" style={{ background: index === 0 ? 'var(--aos-brass)' : 'var(--bg-sunken)', color: index === 0 ? 'var(--aos-cloud)' : 'var(--fg-3)', border: index === 0 ? '1px solid var(--aos-brass)' : 'var(--border-hairline)' }}>
                                        {index + 1}
                                    </span>
                                    <div className="font-mono rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={postureStyles[index]}>{item.label}</div>
                                </div>
                                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--fg-3)' }}>{item.initiatives} initiatives</span>
                            </div>
                            <h3 className="aos-h3">{item.focus}</h3>
                            <p className="aos-small mt-3">{item.description}</p>
                        </Card>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                        <div className="aos-eyebrow">Owners / Accountability</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {owners.map((owner) => (
                            <div key={owner.name} className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>{owner.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--fg-3)' }}>{owner.role} · {owner.scope}</p>
                                    </div>
                                    <span className="font-mono text-sm font-semibold" style={{ color: 'var(--aos-brass)' }}>
                                        {owner.initiatives}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="mb-4 flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                        <div className="aos-eyebrow">Operate Quick Links</div>
                    </div>
                    <p className="aos-small mb-5">
                        Jump from the sprint-level synthesis into the work surface when you need to update progress or resolve support needs.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link to="/pro/execution/operate" className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors" style={{ background: 'transparent', color: 'var(--fg-2)', border: 'var(--border-hairline)' }}>
                            Open status tracker
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                        <Link to="/pro/execution/operate" className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors" style={{ background: 'transparent', color: 'var(--fg-2)', border: 'var(--border-hairline)' }}>
                            Review blockers
                            <CheckCircle2 className="ml-2 h-4 w-4" />
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
};
