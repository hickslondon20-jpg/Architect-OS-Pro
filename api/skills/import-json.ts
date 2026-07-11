import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inflateRawSync } from 'node:zlib';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };
type ZipEntry = { name: string; data: Buffer };
type SkillValues = Record<string, string | string[]>;

const SKILL_FILE_BUCKET = 'skill-files';
const SKILL_FILE_CATEGORIES = new Set(['scripts', 'references', 'assets']);
// Must mirror the DB CHECK constraints on public.skill_packs (ip_skill_packs_domain_check /
// ip_skill_packs_skill_kind_check). Imported SKILL.md files are free-form and commonly won't
// match this internal business taxonomy, so out-of-range values are normalized to null on
// import rather than failing the whole request.
const ALLOWED_DOMAINS = new Set(['financial', 'market', 'operations', 'team', 'founder', 'strategic', 'cross']);
const ALLOWED_SKILL_KINDS = new Set([
  'analysis',
  'diagnostic',
  'prioritization',
  'preparation',
  'reflection',
  'brainstorming',
  'synthesis',
]);

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
};

const getJwt = (req: VercelRequest) => {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Missing bearer token.');
  return match[1];
};

const userClient = (jwt: string) =>
  createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

const serviceClient = () =>
  createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY', 'service_role'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const parseBody = (body: unknown) => {
  if (typeof body === 'string') return JSON.parse(body) as Record<string, unknown>;
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';

const unquote = (value: string) => {
  if (value.length >= 2 && value[0] === value[value.length - 1] && ['"', "'"].includes(value[0])) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
};

const stringList = (value: string | string[] | undefined) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const optionalString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value.join(', ').trim() || null;
  return value?.trim() || null;
};

const splitFrontmatter = (content: string) => {
  const normalized = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) throw new Error('SKILL.md must start with YAML frontmatter.');
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) throw new Error('SKILL.md frontmatter is missing a closing delimiter.');
  let bodyStart = end + '\n---'.length;
  if (normalized[bodyStart] === '\n') bodyStart += 1;
  return { frontmatter: normalized.slice(4, end), body: normalized.slice(bodyStart) };
};

