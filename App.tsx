import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout, SectionLayout } from './components/Layouts';
import { AppProvider } from './context/AppContext';

// Pages
import { LandingPage, SignInPage, SignUpPage } from './pages/PublicPages';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';

// Snapshot Pages
import * as Snapshot from './pages/SnapshotPages';

// Clarity Pages
import * as Clarity from './pages/ClarityPages';

// Tools Pages
import * as Tools from './pages/ToolsPages';
import * as FounderEvolution from './pages/FounderEvolutionPages';
import { GVCalculator, GVScenarioPlanner } from './pages/GVCalculatorPage';

// Pro Pages
import * as Pro from './pages/ProPages';

// Settings Pages
import * as Settings from './pages/SettingsPages';

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />

          {/* Authenticated Routes */}
          <Route path="/" element={<DashboardLayout />}>
             {/* Redirect root app access to dashboard */}
             <Route path="app" element={<Navigate to="/dashboard" replace />} />
             
             <Route path="dashboard" element={<DashboardPage />} />
             <Route path="home" element={<Navigate to="/dashboard" replace />} />

             {/* Agency Snapshot Section */}
             <Route path="snapshot" element={<SectionLayout 
                title="Agency Snapshot" 
                tabs={[
                  { label: 'Dashboard', href: '/snapshot/dashboard' },
                  { label: 'Financial', href: '/snapshot/financial' },
                  { label: 'Growth & Pipeline', href: '/snapshot/growth' },
                  { label: 'Team & Capacity', href: '/snapshot/team' },
                  { label: 'Identity & Context', href: '/snapshot/business-identity' },
                ]}
             />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Snapshot.SnapshotDashboard />} />
                <Route path="financial" element={<Snapshot.FinancialSnapshot />} />
                <Route path="growth" element={<Snapshot.GrowthPipeline />} />
                <Route path="team" element={<Snapshot.TeamCapacity />} />
                <Route path="business-identity" element={<Snapshot.BusinessIdentity />} />
             </Route>

             {/* Clarity Compass Section */}
             <Route path="clarity-compass" element={<SectionLayout 
                title="Clarity Compass"
                tabs={[
                  { label: 'Strategic Synthesis', href: '/clarity-compass/synthesis' },
                  { label: 'Vision State', href: '/clarity-compass/vision-state' },
                  { label: 'Trade-offs', href: '/clarity-compass/trade-offs' },
                ]}
             />}>
                <Route index element={<Navigate to="synthesis" replace />} />
                <Route path="synthesis" element={<Clarity.StrategicSynthesis />} />
                <Route path="vision-state" element={<Clarity.VisionState />} />
                <Route path="trade-offs" element={<Clarity.TradeOffs />} />
             </Route>

             {/* Tools & Assessments Section */}
             <Route path="tools">
                <Route index element={<Tools.ToolsLanding />} />
                
                {/* Founder Evolution Assessment */}
                <Route path="founder-evolution">
                   <Route index element={<FounderEvolution.FounderEvolutionLanding />} />
                   <Route path="assessment" element={<FounderEvolution.FounderEvolutionAssessment />} />
                   <Route path="results" element={<FounderEvolution.FounderEvolutionResults />} />
                </Route>

                {/* GV Simulator */}
                <Route path="gv-simulator" element={<SectionLayout 
                  title="GV Simulator"
                  tabs={[
                    { label: 'Calculator', href: '/tools/gv-simulator/calculator' },
                    { label: 'Scenario Planner', href: '/tools/gv-simulator/scenarios' },
                  ]}
                />}>
                    <Route index element={<Navigate to="calculator" replace />} />
                    <Route path="calculator" element={<GVCalculator />} />
                    <Route path="scenarios" element={<GVScenarioPlanner />} />
                </Route>

                {/* AE Ladder */}
                <Route path="ae-ladder" element={<SectionLayout 
                  title="AE Ladder Assessment"
                  tabs={[
                    { label: 'Results', href: '/tools/ae-ladder/results' },
                    { label: 'Assessment', href: '/tools/ae-ladder/assessment' },
                    { label: 'Deep Dive', href: '/tools/ae-ladder/deep-dive' },
                  ]}
                />}>
                    <Route index element={<Navigate to="results" replace />} />
                    <Route path="results" element={<Tools.AEResults />} />
                    <Route path="assessment" element={<Tools.AEAssessment />} />
                    <Route path="deep-dive" element={<Tools.AEDeepDive />} />
                </Route>

                {/* M&R Audit */}
                <Route path="mr-audit" element={<SectionLayout 
                  title="M&R Audit"
                  tabs={[
                    { label: 'Results', href: '/tools/mr-audit/results' },
                    { label: 'Assessment', href: '/tools/mr-audit/assessment' },
                    { label: 'Deep Dive', href: '/tools/mr-audit/deep-dive' },
                  ]}
                />}>
                    <Route index element={<Navigate to="results" replace />} />
                    <Route path="results" element={<Tools.MRResults />} />
                    <Route path="assessment" element={<Tools.MRAssessment />} />
                    <Route path="deep-dive" element={<Tools.MRDeepDive />} />
                </Route>
             </Route>

             {/* Pro Suite Section */}
             <Route path="pro">
                <Route index element={<Pro.ProLanding />} />
                <Route path="dashboard" element={<Pro.ProDashboard />} />
                
                <Route path="sprint-planning" element={<SectionLayout 
                  title="Sprint Planning Tool"
                  tabs={[
                    { label: 'Setup', href: '/pro/sprint-planning/quarter-setup' },
                    { label: 'Sprint Board', href: '/pro/sprint-planning/board' },
                    { label: 'Roadmap', href: '/pro/sprint-planning/roadmap' },
                    { label: 'Progress', href: '/pro/sprint-planning/progress' },
                    { label: 'Archive', href: '/pro/sprint-planning/archive' },
                  ]}
                />}>
                    <Route index element={<Navigate to="quarter-setup" replace />} />
                    <Route path="quarter-setup" element={<Pro.SprintSetup />} />
                    <Route path="board" element={<Pro.SprintBoard />} />
                    <Route path="roadmap" element={<Pro.SprintRoadmap />} />
                    <Route path="progress" element={<Pro.SprintProgress />} />
                    <Route path="archive" element={<Pro.SprintArchive />} />
                </Route>
                
                <Route path="virtual-cso/bi" element={<Pro.VirtualCSOBI />} />
                <Route path="virtual-cso/strategy" element={<Pro.VirtualCSOStrategy />} />
             </Route>

             {/* Resources Section */}
             <Route path="resources" element={<ResourcesPage />} />

             {/* Settings Section */}
             <Route path="settings" element={<SectionLayout 
                title="Profile Settings"
                tabs={[
                  { label: 'Account', href: '/settings/account' },
                  { label: 'Subscription', href: '/settings/subscription' },
                  { label: 'Data Manager', href: '/settings/data' },
                  { label: 'Privacy', href: '/settings/privacy' },
                  { label: 'Referrals', href: '/settings/referrals' },
                ]}
             />}>
                <Route index element={<Navigate to="account" replace />} />
                <Route path="account" element={<Settings.AccountSettings />} />
                <Route path="subscription" element={<Settings.SubscriptionBilling />} />
                <Route path="data" element={<Settings.DataManager />} />
                <Route path="privacy" element={<Settings.PrivacySecurity />} />
                <Route path="referrals" element={<Settings.Referrals />} />
             </Route>

          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
};

export default App;