import React, { useState } from 'react';
import { Card } from '../../../ui';
import { DimensionScore, DeviationBucket } from '../types';
import { Check, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface ScoreSnapshotProps {
    dimensions: DimensionScore[];
    overallScore: number;
}

const getDeviationColor = (bucket: DeviationBucket): string => {
    switch (bucket) {
        case 'strongly_above': return 'bg-[var(--aos-success-tint)] border-[var(--aos-success)] text-[var(--aos-success)]';
        case 'above': return 'bg-[var(--aos-insight-tint)] border-[var(--aos-insight)] text-[var(--aos-insight)]';
        case 'below': return 'bg-[var(--aos-warning-tint)] border-[var(--aos-warning)] text-[var(--aos-warning)]';
        case 'strongly_below': return 'bg-[var(--aos-risk-tint)] border-[var(--aos-risk)] text-[var(--aos-risk)]';
        default: return 'bg-[var(--bg-sunken)] border-[var(--aos-mist)] text-[var(--fg-3)]';
    }
};

const getDeviationAccentBar = (bucket: DeviationBucket): string => {
    switch (bucket) {
        case 'strongly_above': return 'bg-[var(--aos-success)]';
        case 'above': return 'bg-[var(--aos-insight)]';
        case 'below': return 'bg-[var(--aos-warning)]';
        case 'strongly_below': return 'bg-[var(--aos-risk)]';
        default: return 'bg-[var(--fg-4)]';
    }
};

const getDeviationIcon = (bucket: DeviationBucket) => {
    switch (bucket) {
        case 'strongly_above': return <TrendingUp className="w-4 h-4" />;
        case 'above': return <TrendingUp className="w-4 h-4" />;
        case 'below': return <TrendingDown className="w-4 h-4" />;
        case 'strongly_below': return <TrendingDown className="w-4 h-4" />;
        default: return <Minus className="w-4 h-4" />; // at_overall
    }
};

export const ScoreSnapshot: React.FC<ScoreSnapshotProps> = ({ dimensions, overallScore }) => {
    const [expandedDimId, setExpandedDimId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedDimId(expandedDimId === id ? null : id);
    };

    return (
        <section className="space-y-6">
            <h3 className="text-xl font-bold text-[var(--fg-1)]">Dimension Snapshot</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {dimensions.map((dim) => {
                    const deviationStyles = getDeviationColor(dim.deviationBucket);

                    return (
                        <Card key={dim.id} className={`flex flex-col p-5 border relative overflow-hidden transition-all hover:shadow-md ${dim.deviationBucket.includes('strongly') ? 'shadow-sm' : ''}`}>
                            <div className="flex justify-between items-start mb-3">
                                <h4 className="font-semibold text-sm text-[var(--fg-1)] leading-tight min-h-[40px] flex items-center">
                                    {dim.name}
                                </h4>
                                <div className={`p-1.5 rounded-full ${deviationStyles} bg-opacity-20`}>
                                    {getDeviationIcon(dim.deviationBucket)}
                                </div>
                            </div>

                            <div className="mt-auto space-y-2">
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold tracking-tight text-[var(--fg-1)]" style={{ fontFamily: 'var(--font-mono)' }}>{dim.avgScore.toFixed(2)}</span>
                                    <span className={`text-xs font-medium mb-1.5 ${dim.delta >= 0 ? 'text-[var(--aos-success)]' : 'text-[var(--aos-risk)]'}`}>
                                        {dim.delta > 0 ? '+' : ''}{dim.delta.toFixed(2)}
                                    </span>
                                </div>

                                <div className="text-xs uppercase tracking-wide font-medium text-[var(--fg-3)] truncate" title={dim.bandSummaryLabel}>
                                    {dim.bandSummaryLabel}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[var(--aos-mist)] relative z-10">
                                <button
                                    onClick={() => toggleExpand(dim.id)}
                                    className="w-full flex items-center justify-between text-xs font-medium text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors group"
                                >
                                    <span>Dimension Insight</span>
                                    {expandedDimId === dim.id ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                </button>

                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedDimId === dim.id ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                                    <div className="text-xs text-[var(--fg-2)] leading-relaxed bg-[var(--bg-sunken)] p-2.5 rounded-md border border-[var(--aos-mist)]">
                                        {dim.dimensionInsight ? (
                                            dim.dimensionInsight
                                        ) : (
                                            <div className="flex items-center gap-2 text-[var(--fg-3)] italic h-full animate-pulse">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Insight generating...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Decorative accent bar at bottom */}
                            <div className={`absolute bottom-0 left-0 right-0 h-1 ${getDeviationAccentBar(dim.deviationBucket)} opacity-40`} />
                        </Card>
                    );
                })}
            </div>
        </section>
    );
};
