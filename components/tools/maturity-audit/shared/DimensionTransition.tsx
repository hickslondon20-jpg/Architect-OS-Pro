import React from 'react';
import { Card, Button } from '../../../ui';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { GMTransitionScreen } from '../../../../lib/gm-audit';

interface DimensionTransitionProps {
    data: GMTransitionScreen;
    onContinue: () => void;
}

export const DimensionTransition: React.FC<DimensionTransitionProps> = ({ data, onContinue }) => {
    return (
        <div className="max-w-2xl mx-auto py-12">
            <Card className="p-8 border-[var(--aos-mist)] shadow-[var(--shadow-soft-2)] text-center bg-[var(--bg-surface)] relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[var(--aos-brass)]" />

                <div className="mb-8 flex justify-center">
                    <div className="h-20 w-20 bg-[var(--aos-success-tint)] rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
                        <CheckCircle className="h-10 w-10 text-[var(--aos-success)]" />
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-[var(--fg-1)] mb-2">
                        Dimension {data.completedDimension} Complete!
                    </h2>
                    <p className="text-lg font-medium text-[var(--fg-1)] mb-4">
                        {data.completedName}
                    </p>
                    <p className="text-[var(--fg-2)] max-w-lg mx-auto leading-relaxed">
                        {data.completedSummary}
                    </p>
                </div>

                <div className="h-px bg-[var(--aos-mist)] w-full my-8" />

                <div className="bg-[var(--bg-sunken)] rounded-xl p-6 mb-8 text-left border border-[var(--aos-mist)]">
                    <p className="text-xs uppercase tracking-wider font-semibold text-[var(--fg-3)] mb-2">
                        COMING UP NEXT
                    </p>
                    <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">
                        Dimension {data.nextDimension}: {data.nextName}
                    </h3>
                    <p className="text-[var(--fg-2)]">
                        {data.nextPreview}
                    </p>
                </div>

                <Button
                    size="lg"
                    onClick={onContinue}
                    className="bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)] min-w-[200px]"
                >
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Card>
        </div>
    );
};
