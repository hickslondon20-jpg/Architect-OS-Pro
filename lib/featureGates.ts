export type FeatureKey =
  | 'dashboard'
  | 'foundations'
  | 'agency_snapshot'
  | 'gv_simulator'
  | 'clarity_compass'
  | 'ae_ladder'
  | 'mr_audit'
  | 'pro_suite'
  | 'quarter_map'
  | 'sprint_planning'
  | 'sprint_launch'
  | 'status_tracker'
  | 'momentum_synthesis'
  | 'retrospective'
  | 'resources'
  | 'settings'
  | 'architect_evolution'
  | 'architect_evolution_dashboard'
  | 'os_engine'
  | 'virtual_cso'
  | 'skills_library'
  | 'post_beta';

export interface FeatureGateDefinition {
  key: FeatureKey;
  label: string;
  unlockWeek: number | null;
  postBeta?: boolean;
}

export const FEATURE_GATES: Record<FeatureKey, FeatureGateDefinition> = {
  dashboard: { key: 'dashboard', label: 'Dashboard', unlockWeek: 1 },
  foundations: { key: 'foundations', label: 'Foundations', unlockWeek: 1 },
  agency_snapshot: { key: 'agency_snapshot', label: 'Agency Snapshot', unlockWeek: 1 },
  gv_simulator: { key: 'gv_simulator', label: 'GV Simulator', unlockWeek: 2 },
  clarity_compass: { key: 'clarity_compass', label: 'Clarity Compass', unlockWeek: 2 },
  ae_ladder: { key: 'ae_ladder', label: 'AE Ladder', unlockWeek: 3 },
  mr_audit: { key: 'mr_audit', label: 'M&R Audit', unlockWeek: 5 },
  pro_suite: { key: 'pro_suite', label: 'ArchitectOS Pro Suite', unlockWeek: 6 },
  quarter_map: { key: 'quarter_map', label: 'Quarter Map', unlockWeek: 6 },
  sprint_planning: { key: 'sprint_planning', label: 'Sprint Planning', unlockWeek: 7 },
  sprint_launch: { key: 'sprint_launch', label: 'Sprint Launch', unlockWeek: 7 },
  status_tracker: { key: 'status_tracker', label: 'Status Tracker', unlockWeek: 10 },
  momentum_synthesis: { key: 'momentum_synthesis', label: 'Momentum Synthesis', unlockWeek: 10 },
  retrospective: { key: 'retrospective', label: 'Reflection Review', unlockWeek: 12 },
  resources: { key: 'resources', label: 'Resources', unlockWeek: 1 },
  settings: { key: 'settings', label: 'Settings', unlockWeek: 1 },
  architect_evolution: {
    key: 'architect_evolution',
    label: 'Architect Evolution Assessment',
    unlockWeek: 1,
  },
  architect_evolution_dashboard: {
    key: 'architect_evolution_dashboard',
    label: 'Architect Evolution Results',
    unlockWeek: null,
  },
  os_engine: { key: 'os_engine', label: 'OS Engine', unlockWeek: 6 },
  virtual_cso: { key: 'virtual_cso', label: 'Virtual CSO', unlockWeek: 6 },
  skills_library: { key: 'skills_library', label: 'Skills & Plugins', unlockWeek: 6 },
  post_beta: { key: 'post_beta', label: 'Post-beta feature', unlockWeek: null, postBeta: true },
};

export const getFeatureGate = (featureKey: FeatureKey) => FEATURE_GATES[featureKey];

export const isFeatureUnlockedForWeek = (featureKey: FeatureKey, betaWeek: number) => {
  const gate = getFeatureGate(featureKey);
  if (!gate || gate.postBeta || gate.unlockWeek === null) return false;
  return betaWeek >= gate.unlockWeek;
};

export const getFeatureLockMessage = (featureKey: FeatureKey) => {
  const gate = getFeatureGate(featureKey);
  if (!gate) return 'This feature is not available yet.';
  if (gate.postBeta) return `${gate.label} is post-beta scope.`;
  return `${gate.label} unlocks in Program Week ${gate.unlockWeek}.`;
};

const PATH_FEATURE_GATES: Array<{ path: string; featureKey: FeatureKey }> = [
  { path: '/foundations/architect-evolution/results', featureKey: 'architect_evolution_dashboard' },
  { path: '/foundations/architect-evolution', featureKey: 'architect_evolution' },
  { path: '/foundations/clarity-compass', featureKey: 'clarity_compass' },
  { path: '/foundations/gv-simulator', featureKey: 'gv_simulator' },
  { path: '/foundations/snapshot', featureKey: 'agency_snapshot' },
  { path: '/foundations', featureKey: 'foundations' },
  { path: '/diagnostics/mr-audit', featureKey: 'mr_audit' },
  { path: '/diagnostics/ae-ladder', featureKey: 'ae_ladder' },
  { path: '/diagnostics', featureKey: 'ae_ladder' },
  { path: '/pro/os-engine', featureKey: 'os_engine' },
  { path: '/pro/virtual-cso', featureKey: 'virtual_cso' },
  { path: '/pro/intelligence/skills', featureKey: 'skills_library' },
  { path: '/pro/intelligence/os-engine', featureKey: 'os_engine' },
  { path: '/pro/intelligence/virtual-cso', featureKey: 'virtual_cso' },
  { path: '/pro/planning/roadmap', featureKey: 'quarter_map' },
  { path: '/pro/planning/sprint-planning', featureKey: 'sprint_planning' },
  { path: '/pro/planning', featureKey: 'quarter_map' },
  { path: '/pro/execution/status-tracker', featureKey: 'status_tracker' },
  { path: '/pro/execution/synthesis', featureKey: 'momentum_synthesis' },
  { path: '/pro/execution/wind-down', featureKey: 'retrospective' },
  { path: '/pro/execution/retrospective', featureKey: 'retrospective' },
  { path: '/pro/execution/reflection-review', featureKey: 'retrospective' },
  { path: '/pro/execution/launch', featureKey: 'sprint_launch' },
  { path: '/pro/execution', featureKey: 'sprint_launch' },
  { path: '/pro', featureKey: 'pro_suite' },
  { path: '/resources', featureKey: 'resources' },
  { path: '/settings', featureKey: 'settings' },
  { path: '/dashboard', featureKey: 'dashboard' },
];

export const getFeatureKeyForPath = (path: string): FeatureKey => {
  const match = PATH_FEATURE_GATES.find((entry) => path === entry.path || path.startsWith(`${entry.path}/`));
  return match?.featureKey ?? 'dashboard';
};
