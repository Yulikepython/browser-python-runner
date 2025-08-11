const codeInputTextArea = document.getElementById("code-input");
const outputArea = document.getElementById("output");
const runButton = document.getElementById("run-button");
const preloadButton = document.getElementById("preload-button");
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
      batched: (msg) => {
        // 受信ブロック全体でフィルタリング
        const text = String(msg).trim();
        if (!text) return;
        // 1) 警告は表示しない（UIに出さない方針）
        if (/\bwarning\b/i.test(text)) {
          return;
        }
        // 2) pandas の pyarrow 告知はノイズとして非表示
        if (/pyarrow will become a required dependency of pandas/i.test(text)) {
          return;
        }
        // 上記以外はエラーとして表示
        appendOutput(`[Error] ${text}\n`);
      },
    });

  // 警告全般の抑制（UIに出さない方針のため）
    try {
      pyodide.runPython(
        [
      "import warnings",
      "# ライブラリを問わず、将来互換系の警告を全面的に非表示",
      "warnings.filterwarnings('ignore', category=DeprecationWarning)",
      "warnings.filterwarnings('ignore', category=FutureWarning)",
      "warnings.filterwarnings('ignore', category=ResourceWarning)",
      "# pandas の pyarrow 告知メッセージをパターンで非表示（モジュール指定なし）",
      "warnings.filterwarnings('ignore', message=r'(?i).*pyarrow will become a required dependency of pandas.*')",
        ].join("\n")
      );
    } catch (werr) {
      console.warn("Failed to set warning filters:", werr);
    }
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
  const isBase64 = urlParams.get("base64") === "true";
  
  if (encodedCode) {
    try {
      let decodedCode;
      
      if (isBase64) {
        // Base64エンコードされたコードをデコード
        try {
          // UTF-8バイト配列としてデコード
          const binaryString = atob(encodedCode);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // UTF-8バイト配列から文字列に変換
          decodedCode = new TextDecoder().decode(bytes);
        } catch (e) {
          console.error("UTF-8 Base64デコードに失敗しました:", e);
          // フォールバック：単純なbase64デコードを試みる
          decodedCode = atob(encodedCode);
        }
        appendOutput("Base64形式のURLパラメータからコードを読み込みました。\n");
      } else {
        // 通常のURLエンコードされたコードをデコード
        decodedCode = decodeURIComponent(encodedCode);
        appendOutput("URLパラメータからコードを読み込みました。\n");
      }
      
      editor.setValue(decodedCode); // エディタに設定
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

// Base64エンコード用のヘルパー関数（コードをコピーするボタン用）
function getBase64CodeUrl() {
  const code = editor.getValue();
  
  // UTF-8文字列をBase64エンコードする（日本語などの非ASCII文字に対応）
  let base64Code;
  try {
    // モダンな方法: TextEncoder + btoa
    const encoder = new TextEncoder();
    const bytes = encoder.encode(code);
    base64Code = btoa(
      Array.from(bytes)
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
  } catch (e) {
    // エラーが発生した場合はURLエンコードを使用
    console.error("Base64エンコードに失敗しました:", e);
    const url = new URL(window.location.href);
    url.searchParams.set("code", encodeURIComponent(code));
    url.searchParams.delete("base64"); // base64フラグを削除
    return url.href;
  }
  
  const url = new URL(window.location.href);
  url.searchParams.set("code", base64Code);
  url.searchParams.set("base64", "true");
  return url.href;
}

// URLをコピーするボタン用の関数 (互換性のある方法)
function copyCodeUrl() {
  const url = getBase64CodeUrl();
  
  // モダンブラウザならClipboard APIを使用
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => {
        // 成功メッセージを表示
        const originalText = document.getElementById("share-button").textContent;
        document.getElementById("share-button").textContent = "URLをコピーしました！";
        setTimeout(() => {
          document.getElementById("share-button").textContent = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error("URLのコピーに失敗しました:", err);
        // フォールバックとして従来の方法を試す
        copyCodeUrlFallback(url);
      });
  } else {
    // 古いブラウザでは従来の方法を使用
    copyCodeUrlFallback(url);
  }
}

// URLコピーのフォールバック処理 (古いブラウザ向け)
function copyCodeUrlFallback(url) {
  // テキストエリアを作成して、URLをコピー
  const textArea = document.createElement("textarea");
  textArea.value = url;
  textArea.style.position = "fixed";  // ビューの外側に配置
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      // 成功メッセージを表示
      const originalText = document.getElementById("share-button").textContent;
      document.getElementById("share-button").textContent = "URLをコピーしました！";
      setTimeout(() => {
        document.getElementById("share-button").textContent = originalText;
      }, 2000);
    } else {
      console.error("URLのコピーに失敗しました");
      alert("URLのコピーに失敗しました");
    }
  } catch (err) {
    console.error("URLのコピーに失敗しました:", err);
    alert("URLのコピーに失敗しました");
  }

  // クリーンアップ
  document.body.removeChild(textArea);
}

// --- コードを適切な形式でクリップボードにコピーする ---
function copyCodeToClipboard() {
  const code = editor.getValue();
  
  // テキストエリアを作成して、改行を保持したまま正しくコピー
  const textArea = document.createElement("textarea");
  textArea.value = code;
  textArea.style.position = "fixed";  // ビューの外側に配置
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      // 成功メッセージを表示
      const originalText = document.getElementById("copy-button").textContent;
      document.getElementById("copy-button").textContent = "コピーしました！";
      setTimeout(() => {
        document.getElementById("copy-button").textContent = originalText;
      }, 2000);
    } else {
      console.error("コピーに失敗しました");
    }
  } catch (err) {
    console.error("コピーに失敗しました:", err);
  }

  // クリーンアップ
  document.body.removeChild(textArea);
}

