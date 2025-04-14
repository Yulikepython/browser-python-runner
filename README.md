# ブラウザ上のPython実行環境

このプロジェクトは、Pyodideを使用してブラウザ上でPythonコードを実行できる簡単なWebアプリケーションです。バックエンド不要で、すべての処理はユーザーのブラウザ上で完結します。

## 特徴

- **バックエンド不要**: すべての処理はブラウザ内で完結
- **Pyodideを使用**: ブラウザ上でPythonコードを実行
- **CodeMirrorエディタ**: 構文ハイライト機能付きのコードエディタ
- **URLパラメータ対応**: URLのクエリパラメータでコードを初期化可能

## 使い方

1. テキストエリアにPythonコードを入力
2. 「実行」ボタンをクリックして結果を確認
3. URLパラメータでコードを共有: `?code=print("Hello")`のように`code`パラメータを使用

## 技術スタック

- HTML, CSS, JavaScript
- [Pyodide](https://pyodide.org/): ブラウザ上でのPython実行環境
- [CodeMirror](https://codemirror.net/): コードエディタ

## ライセンス

MITライセンス