import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card } from '../../ui';

export const SynthesisEchoCard: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Placeholder text from spec
    const text = "Focusing on Cash Flow Forecasting and Pipeline Health simultaneously this quarter implies that financial visibility infrastructure needs to be in place before pipeline activity scales. This suggests sequencing the financial work in the first half of the quarter, with pipeline initiatives beginning once core reporting is functional.";

    return (
        <div className={`relative transition-all duration-300 ease-in-out ${isCollapsed ? 'mb-4' : 'mb-8'}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg z-10" />
            <Card className={`bg-slate-50 border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${isCollapsed ? 'py-3 px-6' : 'p-6'}`}>
                <div className="flex items-start gap-4">
                    <div className="hidden sm:flex mt-1 p-2 bg-blue-100/50 rounded-lg">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div className={`prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium ${isCollapsed ? 'line-clamp-1' : ''}`}>
                                {text}
                            </div>
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="ml-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                aria-label={isCollapsed ? "Expand insight" : "Collapse insight"}
                            >
                                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
