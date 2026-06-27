import React from 'react';
import { ArrowLeft, ArrowRight, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui'; // Assuming we have a Button component or using basic HTML button if ui folder is different. 
// Wait, checking ToolsPages.tsx (Step 33), it imports Button from '../components/ui'.
// So path from here (components/tools/ae-ladder) to components/ui is ../../ui.

interface NavigationControlsProps {
    isFirst: boolean;
    isLast: boolean;
    canNext: boolean;
    canSave: boolean;
    isSaved: boolean;
    onBack: () => void;
    onSave: () => void;
    onNext: () => void;
    onSubmit: () => void;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
    isFirst,
    isLast,
    canNext,
    canSave,
    isSaved,
    onBack,
    onSave,
    onNext,
    onSubmit,
}) => {
    return (
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto mt-8 px-2">
            <div className="flex-1 flex justify-start">
                <button
                    onClick={onBack}
                    disabled={isFirst}
                    className={`
            flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${isFirst
                            ? 'text-[var(--fg-4)] cursor-not-allowed'
                            : 'text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-sunken)]'
                        }
          `}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
            </div>

            <div className="flex-1 flex justify-center">
                <button
                    onClick={onSave}
                    disabled={!canSave}
                    className={`
            flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-full border transition-all duration-300
            ${isSaved
                            ? 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]'
                            : !canSave
                                ? 'text-[var(--fg-4)] border-[var(--aos-mist)] cursor-not-allowed'
                                : 'text-[var(--fg-2)] border-[var(--aos-mist)] hover:border-[var(--aos-brass)] hover:text-[var(--aos-brass)] bg-[var(--bg-surface)]'
                        }
          `}
                >
                    {isSaved ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Progress
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 flex justify-end">
                {isLast ? (
                    <button
                        onClick={onSubmit}
                        disabled={!canNext}
                        className={`
               flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-all
               ${!canNext
                                ? 'bg-[var(--bg-sunken)] text-[var(--fg-4)] cursor-not-allowed'
                                : 'bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)]'
                            }
             `}
                    >
                        Submit Assessment
                    </button>
                ) : (
                    <button
                        onClick={onNext}
                        disabled={!canNext}
                        className={`
              flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors
              ${!canNext
                                ? 'bg-[var(--bg-sunken)] text-[var(--fg-4)] cursor-not-allowed'
                                : 'bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] hover:bg-[var(--aos-obsidian-hover)]'
                            }
            `}
                    >
                        Next
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};
