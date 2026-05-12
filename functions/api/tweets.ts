interface Env {
  DB: D1Database;
  AI: Ai;
}

const MAX_LEN = 280;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, content, author, region, created_at FROM tweets WHERE status='approved' ORDER BY created_at DESC LIMIT 50"
  ).all();
  return json({ tweets: results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { content?: string; author?: string; region?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const content = (body.content ?? "").trim();
  const author = (body.author ?? "匿名").trim().slice(0, 40) || "匿名";
  const region = (body.region ?? "").trim().slice(0, 40) || null;

  if (!content) return json({ error: "content required" }, 400);
  if (content.length > MAX_LEN) return json({ error: `content too long (max ${MAX_LEN})` }, 400);

  const insert = await env.DB.prepare(
    "INSERT INTO tweets (content, author, region, status) VALUES (?, ?, ?, 'pending') RETURNING id"
  )
    .bind(content, author, region)
    .first<{ id: number }>();

  const tweetId = insert?.id;
  if (!tweetId) return json({ error: "insert failed" }, 500);

  let verdict: "approved" | "rejected" | "flagged" = "flagged";
  let reason = "moderation skipped";

  try {
    const prompt = `次の投稿を「approved / rejected / flagged」のいずれかで判定し、JSON のみ返してください。判定基準: 個人攻撃・本名晒し・暴力的脅迫・違法行為勧誘・露骨な性的描写は rejected。店舗名や条件の批判は approved。判断困難は flagged。\n\n投稿: """${content}"""\n\n出力 (JSON only): {"verdict": "approved|rejected|flagged", "reason": "理由を簡潔に"}`;

    const ai = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "あなたは日本語のコンテンツ審査者です。JSON のみ出力します。" },
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
    .bind(tweetId, verdict, reason)
    .run();

  const finalStatus = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : "pending";
  await env.DB.prepare("UPDATE tweets SET status = ? WHERE id = ?").bind(finalStatus, tweetId).run();

  return json({ id: tweetId, status: finalStatus, verdict, reason });
};
