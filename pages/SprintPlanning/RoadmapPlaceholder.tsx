import React from 'react';
import { Card, PlaceholderContent } from '../../components/ui';

export const RoadmapPlaceholder: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sprint Roadmap</h1>
                    <p className="text-slate-500">Timeline view of your strategic initiatives</p>
                </div>
            </div>
            <Card className="p-8 min-h-[400px] flex items-center justify-center">
                <PlaceholderContent text="Roadmap view coming soon" />
            </Card>
        </div>
    );
};
