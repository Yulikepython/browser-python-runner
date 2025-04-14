はい、コードの保存機能がなく、**左側に入力した Python コードをブラウザ上で実行し、右側に結果を表示するだけであれば、バックエンドなしのフロントエンドのみで実現可能**です。

これは、**Pyodide** という技術を使うことで達成できます。

**Pyodide とは？**

- Python の公式実装 (CPython) を WebAssembly (Wasm) にコンパイルしたものです。
- これにより、Web ブラウザ内で直接 Python コードを実行できます。
- NumPy, Pandas, Matplotlib など、多くの人気のある Python ライブラリも Wasm にコンパイルされており、Pyodide から利用可能です。
- JavaScript と Python の間でデータのやり取りも可能です。

**メリット（今回の要件に合致する点）:**

1.  **バックエンド不要:** Python コードの実行はすべてユーザーのブラウザ内で完結します。サーバーサイドの処理や API は不要です。
2.  **セキュリティ:** コードはブラウザの WebAssembly サンドボックス内で実行されます。これは非常に強力なセキュリティ境界であり、ローカルファイルシステムへのアクセスや OS レベルの操作は基本的にできません。悪意のあるコードがサーバーや他のユーザーに影響を与える心配がありません。（サーバーサイドで実行環境を用意する場合よりも、セキュリティリスクを大幅に低減できます）。
3.  **シンプルさ:** サーバー側のインフラ管理が不要になるため、開発とデプロイが非常にシンプルになります。
4.  **URL パラメータでの初期化:** JavaScript を使って簡単に URL パラメータを読み取り、Pyodide に渡すコードを初期化できます。

**デメリット（考慮点）:**

1.  **初期ロード時間:** 初めてページを開く際に、Pyodide 本体と必要な Python 環境（数 MB〜数十 MB）をダウンロードする必要があります。これにより、初回表示が少し遅くなる可能性があります。
2.  **利用可能なライブラリ:** Pyodide は多くのライブラリをサポートしていますが、C 言語拡張に大きく依存していて Wasm に移植されていないライブラリや、OS 固有の機能（`subprocess`で外部コマンド実行など）を必要とするライブラリは利用できません。ブログで扱うような基本的な文法や標準ライブラリ、データサイエンス系ライブラリなら問題ないことが多いです。
3.  **実行パフォーマンス:** ブラウザ内での実行のため、ネイティブ環境よりは遅くなる可能性がありますが、簡単なコードスニペットなら通常問題ありません。

**実装方法**

以下に、HTML、CSS、JavaScript（Pyodide を使用）を使った簡単な実装例と解説を示します。

**1. HTML (`index.html`)**

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Python コード実行 (フロントエンドのみ)</title>
    <link rel="stylesheet" href="style.css" />
    <script src="https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js"></script>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.15/codemirror.min.css"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.15/theme/material-darker.min.css"
    />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.15/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.15/mode/python/python.min.js"></script>
  </head>
  <body>
    <h1>Python コード実行 (Pyodide)</h1>
    <div class="container">
      <div class="editor-pane">
        <h2>コード入力</h2>
        <textarea id="code-input"></textarea>
        <button id="run-button">実行</button>
        <div id="loading-indicator" style="display: none;">
          Pyodide 準備中...
        </div>
      </div>
      <div class="output-pane">
        <h2>実行結果</h2>
        <pre id="output"></pre>
      </div>
    </div>

    <script src="script.js"></script>
  </body>
</html>
```

**2. CSS (`style.css`)**

```css
body {
  font-family: sans-serif;
  margin: 20px;
  background-color: #f4f4f4;
}

.container {
  display: flex;
  gap: 20px;
  height: 70vh; /* 高さを調整 */
}

.editor-pane,
.output-pane {
  flex: 1; /* 幅を均等に分割 */
  background-color: #fff;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

h1,
h2 {
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  margin-top: 0;
}

/* CodeMirror スタイル */
.CodeMirror {
  border: 1px solid #ccc;
  height: auto; /* 高さを自動調整 */
  flex-grow: 1; /* 残りのスペースを埋める */
  font-size: 14px;
}

#code-input {
  /* CodeMirrorを使わない場合の代替 */
  width: 100%;
  flex-grow: 1;
  font-family: monospace;
  font-size: 14px;
  border: 1px solid #ccc;
  box-sizing: border-box; /* paddingを含めて計算 */
}

#run-button {
  margin-top: 10px;
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
}

