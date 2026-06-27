import React, { useState } from 'react';
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    ReferenceArea,
    ReferenceLine,
    Label
} from 'recharts';
import { X, Info } from 'lucide-react';

interface QuadrantWidgetProps {
    maturityScore: number; // 0-100
    readinessScore: number; // 0-100
}

type ZoneId = 'foundation' | 'momentum' | 'misaligned' | 'scale' | null;

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[var(--bg-inverse)] text-[var(--fg-on-dark)] text-xs p-3 rounded shadow-xl border border-[var(--aos-slate-blue)] z-50 relative">
                <p className="font-bold mb-1 text-[var(--aos-success)]">YOU ARE HERE</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-[var(--fg-3)]">Maturity:</span>
                    <span className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>{data.x}%</span>
                    <span className="text-[var(--fg-3)]">Readiness:</span>
                    <span className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>{data.y}%</span>
                </div>
            </div>
        );
    }
    return null;
};

export const QuadrantWidget: React.FC<QuadrantWidgetProps> = ({ maturityScore, readinessScore }) => {
    const [activeZone, setActiveZone] = useState<ZoneId>(null);
    const data = [{ x: maturityScore, y: readinessScore }];

    const handleZoneClick = (zone: ZoneId) => {
        setActiveZone(activeZone === zone ? null : zone);
    };

    return (
        <div className="w-full h-[450px] font-sans relative select-none">
            {/* Axis Labels Overlay (Only visible when no zone is active) */}
            {!activeZone && (
                <>
                    <div className="absolute bottom-2 right-4 text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest z-0 pointer-events-none">Maturity →</div>
                    <div className="absolute top-4 left-2 text-xs font-bold text-[var(--fg-4)] uppercase tracking-widest writing-mode-vertical rotate-180 z-0 pointer-events-none" style={{ writingMode: 'vertical-rl' }}>Readiness →</div>
                </>
            )}

            {/* Educational Overlay Cards */}
            {/* Q4: Foundational Growth (Bottom Left) */}
            {activeZone === 'foundation' && (
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[var(--bg-surface)] border-t border-r border-[var(--aos-mist)] z-20 p-6 animate-in zoom-in-95 duration-200 shadow-xl flex flex-col justify-center">
                    <button onClick={() => setActiveZone(null)} className="absolute top-2 right-2 p-1 hover:bg-[var(--bg-sunken)] rounded-full text-[var(--fg-4)] hover:text-[var(--fg-1)] transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                    <h4 className="font-bold text-[var(--fg-1)] uppercase tracking-wide mb-2 text-sm">Foundational Growth</h4>
                    <p className="text-xs text-[var(--fg-2)] leading-relaxed mb-3">
                        You are in the building phase (Low Maturity, Low Readiness).
                    </p>
                    <p className="text-xs font-medium text-[var(--fg-1)] border-l-2 border-[var(--aos-mist)] pl-3">
                        Focus on validating your core offer and finding product-market fit before worrying about complex systems.
                    </p>
                </div>
            )}

            {/* Q3: Momentum Building (Top Left) */}
            {activeZone === 'momentum' && (
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-[var(--aos-insight-tint)] border-b border-r border-[var(--aos-insight)] z-20 p-6 animate-in zoom-in-95 duration-200 shadow-xl flex flex-col justify-center">
                    <button onClick={() => setActiveZone(null)} className="absolute top-2 right-2 p-1 hover:bg-[var(--aos-insight-tint)] rounded-full text-[var(--aos-insight)] hover:opacity-70 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                    <h4 className="font-bold text-[var(--fg-1)] uppercase tracking-wide mb-2 text-sm">Momentum Building</h4>
                    <p className="text-xs text-[var(--fg-2)] leading-relaxed mb-3">
                        High energy but fragile systems (Low Maturity, High Readiness).
                    </p>
                    <p className="text-xs font-medium text-[var(--fg-1)] border-l-2 border-[var(--aos-insight)] pl-3">
                        You are selling well, but risk breaking operations if you scale too fast. Stabilize your backend.
                    </p>
                </div>
            )}

            {/* Q1: Scale-Ready (Top Right) */}
            {activeZone === 'scale' && (
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[var(--aos-success-tint)] border-b border-l border-[var(--aos-success)] z-20 p-6 animate-in zoom-in-95 duration-200 shadow-xl flex flex-col justify-center">
                    <button onClick={() => setActiveZone(null)} className="absolute top-2 right-2 p-1 hover:bg-[var(--aos-success-tint)] rounded-full text-[var(--aos-success)] hover:opacity-70 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                    <h4 className="font-bold text-[var(--fg-1)] uppercase tracking-wide mb-2 text-sm">Scale-Ready Zone</h4>
                    <p className="text-xs text-[var(--fg-2)] leading-relaxed mb-3">
                        The Sweet Spot (High Maturity, High Readiness).
                    </p>
                    <p className="text-xs font-medium text-[var(--fg-1)] border-l-2 border-[var(--aos-success)] pl-3">
                        Your systems can support your speed. Press the accelerator—you are structurally sound for growth.
                    </p>
                </div>
            )}

            {/* Q2: Misalignment (Bottom Right) */}
            {activeZone === 'misaligned' && (
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[var(--aos-warning-tint)] border-t border-l border-[var(--aos-warning)] z-20 p-6 animate-in zoom-in-95 duration-200 shadow-xl flex flex-col justify-center">
                    <button onClick={() => setActiveZone(null)} className="absolute top-2 right-2 p-1 hover:bg-[var(--aos-warning-tint)] rounded-full text-[var(--aos-warning)] hover:opacity-70 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                    <h4 className="font-bold text-[var(--fg-1)] uppercase tracking-wide mb-2 text-sm">Structural Misalignment</h4>
                    <p className="text-xs text-[var(--fg-2)] leading-relaxed mb-3">
                        Strong systems, unresponsive team (High Maturity, Low Readiness).
                    </p>
                    <p className="text-xs font-medium text-[var(--fg-1)] border-l-2 border-[var(--aos-warning)] pl-3">
                        You risk bureaucracy slowing you down. Focus on culture, team buy-in, and agility.
                    </p>
                </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis type="number" dataKey="x" domain={[0, 100]} hide />
                    <YAxis type="number" dataKey="y" domain={[0, 100]} hide />
                    <ZAxis range={[100, 100]} />

                    {/* Q4: Foundational Growth (Low/Low) */}
                    {/* @ts-ignore: Recharts type definition fix */}
                    <ReferenceArea
                        x1={0} x2={50} y1={0} y2={50}
                        fill="#f1f5f9" stroke="none"
                        onClick={() => handleZoneClick('foundation')}
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-300"
                    >
                        <Label value="Foundational Growth" position="center" className="fill-[var(--fg-3)] font-bold text-xs uppercase tracking-widest opacity-90 pointer-events-none" />
                    </ReferenceArea>

                    {/* Q3: Momentum Building (Low Mat / High Read) */}
                    {/* @ts-ignore: Recharts type definition fix */}
                    <ReferenceArea
                        x1={0} x2={50} y1={50} y2={100}
                        fill="#dbeafe" stroke="none"
                        onClick={() => handleZoneClick('momentum')}
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-300"
                    >
                        <Label value="Momentum Building" position="center" className="fill-[var(--aos-insight)] font-bold text-xs uppercase tracking-widest opacity-90 pointer-events-none" />
                    </ReferenceArea>

                    {/* Q2: Structural Misalignment (High Mat / Low Read) */}
                    {/* @ts-ignore: Recharts type definition fix */}
                    <ReferenceArea
                        x1={50} x2={100} y1={0} y2={50}
                        fill="#fef3c7" stroke="none"
                        onClick={() => handleZoneClick('misaligned')}
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-300"
                    >
                        <Label value="Structural Misalignment" position="center" className="fill-[var(--aos-warning)] font-bold text-xs uppercase tracking-widest opacity-90 pointer-events-none" />
                    </ReferenceArea>

                    {/* Q1: Scale-Ready Zone (High/High) */}
                    {/* @ts-ignore: Recharts type definition fix */}
                    <ReferenceArea
                        x1={50} x2={100} y1={50} y2={100}
                        fill="#d1fae5" stroke="none"
                        onClick={() => handleZoneClick('scale')}
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-300"
                    >
                        <Label value="Scale-Ready Zone" position="center" className="fill-[var(--aos-success)] font-bold text-xs uppercase tracking-widest opacity-100 pointer-events-none" />
                    </ReferenceArea>

                    {/* Center Lines */}
                    <ReferenceLine x={50} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" />
                    <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" />

                    {/* The User Dot - Only rendered if no zone is active to prevent z-fighting/visual clutter, or keep it? 
                        User said "only real hover text comes when you go over the dot". 
                        Keep it visible. The active card will cover it naturally due to z-index. 
                    */}
                    <Scatter
                        data={data}
                        fill="#0f172a"
                        shape={(props: any) => {
                            const { cx, cy } = props;
                            return (
                                <g className="cursor-help">
                                    <circle cx={cx} cy={cy} r={20} fill="#0f172a" fillOpacity={0.1} className="animate-pulse" />
                                    <circle cx={cx} cy={cy} r={8} fill="#0f172a" stroke="#fff" strokeWidth={2} />
                                </g>
                            );
                        }}
                    />

                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} />
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};
