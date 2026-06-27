import React from 'react';
import { Card, PlaceholderContent } from '../../components/ui';

export const VirtualCSOStrategy: React.FC = () => (
    <div className="h-[calc(100vh-200px)] grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="col-span-1 p-4">
            <h3 className="font-semibold mb-4">Session History</h3>
            <PlaceholderContent text="Previous sessions" />
        </Card>
        <Card className="col-span-3 p-4 flex flex-col">
            <h3 className="font-semibold mb-4">Strategy Session</h3>
            <div className="flex-1">
                <PlaceholderContent text="Chat Interface: Context-aware AI advisor" />
            </div>
        </Card>
    </div>
);
