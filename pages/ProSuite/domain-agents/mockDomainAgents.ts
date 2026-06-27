import type {
  DomainAgent,
  DomainAgentId,
  DomainArtifact,
  DomainTask,
  DomainTaskStatus,
  DomainWorkflow,
} from './types';

const workflow = (
  id: string,
  agentId: DomainAgentId,
  name: string,
  description: string,
  defaultTaskTitle: string,
): DomainWorkflow => ({
  id,
  agentId,
  name,
  description,
  defaultTaskTitle,
});

export const domainAgents: DomainAgent[] = [
  {
    id: 'financial',
    name: 'Financial Agent',
    shortName: 'Financial',
    initial: 'F',
    color: 'var(--aos-deep-teal)',
    discipline: 'Interprets any financial evidence placed in front of it.',
    strength: 'Margins, revenue quality, growth economics, cash flow, scenarios.',
    activity: '6 artifacts / last run 2d ago',
    fullDescription:
      "The financial discipline that knows how to interpret P&L, balance sheet, cash flow, budget, and forecast evidence in the context of the founder's operating rhythm.",
    capabilities: [
      { label: 'Analyze', description: 'P&L movement, margin pressure, cash flow, pricing economics' },
      { label: 'Create', description: 'Monthly reviews, board memos, operating briefs' },
      { label: 'Plan', description: 'Hiring affordability, forecasts, runway and scenario reads' },
    ],
    thoughtStarters: [
      { text: 'Why did profit change last month?', workflowId: 'wf-fin-monthly-pl' },
      { text: 'Can we afford another account manager?', workflowId: 'wf-fin-hiring' },
      { text: 'Where is margin leaking?', workflowId: 'wf-fin-pricing' },
    ],
    workflows: [
      workflow(
        'wf-fin-monthly-pl',
        'financial',
        'Produce a Monthly P&L Assessment',
        'Reads your P&L, compares it to prior months, benchmarks margin, and writes a business review.',
        'Monthly P&L Assessment',
      ),
      workflow(
        'wf-fin-hiring',
        'financial',
        'Hiring Affordability Read',
        'Tests a prospective hire against margin, runway, capacity, and near-term operating pressure.',
        'Hiring Affordability Read',
      ),
      workflow(
        'wf-fin-pricing',
        'financial',
        'Pricing & Margin Audit',
        'Surfaces where pricing and delivery economics diverge across the book.',
        'Pricing & Margin Audit',
      ),
    ],
  },
  {
    id: 'client',
    name: 'Client & Market Agent',
    shortName: 'Client',
    initial: 'C',
    color: 'var(--aos-brass)',
    discipline: 'Owns acquisition, retention, concentration, profitability, and positioning.',
    strength: 'Client portfolio quality, pipeline shape, sales velocity, market fit.',
    activity: '3 artifacts / last run 3d ago',
    fullDescription:
      'The commercial discipline that reads client evidence and market signals together, including pipeline, portfolio mix, retention, and positioning pressure.',
    capabilities: [
      { label: 'Analyze', description: 'Client concentration, pipeline coverage, retention, portfolio quality' },
      { label: 'Create', description: 'Segmentation analyses, positioning briefs, client-risk reads' },
      { label: 'Plan', description: 'Acquisition focus, pricing posture, growth channel priorities' },
    ],
    thoughtStarters: [
      { text: 'Which client segment is carrying the agency?', workflowId: 'wf-client-segmentation' },
      { text: 'Where is concentration risk building?', workflowId: 'wf-client-risk' },
      { text: 'What should we sell next quarter?', workflowId: 'wf-client-growth' },
    ],
    workflows: [
      workflow(
        'wf-client-segmentation',
        'client',
        'Client Segmentation Analysis',
        'Groups the book by revenue, margin, service fit, and growth quality.',
        'Client Segmentation Analysis',
      ),
      workflow(
        'wf-client-risk',
        'client',
        'Client Concentration Read',
        'Identifies revenue and dependency exposure across the active portfolio.',
        'Client Concentration Read',
      ),
      workflow(
        'wf-client-growth',
        'client',
        'Growth Focus Brief',
        'Turns pipeline and portfolio signals into a focused commercial recommendation.',
        'Growth Focus Brief',
      ),
    ],
  },
  {
    id: 'operational',
    name: 'Operational Agent',
    shortName: 'Operational',
    initial: 'O',
    color: 'var(--aos-slate-blue)',
    discipline: 'Reads process, capacity, delivery, workflow, and execution pressure.',
    strength: 'Utilization, delivery risk, SOP maturity, operating cadence.',
    activity: '4 artifacts / last run 5d ago',
    fullDescription:
      'The operating discipline that inspects how work moves through the agency and where capacity, handoffs, or instrumentation are creating drag.',
    capabilities: [
      { label: 'Analyze', description: 'Capacity, utilization, handoffs, delivery risk, process maturity' },
      { label: 'Create', description: 'Delivery-risk reads, process diagnostics, operating memos' },
      { label: 'Plan', description: 'Workflow upgrades, SOP priorities, instrumentation next steps' },
    ],
    thoughtStarters: [
      { text: 'Where is delivery pressure showing up first?', workflowId: 'wf-ops-risk' },
      { text: 'Which workflow needs the next SOP?', workflowId: 'wf-ops-sop' },
      { text: 'What is constraining capacity this quarter?', workflowId: 'wf-ops-capacity' },
    ],
    workflows: [
      workflow(
        'wf-ops-risk',
        'operational',
        'Capacity & Delivery Risk Read',
        'Reads utilization, delivery load, and process signals to find near-term execution pressure.',
        'Capacity & Delivery Risk Read',
      ),
      workflow(
        'wf-ops-sop',
        'operational',
        'SOP Maturity Diagnostic',
        'Identifies the processes that most need stronger operating standards.',
        'SOP Maturity Diagnostic',
      ),
      workflow(
        'wf-ops-capacity',
        'operational',
        'Capacity Constraint Brief',
        'Summarizes where the team has room, where load is brittle, and what to sequence next.',
        'Capacity Constraint Brief',
      ),
    ],
  },
  {
    id: 'team',
    name: 'Team Agent',
    shortName: 'Team',
    initial: 'T',
    color: 'var(--aos-obsidian)',
    discipline: 'Owns structure, leadership, delegation, accountability, and capability.',
    strength: 'Role clarity, leadership load, team health, decision ownership.',
    activity: '2 artifacts / blocked 6d ago',
    fullDescription:
      'The organizational discipline that reads team shape, leadership load, accountability, and capability needs as a founder scales beyond personal throughput.',
    capabilities: [
      { label: 'Analyze', description: 'Role clarity, accountability, leadership load, capability gaps' },
      { label: 'Create', description: 'Alignment diagnostics, org-shape reads, delegation memos' },
      { label: 'Plan', description: 'Leadership cadence, role design, capability-building priorities' },
    ],
    thoughtStarters: [
      { text: 'Where is leadership load bottlenecking the work?', workflowId: 'wf-team-health' },
      { text: 'Which role needs clearer ownership?', workflowId: 'wf-team-alignment' },
      { text: 'What capability should we build next?', workflowId: 'wf-team-capability' },
    ],
    workflows: [
      workflow(
        'wf-team-health',
        'team',
        'Organizational Health Read',
        'Reads structure, load, and accountability signals to identify team pressure.',
        'Organizational Health Read',
      ),
      workflow(
        'wf-team-alignment',
        'team',
        'Team Alignment Diagnostic',
        'Finds where ownership, delegation, or cadence needs clearer operating agreements.',
        'Team Alignment Diagnostic',
      ),
      workflow(
        'wf-team-capability',
        'team',
        'Capability Build Brief',
        'Turns team constraints into a focused capability-development recommendation.',
        'Capability Build Brief',
      ),
    ],
  },
  {
    id: 'stewardship',
    name: 'Stewardship Agent',
    shortName: 'Stewardship',
    initial: 'S',
    color: '#7A5B1F',
    discipline: 'Reads the founder role, leverage, focus, and evolution.',
    strength: 'Decision patterns, founder leverage, cross-domain tradeoffs.',
    activity: '1 artifact / last run 9d ago',
    fullDescription:
      "The founder-role discipline that helps interpret how the founder's attention, decisions, and leverage shape the operating system.",
    capabilities: [
      { label: 'Analyze', description: 'Founder load, decision loops, leverage, strategic focus' },
      { label: 'Create', description: 'Stewardship memos, evolution briefs, decision-pattern reviews' },
      { label: 'Plan', description: 'Founder focus shifts, leverage upgrades, cross-domain calls' },
    ],
    thoughtStarters: [
      { text: 'What am I still holding that the system should hold?', workflowId: 'wf-stewardship-focus' },
      { text: 'Which cross-domain call needs founder judgment?', workflowId: 'wf-stewardship-cross-domain' },
      { text: 'How should my role change this quarter?', workflowId: 'wf-stewardship-evolution' },
    ],
    workflows: [
      workflow(
        'wf-stewardship-focus',
        'stewardship',
        'Founder Leverage Review',
        'Identifies where founder attention is creating leverage, drag, or avoidable dependency.',
        'Founder Leverage Review',
      ),
      workflow(
        'wf-stewardship-cross-domain',
        'stewardship',
        'Cross-Domain Decision Brief',
        'Synthesizes the financial, client, operating, and team implications of a strategic call.',
        'Cross-Domain Decision Brief',
      ),
      workflow(
        'wf-stewardship-evolution',
        'stewardship',
        'Founder Evolution Memo',
        'Clarifies the next role shift needed for the current stage of scale.',
        'Founder Evolution Memo',
      ),
    ],
  },
];

