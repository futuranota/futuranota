/**
 * Live preview helpers for /code blocks (HTML / CSS / JS → sandboxed iframe).
 */

const PREVIEWABLE = new Set(["html", "css", "javascript"]);

/** @param {string} language */
export function isCodePreviewable(language) {
  return PREVIEWABLE.has(String(language || "").toLowerCase());
}

/** Prevent early close of <script>/<style> when injecting user source. */
function escapeEmbedded(source) {
  return String(source ?? "")
    .replace(/<\/(script|style)/gi, "<\\/$1");
}

/**
 * Build a full HTML document for iframe srcDoc.
 * @param {string} language
 * @param {string} code
 * @returns {string}
 */
export function buildCodePreviewSrcDoc(language, code) {
  const lang = String(language || "").toLowerCase();
  const raw = String(code ?? "");
  const safe = escapeEmbedded(raw);
  const baseStyles = `
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body {
      box-sizing: border-box;
      padding: 16px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.45;
      color: #1a1a1a;
      background: #ffffff;
    }
    *, *::before, *::after { box-sizing: border-box; }
  `;

  if (lang === "css") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}${safe}</style></head>
<body>
  <div class="preview-root">
    <h1>Heading</h1>
    <p>Sample paragraph for your CSS.</p>
    <button type="button">Button</button>
    <ul><li>List item</li><li>List item</li></ul>
  </div>
</body></html>`;
  }

  if (lang === "javascript") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}
      #out { white-space: pre-wrap; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    </style></head>
<body>
  <div id="app"></div>
  <pre id="out"></pre>
  <script>
    (function () {
      var out = document.getElementById("out");
      var log = function () {
        var parts = Array.prototype.slice.call(arguments).map(function (v) {
          try { return typeof v === "string" ? v : JSON.stringify(v); }
          catch (e) { return String(v); }
        });
        out.textContent += parts.join(" ") + "\\n";
      };
      console.log = log;
      console.warn = log;
      console.error = log;
      try {
        ${safe}
      } catch (err) {
        out.textContent += String(err && err.message ? err.message : err);
      }
    })();
  </script>
</body></html>`;
  }

  // html (default previewable)
  const trimmed = raw.trim();
  const looksFull = /<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
  if (looksFull) return raw;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head>
<body>${raw}</body></html>`;
}
