# Google Sheets設定手順

## 1. 開発用と本番用のシート

開発／Preview用とProduction用に別のスプレッドシートを作成し、どちらも一般公開しないでください。各スプレッドシートに`Tasks`タブを作成し、1行目へ次を入力します。

```text
id | title | due_date | is_urgent | is_important | priority | status | completed_at | is_deleted | created_at | updated_at | version | comment | plan_date | plan_order | category | work_hours | review_outline_at | review_mid_at | review_almost_at | review_manual | due_time | parent_task_id | requires_request | is_quick_task | estimated_workdays
```

ヘッダー行と列順は手動変更しないでください。

既存のA:U形式で運用している場合は、V1へ`due_time`を追加してください。既存行の時刻は空欄のままで、アプリは`19:00`として扱います。

既存のA:P形式で運用している場合は、Q1から`work_hours` `review_outline_at` `review_mid_at` `review_almost_at` `review_manual`、V1へ`due_time`を追加してください。既存行の新しい列は空欄のままで問題ありません。

既存のA:V形式で運用している場合は、W1から`parent_task_id` `requires_request` `is_quick_task` `estimated_workdays`を追加してください。既存行の空欄は、親タスクなし・依頼なし・10分以内ではない・想定1営業日として扱います。`estimated_workdays`が3以上のタスクは、今日の段取りで分解対象として表示されます。

旧タイムスケジュールのデータを保持する場合は、同じスプレッドシート内の`ScheduleItems`タブを残します。現在の「今日の段取り」画面では使用しません。

```text
id | schedule_date | start_time | end_time | item_type | task_id | title | comment | sort_order | is_deleted | created_at | updated_at | version
```

## 2. サービスアカウント

1. Google Cloudでプロジェクトを作成する。
2. Google Sheets API v4を有効化する。
3. 専用サービスアカウントを作成する。
4. JSON鍵を一度だけ安全な場所へ保存する。
5.対象スプレッドシートの共有設定で、サービスアカウントのメールアドレスへ編集者権限を付与する。

JSON鍵、メールアドレス、スプレッドシートIDをチャット、Git、READMEへ貼り付けないでください。

## 3. 環境変数

`.env.example`を参照して、環境ごとに次を設定します。

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`（改行は`\\n`として登録可能）
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB=Tasks`
- `GOOGLE_SCHEDULE_TAB=ScheduleItems`
- `APP_TIME_ZONE=Asia/Tokyo`

Previewは開発用ID、Productionは本番用IDを使います。同じIDを設定しないでください。
