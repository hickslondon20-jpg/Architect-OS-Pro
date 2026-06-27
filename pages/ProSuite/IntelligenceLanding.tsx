import React from 'react';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Brain, Lightbulb } from 'lucide-react';

const intelligenceResources = [
    {
        label: 'Virtual CSO',
        description:
            'AI-powered strategic advisor for your agency. Bring it a decision, a challenge, or a direction you want to pressure-test — it responds with your business context already loaded.',
        href: '/pro/intelligence/virtual-cso',
        icon: Brain,
        disabled: false,
        when: 'Reach for this when you need a thought partner, a second opinion, or a fast strategic read.',
    },
    {
        label: 'OS Engine',
        description:
            'Your second brain — upload documents, capture context, and build a synthesized knowledge base that every tool in the platform can draw from.',
        href: '/pro/intelligence/os-engine',
        icon: Lightbulb,
        disabled: false,
        when: 'Reach for this when you want to load context, organize knowledge, or surface patterns from your business data.',
    },
    {
        label: 'Domain Agents',
        description:
            'Specialist strategic operators that produce task-bound work: analyses, reviews, memos, audits, and finished artifacts.',
        href: '/pro/intelligence/domain-agents',
        icon: Bot,
        disabled: false,
        when: 'Reach for this when you know the type of outcome you need produced by a specific discipline.',
    },
];

export const IntelligenceLanding: React.FC = () => {
    return (
        <div className="space-y-7">
            {/* Header */}
            <div className="flex flex-col gap-3">
                <div className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>Intelligence Hub</div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="aos-h1">Strategy that knows your business.</h1>
                        <p className="aos-body mt-3 max-w-2xl" style={{ color: 'var(--fg-2)' }}>
                            Three intelligence peers: open strategic reasoning, durable business memory, and specialist production workflows.
                        </p>
                    </div>
                    <Link
                        to="/pro/intelligence/virtual-cso"
                        className="inline-flex w-fit items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'var(--aos-brass)', color: 'var(--aos-cloud)' }}
                    >
                        Talk to your Virtual CSO
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </div>
            </div>

            {/* Resource cards */}
            <Card className="p-8" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)', boxShadow: 'var(--shadow-soft-1)' }}>
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)]"
                                style={{ background: 'var(--aos-brass-tint)', border: 'var(--border-accent)' }}
                            >
                                <Brain className="h-6 w-6" style={{ color: 'var(--aos-brass)' }} />
                            </div>
                            <div>
                                <div className="aos-eyebrow mb-2">Intelligence Resources</div>
                                <h2 className="aos-h3">Three tools, always in context</h2>
                                <p className="aos-small mt-2 max-w-2xl">
                                    These resources don't follow a sequence — reach for the one that fits the moment. They're designed to work independently and together.
                                </p>
                            </div>
                        </div>
                        {/* How-to-use callout — non-sequential framing */}
                        <div
                            className="rounded-[var(--radius-xs)] px-4 py-3 lg:max-w-xs"
                            style={{ background: 'var(--bg-sunken)', border: 'var(--border-hairline)' }}
                        >
                            <div className="aos-eyebrow mb-1">How to use this</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                                No fixed order. Use Virtual CSO for strategic reasoning, OS Engine for memory, and Domain Agents for finished work from a specialist discipline.
                            </p>
                        </div>
                    </div>

                    {/* Peer cards use an asymmetric rhythm to avoid a three-equal-card row. */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        {intelligenceResources.map((resource, index) => {
                            const Icon = resource.icon;
                            const spanClass = index === 0 ? 'lg:col-span-5' : index === 1 ? 'lg:col-span-7' : 'lg:col-span-12';
                            const inner = (
                                <div
                                    className="group rounded-[var(--radius-xs)] p-5 transition-colors h-full flex flex-col"
                                    style={{
                                        background: 'var(--bg-sunken)',
                                        border: 'var(--border-hairline)',
                                        opacity: resource.disabled ? 0.6 : 1,
                                        cursor: resource.disabled ? 'default' : 'pointer',
                                    }}
                                >
                                    <div className="mb-5 flex items-center justify-between">
                                        <div
                                            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-xs)]"
                                            style={{
                                                background: resource.disabled ? 'var(--bg-surface)' : 'var(--aos-brass-tint)',
                                                border: resource.disabled ? 'var(--border-hairline)' : 'var(--border-accent)',
                                            }}
                                        >
                                            <Icon className="h-5 w-5" style={{ color: resource.disabled ? 'var(--fg-3)' : 'var(--aos-brass)' }} />
                                        </div>
                                        {resource.disabled ? (
                                            <span
                                                className="text-xs px-2 py-0.5 rounded"
                                                style={{ background: 'var(--bg-surface)', color: 'var(--fg-3)', border: 'var(--border-hairline)' }}
                                            >
                                                Coming Soon
                                            </span>
                                        ) : (
                                            <ArrowRight
                                                className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                                                style={{ color: 'var(--aos-brass)' }}
                                            />
                                        )}
                                    </div>
                                    <h3 className="aos-h3">{resource.label}</h3>
                                    <p className="aos-small mt-3 flex-1">{resource.description}</p>
                                    <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--fg-3)' }}>{resource.when}</p>
                                </div>
                            );

                            if (resource.disabled || !resource.href) {
                                return <div key={resource.label} className={spanClass}>{inner}</div>;
                            }
                            return (
                                <Link key={resource.label} to={resource.href} className={`flex flex-col ${spanClass}`}>
                                    {inner}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>
    );
};
