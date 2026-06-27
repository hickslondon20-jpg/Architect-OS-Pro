import React, { useState } from 'react';
import { Archive, Download, FileText, Megaphone, Play, Users } from 'lucide-react';
import { Card } from '../../components/ui';

const sprintGoal = 'We have stabilized our delivery floor by standardizing core processes, allowing us to manage current volume without daily founder intervention.';

const summaryParagraphs = [
    "We are entering this quarter fully stretched. Our current volume has exposed fractures in how we deliver, pulling founder attention daily into operational firefighting. This sprint is not about aggressive expansion; it's about stabilizing the floor we currently stand on so we can confidently step up in Q2.",
    "Our plan focuses heavily on the Operations and Team Leadership arenas. By prioritizing the creation of a Client Onboarding Playbook and finalizing our Standard Operating Procedures library, we aim to remove the subjective guesswork from week-to-week delivery.",
    "Success this quarter looks boring in the best possible way. It looks like a quiet delivery floor, predictable margins, and founders who are managing the system, not the tasks within it.",
];

const planSections = [
    {
        label: 'Prioritize',
        subtitle: 'Active execution',
        focus: 'Operations: Process Standardization',
        initiatives: ['Finalize Standard Operating Procedure Matrix', 'Implement Client Onboarding Playbook'],
        owner: 'S. Hicks',
    },
    {
        label: 'Plant',
        subtitle: 'Building foundation',
        focus: 'Financial Stewardship',
        initiatives: ['Draft specs for internal automation dashboard', 'Review Q2 tooling spend audit'],
        owner: 'D. Kim',
    },
    {
        label: 'Progressively Iterate',
        subtitle: 'Maintain',
        focus: 'Client Success + Positioning',
        initiatives: ['Run bi-weekly account reviews', 'Maintain reduced publishing schedule'],
        owner: 'E. Rostova',
    },
];

