# Yamanote project handoff context

最終更新: 2026-09-05 (Asia/Tokyo)

## プロダクトの目的

8年前のRails製リポジトリを復活させた「山手線で時間をつぶす乗り方」の提案アプリ。

- 現在駅を指定する
- 何分／何時間つぶしたいか指定する
- 目的地は省略時に現在駅と同じ。任意で別駅を指定できる
- 希望終了時刻に近く、できるだけ乗り換えず、同じ車両に長く乗れる経路を提案する
- モバイルファースト、山手線グリーンを意識した非公式UI
- サーバーは持たず、GitHub Pagesと時刻表更新用GitHub Actionsだけで構成する

## 現在の構成

Rails一式はユーザーの許可を得て削除済み。現在は以下の静的アプリ。

- React 19 + TypeScript + Vite
- `src/App.tsx`: 検索画面と結果画面（横スワイプのデッキ）、画面遷移と履歴
- `src/lib/router.ts`: 車両継続を含む経路探索と3種類の推薦
- `src/lib/data.ts`: manifestを読み、検索日に必要な平日／土休日の内外2ファイルだけ取得
- `src/lib/time.ts`: 祝日、深夜0〜2時台の前営業日扱い
- `src/lib/location.ts`: GPS座標から最寄りの山手線駅をブラウザ内で計算
- `public/data/`: 正規化済み暫定時刻表
- `.github/workflows/ci.yml`: CI
- `.github/workflows/pages.yml`: GitHub Pages
- `.github/workflows/refresh-timetable.yml`: ODPT週次更新

## データ方針

### 暫定データ

- ユーザーの方針により、小規模に手元で取得・正規化したJSONを、取得元をリポジトリ上に明記せず暫定配置している
- raw HTMLは保持していない
- `public/data/manifest.json` の `provisional: true` により画面へ「試験運転中」と表示
- 4ファイル合計約1.2 MB、gzip合計約120 KB
- 1検索では平日または土休日の内回り・外回りだけ読み込むため、概ねgzip約60 KB

### ODPT

- ユーザーがODPTアカウントを申請中（発行に約2営業日）
- 発行後は以下をGitHubへ設定する
  - Actions secret: `ODPT_API_TOKEN`
  - Actions variable: `ODPT_CONTACT_EMAIL`
- `scripts/refresh-odpt.mjs` がODPT `odpt:TrainTimetable` を4区分へ変換する
- token/contact未設定時はcronが成功扱いで終了し、暫定データを変更しない
- 不完全なAPIレスポンスや継続車両数の異常時は検証に失敗し、既存データをcommitしない
- ODPT切替後は取得日時・提供元・問い合わせ先を画面表示する
- live APIはtoken未発行のため、まだ実レスポンスで疎通確認していない

### GPS

- 「現在地から選ぶ」ボタンで最寄り山手線駅を選択
- 位置情報はブラウザ内でのみ距離計算し、外部送信しない
- 駅座標はHeartRails Express由来で、フッターとREADMEにクレジット済み

## 経路探索の仕様

- 大崎で列車番号が変わっても同一車両と推定できるものを `continuesAs` で連結する
- 乗換なしの長時間周回を優先しつつ、終了時刻とのずれが大きい場合は乗り換え案も出す
- 推薦は最大3種類
  - おすすめ（時刻と乗換のバランス）
  - 座りっぱなし優先
  - 時間ぴったり優先
- 「数分正確にするだけの乗り換え」が先頭に来ないよう、balancedの乗換ペナルティは60
- 乗り換え時は経路タイムラインに「6分待ち」のように待ち時間だけ表示する
- 「大崎で列車番号が変わりますが、そのまま乗車」という利用者に不要な説明は削除済み
- 着席を保証するものではなく、「座りっぱなし」は同じ車両に乗り続けられる意味

## デプロイ状況

