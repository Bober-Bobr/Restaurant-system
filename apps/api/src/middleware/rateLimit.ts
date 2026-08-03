import type { NextFunction, Request, Response } from 'express';

// ── Fixed-window per-IP rate limit ──────────────────────────────────────────
// The public order endpoints are unauthenticated by necessity — a restaurant's
// guest has no account — which makes them the first write endpoints on this
// platform that a stranger can hammer to create rows. The existing public
// endpoints (reviews, invitation requests, performer bookings) have no limit at
// all and are flagged as an open pre-launch item; anonymous order creation makes
// that materially more pressing, so this ships with the feature.
//
// In-memory on purpose: the API runs as a single pm2 process, so a shared store
// would be infrastructure for no gain today. If the API is ever scaled to more
// than one process this becomes per-process and needs Redis — noted here rather
// than discovered later.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Cheap sweep so an unbounded stream of distinct IPs cannot grow the map for
// ever. Runs on write, not on a timer, so an idle process stays idle.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per window, per key. */
  max: number;
  /** Distinguishes limiters so one endpoint's budget is not another's. */
  name: string;
  /** Defaults to the client IP. */
  keyOf?: (request: Request) => string;
};

export function rateLimit({ windowMs, max, name, keyOf }: RateLimitOptions) {
  return (request: Request, response: Response, next: NextFunction): void => {
    // `trust proxy` is not set on this app, so request.ip is the socket address —
    // behind nginx that is the proxy itself. X-Forwarded-For is therefore what
    // actually identifies the caller here. It is spoofable, so this is a civility
    // measure against accidents and casual abuse, not a security control.
    const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
    const key = `${name}:${keyOf ? keyOf(request) : forwarded || request.ip || 'unknown'}`;

    const now = Date.now();
    sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      response.setHeader('Retry-After', String(retryAfter));
      response.status(429).json({ message: 'Too many requests. Please wait a moment and try again.' });
      return;
    }

    bucket.count += 1;
    next();
  };
}

/** Test seam — lets a probe start from a clean slate. */
export function __resetRateLimits() {
  buckets.clear();
  lastSweep = Date.now();
}
