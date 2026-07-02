/**
 * Virtual CSO — mock / in-memory data for the skeleton build.
 *
 * NO backend. These TS shapes anticipate the future tables
 * (`chat_threads`, `chat_messages`, light `projects`) + the provenance
 * the context-assembly function will eventually return for the Sources panel.
 *
 * Assistant replies are written to read on-brand: grounded and observational,
 * referencing stage / margin / concentration / sprint — never prescriptive.
 * They are intended to inform the eventual system prompt (WS3).
 */

export interface Project {
  id: string;
  name: string;
  /** Optional pinned context labels surfaced in the project view. Light only — no scoped synthesis. */
  pinnedContext?: string[];
}

export interface Chat {
  id: string;
  title: string;
  projectId?: string | null;
  pinned?: boolean;
  /** ISO-ish display string; mock only. */
  lastMessageAt: string;
}

export interface AgentStep {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  status?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  agentSteps?: AgentStep[];
  artifactDeliveries?: import('./artifactsApi').ArtifactDelivery[];
}

export type SourceKind = 'wiki' | 'platform' | 'ip' | 'context';

export interface SourceRef {
  kind: SourceKind;
  label: string;
  /** Points at a mock page id whose markdown opens in the Reader (wiki / ip). */
  pageId?: string;
}

/** Markdown bodies opened in the shared Reader when a source is clicked. */
export interface SourcePage {
  id: string;
  title: string;
  meta: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Projects (~2)
// ---------------------------------------------------------------------------

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-pricing',
    name: 'Pricing & packaging',
    pinnedContext: ['Financial Position (wiki)', 'Client Concentration (wiki)'],
  },
  {
    id: 'proj-hiring',
    name: 'Team & capacity',
    pinnedContext: ['Org Health (wiki)'],
  },
];

// ---------------------------------------------------------------------------
// Chats (~4: 1 pinned, some standalone, some in projects)
// ---------------------------------------------------------------------------

export const MOCK_CHATS: Chat[] = [
  {
    id: 'chat-q2-pricing',
    title: 'Q2 pricing decision',
    projectId: 'proj-pricing',
    pinned: true,
    lastMessageAt: '2026-06-11',
  },
  {
    id: 'chat-retainer-mix',
    title: 'Retainer vs. project mix',
    projectId: 'proj-pricing',
    pinned: false,
    lastMessageAt: '2026-06-09',
  },
  {
    id: 'chat-senior-hire',
    title: 'Timing a senior strategist hire',
    projectId: 'proj-hiring',
    pinned: false,
    lastMessageAt: '2026-06-06',
  },
  {
    id: 'chat-sprint-read',
    title: 'Reading the current sprint',
    projectId: null,
    pinned: false,
    lastMessageAt: '2026-06-04',
  },
];

// ---------------------------------------------------------------------------
// Messages — one fully-populated thread (chat-q2-pricing)
// ---------------------------------------------------------------------------

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'chat-q2-pricing': [
    {
      id: 'm1',
      chatId: 'chat-q2-pricing',
      role: 'user',
      content:
        "I'm thinking about raising our retainer floor from $6k to $8.5k for new clients next quarter. Is now the right time?",
      createdAt: '2026-06-11 09:14',
    },
    {
      id: 'm2',
      chatId: 'chat-q2-pricing',
      role: 'assistant',
      content:
        "A few things in your context are worth holding side by side before you commit.\n\nYour Agency Snapshot puts you in the **Operator** stage of the AE Ladder, with blended margin sitting around 41% — healthy, but the last two months trended down as delivery hours crept up on the larger accounts. A floor increase reads as a margin lever, and on the surface it points the right way.\n\nThe thing it sits next to is **concentration**: your top client is ~38% of revenue. Raising the new-client floor doesn't touch that account, so the move sharpens the *quality* of new pipeline without rebalancing the existing risk. Those are different problems.\n\nThe current sprint is oriented around delivery throughput, not sales motion — so a pricing change lands in a quarter where the team's attention is elsewhere. That's not a reason against it; it's a sequencing observation.\n\nWhat would you want the floor increase to actually move — margin, mix, or concentration? The answer changes whether $8.5k is the lever, or just *a* lever.",
      createdAt: '2026-06-11 09:14',
    },
    {
      id: 'm3',
      chatId: 'chat-q2-pricing',
      role: 'user',
      content:
        "Honestly it's margin — the bigger accounts are eating hours. But I don't want to spook the pipeline.",
      createdAt: '2026-06-11 09:21',
    },
    {
      id: 'm4',
      chatId: 'chat-q2-pricing',
      role: 'assistant',
      content:
        "Then it's worth noticing that the floor mostly addresses *future* margin, while the hours bleeding margin are on accounts you already have.\n\nIn your wiki, the **Financial Position** page flags that the two largest accounts run ~1.4x the scoped hours. A new-client floor leaves that untouched for the length of their current terms. So the floor can be the right call for pipeline quality and still not be the thing that recovers this quarter's margin.\n\nOn spooking the pipeline — your win rate in the Snapshot held steady through the last price step, and an Operator-stage book usually has more room on price than founders expect. The risk reads as low. The sequencing question stands, though: a sales-motion change in a delivery-focused sprint is a bit of a crosscurrent.\n\nIf margin is the real target, there may be a parallel conversation about scope discipline on the existing large accounts — that's where the hours are. The floor and the scope reset are two moves, not one.",
      createdAt: '2026-06-11 09:21',
    },
  ],
};

