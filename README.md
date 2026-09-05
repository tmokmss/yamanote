# ヤマノテループ

山手線で時間をつぶしたいときに、できるだけ同じ車両に乗り続けられる乗り方を提案する静的Webアプリです。

現在駅、つぶしたい時間、任意の目的地を入力すると、次の観点で候補を表示します。

- 時間と乗り換え回数のバランス
- 同じ車両に乗り続けることを優先
- 希望終了時刻への近さを優先
- 端末の現在地から最寄りの山手線駅を選択

位置情報はブラウザ内の距離計算にだけ使い、外部サーバーへ送信しません。駅座標には [HeartRails Express](https://www.heartrails-express.com/) のデータを使用しています。

## ローカルで動かす

Node.js 24を使います。

```sh
npm ci
npm run dev
```

全チェックは次のコマンドで実行できます。

```sh
npm run check
```

## 構成

- `src/`: React + TypeScriptの画面と経路探索
- `public/data/`: ブラウザが必要な曜日区分・方向だけ取得する正規化済み時刻表
- `scripts/import-html.mjs`: 手元のHTMLから暫定JSONを生成する汎用インポーター
- `scripts/refresh-odpt.mjs`: ODPT APIから4種類の時刻表を更新するインポーター
- `.github/workflows/pages.yml`: GitHub Pagesへのデプロイ
- `.github/workflows/refresh-timetable.yml`: 毎週の時刻表更新

フロントエンドはサーバーを必要としません。最初に小さなmanifestを読み、検索日が平日なら平日用、土日祝なら土休日用の内回り・外回りJSONだけを取得します。現在の4ファイルは合計約1.2 MB、通常のHTTP圧縮後は合計約120 KBです。1回の検索で取得するのはその約半分です。

## 時刻表データ

現在は動作確認用の暫定データです。`public/data/manifest.json` の `provisional` が `true` の間、画面にも「試験運転中」と表示されます。

ODPTのアカウント発行後、GitHubリポジトリに次を設定すると、毎週月曜のcronと手動実行で公式API由来のデータへ切り替わります。

1. Actions secret `ODPT_API_TOKEN`: ODPTのアクセストークン
2. Actions variable `ODPT_CONTACT_EMAIL`: アプリ問い合わせ先の公開メールアドレス

問い合わせ先はODPTの公開ガイドラインに沿って画面に表示されます。いずれかが未設定ならcronは成功扱いで終了し、暫定データを変更しません。APIの応答が不完全な場合も既存データは上書きしません。

## デプロイ

`master`へのpushでテスト・ビルド後、GitHub Pagesへデプロイします。GitHub側の Settings → Pages → Source は **GitHub Actions** を選択してください。

## 注意

- 同じ車両で移動できる経路を提案しますが、着席は保証しません。
- 遅延、運休、臨時ダイヤは扱いません。
- 同じ駅に戻る乗り方や一周以上の乗り方は通常運賃では認められていないため、[都区内パス](https://www.jreast.co.jp/tickets/info.aspx?GoodsCd=2485)などのフリーきっぷを買ってから乗ってください。運賃規則の適用は各鉄道事業者の案内に従ってください。
