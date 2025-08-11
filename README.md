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

## 互換性

- モダンブラウザ (Chrome, Firefox, Safari, Edge) に対応
- モダンなブラウザでは Clipboard API を使用し、古いブラウザでは自動的にフォールバック処理を実行します

## ライセンス

MIT ライセンス
