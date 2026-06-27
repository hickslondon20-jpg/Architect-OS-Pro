import React from 'react';
import { Card } from '../../ui';
import { X, Sparkles } from 'lucide-react';
import { StrategicAdvisorPanel, AdvisorContextLevel } from '../Board/StrategicAdvisorPanel';

interface UnifiedModalContainerProps {
    isOpen: boolean;
    onClose: () => void;
    leftPanelContent?: React.ReactNode;
    rightPanelContent?: React.ReactNode;
    breadcrumbContent?: React.ReactNode;
    advisorContext?: { level: AdvisorContextLevel; name?: string };
}

export const UnifiedModalContainer: React.FC<UnifiedModalContainerProps> = ({
    isOpen,
    onClose,
    leftPanelContent,
    rightPanelContent,
    breadcrumbContent,
    advisorContext
}) => {
    const [isAdvisorOpen, setIsAdvisorOpen] = React.useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[rgba(25,48,82,0.62)] backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <Card className="relative z-10 flex h-[85vh] w-full max-w-[1200px] flex-col overflow-hidden bg-[var(--bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header Bar */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--aos-mist)] px-6">
                    <div className="flex-1 flex items-center">
                        {breadcrumbContent || <div className="text-sm italic text-[var(--fg-3)]">Breadcrumb Zone Placeholder</div>}
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-full p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                        aria-label="Close workspace"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
                    {/* Left Workspace (~60%) */}
                    <div className="flex-1 overflow-y-auto border-b border-[var(--aos-mist)] p-8 no-scrollbar md:w-[60%] md:border-b-0 md:border-r">
                        {leftPanelContent || (
                            <div className="flex h-full flex-col items-center justify-center rounded-[var(--radius-xs)] border-2 border-dashed border-[var(--aos-mist)] text-[var(--fg-3)]">
                                <span className="font-semibold mb-2">Left Panel (Primary Content)</span>
                                <span className="text-sm italic">Placeholder Block</span>
                            </div>
                        )}
                    </div>

                    {/* Right Context Panel (~40%) */}
                    <div className="relative w-full overflow-y-auto bg-[var(--bg-canvas)] p-6 md:w-[40%]">
                        {rightPanelContent || (
                            <div className="flex h-full flex-col items-center justify-center rounded-[var(--radius-xs)] border-2 border-dashed border-[var(--aos-mist)] text-[var(--fg-3)]">
                                <span className="font-semibold mb-2">Right Panel (Metadata Content)</span>
                                <span className="text-sm italic">Placeholder Block</span>
                            </div>
                        )}
                    </div>

                    {/* Embedded Strategic Advisor Panel */}
                    <div className={`absolute top-0 right-0 h-full w-[400px] z-30 transition-transform duration-300 ease-in-out ${isAdvisorOpen ? 'translate-x-0 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]' : 'translate-x-full'}`}>
                        <StrategicAdvisorPanel
                            isOpen={isAdvisorOpen}
                            onClose={() => setIsAdvisorOpen(false)}
                            contextLevel={advisorContext?.level || 'board'}
                            contextName={advisorContext?.name}
                        />
                    </div>

                    {/* Bottom-right corner anchor zone for Strategic Advisor FAB */}
                    {!isAdvisorOpen && advisorContext && (
                        <div className="absolute bottom-6 right-6 z-20">
                            <button
                                onClick={() => setIsAdvisorOpen(true)}
                                className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aos-brass)] bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] shadow-lg transition-all hover:scale-105 hover:bg-[var(--aos-brass)]"
                                title="Open Strategic Advisor"
                                aria-label="Open Strategic Advisor"
                            >
                                <Sparkles className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
