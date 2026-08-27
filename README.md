# わたしのタスク管理

期限と優先度から「今日やること」を見つける、個人用タスク管理アプリです。Next.js App RouterをUIとAPIに使い、Google Sheetsを正本データ、Vercelを実行環境として想定しています。

「今日の段取り」では、未計画の未完了タスクを優先度マトリクスで確認し、時間軸へドラッグして時間割を作れます。

## ローカル起動

```bash
npm install
cp .env.example .env.local
# 開発時はTASK_STORE_MODE=memoryを設定するとGoogle認証なしで動作します
npm run dev
```

`http://localhost:3000`へアクセスしてください。Google Sheetsを使う場合は、`.env.local`へ実値を設定し、`TASK_STORE_MODE`を削除または`google`にします。Productionでは必ずGoogle Sheetsを使用し、必要な環境変数がない場合は起動を失敗させます。

## 開発者向けコマンド

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

パスフレーズハッシュは、実値をファイルへ保存せず次のコマンドで生成します。

```bash
node scripts/generate-passphrase-hash.mjs '16文字以上のパスフレーズ'
```

## 構成

- `/dashboard`: ダッシュボード
- `/all`: TODO ALL
- `/due`: 今日まで
- `/matrix`: 優先度マトリクス
- `/plan`: 今日の段取り（マトリクスから時間軸へ配置）
- `/wbs`: 時間軸WBS（タスクを縦、日程を横に並べ、3つの確認日を表示）
- `/private`: プライベートカテゴリのタスク一覧
- `/login`: パスフレーズ認証
- `/api/tasks`: タスクAPI
- `/api/schedule`: 今日のスケジュールAPI
- `lib/tasks`: 優先度・日付・集計のドメインロジック
- `lib/sheets`: Google Sheets Repositoryと行変換

タスク作成時にカテゴリ（通常／プライベート）を選択できます。カテゴリは同じTasks表の`category`列で管理され、プライベートタスクもTODO ALL・今日まで・マトリクス・今日の段取りなどの通常画面に表示されます。

「今日の段取り」では、タスクを時間軸へ配置でき、昼食・会議などの自由予定も追加できます。タスクはTasks表、自由予定は同じスプレッドシートの`ScheduleItems`タブで管理します。

## デプロイ

VercelとGoogle Sheetsの所有者向け設定は次を参照してください。

- [Google Sheets設定](docs/deployment/google-sheets-setup.md)
- [Vercel設定](docs/deployment/vercel-setup.md)
- [Productionチェックリスト](docs/deployment/production-checklist.md)
- [切り戻し手順](docs/deployment/rollback-runbook.md)

Productionデプロイはこのリポジトリから自動実行しません。PreviewでDEVシートを確認し、所有者が最終承認してから公開してください。
