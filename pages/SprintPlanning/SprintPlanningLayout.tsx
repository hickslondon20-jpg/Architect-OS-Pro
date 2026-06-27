import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { KanbanSquare, Lock, ListChecks, Target } from 'lucide-react';

const steps = [
    {
        id: 1,
        label: 'Sprint Goal',
        path: '/pro/planning/sprint-planning/sprint-goal',
        icon: Target,
    },
    {
        id: 2,
        label: '3P Prioritization',
        path: '/pro/planning/sprint-planning/prioritization',
        icon: ListChecks,
    },
    {
        id: 3,
        label: 'Sprint Board',
        path: '/pro/planning/sprint-planning/board',
        icon: KanbanSquare,
    },
];

export const SprintPlanningLayout: React.FC = () => {
    const navigate = useNavigate();

    // MOCK STATE - Check if Quarter Map is finalized
    const isQuarterMapComplete = true; // Set to false to see the gate in action
    return (
        <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)]">
            <div className="sticky top-0 z-50 px-4 py-4 sm:px-6 lg:px-10" style={{ background: 'var(--bg-canvas)' }}>
                <div
                    className="mx-auto flex max-w-[1600px] flex-col gap-4 rounded-[var(--radius-xs)] px-5 py-4"
                    style={{
                        background: 'var(--bg-surface)',
                        border: 'var(--border-hairline)',
                        boxShadow: 'var(--shadow-soft-1)',
                    }}
                >
                    <div>
                        <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass)' }}>Planning & Strategy</div>
                        <span className="aos-h3">Sprint Planning</span>
                    </div>

                    <nav className="flex gap-3 overflow-x-auto" aria-label="Sprint planning steps">
                        {steps.map((step) => {
                            const Icon = step.icon;

                            return (
                                <NavLink
                                    key={step.id}
                                    to={step.path}
                                    className="group flex min-w-fit items-center gap-3 rounded-[var(--radius-xs)] px-4 py-3 text-sm font-medium transition-colors"
                                    style={({ isActive }) => ({
                                        background: isActive ? 'var(--aos-brass-tint)' : 'var(--bg-surface)',
                                        border: isActive ? 'var(--border-accent)' : 'var(--border-hairline)',
                                        color: isActive ? 'var(--aos-brass)' : 'var(--fg-3)',
                                    })}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <span
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors"
                                                style={{
                                                    background: isActive ? 'var(--aos-brass)' : 'var(--bg-sunken)',
                                                    color: isActive ? 'var(--aos-cloud)' : 'var(--fg-3)',
                                                }}
                                            >
                                                {step.id}
                                            </span>
                                            <Icon className="h-4 w-4" />
                                            {step.label}
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-5 lg:px-10">
                {isQuarterMapComplete ? (
                    <Outlet />
                ) : (
                    <div className="mx-auto mt-12 flex max-w-lg flex-col items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-12 text-center shadow-[var(--shadow-soft-1)]">
                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-sunken)]">
                            <Lock className="h-8 w-8 text-[var(--fg-3)]" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-[var(--fg-1)]">Quarter Map Required</h2>
                        <p className="mb-8 text-[var(--fg-3)]">
                            Sprint Planning requires a locked 12-month trajectory. You must evaluate your 9 growth capabilities and secure a Quarter Map before planning a sprint.
                        </p>
                        <button
                            onClick={() => navigate('/pro/planning/quarter-map')}
                            className="rounded-[var(--radius-xs)] bg-[var(--aos-brass)] px-6 py-3 font-medium text-[var(--fg-on-dark)] shadow-sm transition-colors hover:bg-[var(--aos-brass-soft)]"
                        >
                            Go to Quarter Map
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};
