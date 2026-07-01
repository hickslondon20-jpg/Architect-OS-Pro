// ============================================================
// OS Engine â€” Mock data (skeleton pass / WS1)
// ------------------------------------------------------------
// Types mirror the FUTURE Supabase tables so WS2 wiring is a
// swap, not a rewrite. NOTHING here is wired to a backend.
// ============================================================

export type DocStatus = 'uploaded' | 'processing' | 'ingested' | 'failed' | 'deleted' | 'duplicate';

/** Mirrors future `raw_document_registry`. */
export interface RawDocument {
  id: string;
  fileName: string;
  fileType: string; // e.g. 'pdf' | 'docx' | 'csv' | 'xlsx' | 'md'
  uploadDate: string; // ISO date
  status: DocStatus;
  connectedPages: string[]; // KnowledgePage ids this doc fed into
  sizeLabel?: string;
  storagePath?: string;
  userId?: string;
  folderId?: string | null;
  folder_id?: string | null;
  recordState?: 'active' | 'duplicate' | 'superseded' | 'deleted';
  contentHash?: string | null;
  duplicateOfDocumentId?: string | null;
  extractedMetadata?: Record<string, unknown>;
  metadataExtractionStatus?: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  metadataDocumentType?: string | null;
  metadataBusinessDomain?: string | null;
  metadataTimePeriod?: string | null;
  metadataSummary?: string | null;
  metadataTopics?: string[];
  metadataConfidence?: number | null;
  parserStatus?: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  parserName?: string | null;
  parserVersion?: string | null;
  parserFormat?: string | null;
  parserWarnings?: string[];
  extractionQuality?: string | null;
  sourceFormatMetadata?: Record<string, unknown>;
}

export interface KbFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderTreeNode extends KbFolder {
  children: FolderTreeNode[];
}

export type PageType =
  | 'business_context'
  | 'assessment_intelligence'
  | 'strategic_context'
  | 'financial_patterns'
  | 'conversation_intelligence'
  | 'custom';

/** Mirrors future `knowledge_pages`. */
export interface KnowledgePage {
  id: string;
  pageType: PageType;
  title: string;
  content: string; // markdown
  lastUpdated: string; // ISO date
  sourceFileIds: string[]; // RawDocument ids this page was synthesized from
  wordCount: number;
  category?: WikiCategoryId; // light grouping; fills over time
}

export type WikiCategoryId =
  | 'financial'
  | 'client_market'
  | 'operational'
  | 'conversation_meeting'
  | 'org_health'
  | 'founder_identity';

export interface WikiCategory {
  id: WikiCategoryId;
  label: string;
  description: string;
}

export type LogKind = 'activity' | 'decision';

/** Mirrors future combined activity + decision feed. */
export interface LogEntry {
  id: string;
  kind: LogKind;
  text: string;
  timestamp: string; // ISO date-time
  icon: string; // lucide icon name (resolved in LogView)
}

// ------------------------------------------------------------
// Plain-English labels for the five core page types.
// (Founder-facing labels â€” flagged as an open item for the gate.)
// ------------------------------------------------------------
export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  business_context: 'Business Context',
  assessment_intelligence: 'Assessment Intelligence',
  strategic_context: 'Strategic Context',
  financial_patterns: 'Financial Patterns',
  conversation_intelligence: 'Conversation Intelligence',
  custom: 'Added Pages',
};

// ------------------------------------------------------------
// Six data-category folders (light grouping, not upload bins).
// ------------------------------------------------------------
export const WIKI_CATEGORIES: WikiCategory[] = [
  { id: 'financial', label: 'Financial', description: 'Revenue, margin, pricing and cash patterns.' },
  { id: 'client_market', label: 'Client & Market', description: 'Positioning, ICP, pipeline and market signal.' },
  { id: 'operational', label: 'Operational', description: 'Delivery, capacity and process.' },
  { id: 'conversation_meeting', label: 'Conversation & Meeting', description: 'Notes, calls and decisions captured over time.' },
  { id: 'org_health', label: 'Org Health', description: 'Team, roles and organizational signal.' },
  { id: 'founder_identity', label: 'Founder Identity', description: 'Goals, evolution and founder context.' },
];

