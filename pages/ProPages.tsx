import React from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, PlaceholderContent } from '../components/ui';
import { Lock, ArrowRight, LayoutDashboard, Map, BrainCircuit, BarChart3, Rocket } from 'lucide-react';

export const ProLanding: React.FC = () => (
   <div className="space-y-8 max-w-7xl mx-auto pb-12">

      {/* Welcome Hero */}
      <div className="relative bg-slate-900 rounded-2xl p-8 md:p-12 text-white overflow-hidden shadow-xl">
         <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 rounded-full px-3 py-1 text-sm font-medium text-indigo-300 mb-6">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
               </span>
               Execution Layer Active
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-white">
               Welcome to your Execution Workspace
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
               You've diagnosed your agency's maturity. Now, let's turn those insights into action.
               The Pro Suite is your operating system for systematic growth—combining strategic planning,
               intelligent guidance, and rigorous progress tracking.
            </p>
         </div>

         {/* Abstract Background Elements */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-700/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>
      </div>

      {/* Feature Grid - Bento Box Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

         {/* Primary Action: Strategic Roadmap (Spans 2 columns) */}
         <Link to="/pro/quarter-map" className="md:col-span-2 group">
            <Card className="h-full p-8 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 hover:shadow-lg hover:border-indigo-200 transition-all relative overflow-hidden">
               <div className="relative z-10 flex flex-col h-full justify-between items-start gap-6">
                  <div className="space-y-4">
                     <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                        <Map className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">Strategic Roadmap</h3>
                        <p className="text-slate-600 mt-2 text-lg max-w-lg">
                           Translate your M&R Audit insights into a concrete 12-month plan and focused quarterly sprint.
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center text-indigo-700 font-semibold bg-white/50 px-4 py-2 rounded-full border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all">
                     Launch Roadmap Wizard <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
               </div>
            </Card>
         </Link>

         {/* Pro Dashboard */}
         <Link to="/pro/dashboard" className="group">
            <Card className="h-full p-6 hover:shadow-md transition-all border-slate-200 hover:border-slate-300">
               <div className="flex flex-col h-full justify-between">
                  <div>
                     <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-slate-800 transition-colors duration-300">
                        <LayoutDashboard className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900 mb-2">Command Center</h3>
                     <p className="text-sm text-slate-500">
                        Your real-time overview of growth velocity, score evolution, and sprint status.
                     </p>
                  </div>
                  <div className="mt-6 flex items-center text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                     View Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
               </div>
            </Card>
         </Link>

         {/* Sprint Planning */}
         <Link to="/pro/sprint-planning/board" className="group">
            <Card className="h-full p-6 hover:shadow-md transition-all border-slate-200 hover:border-slate-300 bg-gradient-to-br from-white to-blue-50/20">
               <div className="flex flex-col h-full justify-between">
                  <div>
                     <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors duration-300">
                        <Rocket className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900 mb-2">Sprint Planning</h3>
                     <p className="text-sm text-slate-500">
                        Manage your 90-day execution blocks. Prioritize, Plant, and Iterate on your strategic initiatives.
                     </p>
                  </div>
                  <div className="mt-6 flex items-center text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                     Open Board <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
               </div>
            </Card>
         </Link>

         {/* Virtual CSO - Strategy */}
         <Link to="/pro/virtual-cso/strategy" className="group">
            <Card className="h-full p-6 hover:shadow-md transition-all border-slate-200 hover:border-slate-300">
               <div className="flex flex-col h-full justify-between">
                  <div>
                     <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors duration-300">
                        <BrainCircuit className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900 mb-2">Virtual CSO: Strategy</h3>
                     <p className="text-sm text-slate-500">
                        AI-powered strategic guidance tailored to your stage and audit results.
                     </p>
                  </div>
                  <div className="mt-6 flex items-center text-sm font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                     Start Session <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
               </div>
            </Card>
         </Link>

         {/* Virtual CSO - BI */}
         <Link to="/pro/virtual-cso/bi" className="group md:col-span-1 lg:col-span-2">
            <Card className="h-full p-6 hover:shadow-md transition-all border-slate-200 hover:border-slate-300 flex flex-col md:flex-row items-center gap-6">
               <div className="flex-1">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors duration-300">
                     <BarChart3 className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Virtual CSO: Business Intelligence</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                     Deep dive into your financial health and growth trends. Upload P&Ls and visualize your trajectory.
                  </p>
               </div>
               <div className="md:border-l md:border-slate-100 md:pl-6 flex flex-col gap-2 min-w-[200px]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Capabilities</div>
                  <div className="text-sm text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Financial Trend Analysis</div>
                  <div className="text-sm text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Growth Velocity Tracking</div>
                  <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors mt-2 flex items-center cursor-pointer">
                     Access BI Tools <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
               </div>
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