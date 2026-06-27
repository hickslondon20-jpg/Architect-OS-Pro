import React from 'react';
import { Card } from '../../../ui';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    ScatterChart, Scatter, ZAxis, LabelList,
    BarChart, Bar,
    ReferenceLine
} from 'recharts';
import { formatNumberWithCommas } from '../../../../lib/formatUtils';

interface ComparisonChartsProps {
    chartData: any;
    selectedNames: { slot_1?: string; slot_2?: string; slot_3?: string };
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ chartData, selectedNames }) => {

    // Custom single-line label renderer for Scatter plot to prevent ugly word wrapping overlaps
    const CustomScatterLabel = (props: any) => {
        const { x, y, value } = props;
        return (
            <text
                x={x}
                y={y}
                dy={-12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#475569"
                stroke="white"
                strokeWidth={3}
                className="paint-order-stroke"
                style={{ paintOrder: 'stroke' }}
                pointerEvents="none"
            >
                {value}
            </text>
        );
    };

    // 1. Revenue Trajectory formatting
    const revData = chartData.revenueTrajectory.timeLabels.map((time: string, idx: number) => {
        return {
            timeLabel: time,
            baseline: chartData.revenueTrajectory.baseline[idx],
            slot_1: chartData.revenueTrajectory.slot_1?.[idx],
            slot_2: chartData.revenueTrajectory.slot_2?.[idx],
            slot_3: chartData.revenueTrajectory.slot_3?.[idx],
        };
    });

    // 2. Efficiency Map formatting
    const effMapData = [
        chartData.efficiencyMap.slot_1 && { ...chartData.efficiencyMap.slot_1, z: 1 },
        chartData.efficiencyMap.slot_2 && { ...chartData.efficiencyMap.slot_2, z: 1 },
        chartData.efficiencyMap.slot_3 && { ...chartData.efficiencyMap.slot_3, z: 1 },
    ].filter(Boolean);

    // 3. Growth Bridge formatting
    const bridgeData = [
        chartData.growthBridge.slot_1 && { name: selectedNames.slot_1, ...chartData.growthBridge.slot_1 },
        chartData.growthBridge.slot_2 && { name: selectedNames.slot_2, ...chartData.growthBridge.slot_2 },
        chartData.growthBridge.slot_3 && { name: selectedNames.slot_3, ...chartData.growthBridge.slot_3 },
    ].filter(Boolean);

    // 4. Operational Pulse (Hiring)
    const pulseData = [
        chartData.operationalPulse.slot_1 && { name: selectedNames.slot_1, ...chartData.operationalPulse.slot_1 },
        chartData.operationalPulse.slot_2 && { name: selectedNames.slot_2, ...chartData.operationalPulse.slot_2 },
        chartData.operationalPulse.slot_3 && { name: selectedNames.slot_3, ...chartData.operationalPulse.slot_3 },
    ].filter(Boolean);

    const colors = {
        baseline: '#94a3b8',
        slot_1: '#2563eb',
        slot_2: '#16a34a',
        slot_3: '#d97706',
        bridge: {
            retained: '#cbd5e1',
            churn: '#f87171',
            netNew: '#10b981'
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Chart 1: Revenue Trajectory */}
            <Card className="p-6 border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] flex flex-col h-[350px]">
                <h4 className="font-bold text-[var(--fg-1)] mb-1">Revenue Trajectory (The Climb)</h4>
                <p className="text-xs text-[var(--fg-3)] mb-6 font-medium">Steeper slopes require higher execution velocity</p>
                <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="timeLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                            <YAxis
                                hide={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                tickFormatter={(value) => `$${formatNumberWithCommas(value / 1000)}k`}
                            />
                            <RechartsTooltip
                                formatter={(value: number) => [`$${formatNumberWithCommas(value)}`, '']}
                                labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line type="monotone" dataKey="baseline" stroke={colors.baseline} strokeWidth={2} strokeDasharray="5 5" name="Baseline" dot={false} />
                            {chartData.revenueTrajectory.slot_1 && <Line type="monotone" dataKey="slot_1" stroke={colors.slot_1} strokeWidth={3} name={selectedNames.slot_1} />}
                            {chartData.revenueTrajectory.slot_2 && <Line type="monotone" dataKey="slot_2" stroke={colors.slot_2} strokeWidth={3} name={selectedNames.slot_2} />}
                            {chartData.revenueTrajectory.slot_3 && <Line type="monotone" dataKey="slot_3" stroke={colors.slot_3} strokeWidth={3} name={selectedNames.slot_3} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 2: Efficiency Map */}
            <Card className="p-6 border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] flex flex-col h-[350px]">
                <h4 className="font-bold text-[var(--fg-1)] mb-1">Efficiency Map</h4>
                <p className="text-xs text-[var(--fg-3)] mb-6 font-medium">Upper right is ideal. Right-down is "Burn to Grow".</p>
                <div className="flex-1 min-h-[200px] relative">
                    {/* Quadrant labels moved to absolute bounds outside the chart margin */}
                    <div className="absolute top-0 right-4 text-[10px] uppercase font-bold text-[var(--aos-success)] bg-[var(--aos-success-tint)] opacity-60 px-2 py-1 rounded pointer-events-none z-10">Unicorn Zone</div>
                    <div className="absolute bottom-2 right-4 text-[10px] uppercase font-bold text-[var(--aos-warning)] bg-[var(--aos-warning-tint)] opacity-60 px-2 py-1 rounded pointer-events-none z-10">Burn to Grow</div>
                    <div className="absolute top-0 left-16 text-[10px] uppercase font-bold text-[var(--fg-3)] bg-[var(--bg-canvas)] opacity-60 px-2 py-1 rounded pointer-events-none z-10">Steady State</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 30, right: 30, left: 10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis
                                type="number"
                                dataKey="revenueGrowthPct"
                                name="Revenue Growth"
                                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                domain={[0, 'dataMax + 0.5']}
                                dy={10}
                            />
                            <YAxis
                                type="number"
                                dataKey="profitMarginPct"
                                name="Profit Margin"
                                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                domain={[0, 'dataMax + 0.1']}
                            />
                            <ZAxis type="number" dataKey="z" range={[150, 150]} />
                            <RechartsTooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const p = payload[0].payload;
                                        return (
                                            <div className="bg-[var(--bg-surface)] p-3 border border-[var(--aos-mist)] rounded-lg shadow-[var(--shadow-soft-1)]">
                                                <div className="font-bold text-[var(--fg-1)] mb-2">{p.label}</div>
                                                <div className="text-sm text-[var(--fg-2)]">Growth: <span className="font-semibold">{Math.round(p.revenueGrowthPct * 100)}%</span></div>
                                                <div className="text-sm text-[var(--fg-2)]">Margin: <span className="font-semibold">{Math.round(p.profitMarginPct * 100)}%</span></div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter name="Scenarios" data={effMapData} fill={colors.slot_1}>
                                {effMapData.map((entry, index) => (
                                    <cell key={`cell-${index}`} fill={[colors.slot_1, colors.slot_2, colors.slot_3][index]} />
                                ))}
                                <LabelList dataKey="label" content={CustomScatterLabel} />
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 3: Growth Bridge */}
            <Card className="p-6 border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] flex flex-col h-[350px]">
                <h4 className="font-bold text-[var(--fg-1)] mb-1">Growth Bridge (The Treadmill)</h4>
                <p className="text-xs text-[var(--fg-3)] mb-6 font-medium">Red is replacing churn. Green is true net new growth.</p>
                <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bridgeData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} width={100} />
                            <YAxis
                                hide={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                tickFormatter={(value) => `$${formatNumberWithCommas(value / 1000)}k`}
                            />
                            <RechartsTooltip
                                formatter={(value: number) => `$${formatNumberWithCommas(value)}`}
                                labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="retainedRevenue" stackId="a" fill={colors.bridge.retained} name="Retained Baseline" radius={[0, 0, 4, 4]} maxBarSize={60} />
                            <Bar dataKey="churnReplacement" stackId="a" fill={colors.bridge.churn} name="Churn Replacement" maxBarSize={60} />
                            <Bar dataKey="netNew" stackId="a" fill={colors.bridge.netNew} name="Net New Growth" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <ReferenceLine y={chartData.revenueTrajectory.baseline[0]} stroke={colors.baseline} strokeDasharray="3 3" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 4: Operational Pulse */}
            <Card className="p-6 border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] flex flex-col h-[350px]">
                <h4 className="font-bold text-[var(--fg-1)] mb-1">Operational Pulse (Hiring)</h4>
                <p className="text-xs text-[var(--fg-3)] mb-6 font-medium">Average net new hires required per quarter to sustain growth</p>
                <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pulseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                            <YAxis
                                hide={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                            />
                            <RechartsTooltip
                                formatter={(value: number, name: string, props: any) => {
                                    if (props.payload?.hiringLabel) {
                                        return [props.payload.hiringLabel, ''];
                                    }
                                    return [`${value.toFixed(1)} Hires / Qtr`, ''];
                                }}
                                labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f1f5f9' }}
                            />
                            <Bar dataKey="avgNewHiresPerQtr" fill={colors.slot_1} name="New Hires / Qtr" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                {pulseData.map((entry, index) => (
                                    <cell key={`cell-${index}`} fill={[colors.slot_1, colors.slot_2, colors.slot_3][index]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

        </div>
    );
};