// ------------------------------------------------------------
// Mock raw documents â€” one per status.
// ------------------------------------------------------------
export const MOCK_RAW_DOCUMENTS: RawDocument[] = [
  {
    id: 'doc_fin_pnl_q1',
    fileName: 'Q1-2026-PnL.xlsx',
    fileType: 'xlsx',
    uploadDate: '2026-06-08',
    status: 'ingested',
    connectedPages: ['page_financial_patterns'],
    sizeLabel: '212 KB',
  },
  {
    id: 'doc_client_roster',
    fileName: 'Client-Roster-and-Retainers.csv',
    fileType: 'csv',
    uploadDate: '2026-06-09',
    status: 'ingested',
    connectedPages: ['page_business_context'],
    sizeLabel: '48 KB',
  },
  {
    id: 'doc_strategy_deck',
    fileName: '2026-Strategy-Offsite.pdf',
    fileType: 'pdf',
    uploadDate: '2026-06-11',
    status: 'processing',
    connectedPages: [],
    sizeLabel: '3.1 MB',
  },
  {
    id: 'doc_team_notes',
    fileName: 'Leadership-Sync-Notes.docx',
    fileType: 'docx',
    uploadDate: '2026-06-12',
    status: 'uploaded',
    connectedPages: [],
    sizeLabel: '36 KB',
  },
  {
    id: 'doc_export_old',
    fileName: 'Legacy-CRM-Export.csv',
    fileType: 'csv',
    uploadDate: '2026-06-07',
    status: 'failed',
    connectedPages: [],
    sizeLabel: '1.9 MB',
  },
];

// ------------------------------------------------------------
// Five core synthesized pages â€” one rich (Financial Patterns),
// others lighter or empty. Plus the wiki is open-ended.
// ------------------------------------------------------------
export const MOCK_KNOWLEDGE_PAGES: KnowledgePage[] = [
  {
    id: 'page_financial_patterns',
    pageType: 'financial_patterns',
    title: 'Financial Patterns',
    category: 'financial',
    lastUpdated: '2026-06-08',
    sourceFileIds: ['doc_fin_pnl_q1'],
    wordCount: 612,
    content: `# Financial Patterns

What the system currently understands about your agency's financial shape.

## Revenue mix
Your revenue concentrates in **retainer engagements (roughly 68%)**, with project work and one-off advisory making up the remainder. Retainer concentration gives you predictable cash but ties growth to seat capacity.

## Margin signal
- Blended gross margin sits around **54%**, below the 60% target typical of your stage on the AE Ladder.
- The largest margin drag is **delivery over-servicing** on three legacy accounts.

## Cash rhythm
Collections cluster in the first ten days of each month, creating a mid-month dip. A modest shift to bi-monthly invoicing would smooth this.

## Watch items
1. Two accounts represent **41% of monthly recurring revenue** â€” concentration risk.
2. Pricing has not changed in 14 months while delivery scope has expanded.

> _Synthesized from your uploaded Q1 P&L. Corrections you add below are honored on the next rebuild._
`,
  },
  {
    id: 'page_business_context',
    pageType: 'business_context',
    title: 'Business Context',
    category: 'client_market',
    lastUpdated: '2026-06-09',
    sourceFileIds: ['doc_client_roster'],
    wordCount: 188,
    content: `# Business Context

A working picture of who you serve and how you're positioned.

## Who you serve
Primarily **mid-market B2B services brands** seeking demand generation and lifecycle marketing.

## Positioning
You compete on **strategic depth**, not lowest cost. Your client roster skews toward multi-service retainers.

_This page will deepen as more context is filed._
`,
  },
  {
    id: 'page_assessment_intelligence',
    pageType: 'assessment_intelligence',
    title: 'Assessment Intelligence',
    category: 'founder_identity',
    lastUpdated: '2026-06-05',
    sourceFileIds: [],
    wordCount: 96,
    content: `# Assessment Intelligence

A synthesis of your diagnostic results across the platform â€” AE Ladder stage, M&R Audit findings, and Architect Evolution signals.

_Connect your assessments from the Welcome tab to populate this page._
`,
  },
  {
    id: 'page_strategic_context',
    pageType: 'strategic_context',
    title: 'Strategic Context',
    category: undefined,
    lastUpdated: '2026-06-04',
    sourceFileIds: [],
    wordCount: 0,
    content: `# Strategic Context

Your goals, horizons and current quarter focus â€” synthesized from your planning work.

_This page is empty. It fills as you complete planning in the Pro Suite or import existing plans._
`,
  },
  {
    id: 'page_conversation_intelligence',
    pageType: 'conversation_intelligence',
    title: 'Conversation Intelligence',
    category: 'conversation_meeting',
    lastUpdated: '2026-06-04',
    sourceFileIds: [],
    wordCount: 0,
    content: `# Conversation Intelligence

The synthesized view of decisions and signals from your Virtual CSO conversations.

_This page is empty until you start working with the Virtual CSO._
`,
  },
];