export const domainWorkflows = domainAgents.flatMap((agent) => agent.workflows);

export const domainTasks: DomainTask[] = [
  {
    id: 'task-fin-pl-apr-may',
    title: 'Monthly P&L Assessment / Apr-May',
    agentId: 'financial',
    workflowId: 'wf-fin-monthly-pl',
    status: 'review',
    period: 'Apr-May 2026',
    runLabel: 'run #2',
    createdAt: 'Jun 20',
    updatedAt: '2d ago',
    resources: ['April P&L.csv', 'May P&L.csv'],
    artifactId: 'artifact-monthly-review-apr',
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'I read the April and May P&Ls, compared the movement, and drafted the monthly review. The artifact is ready for founder review before it is finalized.',
      },
      {
        id: 'm2',
        role: 'founder',
        content: 'Show me the key margin movement before I accept it.',
      },
      {
        id: 'm3',
        role: 'agent',
        content:
          'The largest movement is delivery margin compression tied to senior team utilization and a higher subcontractor mix. I recommend reviewing pricing architecture before the next sprint lock.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Checked OS Engine for existing P&Ls', state: 'done' },
      { label: 'Analyze, compare, benchmark', state: 'done' },
      { label: 'Draft artifact', state: 'done' },
      { label: 'Await founder review', state: 'current' },
    ],
  },
  {
    id: 'task-client-segmentation',
    title: 'Client Segmentation Analysis',
    agentId: 'client',
    workflowId: 'wf-client-segmentation',
    status: 'running',
    runLabel: 'run #1',
    createdAt: 'Jun 19',
    updatedAt: '3d ago',
    resources: ['Active client export.csv'],
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'I have the client export and am segmenting by revenue contribution, margin quality, service fit, and retention pattern.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Checked OS Engine for client context', state: 'done' },
      { label: 'Segment portfolio', state: 'current' },
      { label: 'Draft analysis', state: 'pending' },
      { label: 'Move to review', state: 'pending' },
    ],
  },
  {
    id: 'task-ops-risk',
    title: 'Capacity & Delivery Risk Read',
    agentId: 'operational',
    workflowId: 'wf-ops-risk',
    status: 'done',
    runLabel: 'run #1',
    createdAt: 'Jun 17',
    updatedAt: '5d ago',
    resources: ['Utilization snapshot.pdf', 'Sprint board export.csv'],
    artifactId: 'artifact-delivery-risk',
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'The delivery risk read is complete. The biggest pressure is handoff drift between strategy and production, not raw team capacity.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Checked OS Engine for operating context', state: 'done' },
      { label: 'Analyze delivery pressure', state: 'done' },
      { label: 'Founder accepted artifact', state: 'done' },
    ],
  },
  {
    id: 'task-team-alignment',
    title: 'Team Alignment Diagnostic',
    agentId: 'team',
    workflowId: 'wf-team-alignment',
    status: 'blocked',
    runLabel: 'run #1',
    createdAt: 'Jun 16',
    updatedAt: '6d ago',
    resources: ['Leadership notes.md'],
    waitingOn: 'Upload current role scorecard or answer ownership questions',
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'I checked OS Engine and found leadership notes, but I do not have the current role scorecard. I need that before I can separate accountability gaps from capacity gaps.',
        uploadPrompt: 'Upload current role scorecard or answer ownership questions',
      },
      {
        id: 'm2',
        role: 'founder',
        content: 'I can answer the ownership questions instead.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Checked OS Engine for team context', state: 'done' },
      { label: 'Waiting on founder input', state: 'current' },
      { label: 'Analyze accountability map', state: 'pending' },
      { label: 'Draft artifact to review', state: 'pending' },
    ],
  },
  {
    id: 'task-fin-pricing',
    title: 'Pricing & Margin Audit',
    agentId: 'financial',
    workflowId: 'wf-fin-pricing',
    status: 'ready',
    runLabel: 'run #1',
    createdAt: 'Today',
    updatedAt: 'queued',
    resources: [],
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'The Pricing & Margin Audit is queued. When it starts, I will check OS Engine first, then ask for any missing pricing or delivery evidence.',
      },
    ],
    progress: [
      { label: 'Task created', state: 'current' },
      { label: 'Check OS Engine for pricing context', state: 'pending' },
      { label: 'Request missing evidence if needed', state: 'pending' },
      { label: 'Analyze pricing and delivery economics', state: 'pending' },
      { label: 'Draft artifact to review', state: 'pending' },
    ],
  },
  {
    id: 'task-team-health',
    title: 'Organizational Health Read',
    agentId: 'team',
    workflowId: 'wf-team-health',
    status: 'running',
    runLabel: 'run #1',
    createdAt: 'Jun 21',
    updatedAt: 'active',
    resources: ['Org notes.md'],
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'I am reading the org notes against leadership load and role clarity. Early signal: the founder is still acting as the escalation path for two functions.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Check OS Engine for org context', state: 'done' },
      { label: 'Analyze leadership load', state: 'current' },
      { label: 'Draft artifact to review', state: 'pending' },
    ],
  },
  {
    id: 'task-ops-onboarding',
    title: 'Onboarding Process Diagnostic',
    agentId: 'operational',
    workflowId: 'wf-ops-sop',
    status: 'done',
    runLabel: 'run #1',
    createdAt: 'Jun 14',
    updatedAt: '8d ago',
    resources: ['Onboarding SOP.md'],
    messages: [
      {
        id: 'm1',
        role: 'agent',
        content:
          'The onboarding diagnostic is complete. The recommended next sequence is acceptance criteria, owner handoff, then QA checkpoint.',
      },
    ],
    progress: [
      { label: 'Plan confirmed', state: 'done' },
      { label: 'Analyze onboarding SOP', state: 'done' },
      { label: 'Founder accepted artifact', state: 'done' },
    ],
  },
];

