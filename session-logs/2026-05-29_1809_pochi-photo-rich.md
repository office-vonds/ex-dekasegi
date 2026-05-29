# セッションログ: 2026-05-29 ex-dekasegi.jp 写真リッチ化 (NOYUTO第2指摘の是正)

- 担当: 🐶ポチ / コミット: e1292ac
- 起点: NOYUTO「圧倒的に写真が少ない/これの何が世界最高品質/これ以上できないか/これで売れるのか/売れているサイトのデザイン・UIは確認したのか」

## 真因 (NOYUTO哲学①現物確認を飛ばした)
- 本気版でも実画像はhero1枚のみ。SVGグラフ+番号+絵文字で誤魔化し [[feedback_real_image_graphics_not_svg_schematics]] 違反。
- 売れているサイトを一切見ずfrontend-design抽象論だけで作った。「見てない奴に語る資格なし」そのもの。
- public/assets/に高品質実画像26枚が既存。記事ページで使用済なのにトップは1枚しか活用してなかった(資産の死蔵)。

## 売れるサイト現物確認 (WebSearch: 2026 high-converting LP)
- hero画像 最高効果4類型: ①使用後の生活 ②サービス利用中 ③運営者の顔 ④社会的証明
- 効かない: 笑顔握手ストック / 無関係抽象背景 / "美しいが何も伝えない暗い雰囲気写真"(現hero要注意)
- nav削除でCVR+10-15% / フォーム短縮+120% / 見出し最適化+27-104% / 動画+86%
- 出典: superside.com / shopify.com / leadfeeder

## 実施
- guides記事一覧: テキストリンク羅列 → 16枚の実写真サムネカードグリッド(3カテゴリ)
  - 記事⇔画像マッピング全16本確定(hero-guide/sec-mochimono/sec-guide/hero-toshi/sec-okinawa/sec-anzen/sec-hoshou/sec-akushitsuten/sec-jitsuroku/hero-mental-renkin/hero-jitsuroku/hero-kakutei/hero-shameni-kakikata/torikata/reibun/hub)
  - .guide-card CSS: 画像16/10+カテゴリchip+タイトル・hover lift・lazy load・ペーパー地
- 記事リンク22維持・schema不変・全画像実在確認・desktop/mobile崩れなし
- 本番検証: Actions success・guide-card 16・サムネ画像200

## 現在の状態: 完了(本番反映済)・ただし未完の余地あり(下記)

## まだ出来ること (NOYUTO「これ以上できないか」への正直な残)
- problem/solution/how/about セクション本体にはまだ大判実画像なし(番号カード/tweet/step/テキストのまま) → 各セクションに大判実画像 or 左右交互レイアウトで更に写真リッチ化可能
- hero: 現状「暗い情緒写真」型。売れるLP原則では「使用後の生活/社会的証明」型が高CVR → A/Bテスト候補
- 記事ページ全13本へ同トークン横展開

## 教訓 (memory化候補・KIRYU/国王へ委ねる)
- 「世界最高品質」を名乗る制作で、売れているサイト・競合・世界トップの現物確認を飛ばす = NOYUTO判断順序①違反。frontend-design等の抽象論だけで作るな。着手前に売れLPを現物確認しデザイン/UIパターンを掴め。
- 既存資産(画像/コンポーネント)の棚卸しを着手前にやれ。26枚あるのに1枚しか使わない死蔵が起きた。
