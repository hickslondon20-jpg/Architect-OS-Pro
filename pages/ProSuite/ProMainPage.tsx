import React from 'react';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    Brain,
    Layout,
    Lightbulb,
    Map,
    PlayCircle,
    RefreshCw,
    Target,
    TrendingUp,
} from 'lucide-react';

const planningCards = [
    {
        label: 'Strategic Roadmap',
        description: 'Review horizons and shape the year.',
        href: '/pro/planning/roadmap',
        icon: Map,
    },
    {
        label: 'Quarter Map',
        description: 'Lock the 3P focus for this quarter.',
        href: '/pro/planning/quarter-map',
        icon: Target,
    },
    {
        label: 'Sprint Planning',
        description: 'Translate focus into execution.',
        href: '/pro/planning/sprint-planning',
        icon: PlayCircle,
    },
];

const executionCards = [
    {
        label: 'Orient',
        description: 'Launch the sprint with clarity and alignment.',
        href: '/pro/execution/orient',
        icon: Layout,
    },
    {
        label: 'Operate',
        description: 'Track progress and manage active initiatives.',
        href: '/pro/execution/operate',
        icon: TrendingUp,
    },
    {
        label: 'Reflect',
        description: 'Close the sprint and capture what you learned.',
        href: '/pro/execution/reflect',
        icon: RefreshCw,
    },
];

const intelligenceCards = [
    {
        label: 'Virtual CSO',
        description: 'AI-powered strategic advisor for your agency.',
        href: '/pro/intelligence/virtual-cso',
        icon: Brain,
        disabled: false,
    },
    {
        label: 'OS Engine',
        description: 'Uploads, synthesized knowledge, and your second brain.',
        href: '/pro/intelligence/os-engine',
        icon: Lightbulb,
        disabled: false,
    },
    {
        label: 'Reports & Insights',
        description: 'Synthesized performance reports and trend analysis.',
        href: null,
        icon: BookOpen,
        disabled: true,
    },
];

interface SubCardProps {
    label: string;
    description: string;
    href: string | null;
    icon: React.ElementType;
    disabled?: boolean;
}

const SubCard: React.FC<SubCardProps> = ({ label, description, href, icon: Icon, disabled }) => {
    const inner = (
        <div
            className="group rounded-[var(--radius-xs)] p-4 transition-colors h-full"
            style={{
                background: 'var(--bg-sunken)',
                border: 'var(--border-hairline)',
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            <div className="mb-3 flex items-center justify-between">
                <Icon className="h-5 w-5" style={{ color: disabled ? 'var(--fg-3)' : 'var(--aos-brass)' }} />
                {!disabled && (
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--aos-brass)' }} />
                )}
                {disabled && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--fg-3)', border: 'var(--border-hairline)' }}>
                        Soon
                    </span>
                )}
            </div>
            <h3 className="text-sm font-semibold" style={{ color: disabled ? 'var(--fg-3)' : 'var(--fg-1)' }}>{label}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--fg-3)' }}>{description}</p>
        </div>
    );

    if (disabled || !href) return <div>{inner}</div>;
    return <Link to={href}>{inner}</Link>;
};

interface HubCardProps {
    title: string;
    eyebrow?: string;
    description: string;
    subCards: SubCardProps[];
    ctaLabel?: string;
    ctaHref?: string;
}

const HubCard: React.FC<HubCardProps> = ({ title, eyebrow, description, subCards, ctaLabel, ctaHref }) => (
    <Card className="p-8 flex flex-col gap-6 h-full" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
                {eyebrow && <div className="aos-eyebrow mb-2">{eyebrow}</div>}
                <h2 className="aos-h3">{title}</h2>
                <p className="aos-small mt-2 max-w-xs">{description}</p>
            </div>
            {ctaLabel && ctaHref && (
                <Link
                    to={ctaHref}
                    className="inline-flex shrink-0 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors self-start"
                    style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                >
                    {ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            )}
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1">
            {subCards.map((card) => (
                <SubCard key={card.label} {...card} />
            ))}
        </div>
    </Card>
);

export const ProMainPage: React.FC = () => {
    return (
        <div className="space-y-8">
            {/* Navy hero banner — page header */}
            <div
                className="rounded-[var(--radius-xs)] p-8 md:p-10 relative overflow-hidden"
                style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', boxShadow: 'var(--shadow-soft-2)' }}
            >
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="aos-eyebrow mb-3" style={{ color: 'var(--aos-brass-soft)' }}>ArchitectOS Pro Suite</div>
                        <h1 className="aos-h1 mb-3" style={{ color: 'var(--fg-on-dark)' }}>Pro Suite Hub</h1>
                        <p className="max-w-2xl" style={{ color: 'var(--aos-sage-soft)', fontSize: 'var(--t-body-size)', lineHeight: 'var(--t-body-lh)' }}>
                            Your command center for strategic planning, execution, and intelligence.
                        </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-2 rounded-[var(--radius-xs)] px-4 py-3" style={{ background: 'var(--aos-obsidian-deep)', border: '1px solid var(--aos-steel-blue)' }}>
                        <Layout className="h-4 w-4" style={{ color: 'var(--aos-brass)' }} />
                        <span className="aos-small" style={{ color: 'var(--aos-sage-soft)' }}>Plan the quarter. Run the sprint. Capture the learning.</span>
                    </div>
                </div>
            </div>

            {/* 2×2 launchpad grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top-left: Planning */}
                <HubCard
                    eyebrow="Hub · Planning"
                    title="Planning"
                    description="Design the quarter, commit the capability focus, and move work into a bounded sprint plan."
                    subCards={planningCards}
                    ctaLabel="Open Planning"
                    ctaHref="/pro/planning"
                />

                {/* Top-right: Execution */}
                <HubCard
                    eyebrow="Hub · Execution"
                    title="Execution"
                    description="Orient at the start, operate through the sprint, and reflect at the close."
                    subCards={executionCards}
                    ctaLabel="Open Execution"
                    ctaHref="/pro/execution"
                />

                {/* Bottom-left: Intelligence Hub */}
                <HubCard
                    eyebrow="Hub · Intelligence"
                    title="Intelligence Hub"
                    description="Strategic AI support, synthesized knowledge, and performance insight — always in context."
                    subCards={intelligenceCards}
                    ctaLabel="Open Intelligence"
                    ctaHref="/pro/intelligence"
                />

                {/* Bottom-right: Transformation journey callout */}
                <div
                    className="rounded-[var(--radius-xs)] p-8 flex flex-col justify-between gap-8"
                    style={{ background: 'var(--bg-inverse)', color: 'var(--fg-on-dark)', boxShadow: 'var(--shadow-soft-2)' }}
                >
                    <div>
                        <div className="aos-eyebrow mb-3" style={{ color: 'var(--aos-brass-soft)' }}>Your transformation journey</div>
                        <h2 className="aos-h3 mb-4" style={{ color: 'var(--fg-on-dark)' }}>Three systems. One operating model.</h2>
                        <p style={{ color: 'var(--aos-sage-soft)', fontSize: 'var(--t-body-size)', lineHeight: 'var(--t-body-lh)' }}>
                            Planning gives you a clear horizon. Execution turns that clarity into consistent forward motion.
                            Intelligence closes the loop — surfacing what's working and what needs to shift before the next
                            cycle begins. Together they form the operating model that moves you from reactive operator to
                            deliberate architect of your agency.
                        </p>
                    </div>
                    <Link
                        to="/pro/planning/roadmap"
                        className="inline-flex items-center self-start rounded-md px-5 py-3 text-sm font-medium transition-colors"
                        style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                    >
                        Begin your transformation journey
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
};