// --- モダンブラウザ向けのクリップボード機能 ---
// 古いdocument.execCommandの代わりにClipboard APIを使う場合
function copyCodeModern() {
  const code = editor.getValue();
  navigator.clipboard.writeText(code)
    .then(() => {
      // 成功メッセージを表示
      const originalText = document.getElementById("copy-button").textContent;
      document.getElementById("copy-button").textContent = "コピーしました！";
      setTimeout(() => {
        document.getElementById("copy-button").textContent = originalText;
      }, 2000);
    })
    .catch(err => {
      console.error("クリップボードのコピーに失敗しました:", err);
      // フォールバックとして従来の方法を試す
      copyCodeToClipboard();
    });
}

// --- 最適なコピー機能を選択してセットアップ ---
function setupCopyFunction() {
  // ボタン参照を取得
  const copyButton = document.getElementById("copy-button");
  
  // ボタンのイベントリスナーをセットアップ
  if (copyButton) {
    if (navigator.clipboard) {
      copyButton.onclick = copyCodeModern;  // モダンなClipboard APIを優先
    } else {
      copyButton.onclick = copyCodeToClipboard;  // 従来のexecCommandを使用
    }
  }
  
  // 共有URLボタンのイベントリスナーはHTMLに直接記述されているためここでは変更しない
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
    // ユーザーコードの import から必要な Pyodide パッケージを自動で読み込む
    // 例: import pandas as pd -> pandas と依存パッケージ(numpy等)を自動取得
    try {
      const loaded = await pyodide.loadPackagesFromImports(code);
      if (loaded && loaded.length) {
        // 返却値がオブジェクト列のケースに対応して人間可読に整形
        const names = loaded.map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.name || item.package || item.package_name || JSON.stringify(item);
          }
          return String(item);
        });
        appendOutput(`パッケージを読み込みました: ${names.join(', ')}\n`);
      }
    } catch (pkgErr) {
      // パッケージ解析/取得に失敗してもコード実行は試みる
      appendOutput(`[Warning] パッケージの読み込みに失敗: ${pkgErr}\n`);
      console.warn("Package load failed:", pkgErr);
    }

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
// コピー機能をセットアップ
window.addEventListener('load', setupCopyFunction);

// --- よく使うライブラリを事前に読み込む（プリロード） ---
async function preloadCommonPackages() {
  if (!pyodide) {
    appendOutput("Pyodideが準備できていません。\n");
    return;
  }
  const common = [
    // 需要の高い順に調整可能
    "micropip", // 将来的なwheelインストール対応を見据え
    "numpy",
    "pandas",
    "matplotlib",
  ];
  preloadButton.disabled = true;
  appendOutput(`プリロード開始: ${common.join(', ')}\n`);
  try {
    await pyodide.loadPackage(common);
    appendOutput("プリロード完了\n");
  } catch (e) {
    appendOutput(`[Warning] プリロードに失敗: ${e}\n`);
    console.warn("Preload failed:", e);
  } finally {
    preloadButton.disabled = false;
  }
}

if (preloadButton) {
  preloadButton.addEventListener('click', preloadCommonPackages);
}