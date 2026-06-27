import React from 'react';
import { Card } from '../../ui';

export const QuarterOverviewCard: React.FC = () => {
    // Mock Data
    const progressPercentage = 58;
    const circumference = 2 * Math.PI * 24; // radius 24
    const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

    return (
        <Card className="bg-white border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">

                {/* 1. Progress Ring */}
                <div className="flex items-center gap-4 w-1/4 justify-center border-r border-slate-100">
                    <div className="relative w-14 h-14">
                        {/* Background Circle */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                stroke="#F1F5F9"
                                strokeWidth="4"
                                fill="transparent"
                            />
                            {/* Progress Circle */}
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                stroke="#3B82F6"
                                strokeWidth="4"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 leading-none">58%</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">overall complete</div>
                    </div>
                </div>

                {/* 2. Pace Signal */}
                <div className="flex flex-col items-center w-1/4 justify-center border-r border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">PACE</div>
                    <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                        On Track
                    </div>
                </div>

                {/* 3. Initiative Health */}
                <div className="flex flex-col items-center w-1/4 justify-center border-r border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">INITIATIVES</div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-slate-500 font-medium">2 On Track</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-xs text-slate-500 font-medium">1 At Risk</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-xs text-slate-500 font-medium">0 Blocked</span>
                        </div>
                    </div>
                </div>

                {/* 4. Timeline */}
                <div className="flex flex-col items-center w-1/4 justify-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">TIMELINE</div>
                    <div className="text-sm font-semibold text-slate-700">
                        42 days remaining
                    </div>
                </div>

            </div>
        </Card>
    );
};