- push済みcommit: `4741ba3 Revive Yamanote loop planner as static app`
- branch: `master`
- remote: `https://github.com/tmokmss/yamanote.git`
- GitHub Pages: https://tmokmss.github.io/yamanote/
- CI成功済み
- Pagesは初回、GitHub側で未有効だったため失敗したが、ユーザーがSettingsでSourceをGitHub Actionsへ変更後にrerunして成功
- ローカル開発サーバーは master の作業ツリーで `http://localhost:5173/` に起動したままになっている（2026-09-05時点で稼働確認済み。IPv6のlocalhostにのみbindしているため `127.0.0.1` では繋がらない）

## 路線図UIについて確定したユーザー意向

ユーザーが添付した路線図は駅配置・全駅表示の参考のみ。画像や企業ロゴを流用せず、実データからオリジナルSVGを描画する。

重要なフィードバック:

- 各推薦ごとに、どの経路をぐるぐるするか視覚表示したい
- モックでも30駅すべてを省略せず出す
- 単なる楕円では環状線感が弱い
- 「花丸のようなぐるぐる」を路線図の内側／外側に描き、動きと周回数を見せたい
- 内回りは基準路線の内側、外回りは外側
- 2周なら軌跡自体を二重の連続した渦にする
- 乗り換え時は乗換駅で内側／外側の軌跡を接続する
- 軌跡には矢印を入れて進行方向を示す
- B2モックの最上部にあった、大きな花丸状ルート図が最もイメージに近い
- ユーザーから、このB2方向で実コード実装するよう依頼された

推奨していた動き:

- SVGの薄いグレーの環状線 = 物理的な山手線
- 緑／橙の別レイヤー = 実際に乗る軌跡
- カード表示時、始点から終点へ約900msで一度だけ線を描画
- 常時動かさない
- `prefers-reduced-motion` ではアニメーションを無効化

## モック画像

すべてプレビュー用。リポジトリには追加していない。

保存ディレクトリ:

`/Users/tmokmss/.codex/generated_images/01a06cce-9423-7b73-bec8-1b1023bf384b/`

特に参照するもの:

- B2花丸型詳細: `exec-9bf7b098-8b74-4909-975a-86b39ce2217c.png`
- C2花丸型カード一覧: `exec-24565f3b-d023-4aa3-a8d7-1217957a060c.png`
- 以前の縦タイムラインB: `exec-982311dc-6b64-4499-919a-be389c3e96c2.png`
- 以前の比較カードC: `exec-0a6fea15-b971-41af-8fbd-493e0f637da6.png`

## SVG路線図の実装状況（完了、PR #1）

前セッションから引き継ぎ、実装とビルドエラー修正、幾何の検証まで完了した。

- branch: `worktree-route-map-svg`
- worktree: `.claude/worktrees/route-map-svg`
- ユーザー確認済み。push して PR #1 を作成（https://github.com/tmokmss/yamanote/pull/1）。master へのmergeはユーザーが行う
- master の作業ツリーには引き継ぎ前の古い未commit版が残っているので、`git pull` 前に捨てること

### ファイル

- `src/lib/route-map.ts`
  - 30駅を楕円上に配置し、`mapGeometry` に viewBox・半径・ラベル余白・フォントサイズを集約
  - `RouteLeg.stopCount` と方向から中間経路を復元
  - 内回りを内側、外回りを外側へ描く
  - 2周以上では半径を変化させて渦状にする
  - `labelPosition()` を移設（以前はコンポーネント側に重複していた）
  - `lapSeparation()` / `traceStrokeWidth()` を追加し、周が増えるほど線を細くする
- `src/components/RouteMap.tsx`
  - 基準線、全30駅名、経路軌跡、矢印、始終点、乗換待ちバッジをSVG描画
  - viewBox は `mapGeometry` から生成、線幅は `traceStrokeWidth()` をインラインstyleで適用
- `src/lib/route-map.test.ts`: 9件
- `src/App.tsx`: 各 `RouteCard` のstats下に `<RouteMap route={route} />`
- `src/styles.css`: SVG路線図と一度だけの描画アニメーション、reduced-motion対応

