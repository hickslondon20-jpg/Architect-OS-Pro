import React from 'react';

interface ProgressIndicatorProps {
    currentStep: number; // 0-based index
    totalSteps: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, totalSteps }) => {
    // Calculate percentage based on completed questions (so start at somewhere reasonable or 0?)
    // Prompt says: (currentQuestion / 19) * 100.
    // If currentStep is 0 (Question 1), prompt example says "42% Complete" for Q8.
    // 8/19 = 42%. So (currentStep + 1) / totalSteps.

    const progressPercentage = Math.round(((currentStep + 1) / totalSteps) * 100);

    return (
        <div className="w-full max-w-3xl mx-auto mb-8 px-4 sm:px-0">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end text-sm text-[var(--fg-3)] mb-1">
                    <span className="font-medium text-[var(--fg-2)]">Progress</span>
                    <span className="font-medium text-[var(--aos-brass)]">{progressPercentage}% Complete</span>
                </div>

                {/* Progress Bar Track */}
                <div className="h-2.5 w-full bg-[var(--bg-sunken)] rounded-full overflow-hidden shadow-inner">
                    {/* Progress Bar Fill */}
                    <div
                        className="h-full bg-[var(--aos-brass)] transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                <div className="text-center mt-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[var(--fg-3)]">
                        Question {currentStep + 1} of {totalSteps}
                    </span>
                </div>
            </div>
        </div>
    );
};
