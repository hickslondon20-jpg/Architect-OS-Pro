import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout, SectionLayout } from './components/Layouts';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeatureGate } from './components/FeatureGate';
import { FeatureKey } from './lib/featureGates';

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
import * as ArchitectEvolution from './pages/ArchitectEvolutionPages';
import { GVCalculator, GVScenarioPlanner } from './pages/GVCalculatorPage';

// Pro Pages
import * as Pro from './pages/ProSuite';
import * as Foundations from './pages/Foundations';
import * as Diagnostics from './pages/Diagnostics';

// Settings Pages
import * as Settings from './pages/SettingsPages';
import * as SprintPlanning from './pages/SprintPlanning';
import { SprintGoalFlowPage } from './pages/SprintPlanning/SprintGoalFlow/SprintGoalFlowPage';
import { CapabilityContextPage } from './pages/SprintPlanning/CapabilityContext/CapabilityContextPage';
import { SprintReviewLockPage } from './pages/SprintPlanning/SprintReviewLock/SprintReviewLockPage';
import { SprintPostureSynthesis } from './pages/SprintPlanning/SprintSynthesis/SprintPostureSynthesis';

// Quarter Map Components
import { QuarterMapLayout } from './components/pro-suite/quarter-map/QuarterMapLayout';
import { QuarterMapSectionLayout } from './components/pro-suite/quarter-map/QuarterMapSectionLayout';
import { OrientationTab } from './pages/pro-suite/quarter-map/OrientationTab';
import { StrategicHorizonsTab } from './pages/pro-suite/quarter-map/StrategicHorizonsTab';
import { Plan12MonthTab } from './pages/pro-suite/quarter-map/Plan12MonthTab';
import { QuarterSequenceTab } from './pages/pro-suite/quarter-map/QuarterSequenceTab';
import { CurrentQuarterFocusTab } from './pages/pro-suite/quarter-map/CurrentQuarterFocusTab';
import { PlaceholderContent } from './components/ui';
import { OSEngineLocked } from './components/pro-suite/os-engine/OSEngineLocked';
import { VirtualCSOLocked } from './components/pro-suite/virtual-cso/VirtualCSOLocked';
import { SkillsLibraryLocked } from './components/pro-suite/skills/SkillsLibraryLocked';

