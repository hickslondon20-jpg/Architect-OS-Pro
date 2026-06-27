import React from 'react';
import { Button } from '../../../ui';
import { ArrowRight, Lock, Target } from 'lucide-react';
import { AEStageContextRow } from '../types';
import { useAuth } from '../../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NextMilestoneCTAProps {
    context: AEStageContextRow;
}

export const NextMilestoneCTA: React.FC<NextMilestoneCTAProps> = ({ context }) => {
    const { userDetails } = useAuth();
    const navigate = useNavigate();

    // User tier check (mocked based on context, adapt to actual tier field)
    const isPro = userDetails?.subscription_tier === 'pro';

    const isArriving = context.ae_frontend_stage === 'Arriving';

    return (
        <div className="p-8 rounded-lg shadow-[var(--shadow-soft-1)] border-none bg-[var(--bg-inverse)]" style={{ color: "var(--fg-on-dark)" }}>
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 text-[var(--aos-steel-blue)] font-medium mb-2">
                        <Target className="w-5 h-5" />
                        <span>Your Next Growth Milestone</span>
                    </div>

                    {isArriving ? (
                        <>
                            <h3 className="text-2xl font-bold text-[var(--fg-on-dark)]">
                                You've Arrived. Now What?
                            </h3>
                            <p className="text-[var(--aos-steel-blue)] leading-relaxed max-w-2xl">
                                You've reached the highest stage on the AE Ladder. From here, growth is a choice rather than a necessity. Focus on maintaining your powerful position, deciding whether to exit, step back, or explore entirely new horizons with the stability you've earned.
                            </p>
                        </>
                    ) : (
                        <>
                            <h3 className="text-2xl font-bold text-[var(--fg-on-dark)]">
                                Path to {context.next_ae_stage}
                            </h3>
                            {context.ae_next_stage_tagline && (
                                <p className="text-lg font-medium text-[var(--fg-on-dark)]">
                                    {context.ae_next_stage_tagline}
                                </p>
                            )}
                            <p className="text-[var(--aos-steel-blue)] leading-relaxed max-w-2xl mt-2">
                                {context.next_stage_description}
                            </p>
                        </>
                    )}
                </div>

                <div className="shrink-0 w-full md:w-auto p-6 bg-[var(--bg-surface)] rounded-lg border border-[var(--aos-mist)] text-center flex flex-col items-center justify-center min-w-[280px]">
                    <h4 className="font-semibold text-[var(--fg-1)] mb-2">
                        {isPro ? 'Access the Field Guide' : 'Unlock the Playbook'}
                    </h4>
                    <p className="text-sm text-[var(--fg-3)] mb-6 max-w-[220px]">
                        {isPro
                            ? 'Get the tactical steps to make this transition.'
                            : 'Upgrade to Pro for the step-by-step transition guide.'}
                    </p>

                    {isPro ? (
                        <Button
                            className="w-full gap-2 bg-[var(--bg-inverse)] hover:bg-[var(--aos-obsidian-hover)] text-[var(--fg-on-dark)]"
                            onClick={() => {
                                if (context.field_guide_url) {
                                    window.open(context.field_guide_url, '_blank');
                                } else {
                                    navigate('/library'); // Fallback route
                                }
                            }}
                        >
                            View Field Guide <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            variant="default"
                            className="w-full gap-2 bg-[var(--bg-inverse)] hover:bg-[var(--aos-obsidian-hover)] text-[var(--fg-on-dark)]"
                            onClick={() => navigate('/upgrade')}
                        >
                            <Lock className="w-4 h-4" /> Upgrade to Pro
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
