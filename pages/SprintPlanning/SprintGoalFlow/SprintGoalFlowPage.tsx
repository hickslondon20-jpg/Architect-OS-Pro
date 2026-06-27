import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Lock,
    Map,
    Plus,
    Sparkles,
    Target,
    X,
} from 'lucide-react';

const contextSummary = {
    stageName: 'Striving',
    stageDesc: 'Finding fit, fighting for margin, moving from project to process.',
    topCapabilities: ['Delivery Workflow', 'Client Satisfaction'],
    bottomCapabilities: ['Cash Flow Forecasting', 'Role Clarity'],
    visionStatement:
        'To become the undisputed category leader in sustainable brand packaging for CPG, known for strategic rigor and flawless execution.',
    visionTarget: '$2.5M run rate, 25% EBITDA, 4-person leadership team.',
};

const arcData = [
    {
        label: 'Q1 2026',
        theme: 'Foundation Building & Operational Systems',
        desc: ['Stabilize delivery', 'Financial visibility', 'Role clarity'],
        active: true,
    },
    {
        label: 'Q2 2026',
        theme: 'Sales Pipeline & Positioning Focus',
        desc: ['Outbound motion', 'ICP refinement', 'Case studies'],
        active: false,
    },
    {
        label: 'Q3 2026',
        theme: 'Team Expansion & Margin Protection',
        desc: ['Hire senior account lead', 'Pricing floor update'],
        active: false,
    },
    {
        label: 'Q4 2026',
        theme: 'Strategic Transition & Next Horizon Prep',
        desc: ['Leadership offsite', 'End-of-year review'],
        active: false,
    },
];

const derivedFocus = {
    label: 'Stabilize and create visibility',
    desc:
        'Focus on getting control of the core numbers, organizing delivery structures, and knowing exactly where the agency stands. You are buying yourself space to operate without anxiety.',
    exclusion: 'Growth experiments or bold market moves.',
};

const goodGoalExamples = [
    'We can see weekly cash, delivery capacity, and role ownership clearly enough to make operating decisions without founder guesswork.',
    'Our core delivery workflow runs from kickoff to closeout through a documented operating rhythm the team can repeat without heroic effort.',
];

const starterGoals = [
    'We have stabilized the delivery workflow so active client work moves through a visible, repeatable operating rhythm without founder-only coordination.',
    'We have clear financial and capacity visibility each week, giving the founder a reliable operating read before decisions become urgent.',
    'Role ownership is clear enough that delivery, client communication, and internal follow-through no longer depend on informal founder memory.',
];

const checklistItems = [
    'If this were the only thing we accomplished, would it be a meaningful win?',
    'Does this address a real pressure we identified in our diagnostic?',
    'Is this achievable in 12 weeks without heroic effort?',
    'Does this create momentum for the sprint that follows?',
];

interface ContextPanelProps {
    title: string;
    eyebrow: string;
    children: React.ReactNode;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ title, eyebrow, children }) => (
    <details className="group rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg-sunken)]">
            <div>
                <div className="aos-eyebrow mb-1 text-[var(--aos-brass)]">{eyebrow}</div>
                <h2 className="text-base font-semibold text-[var(--fg-1)]">{title}</h2>
            </div>
            <ChevronDown className="h-5 w-5 text-[var(--fg-3)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[var(--aos-mist)] px-5 py-5">{children}</div>
    </details>
);

