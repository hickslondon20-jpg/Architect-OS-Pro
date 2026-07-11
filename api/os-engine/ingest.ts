import { createClient } from '@supabase/supabase-js';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type IngestPayload = {
  document_id?: unknown;
  user_id?: unknown;
  storage_path?: unknown;
  file_name?: unknown;
  file_type?: unknown;
};

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

const parseBody = (body: unknown): IngestPayload => {
  if (typeof body === 'string') return JSON.parse(body) as IngestPayload;
  if (body && typeof body === 'object') return body as IngestPayload;
  return {};
};

const requireString = (payload: IngestPayload, key: keyof IngestPayload) => {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
};

const upstreamBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({ ok: response.ok }));
  }
  const detail = await response.text().catch(() => '');
  return detail ? { detail } : { ok: response.ok };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ detail: 'Method not allowed.' });
    return;
  }

  try {
    const jwt = getJwt(req);
    const supabase = userClient(jwt);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) throw userError ?? new Error('Invalid session.');

    const payload = parseBody(req.body);
    const documentId = requireString(payload, 'document_id');
    const userId = requireString(payload, 'user_id');
    const storagePath = requireString(payload, 'storage_path');
    const fileName = requireString(payload, 'file_name');
    const fileType = requireString(payload, 'file_type');

    if (userId !== userData.user.id) {
      res.status(403).json({ detail: 'Document user mismatch.' });
      return;
    }

    if (!storagePath.startsWith(`${userData.user.id}/`)) {
      res.status(400).json({ detail: 'Storage path must belong to the authenticated user.' });
      return;
    }

    const backendUrl = normalizeUrl(env('ARCHITECTOS_PYTHON_BACKEND_URL'));
    const response = await fetch(`${backendUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.ARCHITECTOS_INGEST_SECRET ? { 'x-ingest-secret': process.env.ARCHITECTOS_INGEST_SECRET } : {}),
      },
      body: JSON.stringify({
        document_id: documentId,
        user_id: userId,
        storage_path: storagePath,
        file_name: fileName,
        file_type: fileType,
      }),
    });

    res.status(response.status).json(await upstreamBody(response));
  } catch (error) {
    res.status(400).json({ detail: error instanceof Error ? error.message : 'Could not queue ingestion.' });
  }
}
