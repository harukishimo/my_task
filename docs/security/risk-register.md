# セキュリティリスク台帳

| ID | 重要度 | 状態 | 対象 | 備考 |
|---|---|---|---|---|
| SEC-001 | Info | Open | Google Sheets実接続 | 実資格情報設定後にPreviewで検証 |
| SEC-002 | Info | Open | Vercel環境分離 | Owner設定後にPreviewのSheet IDを確認 |
| SEC-003 | High | Accepted Risk（開発専用） | ESLintの推移依存 | Production依存ではなく、ESLint 10へ更新するとeslint-config-nextと非互換。定期更新で再確認 |

SEC-003は開発・監査ツールの依存で、Productionバンドルには含まれない。`npm audit --omit=dev`は0件である。Critical／HighのOpen所見が残る場合はProduction公開不可とする。SEC-R、SEC-B、SEC-Pの結果でこの台帳を更新する。
