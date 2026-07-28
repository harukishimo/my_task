# 品質ゲート結果

## 自動チェック

| Check | 結果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS（3ファイル、14テスト） |
| `npm run test:integration` | PASS（2テスト） |
| `npm run build` | PASS（Next.js 16.2.12、Webpack） |
| `npm run test:e2e` | PASS（Desktop Chrome／Pixel 5、4テスト：未認証リダイレクト＋ログイン後の追加・期限画面・完了・復元表示・ログアウト） |
| `npm audit --omit=dev` | PASS（0 vulnerabilities） |

## APIスモーク

一時的な開発用ハッシュと`TASK_STORE_MODE=memory`で、ログイン、一覧取得、追加、更新、409競合、論理削除を確認した。実値はファイルへ保存していない。

モバイルE2Eでは、viewportメタ情報と長いタスク名の最小幅による固定ナビのクリック阻害を再現・修正し、Pixel 5でも同じフローがPASSすることを確認した。

## 残りの確認

- Google Sheetsの実接続は所有者がDEVシートとサービスアカウントを設定した後にPreviewで確認する。
- Productionデプロイと本番スモークテストは未実行。
