import { createClient } from '@supabase/supabase-js';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const jwt = getJwt(req);
    const supabase = userClient(jwt);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) throw userError ?? new Error('Invalid session.');

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    const threadId = String(body.threadId ?? '');
    if (!threadId) throw new Error('threadId is required.');

    const update = await supabase
      .from('vcso_chat_threads')
      .update({ synthesis_status: 'pending' })
      .eq('id', threadId)
      .eq('user_id', userData.user.id)
      .select('id,user_id,synthesis_status')
      .single();
    if (update.error) throw update.error;

    const webhookUrl = process.env.WF_PS_03_WEBHOOK_URL;
    let webhookPosted = false;
    if (webhookUrl) {
      const webhook = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.ARCHITECTOS_WEBHOOK_SECRET
            ? { 'x-architectos-secret': process.env.ARCHITECTOS_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify({ thread_id: threadId, user_id: userData.user.id }),
      });
      webhookPosted = webhook.ok;
      if (!webhook.ok) {
        res.status(502).json({ thread: update.data, webhookPosted, error: await webhook.text().catch(() => '') });
        return;
      }
    }

    res.status(200).json({ thread: update.data, webhookPosted });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown WS5 writeback error.' });
  }
}
