import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';

interface QuarterData {
    id: string;
    label: string;
    isCurrent: boolean;
    focus: string;
    description: string;
    implications: string[];
}

const generateQuarters = (): QuarterData[] => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentQ = Math.floor(currentMonth / 3) + 1;
    const quarters: QuarterData[] = [];

    for (let i = 0; i < 4; i++) {
        let q = currentQ + i;
        let y = currentYear;

        if (q > 4) {
            q -= 4;
            y += 1;
        }

        const isCurrent = i === 0;
        let focus = '';
        let desc = '';
        let implications: string[] = [];

        if (i === 0) {
            focus = 'Foundation Building & Operational Systems';
            desc = 'This quarter emphasizes building the operational infrastructure needed for sustainable growth. Focus on stabilizing delivery.';
            implications = [
                'Establish documented delivery processes',
                'Implement cash flow forecasting systems',
                'Define clear team roles (Operations focus)'
            ];
        } else if (i === 1) {
            focus = 'Team Structure & Delegation Clarity';
            desc = 'With foundations set, shift focus to people. Clarify reporting lines and begin delegating lower-value tasks.';
            implications = [
                'Hire/Promote mid-level manager',
                'Refine performance review cadence',
                'Delegate client onboarding'
            ];
        } else if (i === 2) {
            focus = 'Strategic Positioning & Client Portfolio';
            desc = "Leverage your new capacity to upgrade the client base. Phase out legacy low-margin work.";
            implications = [
                "Launch new 'Enterprise' service tier",
                'Audit existing client profitability',
                'Initiate upsell campaigns'
            ];
        } else {
            focus = 'Scaling Systems & Operational Leverage';
            desc = 'Prepare for the next major growth spurt. Automate manual workflows and optimize margins.';
            implications = [
                'Implement PSA/ERP software upgrade',
                'optimize utilization rates',
                'Begin 24-month horizon planning'
            ];
        }

        quarters.push({
            id: `q-${y}-${q}`,
            label: `Q${q} ${y}`,
            isCurrent,
            focus,
            description: desc,
            implications
        });
    }

    return quarters;
};

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="aos-eyebrow text-[var(--aos-brass)]">{children}</div>
);

const QuarterlyAccordion: React.FC<{ quarter: QuarterData; isOpen: boolean; onToggle: () => void }> = ({ quarter, isOpen, onToggle }) => (
    <div className={`overflow-hidden rounded-[var(--radius-xs)] border transition-all duration-200 ${isOpen ? 'border-[var(--aos-brass-soft)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]' : 'border-[var(--aos-mist)] bg-[var(--bg-surface)]'}`}>
        <button
            type="button"
            onClick={onToggle}
            className="w-full p-4 text-left transition-colors hover:bg-[var(--bg-sunken)]"
        >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-5 w-5 text-[var(--aos-brass)]" /> : <ChevronRight className="h-5 w-5 text-[var(--fg-3)]" />}
                    <span className={`text-[var(--t-body-size)] font-semibold ${quarter.isCurrent ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}`}>
                        {quarter.label}
                    </span>
                    {quarter.isCurrent && (
                        <span className="rounded-[var(--radius-full)] bg-[var(--aos-success-tint)] px-2.5 py-1 text-[var(--t-caption-size)] font-medium text-[var(--aos-success)]">
                            Current Quarter
                        </span>
                    )}
                </div>
                <div className="text-[var(--t-caption-size)] font-medium text-[var(--fg-3)] sm:text-right">
                    Focus: <span className="text-[var(--fg-1)]">{quarter.focus}</span>
                </div>
            </div>
        </button>

        {isOpen && (
            <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] px-6 pb-6 pt-5">
                <div className="space-y-4">
                    <p className="text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                        {quarter.description}
                    </p>
                    <div>
                        <h4 className="aos-eyebrow mb-3 text-[var(--fg-3)]">Key Implications</h4>
                        <ul className="space-y-2">
                            {quarter.implications.map((imp) => (
                                <li key={imp} className="flex items-start gap-2 text-[var(--t-small-size)] text-[var(--fg-2)]">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aos-success)]" />
                                    <span>{imp}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        )}
    </div>
);

export const QuarterSequenceTab: React.FC = () => {
    const [quarters, setQuarters] = useState<QuarterData[]>([]);
    const [openQuarter, setOpenQuarter] = useState<string | null>(null);

    useEffect(() => {
        const generated = generateQuarters();
        setQuarters(generated);
        if (generated.length > 0) setOpenQuarter(generated[0].id);
    }, []);

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-16">
            <div className="mx-auto max-w-3xl space-y-3 text-center">
                <Eyebrow>Quarter Sequence</Eyebrow>
                <h1 className="aos-h1">Four quarters from the 12-month gap</h1>
                <p className="text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                    Based on your 12-month synthesis, here is how this year breaks into four focused sprints. Each quarter builds on the last - the sequencing is structural, not arbitrary.
                </p>
            </div>

            <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
                <div className="mb-6 flex items-center gap-3 border-b border-[var(--aos-mist)] pb-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <Eyebrow>Execution Sequencer</Eyebrow>
                        <h2 className="aos-h3 mt-1">Review the operating path</h2>
                    </div>
                </div>

                <div className="space-y-4">
                    {quarters.map((q) => (
                        <QuarterlyAccordion
                            key={q.id}
                            quarter={q}
                            isOpen={openQuarter === q.id}
                            onToggle={() => setOpenQuarter(openQuarter === q.id ? null : q.id)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};
