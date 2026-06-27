import React, { useState, useEffect } from 'react';
import { Label } from '../../ui';

interface AutoSaveFieldProps {
    id: string;
    label: string;
    supportingLabel?: React.ReactNode;
    value: string;
    placeholder?: string;
    type?: 'text' | 'textarea';
    rows?: number;
    optional?: boolean;
    onSave: (val: string) => Promise<void> | void;
}

export const AutoSaveField: React.FC<AutoSaveFieldProps> = ({
    id,
    label,
    supportingLabel,
    value: initialValue,
    placeholder,
    type = 'text',
    rows = 3,
    optional = false,
    onSave
}) => {
    const [value, setValue] = useState(initialValue);
    const [isDirty, setIsDirty] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        if (!isDirty) {
            setValue(initialValue);
        }
    }, [initialValue, isDirty]);

    const handleBlur = async () => {
        if (!isDirty || saveState === 'saving') return;

        setSaveState('saving');
        try {
            await onSave(value);
            setSaveState('saved');
            setIsDirty(false);

            setTimeout(() => {
                setSaveState(current => current === 'saved' ? 'idle' : current);
            }, 2000);
        } catch (e) {
            setSaveState('error');
            console.error('AutoSave failed:', e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(e.target.value);
        if (e.target.value !== initialValue) {
            setIsDirty(true);
            setSaveState('idle');
        } else {
            setIsDirty(false);
        }
    };

    return (
        <div className="relative">
            <div className="mb-1.5 flex items-baseline gap-2">
                <Label htmlFor={id} className="mb-0 text-[var(--fg-2)]">{label}</Label>
                {optional && <span className="text-xs font-normal italic text-[var(--fg-3)]">Optional</span>}

                <div className="ml-auto flex items-center gap-1.5 text-xs">
                    {isDirty && saveState === 'idle' && (
                        <span className="flex items-center gap-1 text-[var(--fg-3)] animate-in fade-in">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-3)]"></span> Unsaved
                        </span>
                    )}
                    {saveState === 'saving' && (
                        <span className="animate-pulse text-[var(--aos-insight)]">Saving...</span>
                    )}
                    {saveState === 'saved' && (
                        <span className="font-medium text-[var(--aos-success)] animate-in fade-in duration-300">Saved</span>
                    )}
                    {saveState === 'error' && (
                        <span className="flex items-center gap-1 font-medium text-[var(--aos-risk)] animate-in fade-in">
                            Save failed. <button onClick={handleBlur} className="underline">Try again</button>
                        </span>
                    )}
                </div>
            </div>

            {supportingLabel && (
                <p className="mb-2 text-xs text-[var(--fg-3)]">{supportingLabel}</p>
            )}

            {type === 'text' ? (
                <input
                    id={id}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className="w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-2.5 text-sm font-semibold text-[var(--fg-1)] transition-all focus:border-[var(--aos-brass)] focus:ring-1 focus:ring-[var(--aos-brass)]"
                />
            ) : (
                <textarea
                    id={id}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    rows={rows}
                    className="min-h-[80px] w-full resize-y rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-2.5 text-sm text-[var(--fg-2)] transition-all focus:border-[var(--aos-brass)] focus:ring-1 focus:ring-[var(--aos-brass)]"
                />
            )}
        </div>
    );
};
