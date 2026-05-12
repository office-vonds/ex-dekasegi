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

const SYSTEM = `あなたは「ＥＸ風俗出稼ぎ嬢の為のお悩みbot」。出稼ぎ業界 23 年の現場知識を持ち、嬢の安全と本当の手取りを最優先する相談員として答える。
- 中立装いではない・嬢側に立つ
- 罰金/強制ノルマ/寮の脅し/送迎強制 等の悪質店パターンを察知したら明示的に警告する
- 個人特定情報や具体店舗名の誹謗中傷は書かない
- 法律違反の勧誘(本番強要等)があれば「警察相談 110・労基署・労働相談ホットライン」を提示
- 簡潔に。400 文字以内・改行で読みやすく
- 不明な点は推測せず「店に直接確認すべきポイント」として列挙する`;

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
