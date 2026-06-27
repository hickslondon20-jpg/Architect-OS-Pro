import React, { useEffect, useMemo, useState } from 'react';
import { Label } from '../../../components/ui';
import { Map, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { CalloutBlock } from '../../../components/pro-suite/roadmap/CalloutBlock';
import { BridgePanel } from '../../../components/pro-suite/roadmap/BridgePanel';

interface PlanState {
    constraints: string;
    priorities: string;
    dependencies: string;
    notes: string;
}

type TimelineKey = 'current' | '12m' | '24m' | '36m' | 'ultimate';

const timelineItems: Array<{ id: TimelineKey; label: string; eyebrow: string }> = [
    { id: 'current', label: 'Current State', eyebrow: 'Today' },
    { id: '12m', label: '12 Months', eyebrow: 'Year 1' },
    { id: '24m', label: '24 Months', eyebrow: 'Year 2' },
    { id: '36m', label: '36 Months', eyebrow: 'Year 3' },
    { id: 'ultimate', label: 'Ultimate Vision', eyebrow: 'Destination' }
];

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`aos-eyebrow text-[var(--aos-brass)] ${className}`}>{children}</div>
);

const DraftTag: React.FC = () => (
    <span className="rounded-[var(--radius-xs)] bg-[var(--aos-warning-tint)] px-2 py-1 text-[10px] font-medium lowercase tracking-[0.04em] text-[var(--aos-warning)]">
        draft synthesis
    </span>
);

const TimelineButton: React.FC<{
    item: typeof timelineItems[number];
    isActive: boolean;
    index: number;
    onClick: () => void;
}> = ({ item, isActive, index, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group min-h-[88px] rounded-[var(--radius-xs)] border p-4 text-left transition-all duration-200 ${
            isActive
                ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] shadow-[var(--shadow-soft-1)]'
                : 'border-[var(--aos-mist)] bg-[var(--bg-surface)] hover:border-[var(--aos-brass-soft)] hover:bg-[var(--bg-sunken)]'
        }`}
    >
        <div className="flex items-center gap-3">
            <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[12px] font-semibold ${
                    isActive
                        ? 'bg-[var(--aos-brass)] text-[var(--aos-cloud)]'
                        : 'bg-[var(--bg-sunken)] text-[var(--fg-3)] group-hover:text-[var(--aos-brass)]'
                }`}
            >
                {index + 1}
            </span>
            <span className={`aos-eyebrow ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}>
                {item.eyebrow}
            </span>
        </div>
        <div className={`mt-4 text-[var(--t-small-size)] font-medium ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-1)]'}`}>
            {item.label}
        </div>
    </button>
);

const ReviewPanel: React.FC<{
    title: string;
    eyebrow: string;
    scenarioName?: string;
    children: React.ReactNode;
}> = ({ title, eyebrow, scenarioName, children }) => (
    <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-[var(--aos-mist)] pb-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                    <Target className="h-5 w-5" />
                </div>
                <div>
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <h2 className="aos-h3 mt-2">{title}</h2>
                </div>
            </div>
            {scenarioName && (
                <span className="w-fit rounded-[var(--radius-full)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)] px-3 py-1.5 text-[var(--t-caption-size)] font-medium text-[var(--fg-2)]">
                    {scenarioName}
                </span>
            )}
        </div>
        <div className="space-y-8">{children}</div>
    </section>
);

const ContentBlock: React.FC<{ title: string; children: React.ReactNode; tag?: boolean }> = ({ title, children, tag }) => (
    <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="aos-eyebrow text-[var(--fg-3)]">{title}</h3>
            {tag && <DraftTag />}
        </div>
        <div className="space-y-3 text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
            {children}
        </div>
    </div>
);

const InsightList: React.FC<{ items: Array<{ label: string; body: string }>; accent?: 'brass' | 'success' }> = ({ items, accent = 'brass' }) => {
    const dotClass = accent === 'success' ? 'bg-[var(--aos-success)]' : 'bg-[var(--aos-brass)]';

    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                    <div className={`mt-2 h-1.5 min-w-1.5 rounded-[var(--radius-full)] ${dotClass}`} />
                    <div className="text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                        <span className="font-semibold text-[var(--fg-1)]">{item.label}:</span> {item.body}
                    </div>
                </li>
            ))}
        </ul>
    );
};

