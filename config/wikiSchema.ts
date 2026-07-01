import wikiSchemaJson from './wiki_schema.json';

export type WikiSchemaVersion = 'wiki-1.0';
export type WikiPageKind = 'compiled_base_only' | 'insight_accreting';
export type WikiPageKey =
  | 'business_context'
  | 'diagnostic_synthesis'
  | 'current_quarter_sprint'
  | 'growth_constraints'
  | 'financial_context'
  | 'client_market_position'
  | 'open_questions';
export type WikiConfidence = 'high' | 'medium' | 'low';
export type WikiClaimStatus = 'active' | 'quarantined' | 'trusted' | 'contested' | 'retired';
export type WikiClaimClass = 'compiled' | 'insight' | 'override';

export type WikiSchemaPage = {
  kind: WikiPageKind;
  title: string;
  ose_page_type: string;
  default_tags: string[];
};

export type WikiSchemaTagTaxonomy = {
  domains: string[];
  stages: Array<{ id: 1 | 2 | 3 | 4 | 5; name: 'Rising' | 'Striving' | 'Thriving' | 'Driving' | 'Arriving' }>;
  stage_content_note: string;
  tiers: string[];
};

export type WikiSchema = {
  wiki_schema_version: WikiSchemaVersion;
  pages: Record<WikiPageKey, WikiSchemaPage>;
  confidence_enum: WikiConfidence[];
  claim_status_enum: WikiClaimStatus[];
  claim_class_enum: WikiClaimClass[];
  frontmatter_contract: Array<'page_key' | 'wiki_version' | 'last_compiled_at' | 'tags'>;
  contradiction_fields: Array<'contradictions' | 'contested'>;
  tag_taxonomy: WikiSchemaTagTaxonomy;
  event_rebuild_targets: Record<string, WikiPageKey[]>;
  ose_mapping_note: string;
};

export const wikiSchema = wikiSchemaJson as WikiSchema;

export const wikiPageKeys = Object.keys(wikiSchema.pages) as WikiPageKey[];

export function is_compiled_base_only(pageKey: string): pageKey is WikiPageKey {
  return valid_page_key(pageKey) && wikiSchema.pages[pageKey].kind === 'compiled_base_only';
}

export function is_insight_accreting(pageKey: string): pageKey is WikiPageKey {
  return valid_page_key(pageKey) && wikiSchema.pages[pageKey].kind === 'insight_accreting';
}

export function valid_page_key(pageKey: string): pageKey is WikiPageKey {
  return Object.prototype.hasOwnProperty.call(wikiSchema.pages, pageKey);
}

export function valid_confidence(value: string): value is WikiConfidence {
  return wikiSchema.confidence_enum.includes(value as WikiConfidence);
}

export function valid_tag(tag: string): boolean {
  const { domains, tiers, stages } = wikiSchema.tag_taxonomy;
  return (
    domains.includes(tag) ||
    tiers.includes(tag) ||
    stages.some((stage) => String(stage.id) === tag || stage.name === tag)
  );
}

export function event_rebuild_targets(event: string): WikiPageKey[] {
  return wikiSchema.event_rebuild_targets[event] ?? [];
}
