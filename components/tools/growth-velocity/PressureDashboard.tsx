import React, { useState } from 'react';
import { Card, Button, Badge } from '../../ui';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SimulationResult, PressureAlert } from '../../../lib/growthCalculations';

export interface ComparisonScenario {
    id: string;
    name: string;
    isBaseline: boolean;
    result?: SimulationResult;
}

interface PressureDashboardProps {
    scenarios: ComparisonScenario[];
}

export const PressureDashboard: React.FC<PressureDashboardProps> = ({ scenarios }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
        'retention': false,
        'sales': false,
        'capacity': false,
        'economic': false,
        'structural': false,
        'positioning': false
    });

    const toggleRow = (key: string) => {
        setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const pressures = [
        { key: 'retention', label: 'Retention Pressure', desc: 'The Treadmill' },
        { key: 'sales', label: 'Sales Pressure', desc: 'New Capability' },
        { key: 'capacity', label: 'Capacity Pressure', desc: 'Operational Wall' },
        { key: 'economic', label: 'Economic Pressure', desc: 'Profit Trap' },
        { key: 'structural', label: 'Structural Pressure', desc: 'Whale Trap' },
        { key: 'positioning', label: 'Positioning Pressure', desc: 'Monetization' }
    ];

    const getStatusIcon = (severity: string) => {
        switch (severity) {
            case 'RED': return <AlertCircle className="h-4 w-4 text-[var(--aos-risk)]" />;
            case 'YELLOW': return <AlertTriangle className="h-4 w-4 text-[var(--aos-warning)]" />;
            case 'GREEN': return <CheckCircle2 className="h-4 w-4 text-[var(--aos-success)]" />;
            default: return null;
        }
    };

    const getStatusBadge = (alert?: PressureAlert) => {
        if (!alert) return <span className="text-[var(--fg-4)]">--</span>;

        let colorClass = '';
        if (alert.severity === 'RED') colorClass = 'bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] border-[var(--aos-risk)]';
        else if (alert.severity === 'YELLOW') colorClass = 'bg-[var(--aos-warning-tint)] text-[var(--aos-warning)] border-[var(--aos-warning)]';
        else colorClass = 'bg-[var(--aos-success-tint)] text-[var(--aos-success)] border-[var(--aos-success)]';

        return (
            <Badge variant="outline" className={`${colorClass} flex items-center gap-1`}>
                {getStatusIcon(alert.severity)}
                {alert.severity}
            </Badge>
        );
    };

    if (!isExpanded) {
        return (
            <Button variant="outline" className="w-full mt-6" onClick={() => setIsExpanded(true)}>
                Show Pressure Dashboard <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
        );
    }

    return (
        <Card className="mt-8 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--fg-1)]">Pressure Dashboard</h3>
                    <p className="text-sm text-[var(--fg-3)]">Comparative risk analysis across 6 strategic dimensions</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
                    Collapse <ChevronUp className="ml-2 h-4 w-4" />
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--aos-mist)]">
                            <th className="py-3 px-4 font-semibold text-[var(--fg-2)] w-1/4">Pressure Type</th>
                            {scenarios.map(s => (
                                <th key={s.id} className="py-3 px-4 font-semibold text-[var(--fg-1)]">
                                    {s.name}
                                    {s.isBaseline && <span className="text-xs font-normal text-[var(--fg-3)] ml-2">(Baseline)</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pressures.map((pressure) => (
                            <React.Fragment key={pressure.key}>
                                <tr className="border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] hover:bg-[var(--bg-canvas)] transition-colors">
                                    <td className="py-4 px-4 align-top">
                                        <div className="font-semibold text-[var(--fg-1)]">{pressure.label}</div>
                                        <div className="text-xs text-[var(--fg-3)]">{pressure.desc}</div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-1 h-6 px-0 text-[var(--aos-brass)] hover:text-[var(--aos-brass-soft)] p-0 text-xs"
                                            onClick={() => toggleRow(pressure.key)}
                                        >
                                            {expandedRows[pressure.key] ? 'Hide Details' : 'Show Details'}
                                        </Button>
                                    </td>
                                    {scenarios.map(s => {
                                        const alert = s.result?.pressures[pressure.key as keyof typeof s.result.pressures];
                                        return (
                                            <td key={s.id} className="py-4 px-4 align-top">
                                                {s.isBaseline ? (
                                                    <div className="text-[var(--fg-4)] text-center">--</div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {getStatusBadge(alert)}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {expandedRows[pressure.key] && (
                                    <tr className="bg-[var(--bg-sunken)] border-b border-[var(--aos-mist)]">
                                        <td className="p-4 text-xs font-semibold text-[var(--fg-3)] text-right uppercase tracking-wider">
                                            Insight
                                        </td>
                                        {scenarios.map(s => {
                                            const alert = s.result?.pressures[pressure.key as keyof typeof s.result.pressures];
                                            return (
                                                <td key={`detail-${s.id}`} className="p-4 text-sm text-[var(--fg-2)]">
                                                    {s.isBaseline ? (
                                                        <span className="text-[var(--fg-4)] italic">Configuration baseline</span>
                                                    ) : alert ? (
                                                        <div>
                                                            <div className="font-medium text-[var(--fg-1)] mb-1">{alert.label}</div>
                                                            <div>{alert.message}</div>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};
