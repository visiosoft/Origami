/**
 * Texts through Quo (formerly OpenPhone), from the office's own line, so replies
 * land in Quo where the team already works (Oct 27 sync: "outgoing text messages
 * sent via an API through the main Quo number"). Quo kept OpenPhone's REST API:
 * POST {base}/messages with the API key as the Authorization header.
 */
export const QUO_DEFAULT_BASE = 'https://api.openphone.com/v1';
export const QUO_DEFAULT_FROM = '+16507614661';

export interface QuoConfig { apiKey: string; from: string; base?: string }

/** The request Quo expects -- pure, so its shape is tested without a network. */
export function quoRequest(cfg: QuoConfig, to: string, content: string) {
  const base = (cfg.base || QUO_DEFAULT_BASE).replace(/\/+$/, '');
  return {
    url: `${base}/messages`,
    init: {
      method: 'POST',
      headers: { Authorization: cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, from: cfg.from, to: [to] }),
    },
  };
}

/** Quo's reason for a refusal, in its own words where it gives one. */
export function quoError(status: number, payload: any): string {
  const msg = payload?.message || payload?.error?.message || (Array.isArray(payload?.errors) ? payload.errors.map((e: any) => e?.message).filter(Boolean).join('; ') : '');
  if (status === 401 || status === 403) return `Quo refused the API key${msg ? ` — ${msg}` : ''}. Check it in Settings → SMS.`;
  return msg || `Quo could not send the text (${status}).`;
}

export async function sendViaQuo(cfg: QuoConfig, to: string, content: string, doFetch: typeof fetch = fetch): Promise<{ id?: string }> {
  const { url, init } = quoRequest(cfg, to, content);
  const res = await doFetch(url, init);
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(quoError(res.status, payload));
  return { id: payload?.data?.id || payload?.id };
}
