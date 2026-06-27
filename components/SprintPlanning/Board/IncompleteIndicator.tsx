import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface IncompleteIndicatorProps {
    className?: string; // Allow custom positioning/margins
    text?: string;
}

export const IncompleteIndicator: React.FC<IncompleteIndicatorProps> = ({
    className = "",
    text = "Missing Details"
}) => {
    return (
        <div
            className={`inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500 p-1 hover:bg-amber-100 transition-colors ${className}`}
            title={text}
        >
            <AlertCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
        </div>
    );
};