// ---------------------------------------------------------------------------
// Source references for the populated thread + the readable pages behind them
// ---------------------------------------------------------------------------

export const MOCK_SOURCE_REFS: Record<string, SourceRef[]> = {
  'chat-q2-pricing': [
    { kind: 'wiki', label: 'Financial Position', pageId: 'page-financial' },
    { kind: 'wiki', label: 'Client Concentration', pageId: 'page-concentration' },
    { kind: 'platform', label: 'AE Ladder — Operator stage' },
    { kind: 'platform', label: 'Agency Snapshot' },
    { kind: 'platform', label: 'Current sprint focus' },
    { kind: 'ip', label: 'Pricing frameworks', pageId: 'ip-pricing' },
    { kind: 'context', label: 'linked: Financial' },
  ],
};

export const MOCK_SOURCE_PAGES: Record<string, SourcePage> = {
  'page-financial': {
    id: 'page-financial',
    title: 'Financial Position',
    meta: 'Wiki page · synthesized · updated 2026-06-10',
    content: `# Financial Position

A synthesized read of where the agency's economics sit right now. Built from your uploaded P&L summaries and the latest Agency Snapshot.

## Margin
- Blended margin ~**41%**, down from ~44% two months ago.
- The decline tracks rising delivery hours on the two largest accounts (running ~**1.4x** scoped hours).

## Revenue shape
- Monthly recurring base is stable; project revenue is lumpy quarter to quarter.
- New-client retainer floor currently **$6k**.

## What's moving
- Margin pressure is concentrated in *delivery*, not acquisition.
- No pricing change has been made since the last step (win rate held).

> This page is system-generated from your records. Corrections are honored on the next rebuild.`,
  },
  'page-concentration': {
    id: 'page-concentration',
    title: 'Client Concentration',
    meta: 'Wiki page · synthesized · updated 2026-06-10',
    content: `# Client Concentration

How exposed the book is to any single account.

## Current picture
- Top client: ~**38%** of revenue.
- Top three: ~**61%** of revenue.

## Read
- Concentration is the standing structural risk in the book.
- It is **separate** from margin — a move that improves one does not necessarily touch the other.
- New-client pricing changes do not rebalance existing concentration within current terms.

> This page is system-generated from your records. Corrections are honored on the next rebuild.`,
  },
  'ip-pricing': {
    id: 'ip-pricing',
    title: 'Pricing frameworks',
    meta: 'Architect OS IP · shared library',
    content: `# Pricing frameworks

From the AM Growth Partners IP library. Reference frames the Virtual CSO draws on when pricing comes up.

## The three levers a price move can pull
1. **Margin** — recover profitability on the work you do.
2. **Mix** — shift the *kind* of client/work you attract.
3. **Concentration** — rebalance exposure across the book.

A single pricing change rarely moves all three. Naming the target first keeps the move honest.

## Floor vs. scope
- A **floor** change shapes future pipeline.
- A **scope reset** addresses margin on accounts you already hold.
- When margin is the target and the bleed is on existing accounts, the scope reset is usually the faster lever.`,
  },
};

// ---------------------------------------------------------------------------
// Insight-moment starters for the empty / new-chat state
// ---------------------------------------------------------------------------

export interface InsightStarter {
  id: string;
  label: string;
  /** A short framing line shown under the label. */
  hint: string;
}

export const INSIGHT_STARTERS: InsightStarter[] = [
  {
    id: 'starter-move',
    label: 'Pressure-test a strategic move',
    hint: 'Walk a decision through your stage, margin, and concentration before you commit.',
  },
  {
    id: 'starter-hire',
    label: 'Should I make this hire right now?',
    hint: 'Weigh the timing against capacity, the current sprint, and the financials.',
  },
  {
    id: 'starter-financials',
    label: 'What are my financials telling me?',
    hint: 'A grounded read of margin, mix, and concentration from your wiki.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const getChatById = (id: string): Chat | undefined =>
  MOCK_CHATS.find((c) => c.id === id);

export const getProjectById = (id: string): Project | undefined =>
  MOCK_PROJECTS.find((p) => p.id === id);

export const getMessagesForChat = (chatId: string): Message[] =>
  MOCK_MESSAGES[chatId] ?? [];

export const getSourceRefsForChat = (chatId: string): SourceRef[] =>
  MOCK_SOURCE_REFS[chatId] ?? [];

export const getSourcePage = (pageId: string): SourcePage | undefined =>
  MOCK_SOURCE_PAGES[pageId];

export const getChatsForProject = (projectId: string): Chat[] =>
  MOCK_CHATS.filter((c) => c.projectId === projectId);

export const getPinnedChats = (): Chat[] => MOCK_CHATS.filter((c) => c.pinned);

export const getRecentChats = (): Chat[] =>
  [...MOCK_CHATS].sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  wiki: 'Your wiki',
  platform: 'Platform',
  ip: 'Architect OS IP',
  context: 'Your context',
};
