import React from 'react';
import { Link } from 'react-router-dom';

interface UltimateVisionBlockProps {
    text: string | null;
    isDraft?: boolean;
}

export const UltimateVisionBlock: React.FC<UltimateVisionBlockProps> = ({ text, isDraft }) => {
    return (
        <div
            className="my-6 rounded-[var(--radius-xs)] p-5"
            style={{
                background: 'var(--aos-brass-tint)',
                border: 'var(--border-accent)',
                boxShadow: 'var(--shadow-soft-1)',
            }}
        >
            <div className="aos-eyebrow mb-3 flex items-center justify-between" style={{ color: 'var(--aos-brass)' }}>
                <span>Ultimate Vision</span>
                {isDraft && (
                    <span
                        className="rounded-full px-2 py-0.5 text-[10px] lowercase tracking-normal"
                        style={{ background: 'var(--bg-surface)', color: 'var(--aos-brass)', border: 'var(--border-accent)' }}
                    >
                        Draft
                    </span>
                )}
            </div>
            <div className="aos-body font-medium" style={{ color: text ? 'var(--fg-1)' : 'var(--fg-3)', fontStyle: text ? 'normal' : 'italic' }}>
                {text ? (
                    text
                ) : (
                    <span>
                        No ultimate vision defined yet.{' '}
                        <Link to="/foundations/clarity-compass" className="not-italic underline underline-offset-2" style={{ color: 'var(--aos-brass)' }}>
                            Define it in the Clarity Compass &rarr;
                        </Link>
                    </span>
                )}
            </div>
        </div>
    );
};
