# Google Sheets設定手順

## 1. 開発用と本番用のシート

開発／Preview用とProduction用に別のスプレッドシートを作成し、どちらも一般公開しないでください。各スプレッドシートに`Tasks`タブを作成し、1行目へ次を入力します。

```text
id | title | due_date | is_urgent | is_important | priority | status | completed_at | is_deleted | created_at | updated_at | version | comment | plan_date | plan_order | category
```

ヘッダー行と列順は手動変更しないでください。

既存のA:O形式で運用している場合は、P1に`category`を追加してください。既存タスクのP列は空欄のままで問題ありません（アプリが`default`として扱います）。

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
- `APP_TIME_ZONE=Asia/Tokyo`

Previewは開発用ID、Productionは本番用IDを使います。同じIDを設定しないでください。
