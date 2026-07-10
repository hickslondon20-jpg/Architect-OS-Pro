-- 021_pnl_workflow_steps_content.sql
-- Episode 6 / Phase 3 - Monthly P&L Assessment anchor workflow POC.
-- POC-grade prompts only: this proves harness wiring, not final financial IP.

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
),
diagnose_skill as (
  select id
  from public.skill_packs
  where name = 'Diagnose the Numbers'
  order by created_at desc
  limit 1
)
update public.templates
set
  output_contract = '{
    "schema_version": "monthly_pnl_assessment_poc_v1",
    "sections": ["headline", "findings", "risks", "questions"],
    "poc_only": true
  }'::jsonb,
  render_spec = '{
    "render": "in_process_html",
    "workspace_output": "artifact.html",
    "phase_5_export": "deferred",
    "poc_only": true
  }'::jsonb
where key = 'monthly_pnl_assessment_v1';

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
)
update public.workflow_steps ws
set
  name = 'Prereq / Intake',
  step_type = 'programmatic',
  skill_id = null,
  system_prompt_template = null,
  tools = '[]'::jsonb,
  capability_key = null,
  output_schema = '{
    "mode": "handler",
    "handler": "pnl_intake",
    "poc_only": true
  }'::jsonb,
  workspace_inputs = '[]'::jsonb,
  workspace_output = 'pnl-source.md',
  batch_size = null
from target_workflow tw
where ws.workflow_id = tw.id
  and ws.position = 1;

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
)
update public.workflow_steps ws
set
  name = 'Clarify Context',
  step_type = 'llm_human_input',
  skill_id = null,
  system_prompt_template = null,
  tools = '[]'::jsonb,
  capability_key = null,
  output_schema = '{
    "question": "Before I draft this POC assessment, what entity and month should I use, are there one-off items to normalize, and should I compare against budget, prior month, or prior year?",
    "poc_only": true
  }'::jsonb,
  workspace_inputs = '["pnl-source.md"]'::jsonb,
  workspace_output = 'review-context.md',
  batch_size = null
from target_workflow tw
where ws.workflow_id = tw.id
  and ws.position = 2;

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
),
diagnose_skill as (
  select id
  from public.skill_packs
  where name = 'Diagnose the Numbers'
  order by created_at desc
  limit 1
)
update public.workflow_steps ws
set
  name = 'Analyze P&L',
  step_type = 'llm_agent',
  skill_id = (select id from diagnose_skill),
  system_prompt_template = 'POC only. Review the workspace P&L source and founder context. Produce a concise, source-aware analysis summary; do not apply proprietary financial doctrine in this pass.',
  tools = '[]'::jsonb,
  capability_key = 'document_analysis_agent',
  output_schema = '{
    "poc_only": true,
    "expected": ["summary", "source_refs"]
  }'::jsonb,
  workspace_inputs = '["pnl-source.md", "review-context.md"]'::jsonb,
  workspace_output = 'analysis.md',
  batch_size = null
from target_workflow tw
where ws.workflow_id = tw.id
  and ws.position = 3;

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
)
update public.workflow_steps ws
set
  name = 'Synthesize Assessment',
  step_type = 'llm_single',
  skill_id = null,
  system_prompt_template = 'POC only. Turn the analysis and founder context into a short Monthly P&L Assessment draft. Use the record_step_output tool. Keep the content clearly provisional and source-aware.',
  tools = '[]'::jsonb,
  capability_key = null,
  output_schema = '{
    "type": "object",
    "properties": {
      "summary": {"type": "string"},
      "headline": {"type": "string"},
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "summary": {"type": "string"},
            "source_refs": {"type": "array", "items": {"type": "object", "additionalProperties": true}}
          },
          "additionalProperties": true
        }
      },
      "risks": {"type": "array", "items": {"type": "object", "additionalProperties": true}},
      "questions": {"type": "array", "items": {"type": "object", "additionalProperties": true}},
      "source_refs": {"type": "array", "items": {"type": "object", "additionalProperties": true}}
    },
    "required": ["summary", "headline", "findings", "risks", "questions", "source_refs"],
    "additionalProperties": true,
    "poc_only": true
  }'::jsonb,
  workspace_inputs = '["analysis.md", "review-context.md"]'::jsonb,
  workspace_output = 'assessment.md',
  batch_size = null
from target_workflow tw
where ws.workflow_id = tw.id
  and ws.position = 4;

with target_workflow as (
  select id
  from public.workflows
  where key = 'produce_monthly_pnl_assessment'
)
update public.workflow_steps ws
set
  name = 'Render Artifact',
  step_type = 'programmatic',
  skill_id = null,
  system_prompt_template = null,
  tools = '[]'::jsonb,
  capability_key = null,
  output_schema = '{
    "mode": "handler",
    "handler": "pnl_render",
    "render": "in_process_html",
    "poc_only": true
  }'::jsonb,
  workspace_inputs = '["assessment.md"]'::jsonb,
  workspace_output = 'artifact.html',
  batch_size = null
from target_workflow tw
where ws.workflow_id = tw.id
  and ws.position = 5;
