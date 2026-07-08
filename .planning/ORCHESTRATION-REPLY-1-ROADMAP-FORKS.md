# Reply to Orchestration Agent — Round 1 (roadmap forks)

*(Paste to the orchestration thread in response to its grounding read-back.)*

---

Strong read-back — you're aligned on the vision and your state assessment is right, especially
the "code-complete is a narrower claim than it sounds" point. Two of your flags are standout
catches: the **Reflection Review cross-dependency** (core-platform incompleteness quietly
gating two intelligence-layer items) and the **readiness-language** distinction. Good work.

To your closing question — where to push first — the answer is a specific order, because these
aren't independent. **Resolve in this sequence: (1) readiness vocabulary, (2) the
connection-phase MVP fork, (3) the triage.** The triage can't be finalized until the first two
are settled — it depends on them — so we don't start there even though it's tempting.

## 1. Lock the readiness vocabulary now (agreed)

Adopt your distinction as the shared tracking ladder, effective immediately:

> **backend-complete → live-verified → usable (front-end wired) → polished**

The tracker's green Ep rows mean **backend-complete**, full stop — not usable. Use this
language in `Pro-Suite-Progress.md` and in every roadmap statement so we never conflate "built"
with "ready." This is locked.

## 2. The connection phase is the real fork — and it exposes a gap in my own steer

My steer was *fix → test → polish → §8 → MVP*. Notice the **connection phase isn't in it.**
That's not something to gloss over — it's the single decision that most changes what MVP *is*,
because the connection phase is what makes **Tier 1 (the wiki) actually live to a founder.**
Without it: the "knows your business" differentiator isn't real in the product, wiki-page
citations stay dark (L24), and the cross-tier reasoning the whole vision is built around ("how
does my P&L connect to my sprint goals and my 24-month target") doesn't work. MVP-without-
connection is "RAG + document tools + a workflow engine + citations" — useful, but not the
differentiated strategic-operating-system pitch.

But it is **not all-or-nothing**, and that's how we resolve it without blowing up the timeline.
The connection phase spans a **minimal slice** (wire the existing wiki read tools —
`docwiki_search/get_page`, `wiki_get_page/search` — into the VCSO and Domain Agents registries
so the wiki actually gets retrieved in a normal turn, which also lights up wiki-page citations)
up to the **full sophistication** (parallel cross-tier assembly, stage-primer injection, the
CSO persona layer). KB Explorer Phases 8–9 already stood up a basic router and mirrored Layer
1, so the minimal slice is a far smaller lift than "build the frontier."

**My lean: the minimal connection slice is MVP-required; the full router sophistication is v1.**
That keeps the differentiator real for beta without turning MVP into a research project. But
this is genuinely a business call — how much "knows your business" magic the beta value prop
needs — so I want to decide it deliberately, not let it fall out of the steer by omission.

**Your next deliverable (still discussion, not orchestration):** develop the connection-phase
options for us to pressure-test — specifically, define the **minimal viable connection slice**
concretely: what exactly gets wired (which wiki read tools into which surfaces, what tier
selection), what it *buys* for MVP (wiki live, wiki-page citations, which of the vision's
cross-tier questions become answerable), what it *costs* (scope/effort, dependencies, what it
reuses from Phases 8–9), and what explicitly defers to v1. Verify the current Phase 8–9 state
live so we know the real starting point. Bring that back and we'll decide the fork together.

## 3. The triage comes after

Once the vocabulary and the connection fork are settled, your MVP-required-vs-post-MVP triage
becomes stable and we scope the first managing agent from it.

## Quick wins — agreed and queued (hold the spin-up until we've settled the fork)

These are decided as early/required; don't spin up agents for them yet — sequence them when you
propose the first managing agent(s):

- **MRA repoint + resolver-integrity guard + CLAUDE.md Rule #3 update.** Repoint
  `platform_record_resolver.py` from `mra_checkpoints` to the live `gm_checkpoints`/
  `gm_checkpoint_*`; add the guard asserting every `platform_record` source-kind resolves to a
  real live table; and fix the canonical rule itself — CLAUDE.md Rule #3 still says
  "`mra_checkpoints` or similar," so update it to name the real substrate. This pairs naturally
  with the front of the testing pass (it's a live-correctness bug).
- **OpenAI billing/quota is a hard prerequisite for the testing pass.** Embeddings
  (`text-embedding-3-small`) and the Ep7 verifier depend on it, and half the Ep1 smokes are
  blocked on it. It has to clear before the consolidated testing pass can actually run — flag it
  as a gating item, not a mid-pass surprise.
- **Log the Reflection Review cross-dependency.** Core-platform work (rollover logic / V-11) is
  gating two dark intelligence items; surface it to whoever owns the core platform. Almost
  certainly post-MVP, so it blocks nothing now — just don't let it stay invisible.
- **Tracker mojibake cleanup** — low priority, real; schedule whenever convenient.

## Mode

We're still aligning — no agents, no plan files, no build/test/design work yet. The next move
is your connection-phase framing so we can pressure-test and decide the fork. Once that and the
triage are settled, we'll scope the first managing agent together (lead-off: the MRA fix, then
the consolidated testing / verification-debt pass).
