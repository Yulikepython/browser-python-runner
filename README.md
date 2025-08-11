# browser-python-runner

ブラウザ上の Python 実行環境

このプロジェクトは、Pyodide を使用してブラウザ上で Python コードを実行できる簡単な Web アプリケーションです。バックエンド不要で、すべての処理はユーザーのブラウザ上で完結します。

## 特徴

- **バックエンド不要**: すべての処理はブラウザ内で完結
- **Pyodide を使用**: ブラウザ上で Python コードを実行
- **人気ライブラリに対応**: `numpy`, `pandas`, `matplotlib` など Pyodide が提供する多くのパッケージがそのまま使えます
- **CodeMirror エディタ**: 構文ハイライト機能付きのコードエディタ
- **URL パラメータ対応**: URL のクエリパラメータでコードを初期化可能
- **コード共有機能**: 作成したコードを URL として簡単に共有可能
- **Base64 エンコード対応**: 日本語を含むコードも正しく共有可能

## 使い方

1. テキストエリアに Python コードを入力
2. 「実行」ボタンをクリックして結果を確認
3. 「コードをコピー」ボタンでエディタのコードをクリップボードにコピー
4. 「コード共有 URL をコピー」ボタンで現在のコードを含んだ URL をコピー
   - この URL を共有すると、同じコードがプリロードされた状態でアプリを開くことができます
   - 日本語などの非 ASCII 文字を含むコードは自動的に Base64 エンコードされます

### ライブラリの利用（pandas など）

このアプリは Pyodide の `loadPackagesFromImports` を用いて、ユーザーコード内の `import` を解析し、必要なパッケージを自動で取得・読み込みします。

使用例:

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
print(df.describe())
```

最初の実行時にパッケージ（例: pandas, numpy）がネットワーク経由でダウンロードされるため、少し時間がかかることがあります。読み込まれたパッケージは同一セッション中はキャッシュされ、再実行は高速です。

対応パッケージ一覧は公式の Pyodide パッケージリストをご参照ください。Pyodide に含まれない CPython ネイティブ拡張（C 拡張）が必要なパッケージは利用できない場合があります。

### URL パラメータの使い方

- 通常の URL エンコード: `?code=print("Hello")`
- Base64 エンコード: `?code=cHJpbnQoIkhlbGxvIik%3D&base64=true`
  - `base64=true` パラメータがある場合、コードは Base64 としてデコードされます

## 技術スタック

- HTML, CSS, JavaScript
- [Pyodide](https://pyodide.org/): ブラウザ上での Python 実行環境
- [CodeMirror](https://codemirror.net/): コードエディタ

## 制限事項とヒント

- 初回ロード時や大きなライブラリ（pandas, matplotlib 等）の読み込み時は数十 MB のダウンロードが発生するため、通信環境にご注意ください。
- サービスワーカーや CDN のキャッシュを活用すると体感速度が向上します（GitHub Pages + CDN キャッシュで十分に実用的です）。
- ファイル I/O はブラウザの仮想 FS 内で完結します。ローカルファイルは `<input type="file">` などで読み込んでから扱ってください。

### Excel ファイルの読み込み（pandas）

ブラウザ上でも `pandas.read_excel` を使えます。ローカルファイルか URL のどちらかで取り込みます。

1. ローカルの .xlsx をアップロードして読む（推奨・簡単）

- 画面の「Excel を読み込む (.xlsx)」にファイルを選ぶと、仮想 FS の `/tmp/<ファイル名>` に保存されます。
- その後、エディタのサンプルを実行:

```python
import pandas as pd
import openpyxl  # xlsx読み込みエンジン
df = pd.read_excel('/tmp/yourfile.xlsx', engine='openpyxl')
print(df.head())
```

2. 公開 URL から読む（GitHub Pages 上の同一オリジンを推奨）

Python のみで URL 直読み:

```python
import pyodide_http
pyodide_http.patch_all()

import pandas as pd
import openpyxl
url = 'https://<your-gh-pages-domain>/browser-python-runner/data/sample.xlsx'
df = pd.read_excel(url, engine='openpyxl')
print(df.shape)
```

もしくは JS で fetch して FS へ保存してから読む（CORS の影響を受けにくい）:

```javascript
// script.js 例
const url = "https://.../sample.xlsx";
const res = await fetch(url, { mode: "cors" });
const buf = new Uint8Array(await res.arrayBuffer());
pyodide.FS.writeFile("/tmp/sample.xlsx", buf);
```

```python
import pandas as pd, openpyxl
df = pd.read_excel('/tmp/sample.xlsx', engine='openpyxl')
```

注意:

- .xlsx は `openpyxl` を使います（コード内で `import openpyxl` を入れると自動取得されます）。
- .xls を扱う場合は `xlrd` が必要です。
- 外部ドメインの URL は CORS 許可が必要です。同一オリジン（この GitHub Pages 内）が安全です。

### トラブルシューティング: zipfile.BadZipFile: File is not a zip file

`pandas.read_excel(..., engine="openpyxl")` 実行時に次のエラーが出る場合があります:

```
zipfile.BadZipFile: File is not a zip file
```

主な原因:

- .xls（古い Excel 形式）を .xlsx にリネームしただけで中身が旧形式のまま
- 実体が CSV/TSV だが拡張子が .xlsx になっている
- ダウンロード失敗などで壊れたファイル

対策:

1. 本物の .xlsx として保存し直す

- Excel/スプレッドシートで開き、「名前を付けて保存」→「Excel ブック (\*.xlsx)」を選択

2. .xls のまま読みたい場合

- `xlrd` が必要です。Pyodide では純 Python 版 `xlrd` を `micropip` でインストールしてから `engine='xlrd'` を指定してください（ただし xlrd 2.x は .xls 非対応。1.2.0 が必要なケースがあります。互換性に注意）。

3. CSV/TSV の可能性

- `pandas.read_csv(path)` で読み込みを試してください。

本アプリのファイルアップロード時は、先頭バイトに 'PK'（Zip シグネチャ）があるかを簡易チェックし、拡張子 .xlsx なのに Zip でない場合は警告を表示します。

## 表示ノイズの抑制について

本アプリは、学習やデモ用途での見やすさを重視し、以下のような「動作に支障のないメッセージ」を出力欄に表示しない方針を採用しています。

- Python の警告（Warning）全般（例: DeprecationWarning, FutureWarning, ResourceWarning）
- pandas が将来 `pyarrow` を必須化する旨の告知メッセージ

実装の概要:

- Python 側で `warnings.filterwarnings('ignore', ...)` により上記の警告を非表示化
- 標準エラー出力（stderr）に流れるメッセージのうち、警告や上記告知に該当するものは UI には表示しない
- 実行に支障のある例外・エラーのみ `[Error]` として表示

注意:

- 警告を非表示にすることで将来の非互換へ気づきにくくなる可能性があります。開発・検証時には警告を有効化することをおすすめします。

警告表示を再有効化するには（開発者向け）:

- `script.js` 内の `initializePyodide()` で設定している `warnings.filterwarnings('ignore', ...)` の行をコメントアウトする
- もしくは `pyodide.setStderr` のフィルタで `warning` を除外している条件分岐を削除する

## 互換性

- モダンブラウザ (Chrome, Firefox, Safari, Edge) に対応
- モダンなブラウザでは Clipboard API を使用し、古いブラウザでは自動的にフォールバック処理を実行します

## ライセンス

MIT ライセンス
