/**
 * DEPRECATED — legacy single-shot Virtual CSO route.
 *
 * The live interactive-chat lane is served by the Python backend at
 * https://api.architectospro.com/api/vcso/chat through VcsoChatService.
 * This Vercel route is intentionally disabled so the divergent ws5-chat
 * implementation cannot be revived. Do not extend it.
 */

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store');
  res.status(410).json({
    error: 'deprecated_route',
    message: 'Virtual CSO chat is served by the Python /api/vcso/chat endpoint.',
  });
}
