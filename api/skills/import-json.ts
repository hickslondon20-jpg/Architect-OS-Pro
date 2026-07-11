import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inflateRawSync } from 'node:zlib';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };
type ZipEntry = { name: string; data: Buffer };
type SkillValues = Record<string, string | string[]>;

const SKILL_FILE_BUCKET = 'skill-files';
const SKILL_FILE_CATEGORIES = new Set(['scripts', 'references', 'assets']);

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
  const normalized = content.replace(/^\ufeff/, '').replace(/\r\n/g, '\n');
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
  return {
    name,
    description,
    domain: optionalString(values.domain),
    skill_kind: optionalString(values.skill_kind),
    trigger_tags: stringList(values.trigger_tags),
    required_platform_context: stringList(values.required_platform_context),
    body,
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

const uniqueSlug = async (supabase: SupabaseClient, name: string, userId: string) => {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (true) {
    const { data, error } = await supabase.from('skill_packs').select('id').eq('slug', slug).eq('user_id', userId).limit(1);
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

const importZip = async (supabase: SupabaseClient, userId: string, zipBytes: Buffer) => {
  const entries = readZipEntries(zipBytes);
  const skillEntry = entries.find((entry) => entry.name === 'SKILL.md');
  if (!skillEntry) throw new Error('ZIP must include SKILL.md at the root.');

  const parsed = parseSkillMd(skillEntry.data.toString('utf8'));
  const slug = await uniqueSlug(supabase, parsed.name, userId);
  const { data: createdRows, error: createError } = await supabase
    .from('skill_packs')
    .insert({ user_id: userId, scope: 'private', slug, status: 'active', ...parsed })
    .select('*');
  if (createError) throw createError;
  const created = createdRows?.[0];
  if (!created?.id) throw new Error('Could not create skill.');

  const uploadedPaths: string[] = [];
  try {
    const metadataRows = [];
    for (const entry of entries) {
      if (entry.name === 'SKILL.md') continue;
      const categorized = categorizePath(entry.name);
      if (!categorized) continue;
      const storagePath = `${userId}/${created.id}/${categorized.category}/${categorized.filename}`;
      const contentType = mimeType(categorized.filename);
      const { error: uploadError } = await supabase.storage
        .from(SKILL_FILE_BUCKET)
        .upload(storagePath, entry.data, { contentType, upsert: false });
      if (uploadError) throw uploadError;
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
      if (error) throw error;
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

  try {
    const jwt = getJwt(req);
    const authSupabase = userClient(jwt);
    const { data: userData, error: userError } = await authSupabase.auth.getUser(jwt);
    if (userError || !userData.user) throw userError ?? new Error('Invalid session.');

    const body = parseBody(req.body);
    const filename = String(body.filename ?? '');
    const contentBase64 = String(body.contentBase64 ?? '');
    if (!filename.toLowerCase().endsWith('.zip')) throw new Error('Upload a .zip file.');
    if (!contentBase64) throw new Error('filename and contentBase64 are required.');

    const imported = await importZip(serviceClient(), userData.user.id, Buffer.from(contentBase64, 'base64'));
    res.status(201).json(imported);
  } catch (error) {
    res.status(400).json({ detail: error instanceof Error ? error.message : 'Could not import skill.' });
  }
}
