import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface EntryFormOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    saveLabel?: string;
    title: string;
    children: React.ReactNode;
}

export const EntryFormOverlay: React.FC<EntryFormOverlayProps> = ({
    isOpen,
    onClose,
    onSave,
    saveLabel = "Save",
    title,
    children
}) => {
    // Prevent background scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex mb-4 items-center justify-center sm:px-4" style={{ zIndex: 100 }}>
            {/* Dimmed backdrop - does NOT close on click per spec */}
            <div className="fixed inset-0 bg-[rgba(25,48,82,0.48)] backdrop-blur-sm transition-opacity" />

            {/* Modal Container */}
            <div
                className="relative mx-4 flex max-h-[80vh] w-full flex-col rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200 sm:mx-0 sm:w-[560px]"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--aos-mist)] px-6 py-4">
                    <h2 className="text-xl font-bold text-[var(--fg-1)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="-mr-2 rounded-full p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                    {children}
                </div>

                {/* Sticky Footer */}
                <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-[var(--radius-xs)] border-t border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-6 py-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--fg-2)] transition-colors hover:text-[var(--fg-1)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        className="rounded-[var(--radius-xs)] bg-[var(--bg-inverse)] px-6 py-2 text-sm font-medium text-[var(--fg-on-dark)] shadow-sm transition-colors hover:bg-[var(--aos-slate-blue)]"
                    >
                        {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
