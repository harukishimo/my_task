# 脅威モデル

## 保護対象

- タスク名、期日、優先度、完了状態
- Google Sheetsの内容
- Googleサービスアカウント鍵
- パスフレーズハッシュとセッション署名鍵

## 信頼境界

ブラウザは信頼しない。ブラウザとNext.jsの間は認証Cookieで保護し、Next.jsサーバーだけがGoogle Sheets APIを呼び出す。PreviewとProductionは別Sheetと環境変数を使う。

## 主要な脅威と対策

| 脅威 | 対策 | 検証 |
|---|---|---|
| 認証回避 | 全ページとRoute Handlerで署名Cookieを検証 | SEC-R |
| Cookie盗用・CSRF | HttpOnly、Secure、SameSite、Origin検査 | SEC-R |
| 入力改ざん | Zod strict schema、priority再計算 | AG-07 / SEC-R |
| 秘密情報露出 | server-only、環境変数、ログマスキング | SEC-R |
| Previewから本番Sheet変更 | 環境別Sheet ID | SEC-P |
| 同時更新 | versionによる409 | AG-07 |
| API障害 | エラー分類、no-store、再試行制御 | AG-07 |
