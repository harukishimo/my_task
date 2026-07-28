# Production公開前チェックリスト

- [ ] Previewのビルドが成功している。
- [ ] Lint、型チェック、単体、結合、E2Eが成功している。
- [ ] Previewが開発用Sheetsだけを使用している。
- [ ] 本番Sheetsのバックアップを作成した。
- [ ] 本番Sheetsが一般公開されていない。
- [ ] `Tasks`タブのA〜L列が正しい。
- [ ] Productionの環境変数が登録されている。
- [ ] Productionの`SESSION_SECRET`がPreviewと異なる。
- [ ] ブラウザ、Network応答、ログへ秘密情報が出ていない。
- [ ] Critical／HighのOpen所見がない。
- [ ] OWNERが公開を明示承認した。

公開後は、ログイン、テストタスク追加、マトリクス移動、完了、復元、論理削除、ログアウトを順に確認し、テストタスクを残さないでください。
