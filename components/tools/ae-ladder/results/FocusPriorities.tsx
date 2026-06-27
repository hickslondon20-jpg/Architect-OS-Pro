import React from 'react';
import { Card } from '../../../ui';
import { CheckCircle2, Target, Zap, Loader2, ArrowRight } from 'lucide-react';

interface FocusPrioritiesProps {
    focusPoints: (string | null)[];
}

// Helper to parse "**Title:** Description" format
const parseFocusPoint = (text: string) => {
    // Looks for "**<title>**:" or "**<title>**" at the start
    const match = text.match(/^\*\*(.*?)\*\*:?\s*(.*)$/);
    if (match) {
        return {
            title: match[1].trim(),
            description: match[2].trim()
        };
    }
    // Fallback if not bolded
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0 && colonIndex < 50) {
        return {
            title: text.substring(0, colonIndex).trim(),
            description: text.substring(colonIndex + 1).trim()
        };
    }
    // Ultimate fallback
    return {
        title: "Strategic Focus",
        description: text
    };
};

const getRankIcon = (index: number) => {
    switch (index) {
        case 0: return <Target className="w-5 h-5 text-[var(--aos-brass)]" />;
        case 1: return <Zap className="w-5 h-5 text-[var(--aos-warning)]" />;
        case 2: return <CheckCircle2 className="w-5 h-5 text-[var(--aos-success)]" />;
        case 3: return <ArrowRight className="w-5 h-5 text-[var(--aos-insight)]" />;
        default: return <Target className="w-5 h-5 text-[var(--fg-3)]" />;
    }
};

export const FocusPriorities: React.FC<FocusPrioritiesProps> = ({ focusPoints }) => {
    // For the UI, we'll always show exactly 4 slots. If null, we show the loading state.
    const displayPoints = [...focusPoints];
    while (displayPoints.length < 4) {
        displayPoints.push(null);
    }
    const finalPoints = displayPoints.slice(0, 4);

    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-[var(--fg-1)]">Strategic Focus Priorities</h3>
                <p className="text-sm text-[var(--fg-3)]">The most critical leverage points to unlock your next level of growth.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {finalPoints.map((pointText, index) => {
                    if (!pointText) {
                        return (
                            <Card key={`loading-${index}`} className="p-6 border-t-4 border-t-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] flex flex-col items-center justify-center min-h-[140px] gap-3">
                                <Loader2 className="w-6 h-6 text-[var(--fg-4)] animate-spin" />
                                <span className="text-sm text-[var(--fg-3)] uppercase tracking-wider font-medium">Generating Priority {index + 1}...</span>
                            </Card>
                        );
                    }

                    const { title, description } = parseFocusPoint(typeof pointText === 'string' ? pointText : JSON.stringify(pointText));

                    return (
                        <Card key={index} className="p-6 border-t-4 border-t-[var(--aos-brass)] shadow-[var(--shadow-soft-1)] hover:shadow-[var(--shadow-soft-2)] transition-shadow">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-[var(--bg-sunken)] rounded-full">
                                    {getRankIcon(index)}
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg-3)]">Priority {index + 1}</span>
                            </div>

                            <h4 className="text-lg font-bold mb-3 text-[var(--fg-1)]">{title}</h4>

                            <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                                {description}
                            </p>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
};
