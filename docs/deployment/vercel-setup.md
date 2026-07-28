# Vercel設定手順

1. GitリポジトリをVercelへImportする。
2. Framework PresetがNext.js、Root Directoryがリポジトリルートであることを確認する。
3. Build Commandが`npm run build`、Install Commandが`npm ci`であることを確認する。
4. Development、Preview、Productionそれぞれへ環境変数を登録する。
5. Previewには開発用パスフレーズハッシュ、Preview用`SESSION_SECRET`、開発用Sheets IDを登録する。
6. Productionには本番用ハッシュ、本番用`SESSION_SECRET`、本番Sheets IDを登録する。
7. Preview Deploymentでログイン、追加、編集、マトリクス移動、完了、復元、論理削除を確認する。
8. Preview確認後、所有者がProduction公開を明示承認する。

## Production必須環境変数

`APP_PASSPHRASE_HASH`、`SESSION_SECRET`、`GOOGLE_SERVICE_ACCOUNT_EMAIL`、`GOOGLE_PRIVATE_KEY`、`GOOGLE_SHEET_ID`。

`SESSION_SECRET`はPreviewとProductionで異なる32文字以上の値にしてください。値を変更した場合、再デプロイ後に既存セッションが失効します。
