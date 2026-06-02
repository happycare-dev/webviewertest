# FileMaker Web Viewer セットアップ

このドキュメントでは、従業員データを Web Viewer に表示するための FileMaker 側の設定を説明します。

## 1. 用意するもの

- **employee-viewer.html** を、FileMaker からアクセスできる場所に配置します。
  - 例: 共有フォルダ、Web サーバー、または FileMaker Server の Web 公開フォルダ
  - ローカルで試す場合: `Get ( DocumentsPath )` で取得できるパスのフォルダに `employee-viewer.html` を置く

## 2. Web Viewer の URL 計算式（データを渡す）

Web Viewer オブジェクトの **URL 計算式** で、HTML のパスとデータを渡します。

### 方法 A: クエリパラメータで JSON を Base64 渡し（推奨）

1. スクリプトで「現在のテーブルのレコード」から JSON 配列を作成する
2. その文字列を Base64 エンコードする
3. `file:///.../employee-viewer.html?data=«Base64文字列»` のように URL を組み立て、Web Viewer に渡す

**計算式の例（URL のみ、データは別計算で組み立てる場合）:**

```filemaker
"file:///" & 
Substitute ( Get ( DocumentsPath ) ; ":" ; "/" ) & 
"employee-viewer.html?data=" & 
$gWebViewerData
```

`$gWebViewerData` には、後述のスクリプトで「JSON 配列を Base64 エンコードした文字列」を入れます。

### 方法 B: ハッシュで JSON を Base64 渡し

URL が長くなりすぎる場合は、フラグメント（#）を使います。

```filemaker
"file:///" & 
Substitute ( Get ( DocumentsPath ) ; ":" ; "/" ) & 
"employee-viewer.html#" & 
$gWebViewerData
```

※ ブラウザによっては `#` 以降の長さに制限があります。

---

## 3. データ用グローバル変数とスクリプト例

### グローバル変数

- **$gWebViewerData** … 上記 URL 計算で参照する、Base64 エンコードされた JSON 文字列を格納

### スクリプト: 「Web Viewer 用にデータをセット」

```filemaker
# 現在のファウンドセットから JSON 配列を作成し、Base64 にして $gWebViewerData にセット

Set Variable [ $json ; Value: "[" ]
Go to Record/Request/Page [ First ]

Loop
  # 各フィールドを JSON の値として連結（フィールド名は実際のものに合わせてください）
  Set Variable [ $name   ; Value: YourTable::姓名 ]   // 氏名（フル）
  Set Variable [ $store  ; Value: YourTable::店舗名 ] // 店舗・拠点
  Set Variable [ $status ; Value: YourTable::状態 ]   // 退職 など
  Set Variable [ $date   ; Value: YourTable::日付 ]   // 日付

  Set Variable [ $row ; Value: 
    "{\"fullName\":\"" & Substitute ( $name ; "\" ; "\\\"" ) & 
    "\",\"location\":\"" & Substitute ( $store ; "\" ; "\\\"" ) & 
    "\",\"status\":\"" & Substitute ( $status ; "\" ; "\\\"" ) & 
    "\",\"date\":\"" & Substitute ( $date ; "\" ; "\\\"" ) & "\"}"
  ]

  Set Variable [ $json ; Value: $json & $row ]
  Go to Record/Request/Page [ Next ; Exit after last: 1 ]
  Exit Loop If [ Get ( RecordNumber ) = Get ( FoundCount ) ]
  Set Variable [ $json ; Value: $json & "," ]
End Loop

Set Variable [ $json ; Value: $json & "]" ]
Set Variable [ $gWebViewerData ; Value: Base64Encode ( $json ; "UTF-8" ) ]

# Web Viewer を更新するためにレイアウトを再描画する
Refresh Window
```

- **YourTable::** の部分は、実際のテーブル名・フィールド名に置き換えてください。
- フィールド名の例: 姓名 / 店舗名・拠点 / 状態 / 日付（または退職日）

### レイアウトでの流れ

1. Web Viewer オブジェクトの「URL 計算」に、上記の `file:///...?data=...` または `...#...` の計算式を設定する（`$gWebViewerData` を参照）。
2. レイアウトを開いたとき、または「一覧を表示」ボタンを押したときに、上記スクリプト「Web Viewer 用にデータをセット」を実行する。
3. スクリプトの最後で `Refresh Window` すると、Web Viewer の URL が再計算され、HTML にデータが渡って表が表示されます。

---

## 4. テーブル構造が Employee.tab と同じ場合

Employee.tab のようなタブ区切り（列順）の場合は、FileMaker で次のようなマッピングにします。

| 列（0始まり） | 内容     | FileMaker フィールド例 |
|--------------|----------|-------------------------|
| 4            | 店舗・拠点 | 店舗名                  |
| 7            | 状態     | 状態                    |
| 9            | 氏名     | 姓名                    |
| 16           | 日付     | 日付（退職日）          |

上記スクリプトの `$name` / `$store` / `$status` / `$date` を、このフィールドに合わせて設定してください。

---

## 5. Base64Encode について

- FileMaker 18 以降では **Base64Encode** 関数が使えます。
- それより前のバージョンの場合は、カスタム関数やプラグインで Base64 エンコードするか、別の方法（例: ローカルで簡易 HTTP サーバーを立てて JSON を POST する）を検討してください。

---

## 6. 注意事項

- **file://** で開く場合、HTML ファイルの実体は「そのパスに置いた一つのファイル」です。同じ HTML を複数ユーザーで共有する場合は、共有フォルダや Web サーバー上のパスに置き、その URL を Web Viewer で使ってください。
- URL の長さ制限（多くのブラウザで 2KB〜8KB 程度）に注意し、レコード数が多い場合は「ハッシュ」より「クエリ ?data=」を試すか、表示件数を絞る、ページングを検討してください。
- **UTF-8** で JSON を組み立て、Base64Encode する際も UTF-8 を指定すると、日本語が正しく表示されます。

以上で、FileMaker のテーブルデータを Web Viewer 上の employee-viewer.html で表示できます。