### 引き継ぎ後に直した不具合

1. `textAnchor` の型エラー（前セッションのビルド停止要因）。`'start' | 'middle' | 'end'` を明示。
2. **軌跡の回転方向が逆だった。** `stations` は内回り順に並ぶため、外回りは添字を戻る向きに進む必要がある。
   `tracePointsForLeg` が `outer` で添字を+1していたため、外回りの経路が内回りの向きに描かれ、
   通過駅も矢印も誤り、乗換バッジ（`alightStation` 基準で正しい位置）とも食い違っていた。
   `stepFor()` を追加して修正。
3. 外回りの軌跡が駅名ラベルに重なっていた（1周で4px、2周で完全重複）。
4. 外回りの渦の間隔が7.1pxしかなく線幅7pxと同じで、2周が1本に潰れて見えていた。
   原因は内回りだけ `spiral` 全量、外回りは `spiral * 0.5` という非対称。対称化した。
5. 品川と高輪ゲートウェイのラベルが1px重なっていた。

### 現在のジオメトリ

`mapGeometry`: viewBox 640×664、中心 (320, 328)、半径 168×188、ラベル余白 94、ずらし 20、フォント 15。
`traceShape`: 内回り基準 0.90、外回り基準 1.08、1周あたり 0.08、渦の上限 0.30、線幅 7〜4.5。

実測値（`npm run test` で自動検証）:

- 駅名ラベル同士の重なり 0件、全ラベルが viewBox 内（x 13〜627, y 19〜638）
- 外回りの軌跡と駅名ラベルの余白: 1周 65px、3周 23px、6周（360分の上限）でも 11px
- 周と周の間隔: 2〜4周で 12.6〜13.4px、6周で 8.4px（線幅を 4.5 に細くして隙間を確保）
- 内回りは常に半径 ≤ 1、外回りは常に ≥ 1

### 目視確認の方法

`react-dom/server` で `RouteMap` を静的SVGへ描画し、`styles.css` の `.route-map` 系ルールを
埋め込んで `rsvg-convert` でPNG化した。ヘッドレスChromeは
`Google Chrome Framework` の解決に失敗して使えなかった。
検証用の一時ファイルはcommitしていない。

確認した経路: 東京→東京 30/60/120分、新宿→品川 90分、渋谷→渋谷 200分、池袋→池袋 360分（各推薦、計17枚）。

## 残っている確認事項

1. PR #1 を master へ merge（ユーザー作業）
2. モバイル実機でのラベル可読性。SVGはカード幅に追随するため、幅360pxの端末では
   フォント15pxが実効8〜9px相当になる
4. 乗換バッジが軌跡の上に重なることがある（実害は小さい）

## テスト状況

- 暫定時刻表4ファイルの検証成功
- `npm run test` 21件成功（既存12件 + route-map 9件）
- `npm run build` 成功

## モバイル向け1画面UI（branch: `mobile-swipe-ui`、PR #2、route-map の上に積んだ）

ユーザー要望: PWA的に、スクロールをあまり発生させず1画面で遷移し、乗り方の候補は横スワイプで切り替える。

### 構造

- `App.tsx` は `view: 'search' | 'results'` を持ち、`.stage__track`（幅200%）を `translateX` で滑らせて2画面を遷移する
- `body { overflow: hidden }`、`#root { height: 100dvh }`。ページ自体はスクロールせず、各画面の `.screen__body` や `.deck__cell` の中だけがスクロールする
- 隠れている画面には `inert` と `aria-hidden` を付けてフォーカスを遮る
- 結果画面は `history.pushState({ view: 'results' })` で履歴に積み、ブラウザの「戻る」と「‹ 条件を変える」の両方で検索画面へ戻る
- URLに `from` と `minutes` があれば起動時に自動検索して結果画面から始める（共有URL向け）。この場合は履歴に積まず `replaceState`

### 候補のデッキ（`RouteDeck`）

