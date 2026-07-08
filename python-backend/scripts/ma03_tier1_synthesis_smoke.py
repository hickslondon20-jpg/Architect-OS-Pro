"""
MA-03 checkpoint 2 smoke script: prove the Tier-1 synthesis pattern end to end on ONE
page, for the MA-03 seeded test user, before wiring it across all 7 pages.

Run from the python-backend/ directory, inside the founder's venv:

    python scripts/ma03_tier1_synthesis_smoke.py
    python scripts/ma03_tier1_synthesis_smoke.py growth_constraints   # optional: any page_key

Why a script instead of hitting an HTTP endpoint: WikiCompilationService.compile_page(...)
is already the exact function the two existing FastAPI endpoints call - running it directly
means any exception (bad SQL, a bad Anthropic call, an RPC constraint violation) surfaces
here in the console immediately instead of vanishing into a request/response cycle, and it
matches the pattern the Gate 1 smoke scripts already established in this repo.

What this proves, end to end, for the MA-03 seeded test user
(cd490873-99aa-4533-9240-f0aa04deb54f):
  1. Input-gathering leads with the vertical AI outputs (gm_assessment_gpt_outputs /
     ae_assessment_insights / cc_synthesis / gvs_scenario_synthesis and friends) via the
     new two-hop owner joins, not the old .limit(3) mechanical pull.
  2. The Sonnet synthesis call fires (LangSmith-traced under capability_key=
     wiki_tier1_synthesis, project ArchitectOS-pro) and returns narrative + claims-with-
     evidence + sourced-from, or fails soft to the mechanical fallback if it errors.
  3. wiki_pages/wiki_claims/wiki_evidence get written via the extended
     replace_compiled_wiki_page RPC (now carrying narrative + sourced_from).
  4. _project_to_ose lands a row in ose_knowledge_pages with a *valid* page_type/category
     (the pre-MA-03 bug silently violated both CHECK constraints) and an embedding
     (closes DL-L1-EMBED).

After running, paste back the console output plus (if easy) a link/screenshot of the
LangSmith trace. Compare wiki_pages.narrative and ose_knowledge_pages.content for this user
against the raw source tables - the acceptance bar is "does this narrative actually read
back what a knowledgeable advisor would say about this business area," not just "did it not
crash."
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.vector_store import VectorStore  # noqa: E402
from services.wiki_compilation import WikiCompilationService, WikiCompilationError  # noqa: E402

TEST_USER_ID = "cd490873-99aa-4533-9240-f0aa04deb54f"
DEFAULT_PAGE_KEY = "diagnostic_synthesis"  # compiled_base_only; exercises the gm_/ae_ two-hop
# owner-join fix and the vertical-AI-output-led gather in one page, without the extra CC->GVS
# traversal complexity of growth_constraints - the cleanest first proof.


def main() -> None:
    page_key = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PAGE_KEY
    force = "--force" in sys.argv[2:]
    print(f"[ma03] compiling page_key={page_key!r} for user_id={TEST_USER_ID} force={force}")

    service = WikiCompilationService(VectorStore.from_env())
    try:
        result = service.compile_page(TEST_USER_ID, page_key, force=force)
    except WikiCompilationError as exc:
        print(f"[ma03] COMPILE FAILED: {exc}")
        raise SystemExit(1)

    print("[ma03] compile_page() returned:")
    print(
        json.dumps(
            {
                "page_key": result.page_key,
                "claim_count": result.claim_count,
                "evidence_count": result.evidence_count,
                "thin": result.thin,
                "synthesis_used": result.synthesis_used,
                "skipped": result.skipped,
                "validation_counts": result.validation_counts,
            },
            indent=2,
        )
    )

    store = VectorStore.from_env()
    page_row = (
        store.client.table("wiki_pages")
        .select("page_key,title,one_line,narrative,sourced_from,synthesis_model,last_compiled_at")
        .eq("user_id", TEST_USER_ID)
        .eq("page_key", page_key)
        .limit(1)
        .execute()
        .data
    )
    ose_row = (
        store.client.table("ose_knowledge_pages")
        .select("canonical_key,page_type,category,confidence,word_count,embedding")
        .eq("user_id", TEST_USER_ID)
        .eq("canonical_key", page_key)
        .limit(1)
        .execute()
        .data
    )

    print("\n[ma03] wiki_pages row:")
    if page_row:
        row = dict(page_row[0])
        print(json.dumps(row, indent=2, default=str))
    else:
        print("  MISSING - wiki_pages row not found (RPC write did not land).")

    print("\n[ma03] ose_knowledge_pages row (projection + embedding check):")
    if ose_row:
        row = dict(ose_row[0])
        has_embedding = row.pop("embedding", None) is not None
        row["embedding_present"] = has_embedding
        print(json.dumps(row, indent=2, default=str))
        if not has_embedding:
            print("  WARNING: embedding is null - DL-L1-EMBED did not close for this page.")
    else:
        print("  MISSING - _project_to_ose did not land a row. This is the exact bug MA-03 "
              "Objective 3 fixed (page_type/category CHECK violations + confidence type "
              "mismatch, both silently swallowed before). If this is still empty, something "
              "regressed - check the console/logs above for a warning from "
              "'wiki_compilation: _project_to_ose'.")


if __name__ == "__main__":
    main()