const parseFrontmatter = (text: string) => {
  const values: SkillValues = {};
  let currentListKey: string | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (currentListKey && line.trimStart().startsWith('- ')) {
      const items = (values[currentListKey] as string[]) ?? [];
      items.push(unquote(line.trimStart().slice(2).trim()));
      values[currentListKey] = items;
      continue;
    }
    currentListKey = null;
    const separator = line.indexOf(':');
    if (separator === -1) throw new Error(`Unsupported frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!rawValue) {
      values[key] = [];
      currentListKey = key;
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      values[key] = rawValue.slice(1, -1).split(',').map((item) => unquote(item.trim())).filter(Boolean);
    } else {
      values[key] = unquote(rawValue);
    }
  }
  return values;
};

const parseSkillMd = (content: string) => {
  const { frontmatter, body } = splitFrontmatter(content);
  const values = parseFrontmatter(frontmatter);
  const name = optionalString(values.name);
  const description = optionalString(values.description);
  if (!name) throw new Error('SKILL.md frontmatter requires name.');
  if (!description) throw new Error('SKILL.md frontmatter requires description.');
  const rawDomain = optionalString(values.domain);
  const rawSkillKind = optionalString(values.skill_kind);
  return {
    name,
    description,
    // Out-of-taxonomy values are normalized to null rather than left to blow up the
    // downstream DB CHECK constraint (see ALLOWED_DOMAINS / ALLOWED_SKILL_KINDS above).
    domain: rawDomain && ALLOWED_DOMAINS.has(rawDomain) ? rawDomain : null,
    skill_kind: rawSkillKind && ALLOWED_SKILL_KINDS.has(rawSkillKind) ? rawSkillKind : null,
    trigger_tags: stringList(values.trigger_tags),
    required_platform_context: stringList(values.required_platform_context),
    body,
    normalized: {
      domainDropped: Boolean(rawDomain) && !ALLOWED_DOMAINS.has(rawDomain as string),
      skillKindDropped: Boolean(rawSkillKind) && !ALLOWED_SKILL_KINDS.has(rawSkillKind as string),
    },
  };
};

const readZipEntries = (zipBytes: Buffer): ZipEntry[] => {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = zipBytes.length - 22; offset >= 0; offset -= 1) {
    if (zipBytes.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('ZIP directory could not be read.');

  const entryCount = zipBytes.readUInt16LE(eocdOffset + 10);
  let centralOffset = zipBytes.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (zipBytes.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('ZIP directory is malformed.');
    const method = zipBytes.readUInt16LE(centralOffset + 10);
    const compressedSize = zipBytes.readUInt32LE(centralOffset + 20);
    const nameLength = zipBytes.readUInt16LE(centralOffset + 28);
    const extraLength = zipBytes.readUInt16LE(centralOffset + 30);
    const commentLength = zipBytes.readUInt16LE(centralOffset + 32);
    const localOffset = zipBytes.readUInt32LE(centralOffset + 42);
    const name = zipBytes.slice(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8').replace(/\\/g, '/');

    const localNameLength = zipBytes.readUInt16LE(localOffset + 26);
    const localExtraLength = zipBytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zipBytes.slice(dataStart, dataStart + compressedSize);
    if (!name.endsWith('/')) {
      if (method === 0) entries.push({ name, data: compressed });
      else if (method === 8) entries.push({ name, data: inflateRawSync(compressed) });
      else throw new Error(`Unsupported ZIP compression method for ${name}.`);
    }
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

// ip_skill_packs_slug_key is a table-wide UNIQUE(slug) constraint (not scoped per user), so
// uniqueness must be checked globally here too, or the insert can still hit a 23505 conflict
// against another user's (or a global-scope) skill with the same slug.
const uniqueSlug = async (supabase: SupabaseClient, name: string, userId: string) => {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (true) {
    const { data, error } = await supabase.from('skill_packs').select('id').eq('slug', slug).limit(1);
    if (error) throw error;
    if (!data?.length) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
};

const categorizePath = (path: string) => {
  const clean = path.replace(/^\/+|\/+$/g, '');
  if (clean.split('/').includes('..')) throw new Error('ZIP paths may not include parent-directory segments.');
  const [category, ...rest] = clean.split('/');
  const filename = rest.join('/');
  if (!SKILL_FILE_CATEGORIES.has(category) || !filename) return null;
  return { category, filename };
};

const mimeType = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.py')) return 'text/x-python';
  if (lower.endsWith('.js')) return 'text/javascript';
  if (lower.endsWith('.ts')) return 'text/typescript';
  return 'application/octet-stream';
};

class PhaseError extends Error {
  phase: string;
  cause?: unknown;
  constructor(phase: string, message: string, cause?: unknown) {
    super(message);
    this.phase = phase;
    this.cause = cause;
  }
}

// PostgrestError / StorageError objects from supabase-js are plain objects, not `instanceof
// Error`, so a naive `error instanceof Error ? error.message : fallback` silently discards the
// real database/storage error text. Check for a string `.message` property generically instead.
const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, unknown>).message as string;
  }
  return fallback;
};

const safeErrorFields = (error: unknown): Record<string, unknown> => {
  const extra: Record<string, unknown> = {};
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.code === 'string') extra.code = err.code;
    if (typeof err.hint === 'string') extra.hint = err.hint;
    if (typeof err.details === 'string') extra.details = err.details;
    if (typeof err.status === 'number') extra.status = err.status;
    if (typeof err.name === 'string') extra.errorName = err.name;
  }
  return extra;
};

