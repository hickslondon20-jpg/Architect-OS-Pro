import React from 'react';
import { Card, PageHeader, PlaceholderContent } from '../components/ui';

export const DashboardPage: React.FC = () => {
  return (
    <div>
      <PageHeader 
        title="Dashboard" 
        subtitle="Welcome back. Here is your agency's strategic overview." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="h-20 flex items-center justify-center">
             <span className="text-slate-400 font-medium">Hero Stats Placeholder</span>
          </div>
        </Card>
        <Card className="p-6">
           <div className="h-20 flex items-center justify-center">
             <span className="text-slate-400 font-medium">Hero Stats Placeholder</span>
          </div>
        </Card>
        <Card className="p-6">
           <div className="h-20 flex items-center justify-center">
             <span className="text-slate-400 font-medium">Hero Stats Placeholder</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="p-6 h-64">
             <h3 className="text-lg font-medium text-slate-900 mb-4">Current Quarter Preview</h3>
             <PlaceholderContent text="Pro Tier Feature" />
         </Card>
         <Card className="p-6 h-64">
             <h3 className="text-lg font-medium text-slate-900 mb-4">Recent Activity</h3>
             <PlaceholderContent text="Activity Feed" />
         </Card>
      </div>
    </div>
  );
};