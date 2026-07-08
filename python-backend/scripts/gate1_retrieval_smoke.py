"""
Task 1 (final piece) -- confirm hybrid/RRF retrieval returns the chunk that
gate1_ingest_smoke.py just created.

Run from python-backend/, inside the venv, AFTER gate1_ingest_smoke.py:

    python scripts/gate1_retrieval_smoke.py

Calls RetrievalService.hybrid_search directly (same code /api/retrieve uses),
scoped to the test account, with a query that should match the smoke
document's content.
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.retrieval import RetrievalService  # noqa: E402

TEST_USER_ID = "5aae2cc2-624e-40ba-b14d-909b66be5f74"
QUERY = "delivery capacity constraint account managers manual reporting"


def main() -> None:
    service = RetrievalService.from_env()
    results = service.hybrid_search(user_id=TEST_USER_ID, query=QUERY, match_count=5)

    if not results:
        print("FAIL: hybrid_search returned zero chunks.")
        return

    print(f"Returned {len(results)} chunk(s) for query: {QUERY!r}\n")
    for i, chunk in enumerate(results, start=1):
        print(f"#{i} chunk_id={chunk.chunk_id} document_id={chunk.document_id}")
        print(f"    vector_similarity={chunk.vector_similarity:.4f}  keyword_rank={chunk.keyword_rank:.4f}  hybrid_score={chunk.hybrid_score:.4f}")
        print(f"    retrieval_stage={chunk.retrieval_stage}  rerank_score={chunk.rerank_score}")
        print(f"    content: {chunk.content[:120]!r}")
        print()


if __name__ == "__main__":
    main()
