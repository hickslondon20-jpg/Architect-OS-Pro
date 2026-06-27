import React from 'react';
import { Card, PlaceholderContent } from '../../components/ui';

export const ProDashboard: React.FC = () => (
    <Card className="p-6 min-h-[400px]">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Pro Suite Dashboard</h2>
        </div>
        <PlaceholderContent text="Suite overview, quarter snapshot, integration status" />
    </Card>
);