export const SprintGoalFlowPage: React.FC = () => {
    const navigate = useNavigate();
    const [primaryGoal, setPrimaryGoal] = useState('');
    const [supportingOutcomes, setSupportingOutcomes] = useState<string[]>([]);
    const [checkedItems, setCheckedItems] = useState<string[]>([]);
    const canLock = primaryGoal.trim().length > 0;
    const canAddSupportingOutcome = supportingOutcomes.length < 2;

    const handleStarterSelect = (starter: string) => {
        setPrimaryGoal(starter);
    };

    const handleAddSupportingOutcome = () => {
        if (!canAddSupportingOutcome) return;
        setSupportingOutcomes([...supportingOutcomes, '']);
    };

    const handleSupportingOutcomeChange = (index: number, value: string) => {
        setSupportingOutcomes(outcomes => outcomes.map((outcome, i) => (i === index ? value : outcome)));
    };

    const handleRemoveSupportingOutcome = (index: number) => {
        setSupportingOutcomes(outcomes => outcomes.filter((_, i) => i !== index));
    };

    const handleChecklistToggle = (item: string) => {
        setCheckedItems(items => (items.includes(item) ? items.filter(i => i !== item) : [...items, item]));
    };

    const handleLock = () => {
        if (!canLock) return;
        navigate('/pro/planning/sprint-planning/prioritization');
    };

    return (
        <div className="space-y-8">
            <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-3xl">
                        <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">Sprint Planning / Sprint Goal</div>
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--fg-1)] md:text-3xl">
                            Decide the one operating change this sprint must make true.
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-[var(--fg-3)] md:text-base">
                            Current Quarter Focus already anchored the bigger readback. Use this page to set a clear
                            primary goal, optionally name a couple of supporting outcomes, and move into 3P
                            prioritization.
                        </p>
                    </div>
                    <div className="w-fit rounded-[var(--radius-full)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-4 py-2 text-sm font-semibold text-[var(--aos-brass)]">
                        Q1 2026
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div>
                    <div className="aos-eyebrow mb-1 text-[var(--aos-brass)]">Context</div>
                    <p className="text-sm text-[var(--fg-3)]">Available when useful. Collapsed by default.</p>
                </div>

                <ContextPanel eyebrow="Where you are" title="Context re-anchor">
                    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                        <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)]">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--fg-1)]">
                                <Activity className="h-4 w-4 text-[var(--aos-brass)]" />
                                Current stage
                            </div>
                            <p className="text-lg font-semibold text-[var(--fg-1)]">{contextSummary.stageName}</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--fg-3)]">{contextSummary.stageDesc}</p>
                        </div>

                        <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)]">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--fg-1)]">
                                <Map className="h-4 w-4 text-[var(--aos-brass)]" />
                                Where you are headed this year
                            </div>
                            <p className="border-l-2 border-[var(--aos-brass)] pl-4 text-sm italic leading-6 text-[var(--fg-2)]">
                                "{contextSummary.visionStatement}"
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-semibold text-[var(--fg-1)]">
                                <Sparkles className="h-4 w-4 text-[var(--aos-brass)]" />
                                {contextSummary.visionTarget}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--fg-3)]">Strengths</h3>
                            <ul className="space-y-2">
                                {contextSummary.topCapabilities.map(capability => (
                                    <li key={capability} className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--aos-success)]" />
                                        {capability}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--fg-3)]">Pressure areas</h3>
                            <ul className="space-y-2">
                                {contextSummary.bottomCapabilities.map(capability => (
                                    <li key={capability} className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--aos-risk)]" />
                                        {capability}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </ContextPanel>

                <ContextPanel eyebrow="Your four-sprint arc" title="The annual narrative">
                    <div className="grid gap-3 md:grid-cols-4">
                        {arcData.map(sprint => (
                            <div
                                key={sprint.label}
                                className={`rounded-[var(--radius-xs)] border p-4 ${
                                    sprint.active
                                        ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)]'
                                        : 'border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]'
                                }`}
                            >
                                <div className="mb-3 flex items-center gap-2">
                                    <CalendarDays
                                        className={`h-4 w-4 ${sprint.active ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}
                                    />
                                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--fg-3)]">
                                        {sprint.label}
                                    </span>
                                </div>
                                <h3 className="text-sm font-semibold leading-5 text-[var(--fg-1)]">{sprint.theme}</h3>
                                <ul className="mt-3 space-y-1.5">
                                    {sprint.desc.map(item => (
                                        <li key={item} className="text-xs leading-5 text-[var(--fg-3)]">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 text-xs italic text-[var(--fg-3)]">Hypothesis, not a plan</p>
                            </div>
                        ))}
                    </div>
                </ContextPanel>

                <ContextPanel eyebrow="This sprint's focus" title="Directional focus">
                    <div className="rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] p-5">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--fg-1)]">
                            <Target className="h-4 w-4 text-[var(--aos-brass)]" />
                            System-derived context
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--fg-1)]">{derivedFocus.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--fg-2)]">{derivedFocus.desc}</p>
                        <p className="mt-4 text-sm text-[var(--fg-3)]">
                            <span className="font-semibold text-[var(--fg-1)]">What this sprint is not about:</span>{' '}
                            {derivedFocus.exclusion}
                        </p>
                    </div>
                </ContextPanel>
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)]">
                    <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">What a good goal sounds like</div>
                    <h2 className="text-xl font-bold text-[var(--fg-1)]">Teach the shape before choosing the words.</h2>
                    <div className="mt-5 space-y-3">
                        {goodGoalExamples.map(example => (
                            <blockquote
                                key={example}
                                className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 text-sm italic leading-6 text-[var(--fg-2)] shadow-[var(--shadow-soft-1)]"
                            >
                                "{example}"
                            </blockquote>
                        ))}
                    </div>
                    <div className="mt-6 space-y-3 border-t border-[var(--aos-mist)] pt-5">
                        {[
                            'Outcome-focused, not activity-focused.',
                            'Describes a changed operating reality.',
                            'Specific enough to verify at the end of 12 weeks.',
                        ].map(item => (
                            <div key={item} className="flex gap-3 text-sm text-[var(--fg-2)]">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aos-brass)]" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)]">
                    <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">Starter goals for you</div>
                    <h2 className="text-xl font-bold text-[var(--fg-1)]">Pick one only to seed the editor.</h2>
                    <p className="mt-2 text-sm text-[var(--fg-3)]">These are placeholder starts. Selecting one does not lock it.</p>
                    <div className="mt-5 space-y-3">
                        {starterGoals.map((starter, index) => (
                            <button
                                key={starter}
                                type="button"
                                onClick={() => handleStarterSelect(starter)}
                                className="group w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)] p-4 text-left transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
                            >
                                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--aos-brass)]">
                                    Starter {index + 1}
                                </span>
                                <span className="text-sm leading-6 text-[var(--fg-2)] group-hover:text-[var(--fg-1)]">
                                    {starter}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">Your sprint goal</div>
                        <h2 className="text-xl font-bold text-[var(--fg-1)]">Primary goal</h2>
                    </div>
                    <span className="w-fit rounded-[var(--radius-full)] bg-[var(--bg-sunken)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">
                        Required
                    </span>
                </div>

                <label className="mt-6 block">
                    <span className="mb-2 block text-sm font-medium italic text-[var(--fg-2)]">
                        At the end of these 12 weeks, it will be true that...
                    </span>
                    <textarea
                        value={primaryGoal}
                        onChange={event => setPrimaryGoal(event.target.value)}
                        placeholder="We have reduced delivery time by 20% and established a standard operating rhythm..."
                        className="block min-h-[160px] w-full resize-none rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 text-base leading-7 text-[var(--fg-1)] shadow-[var(--shadow-soft-1)] placeholder:text-[var(--fg-4)] focus:border-[var(--aos-brass)] focus:outline-none focus:ring-2 focus:ring-[rgba(184,146,42,0.22)]"
                    />
                </label>
                {!canLock && (
                    <p className="mt-2 text-sm text-[var(--aos-risk)]">Add a primary goal before locking.</p>
                )}

                <div className="mt-8 border-t border-[var(--aos-mist)] pt-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-[var(--fg-1)]">Supporting outcomes</h3>
                            <p className="mt-1 text-sm text-[var(--fg-3)]">Optional. Add up to 2 for breadth.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddSupportingOutcome}
                            disabled={!canAddSupportingOutcome}
                            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:text-[var(--aos-brass)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Plus className="h-4 w-4" />
                            Add supporting outcome
                        </button>
                    </div>

                    <div className="mt-4 space-y-3">
                        {supportingOutcomes.map((outcome, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={outcome}
                                    onChange={event => handleSupportingOutcomeChange(index, event.target.value)}
                                    placeholder={`Supporting outcome ${index + 1}`}
                                    className="block w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:border-[var(--aos-brass)] focus:outline-none focus:ring-2 focus:ring-[rgba(184,146,42,0.22)]"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSupportingOutcome(index)}
                                    aria-label={`Remove supporting outcome ${index + 1}`}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-mist)] text-[var(--fg-3)] transition-colors hover:border-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {supportingOutcomes.length === 0 && (
                            <p className="rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-mist)] bg-[var(--bg-sunken)] px-4 py-5 text-sm text-[var(--fg-3)]">
                                No supporting outcomes added. That is fine; the primary goal is the success yardstick.
                            </p>
                        )}
                        {!canAddSupportingOutcome && (
                            <p className="text-xs font-medium text-[var(--fg-3)]">Maximum of 2 supporting outcomes reached.</p>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-[var(--aos-warning)]" />
                            <div className="aos-eyebrow text-[var(--aos-brass)]">Pre-lock gut-check</div>
                        </div>
                        <h2 className="text-xl font-bold text-[var(--fg-1)]">If you lock this, is it true?</h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--fg-3)]">
                            This checklist is advisory for now. Refine the goal if any answer feels weak.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLock}
                        disabled={!canLock}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-xs)] bg-[var(--aos-brass)] px-5 py-3 text-sm font-semibold text-[var(--fg-on-dark)] shadow-sm transition-colors hover:bg-[var(--aos-brass-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <Lock className="h-4 w-4" />
                        Lock Goal to 3P Prioritization
                    </button>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {checklistItems.map(item => {
                        const isChecked = checkedItems.includes(item);

                        return (
                            <label
                                key={item}
                                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-xs)] border p-4 transition-colors ${
                                    isChecked
                                        ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)]'
                                        : 'border-[var(--aos-mist)] bg-[var(--bg-sunken)] hover:border-[var(--aos-brass)]'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleChecklistToggle(item)}
                                    className="mt-0.5 h-4 w-4 rounded border-[var(--aos-mist)] text-[var(--aos-brass)] focus:ring-[var(--aos-brass)]"
                                />
                                <span className="text-sm leading-6 text-[var(--fg-2)]">{item}</span>
                            </label>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};
