export type DomainAgentId = 'financial' | 'client' | 'operational' | 'team' | 'stewardship';

export type DomainTaskStatus = 'ready' | 'running' | 'review' | 'blocked' | 'done';

export type ArtifactType = 'brief' | 'memo' | 'review' | 'audit' | 'analysis' | 'read';

export interface DomainCapability {
  label: 'Analyze' | 'Create' | 'Plan';
  description: string;
}

export interface DomainWorkflow {
  id: string;
  agentId: DomainAgentId;
  name: string;
  description: string;
  defaultTaskTitle: string;
}

export interface DomainAgent {
  id: DomainAgentId;
  uuid?: string;
  name: string;
  shortName: string;
  initial: string;
  color: string;
  discipline: string;
  strength: string;
  activity: string;
  fullDescription: string;
  capabilities: DomainCapability[];
  thoughtStarters: Array<{
    text: string;
    workflowId: string;
  }>;
  workflows: DomainWorkflow[];
}

export interface DomainMessage {
  id: string;
  role: 'agent' | 'founder';
  content: string;
  uploadPrompt?: string;
}

export interface DomainProgressStep {
  label: string;
  state: 'done' | 'current' | 'pending';
}

export interface DomainTask {
  id: string;
  title: string;
  agentId: DomainAgentId;
  workflowId?: string | null;
  status: DomainTaskStatus;
  period?: string;
  runLabel: string;
  createdAt: string;
  updatedAt: string;
  resources: string[];
  waitingOn?: string;
  messages: DomainMessage[];
  progress: DomainProgressStep[];
  artifactId?: string;
  origin?: 'profile' | 'kanban' | 'vcso';
  originThreadId?: string | null;
}

export interface DomainArtifact {
  id: string;
  title: string;
  type: ArtifactType;
  agentId?: DomainAgentId;
  workflowId?: string;
  taskId: string;
  createdAt: string;
  promoted: boolean;
  summary: string;
  sections: string[];
  filename?: string;
  renderable?: boolean;
}

export interface RequestCaptureEntry {
  id: string;
  agentId: DomainAgentId;
  request: string;
  mappedWorkflowId?: string;
  capturedAt: string;
}
