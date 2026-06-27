import React from 'react';
import { Card } from '../../../ui';
import { AEStageContextRow } from '../types';

interface StageContextPositionProps {
    context: AEStageContextRow;
}

export const StageContextPosition: React.FC<StageContextPositionProps> = ({ context }) => {
    // Parse the JSONB themes array, fallback to empty array if null/invalid
    let themes: string[] = [];
    if (context.stage_key_themes) {
        try {
            themes = typeof context.stage_key_themes === 'string'
                ? JSON.parse(context.stage_key_themes)
                : context.stage_key_themes;
        } catch (e) {
            console.error('Failed to parse stage_key_themes', e);
        }
    }

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h2 className="text-xl font-bold tracking-tight text-[var(--fg-1)] mb-1">
                    {context.ae_backend_stage}
                </h2>
                <p className="text-sm font-medium text-[var(--fg-3)]">
                    {context.ae_stage_description_short}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Card className="p-6 h-full bg-[var(--bg-surface)] border-[var(--aos-mist)]">
                    <h3 className="text-base font-semibold text-[var(--fg-1)] mb-4">
                        Key Themes at This Stage
                    </h3>
                    {themes && themes.length > 0 ? (
                        <ul className="space-y-3">
                            {themes.map((theme, idx) => (
                                <li key={idx} className="flex gap-3 text-sm text-[var(--fg-2)] leading-relaxed">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--aos-brass)] shrink-0 mt-1.5" />
                                    <span>{theme}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-sm text-[var(--fg-3)] italic py-4">
                            Stage themes loading...
                        </div>
                    )}
                </Card>

                <Card className="p-6 h-full bg-[var(--bg-surface)] border-[var(--aos-mist)]">
                    <h3 className="text-base font-semibold text-[var(--fg-1)] mb-4">
                        Your Journey Context
                    </h3>
                    <div className="space-y-4">
                        <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                            {context.next_stage_description}
                        </p>

                        {context.stage_transition_quote && (
                            <div className="pt-4 border-t border-[var(--aos-mist)]">
                                <p className="text-sm text-[var(--fg-3)] leading-relaxed" style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }}>
                                    "{context.stage_transition_quote}"
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