#run-button:hover {
  background-color: #0056b3;
}

#run-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

#output {
  white-space: pre-wrap; /* 長い行を折り返す */
  word-wrap: break-word; /* 単語の途中でも折り返す */
  background-color: #e9e9e9;
  padding: 10px;
  border-radius: 3px;
  flex-grow: 1; /* 残りのスペースを埋める */
  overflow-y: auto; /* 縦方向にスクロール可能に */
  font-family: monospace;
  font-size: 14px;
  color: #333;
}

#loading-indicator {
  margin-top: 10px;
  color: #666;
}
```

**3. JavaScript (`script.js`)**

```javascript
const codeInputTextArea = document.getElementById("code-input");
const outputArea = document.getElementById("output");
const runButton = document.getElementById("run-button");
const loadingIndicator = document.getElementById("loading-indicator");

let pyodide = null;
let editor = null; // CodeMirror instance

// --- CodeMirrorの初期化 ---
// CodeMirror を使う場合 (推奨)
editor = CodeMirror.fromTextArea(codeInputTextArea, {
  lineNumbers: true,
  mode: "python",
  theme: "material-darker", // 好みのテーマを選択
});

// CodeMirror を使わない場合 (textarea をそのまま使う)
// const editor = {
//     getValue: () => codeInputTextArea.value,
//     setValue: (value) => { codeInputTextArea.value = value; }
// };
// --- CodeMirrorの初期化ここまで ---

// --- Pyodideの初期化 ---
async function initializePyodide() {
  runButton.disabled = true; // 準備中は実行不可
  loadingIndicator.style.display = "block";
  outputArea.textContent = "Pyodide (Python実行環境) を読み込んでいます...\n";
  try {
    // indexURL を指定しない場合、pyodide.js と同じ場所から関連ファイルを読み込む
    pyodide = await loadPyodide();
    outputArea.textContent += "Pyodide の準備ができました。\n";

    // Python の標準出力・エラー出力を JavaScript で受け取る設定
    pyodide.setStdout({
      batched: (msg) => appendOutput(msg + "\n"),
    });
    pyodide.setStderr({
      batched: (msg) => appendOutput(`[Error] ${msg}\n`),
    });
  } catch (error) {
    outputArea.textContent += `Pyodideの読み込みに失敗しました: ${error}\n`;
    console.error("Pyodide loading failed:", error);
    return; // Pyodideがなければ実行できない
  } finally {
    loadingIndicator.style.display = "none";
    // Pyodideが正常にロードされたらボタンを有効化
    if (pyodide) {
      runButton.disabled = false;
      // URLパラメータからコードを読み込む
      loadCodeFromUrlParam();
    }
  }
}

// --- 出力エリアへの追記 ---
function appendOutput(message) {
  outputArea.textContent += message;
  outputArea.scrollTop = outputArea.scrollHeight; // 自動スクロール
}

// --- URLパラメータからコードを読み込む ---
function loadCodeFromUrlParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedCode = urlParams.get("code");
  if (encodedCode) {
    try {
      const decodedCode = decodeURIComponent(encodedCode);
      editor.setValue(decodedCode); // エディタに設定
      appendOutput("URLパラメータからコードを読み込みました。\n");
    } catch (e) {
      console.error("Failed to decode code from URL parameter:", e);
      appendOutput("[Error] URLパラメータのコードのデコードに失敗しました。\n");
    }
  } else {
    // デフォルトのコードを設定 (任意)
    editor.setValue(
      "print('Hello from Pyodide!')\n\nimport sys\nprint(f'Python version: {sys.version}')"
    );
  }
}

// --- コード実行処理 ---
async function runCode() {
  if (!pyodide) {
    appendOutput("Pyodideが準備できていません。\n");
    return;
  }

  const code = editor.getValue(); // エディタからコード取得
  if (!code.trim()) {
    appendOutput("実行するコードがありません。\n");
    return;
  }

  // 前回の出力をクリア (任意)
  // outputArea.textContent = '';

  appendOutput("--- 実行開始 ---\n");
  runButton.disabled = true; // 実行中はボタンを無効化

  try {
    // Pythonコードを実行 (非同期が良い場合が多い)
    await pyodide.runPythonAsync(code);
  } catch (error) {
    // Python実行時エラーをキャッチ
    appendOutput(`[Python Error] ${error.message}\n`);
    console.error("Python execution error:", error);
  } finally {
    appendOutput("--- 実行終了 ---\n");
    runButton.disabled = false; // 実行完了したらボタンを有効化
  }
}

