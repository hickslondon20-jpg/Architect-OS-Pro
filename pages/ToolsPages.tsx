import React from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, PlaceholderContent, Button } from '../components/ui';
import { ArrowRight, Lock, Compass } from 'lucide-react';

export const ToolsLanding: React.FC = () => (
  <div>
    <PageHeader title="Tools & Assessments" subtitle="Diagnostic and planning tools to guide your growth." />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       <Link to="/tools/gv-simulator" className="block group">
          <Card className="p-6 h-full hover:border-brand-300 transition-colors">
             <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600">GV Simulator</h3>
             <p className="mt-2 text-sm text-slate-500">Growth Velocity Intelligence. Test the feasibility of your growth targets.</p>
             <div className="mt-4 flex items-center text-sm font-medium text-brand-600">Open Tool <ArrowRight className="ml-1 h-4 w-4" /></div>
          </Card>
       </Link>
       
       <Link to="/tools/ae-ladder" className="block group">
          <Card className="p-6 h-full hover:border-brand-300 transition-colors">
             <div className="flex justify-between items-start">
               <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600">AE Ladder Assessment</h3>
               <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Tier 1</span>
             </div>
             <p className="mt-2 text-sm text-slate-500">Determine your exact agency stage and primary focus areas.</p>
             <div className="mt-4 flex items-center text-sm font-medium text-brand-600">Open Assessment <ArrowRight className="ml-1 h-4 w-4" /></div>
          </Card>
       </Link>

       <Link to="/tools/mr-audit" className="block group">
          <Card className="p-6 h-full hover:border-brand-300 transition-colors">
             <div className="flex justify-between items-start">
               <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600">M&R Audit</h3>
               <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Tier 2</span>
             </div>
             <p className="mt-2 text-sm text-slate-500">Maturity & Readiness. Deep dive into 125 capability checkpoints.</p>
             <div className="mt-4 flex items-center text-sm font-medium text-brand-600">Open Audit <ArrowRight className="ml-1 h-4 w-4" /></div>
          </Card>
       </Link>

       <Link to="/tools/founder-evolution" className="block group">
          <Card className="p-6 h-full hover:border-brand-300 transition-colors">
             <div className="flex justify-between items-start">
               <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 flex items-center gap-2">
                 <Compass className="h-5 w-5" /> Founder Evolution
               </h3>
               <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">~3 min</span>
             </div>
             <p className="mt-2 text-sm text-slate-500">Understand how you currently show up in your business.</p>
             <div className="mt-4 flex items-center text-sm font-medium text-brand-600">Start Assessment <ArrowRight className="ml-1 h-4 w-4" /></div>
          </Card>
       </Link>
    </div>
  </div>
);

// GV Simulator
export const GVCalculator: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Growth Velocity Calculator</h2>
    <PlaceholderContent text="Test feasibility of growth targets" />
  </Card>
);
export const GVScenarios: React.FC = () => (
  <Card className="p-6 min-h-[400px] border-slate-200 bg-slate-50">
    <div className="flex justify-between items-center mb-4">
       <h2 className="text-lg font-semibold text-slate-900">Scenario Planner</h2>
       <Lock className="h-5 w-5 text-slate-400" />
    </div>
    <PlaceholderContent text="Multi-scenario comparison (Pro Tier)" />
  </Card>
);

// AE Ladder
export const AEResults: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">AE Ladder Results</h2>
    <PlaceholderContent text="Stage badge, dimension scores, strengths/gaps" />
  </Card>
);
export const AEAssessment: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Assessment</h2>
    <PlaceholderContent text="19-question stage diagnostic" />
  </Card>
);
export const AEDeepDive: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Stage Deep Dive</h2>
    <PlaceholderContent text="Narrative explainer of stage" />
  </Card>
);

// M&R Audit
export const MRResults: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">M&R Audit Results</h2>
    <PlaceholderContent text="Overall scores, dimension analysis" />
  </Card>
);
export const MRAssessment: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Assessment</h2>
    <PlaceholderContent text="125 checkpoint questions" />
  </Card>
);
export const MRDeepDive: React.FC = () => (
   <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Deep Dive & Next Steps</h2>
    <PlaceholderContent text="Detailed capability breakdowns" />
  </Card>
);