const App: React.FC = () => {
  const gated = (featureKey: FeatureKey, element: React.ReactNode) => (
    <FeatureGate featureKey={featureKey}>{element}</FeatureGate>
  );

  return (
    <AuthProvider>
      <AppProvider>
        <ErrorBoundary>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/sign-up" element={<SignUpPage />} />

              {/* Authenticated Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardLayout />}>
                  {/* Redirect root app access to dashboard */}
                  <Route path="app" element={<Navigate to="/dashboard" replace />} />
                  <Route path="architect-os" element={<Navigate to="/pro" replace />} />

                  <Route path="dashboard" element={gated('dashboard', <DashboardPage />)} />
                  <Route path="home" element={<Navigate to="/dashboard" replace />} />

                  {/* Foundations Section */}
                  <Route path="foundations" element={<Foundations.FoundationsLayout />}>
                    <Route index element={gated('foundations', <Foundations.FoundationsLanding />)} />

                    {/* Agency Snapshot */}
                    <Route path="snapshot" element={gated('agency_snapshot', <SectionLayout
                      eyebrow="Foundations"
                      title="Agency Snapshot"
                      tabs={[
                        { label: 'Dashboard', href: '/foundations/snapshot/dashboard' },
                        { label: 'Market Footprint', href: '/foundations/snapshot/market-footprint' },
                        { label: 'Economic Foundation', href: '/foundations/snapshot/economic-foundation' },
                        { label: 'Revenue Model', href: '/foundations/snapshot/revenue-model' },
                        { label: 'Delivery Architecture', href: '/foundations/snapshot/delivery-architecture' },
                      ]}
                    />)}>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<Snapshot.SnapshotDashboard />} />
                      <Route path="economic-foundation" element={<Snapshot.FinancialSnapshot />} />
                      <Route path="revenue-model" element={<Snapshot.GrowthPipeline />} />
                      <Route path="delivery-architecture" element={<Snapshot.DeliveryArchitectureTab />} />
                      <Route path="market-footprint" element={<Snapshot.IdentityPositioning />} />
                    </Route>

                    {/* Clarity Compass */}
                    <Route path="clarity-compass" element={gated('clarity_compass', <SectionLayout
                      eyebrow="Foundations"
                      title="Clarity Compass"
                      tabs={[
                        { label: 'Vision State', href: '/foundations/clarity-compass/vision-state' },
                        { label: 'Dashboard', href: '/foundations/clarity-compass/dashboard' },
                        { label: 'History', href: '/foundations/clarity-compass/history' },
                      ]}
                    />)}>
                      <Route index element={<Navigate to="vision-state" replace />} />
                      <Route path="vision-state" element={<Clarity.VisionState />} />
                      <Route path="dashboard" element={<Clarity.ClarityDashboard />} />
                      <Route path="history" element={<Clarity.ClarityHistory />} />
                    </Route>

                    {/* GV Simulator */}
                    <Route path="gv-simulator" element={gated('gv_simulator', <SectionLayout
                      eyebrow="Foundations"
                      title="Growth Velocity Simulator"
                      tabs={[
                        { label: 'Calculator', href: '/foundations/gv-simulator/calculator' },
                        { label: 'Scenario Planner', href: '/foundations/gv-simulator/scenarios' },
                      ]}
                    />)}>
                      <Route index element={<Navigate to="calculator" replace />} />
                      <Route path="calculator" element={<GVCalculator />} />
                      <Route path="scenarios" element={<GVScenarioPlanner />} />
                    </Route>

                    {/* Architect Evolution */}
                    <Route path="architect-evolution" element={gated('architect_evolution', <SectionLayout
                      eyebrow="Foundations"
                      title="Architect Evolution"
                      tabs={[
                        { label: 'Overview', href: '/foundations/architect-evolution' },
                        { label: 'Assessment', href: '/foundations/architect-evolution/assessment' },
                        { label: 'Results', href: '/foundations/architect-evolution/results' },
                      ]}
                    />)}>
                      <Route index element={<ArchitectEvolution.ArchitectEvolutionLanding />} />
                      <Route path="assessment" element={<ArchitectEvolution.ArchitectEvolutionAssessment />} />
                      {/* TEMPORARY: gated with architect_evolution for wireframe review — revert to architect_evolution_dashboard before launch */}
                      <Route path="results" element={gated('architect_evolution', <ArchitectEvolution.ArchitectEvolutionResults />)} />
                    </Route>

                    {/* Redirects from legacy founder-evolution paths */}
                    <Route path="founder-evolution" element={<Navigate to="/foundations/architect-evolution" replace />} />
                    <Route path="founder-evolution/assessment" element={<Navigate to="/foundations/architect-evolution/assessment" replace />} />
                    <Route path="founder-evolution/results" element={<Navigate to="/foundations/architect-evolution/results" replace />} />
                  </Route>

                  {/* Diagnostics Section */}
                  <Route path="diagnostics" element={<Diagnostics.DiagnosticsLayout />}>
                    <Route index element={gated('ae_ladder', <Diagnostics.DiagnosticsLanding />)} />

                    {/* AE Ladder */}
                    <Route path="ae-ladder" element={gated('ae_ladder', <Tools.AELadderLayout />)}>
                      <Route index element={<Navigate to="intro" replace />} />
                      <Route path="intro" element={<Tools.AEIntro />} />
                      <Route path="assessment" element={<Tools.AEAssessment />} />
                      <Route path="results-dashboard" element={<Tools.AEResultsDashboard />} />
                      <Route path="stage-profile" element={<Tools.AEStageProfile />} />
                    </Route>

                    {/* M&R Audit */}
                    <Route path="mr-audit" element={gated('mr_audit', <SectionLayout
                      eyebrow="Diagnostics"
                      title="M&R Audit"
                      tabs={[
                        { label: 'Overview', href: '/diagnostics/mr-audit/overview' },
                        { label: 'Assessment', href: '/diagnostics/mr-audit/assessment' },
                        { label: 'Results', href: '/diagnostics/mr-audit/results' },
                      ]}
                    />)}>
                      <Route index element={<Navigate to="overview" replace />} />
                      <Route path="overview" element={<Tools.MRAuditOverview />} />
                      <Route path="assessment" element={<Tools.MRAssessment />} />
                      <Route path="results" element={<Tools.MRResults />} />
                    </Route>
                  </Route>

                  {/* Pro Suite Section */}
                  <Route path="pro" element={<Pro.ProSuiteLayout />}>
                    <Route index element={gated('pro_suite', <Pro.ProMainPage />)} />

                    {/* Planning */}
                    <Route path="planning">
                      <Route index element={gated('quarter_map', <Pro.PlanningLanding />)} />
                      <Route path="roadmap" element={gated('quarter_map', <QuarterMapLayout />)}>
                        <Route index element={<Navigate to="orientation" replace />} />
                        <Route path="orientation" element={<OrientationTab />} />
                        <Route path="horizons" element={<StrategicHorizonsTab />} />
                        <Route path="12-month-plan" element={<Plan12MonthTab />} />
                        <Route path="quarter-map" element={<Navigate to="/pro/planning/quarter-map" replace />} />
                      </Route>
                      <Route path="quarter-map" element={gated('quarter_map', <QuarterMapSectionLayout />)}>
                        <Route index element={<Navigate to="sequence" replace />} />
                        <Route path="sequence" element={<QuarterSequenceTab />} />
                        <Route path="current-quarter" element={<CurrentQuarterFocusTab />} />
                      </Route>
                      <Route path="sprint-planning" element={gated('sprint_planning', <SprintPlanning.SprintPlanningLayout />)}>
                        <Route index element={<Navigate to="sprint-goal" replace />} />
                        <Route path="sprint-goal" element={<SprintGoalFlowPage />} />
                        <Route path="prioritization" element={<SprintPlanning.ThreePPrioritizationPage />} />
                        <Route path="board" element={<SprintPlanning.SprintBoardPage />} />
                        <Route path="board/:id" element={<CapabilityContextPage />} />
                        <Route path="review" element={<SprintReviewLockPage />} />
                        <Route path="synthesis" element={<SprintPostureSynthesis />} />
                        <Route path="initiative-library" element={<Pro.InitiativeLibrary />} />
                        <Route path="milestone-builder" element={<Pro.MilestoneBuilder />} />
                      </Route>
                    </Route>

                    {/* Execution */}
                    <Route path="execution">
                      <Route index element={gated('sprint_launch', <Pro.ExecutionLanding />)} />
                      <Route path="orient" element={gated('sprint_launch', <Pro.OrientLayout />)}>
                        <Route index element={<Navigate to="overview" replace />} />
                        <Route path="overview" element={<Pro.OrientOverviewPage />} />
                        <Route path="alignment" element={<Pro.OrientAlignmentPage />} />
                      </Route>
                      <Route path="operate" element={gated('status_tracker', <Pro.OperateLayout />)}>
                        <Route index element={<Navigate to="timeline" replace />} />
                        <Route path="timeline" element={<Pro.OperateTimelinePage />} />
                        <Route path="status-tracker" element={<Pro.StatusTracker />} />
                      </Route>
                      <Route path="reflect" element={gated('retrospective', <Pro.ExecutionReflectLayout />)}>
                        <Route index element={<Navigate to="wind-down" replace />} />
                        <Route path="wind-down" element={<Pro.SprintWindDown />} />
                        <Route path="retrospective" element={<Pro.Retrospective />} />
                        <Route path="reflection-review" element={<Pro.ReflectionReview />} />
                      </Route>
                      <Route path="launch" element={<Navigate to="/pro/execution/orient" replace />} />
                      <Route path="status-tracker" element={<Navigate to="/pro/execution/operate/status-tracker" replace />} />
                      <Route path="synthesis" element={gated('momentum_synthesis', <Pro.MomentumSynthesis />)} />
                      <Route path="wind-down" element={<Navigate to="/pro/execution/reflect/wind-down" replace />} />
                      <Route path="retrospective" element={<Navigate to="/pro/execution/reflect/retrospective" replace />} />
                      <Route path="reflection-review" element={<Navigate to="/pro/execution/reflect/reflection-review" replace />} />
                    </Route>

                    {/* Intelligence Hub — landing + nested tools */}
                    <Route path="intelligence">
                      <Route index element={gated('pro_suite', <Pro.IntelligenceLanding />)} />
                      <Route
                        path="virtual-cso"
                        element={
                          <FeatureGate featureKey="virtual_cso" lockedElement={<VirtualCSOLocked />}>
                            <Pro.VirtualCSOWorkspace />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="os-engine"
                        element={
                          <FeatureGate featureKey="os_engine" lockedElement={<OSEngineLocked />}>
                            <Pro.OSEngineWorkspace />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="skills"
                        element={
                          <FeatureGate featureKey="skills_library" lockedElement={<SkillsLibraryLocked />}>
                            <Pro.SkillsWorkspace />
                          </FeatureGate>
                        }
                      />
                      <Route path="domain-agents" element={gated('pro_suite', <Pro.DomainAgentsLayout />)}>
                        <Route index element={<Pro.DomainAgentGallery />} />
                        <Route path="agents/:agentId" element={<Pro.DomainAgentProfile />} />
                        <Route path="tasks" element={<Pro.DomainAgentTasks />} />
                        <Route path="tasks/:taskId" element={<Pro.DomainAgentWorkspace />} />
                        <Route path="artifacts" element={<Pro.DomainAgentArtifacts />} />
                      </Route>
                    </Route>

                    {/* Redirects from old flat paths → new nested paths */}
                    <Route path="virtual-cso" element={<Navigate to="/pro/intelligence/virtual-cso" replace />} />
                    <Route path="os-engine" element={<Navigate to="/pro/intelligence/os-engine" replace />} />

                    {/* Legacy Redirects (if any) */}
                    <Route path="dashboard" element={<Navigate to="/pro" replace />} />
                  </Route>

                  {/* Resources Section */}
                  <Route path="resources" element={gated('resources', <ResourcesPage />)} />

                  {/* Settings Section */}
                  <Route path="settings" element={gated('settings', <SectionLayout
                    eyebrow="Account"
                    title="Profile Settings"
                    tabs={[
                      { label: 'Account', href: '/settings/account' },
                      { label: 'Subscription', href: '/settings/subscription' },
                      { label: 'Data Manager', href: '/settings/data' },
                      { label: 'Privacy', href: '/settings/privacy' },
                      { label: 'Referrals', href: '/settings/referrals' },
                      { label: 'AI Usage', href: '/settings/ai-usage' },
                    ]}
                  />)}>
                    <Route index element={<Navigate to="account" replace />} />
                    <Route path="account" element={<Settings.AccountSettings />} />
                    <Route path="subscription" element={<Settings.SubscriptionBilling />} />
                    <Route path="data" element={<Settings.DataManager />} />
                    <Route path="privacy" element={<Settings.PrivacySecurity />} />
                    <Route path="referrals" element={<Settings.Referrals />} />
                    <Route path="ai-usage" element={<Settings.AIUsageSettings />} />
                  </Route>
                </Route>
              </Route> {/* This is the added closing Route tag for <Route element={<ProtectedRoute />}> */}
            </Routes>
          </Router>
        </ErrorBoundary>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
