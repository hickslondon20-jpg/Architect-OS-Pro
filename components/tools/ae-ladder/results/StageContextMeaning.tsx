import React from 'react';
import { Card } from '../../../ui';
import { AEStageContextRow } from '../types';

interface StageContextMeaningProps {
    context: AEStageContextRow;
}

export const StageContextMeaning: React.FC<StageContextMeaningProps> = ({ context }) => {
    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-[var(--fg-1)]">
                What It Means to Be {context.ae_frontend_stage}
            </h2>
            <h3 className="text-lg font-medium text-[var(--aos-brass)] mb-6">
                {context.ae_stage_tagline}
            </h3>
            <p className="text-base text-[var(--fg-2)] leading-relaxed whitespace-pre-wrap">
                {context.ae_stage_description}
            </p>
        </Card>
    );
};