// --- イベントリスナー ---
runButton.addEventListener("click", runCode);

// --- 初期化実行 ---
initializePyodide();
```

**解説:**

1.  **HTML:**
    - Pyodide の JS ファイルを CDN から読み込みます (`loadPyodide` 関数が使えるようになります)。
    - (推奨) CodeMirror (高機能なコードエディタライブラリ) の CSS と JS を CDN から読み込み、`textarea` を置き換えます。
    - コード入力用の `textarea` (または CodeMirror が表示される場所)、実行ボタン、結果表示用の `pre` タグ、ロード中表示を配置します。
    - 最後に自作の `script.js` を読み込みます。
2.  **CSS:**
    - 簡単な 2 カラムレイアウト（左: エディタ、右: 出力）を作成します。
    - CodeMirror や出力エリアのスタイルを設定します。
3.  **JavaScript:**
    - **`initializePyodide`:** ページ読み込み時に `loadPyodide()` を非同期で呼び出して Pyodide を初期化します。
    - **出力リダイレクト:** `pyodide.setStdout` と `pyodide.setStderr` を使い、Python の `print()` やエラー出力が `appendOutput` 関数経由で HTML の `pre` タグに表示されるように設定します。
    - **`loadCodeFromUrlParam`:** `URLSearchParams` を使って現在の URL から `code` パラメータを探します。見つかった場合は `decodeURIComponent` でデコードし、エディタの初期値として設定します。
      - 例: `https://your-page.com/?code=print(%22Hello%20from%20URL!%22)` のような URL でアクセスすると、`print("Hello from URL!")` がエディタに表示されます。
      - **注意:** URL にコードを含める場合、`encodeURIComponent()` を使ってコードをエンコードしたものを URL に含める必要があります。
    - **`runCode`:** 実行ボタンが押されたときの処理です。
      - エディタから現在のコードを取得します。
      - `pyodide.runPythonAsync(code)` を呼び出して Python コードを実行します。`runPythonAsync` を使うことで、Python 側で `await` を使った非同期処理も扱えます（単純なコードなら `runPython()` でも可）。
      - `try...catch` で Python 実行時のエラーを捕捉し、エラーメッセージを出力エリアに表示します。
    - **イベントリスナー:** 実行ボタンに `click` イベントリスナーを追加し、`runCode` 関数を呼び出すようにします。
    - **CodeMirror:** `CodeMirror.fromTextArea` を使って `textarea` をリッチなエディタに置き換えています。構文ハイライトや行番号が使えて便利です。

**デプロイ方法 (静的サイトホスティング)**

このアプリケーションは HTML, CSS, JavaScript ファイルのみで構成される「静的サイト」なので、デプロイは非常に簡単です。

1.  **ファイル準備:** 上記の `index.html`, `style.css`, `script.js` の 3 つのファイルを作成します。
2.  **ホスティング選択:** 以下のいずれかのサービスを利用するのが簡単でおすすめです（多くは無料プランがあります）。
    - **GitHub Pages:** GitHub リポジトリがあれば、無料で簡単に公開できます。
    - **Netlify:** Git リポジトリ（GitHub, GitLab, Bitbucket）と連携し、自動デプロイが可能です。ドラッグ＆ドロップでのデプロイも可能。
    - **Vercel:** Netlify と同様に Git 連携や自動デプロイが簡単です。
    - **Cloudflare Pages:** Git 連携、高速なグローバル CDN、無料枠が充実しています。
    - **Google Cloud Storage (GCS):** バケットを静的ウェブサイトホスティング用に設定します。別途、HTTPS 用にロードバランサや Cloudflare などを組み合わせることが一般的です。
    - **AWS S3:** GCS と同様に静的ウェブサイトホスティングが可能です。CloudFront と組み合わせて HTTPS 化や CDN 配信を行います。
3.  **デプロイ手順 (例: Netlify/Vercel/Cloudflare Pages/GitHub Pages):**
    - (推奨) プロジェクトを Git リポジトリ（例: GitHub）で管理します。
    - 選択したホスティングサービスのアカウントを作成し、Git リポジトリを連携します。
    - ビルド設定は通常不要です（静的ファイルなので）。
    - デプロイを実行すると、公開 URL が発行されます。

これで、バックエンドなしで Python コードを実行・結果表示でき、URL パラメータで初期コードを指定できる Web アプリケーションが完成します。