const importZip = async (supabase: SupabaseClient, userId: string, zipBytes: Buffer) => {
  let entries: ZipEntry[];
  try {
    entries = readZipEntries(zipBytes);
  } catch (error) {
    throw new PhaseError('decode_zip', errorMessage(error, 'Could not read the ZIP archive.'), error);
  }

  const skillEntry = entries.find((entry) => entry.name === 'SKILL.md');
  if (!skillEntry) {
    throw new PhaseError(
      'find_skill_md',
      `ZIP must include SKILL.md at the root. Found entries: ${entries.map((e) => e.name).join(', ') || '(none)'}`,
    );
  }

  let parsed: ReturnType<typeof parseSkillMd>;
  try {
    parsed = parseSkillMd(skillEntry.data.toString('utf8'));
  } catch (error) {
    throw new PhaseError('parse_skill_md', errorMessage(error, 'Could not parse SKILL.md.'), error);
  }

  let slug: string;
  try {
    slug = await uniqueSlug(supabase, parsed.name, userId);
  } catch (error) {
    throw new PhaseError('unique_slug', errorMessage(error, 'Could not check for slug uniqueness.'), error);
  }

  const { normalized: _normalized, ...insertableParsed } = parsed;

  const created: Record<string, any> = await (async () => {
    try {
      const { data: createdRows, error: createError } = await supabase
        .from('skill_packs')
        .insert({ user_id: userId, scope: 'private', slug, status: 'active', ...insertableParsed })
        .select('*');
      if (createError) throw createError;
      const row = createdRows?.[0];
      if (!row?.id) throw new Error('Insert returned no row.');
      return row as Record<string, any>;
    } catch (error) {
      throw new PhaseError('create_skill', errorMessage(error, 'Could not create the skill_packs row.'), error);
    }
  })();

  const uploadedPaths: string[] = [];
  try {
    const metadataRows = [];
    for (const entry of entries) {
      if (entry.name === 'SKILL.md') continue;
      const categorized = categorizePath(entry.name);
      if (!categorized) continue;
      const storagePath = `${userId}/${created.id}/${categorized.category}/${categorized.filename}`;
      const contentType = mimeType(categorized.filename);
      try {
        const { error: uploadError } = await supabase.storage
          .from(SKILL_FILE_BUCKET)
          .upload(storagePath, entry.data, { contentType, upsert: false });
        if (uploadError) throw uploadError;
      } catch (error) {
        throw new PhaseError(
          `upload_file:${categorized.filename}`,
          errorMessage(error, `Could not upload ${categorized.filename} to storage.`),
          error,
        );
      }
      uploadedPaths.push(storagePath);
      metadataRows.push({
        skill_id: created.id,
        filename: categorized.filename,
        category: categorized.category,
        mime_type: contentType,
        size: entry.data.length,
        storage_path: storagePath,
      });
    }
    if (metadataRows.length) {
      const { error } = await supabase.from('skill_files').insert(metadataRows);
      if (error) throw new PhaseError('insert_skill_files', error.message, error);
    }
    return { ...created, files: metadataRows };
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(SKILL_FILE_BUCKET).remove(uploadedPaths).catch(() => undefined);
    try {
      await supabase.from('skill_packs').delete().eq('id', created.id).eq('user_id', userId);
    } catch {
      // The original import error is more useful than a best-effort cleanup error.
    }
    throw error;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed.' });
    return;
  }

  let phase = 'auth';
  try {
    const jwt = getJwt(req);

    phase = 'validate_session';
    const authSupabase = userClient(jwt);
    const { data: userData, error: userError } = await authSupabase.auth.getUser(jwt);
    if (userError || !userData.user) throw userError ?? new Error('Invalid session.');

    phase = 'parse_body';
    const body = parseBody(req.body);
    const filename = String(body.filename ?? '');
    const contentBase64 = String(body.contentBase64 ?? '');
    if (!filename.toLowerCase().endsWith('.zip')) throw new Error('Upload a .zip file.');
    if (!contentBase64) throw new Error('filename and contentBase64 are required.');

    phase = 'decode_zip';
    const zipBytes = Buffer.from(contentBase64, 'base64');
    if (!zipBytes.length) throw new Error('Decoded ZIP is empty.');

    phase = 'service_client_init';
    const service = serviceClient();

    phase = 'import_zip';
    const imported = await importZip(service, userData.user.id, zipBytes);
    res.status(201).json(imported);
  } catch (error) {
    const reportedPhase = error instanceof PhaseError ? error.phase : phase;
    const message = errorMessage(error, 'Could not import skill.');
    const extra = safeErrorFields(error instanceof PhaseError ? error.cause : error);
    // parseApiError on the frontend only reads `.detail`, so fold the safe Postgres/Storage
    // fields directly into the visible message instead of leaving them as sibling JSON keys
    // that silently get dropped.
    const extraBits = Object.entries(extra)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');
    res.status(400).json({
      detail: `Could not import skill at phase ${reportedPhase}: ${message}${extraBits ? ` (${extraBits})` : ''}`,
      phase: reportedPhase,
      ...extra,
    });
  }
}