export const Plan12MonthTab: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [selectedTimeline, setSelectedTimeline] = useState<TimelineKey>('ultimate');

    const [userStageName, setUserStageName] = useState('Rising');
    const [topCapabilities, setTopCapabilities] = useState<string[]>(['Delivery Ops', 'Client Fit', 'Sales Engine']);
    const [topDimensions, setTopDimensions] = useState<string[]>(['Systems Intelligence', 'Market Position']);

    const [formData, setFormData] = useState<PlanState>({
        constraints: '',
        priorities: '',
        dependencies: '',
        notes: ''
    });

    const [clarityData, setClarityData] = useState<any>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (user) {
                const { data } = await supabase
                    .from('clarity_compass_versions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    setClarityData(data[0]);
                }

                try {
                    const { data: aeData } = await supabase
                        .from('ae_assessments')
                        .select('stage')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (aeData && aeData.length > 0 && aeData[0].stage) {
                        setUserStageName(aeData[0].stage);
                    }

                    const { data: capData } = await supabase
                        .from('mr_capability_scores')
                        .select('capability_name')
                        .eq('user_id', user.id)
                        .order('score_pct', { ascending: true })
                        .limit(3);
                    if (capData && capData.length > 0) {
                        setTopCapabilities(capData.map(c => c.capability_name));
                    }

                    const { data: dimData } = await supabase
                        .from('mr_dimension_scores')
                        .select('dimension_name')
                        .eq('user_id', user.id)
                        .order('score_pct', { ascending: true })
                        .limit(2);
                    if (dimData && dimData.length > 0) {
                        setTopDimensions(dimData.map(d => d.dimension_name));
                    }
                } catch (err) {
                    console.warn('Failed to fetch contextual M&R/AE data, using fallbacks.', err);
                }
            }

            setIsLoading(false);
        };

        fetchInitialData();
    }, [user]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (formData.constraints || formData.priorities) {
                console.log('Auto-saving draft...');
            }
        }, 30000);
        return () => clearInterval(timer);
    }, [formData]);

    const handleProceedToQuarterMap = () => {
        navigate('/pro/planning/quarter-map/current-quarter');
    };

    const ultimateVisionText = clarityData?.synthesis_json?.block1_statement || null;

    const currentStateItems = useMemo(() => [
        { label: 'Agency stage', value: userStageName },
        { label: 'Leverage areas', value: topCapabilities.slice(0, 3).join(', ') },
        { label: 'Pressure dimensions', value: topDimensions.slice(0, 2).join(', ') }
    ], [topCapabilities, topDimensions, userStageName]);

    const renderTimelinePanel = () => {
        switch (selectedTimeline) {
            case 'current':
                return (
                    <ReviewPanel title="Current State" eyebrow="Starting Point" scenarioName="Context Snapshot">
                        <div className="grid gap-3 md:grid-cols-3">
                            {currentStateItems.map((item) => (
                                <div key={item.label} className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                                    <div className="aos-eyebrow text-[var(--fg-3)]">{item.label}</div>
                                    <div className="mt-3 text-[var(--t-small-size)] font-semibold leading-[var(--t-small-lh)] text-[var(--fg-1)]">
                                        {item.value || 'Not yet available'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <CalloutBlock title="What This Anchors">
                            This view holds the current operating context the roadmap is being sequenced from before the 12-, 24-, and 36-month horizons are translated into quarterly execution.
                        </CalloutBlock>
                    </ReviewPanel>
                );
            case '12m':
                return (
                    <ReviewPanel title="12-Month Horizon" eyebrow="Year 1" scenarioName="Foundation Building">
                        <ContentBlock title="What This Year Requires" tag>
                            <p>
                                Your 12-month journey represents a foundation-building year. At your <span className="font-semibold text-[var(--fg-1)]">{userStageName}</span> stage, this period should focus on systematizing operations, strengthening financial visibility, and evolving your client portfolio toward higher-value work.
                            </p>
                            <p>
                                Success requires disciplined focus on <span className="font-semibold text-[var(--fg-1)]">{topCapabilities[0] || 'Delivery Operations'}</span> and <span className="font-semibold text-[var(--fg-1)]">{topCapabilities[1] || 'Financial Visibility'}</span> rather than opportunistic expansion.
                            </p>
                        </ContentBlock>

                        <ContentBlock title="Where The Leverage Is">
                            <InsightList
                                accent="success"
                                items={topCapabilities.slice(0, 3).map((cap) => ({
                                    label: cap,
                                    body: 'Fixing this capability creates the most downstream operational leverage for everything else you are trying to do this year.'
                                }))}
                            />
                        </ContentBlock>

                        <CalloutBlock title="The Dependency Chain">
                            Do not attempt to scale the client portfolio before stabilizing the delivery floor in Q1. Specifically, {topCapabilities[0] || 'Delivery Operations'} must be solved before any top-of-funnel initiatives are launched.
                        </CalloutBlock>

                        <ContentBlock title="What Could Slow This Down">
                            <p className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
                                Overcommitting to custom work implementations while simultaneously trying to build scalable internal systems will cause team burnout and miss both targets.
                            </p>
                        </ContentBlock>
                    </ReviewPanel>
                );
            case '24m':
                return (
                    <ReviewPanel title="24-Month Horizon" eyebrow="Year 2" scenarioName="Margin Optimization">
                        <ContentBlock title="What Needs To Be True At This Horizon" tag>
                            <p>
                                By the end of Year 2, your target is to stabilize at 30% EBITDA. This means the immediate growth phase cannot be funded entirely by throwing expensive talent at the problem. You must optimize your junior-to-senior leverage ratios and introduce significant operational automation before the start of Year 2.
                            </p>
                            <p>
                                Structurally, the weight of this goal falls primarily on your <span className="font-semibold text-[var(--fg-1)]">{topDimensions[0] || 'Systems Intelligence'}</span> and <span className="font-semibold text-[var(--fg-1)]">{topDimensions[1] || 'Market Position'}</span> dimensions. If these are not hardened, the cost of delivery will consume the margin you are attempting to build.
                            </p>
                        </ContentBlock>

                        <ContentBlock title="Dimensions That Carry The Most Weight">
                            <InsightList
                                items={topDimensions.slice(0, 2).map((dim) => ({
                                    label: dim,
                                    body: 'Requires immediate attention to build the leverage necessary for the 24-month EBITDA target.'
                                }))}
                            />
                        </ContentBlock>

                        <CalloutBlock title="The 24-Month Prerequisite">
                            Before raising rates to improve margin, you must eliminate the wasted hours in project management and onboarding. Fix the leaks before expanding the pipe.
                        </CalloutBlock>
                    </ReviewPanel>
                );
            case '36m':
                return (
                    <ReviewPanel title="36-Month Horizon" eyebrow="Year 3" scenarioName="Productized Transition">
                        <ContentBlock title="What This Requires" tag>
                            <p>
                                To reach this 36-month vision, the agency must undergo a fundamental shift in how value is packaged and delivered. The custom, high-touch services that got you to the <span className="font-semibold text-[var(--fg-1)]">{userStageName}</span> stage will not scale to meet this target.
                            </p>
                            <p>
                                This requires beginning the transition away from bespoke project billing toward foundational retainer frameworks now, so that by Year 3, the sales and delivery engines are perfectly aligned to support recurring models.
                            </p>
                        </ContentBlock>

                        <ContentBlock title="Growth Pressures At This Horizon">
                            <InsightList
                                items={[
                                    {
                                        label: 'Delivery Velocity',
                                        body: 'The speed at which you must fulfill products will strain current manual processes.'
                                    },
                                    {
                                        label: 'Margin Compression',
                                        body: 'Scaling operations before standardizing will rapidly erode profitability.'
                                    }
                                ]}
                            />
                        </ContentBlock>

                        <CalloutBlock title="The Structural Reality">
                            You cannot sell a productized retainer if your delivery team still thinks like a custom dev shop. The next 3 years must be spent ruthlessly standardizing what works.
                        </CalloutBlock>
                    </ReviewPanel>
                );
            case 'ultimate':
            default:
                return (
                    <ReviewPanel title="Ultimate Vision" eyebrow="Destination" scenarioName={ultimateVisionText ? 'Clarity Compass Source' : undefined}>
                        <div className={`text-[var(--t-body-size)] font-medium leading-[var(--t-body-lh)] ${ultimateVisionText ? 'text-[var(--fg-1)]' : 'italic text-[var(--fg-3)]'}`}>
                            {ultimateVisionText || 'No ultimate vision defined yet.'}
                        </div>
                        {ultimateVisionText && (
                            <div className="flex items-start gap-4 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)]">
                                <Target className="mt-0.5 h-5 w-5 shrink-0 text-[var(--aos-brass)]" />
                                <div>
                                    <Eyebrow>Synthesis</Eyebrow>
                                    <p className="mt-3 text-[var(--t-small-size)] italic leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                                        The business operates as a leveraged product company, having successfully shifted from high-touch service to a scalable recurring revenue model with exceptional enterprise value.
                                    </p>
                                </div>
                            </div>
                        )}
                    </ReviewPanel>
                );
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl space-y-4 py-24 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-[var(--radius-full)] border-4 border-[var(--aos-mist)] border-t-[var(--aos-brass)]" />
                <p className="text-[var(--t-body-size)] font-medium text-[var(--fg-1)]">Synthesizing Executive Roadmap...</p>
                <p className="text-[var(--t-small-size)] text-[var(--fg-3)]">Aligning horizons and compiling structural implications.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-10 pb-24">
            <div className="mx-auto max-w-3xl space-y-3 pt-4 text-center">
                <Eyebrow>Roadmap Review</Eyebrow>
                <h1 className="aos-h1">Work backward from the destination.</h1>
                <p className="text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                    Your multi-year trajectory has been plotted. Use the timeline to review how the ultimate vision, 36-month horizon, 24-month horizon, and 12-month plan shape the execution sequence.
                </p>
            </div>

            <section className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] md:p-5">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]">
                        <Map className="h-5 w-5" />
                    </div>
                    <div>
                        <Eyebrow>Trajectory Timeline</Eyebrow>
                        <p className="mt-1 text-[var(--t-caption-size)] text-[var(--fg-3)]">
                            Move across the horizon to see how each point changes what the year has to serve.
                        </p>
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                    {timelineItems.map((item, index) => (
                        <TimelineButton
                            key={item.id}
                            item={item}
                            index={index}
                            isActive={selectedTimeline === item.id}
                            onClick={() => setSelectedTimeline(item.id)}
                        />
                    ))}
                </div>
            </section>

            {renderTimelinePanel()}

            <section className="space-y-6 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft-1)] md:p-8">
                <div>
                    <Eyebrow>Contextual Overrides</Eyebrow>
                    <h2 className="aos-h3 mt-2">Add the constraints the sequence needs to respect.</h2>
                    <p className="mt-2 text-[var(--t-small-size)] leading-[var(--t-small-lh)] text-[var(--fg-2)]">
                        The sequencing above is structurally correct, but you must overlay your unique reality (cash gaps, upcoming team leave, etc.). Add bounds to the plan below.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="constraints">Key Constraints & Realities</Label>
                        <textarea
                            id="constraints"
                            className="block min-h-[120px] w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 text-[var(--t-small-size)] text-[var(--fg-1)] shadow-[var(--shadow-soft-1)] transition focus:border-[var(--aos-brass)] focus:outline-none focus:ring-2 focus:ring-[rgba(184,146,42,0.22)]"
                            placeholder="What limits your execution? (e.g., 'Cannot hire Ops Director until Q3 due to cash flow')"
                            value={formData.constraints}
                            onChange={e => setFormData({ ...formData, constraints: e.target.value })}
                            maxLength={1000}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="priorities">Strategic Priorities</Label>
                        <textarea
                            id="priorities"
                            className="block min-h-[120px] w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 text-[var(--t-small-size)] text-[var(--fg-1)] shadow-[var(--shadow-soft-1)] transition focus:border-[var(--aos-brass)] focus:outline-none focus:ring-2 focus:ring-[rgba(184,146,42,0.22)]"
                            placeholder="Beyond the generated plan, what are you personally prioritizing?"
                            value={formData.priorities}
                            onChange={e => setFormData({ ...formData, priorities: e.target.value })}
                            maxLength={1000}
                        />
                    </div>
                </div>
            </section>

            <BridgePanel
                focusStatement={`For this quarter, the most structurally important work centers on ${topCapabilities[0]?.toLowerCase() || 'delivery systems'} and ${topCapabilities[1]?.toLowerCase() || 'financial visibility'}. These aren't the only things that matter - but they're the ones where progress now creates the most leverage for everything that follows. Your Quarter Map should be organized around these foundations.`}
                onProceed={handleProceedToQuarterMap}
            />
        </div>
    );
};
