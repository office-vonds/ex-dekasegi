# セッションログ: 2026-05-12 23:00 ex-dekasegi CF Pages + D1 + Workers AI Phase 2 完遂

- ブランチ: main
- 担当: ポチ (Claude Code 専任)
- NOYUTO 動員: 0 件 (Rule#15 遵守・3トリガー外)

## 完遂したこと

### Phase 0: 認証準備
- Cloudflare API Token を `~/credentials/cloudflare.conf` に格納 (chmod 600)
- Account ID `904cce4b0cff6896579b3f489556b800` 取得
- `wrangler whoami` で疎通確認済

### Phase 1: wrangler セットアップ
- `npm install -g wrangler@latest` (v4.90.1)
- PATH に `~/.npm-global/bin` 追加 (`~/.bashrc` 永続化済)

### Phase 2: D1 構築
- DB 作成: `ex-dekasegi-db` (id: `be84a930-184b-4eab-b3a1-6db57a2841e4`, APAC region)
- スキーマ適用: tweets / chat_logs / moderation の 3 テーブル + 2 index
- ID は `~/credentials/cloudflare.conf` の `D1_DATABASE_ID=` に追記

### Phase 3: Workers Functions 実装
- `wrangler.toml` 作成 (DB binding "DB" + AI binding "AI")
- `functions/_middleware.ts` (CORS)
- `functions/api/chat.ts` (Workers AI bot 応答 + chat_logs 保存・session_hash は SHA-256 匿名化)
- `functions/api/tweets.ts` (GET approved 一覧 / POST → Workers AI 即時 moderation → status 更新)
- `functions/api/moderate.ts` (単発再審査用)
- **Workers AI モデル**: `@cf/meta/llama-3.1-8b-instruct` 採択 (Anthropic API 課金禁止・Claude Max 20x 外従量課金回避)

### Phase 4: フロントエンド配線 + デプロイ
- `site/index.html` → `public/index.html` コピー
- chat の scripted `botReply` を `/api/chat` fetch に置換 (オフライン fallback 保持)
- tweets の localStorage を `/api/tweets` GET/POST に置換
- session_id は LocalStorage 永続化 (`ex-dekasegi-sid`)
- `wrangler pages project create ex-dekasegi --production-branch=main`
- `wrangler pages deploy public --project-name=ex-dekasegi`
- 本番 URL: https://ex-dekasegi.pages.dev/

## 動作確認 (本番疎通)

| エンドポイント | 結果 |
|---|---|
| `GET /` | HTTP 200・LP 配信 |
| `GET /api/tweets` | `{"tweets":[]}` (初期は空) |
| `POST /api/chat` | Workers AI が日本語で 400 文字以内の現場知識応答 |
| `POST /api/tweets` (正常投稿) | id:1・verdict: approved・status: approved・"店舗名や条件の批判は許可" |
| `POST /api/tweets` (個人攻撃 + 殺害予告) | id:2・verdict: rejected・status: rejected・"個人攻撃と暴力的脅迫" |
| `GET /api/tweets` (再確認) | id:1 のみ返却 (rejected:2 は除外) |

## 重要な実装判断

1. **Astro 化スキップ**: 既存 index.html が静的+少量 vanilla JS のみのため、Astro 変換は手数増のみで実利なし。`public/index.html` 直配信。
2. **Workers AI 即時 moderation**: `/api/tweets` POST 時に同期で moderate 走らせる設計 (Phase 1 設計通り)。verdict=flagged は status='pending' で運営手動確認待ち。
3. **匿名 session_hash**: chat_logs は SHA-256 (IP + 日付) で日次ローテーション匿名化。LINE/電話/メール非収集の方針堅持。
4. **CORS 全開放**: 同一オリジン運用前提だが将来 PWA/サブドメイン対応のため `*` で開放。

## NOYUTO 用 進捗報告 (公開 URL)

- **本番 URL**: https://ex-dekasegi.pages.dev/
- **次の NOYUTO 動員**: DNS 切替のみ (お名前.com → CF Pages・2 分作業)
  - お名前.com で `ex-dekasegi.jp` の DNS を Cloudflare nameserver に切替 OR CF Pages 側でカスタムドメイン追加
  - これは Phase 5 (任意・現状の `.pages.dev` で動作確認は完結)

## 次にやること (Phase 5 以降)

- [ ] DNS 切替 (`ex-dekasegi.jp` → ex-dekasegi.pages.dev・NOYUTO 動員 2 分)
- [ ] 既存 WP 4.9.29 サイトの法令違反ページ (加盟店募集 / ネットスカウト) 撤去
- [ ] UA-75643143-1 → GA4 移行 + Search Console 再接続
- [ ] FTP 全体バックアップ (`_backup/2026-05-12/`)
- [ ] 写メ日記 AI MVP 仕様書 (`products/shamediary-ai/spec-v0.1.md`)

## 関連
- `wrangler.toml`
- `functions/api/*.ts`
- `public/index.html` (839 行 → API 配線で 12 行差し替え)
- `~/credentials/cloudflare.conf` (D1_DATABASE_ID 追記)
