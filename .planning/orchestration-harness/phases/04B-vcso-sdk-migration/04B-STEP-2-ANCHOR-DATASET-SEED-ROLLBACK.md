# 04B Step 2 Anchor Dataset Seed Rollback

**Date:** 2026-07-30

## Seed Inventory

Founder:

- `cd490873-99aa-4533-9240-f0aa04deb54f`

Dataset:

- `a15d37c1-cd1b-4fef-88a5-0147bf43db14`
- `SEED — 04B Northlight Client-Level Monthly P&L`

Table:

- `dc37f783-abe6-4f25-8235-1f2ed850c802`
- `northlight_client_monthly_pnl`

Rows:

- `069e1c29-b014-4ab7-8c30-bbc0c5b7d9b1`
- `54ae5f59-50e4-49b6-81c6-d3e9e4e34067`
- `c85cb4ae-72f1-432d-848c-8908458e96ff`
- `bd91607b-bed8-4f5d-8575-ab7bd90ce44b`
- `958156f5-5d33-48d5-88a8-bdfca67def5a`
- `41c11110-1319-4c42-ba28-1c1618fc5afe`
- `1af974a6-4574-41a0-868e-73f49c7e97ab`
- `ce519539-c31f-4b93-aa39-6ca32d3c67fd`
- `ee3ee7b5-4726-48b3-b7d2-12605493c879`
- `8b555614-c9ec-46c5-8b8e-fe8269b4c86d`
- `154ec29b-55bc-47ad-9342-7b015ab59b5e`
- `3f0ec874-b087-45cf-a05c-cfdf956f36ac`
- `fcd047df-526b-449a-b6cd-59bc36264c83`
- `40b97232-58d0-45b8-bd72-3d9a856e778b`
- `c2d243f6-41b9-449e-a2cb-addb97d0df7b`
- `a4f8948f-61f9-4140-9655-3868c06d1ab2`
- `875f72f3-5757-4063-8357-da839968266e`
- `9d078047-3766-444a-a121-eba6b0c660cb`
- `9ad688d5-872a-4d1f-acc2-3e9574a7ddee`
- `56f6108c-3479-4b7f-84b6-5c693a7b1b36`

## Rollback Procedure

Delete only the dataset row:

```sql
delete from public.founder_datasets
where id = 'a15d37c1-cd1b-4fef-88a5-0147bf43db14'
  and user_id = 'cd490873-99aa-4533-9240-f0aa04deb54f';
```

The foreign keys on `founder_dataset_tables` and `founder_dataset_rows` are `on delete cascade`, so deleting the dataset removes the table and all 20 seed rows.

After rollback, verify:

1. `founder_datasets` has zero rows for dataset id `a15d37c1-cd1b-4fef-88a5-0147bf43db14`.
2. `founder_dataset_tables` has zero rows for dataset id `a15d37c1-cd1b-4fef-88a5-0147bf43db14`.
3. `founder_dataset_rows` has zero rows for dataset id `a15d37c1-cd1b-4fef-88a5-0147bf43db14`.
4. The existing `SEED — Q2 2026 P&L Dataset` remains present for founder `cd490873-99aa-4533-9240-f0aa04deb54f`.
5. No wiki or knowledge page rows are changed.

## Verification Note

Dataset-level provenance was written for auditability, but it is not model-visible through the current native tool path because `list_founder_datasets` and `get_dataset_periods` do not select `founder_datasets.provenance`. The model-visible seeded disclosure is carried by the dataset name, summary, metadata, and row-level provenance returned by `get_dataset_periods`.
