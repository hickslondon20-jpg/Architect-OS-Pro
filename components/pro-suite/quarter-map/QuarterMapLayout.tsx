import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Lock } from 'lucide-react';

const steps = [
    {
        id: 1,
        label: 'Orientation',
        path: '/pro/planning/roadmap/orientation',
        locked: false
    },
    {
        id: 2,
        label: 'Horizon Declaration',
        path: '/pro/planning/roadmap/horizons',
        locked: false
    },
    {
        id: 3,
        label: 'Roadmap Review',
        path: '/pro/planning/roadmap/12-month-plan',
        locked: false
    }
];

export const QuarterMapLayout: React.FC = () => {
    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg-canvas)]">
            <div className="sticky top-0 z-50 px-4 py-4 sm:px-6 lg:px-10" style={{ background: 'var(--bg-canvas)' }}>
                <div
                    className="mx-auto flex max-w-[1600px] flex-col gap-4 rounded-[var(--radius-xs)] px-5 py-4"
                    style={{
                        background: 'var(--bg-surface)',
                        border: 'var(--border-hairline)',
                        boxShadow: 'var(--shadow-soft-1)',
                    }}
                >
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass)' }}>Planning & Strategy</div>
                            <span className="aos-h3">Strategic Roadmap</span>
                        </div>
                    </div>

                    <nav className="flex gap-3 overflow-x-auto" aria-label="Strategic roadmap steps">
                        {steps.map((step) => {
                            if (step.locked) {
                                return (
                                    <span
                                        key={step.id}
                                        className="flex min-w-fit items-center gap-3 rounded-[var(--radius-xs)] px-4 py-3 text-sm font-medium"
                                        style={{
                                            background: 'var(--bg-surface)',
                                            border: 'var(--border-hairline)',
                                            color: 'var(--fg-4)',
                                        }}
                                    >
                                        <span
                                            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                                            style={{ background: 'var(--bg-sunken)', color: 'var(--fg-4)' }}
                                        >
                                            {step.id}
                                        </span>
                                        {step.label}
                                        <Lock className="h-3.5 w-3.5" />
                                    </span>
                                );
                            }

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
                                            {step.label}
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-5 lg:px-10 py-8">
                <Outlet />
            </main>
        </div>
    );
};
