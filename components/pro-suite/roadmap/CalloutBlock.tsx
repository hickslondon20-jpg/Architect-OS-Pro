import React from 'react';

interface CalloutBlockProps {
    title?: string;
    text?: string;
    children?: React.ReactNode;
}

export const CalloutBlock: React.FC<CalloutBlockProps> = ({ title, text, children }) => {
    return (
        <div className="my-5 rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] p-5 shadow-[var(--shadow-soft-1)]">
            {title && (
                <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">
                    {title}
                </div>
            )}
            <div className="text-[var(--t-small-size)] font-medium leading-[var(--t-small-lh)] text-[var(--fg-1)]">
                {text || children}
            </div>
        </div>
    );
};
