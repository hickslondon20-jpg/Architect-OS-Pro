import React from 'react';
import { ArrowRight, Target } from 'lucide-react';

interface Props {
    onNext: () => void;
    selectedFraming: string;
    onSelectFraming: (framing: string) => void;
}

const framingOptions = [
    {
        id: 'stabilize',
        label: 'Stabilize and create visibility',
        desc: 'Focus on getting control of the core numbers, organizing delivery structures, and knowing exactly where the agency stands. You are buying yourself space to operate without anxiety.',
        exclusion: 'Growth experiments or bold market moves.'
    },
    {
        id: 'elevate',
        label: 'Elevate the service delivery model',
        desc: 'Focus on upgrading how you sell and deliver to command better margins. You are moving from reacting to client requests to running a documented, structured process.',
        exclusion: 'High-volume lead gen without fixing capacity first.'
    },
    {
        id: 'scale',
        label: 'Scale outbound and positioning',
        desc: 'Focus on taking a proven offering to a wider audience. You have the operational capacity to handle more work, and the sole focus is filling the pipeline predictably.',
        exclusion: 'Internal revamps or new product development.'
    }
];

export const Step3_DirectionalFocus: React.FC<Props> = ({ onNext, selectedFraming, onSelectFraming }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl mx-auto">
            <div className="text-center space-y-4 mb-10">
                <Target className="w-8 h-8 text-blue-600 mx-auto" />
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight leading-snug">
                    For the next 12 weeks, what kind of work does this sprint need to be primarily about?
                </h1>
            </div>

            <div className="space-y-4">
                {framingOptions.map(option => (
                    <div
                        key={option.id}
                        onClick={() => onSelectFraming(option.id)}
                        className={`
                            relative p-6 rounded-xl border-2 text-left cursor-pointer transition-all duration-200
                            ${selectedFraming === option.id
                                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
                        `}
                    >
                        <div className="flex items-center mb-3 gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center
                                ${selectedFraming === option.id ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                {selectedFraming === option.id && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <h3 className={`font-semibold text-lg ${selectedFraming === option.id ? 'text-blue-900' : 'text-slate-900'}`}>
                                {option.label}
                            </h3>
                        </div>

                        <p className="text-slate-600 pl-8 mb-4 leading-relaxed">
                            {option.desc}
                        </p>

                        <div className="pl-8 flex items-start gap-2 text-sm">
                            <span className="font-semibold text-slate-900 shrink-0">What this sprint is NOT about:</span>
                            <span className="text-slate-500">{option.exclusion}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center pt-2">
                <p className="text-sm text-slate-500 italic">This isn't your sprint goal yet. It's the frame that will shape it.</p>
            </div>

            <div className="pt-8 flex justify-center">
                <button
                    onClick={onNext}
                    disabled={!selectedFraming}
                    className={`flex items-center gap-2 px-8 py-3 rounded-md font-medium transition-all group
                        ${selectedFraming
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:gap-3 cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                    Continue
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};
