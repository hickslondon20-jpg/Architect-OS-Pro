CREATE OR REPLACE VIEW vw_mr_report_payload AS
WITH assessment_base AS (
  SELECT 
    a.assessment_id,
    a.calibration_stage_id,
    COALESCE(a.respondent_name, '') AS "RESPONDENT_NAME",
    COALESCE(TO_CHAR(a.submitted_at AT TIME ZONE 'UTC', 'FMDD FMMonth YYYY'), '') AS "ASSESSMENT_DATE",
    COALESCE(s.stage_name, '') AS "AE_STAGE_LABEL",
    COALESCE(s.stage_maturity_context, '') AS "STAGE_MATURITY_CONTEXT",
    COALESCE(s.stage_readiness_context, '') AS "STAGE_READINESS_CONTEXT"
  FROM gm_assessments a
  LEFT JOIN gm_stages s ON a.calibration_stage_id = s.stage_id
),
overall_scores AS (
  SELECT 
    o.assessment_id,
    COALESCE(ROUND(o.maturity_pct) || '%', '') AS "OVERALL_MATURITY_PCT",
    COALESCE(o.maturity_band_label, '') AS "MATURITY_BAND_LABEL",
    COALESCE(ROUND(o.readiness_pct) || '%', '') AS "OVERALL_READINESS_PCT",
    COALESCE(o.readiness_band_label, '') AS "READINESS_BAND_LABEL",
    COALESCE(o.quadrant_label, '') AS "QUADRANT_LABEL",
    COALESCE(q.interpretation_body, '') AS "QUADRANT_INTERPRETATION"
  FROM gm_assessment_overall_scores o
  LEFT JOIN gm_quadrant_meaning q ON o.quadrant_id = q.quadrant_id
),
dim_scores AS (
  SELECT 
    ds.assessment_id,
    MAX(CASE WHEN d.dimension_order = 1 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "DIM_1_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 1 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "DIM_1_READINESS_PCT",
    MAX(CASE WHEN d.dimension_order = 1 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "FIN_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 1 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "FIN_READINESS_PCT",

    MAX(CASE WHEN d.dimension_order = 2 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "DIM_2_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 2 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "DIM_2_READINESS_PCT",
    MAX(CASE WHEN d.dimension_order = 2 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "CLT_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 2 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "CLT_READINESS_PCT",

    MAX(CASE WHEN d.dimension_order = 3 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "DIM_3_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 3 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "DIM_3_READINESS_PCT",
    MAX(CASE WHEN d.dimension_order = 3 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "OPS_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 3 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "OPS_READINESS_PCT",

    MAX(CASE WHEN d.dimension_order = 4 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "DIM_4_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 4 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "DIM_4_READINESS_PCT",
    MAX(CASE WHEN d.dimension_order = 4 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "TM_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 4 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "TM_READINESS_PCT",

    MAX(CASE WHEN d.dimension_order = 5 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "DIM_5_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 5 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "DIM_5_READINESS_PCT",
    MAX(CASE WHEN d.dimension_order = 5 THEN COALESCE(ROUND(ds.maturity_pct) || '%', '') ELSE '' END) AS "STW_MATURITY_PCT",
    MAX(CASE WHEN d.dimension_order = 5 THEN COALESCE(ROUND(ds.readiness_pct) || '%', '') ELSE '' END) AS "STW_READINESS_PCT"
  FROM gm_assessment_dimension_scores ds
  JOIN gm_dimensions d ON ds.dimension_id = d.dimension_id
  GROUP BY ds.assessment_id
),
gpt_pivoted AS (
  SELECT 
    assessment_id,
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_pattern_signal_1' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "DIM_1_PATTERN_SIGNAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_pattern_signal_2' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "DIM_2_PATTERN_SIGNAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_pattern_signal_3' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "DIM_3_PATTERN_SIGNAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_pattern_signal_4' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "DIM_4_PATTERN_SIGNAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_pattern_signal_5' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "DIM_5_PATTERN_SIGNAL",
    
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_tldr_headline' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_HEADLINE",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_tldr_context' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_CONTEXT",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_tldr_rationale_1' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_RATIONALE_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_tldr_rationale_2' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_RATIONALE_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_tldr_rationale_3' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_RATIONALE_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_top_strengths_framing' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTH_SYNTHESIS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_top_leverage_framing' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINT_SYNTHESIS",

    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_exec_stage_anchor' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_EXEC_STAGE_ANCHOR",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_exec_cross_dim' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_EXEC_CROSS_DIM",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_exec_priority' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_EXEC_PRIORITY",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_exec_guardrails' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_EXEC_GUARDRAILS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_exec_close' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_EXEC_CLOSE",

    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_framing_financial' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_FRAMING_FINANCIAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_translation_financial' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_TRANSLATION_FINANCIAL",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_framing_client' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_FRAMING_CLIENT",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_translation_client' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_TRANSLATION_CLIENT",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_framing_ops' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_FRAMING_OPS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_translation_ops' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_TRANSLATION_OPS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_framing_team' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_FRAMING_TEAM",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_translation_team' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_TRANSLATION_TEAM",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_framing_stewardship' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_FRAMING_STEWARDSHIP",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_dim_translation_stewardship' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_DIM_TRANSLATION_STEWARDSHIP",

    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_cross_dim_synthesis' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_CROSS_DIM_SYNTHESIS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_leverage_synthesis' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_LEVERAGE_SYNTHESIS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_strengths_synthesis' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_STRENGTHS_SYNTHESIS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_horizon_synthesis' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_HORIZON_SYNTHESIS",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_pdf_final_synthesis' AND entity_type = 'assessment' THEN content_text ELSE '' END), '') AS "PDF_FINAL_SYNTHESIS",

    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_1.1' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_1_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_1.2' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_1_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_1.3' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_1_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_1.4' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_1_4",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_1.5' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_1_5",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_2.1' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_2_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_2.2' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_2_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_2.3' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_2_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_2.4' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_2_4",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_2.5' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_2_5",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_3.1' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_3_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_3.2' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_3_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_3.3' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_3_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_3.4' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_3_4",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_3.5' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_3_5",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_4.1' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_4_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_4.2' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_4_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_4.3' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_4_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_4.4' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_4_4",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_4.5' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_4_5",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_5.1' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_5_1",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_5.2' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_5_2",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_5.3' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_5_3",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_5.4' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_5_4",
    COALESCE(MAX(CASE WHEN slot_id = 'mr_capability_rationale' AND entity_id = 'gm_cap_5.5' THEN content_text ELSE '' END), '') AS "MR_CAPABILITY_RATIONALE_5_5"
  FROM gm_assessment_gpt_outputs
  WHERE is_current = true
  GROUP BY assessment_id
),
strength_selections AS (
  SELECT assessment_id, rank_order, c.capability_name
  FROM gm_pathway_selections ps
  JOIN gm_capabilities c ON ps.capability_id = c.capability_id
  WHERE selection_type = 'strength'
),
constraint_selections AS (
  SELECT assessment_id, rank_order, c.capability_name
  FROM gm_pathway_selections ps
  JOIN gm_capabilities c ON ps.capability_id = c.capability_id
  WHERE selection_type = 'leverage'
),
strengths_constraints_pivoted AS (
  SELECT
    COALESCE(s.assessment_id, c.assessment_id) AS assessment_id,
    COALESCE(MAX(CASE WHEN s.rank_order = 1 THEN s.capability_name ELSE '' END), '') AS "strength_headline_1",
    COALESCE(MAX(CASE WHEN s.rank_order = 2 THEN s.capability_name ELSE '' END), '') AS "strength_headline_2",
    COALESCE(MAX(CASE WHEN s.rank_order = 3 THEN s.capability_name ELSE '' END), '') AS "strength_headline_3",
    COALESCE(MAX(CASE WHEN s.rank_order = 4 THEN s.capability_name ELSE '' END), '') AS "strength_headline_4",
    COALESCE(MAX(CASE WHEN s.rank_order = 5 THEN s.capability_name ELSE '' END), '') AS "strength_headline_5",
    COALESCE(MAX(CASE WHEN c.rank_order = 1 THEN c.capability_name ELSE '' END), '') AS "constraint_headline_1",
    COALESCE(MAX(CASE WHEN c.rank_order = 2 THEN c.capability_name ELSE '' END), '') AS "constraint_headline_2",
    COALESCE(MAX(CASE WHEN c.rank_order = 3 THEN c.capability_name ELSE '' END), '') AS "constraint_headline_3",
    COALESCE(MAX(CASE WHEN c.rank_order = 4 THEN c.capability_name ELSE '' END), '') AS "constraint_headline_4",
    COALESCE(MAX(CASE WHEN c.rank_order = 5 THEN c.capability_name ELSE '' END), '') AS "constraint_headline_5"
  FROM strength_selections s
  FULL OUTER JOIN constraint_selections c ON s.assessment_id = c.assessment_id AND s.rank_order = c.rank_order
  GROUP BY COALESCE(s.assessment_id, c.assessment_id)
),
cap_scores AS (
  SELECT 
    cs.assessment_id,
    cs.capability_id,
    COALESCE(x.cross_section_label, '') AS cs_label
  FROM gm_assessment_capability_scores cs
  LEFT JOIN gm_cross_sections x ON cs.cross_section_id = x.cross_section_id
),
cap_info_pivoted AS (
  SELECT 
    a.assessment_id,
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_1.1' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_1_1",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_1.2' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_1_2",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_1.3' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_1_3",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_1.4' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_1_4",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_1.5' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_1_5",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_2.1' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_2_1",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_2.2' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_2_2",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_2.3' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_2_3",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_2.4' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_2_4",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_2.5' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_2_5",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_3.1' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_3_1",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_3.2' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_3_2",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_3.3' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_3_3",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_3.4' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_3_4",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_3.5' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_3_5",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_4.1' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_4_1",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_4.2' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_4_2",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_4.3' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_4_3",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_4.4' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_4_4",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_4.5' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_4_5",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_5.1' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_5_1",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_5.2' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_5_2",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_5.3' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_5_3",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_5.4' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_5_4",
    COALESCE(MAX(CASE WHEN cs.capability_id = 'gm_cap_5.5' THEN cs.cs_label ELSE '' END), '') AS "CS_LABEL_CAP_5_5",
    
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_1.1' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_1_1",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_1.2' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_1_2",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_1.3' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_1_3",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_1.4' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_1_4",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_1.5' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_1_5",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_2.1' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_2_1",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_2.2' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_2_2",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_2.3' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_2_3",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_2.4' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_2_4",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_2.5' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_2_5",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_3.1' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_3_1",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_3.2' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_3_2",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_3.3' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_3_3",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_3.4' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_3_4",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_3.5' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_3_5",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_4.1' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_4_1",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_4.2' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_4_2",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_4.3' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_4_3",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_4.4' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_4_4",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_4.5' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_4_5",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_5.1' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_5_1",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_5.2' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_5_2",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_5.3' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_5_3",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_5.4' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_5_4",
    COALESCE(MAX(CASE WHEN m.capability_id = 'gm_cap_5.5' THEN m.tldr_line ELSE '' END), '') AS "WGL_CAP_5_5"
  FROM gm_assessments a
  LEFT JOIN cap_scores cs ON a.assessment_id = cs.assessment_id
  LEFT JOIN gm_capability_stage_meaning m ON cs.capability_id = m.capability_id AND a.calibration_stage_id = m.stage_id
  GROUP BY a.assessment_id
),
horizon_info AS (
  SELECT 
    a.assessment_id,
    COALESCE(sh.horizon_description, '') AS "horizon_description",
    COALESCE((
      SELECT string_agg(elem #>> '{}', CHR(10)) 
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sh.horizon_evolution_signals) = 'array' THEN sh.horizon_evolution_signals ELSE '[]'::jsonb END) as elem
    ), '') AS "horizon_evolution_signals"
  FROM gm_assessments a
  LEFT JOIN gm_stage_horizon sh ON a.calibration_stage_id = sh.gm_stage_id
),
top_strengths_rationales AS (
  SELECT 
    a.assessment_id,
    COALESCE(MAX(CASE WHEN s.rank_order = 1 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTHS_1",
    COALESCE(MAX(CASE WHEN s.rank_order = 2 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTHS_2",
    COALESCE(MAX(CASE WHEN s.rank_order = 3 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTHS_3",
    COALESCE(MAX(CASE WHEN s.rank_order = 4 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTHS_4",
    COALESCE(MAX(CASE WHEN s.rank_order = 5 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_STRENGTHS_5"
  FROM gm_assessments a
  LEFT JOIN gm_pathway_selections s ON a.assessment_id = s.assessment_id AND s.selection_type = 'strength'
  LEFT JOIN gm_assessment_gpt_outputs r ON a.assessment_id = r.assessment_id 
       AND r.slot_id = 'mr_capability_rationale' AND r.entity_id = s.capability_id AND r.is_current = true
  GROUP BY a.assessment_id
),
top_constraints_rationales AS (
  SELECT 
    a.assessment_id,
    COALESCE(MAX(CASE WHEN c.rank_order = 1 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINTS_1",
    COALESCE(MAX(CASE WHEN c.rank_order = 2 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINTS_2",
    COALESCE(MAX(CASE WHEN c.rank_order = 3 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINTS_3",
    COALESCE(MAX(CASE WHEN c.rank_order = 4 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINTS_4",
    COALESCE(MAX(CASE WHEN c.rank_order = 5 THEN r.content_text ELSE '' END), '') AS "PDF_TLDR_CONSTRAINTS_5"
  FROM gm_assessments a
  LEFT JOIN gm_pathway_selections c ON a.assessment_id = c.assessment_id AND c.selection_type = 'leverage'
  LEFT JOIN gm_assessment_gpt_outputs r ON a.assessment_id = r.assessment_id 
       AND r.slot_id = 'mr_capability_rationale' AND r.entity_id = c.capability_id AND r.is_current = true
  GROUP BY a.assessment_id
)

SELECT 
  ab.assessment_id,
  ab."RESPONDENT_NAME",  ab."AE_STAGE_LABEL",  ab."ASSESSMENT_DATE",
  
  os."OVERALL_MATURITY_PCT",  os."MATURITY_BAND_LABEL",  os."OVERALL_READINESS_PCT",  os."READINESS_BAND_LABEL",
  ab."STAGE_MATURITY_CONTEXT",  ab."STAGE_READINESS_CONTEXT",  os."QUADRANT_LABEL",  os."QUADRANT_INTERPRETATION",
  
  ds."DIM_1_MATURITY_PCT", ds."DIM_1_READINESS_PCT", gp."DIM_1_PATTERN_SIGNAL",
  ds."DIM_2_MATURITY_PCT", ds."DIM_2_READINESS_PCT", gp."DIM_2_PATTERN_SIGNAL",
  ds."DIM_3_MATURITY_PCT", ds."DIM_3_READINESS_PCT", gp."DIM_3_PATTERN_SIGNAL",
  ds."DIM_4_MATURITY_PCT", ds."DIM_4_READINESS_PCT", gp."DIM_4_PATTERN_SIGNAL",
  ds."DIM_5_MATURITY_PCT", ds."DIM_5_READINESS_PCT", gp."DIM_5_PATTERN_SIGNAL",

  gp."PDF_TLDR_HEADLINE", gp."PDF_TLDR_CONTEXT", gp."PDF_TLDR_RATIONALE_1", gp."PDF_TLDR_RATIONALE_2", gp."PDF_TLDR_RATIONALE_3",
  gp."PDF_TLDR_STRENGTH_SYNTHESIS", gp."PDF_TLDR_CONSTRAINT_SYNTHESIS",
  
  scp."strength_headline_1", tsr."PDF_TLDR_STRENGTHS_1",
  scp."strength_headline_2", tsr."PDF_TLDR_STRENGTHS_2",
  scp."strength_headline_3", tsr."PDF_TLDR_STRENGTHS_3",
  scp."strength_headline_4", tsr."PDF_TLDR_STRENGTHS_4",
  scp."strength_headline_5", tsr."PDF_TLDR_STRENGTHS_5",
  
  scp."constraint_headline_1", tcr."PDF_TLDR_CONSTRAINTS_1",
  scp."constraint_headline_2", tcr."PDF_TLDR_CONSTRAINTS_2",
  scp."constraint_headline_3", tcr."PDF_TLDR_CONSTRAINTS_3",
  scp."constraint_headline_4", tcr."PDF_TLDR_CONSTRAINTS_4",
  scp."constraint_headline_5", tcr."PDF_TLDR_CONSTRAINTS_5",

  gp."PDF_EXEC_STAGE_ANCHOR", gp."PDF_EXEC_CROSS_DIM", gp."PDF_EXEC_PRIORITY", gp."PDF_EXEC_GUARDRAILS", gp."PDF_EXEC_CLOSE",

  ds."FIN_MATURITY_PCT", ds."FIN_READINESS_PCT", gp."PDF_DIM_FRAMING_FINANCIAL",
  cip."WGL_CAP_1_1", cip."CS_LABEL_CAP_1_1", gp."MR_CAPABILITY_RATIONALE_1_1",
  cip."WGL_CAP_1_2", cip."CS_LABEL_CAP_1_2", gp."MR_CAPABILITY_RATIONALE_1_2",
  cip."WGL_CAP_1_3", cip."CS_LABEL_CAP_1_3", gp."MR_CAPABILITY_RATIONALE_1_3",
  cip."WGL_CAP_1_4", cip."CS_LABEL_CAP_1_4", gp."MR_CAPABILITY_RATIONALE_1_4",
  cip."WGL_CAP_1_5", cip."CS_LABEL_CAP_1_5", gp."MR_CAPABILITY_RATIONALE_1_5",
  gp."PDF_DIM_TRANSLATION_FINANCIAL",

  ds."CLT_MATURITY_PCT", ds."CLT_READINESS_PCT", gp."PDF_DIM_FRAMING_CLIENT",
  cip."WGL_CAP_2_1", cip."CS_LABEL_CAP_2_1", gp."MR_CAPABILITY_RATIONALE_2_1",
  cip."WGL_CAP_2_2", cip."CS_LABEL_CAP_2_2", gp."MR_CAPABILITY_RATIONALE_2_2",
  cip."WGL_CAP_2_3", cip."CS_LABEL_CAP_2_3", gp."MR_CAPABILITY_RATIONALE_2_3",
  cip."WGL_CAP_2_4", cip."CS_LABEL_CAP_2_4", gp."MR_CAPABILITY_RATIONALE_2_4",
  cip."WGL_CAP_2_5", cip."CS_LABEL_CAP_2_5", gp."MR_CAPABILITY_RATIONALE_2_5",
  gp."PDF_DIM_TRANSLATION_CLIENT",

  ds."OPS_MATURITY_PCT", ds."OPS_READINESS_PCT", gp."PDF_DIM_FRAMING_OPS",
  cip."WGL_CAP_3_1", cip."CS_LABEL_CAP_3_1", gp."MR_CAPABILITY_RATIONALE_3_1",
  cip."WGL_CAP_3_2", cip."CS_LABEL_CAP_3_2", gp."MR_CAPABILITY_RATIONALE_3_2",
  cip."WGL_CAP_3_3", cip."CS_LABEL_CAP_3_3", gp."MR_CAPABILITY_RATIONALE_3_3",
  cip."WGL_CAP_3_4", cip."CS_LABEL_CAP_3_4", gp."MR_CAPABILITY_RATIONALE_3_4",
  cip."WGL_CAP_3_5", cip."CS_LABEL_CAP_3_5", gp."MR_CAPABILITY_RATIONALE_3_5",
  gp."PDF_DIM_TRANSLATION_OPS",

  ds."TM_MATURITY_PCT", ds."TM_READINESS_PCT", gp."PDF_DIM_FRAMING_TEAM",
  cip."WGL_CAP_4_1", cip."CS_LABEL_CAP_4_1", gp."MR_CAPABILITY_RATIONALE_4_1",
  cip."WGL_CAP_4_2", cip."CS_LABEL_CAP_4_2", gp."MR_CAPABILITY_RATIONALE_4_2",
  cip."WGL_CAP_4_3", cip."CS_LABEL_CAP_4_3", gp."MR_CAPABILITY_RATIONALE_4_3",
  cip."WGL_CAP_4_4", cip."CS_LABEL_CAP_4_4", gp."MR_CAPABILITY_RATIONALE_4_4",
  cip."WGL_CAP_4_5", cip."CS_LABEL_CAP_4_5", gp."MR_CAPABILITY_RATIONALE_4_5",
  gp."PDF_DIM_TRANSLATION_TEAM",

  ds."STW_MATURITY_PCT", ds."STW_READINESS_PCT", gp."PDF_DIM_FRAMING_STEWARDSHIP",
  cip."WGL_CAP_5_1", cip."CS_LABEL_CAP_5_1", gp."MR_CAPABILITY_RATIONALE_5_1",
  cip."WGL_CAP_5_2", cip."CS_LABEL_CAP_5_2", gp."MR_CAPABILITY_RATIONALE_5_2",
  cip."WGL_CAP_5_3", cip."CS_LABEL_CAP_5_3", gp."MR_CAPABILITY_RATIONALE_5_3",
  cip."WGL_CAP_5_4", cip."CS_LABEL_CAP_5_4", gp."MR_CAPABILITY_RATIONALE_5_4",
  cip."WGL_CAP_5_5", cip."CS_LABEL_CAP_5_5", gp."MR_CAPABILITY_RATIONALE_5_5",
  gp."PDF_DIM_TRANSLATION_STEWARDSHIP",

  gp."PDF_CROSS_DIM_SYNTHESIS", gp."PDF_LEVERAGE_SYNTHESIS", gp."PDF_STRENGTHS_SYNTHESIS",
  hi."horizon_description", hi."horizon_evolution_signals",
  gp."PDF_HORIZON_SYNTHESIS", gp."PDF_FINAL_SYNTHESIS"

FROM assessment_base ab
LEFT JOIN overall_scores os ON ab.assessment_id = os.assessment_id
LEFT JOIN dim_scores ds ON ab.assessment_id = ds.assessment_id
LEFT JOIN gpt_pivoted gp ON ab.assessment_id = gp.assessment_id
LEFT JOIN strengths_constraints_pivoted scp ON ab.assessment_id = scp.assessment_id
LEFT JOIN cap_info_pivoted cip ON ab.assessment_id = cip.assessment_id
LEFT JOIN horizon_info hi ON ab.assessment_id = hi.assessment_id
LEFT JOIN top_strengths_rationales tsr ON ab.assessment_id = tsr.assessment_id
LEFT JOIN top_constraints_rationales tcr ON ab.assessment_id = tcr.assessment_id;
