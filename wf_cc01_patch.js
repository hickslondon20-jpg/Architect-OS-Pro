import { workflow, node, trigger } from '@n8n/workflow-sdk';

// WF-CC-01 — Clarity Compass Synthesis
// Patch: Add "Sync cc_versions Status" node between Supabase Final Write and Success Response

export default workflow('WF-CC-01 — Clarity Compass Synthesis', (w) => {

  // ─── TRIGGER ──────────────────────────────────────
  const webhookTrigger = trigger('Webhook Trigger', 'n8n-nodes-base.webhook', {
    httpMethod: 'POST',
    path: 'clarity-compass-synthesis',
    responseMode: 'responseNode',
    options: {},
  });

  // ─── AUTH + VALIDATION ───────────────────────────
  const checkAuth = node('Check Auth', 'n8n-nodes-base.code', {
    jsCode: `const headers = $input.item.json.headers || {};
const body = $input.item.json.body || $input.item.json;
const authHeader = headers['x-webhook-secret'] || '';
const expectedSecret = 'ArchitectOS_9f3a2c1d_7b8e_4c99_a1e2_3d4f5g6h7i8j';
if (authHeader !== expectedSecret) {
  return [{ json: { valid: false, error: 'Unauthorized' } }];
}
return [{ json: { valid: true, body, headers } }];`,
  });

  const validateInput = node('Validate Input', 'n8n-nodes-base.code', {
    jsCode: `const body = $input.item.json.body || $input.item.json;
const user_id = body.user_id;
const version_id = body.version_id;
const force = body.force === true || body.force === 'true';

if (!user_id || !version_id) {
  return [{ json: { valid: false, error: 'Missing required fields: user_id, version_id' } }];
}

const hashInput = version_id + user_id;
let h = 0;
for (let i = 0; i < hashInput.length; i++) {
  const c = hashInput.charCodeAt(i);
  h = Math.imul(31, h) + c | 0;
}
const input_hash = Math.abs(h).toString(16);

return [{ json: { valid: true, user_id, version_id, force, input_hash } }];`,
  });

  const checkValidation = node('Check Validation', 'n8n-nodes-base.if', {
    conditions: {
      boolean: [{ value1: "={{ $('Validate Input').first().json.valid }}", value2: true }],
      string: [],
    },
  });

  const validationErrorResponse = node('Validation Error Response', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify({ status: "error", message: $("Validate Input").first().json.error || "Validation failed" }) }}',
    options: { responseCode: 400 },
  });

  // ─── EXISTING RECORD CHECK ───────────────────────
  const getExistingRecord = node('Get Existing CC Synthesis Record', 'n8n-nodes-base.supabase', {
    operation: 'getAll',
    tableId: 'cc_synthesis',
    returnAll: true,
    filters: {
      conditions: [{ keyName: 'version_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.version_id }}" }],
    },
  }, { alwaysOutputData: true });

  const normalizeExistingRecord = node('Normalize Existing Record', 'n8n-nodes-base.code', {
    jsCode: `const items = $input.all();
if (!items || items.length === 0 || !items[0].json || !items[0].json.id) {
  return [{ json: { exists: false, synthesis_status: 'pending', input_hash: null, id: null } }];
}
const record = items[0].json;
return [{ json: {
  exists: true,
  synthesis_status: record.synthesis_status || 'pending',
  input_hash: record.input_hash || null,
  id: record.id
} }];`,
  });

  const checkProcessingBlock = node('Check Processing Block', 'n8n-nodes-base.if', {
    conditions: {
      boolean: [],
      string: [{ value1: "={{ $('Normalize Existing Record').first().json.synthesis_status }}", operation: 'startsWith', value2: 'processing' }],
    },
  });

  const processingBlockResponse = node('Processing Block Response', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: '={ "status": "processing", "message": "Synthesis already in progress" }',
    options: { responseCode: 200 },
  });

  const checkForce = node('Check Force', 'n8n-nodes-base.if', {
    conditions: {
      boolean: [{ value1: "={{ $('Validate Input').first().json.force }}", value2: true }],
      string: [],
    },
  });

  const checkSkip = node('Check Skip', 'n8n-nodes-base.code', {
    jsCode: `
const norm = $('Normalize Existing Record').first().json;
const validated = $('Validate Input').first().json;
const shouldSkip = (norm.input_hash === validated.input_hash && norm.synthesis_status === 'complete');
return [{ json: { should_skip: shouldSkip } }];
`,
  });

  const skipGate = node('Skip Gate', 'n8n-nodes-base.if', {
    conditions: {
      boolean: [{ value1: "={{ $('Check Skip').first().json.should_skip }}", value2: true }],
      string: [],
    },
  });

  const skipResponse = node('Skip Response', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: '={ "status": "skipped", "message": "Synthesis already complete with matching inputs" }',
    options: { responseCode: 200 },
  });

  // ─── UPSERT + FIRE 202 ───────────────────────────
  const upsertStatusProcessing = node('Upsert Status Processing', 'n8n-nodes-base.supabase', {
    tableId: 'cc_synthesis',
    fieldsUi: {
      fieldValues: [
        { fieldId: 'user_id', fieldValue: "={{ $('Validate Input').first().json.user_id }}" },
        { fieldId: 'version_id', fieldValue: "={{ $('Validate Input').first().json.version_id }}" },
        { fieldId: 'input_hash', fieldValue: "={{ $('Validate Input').first().json.input_hash }}" },
        { fieldId: 'synthesis_status', fieldValue: 'processing_call_1' },
        { fieldId: 'is_current', fieldValue: 'true' },
        { fieldId: 'run_number', fieldValue: '1' },
        { fieldId: 'gpt_model_used', fieldValue: 'claude-sonnet-4-6' },
        { fieldId: 'generated_at', fieldValue: '={{ new Date().toISOString() }}' },
      ],
    },
  });

  const fire202 = node('Fire 202 Accepted', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: '={ "status": "accepted", "message": "Clarity Compass synthesis initiated" }',
    options: { responseCode: 202 },
  });

  // ─── DATA FETCH CHAIN ────────────────────────────
  const fetchCCVersionRecord = node('Fetch CC Version Record', 'n8n-nodes-base.supabase', {
    operation: 'getAll',
    tableId: 'cc_versions',
    returnAll: true,
    filters: {
      conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.version_id }}" }],
    },
  });

  const fetchHorizonSnapshots = node('Fetch Horizon Snapshots', 'n8n-nodes-base.supabase', {
    operation: 'getAll',
    tableId: 'cc_version_horizon_snapshots',
    returnAll: true,
    filters: {
      conditions: [{ keyName: 'version_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.version_id }}" }],
    },
  });

  const fetchAgencySnapshotBaseline = node('Fetch Agency Snapshot Baseline', 'n8n-nodes-base.supabase', {
    operation: 'getAll',
    tableId: 'agency_snapshot_dashboard_view',
    returnAll: true,
    filters: {
      conditions: [{ keyName: 'user_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.user_id }}" }],
    },
  }, { executeOnce: true });

  const fetchGVSScenarios = node('Fetch GVS Scenarios', 'n8n-nodes-base.supabase', {
    operation: 'getAll',
    tableId: 'gvs_saved_growth_scenarios',
    returnAll: true,
    filters: {
      conditions: [{ keyName: 'user_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.user_id }}" }],
    },
  }, { executeOnce: true });

  // ─── ASSEMBLE CONTEXT ────────────────────────────
  // (keeping the full jsCode from the existing node — abbreviated here for space)
  const assembleContext = node('Assemble Context', 'n8n-nodes-base.code', {
    jsCode: `const validated = $('Validate Input').first().json;
const versionRecord = $('Fetch CC Version Record').first().json;
const horizonRows = $('Fetch Horizon Snapshots').all();
const snapshotData = $('Fetch Agency Snapshot Baseline').first().json;
const scenarioRows = $('Fetch GVS Scenarios').all();

const horizons = {};
for (const row of horizonRows) {
  if (row.json && row.json.horizon) {
    horizons[row.json.horizon] = {
      field_selections: row.json.field_selections || {},
      scenario_id: row.json.scenario_id || null,
      scenario_data: null
    };
  }
}

const scenariosById = {};
for (const row of scenarioRows) {
  if (row.json && row.json.id) {
    scenariosById[row.json.id] = row.json;
  }
}

for (const key of Object.keys(horizons)) {
  const sid = horizons[key].scenario_id;
  if (sid && scenariosById[sid]) {
    const raw = scenariosById[sid];
    const results = raw.results ? (typeof raw.results === 'string' ? JSON.parse(raw.results) : raw.results) : {};
    const pressureInsights = raw.pressure_insights ? (typeof raw.pressure_insights === 'string' ? JSON.parse(raw.pressure_insights) : raw.pressure_insights) : {};
    const inputs = raw.inputs ? (typeof raw.inputs === 'string' ? JSON.parse(raw.inputs) : raw.inputs) : {};
    const synthContent = raw.synthesis_content ? (typeof raw.synthesis_content === 'string' ? JSON.parse(raw.synthesis_content) : raw.synthesis_content) : {};
    horizons[key].scenario_data = {
      scenario_name: raw.scenario_name || null,
      gvi_score: raw.gvi_score || results.gviScore || results.score || null,
      band_label: results.band || null,
      composition_label: results.compositionLabel || null,
      timeframe_months: inputs.raw?.timeframeMonths || null,
      target_agi: inputs.raw?.targetAGI || null,
      current_agi: inputs.raw?.currentAGI || null,
      target_margin: inputs.raw?.targetMargin || null,
      current_margin: inputs.raw?.currentMargin || null,
      target_clients: inputs.raw?.targetClients || null,
      sales_pressure: results.scales?.sales || null,
      hiring_pressure: results.scales?.hiring || null,
      margin_pressure: results.scales?.margin || null,
      retention_pressure: results.scales?.retention || null,
      sales_insight: pressureInsights.sales?.insight || null,
      sales_content: pressureInsights.sales?.contentBlock || null,
      hiring_insight: pressureInsights.hiring?.insight || null,
      hiring_content: pressureInsights.hiring?.contentBlock || null,
      margin_insight: pressureInsights.margin?.insight || null,
      retention_insight: pressureInsights.retention?.insight || null,
      retention_content: pressureInsights.retention?.contentBlock || null,
      synthesis_headline: synthContent.headline || null,
      synthesis_narrative: synthContent.narrative || null
    };
  }
}

const sn = snapshotData;
const snapshot = {
  annual_revenue_run_rate: sn.annual_revenue_run_rate || null,
  annual_agi_run_rate: sn.annual_agi_run_rate || null,
  profit_margin_percentage: sn.profit_margin_percentage || null,
  total_team_size_fte: sn.total_team_size_fte || null,
  active_client_count: sn.active_client_count || null,
  monthly_churn_rate: sn.monthly_churn_rate || null,
  executive_headline: sn.executive_headline || null,
  executive_summary: sn.executive_summary || null,
  mf_synthesis_signal: sn.mf_synthesis_signal || null,
  mf_beat_1_headline: sn.mf_beat_1_headline || null, mf_beat_1: sn.mf_beat_1 || null,
  mf_beat_2_headline: sn.mf_beat_2_headline || null, mf_beat_2: sn.mf_beat_2 || null,
  mf_beat_3_headline: sn.mf_beat_3_headline || null, mf_beat_3: sn.mf_beat_3 || null,
  ef_synthesis_signal: sn.ef_synthesis_signal || null,
  ef_beat_1_headline: sn.ef_beat_1_headline || null, ef_beat_1: sn.ef_beat_1 || null,
  ef_beat_2_headline: sn.ef_beat_2_headline || null, ef_beat_2: sn.ef_beat_2 || null,
  ef_beat_3_headline: sn.ef_beat_3_headline || null, ef_beat_3: sn.ef_beat_3 || null,
  rm_synthesis_signal: sn.rm_synthesis_signal || null,
  rm_beat_1_headline: sn.rm_beat_1_headline || null, rm_beat_1: sn.rm_beat_1 || null,
  rm_beat_2_headline: sn.rm_beat_2_headline || null, rm_beat_2: sn.rm_beat_2 || null,
  rm_beat_3_headline: sn.rm_beat_3_headline || null, rm_beat_3: sn.rm_beat_3 || null,
  da_synthesis_signal: sn.da_synthesis_signal || null,
  da_beat_1_headline: sn.da_beat_1_headline || null, da_beat_1: sn.da_beat_1 || null,
  da_beat_2_headline: sn.da_beat_2_headline || null, da_beat_2: sn.da_beat_2 || null,
  da_beat_3_headline: sn.da_beat_3_headline || null, da_beat_3: sn.da_beat_3 || null,
};

return [{ json: {
  user_id: validated.user_id,
  version_id: validated.version_id,
  input_hash: validated.input_hash,
  horizons,
  snapshot,
  scenario_tags_present: versionRecord.scenario_tags_present || []
} }];`,
  }, { executeOnce: true });

  // ─── SUPABASE SUCCESS PATH ───────────────────────
  const supabaseFinalWrite = node('Supabase Final Write', 'n8n-nodes-base.supabase', {
    operation: 'update',
    tableId: 'cc_synthesis',
    filters: {
      conditions: [{ keyName: 'version_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.version_id }}" }],
    },
    fieldsUi: {
      fieldValues: [
        { fieldId: 'horizon_ultimate_headline', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.horizon_ultimate_headline }}" },
        { fieldId: 'horizon_ultimate_summary', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.horizon_ultimate_summary }}" },
        { fieldId: 'ultimate_vision_oneliner', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.ultimate_vision_oneliner }}" },
        { fieldId: 'movement_1_trajectory', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_1_trajectory }}" },
        { fieldId: 'movement_2_body', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_2_body }}" },
        { fieldId: 'movement_2_implies', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_2_implies }}" },
        { fieldId: 'movement_2_requires', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_2_requires }}" },
        { fieldId: 'movement_3_insight_1_headline', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_3_insight_1_headline }}" },
        { fieldId: 'movement_3_insight_1_body', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_3_insight_1_body }}" },
        { fieldId: 'movement_3_insight_2_headline', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_3_insight_2_headline }}" },
        { fieldId: 'movement_3_insight_2_body', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_3_insight_2_body }}" },
        { fieldId: 'movement_4_north_star', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.movement_4_north_star }}" },
        { fieldId: 'founder_arc', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.founder_arc }}" },
        { fieldId: 'vision_statement', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.vision_statement }}" },
        { fieldId: 'mission_statement', fieldValue: "={{ $('Parse & Validate Call 4').first().json.payload.mission_statement }}" },
        { fieldId: 'synthesis_status', fieldValue: 'complete' },
        { fieldId: 'synthesis_completed_at', fieldValue: '={{ new Date().toISOString() }}' },
      ],
    },
  });

  // ─── NEW: Sync cc_versions synthesis_status ──────
  const syncVersionsStatus = node('Sync cc_versions Status', 'n8n-nodes-base.supabase', {
    operation: 'update',
    tableId: 'cc_versions',
    filters: {
      conditions: [
        {
          keyName: 'id',
          condition: 'eq',
          keyValue: "={{ $('Validate Input').first().json.version_id }}"
        }
      ]
    },
    fieldsUi: {
      fieldValues: [
        {
          fieldId: 'synthesis_status',
          fieldValue: 'complete'
        }
      ]
    }
  });

  const successResponse = node('Success Response', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: '={ "status": "complete", "message": "Clarity Compass synthesis complete" }',
    options: { responseCode: 200 },
  });

  // ─── ERROR PATH ──────────────────────────────────
  const supabaseErrorWrite = node('Supabase Error Write', 'n8n-nodes-base.supabase', {
    operation: 'update',
    tableId: 'cc_synthesis',
    filters: {
      conditions: [{ keyName: 'version_id', condition: 'eq', keyValue: "={{ $('Validate Input').first().json.version_id }}" }],
    },
    fieldsUi: {
      fieldValues: [
        { fieldId: 'synthesis_status', fieldValue: "={{ $('Parse & Validate Call 4').first().json.failed_status || 'failed_call_4' }}" },
        { fieldId: 'synthesis_completed_at', fieldValue: '={{ new Date().toISOString() }}' },
      ],
    },
  });

  const errorResponse = node('Error Response', 'n8n-nodes-base.respondToWebhook', {
    respondWith: 'json',
    responseBody: "={{ JSON.stringify({ status: 'error', message: $('Parse & Validate Call 4').first().json.error_message }) }}",
    options: { responseCode: 500 },
  });

  // ─── CONNECTIONS ─────────────────────────────────
  webhookTrigger.next(checkAuth).next(validateInput).next(checkValidation);
  checkValidation.outputOf(0).next(getExistingRecord);
  checkValidation.outputOf(1).next(validationErrorResponse);
  getExistingRecord.next(normalizeExistingRecord).next(checkProcessingBlock);
  checkProcessingBlock.outputOf(0).next(processingBlockResponse);
  checkProcessingBlock.outputOf(1).next(checkForce);
  checkForce.outputOf(0).next(upsertStatusProcessing);
  checkForce.outputOf(1).next(checkSkip);
  checkSkip.next(skipGate);
  skipGate.outputOf(0).next(skipResponse);
  skipGate.outputOf(1).next(upsertStatusProcessing);
  upsertStatusProcessing.next(fire202).next(fetchCCVersionRecord)
    .next(fetchHorizonSnapshots).next(fetchAgencySnapshotBaseline)
    .next(fetchGVSScenarios).next(assembleContext);

  // NOTE: Calls 1-4 + partials are declared in the existing workflow —
  // we keep them unchanged. The patch only affects the tail:
  supabaseFinalWrite.next(syncVersionsStatus).next(successResponse);
  supabaseErrorWrite.next(errorResponse);
});
