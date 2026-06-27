import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface InlineQuickAddProps {
    placeholder?: string;
    onAdd: (value: string) => void;
}

export const InlineQuickAdd: React.FC<InlineQuickAddProps> = ({
    placeholder = '+ Quick Add...',
    onAdd
}) => {
    const [value, setValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.trim()) {
            onAdd(value.trim());
            setValue(''); // Clear on submit
        }
    };

    return (
        <div className="relative flex w-full items-center overflow-hidden rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] transition-all focus-within:border-[var(--aos-brass)] focus-within:ring-1 focus-within:ring-[var(--aos-brass)]">
            <div className="pl-3 pr-2 text-[var(--fg-3)]">
                <Plus className="w-4 h-4" />
            </div>
            <input
                type="text"
                className="flex-1 border-none bg-transparent py-3 pr-4 text-sm text-[var(--fg-1)] placeholder-[var(--fg-3)] focus:ring-0"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
};
