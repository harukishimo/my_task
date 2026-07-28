# 実装判断: スターター構成の扱い

## 判断

既存のNext.js 16.2系、React 19、TypeScript、Tailwindの構成を維持し、依存をNext.js 16.2.12へ揃えてアプリ実行スクリプトを標準Next.jsへ寄せる。`.openai/hosting.json`、`vite.config.ts`、`worker/`、`db/`は既存のサイト環境との互換性を保つため残すが、タスク機能からは参照しない。

## 理由

- 画面・APIはVercelのNode.js Runtimeで動かす必要がある。
- `.openai/hosting.json`を利用する既存プレビュー環境を壊さない。
- 実装コードは標準Next.jsのRoute Handler、`cookies()`、Google公式クライアントを使用する。
- 不要なスターターUIと`react-loading-skeleton`は削除した。

## 影響

- Vercelでは`npm run build`（`next build`）を使用する。
- Sites互換の確認が必要な場合は、既存スターター側のVite設定を別途確認する（本アプリのデプロイコマンドは`npm run build`）。
- Cloudflare D1はタスクデータの正本にしない。
