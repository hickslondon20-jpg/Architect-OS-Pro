import React from 'react';
import { ArrowRight, Target } from 'lucide-react';
import { Button } from '../../ui';
import { useNavigate } from 'react-router-dom';

interface QuarterPostureBlockProps {
    synthesisText?: string;
    isGenerating?: boolean;
}

export const QuarterPostureBlock: React.FC<QuarterPostureBlockProps> = ({ synthesisText, isGenerating }) => {
    const navigate = useNavigate();

    return (
        <div
            className="mt-8 overflow-hidden rounded-[var(--radius-xs)] animate-in slide-in-from-bottom-5"
            style={{
                background: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                boxShadow: 'var(--shadow-soft-1)',
            }}
        >
            <div className="p-6 md:p-8">
                <div className="flex flex-col items-start gap-6 md:flex-row">
                    <div className="shrink-0">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)]">
                            <Target className="h-7 w-7 text-[var(--aos-brass)]" />
                        </div>
                    </div>

                    <div className="w-full flex-1 space-y-4">
                        <div>
                            <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">
                                Executive Synthesis
                            </div>
                            <h2 className="aos-h2">Your Quarter Posture</h2>
                        </div>

                        <div className="max-w-3xl text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                            {isGenerating ? (
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 w-full rounded bg-[var(--bg-sunken)]" />
                                    <div className="h-4 w-5/6 rounded bg-[var(--bg-sunken)]" />
                                    <div className="h-4 w-4/6 rounded bg-[var(--bg-sunken)]" />
                                </div>
                            ) : (
                                <p>{synthesisText || "Your quarter posture defines the rhythm of your execution. Based on your 3P selections, your focus is structurally aligned to drive immediate impact while protecting future growth vectors."}</p>
                            )}
                        </div>

                        {!isGenerating && (
                            <div className="pt-4">
                                <Button
                                    className="flex items-center border-none bg-[var(--aos-brass)] px-8 font-semibold text-[var(--aos-cloud)] hover:bg-[var(--aos-brass-soft)]"
                                    onClick={() => navigate('/pro/planning/sprint-planning')}
                                >
                                    Proceed to Sprint Planning
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <p className="mt-3 text-[var(--t-caption-size)] font-medium text-[var(--fg-3)]">
                                    Next up: Initialize your Sprint Board and define your execution Milestones.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
