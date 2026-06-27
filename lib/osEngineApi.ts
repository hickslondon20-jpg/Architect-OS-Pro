import { supabase } from './supabaseClient';
import {
  IMPORT_SOURCES,
  PAGE_TYPE_LABELS,
  STARTER_PAGE_TYPES,
  WIKI_CATEGORIES,
  type DocStatus,
  type ImportSource,
  type KnowledgePage,
  type LogEntry,
  type PageType,
  type RawDocument,
  type WikiCategory,
  type WikiCategoryId,
} from './osEngineMockData';

export { IMPORT_SOURCES, PAGE_TYPE_LABELS, STARTER_PAGE_TYPES, WIKI_CATEGORIES };
export type {
  DocStatus,
  ImportSource,
  KnowledgePage,
  LogEntry,
  PageType,
  RawDocument,
  WikiCategory,
  WikiCategoryId,
};

export interface KnowledgeBaseSetup {
  onboarded: boolean;
  importedSources: string[];
  onboardedAt: string | null;
}

export interface OSEngineData {
  docs: RawDocument[];
  pages: KnowledgePage[];
  logEntries: LogEntry[];
  setup: KnowledgeBaseSetup | null;
}

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'csv', 'xlsx', 'txt', 'png', 'jpg']);
const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;
const RAW_DOCUMENT_BUCKET = (import.meta.env.VITE_RAW_DOCUMENT_BUCKET as string | undefined) ?? 'raw-documents';

const requireUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('You must be signed in to use OS Engine.');
  return userId;
};

const formatDate = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

const formatSize = (bytes?: number | null) => {
  if (!bytes) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const safeFileName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '-');

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const asNumber = (value: unknown): number | null => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const sha256File = async (file: File) => {
  if (!globalThis.crypto?.subtle) return null;
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const toKnowledgePage = (row: any): KnowledgePage => ({
  id: row.id,
  pageType: row.page_type,
  title: row.page_title,
  content: row.content ?? '',
  lastUpdated: formatDate(row.last_updated),
  sourceFileIds: row.source_file_ids ?? [],
  wordCount: row.word_count ?? 0,
  category: row.category ?? undefined,
});

const toRawDocument = (row: any): RawDocument => {
  const extractedMetadata: Record<string, any> = row.extracted_metadata ?? {};
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    uploadDate: formatDate(row.upload_timestamp),
    status: row.status,
    connectedPages: row.connected_pages ?? [],
    sizeLabel: formatSize(row.size_bytes),
    storagePath: row.storage_path,
    userId: row.user_id,
    recordState: row.record_state ?? undefined,
    contentHash: row.content_hash ?? null,
    duplicateOfDocumentId: row.duplicate_of_document_id ?? null,
    extractedMetadata,
    metadataExtractionStatus: row.metadata_extraction_status ?? undefined,
    metadataDocumentType: row.metadata_document_type ?? extractedMetadata.document_type ?? null,
    metadataBusinessDomain: row.metadata_business_domain ?? extractedMetadata.business_domain ?? null,
    metadataTimePeriod: row.metadata_time_period ?? extractedMetadata.time_period ?? null,
    metadataSummary: extractedMetadata.summary ?? null,
    metadataTopics: asStringArray(extractedMetadata.topics),
    metadataConfidence: asNumber(extractedMetadata.confidence),
  };
};

const toLogEntry = (row: any): LogEntry => ({
  id: row.id,
  kind: row.kind,
  text: row.text,
  timestamp: row.created_at,
  icon: row.icon ?? 'Activity',
});

export const loadOSEngineData = async (): Promise<OSEngineData> => {
  const userId = await requireUserId();

  const [docsResult, pagesResult, logsResult, setupResult] = await Promise.all([
    supabase
      .from('ose_raw_document_registry')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('upload_timestamp', { ascending: false }),
    supabase.from('ose_knowledge_pages').select('*').order('last_updated', { ascending: false }),
    supabase.from('ose_activity_log').select('*').order('created_at', { ascending: false }),
    supabase.from('ose_knowledge_base_setup').select('*').maybeSingle(),
  ]);

  if (docsResult.error) throw docsResult.error;
  if (pagesResult.error) throw pagesResult.error;
  if (logsResult.error) throw logsResult.error;
  if (setupResult.error) throw setupResult.error;

  return {
    docs: (docsResult.data ?? []).map(toRawDocument),
    pages: (pagesResult.data ?? []).map(toKnowledgePage),
    logEntries: (logsResult.data ?? []).map(toLogEntry),
    setup: setupResult.data
      ? {
          onboarded: setupResult.data.onboarded,
          importedSources: setupResult.data.imported_sources ?? [],
          onboardedAt: setupResult.data.onboarded_at,
        }
      : null,
  };
};

export const getPageById = (pages: KnowledgePage[], id: string) => pages.find((p) => p.id === id);

export const getDocById = (docs: RawDocument[], id: string) => docs.find((d) => d.id === id);

export const getPagesForCategory = (pages: KnowledgePage[], categoryId: WikiCategoryId) =>
  pages.filter((p) => p.category === categoryId);

