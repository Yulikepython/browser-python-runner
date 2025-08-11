const codeInputTextArea = document.getElementById("code-input");
const outputArea = document.getElementById("output");
const runButton = document.getElementById("run-button");
const preloadButton = document.getElementById("preload-button");
const loadingIndicator = document.getElementById("loading-indicator");

let pyodide = null;
let editor = null; // CodeMirror instance

// --- アップロード関連の設定 ---
const MAX_FILE_SIZE_MB = 20;  // 1ファイルの上限
const MAX_TOTAL_SIZE_MB = 100; // /tmp の合計使用量目安

// --- CodeMirrorの初期化（CDNが読めない場合にフォールバック） ---
try {
  if (window.CodeMirror) {
    // CodeMirror を使う場合 (推奨)
    editor = CodeMirror.fromTextArea(codeInputTextArea, {
      lineNumbers: true,
      mode: "python",
      theme: "material-darker", // 好みのテーマを選択
    });
  } else {
    throw new Error("CodeMirror is not available");
  }
} catch (e) {
  console.warn("CodeMirror 初期化に失敗しました。プレーンなテキストエリアにフォールバックします。", e);
  // 最低限の互換APIを提供
  editor = {
    getValue: () => codeInputTextArea.value,
    setValue: (v) => {
      codeInputTextArea.value = v;
    },
  };
  // 可能ならUIにも通知
  try {
    const out = document.getElementById("output");
    if (out) {
      out.textContent += "[Warning] CodeMirrorの読み込みに失敗したため、プレーンなテキストエリアで動作します。ネットワークやCDNのブロックを確認してください。\n";
    }
  } catch (_) {}
}

// リソース読み込みエラーを拾って表示（CDN失敗の可視化）
window.addEventListener('error', (ev) => {
  try {
    if (!outputArea) return;
    const msg = ev?.message || ev?.error?.message || String(ev);
    if (msg) {
      outputArea.textContent += `[Error] スクリプト/リソースの読み込みで問題が発生: ${msg}\n`;
    }
  } catch (_) {}
}, true);

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

    // Pyodideの公式パッケージに無い純Python依存はmicropipで補完（例: openpyxl, xlrd）
    try {
      await ensurePurePythonPackages(code);
    } catch (pipErr) {
      appendOutput(`[Warning] 依存パッケージのインストールに失敗: ${pipErr}\n`);
      console.warn("Micropip install failed:", pipErr);
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

// --- ファイル入力: ローカルのExcel(.xlsx)をPyodideの仮想FSへ ---
function setupFileLoader() {
  const input = document.getElementById('file-input');
  const clearBtn = document.getElementById('clear-tmp-button');
  const usageDisplay = document.getElementById('usage-display');
  if (input) {
    input.addEventListener('change', async (e) => {
      try {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!pyodide) {
          appendOutput("Pyodideが準備できていません。\n");
          return;
        }

        // 1ファイルのサイズチェック
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          appendOutput(`[Error] ファイルが大きすぎます (${fileSizeMB.toFixed(2)} MB)。上限は ${MAX_FILE_SIZE_MB} MB です。\n`);
          return;
        }

        // /tmp ディレクトリ確保
        try { pyodide.FS.mkdir('/tmp'); } catch (_) {}

        // 受け取ったファイルをPyodideの仮想FSへ保存
        const buf = new Uint8Array(await file.arrayBuffer());
        const mountPath = `/tmp/${file.name}`;
        pyodide.FS.writeFile(mountPath, buf);
        appendOutput(`アップロード完了: ${mountPath}\n`);

        // 内容がZipベース(.xlsx)かの簡易チェック（PK\x.. シグネチャ）
        const isZipLike = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.xlsx') && !isZipLike) {
          appendOutput('[Warning] 拡張子は .xlsx ですが、Zip形式ではないため壊れているか .xls/.csv の可能性があります。Excelで「別名で保存」→「Excel ブック (*.xlsx)」で保存し直してください。\n');
        }

        // エディタへサンプルコードを挿入（上書きはしない。先頭に追記）
        const hint = [
          '# ファイルを自動判別して読み込むサンプル',
          'import pandas as pd',
          'from pathlib import Path',
          'import zipfile',
          '# .xlsx を扱う場合は openpyxl が必要',
          'try:\n    import openpyxl  # noqa: F401\nexcept Exception:\n    pass',
          `path = r"${mountPath}"`,
          '',
          'def read_table_auto(path: str) -> pd.DataFrame:',
          '    p = Path(path)',
          "    ext = p.suffix.lower()",
          "    if ext == '.xlsx':",
          "        # Zipシグネチャを簡易確認",
          "        with open(path, 'rb') as f:\n            head = f.read(4)",
          "        if not (len(head) >= 2 and head[0] == 0x50 and head[1] == 0x4B):",
          "            # 見かけは .xlsx だが中身がZipでない場合、CSVとしてフォールバック",
          "            try:\n                df_csv = pd.read_csv(path, engine='python', sep=None)\n                print('[Warning] 拡張子は .xlsx ですがCSVとして読み込みました。正しい形式で保存し直すことをおすすめします。')\n                return df_csv\n            except Exception as _e:\n                raise zipfile.BadZipFile('Not a zip-based .xlsx (possibly .xls or csv)') from _e",
          "        return pd.read_excel(path, engine='openpyxl')",
          "    elif ext == '.xls':",
          "        # 古いExcel形式。xlrd が必要（v2以降は .xls 非対応のため注意）",
          "        try:\n            import xlrd  # noqa: F401\n        except Exception as e:\n            raise RuntimeError('xls 読み込みには xlrd が必要です。可能なら .xlsx に保存し直してください。') from e",
          "        return pd.read_excel(path, engine='xlrd')",
          "    else:",
          "        # 最後はcsvとして試す",
          "        return pd.read_csv(path, engine='python', sep=None)",
          '',
          'try:',
          '    df = read_table_auto(path)',
          '    print(df.head())',
          'except zipfile.BadZipFile as e:',
          "    print('[Error] このファイルは有効な .xlsx ではありません。多くの場合、.xls を .xlsx にリネームした時に発生します。Excelで .xlsx として保存し直してください。')",
          '    # CSVとしての読み込みにも失敗したため終了',
          ''
        ].join("\n");
        const current = editor.getValue();
        editor.setValue(hint + current);
        updateUsageDisplay(usageDisplay);
        const totalMB = getDirSizeBytes('/tmp') / (1024 * 1024);
        if (totalMB > MAX_TOTAL_SIZE_MB) {
          appendOutput(`[Warning] /tmp の合計使用量が ${totalMB.toFixed(2)} MB です。目安の ${MAX_TOTAL_SIZE_MB} MB を超えています。\n`);
        }
      } catch (err) {
        console.error('ファイルの取り込みに失敗:', err);
        appendOutput(`[Error] ファイルの取り込みに失敗: ${err}\n`);
      } finally {
        // 同じファイル選択でchangeが発火しないのを防ぐためリセット
        e.target.value = '';
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!pyodide) {
        appendOutput("Pyodideが準備できていません。\n");
        return;
      }
      try {
        clearTmpDir();
        appendOutput("/tmp をクリアしました。\n");
      } catch (e) {
        appendOutput(`[Error] /tmp のクリアに失敗: ${e}\n`);
        console.error(e);
      } finally {
        updateUsageDisplay(usageDisplay);
      }
    });
  }

  // 初期表示
  updateUsageDisplay(usageDisplay);
}