// ------------------------------------------------------------
// Mock log entries â€” combined activity + decision feed.
// ------------------------------------------------------------
export const MOCK_LOG_ENTRIES: LogEntry[] = [
  {
    id: 'log_1',
    kind: 'activity',
    text: 'Ingested Q1-2026-PnL.xlsx into Financial Patterns.',
    timestamp: '2026-06-08T09:14:00',
    icon: 'FileCheck2',
  },
  {
    id: 'log_2',
    kind: 'activity',
    text: 'Updated Business Context from Client-Roster-and-Retainers.csv.',
    timestamp: '2026-06-09T11:02:00',
    icon: 'RefreshCw',
  },
  {
    id: 'log_3',
    kind: 'decision',
    text: 'Flagged client concentration risk for review (41% of MRR in two accounts).',
    timestamp: '2026-06-10T16:40:00',
    icon: 'Lightbulb',
  },
  {
    id: 'log_4',
    kind: 'activity',
    text: 'Started processing 2026-Strategy-Offsite.pdf.',
    timestamp: '2026-06-11T08:25:00',
    icon: 'Loader',
  },
  {
    id: 'log_5',
    kind: 'decision',
    text: 'Noted pricing unchanged for 14 months while scope expanded â€” revisit on next sprint.',
    timestamp: '2026-06-12T07:50:00',
    icon: 'Lightbulb',
  },
];

// ------------------------------------------------------------
// First-run consented import checklist (Welcome view).
// ------------------------------------------------------------
export interface ImportSource {
  id: string;
  label: string;
  description: string;
}

export const IMPORT_SOURCES: ImportSource[] = [
  { id: 'agency_snapshot', label: 'Agency Snapshot', description: 'Your market footprint and economic foundation.' },
  { id: 'gvs_scenarios', label: 'GVS Scenarios', description: 'Growth Velocity scenarios you have modeled.' },
  { id: 'clarity_compass', label: 'Clarity Compass', description: 'Your vision state and clarity work.' },
  { id: 'architect_evolution', label: 'Architect Evolution', description: 'Founder evolution assessment results.' },
  { id: 'mra_audit', label: 'M&R Audit', description: 'Your marketing & revenue diagnostic findings.' },
  { id: 'sprint_plans', label: 'Sprint Plans', description: 'Quarter map and active sprint plans.' },
];

// ------------------------------------------------------------
// Derived helpers (Index / Manifest read from these arrays).
// ------------------------------------------------------------
export const getPageById = (id: string) => MOCK_KNOWLEDGE_PAGES.find((p) => p.id === id);
export const getDocById = (id: string) => MOCK_RAW_DOCUMENTS.find((d) => d.id === id);
export const getPagesForCategory = (categoryId: WikiCategoryId) =>
  MOCK_KNOWLEDGE_PAGES.filter((p) => p.category === categoryId);
export const getCategoryPageCount = (categoryId: WikiCategoryId) =>
  getPagesForCategory(categoryId).length;

/** The five core page types, in display order (the "starter pages"). */
export const STARTER_PAGE_TYPES: PageType[] = [
  'business_context',
  'assessment_intelligence',
  'strategic_context',
  'financial_patterns',
  'conversation_intelligence',
];

export const getStarterPages = () =>
  STARTER_PAGE_TYPES.map((t) => MOCK_KNOWLEDGE_PAGES.find((p) => p.pageType === t)).filter(
    (p): p is KnowledgePage => Boolean(p),
  );


