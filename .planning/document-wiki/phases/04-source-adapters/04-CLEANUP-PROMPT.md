# Sub-phase 04 Cleanup — Sprint Adapter: Remove capability_evolution Loop

**Scope:** Targeted code-only change to `python-backend/services/doc_wiki_sprint_adapter.py`.
No other files need to change. This is not a feature addition — it is a removal.

---

## Context (read this before touching any code)

The `DocWikiSprintAdapter` built in sub-phase 04 synthesizes two page kinds per sprint close:
1. `sprint_history` — one page per sprint, sourced from `sp_sprint_goals/initiatives/milestones`
2. `capability_evolution` — one page per unique `capability_id` in the sprint's initiatives

**The `capability_evolution` pages are wrong and must be removed.** Two reasons:

1. **Wrong source data.** They read `capability_name` and `capability_id` from
   `sp_sprint_initiatives` — which is the planning label for what was worked, not the
   actual maturity/readiness score change. The score evolution data lives in
   `Reflection & Review` (45 checkpoint re-ratings → working capability scores), which
   is not yet wired to Supabase (V-11 placeholder — confirmed by reading
   `pages/ProSuite/ReflectionReview.tsx`). There is no table to read the right data from.

2. **Wrong granularity.** One page per capability is too granular and too prescriptive.
   The correct shape is one evolution capture per sprint/quarter showing how scores
   shifted across all capabilities and what it means for the next cycle — not 9
   separate per-capability accumulation pages.

The `capability_evolution` page_kind stays in `src/config/doc_wiki_schema.json` — it
will be used correctly in a future adapter once V-11 lands. The vocabulary entry is fine.
Only the synthesis loop is removed.

---

## What to do

**Read first:**
1. `python-backend/services/doc_wiki_sprint_adapter.py` — full file

**Then make exactly these changes:**

### 1. In `synthesize_from_sprint()` — remove the capability_evolution loop

The method currently does roughly:
```python
# (A) Synthesize sprint_history page  ← KEEP THIS
sprint_result = await self._synthesize_sprint_history(goal, initiatives, milestones, user_id)

# (B) Synthesize capability_evolution pages  ← REMOVE THIS ENTIRE BLOCK
cap_results = []
seen_caps = set()
for initiative in initiatives:
    cap_id = initiative.get("capability_id")
    if cap_id and cap_id not in seen_caps:
        seen_caps.add(cap_id)
        existing = self._read_existing_capability_page(user_id, cap_id)
        cap_result = await self._synthesize_capability_evolution(initiative, goal, existing, user_id)
        cap_results.append(cap_result)
```

Remove block (B) entirely. The return value should reflect only the sprint_history result.

### 2. Update the return type / return value

The method currently returns something like:
```python
return {
    "sprint_history": sprint_result,
    "capability_evolution": cap_results,
    "skipped": False,
    "skip_reason": None,
}
```

Change to:
```python
return {
    "sprint_history": sprint_result,
    "skipped": False,
    "skip_reason": None,
}
```

### 3. Remove now-dead private methods

Remove any private methods that exist solely to support the capability_evolution
synthesis and are no longer called after removing the loop. These will include some or
all of:
- `_synthesize_capability_evolution()` (or equivalent)
- `_read_existing_capability_page()`
- `_capability_canonical_key()`
- `_assemble_capability_body()`

**Do not remove** methods that are still used by the sprint_history path:
- `_is_sprint_worthy()`
- `_sprint_canonical_key()`
- `_assemble_sprint_body()`
- Any milestone/initiative loading helpers

If you are unsure whether a method is dead, grep for its name in the file before removing.

### 4. No other files need to change

- `main.py` endpoint stays as-is — it calls `synthesize_from_sprint()` and the return
  shape change is backward-compatible (the caller just receives fewer keys)
- `doc_wiki_schema.json` stays as-is — `capability_evolution` kind remains in vocabulary
- No migration needed

---

## Done-when

- `synthesize_from_sprint()` produces only one wiki page per call: `sprint_history`
- No capability_evolution synthesis loop remains in the file
- All removed methods were genuinely dead (not called elsewhere)
- `python -m compileall python-backend` exits 0
- Report: lines removed, methods removed, compileall output
