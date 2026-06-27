import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardCheck, RotateCcw, Sparkles } from 'lucide-react';

const tabs = [
    {
        id: 1,
        label: 'Wind-Down',
        path: '/pro/execution/reflect/wind-down',
        icon: ClipboardCheck,
    },
    {
        id: 2,
        label: 'Retrospective',
        path: '/pro/execution/reflect/retrospective',
        icon: RotateCcw,
    },
    {
        id: 3,
        label: 'Reflection & Review',
        path: '/pro/execution/reflect/reflection-review',
        icon: Sparkles,
    },
];

export const ExecutionReflectLayout: React.FC = () => {
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
                        <div className="aos-eyebrow mb-1" style={{ color: 'var(--aos-brass)' }}>Execution Hub</div>
                        <span className="aos-h3">Reflect</span>
                    </div>

                    <nav className="flex gap-3 overflow-x-auto" aria-label="Execution reflect steps">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
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
                                                {tab.id}
                                            </span>
                                            <Icon className="h-4 w-4" />
                                            {tab.label}
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-5 lg:px-10">
                <Outlet />
            </main>
        </div>
    );
};