export const domainArtifacts: DomainArtifact[] = [
  {
    id: 'artifact-monthly-review-apr',
    title: 'Monthly Business Review / April',
    type: 'brief',
    agentId: 'financial',
    workflowId: 'wf-fin-monthly-pl',
    taskId: 'task-fin-pl-apr-may',
    createdAt: 'Apr 30',
    promoted: false,
    summary: 'A financial review of margin movement, revenue quality, and pressure signals across April.',
    sections: ['Summary', 'Margin movement', 'Revenue quality', 'Recommendations'],
  },
  {
    id: 'artifact-client-segmentation',
    title: 'Client Segmentation Analysis',
    type: 'analysis',
    agentId: 'client',
    workflowId: 'wf-client-segmentation',
    taskId: 'task-client-segmentation',
    createdAt: 'Jun 18',
    promoted: true,
    summary: 'A portfolio analysis grouped by economic quality, growth fit, retention signal, and service strain.',
    sections: ['Portfolio shape', 'Segment quality', 'Concentration watch', 'Next commercial move'],
  },
  {
    id: 'artifact-delivery-risk',
    title: 'Capacity & Delivery Risk Read',
    type: 'read',
    agentId: 'operational',
    workflowId: 'wf-ops-risk',
    taskId: 'task-ops-risk',
    createdAt: 'Jun 20',
    promoted: false,
    summary: 'A delivery pressure read that separates utilization, handoff quality, and process fragility.',
    sections: ['Risk posture', 'Utilization signal', 'Handoff drift', 'Sequenced repair'],
  },
  {
    id: 'artifact-founder-leverage',
    title: 'Founder Leverage Review',
    type: 'memo',
    agentId: 'stewardship',
    workflowId: 'wf-stewardship-focus',
    taskId: 'task-ops-onboarding',
    createdAt: 'Jun 12',
    promoted: true,
    summary: 'A stewardship memo on founder attention, escalation paths, and leverage shifts.',
    sections: ['Attention map', 'Decision loops', 'Leverage upgrade', 'Next quarter posture'],
  },
];

export const statusLabels: Record<DomainTaskStatus, string> = {
  ready: 'Ready',
  running: 'Running',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
};

export const statusOrder: DomainTaskStatus[] = ['ready', 'running', 'review', 'blocked', 'done'];

export const getAgent = (agentId: DomainAgentId) => domainAgents.find((agent) => agent.id === agentId) ?? domainAgents[0];

export const getWorkflow = (workflowId: string) =>
  domainWorkflows.find((item) => item.id === workflowId) ?? domainWorkflows[0];

export const getTask = (taskId?: string) =>
  domainTasks.find((task) => task.id === taskId) ?? domainTasks.find((task) => task.status === 'blocked') ?? domainTasks[0];

export const getArtifact = (artifactId?: string) => domainArtifacts.find((artifact) => artifact.id === artifactId);