const postureStyles = [
    { background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' },
    { background: 'var(--aos-brass-tint)', color: 'var(--aos-brass)' },
    { background: 'var(--aos-success-tint)', color: 'var(--aos-success)' },
];

export const OrientAlignmentPage: React.FC = () => {
    const [view, setView] = useState<'current' | 'historic'>('current');

    return (
        <div className="space-y-7 pb-16">
            <div className="flex flex-col gap-3">
                <div className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>Alignment Tools & Resources</div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="aos-h1">Package the sprint for team alignment.</h1>
                        <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
                            A shareable one-pager now, with a reserved home for historic sprint artifacts and future alignment tools.
                        </p>
                    </div>
                    <div className="inline-flex w-fit rounded-[var(--radius-xs)] p-1" style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}>
                        {(['current', 'historic'] as const).map((option) => {
                            const isActive = view === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setView(option)}
                                    className="rounded-[var(--radius-xs)] px-4 py-2 text-sm font-medium capitalize transition-colors"
                                    style={{
                                        background: isActive ? 'var(--aos-brass)' : 'transparent',
                                        color: isActive ? 'var(--aos-cloud)' : 'var(--fg-3)',
                                    }}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                <div className="p-6" style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)' }}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass-soft)' }}>Alignment Record</div>
                            <h2 className="aos-h2" style={{ color: 'var(--fg-on-dark)' }}>One source of truth for the sprint story.</h2>
                        </div>
                        <p className="max-w-md text-sm leading-relaxed" style={{ color: 'var(--aos-steel-blue)' }}>
                            The current one-pager is built for team alignment; historic artifacts stay preserved once multiple sprints exist.
                        </p>
                    </div>
                </div>
            </Card>

            {view === 'current' ? (
                <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="mx-auto flex max-w-4xl flex-col gap-8">
                        <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-start md:justify-between" style={{ borderColor: 'var(--aos-mist)' }}>
                            <div>
                                <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>Current Sprint One-Pager</div>
                                <h2 className="aos-h2">Sprint 1: Delivery Floor Stabilization</h2>
                                <p className="aos-small mt-3">Q1 2026 · Jan 1 - Mar 31, 2026 · Locked Jan 1, 2026 at 9:00 AM</p>
                            </div>
                            <button
                                type="button"
                                className="inline-flex w-fit cursor-not-allowed items-center justify-center rounded-md px-4 py-2 text-sm font-medium opacity-90"
                                style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                                aria-disabled="true"
                                title="Export will use the N8N + Google Docs pipeline later."
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </button>
                        </div>

                        <section className="overflow-hidden rounded-[var(--radius-xs)]" style={{ border: 'var(--border-hairline)' }}>
                            <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'var(--bg-sunken)', borderBottom: 'var(--border-hairline)' }}>
                                <div className="aos-eyebrow">Sprint Goal</div>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', borderLeft: '4px solid var(--aos-brass)', border: 'var(--border-hairline)', borderLeftWidth: '4px', borderLeftColor: 'var(--aos-brass)', boxShadow: 'var(--shadow-soft-2)' }}>
                                    <p className="text-lg font-semibold leading-relaxed" style={{ color: 'var(--fg-1)' }}>{sprintGoal}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <p className="aos-eyebrow px-1 pb-1 md:col-span-2" style={{ color: 'var(--fg-3)' }}>Supporting outcomes</p>
                                    <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                        <p className="aos-small">Client onboarding can run consistently without founder rescue.</p>
                                    </div>
                                    <div className="rounded-[var(--radius-xs)] p-4" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                        <p className="aos-small">Operating standards become visible enough for weekly team ownership.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="aos-eyebrow mb-3" style={{ color: 'var(--aos-brass)' }}>Sprint Theme</div>
                            <p className="text-xl italic leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                                "Establishing the bedrock for scalable delivery."
                            </p>
                        </section>

                        <section>
                            <div className="mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                                <div className="aos-eyebrow">Executive Summary</div>
                            </div>
                            <div className="space-y-4">
                                {summaryParagraphs.map((paragraph) => (
                                    <p key={paragraph} className="aos-body leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                                <div className="aos-eyebrow">3P Execution Plan</div>
                            </div>
                            <div className="space-y-4">
                                {planSections.map((section, index) => (
                                    <div key={section.label} className="rounded-[var(--radius-xs)] p-5" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span className="font-mono rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={postureStyles[index]}>{section.label}</span>
                                                    <span className="aos-small">{section.subtitle}</span>
                                                </div>
                                                <h3 className="aos-h3">{section.focus}</h3>
                                            </div>
                                            <span className="font-mono rounded-[var(--radius-xs)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: 'var(--aos-insight-tint)', color: 'var(--aos-insight)' }}>
                                                Owner: {section.owner}
                                            </span>
                                        </div>
                                        <ul className="space-y-2">
                                            {section.initiatives.map((initiative) => (
                                                <li key={initiative} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fg-2)' }}>
                                                    <Play className="mt-1 h-3 w-3 shrink-0" style={{ color: 'var(--aos-brass)' }} />
                                                    <span>{initiative}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </Card>
            ) : (
                <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                    <div className="flex flex-col gap-6">
                        <div>
                            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>Historic Sprint Artifacts</div>
                            <h2 className="aos-h2">Past one-pagers will live here.</h2>
                            <p className="aos-small mt-3 max-w-2xl">
                                Available after you've run multiple sprints. This shell reserves the archive browser without adding historical data wiring.
                            </p>
                        </div>

                        <div className="overflow-hidden rounded-[var(--radius-xs)]" style={{ border: 'var(--border-hairline)' }}>
                            <div className="grid grid-cols-4 gap-4 px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}>
                                <span>Sprint</span>
                                <span>Quarter</span>
                                <span>Dates</span>
                                <span>Outcome</span>
                            </div>
                            <div className="flex min-h-56 flex-col items-center justify-center gap-4 px-6 py-12 text-center" style={{ background: 'var(--bg-surface)' }}>
                                <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--bg-sunken)' }}>
                                    <Archive className="h-7 w-7" style={{ color: 'var(--fg-3)' }} />
                                </div>
                                <div>
                                    <h3 className="aos-h3">No historic sprint artifacts yet</h3>
                                    <p className="aos-small mt-2 max-w-md">
                                        Once multiple sprints are completed, archived one-pagers can be browsed and downloaded from this table.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <Card className="p-5" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-xs)]" style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}>
                            <Megaphone className="h-5 w-5" style={{ color: 'var(--aos-brass)' }} />
                        </div>
                        <div>
                            <div className="aos-eyebrow mb-1">Future Alignment Tools</div>
                            <p className="aos-small">Coming: comms planning, team buy-in support, and launch-readiness resources.</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
