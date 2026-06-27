import React from 'react';
import { Card, Button } from '../../../ui';
import { Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LockedStateProps {
    title?: string;
    message?: string;
}

export const LockedState: React.FC<LockedStateProps> = ({
    title = "Unlock Your Insights",
    message = "Complete the AE Ladder Assessment to reveal your personalized results and stage profile."
}) => {
    const navigate = useNavigate();

    return (
        <Card className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 bg-[var(--bg-canvas)] border-dashed">
            <div className="h-16 w-16 bg-[var(--bg-sunken)] rounded-full flex items-center justify-center mb-6">
                <Lock className="h-8 w-8 text-[var(--fg-3)]" />
            </div>

            <h3 className="text-2xl font-semibold mb-3">{title}</h3>
            <p className="text-center text-[var(--fg-2)] max-w-md mb-8">
                {message}
            </p>

            <Button
                size="lg"
                onClick={() => navigate('/diagnostics/ae-ladder/assessment')}
                className="gap-2"
            >
                Start Assessment <ArrowRight className="h-4 w-4" />
            </Button>
        </Card>
    );
};