export const getCategoryPageCount = (pages: KnowledgePage[], categoryId: WikiCategoryId) =>
  getPagesForCategory(pages, categoryId).length;

export const getStarterPages = (pages: KnowledgePage[]) =>
  STARTER_PAGE_TYPES.map((t) => pages.find((p) => p.pageType === t)).filter(
    (p): p is KnowledgePage => Boolean(p),
  );

export const uploadRawDocument = async (file: File): Promise<RawDocument> => {
  const userId = await requireUserId();
  const docId = crypto.randomUUID();
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileType = extension === 'jpeg' ? 'jpg' : extension;

  if (!ALLOWED_EXTENSIONS.has(fileType)) {
    throw new Error('This file type is not supported yet.');
  }

  const contentHash = await sha256File(file);

  if (contentHash) {
    const duplicateLookup = await supabase
      .from('ose_raw_document_registry')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .eq('record_state', 'active')
      .neq('status', 'deleted')
      .order('upload_timestamp', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (duplicateLookup.error) throw duplicateLookup.error;

    if (duplicateLookup.data) {
      const duplicateInsert = await supabase
        .from('ose_raw_document_registry')
        .insert({
          id: docId,
          user_id: userId,
          file_name: file.name,
          file_type: fileType,
          storage_path: duplicateLookup.data.storage_path,
          size_bytes: file.size,
          status: 'duplicate',
          content_hash: contentHash,
          hash_algorithm: 'sha256',
          record_state: 'duplicate',
          duplicate_of_document_id: duplicateLookup.data.id,
          last_hash_checked_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (duplicateInsert.error) throw duplicateInsert.error;
      return toRawDocument(duplicateInsert.data);
    }
  }

  const storagePath = `${userId}/${docId}-${safeFileName(file.name)}`;
  const uploadResult = await supabase.storage.from(RAW_DOCUMENT_BUCKET).upload(storagePath, file, {
    upsert: false,
  });
  if (uploadResult.error) throw uploadResult.error;

  const insertResult = await supabase
    .from('ose_raw_document_registry')
    .insert({
      id: docId,
      user_id: userId,
      file_name: file.name,
      file_type: fileType,
      storage_path: storagePath,
      size_bytes: file.size,
      status: 'uploaded',
      content_hash: contentHash,
      hash_algorithm: contentHash ? 'sha256' : undefined,
      record_state: 'active',
      last_hash_checked_at: contentHash ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (insertResult.error) {
    await supabase.storage.from(RAW_DOCUMENT_BUCKET).remove([storagePath]);
    throw insertResult.error;
  }

  return toRawDocument(insertResult.data);
};

export const queueDocumentIngestion = async (doc: RawDocument) => {
  if (doc.status === 'duplicate' || doc.recordState === 'duplicate') {
    return { queued: false, skipped: true, reason: 'This file was already added.' };
  }

  if (!INGESTION_API_URL || !doc.storagePath || !doc.userId) {
    return { queued: false, reason: 'Ingestion backend is not configured.' };
  }

  const response = await fetch(`${INGESTION_API_URL.replace(/\/$/, '')}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      document_id: doc.id,
      user_id: doc.userId,
      storage_path: doc.storagePath,
      file_name: doc.fileName,
      file_type: doc.fileType,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Ingestion request failed.');
    throw new Error(detail || 'Ingestion request failed.');
  }

  return { queued: true };
};
export const markRawDocumentDeleted = async (docId: string) => {
  const userId = await requireUserId();
  const lookup = await supabase
    .from('ose_raw_document_registry')
    .select('storage_path, record_state')
    .eq('id', docId)
    .eq('user_id', userId)
    .single();
  if (lookup.error) throw lookup.error;

  if (lookup.data.record_state !== 'duplicate' && lookup.data.storage_path) {
    const removeResult = await supabase.storage.from(RAW_DOCUMENT_BUCKET).remove([lookup.data.storage_path]);
    if (removeResult.error) throw removeResult.error;
  }

  const updateResult = await supabase
    .from('ose_raw_document_registry')
    .update({ status: 'deleted', record_state: 'deleted' })
    .eq('id', docId)
    .eq('user_id', userId);
  if (updateResult.error) throw updateResult.error;
};

export const saveKnowledgeBaseSetup = async (selectedSources: string[]) => {
  const userId = await requireUserId();
  const onboardedAt = new Date().toISOString();

  const setupResult = await supabase.from('ose_knowledge_base_setup').upsert({
    user_id: userId,
    onboarded: true,
    imported_sources: selectedSources,
    onboarded_at: onboardedAt,
  });
  if (setupResult.error) throw setupResult.error;

  const seedResult = await supabase.rpc('seed_core_knowledge_pages', { p_user_id: userId });
  if (seedResult.error) throw seedResult.error;
};

export const addPageCorrection = async (pageId: string, body: string) => {
  const userId = await requireUserId();
  const result = await supabase.from('ose_page_corrections').insert({
    user_id: userId,
    page_id: pageId,
    body,
  });
  if (result.error) throw result.error;
};



