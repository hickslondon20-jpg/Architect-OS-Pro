import React from 'react';

export interface Question {
    id: string;
    category: string;
    text: string;
    responseValue: number | null;
}

interface QuestionCardProps {
    question: Question;
    selectedValue: number | null;
    onSelect: (value: number) => void;
    direction: 'left' | 'right' | 'none'; // For animation direction
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, selectedValue, onSelect, direction }) => {
    const getAnimationClass = () => {
        if (direction === 'left') return 'animate-slide-in-right';
        if (direction === 'right') return 'animate-slide-in-left';
        return 'animate-fade-in';
    };

    const options = [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Moderately' },
        { value: 4, label: 'Mostly' },
        { value: 5, label: 'Completely' },
    ];

    return (
        <>
            <style>
                {`
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-slide-in-right { animation: slideInRight 0.4s ease-out forwards; }
          .animate-slide-in-left { animation: slideInLeft 0.4s ease-out forwards; }
          .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        `}
            </style>
            <div className={`w-full max-w-2xl mx-auto bg-[var(--bg-surface)] rounded-2xl shadow-[var(--shadow-soft-1)] border border-[var(--aos-mist)] p-8 md:p-10 transition-all duration-300 ${getAnimationClass()}`}>
                <div className="mb-8">
                    <span className="inline-block px-3 py-1 rounded-full bg-[var(--bg-sunken)] text-xs font-semibold text-[var(--fg-3)] mb-4 tracking-wide uppercase">
                        {question.category}
                    </span>
                    <h2 className="text-xl md:text-2xl font-medium text-[var(--fg-1)] leading-relaxed">
                        {question.text}
                    </h2>
                </div>

                <div className="space-y-3">
                    {options.map((option) => {
                        const isSelected = selectedValue === option.value;

                        return (
                            <button
                                key={option.value}
                                onClick={() => onSelect(option.value)}
                                className={`
                  w-full group flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ease-in-out text-left outline-none focus:ring-2 focus:ring-[var(--aos-brass)] focus:ring-offset-1
                  ${isSelected
                                        ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] shadow-sm'
                                        : 'border-[var(--aos-mist)] hover:border-[var(--aos-steel-blue)] hover:bg-[var(--bg-sunken)]'
                                    }
                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`
                      flex items-center justify-center w-6 h-6 rounded-full border transition-colors duration-200
                      ${isSelected
                                                ? 'border-[var(--aos-brass)] bg-[var(--aos-brass)] text-white'
                                                : 'border-[var(--aos-mist)] bg-[var(--bg-surface)] group-hover:border-[var(--aos-steel-blue)]'
                                            }
                    `}
                                    >
                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                    </div>
                                    <span className={`text-base ${isSelected ? 'font-medium text-[var(--fg-1)]' : 'text-[var(--fg-1)]'}`}>
                                        {option.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
