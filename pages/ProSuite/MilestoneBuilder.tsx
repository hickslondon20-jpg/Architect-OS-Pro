import React from 'react';
import { Card, PageHeader, PlaceholderContent } from '../../components/ui';

export const MilestoneBuilder: React.FC = () => {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Milestone Builder"
                subtitle="Break down initiatives into actionable milestones."
            />
            <Card className="p-6 min-h-[400px]">
                <PlaceholderContent text="Interactive builder for initiative milestones" />
            </Card>
        </div>
    );
};
