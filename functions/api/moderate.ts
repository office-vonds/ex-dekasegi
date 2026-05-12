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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { tweet_id?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const id = Number(body.tweet_id);
  if (!Number.isFinite(id) || id <= 0) return json({ error: "tweet_id required" }, 400);

  const tweet = await env.DB.prepare("SELECT id, content FROM tweets WHERE id = ?")
    .bind(id)
    .first<{ id: number; content: string }>();

  if (!tweet) return json({ error: "tweet not found" }, 404);

  const prompt = `次の投稿を「approved / rejected / flagged」のいずれかで判定し JSON のみ返してください。\n投稿: """${tweet.content}"""\n出力 (JSON only): {"verdict": "approved|rejected|flagged", "reason": "..."}`;

  let verdict: "approved" | "rejected" | "flagged" = "flagged";
  let reason = "ai_no_response";

  try {
    const ai = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "日本語コンテンツ審査者。JSON のみ出力。" },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
    })) as { response?: string };

    const raw = ai?.response ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (["approved", "rejected", "flagged"].includes(parsed.verdict)) {
        verdict = parsed.verdict;
        reason = String(parsed.reason ?? "").slice(0, 200);
      }
    }
  } catch (e) {
    reason = `ai_error: ${(e as Error).message}`;
  }

  await env.DB.prepare(
    "INSERT INTO moderation (target_type, target_id, verdict, reason) VALUES ('tweet', ?, ?, ?)"
  )
    .bind(id, verdict, reason)
    .run();

  const finalStatus = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : "pending";
  await env.DB.prepare("UPDATE tweets SET status = ? WHERE id = ?").bind(finalStatus, id).run();

  return json({ id, verdict, reason, status: finalStatus });
};
