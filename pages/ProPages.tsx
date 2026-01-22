import React from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, PlaceholderContent } from '../components/ui';
import { Lock } from 'lucide-react';

export const ProLanding: React.FC = () => (
  <div>
    <PageHeader title="Architect OS Pro Suite" subtitle="Strategic execution workspace." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       <Link to="/pro/dashboard">
          <Card className="p-6 hover:shadow-md transition-shadow">
             <h3 className="text-lg font-bold">Pro Dashboard</h3>
             <p className="text-sm text-slate-500 mt-2">Suite overview and quick actions.</p>
          </Card>
       </Link>
       <Link to="/pro/sprint-planning">
          <Card className="p-6 hover:shadow-md transition-shadow">
             <h3 className="text-lg font-bold">Sprint Planning</h3>
             <p className="text-sm text-slate-500 mt-2">Quarterly setup, sprint board, and roadmap.</p>
          </Card>
       </Link>
        <Link to="/pro/virtual-cso/bi">
          <Card className="p-6 hover:shadow-md transition-shadow">
             <h3 className="text-lg font-bold">Virtual CSO - BI</h3>
             <p className="text-sm text-slate-500 mt-2">Business intelligence and trend visualization.</p>
          </Card>
       </Link>
        <Link to="/pro/virtual-cso/strategy">
          <Card className="p-6 hover:shadow-md transition-shadow">
             <h3 className="text-lg font-bold">Virtual CSO - Strategy</h3>
             <p className="text-sm text-slate-500 mt-2">AI-powered strategy sessions.</p>
          </Card>
       </Link>
    </div>
  </div>
);

export const ProDashboard: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-xl font-bold">Pro Suite Dashboard</h2>
      </div>
      <PlaceholderContent text="Suite overview, quarter snapshot, integration status" />
   </Card>
);

// Sprint Planning Sub-pages
export const SprintSetup: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
     <h2 className="text-lg font-semibold mb-4">Current Quarter Setup</h2>
     <PlaceholderContent text="Define quarterly vision, AI-generated 3P priorities" />
  </Card>
);
export const SprintBoard: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
     <h2 className="text-lg font-semibold mb-4">Sprint Board</h2>
     <PlaceholderContent text="Kanban-style interface" />
  </Card>
);
export const SprintRoadmap: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
     <h2 className="text-lg font-semibold mb-4">Roadmap View</h2>
     <PlaceholderContent text="Timeline visualization" />
  </Card>
);
export const SprintProgress: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
     <h2 className="text-lg font-semibold mb-4">Progress Tracker</h2>
     <PlaceholderContent text="Real-time status, velocity tracking" />
  </Card>
);
export const SprintArchive: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
     <h2 className="text-lg font-semibold mb-4">Historical Archive</h2>
     <PlaceholderContent text="Past quarter snapshots" />
  </Card>
);

// Virtual CSO
export const VirtualCSOBI: React.FC = () => (
  <div className="space-y-6">
    <PageHeader title="Virtual CSO - Business Intelligence" />
    <Card className="p-6">
       <h3 className="text-lg font-semibold mb-4">Data Upload Hub</h3>
       <PlaceholderContent text="P&Ls, balance sheets upload" />
    </Card>
    <Card className="p-6">
       <h3 className="text-lg font-semibold mb-4">Trend Visualization</h3>
       <PlaceholderContent text="Charts, comparisons, benchmarks" />
    </Card>
  </div>
);

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