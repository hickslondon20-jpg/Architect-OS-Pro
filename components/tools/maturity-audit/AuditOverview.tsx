import React from 'react';
import { Card, Button } from '../../ui'; // Adjusted path to point to components/ui
import { ArrowRight, BarChart3, Target, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AuditOverview: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            <Card className="p-8 border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-[var(--fg-1)] mb-3">Maturity & Readiness Audit</h1>
                    <p className="text-lg text-[var(--fg-2)] max-w-2xl mx-auto">
                        A comprehensive evaluation of your agency's operational maturity across 125 capability checkpoints.
                    </p>
                </div>

                <div className="bg-[var(--bg-sunken)] rounded-xl p-8 mb-10 border border-[var(--aos-mist)]">
                    <h2 className="text-xl font-semibold text-[var(--fg-1)] mb-6 border-b border-[var(--aos-mist)] pb-4">
                        How This Assessment Works
                    </h2>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] rounded-lg shrink-0">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--fg-1)]">5 DIMENSIONS</h3>
                                <p className="text-[var(--fg-2)] mt-1">
                                    These are the same core areas from your AE Ladder Assessment: Financial Health, Client Positioning, Operations, Team Structure, and Strategic Stewardship.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] rounded-lg shrink-0">
                                <Target className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--fg-1)]">25 CAPABILITIES</h3>
                                <p className="text-[var(--fg-2)] mt-1">
                                    Each dimension contains 5 capability areas that represent key operational functions within that domain.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-[var(--aos-brass-tint)] text-[var(--aos-brass)] rounded-lg shrink-0">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--fg-1)]">125 CHECKPOINTS</h3>
                                <p className="text-[var(--fg-2)] mt-1">
                                    Each capability is evaluated through 5 specific proof points that measure your current state.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-10">
                    <h2 className="text-lg font-semibold text-[var(--fg-1)] mb-4">What to Expect</h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--fg-2)]">
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-3)]" />
                            25 screens (one per capability area)
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-3)]" />
                            5 checkpoints per screen
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-3)]" />
                            3-point scale: Yes / Somewhat / No
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-3)]" />
                            ~20-30 minutes to complete
                        </li>
                    </ul>
                    <p className="mt-4 text-sm text-[var(--fg-3)] italic">
                        You can pause and resume at any time. Your answers are saved after each screen.
                    </p>
                </div>

                <div className="flex justify-center">
                    <Button
                        size="lg"
                        className="bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] min-w-[240px] h-12 text-lg"
                        onClick={() => navigate('/diagnostics/mr-audit/assessment')}
                    >
                        Start Assessment <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </Card>
        </div>
    );
};
