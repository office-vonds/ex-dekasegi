interface Env {
  DB: D1Database;
  AI: Ai;
}

const ALLOW_ORIGIN = "*";

// rate limit windows (秒)
const RL_WINDOW_SEC = 60;
const RL_MAX_POST = 10;      // POST /api/* は 60 秒で 10 件まで
const RL_MAX_CHAT = 30;      // POST /api/chat は緩めに 60 秒 30 件
const RL_BLOCK_SEC = 600;    // 違反時は 10 分ブロック

async function checkRateLimit(env: Env, ip: string, route: string, max: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const key = `${route}:${ip}`;

  const row = await env.DB.prepare(
    "SELECT count, window_start, blocked_until FROM rate_limit WHERE key = ?"
  )
    .bind(key)
    .first<{ count: number; window_start: number; blocked_until: number }>();

  if (row && row.blocked_until && row.blocked_until > now) {
    return { ok: false, retryAfter: row.blocked_until - now };
  }

  if (!row || now - row.window_start >= RL_WINDOW_SEC) {
    await env.DB.prepare(
      "INSERT INTO rate_limit (key, count, window_start, blocked_until) VALUES (?, 1, ?, 0) " +
        "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?, blocked_until = 0"
    )
      .bind(key, now, now)
      .run();
    return { ok: true, retryAfter: 0 };
  }

  const next = row.count + 1;
  if (next > max) {
    const until = now + RL_BLOCK_SEC;
    await env.DB.prepare("UPDATE rate_limit SET count = ?, blocked_until = ? WHERE key = ?")
      .bind(next, until, key)
      .run();
    return { ok: false, retryAfter: RL_BLOCK_SEC };
  }

  await env.DB.prepare("UPDATE rate_limit SET count = ? WHERE key = ?").bind(next, key).run();
  return { ok: true, retryAfter: 0 };
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOW_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(ctx.request.url);
  const isApi = url.pathname.startsWith("/api/");

  if (isApi && ctx.request.method === "POST") {
    const ip = ctx.request.headers.get("cf-connecting-ip") || "unknown";
    const isChat = url.pathname === "/api/chat";
    const max = isChat ? RL_MAX_CHAT : RL_MAX_POST;
    const route = isChat ? "chat" : "post";

    try {
      const { ok, retryAfter } = await checkRateLimit(ctx.env, ip, route, max);
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "rate limited", retry_after_sec: retryAfter }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
              "Access-Control-Allow-Origin": ALLOW_ORIGIN,
            },
          }
        );
      }
    } catch {
      // rate_limit テーブル不在等は通過させる (フェールオープン)
    }
  }

  const res = await ctx.next();
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
  if (!isApi) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com; frame-ancestors 'none';"
    );
  }
  return new Response(res.body, { status: res.status, headers });
};
