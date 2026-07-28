# 実装判断と状態

- 認証方式はユーザー名なしのパスフレーズとする。
- ローカルでGoogle資格情報がない場合は`TASK_STORE_MODE=memory`を使用できる。
- Productionでは必要な環境変数がなければGoogle Sheets Repositoryを選択し、設定エラーとして停止する。
- 実シートへの接続確認、Vercel環境変数の登録、Production公開はOwner作業として残す。
