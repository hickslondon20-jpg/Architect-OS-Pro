import React from 'react';
import { Card, PlaceholderContent } from '../../components/ui';

export const ProgressPlaceholder: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sprint Progress</h1>
                    <p className="text-slate-500">Track velocity and completion rates</p>
                </div>
            </div>
            <Card className="p-8 min-h-[400px] flex items-center justify-center">
                <PlaceholderContent text="Progress tracking coming soon" />
            </Card>
        </div>
    );
};
