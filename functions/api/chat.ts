import { buildSystemPrompt } from "../_knowledge";

interface Env {
  DB: D1Database;
  AI: Ai;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM = buildSystemPrompt();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { message?: string; session_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const message = (body.message ?? "").trim();
  if (!message) return json({ error: "message required" }, 400);
  if (message.length > 500) return json({ error: "message too long (max 500)" }, 400);

  const sessionRaw = (body.session_id ?? request.headers.get("cf-connecting-ip") ?? "anon") + "|" + new Date().toISOString().slice(0, 10);
  const sessionHash = await sha256(sessionRaw);

  let reply = "申し訳ございません、現在応答を生成できません。少し時間を置いて再度お試しください。";

  try {
    const ai = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message },
      ],
      max_tokens: 400,
    })) as { response?: string };

    if (ai?.response) reply = ai.response.trim();
  } catch (e) {
    reply = `応答生成エラー: ${(e as Error).message}`;
  }

  await env.DB.prepare(
    "INSERT INTO chat_logs (session_hash, user_message, bot_response) VALUES (?, ?, ?)"
  )
    .bind(sessionHash, message, reply)
    .run();

  return json({ reply, session_hash: sessionHash });
};
