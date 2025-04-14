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