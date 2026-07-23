import { describe, expect, it } from 'vitest';

import {
  applySubAgentStepEvent,
  buildNestedWorkerGroups,
  normalizeWorkerSourceRefs,
  preserveNestedAgentSteps,
  rebuildPersistedWorkerTodos,
  type AgentStep,
} from './virtualCsoApi';

const parentStep = (
  stepIndex: number,
  parentToolUseId: string,
  capabilityKey: string,
): AgentStep => ({
  stepIndex,
  stepType: 'sub_agent',
  title: capabilityKey.replaceAll('_', ' '),
  summary: 'Bounded worker is gathering a cited finding.',
  tool: 'Task',
  input: {},
  output: '',
  status: 'running',
  parentToolUseId,
  sourceRefs: [],
  children: [],
  subAgent: {
    capabilityKey,
    status: 'running',
  },
});

describe('nested worker event surface', () => {
  it('groups curated child progress under its parent_tool_use_id', () => {
    const structured = parentStep(4, 'task-structured', 'structured_data_agent');
    const sandbox = parentStep(5, 'task-sandbox', 'sandbox_execution_agent');

    const applied = applySubAgentStepEvent(structured, {
      parentStepIndex: 4,
      parentToolUseId: 'task-structured',
      runId: 'child-structured',
      capabilityKey: 'structured_data_agent',
      status: 'running',
      step: {
        step_index: 2,
        step_type: 'tool_call',
        tool_name: 'read_founder_dataset',
        title: 'Founder dataset reviewed',
        summary: 'Reviewed the latest ready financial dataset.',
        status: 'completed',
        source_refs: [
          {
            source_kind: 'founder_dataset',
            source_id: 'dataset-1',
            label: 'Financial snapshot',
          },
        ],
      },
    });

    const groups = buildNestedWorkerGroups([applied.parent!, sandbox]);

    expect(groups).toHaveLength(2);
    expect(groups[0].parentToolUseId).toBe('task-structured');
    expect(groups[0].steps).toHaveLength(1);
    expect(groups[0].steps[0]).toMatchObject({
      title: 'Founder dataset reviewed',
      summary: 'Reviewed the latest ready financial dataset.',
      parentToolUseId: 'task-structured',
    });
    expect(groups[1].parentToolUseId).toBe('task-sandbox');
    expect(applied.sources).toEqual([
      { kind: 'platform', label: 'Financial snapshot' },
    ]);
  });

  it('updates an existing child chip instead of duplicating it', () => {
    const parent = parentStep(4, 'task-structured', 'structured_data_agent');
    const running = applySubAgentStepEvent(parent, {
      parentStepIndex: 4,
      parentToolUseId: 'task-structured',
      capabilityKey: 'structured_data_agent',
      status: 'running',
      step: {
        step_index: 2,
        title: 'Founder dataset reviewed',
        summary: 'Reviewing the latest ready financial dataset.',
        status: 'running',
      },
    }).parent!;
    const completed = applySubAgentStepEvent(running, {
      parentStepIndex: 4,
      parentToolUseId: 'task-structured',
      capabilityKey: 'structured_data_agent',
      status: 'completed',
      step: {
        step_index: 2,
        title: 'Founder dataset reviewed',
        summary: 'Reviewed the latest ready financial dataset.',
        status: 'completed',
      },
    }).parent!;

    expect(completed.children).toHaveLength(1);
    expect(completed.children?.[0].status).toBe('completed');
    expect(completed.children?.[0].summary).toBe('Reviewed the latest ready financial dataset.');
    expect(completed.subAgent?.status).toBe('completed');
  });

  it('does not expose raw payload or chain-of-thought fields from the event', () => {
    const applied = applySubAgentStepEvent(
      parentStep(4, 'task-structured', 'structured_data_agent'),
      {
        parentStepIndex: 4,
        parentToolUseId: 'task-structured',
        capabilityKey: 'structured_data_agent',
        step: {
          step_index: 2,
          title: 'Founder dataset reviewed',
          summary: 'Reviewed a bounded dataset finding.',
          status: 'completed',
          raw_payload: { secret: 'never render' },
          chain_of_thought: 'never render',
          input_summary: { internal_prompt: 'never render' },
          output_summary: { raw_rows: ['never render'] },
        },
      },
    );

    expect(applied.parent?.children?.[0]).toMatchObject({
      input: {},
      output: '',
      summary: 'Reviewed a bounded dataset finding.',
    });
    expect(JSON.stringify(applied.parent)).not.toContain('never render');
  });

  it('keeps the richer live hierarchy when the done payload carries a flat trace', () => {
    const nested = applySubAgentStepEvent(
      parentStep(4, 'task-structured', 'structured_data_agent'),
      {
        parentToolUseId: 'task-structured',
        capabilityKey: 'structured_data_agent',
        status: 'completed',
        step: {
          step_index: 1,
          title: 'Dataset reviewed',
          summary: 'Reviewed a bounded founder dataset.',
          status: 'completed',
        },
      },
    ).parent!;
    const persistedFlat = [{ ...parentStep(4, 'task-structured', 'structured_data_agent'), children: [] }];

    expect(preserveNestedAgentSteps([nested], persistedFlat)).toEqual([nested]);
    expect(preserveNestedAgentSteps([], persistedFlat)).toEqual(persistedFlat);
  });

  it('normalizes persisted citation labels into the SOURCES rail', () => {
    expect(normalizeWorkerSourceRefs([
      {
        source_kind: 'wiki_claim',
        source_id: 'claim-1',
        source_label: 'Concentration is material.',
      },
      {
        source_kind: 'computation',
        source_id: 'compute-1',
        source_label: 'Sandbox scenario',
      },
    ])).toEqual([
      { kind: 'wiki', label: 'Concentration is material.', pageId: 'claim-1' },
      { kind: 'platform', label: 'Sandbox scenario' },
    ]);
  });

  it('rebuilds the grouped four-item plan when a completed native thread reloads', () => {
    const persistedParents = [
      parentStep(4, 'toolu-structured', 'structured_data_agent'),
      parentStep(6, 'toolu-wiki', 'per_user_wiki'),
      parentStep(8, 'toolu-sandbox', 'sandbox_execution_agent'),
    ].map((step, index) => ({
      ...step,
      status: 'completed',
      children: [{
        stepIndex: index + 1,
        stepType: 'tool_call',
        title: 'Curated worker result',
        summary: 'A bounded finding was prepared.',
        tool: 'worker_tool',
        input: {},
        output: '',
        status: 'completed',
        parentToolUseId: step.parentToolUseId,
      }],
      subAgent: {
        ...step.subAgent,
        status: 'completed',
      },
    } satisfies AgentStep));

    expect(rebuildPersistedWorkerTodos(persistedParents)).toEqual([
      {
        id: 'structured_data_agent',
        content: 'Bind the latest founder financial dataset',
        status: 'completed',
        position: 0,
      },
      {
        id: 'sandbox_execution_agent',
        content: 'Compute concentration and margin trend',
        status: 'completed',
        position: 1,
      },
      {
        id: 'per_user_wiki',
        content: 'Review strategic pricing and constraint context',
        status: 'completed',
        position: 2,
      },
      {
        id: 'compose',
        content: 'Compose the cited 90-day recommendation',
        status: 'completed',
        position: 3,
      },
    ]);
  });

  it('does not synthesize a grouped plan for an ordinary flat SDK trace', () => {
    expect(rebuildPersistedWorkerTodos([{
      stepIndex: 1,
      stepType: 'context_build',
      title: 'Context prepared',
      tool: 'context',
      input: {},
      output: '',
      status: 'completed',
    }])).toEqual([]);
  });
});
