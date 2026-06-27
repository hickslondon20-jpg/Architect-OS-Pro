import React from 'react';
import { Card, PageHeader, PlaceholderContent } from '../../components/ui';

export const NotesLog: React.FC = () => {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Notes & Priority Log"
                subtitle="Capture strategic context, decisions, and observations."
            />
            <Card className="p-6 min-h-[400px]">
                <PlaceholderContent text="Continuous log of strategic notes and priority shifts" />
            </Card>
        </div>
    );
};