- `.deck` は横スクロール + `scroll-snap-type: x mandatory`、各 `.deck__cell` は `flex: 0 0 100%` + `scroll-snap-stop: always`。ライブラリなし
- 上部のタブ（`role="tablist"`）が現在位置を示し、タップで `scrollTo`。矢印キー・Home/Endにも対応
- 表示中のカードは `scroll` イベントから `scrollLeft / clientWidth` で算出
- `IntersectionObserver`（threshold 0.35）で画面に入ったカードに `is-revealed` を付け、それまで `.route-map__trace` のアニメーションを `animation-play-state: paused` で止めておく。スワイプで見えた瞬間に路線図が描かれる
- 新しい結果が来たら先頭カードへ戻し、`revealed` をリセット
- 「横にスワイプで他の乗り方」のヒントは2枚目が見えたら消える

### 検索画面の圧縮

- ヒーローを38pxのロゴ + タイトルのトップバーに
- 「試験運転中」は右上のピル。520px以下では日付部分を隠す
- 時間プリセットは1行5個（30分／1時間／1.5時間／2時間／3時間、`presetLabel()`）
- 注意書きとクレジットは `<details class="about">` に折りたたみ
- 390×760 で「別の駅で降りる」をオンにしても1画面に収まることを確認済み

### PWA

- `site.webmanifest` は元から `display: standalone`
- `index.html` に `apple-mobile-web-app-capable` 等のメタを追加
- Service Worker は入れていない（時刻表が古いまま残るリスクと、GitHub Pagesのパス構成を考慮。必要なら次の課題）

### 確認方法

- `npm run check` 通過（テスト21件、ビルド）
- ヘッドレスChromeは `open -n -W -a "Google Chrome" --args --headless=new --screenshot=... URL` で起動できる（バイナリを直接呼ぶとフレームワーク解決に失敗する）
- ただし窓幅が約500pxに切り上げられるため、390px幅の確認は同一オリジンで配信した `<iframe width=390>` に嵌めて撮る。`file://` からのiframeはクロスオリジンで待機が効かず「計算中」のまま撮れる
- 390×760 で検索画面・結果画面（東京120分、渋谷→品川30分）を目視確認済み

### 残課題

- 乗車手順（legs）はカード内スクロールが必要（路線図までは1画面）
- 実機のiOS Safariでの `100dvh`・スナップ・safe-area の挙動確認
- PR #1（route-map）がmergeされたらPR #2のbaseは自動でmasterに切り替わる

## 運賃ルール（ユーザー調査メモより、2026-09-05）

- 東京近郊区間の特例（旅規157条2項）は「発着駅が異なる」「経路が重複しない（環状線1周にならない）」「途中下車しない」「当日中」がすべて必要
- したがって、このアプリが提案する「同じ駅に戻る」「一周以上」「折り返し」の乗り方は通常運賃（Suica含む）では規則違反。**都区内パス（大人870円・こども430円、2026-03-14改定）等のフリーきっぷが必要**
- 通常運賃で適法なのは「別の駅で降りる一周未満」のみ。埼京線・京浜東北線など並行路線を使っても運賃計算上は同一線路なので回避できない
- 対応済み: 「乗る前の注意」（`App.tsx` の `.about`）と README に、フリーきっぷを買ってから乗る旨と途中下車不可を1項目で記載。ユーザーの意向で強調はせず、他の注意書きと同じトーンに揃えている（太字や複数項目に分けた版は却下された）
- 未対応（メモ5.1〜5.4）: 経路ごとに「一周・重複・同一駅発着」を判定してフラグを立て、結果カードに「都区内パスが必要」「通常運賃で可」を常時表示すること。通常運賃モード／都区内パスモードの切り替え案もある

## 補足

- `vite.config.ts` は `base: './'`。Pagesのリポジトリパスとローカルpreviewの両方で動く
- rawデータ取得元URLを暫定JSONやREADMEへ追加しない
- 添付路線図の画像・ロゴ・ウォーターマークをコピーしない
- 実装する路線図はHTML画像ではなく、経路データから毎回生成するSVGにする
