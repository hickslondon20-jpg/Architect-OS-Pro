---
name: kb-inserter
description: Inserts approved chunking plans into the Supabase vector store. Use when the user asks to insert KB chunks, run the knowledge base ingestion, or process an approved chunking plan.
---

# KB Inserter

## Purpose
Take an approved chunking plan (produced by the KB Chunker skill) and insert all chunks into the Supabase `platform_knowledge` vector store with embeddings.

## Prerequisites
-   **Dependencies**: The project must have the following packages installed:
    ```bash
    npm install openai @supabase/supabase-js dotenv
    ```
-   **Environment Variables**: The following must be set in `.env` or `.env.local`:
    -   `OPENAI_API_KEY`: For generating embeddings.
    -   `VITE_SUPABASE_URL`: Supabase project URL.
    -   `VITE_SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_KEY`): Supabase API key.
-   **Database Table**: The `platform_knowledge` table must exist in Supabase with the correct schema (including `embedding` vector column).

## Inputs
1.  `chunking_plan_path` (required) — Absolute path to the approved chunking plan markdown file.
2.  `dry_run` (optional) — Set to `true` to validate without inserting.

## Process
This skill executes a TypeScript script to perform the heavy lifting (parsing, embedding, inserting).

1.  **Locate Script**: The script is located at `.agent/skills/kb-inserter/scripts/insert_chunks.ts`.
2.  **Verify Plan**: Ensure the `chunking_plan_path` exists.
3.  **Execute Script**: Run the script using `npx tsx`.
4.  **Review Output**: The script will output a summary to the console and a detailed report to `outputs/insertion_reports/`.

## Script Usage

To run the insertion process, execute the following command in the terminal:

```bash
npx tsx ".agent/skills/kb-inserter/scripts/insert_chunks.ts" [path_to_plan.md] [--dry-run]
```

**Example:**
```bash
npx tsx ".agent/skills/kb-inserter/scripts/insert_chunks.ts" "outputs/chunking_plans/knowledgebase_dev_plan.md" --dry-run
```

## Output & Reporting
The script generates a report at:
-   **Windows**: `outputs/insertion_reports/[source_doc]_insertion_report.md`
-   **Linux/Cloud**: `/mnt/user-data/outputs/insertion_reports/[source_doc]_insertion_report.md`

### Report Format
```text
INSERTION REPORT: [source_doc]
SOURCE PLAN: [path]
...
RESULTS:
Total: [N], Inserted: [N], Failed: [N], Skipped: [N]
...
ERRORS:
...
```

## Error Handling
-   **Duplicates**: Skipped automatically (based on `chunk_id`).
-   **API Errors**: Retried once, then logged as failure.
-   **Partial Success**: The script continues processing remaining chunks even if one fails.

## Success Criteria
-   Script completes with exit code 0.
-   Report file is generated.
-   Console summary confirms inserted count.