window.addEventListener('load', setupFileLoader);

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

// --- 純Pythonパッケージの自動インストール（micropip） ---
async function ensurePurePythonPackages(code) {
  // 参照検出（ゆるめ）：openpyxl / xlrd
  const needsOpenpyxl = /\bimport\s+openpyxl\b|\bfrom\s+openpyxl\s+import\b|engine\s*=\s*['\"]openpyxl['\"]/i.test(code);
  const needsXlrd = /\bimport\s+xlrd\b|\bfrom\s+xlrd\s+import\b|engine\s*=\s*['\"]xlrd['\"]/i.test(code);
  if (!needsOpenpyxl && !needsXlrd) return;

  // micropip をロード
  await pyodide.loadPackage('micropip');

  const pkgs = [];
  if (needsOpenpyxl) pkgs.push('openpyxl');
  // xlrd 2.x は .xls を読めないため、互換性の高い 1.2.0 を指定
  if (needsXlrd) pkgs.push('xlrd==1.2.0');
  if (!pkgs.length) return;

  // 既にインポート可能ならスキップ。Pyodideではトップレベルawaitが使える。
  const py = [
    'import importlib',
    'import micropip',
    `pkgs = ${JSON.stringify(pkgs)}`,
    'for p in pkgs:',
    '    try:',
    '        importlib.import_module(p)',
    '        continue',
  '    except Exception:',
  '        pass',
    '    try:',
    '        await micropip.install(p)',
    '    except Exception as e:',
    '        print(f"[Warning] micropip install failed for {p}: {e}")'
  ].join('\n');
  await pyodide.runPythonAsync(py);
}

// --- /tmp 使用量表示・ユーティリティ ---
function updateUsageDisplay(labelEl) {
  if (!labelEl || !pyodide) return;
  let bytes = 0;
  try {
    bytes = getDirSizeBytes('/tmp');
  } catch (_) {
    bytes = 0;
  }
  labelEl.textContent = `使用量: ${formatBytes(bytes)}`;
}

function getDirSizeBytes(path) {
  const FS = pyodide.FS;
  let total = 0;
  function walk(p) {
    let stat;
    try { stat = FS.stat(p); } catch { return; }
    if (FS.isDir(stat.mode)) {
      let entries = [];
      try { entries = FS.readdir(p); } catch { entries = []; }
      for (const name of entries) {
        if (name === '.' || name === '..') continue;
        walk(`${p}/${name}`);
      }
    } else if (FS.isFile(stat.mode)) {
      total += stat.size || 0;
    }
  }
  walk(path);
  return total;
}

function clearTmpDir() {
  const FS = pyodide.FS;
  try { FS.mkdir('/tmp'); } catch (_) {}
  function rmrf(p) {
    let stat;
    try { stat = FS.stat(p); } catch { return; }
    if (FS.isDir(stat.mode)) {
      let entries = [];
      try { entries = FS.readdir(p); } catch { entries = []; }
      for (const name of entries) {
        if (name === '.' || name === '..') continue;
        rmrf(`${p}/${name}`);
      }
      if (p !== '/tmp') {
        try { FS.rmdir(p); } catch (_) {}
      }
    } else if (FS.isFile(stat.mode)) {
      try { FS.unlink(p); } catch (_) {}
    }
  }
  rmrf('/tmp');
}

function formatBytes(bytes) {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }
  const units = ['KB','MB','GB','TB'];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(2) + ' ' + units[u];
}