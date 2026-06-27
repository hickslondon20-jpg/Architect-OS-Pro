import React from 'react';
import { Card, PageHeader, PlaceholderContent } from '../../components/ui';

export const InitiativeLibrary: React.FC = () => {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Initiative Library"
                subtitle="Browse and select initiatives tailored to your stage and capability needs."
            />
            <Card className="p-6 min-h-[400px]">
                <PlaceholderContent text="Library of stage-specific initiatives and templates" />
            </Card>
        </div>
    );
};
