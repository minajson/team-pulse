/**
 * Small in-process sliding-window limiter.
 *
 * Sized for the actual threat here: a room full of phones on one NAT, plus the
 * occasional bored participant hammering the heart button. Not a substitute
 * for an edge WAF, and it does not need to be — a session is a closed,
 * time-boxed event behind a 4-digit code.
 */

interface Window {
  hits: number[];
}

declare global {
  var __teamPulseRateLimit: Map<string, Window> | undefined;
}

const buckets = (globalThis.__teamPulseRateLimit ??= new Map<string, Window>());

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.hits.length === 0 || now - win.hits[win.hits.length - 1] > 300_000) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const win = buckets.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  win.hits = win.hits.filter((t) => t > cutoff);

  if (win.hits.length >= limit) {
    buckets.set(key, win);
    const retryAfterMs = Math.max(0, win.hits[0] + windowMs - now);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  win.hits.push(now);
  buckets.set(key, win);
  return { ok: true, remaining: limit - win.hits.length, retryAfterMs: 0 };
}

/** Best-effort client identity for limiting. Never stored, never shown. */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
