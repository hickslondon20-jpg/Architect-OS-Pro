import React from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, PlaceholderContent, Button } from '../components/ui';
import { ArrowRight, Lock, Compass } from 'lucide-react';
import { AssessmentWizard } from '../components/tools/ae-ladder/AssessmentWizard';

export const ToolsLanding: React.FC = () => (
  <div>
    <PageHeader title="Tools & Assessments" subtitle="Diagnostic and planning tools to guide your growth." />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link to="/foundations/gv-simulator" className="block group">
        <Card className="p-6 h-full hover:border-[var(--aos-brass)] transition-colors">
          <h3 className="text-lg font-bold text-[var(--fg-1)] group-hover:text-[var(--aos-brass)]">GV Simulator</h3>
          <p className="mt-2 text-sm text-[var(--fg-3)]">Growth Velocity Intelligence. Test the feasibility of your growth targets.</p>
          <div className="mt-4 flex items-center text-sm font-medium text-[var(--aos-brass)]">Open Tool <ArrowRight className="ml-1 h-4 w-4" /></div>
        </Card>
      </Link>

      <Link to="/diagnostics/ae-ladder" className="block group">
        <Card className="p-6 h-full hover:border-[var(--aos-brass)] transition-colors">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-[var(--fg-1)] group-hover:text-[var(--aos-brass)]">AE Ladder Assessment</h3>
            <span className="text-xs bg-[var(--bg-sunken)] text-[var(--fg-2)] px-2 py-1 rounded">Tier 1</span>
          </div>
          <p className="mt-2 text-sm text-[var(--fg-3)]">Determine your exact agency stage and primary focus areas.</p>
          <div className="mt-4 flex items-center text-sm font-medium text-[var(--aos-brass)]">Open Assessment <ArrowRight className="ml-1 h-4 w-4" /></div>
        </Card>
      </Link>

      <Link to="/diagnostics/mr-audit" className="block group">
        <Card className="p-6 h-full hover:border-[var(--aos-brass)] transition-colors">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-[var(--fg-1)] group-hover:text-[var(--aos-brass)]">M&R Audit</h3>
            <span className="text-xs bg-[var(--bg-sunken)] text-[var(--fg-2)] px-2 py-1 rounded">Tier 2</span>
          </div>
          <p className="mt-2 text-sm text-[var(--fg-3)]">Maturity & Readiness. Deep dive into 125 capability checkpoints.</p>
          <div className="mt-4 flex items-center text-sm font-medium text-[var(--aos-brass)]">Open Audit <ArrowRight className="ml-1 h-4 w-4" /></div>
        </Card>
      </Link>

      <Link to="/foundations/architect-evolution" className="block group">
        <Card className="p-6 h-full hover:border-[var(--aos-brass)] transition-colors">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-[var(--fg-1)] group-hover:text-[var(--aos-brass)] flex items-center gap-2">
              <Compass className="h-5 w-5" /> Architect Evolution
            </h3>
            <span className="text-xs bg-[var(--bg-sunken)] text-[var(--fg-2)] px-2 py-1 rounded">~3 min</span>
          </div>
          <p className="mt-2 text-sm text-[var(--fg-3)]">Understand how you currently show up in your business.</p>
          <div className="mt-4 flex items-center text-sm font-medium text-[var(--aos-brass)]">Start Assessment <ArrowRight className="ml-1 h-4 w-4" /></div>
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
  <Card className="p-6 min-h-[400px]">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold text-[var(--fg-1)]">Scenario Planner</h2>
      <Lock className="h-5 w-5 text-[var(--fg-4)]" />
    </div>
    <PlaceholderContent text="Multi-scenario comparison (Pro Tier)" />
  </Card>
);

import { LockedState } from '../components/tools/ae-ladder/shared/LockedState';

// AE Ladder
export { AssessmentIntro as AEIntro } from '../components/tools/ae-ladder/AssessmentIntro';
export const AEAssessment: React.FC = () => (
  <AssessmentWizard />
);
export { AEResultsDashboard } from '../components/tools/ae-ladder/ResultsDashboard';
export { AEStageProfile } from '../components/tools/ae-ladder/StageProfile';
export { AELadderLayout } from '../components/tools/ae-ladder/AELadderLayout';

// M&R Audit
import { AuditOverview } from '../components/tools/maturity-audit/AuditOverview';
import { AssessmentWizard as MRAssessmentWizardComponent } from '../components/tools/maturity-audit/AssessmentWizard';
export { ResultsDashboard as MRResults } from '../components/tools/maturity-audit/dashboard/ResultsDashboard';

export const MRAuditOverview: React.FC = () => (
  <AuditOverview />
);

export const MRAssessment: React.FC = () => (
  <MRAssessmentWizardComponent />
);

export const MRDeepDive: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Deep Dive & Next Steps</h2>
    <PlaceholderContent text="Detailed capability breakdowns" />
  </Card>
);
