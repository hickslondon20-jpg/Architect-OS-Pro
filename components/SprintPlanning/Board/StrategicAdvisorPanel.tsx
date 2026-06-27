import React from 'react';
import { Card } from '../../ui';
import { X, ArrowRight, Sparkles } from 'lucide-react';

export type AdvisorContextLevel = 'board' | 'capability' | 'initiative' | 'milestone';

interface StrategicAdvisorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    contextLevel: AdvisorContextLevel;
    contextName?: string; // Optional name of the specific item we're looking at
}

export const StrategicAdvisorPanel: React.FC<StrategicAdvisorPanelProps> = ({
    isOpen,
    onClose,
    contextLevel,
    contextName
}) => {

    // Dynamic content generation based on current context
    const getContextData = () => {
        switch (contextLevel) {
            case 'board':
                return {
                    title: 'Board View Workspace',
                    greeting: 'Welcome to Sprint Planning',
                    body: 'I see your full 3P classification across the 9 slots. I can help translate your high-priority capability gaps into actionable 90-day initiatives.',
                    suggestions: [
                        'Help me translate my Prioritize capabilities into initiatives',
                        'What does focusing on these areas imply for my quarter?'
                    ]
                };
            case 'capability':
                return {
                    title: `Capability: ${contextName || 'Selected'}`,
                    greeting: 'Capability Workspace',
                    body: `I have context on the "${contextName || 'current'}" capability, including its maturity audit score and specific checkpoint gaps. I can help brainstorm initiatives to close these gaps.`,
                    suggestions: [
                        `Suggest 3 initiatives to improve ${contextName || 'this area'}`,
                        'What is the standard "good" state for this capability?'
                    ]
                };
            case 'initiative':
                return {
                    title: `Initiative: ${contextName || 'Selected'}`,
                    greeting: 'Initiative Workspace',
                    body: `I'm viewing the details for "${contextName || 'this initiative'}". I can help you draft a high-quality definition of done or break this down into monthly milestones.`,
                    suggestions: [
                        'Help me write a stronger "What Success Looks Like" definition',
                        'Suggest 3-4 milestones to get this done in the next 90 days'
                    ]
                };
            case 'milestone':
                return {
                    title: `Milestone: ${contextName || 'Selected'}`,
                    greeting: 'Milestone Execution',
                    body: `I'm tracking "${contextName || 'this milestone'}". If you hit a roadblock, I can suggest workarounds or help rewrite the scope to be more achievable.`,
                    suggestions: [
                        'I am blocked on this. Help me figure out a workaround.',
                        'What are the common risks for a milestone like this?'
                    ]
                };
            default:
                return {
                    title: 'Strategic Advisor',
                    greeting: 'How can I help?',
                    body: 'I am your co-pilot for Sprint Planning.',
                    suggestions: ['What should I focus on first?']
                };
        }
    };

    const ctx = getContextData();

    return (
        <>
            {/* Slide-over Panel */}
            <div
                className={`fixed inset-y-0 right-0 z-[100] w-80 transform border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)] shadow-2xl transition-transform duration-300 ease-in-out lg:w-96 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[var(--aos-brass)]" />
                        <div>
                            <h3 className="font-bold leading-tight text-[var(--fg-1)]">Strategic Advisor</h3>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-3)]">{ctx.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                        aria-label="Close Strategic Advisor"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Chat History Area */}
                <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-140px)]">
                    {/* Welcome / Context Card */}
                    <Card className="border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)]">
                                <Sparkles className="h-4 w-4 text-[var(--aos-brass)]" />
                            </div>
                            <div>
                                <h4 className="mb-1 text-sm font-bold text-[var(--fg-1)]">{ctx.greeting}</h4>
                                <p className="text-xs leading-relaxed text-[var(--fg-2)]">
                                    {ctx.body}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Footer Input Area */}
                <div className="absolute bottom-0 left-0 w-full border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col gap-3">
                        {/* Suggestion Pills */}
                        <div className="flex flex-wrap gap-2">
                            {ctx.suggestions.map((suggestion, i) => (
                                <button key={i} className="rounded-full border border-[var(--aos-mist)] px-3 py-1.5 text-left text-xs leading-tight text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--aos-brass)]">
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Message Advisor..."
                                className="w-full rounded-[var(--radius-xs)] border-[var(--aos-mist)] bg-[var(--bg-canvas)] py-2.5 pr-10 text-sm text-[var(--fg-1)] transition-colors placeholder-[var(--fg-3)] focus:border-[var(--aos-brass)] focus:bg-[var(--bg-surface)] focus:ring-[var(--aos-brass)]"
                            />
                            <button className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[var(--radius-xs)] bg-[var(--aos-brass)] p-1.5 text-[var(--fg-on-dark)] transition-colors hover:bg-[var(--aos-brass-soft)]" aria-label="Send advisor message">
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Optional Overlay when open on small screens, omitted currently to allow side-by-side on desktop */}
        </>
    );
};
