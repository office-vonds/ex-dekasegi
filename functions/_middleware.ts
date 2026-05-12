interface Env {
  DB: D1Database;
  AI: Ai;
}

const ALLOW_ORIGIN = "*";

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

  const res = await ctx.next();
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(res.body, { status: res.status, headers });
};
