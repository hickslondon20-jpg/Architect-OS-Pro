alter table public.ose_raw_document_registry
  drop constraint if exists ose_raw_document_registry_file_type_check;

alter table public.ose_raw_document_registry
  add constraint ose_raw_document_registry_file_type_check
  check (
    file_type = any (
      array[
        'pdf'::text,
        'docx'::text,
        'csv'::text,
        'xlsx'::text,
        'txt'::text,
        'png'::text,
        'jpg'::text,
        'html'::text,
        'md'::text
      ]
    )
  );
