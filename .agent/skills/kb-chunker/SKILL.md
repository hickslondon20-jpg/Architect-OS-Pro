---
name: chunking-kb-documents
description: Processes Architect OS knowledge base source documents and produces structured chunking plans. Use when the user asks to chunk a knowledge base document, process KB files, or create a chunking plan.
---

# KB Chunker

## Purpose
Process Architect OS knowledge base source documents (markdown files) and produce structured chunking plans that can be reviewed before insertion into the vector database.

## Inputs
1. `source_file_path` (required) — Path to the markdown source document to be chunked.
2. `guidelines_file_path` (optional) — Path to the chunking guidelines document. Defaults to `knowledgebase/knowledgebase-dev`.

## Process
1.  **Read Source**: Read the content of the `source_file_path`.
2.  **Read Guidelines**: Read the content of the `guidelines_file_path` (defaulting to `knowledgebase/knowledgebase-dev` if not provided).
3.  **Analyze Structure**: Analyze the source document structure, content, and headings.
4.  **Generate Document Summary**: Create a 2-4 sentence overview of the entire source document.
5.  **Identify Chunks**: Identify semantic boundaries and create chunks following the principles in the guidelines.
6.  **Process Chunks**: For each identified chunk:
    -   Extract the **verbatim** content text.
    -   Assign required metadata: `stage`, `domain`, `content_type`, `source_doc` (identifier), `chunk_id`.
    -   Assign optional metadata: `kpi_family` (if applicable).
    -   Write a one-sentence `chunk_summary` describing the specific chunk.
7.  **Flag Behavioral Content**: Identify any behavioral instructions (content for system prompts, not vector store) and list them separately.
8.  **Propose Taxonomy**: Note any proposed extensions to the taxonomy if existing values do not fit.
9.  **Flag Reviews**: Note any uncertainty or decisions requiring human review.
10. **Generate Output**: Construct the markdown output following the exact format below.
11. **Save Output**: Save the plan to `/mnt/user-data/outputs/chunking_plans/[source_doc_identifier]_plan.md`. (Note: On Windows, use a relative path like `outputs/chunking_plans/[source_doc_identifier]_plan.md` or confirm destination with user if `/mnt/` is not available).

## Output Format
Generate a markdown file with this **exact** structure:

```markdown
CHUNKING PLAN: [source_doc_identifier]
SOURCE FILE: [filename]
DOCUMENT SUMMARY: [2-4 sentence overview of the entire source document]
PROCESSED: [timestamp]

================================================
BEHAVIORAL CONTENT FLAGGED (not chunked):
================================================
- [Section name or line range]: [Brief description]

================================================
CHUNKS: [count]
================================================

CHUNK 1
  chunk_id:       [value]
  stage:          [value]
  domain:         [value]
  content_type:   [value]
  kpi_family:     [value or NONE]
  source_doc:     [value]
  doc_summary:    [same document summary repeated for all chunks]
  chunk_summary:  [one-sentence description of this specific chunk]
  notes:          [any flags or uncertainties]
  
  content:
  ---
  [Verbatim text from source document - no paraphrasing]
  ---

CHUNK 2
  [same structure]

...

================================================
TAXONOMY EXTENSIONS PROPOSED:
================================================
[Any new values needed for existing fields]

================================================
REVIEW FLAGS:
================================================
[Any decisions that need human verification]
```

## Key Principles
-   **Split along functional boundaries**, not just formatting.
-   **Keep self-contained units intact**.
-   **Named symptoms and patterns** are individual chunks.
-   **Benchmark tables** stay with interpretation context.
-   **Philosophy chunks** are isolated.
-   **When in doubt, chunk smaller**.
-   **Behavioral instructions** are flagged, not chunked.

## Success Criteria
The output file should be human-readable, easily reviewable, and contain all information needed for the KB Inserter skill to generate embeddings and insert into Supabase without requiring access to the original source document.
