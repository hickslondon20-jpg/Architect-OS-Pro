import { createClient } from '@supabase/supabase-js';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
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

const parseBody = (body: unknown) => {
  if (typeof body === 'string') return JSON.parse(body) as Record<string, unknown>;
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
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
    res.status(405).json({ detail: 'Method not allowed.' });
    return;
  }

  try {
    const jwt = getJwt(req);
    const supabase = userClient(jwt);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) throw userError ?? new Error('Invalid session.');

    const body = parseBody(req.body);
    const filename = String(body.filename ?? '');
    const contentBase64 = String(body.contentBase64 ?? '');
    if (!filename || !contentBase64) throw new Error('filename and contentBase64 are required.');

    const backendUrl = normalizeUrl(env('ARCHITECTOS_PYTHON_BACKEND_URL'));
    const response = await fetch(`${backendUrl}/api/skills/import-json`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ filename, contentBase64 }),
    });

    res.status(response.status).json(await upstreamBody(response));
  } catch (error) {
    res.status(400).json({ detail: error instanceof Error ? error.message : 'Could not import skill.' });
  }
}
