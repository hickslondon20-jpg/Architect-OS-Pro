import React from 'react';
import { Link } from 'react-router-dom';

interface HorizonDeclarationCardProps {
    horizonLabel: string;
    targetDate: string;
    visionStatement: string | null;
    scenarioName?: string;
    scenarioTarget?: string;
    oneLineSynthesis?: string;
    vitals?: Array<{
        label: string;
        value: string | null;
    }>;
    refinementHref: string;
}

export const HorizonDeclarationCard: React.FC<HorizonDeclarationCardProps> = ({
    horizonLabel,
    targetDate,
    visionStatement,
    scenarioName,
    scenarioTarget,
    oneLineSynthesis,
    vitals = [],
    refinementHref
}) => {
    return (
        <div
            className="flex flex-col gap-4 rounded-[var(--radius-xs)] p-5"
            style={{
                background: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                boxShadow: 'var(--shadow-soft-1)',
            }}
        >
            <div className="flex items-center justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--aos-mist)' }}>
                <h3 className="aos-h3">{horizonLabel}</h3>
                <span className="aos-caption font-medium">{targetDate}</span>
            </div>

            {visionStatement ? (
                <>
                    <div className="aos-body" style={{ color: 'var(--fg-2)' }}>
                        {visionStatement}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {scenarioName && (
                            <span
                                className="inline-flex items-center rounded-[var(--radius-xs)] px-2.5 py-1 text-xs font-medium"
                                style={{ background: 'var(--bg-sunken)', color: 'var(--fg-2)', border: 'var(--border-hairline)' }}
                            >
                                {scenarioName} {scenarioTarget && `(${scenarioTarget})`}
                            </span>
                        )}
                    </div>

                    {vitals.length > 0 && (
                        <div className="rounded-[var(--radius-xs)] p-3" style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}>
                            <div className="aos-eyebrow mb-3">Key Vitals</div>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                {vitals.map((vital) => (
                                    <div key={vital.label} className="border-r px-2 last:border-r-0 md:first:pl-0" style={{ borderColor: 'var(--aos-mist)' }}>
                                        <div className="min-h-[22px] text-base font-semibold leading-tight" style={{ color: 'var(--fg-1)' }}>
                                            {vital.value || <span style={{ color: 'var(--fg-4)' }}>-</span>}
                                        </div>
                                        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--fg-3)' }}>
                                            {vital.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {oneLineSynthesis && (
                        <div className="aos-small mt-1 italic">
                            "{oneLineSynthesis}"
                        </div>
                    )}

                    <div className="pt-2 text-right">
                        <Link to={refinementHref} className="text-xs transition-colors hover:underline" style={{ color: 'var(--aos-brass)' }}>
                            Not what you intended? Refine your vision in the Clarity Compass &rarr;
                        </Link>
                    </div>
                </>
            ) : (
                <div className="aos-small py-2 italic">
                    No vision defined for this horizon yet.{' '}
                    <Link to={refinementHref} className="not-italic underline underline-offset-2" style={{ color: 'var(--aos-brass)' }}>
                        Define it in the Clarity Compass &rarr;
                    </Link>
                </div>
            )}
        </div>
    );
};
