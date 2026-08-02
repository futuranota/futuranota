const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".xml",
  ".log",
  ".rtf",
  ".sql",
  ".yml",
  ".yaml",
  ".tsv",
  ".css",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
];

export const KNOWLEDGE_FILE_ACCEPT = [
  ".pdf",
  ...TEXT_EXTENSIONS,
  "text/*",
  "application/pdf",
  "application/sql",
].join(",");

export const FLOPPY_DISK_ICON = "/uploads/botones/FloppyDisk.svg";

function stripExtension(name) {
  const base = String(name || "").trim();
  const extPattern = new RegExp(
    `(${[".pdf", ...TEXT_EXTENSIONS].map((e) => e.replace(".", "\\.")).join("|")})$`,
    "i",
  );
  return base.replace(extPattern, "").trim();
}

function fileExtension(name) {
  const match = /\.([^.]+)$/i.exec(String(name || ""));
  return match ? `.${match[1].toLowerCase()}` : "";
}

function resolveImportKind(file) {
  const lower = (file.name || "").toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "text";
  if (file.type?.startsWith("text/")) return "text";
  return null;
}

/** @typedef {{ fileName: string, mimeType: string, extension: string, importedAt: string, sizeBytes: number }} KnowledgeImportMeta */

/** @param {unknown} value @returns {KnowledgeImportMeta | null} */
export function normalizeKnowledgeImport(value) {
  if (!value || typeof value !== "object") return null;
  const fileName = String(value.fileName ?? "").trim();
  if (!fileName) return null;
  return {
    fileName,
    mimeType: String(value.mimeType ?? "").trim(),
    extension: String(value.extension ?? "").trim(),
    importedAt: value.importedAt || new Date().toISOString(),
    sizeBytes: typeof value.sizeBytes === "number" ? value.sizeBytes : 0,
  };
}

export function hasKnowledgeImport(docOrMeta) {
  if (!docOrMeta) return false;
  const raw = docOrMeta.knowledgeImport ?? docOrMeta;
  return Boolean(normalizeKnowledgeImport(raw));
}

/** True when the user has typed a summary in the notes area (not the imported file). */
export function knowledgeNotesHasContent(body = "", blocks = null, docBlocksToBodyFn = null) {
  if (String(body ?? "").trim()) return true;
  if (!blocks?.length) return false;
  if (typeof docBlocksToBodyFn === "function") {
    return Boolean(docBlocksToBodyFn(blocks).trim());
  }
  return blocks.some((block) => {
    const text = block?.text ?? block?.content ?? "";
    return String(text).trim().length > 0;
  });
}

export function formatKnowledgeFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Import a file onto a knowledge doc.
 * Text-based files (.md, .sql, …) return readable `textContent` for the doc body.
 * PDF stores metadata only (no client-side extract yet).
 *
 * @returns {Promise<{ title: string, knowledgeImport: KnowledgeImportMeta, textContent?: string }>}
 */
export async function importKnowledgeFile(file) {
  if (!file) throw new Error("No file selected");
  const kind = resolveImportKind(file);
  if (!kind) {
    throw new Error(
      "Unsupported file type. Use PDF or a text-based file (.txt, .md, .sql, .csv, …)",
    );
  }

  const fileName = file.name || "document";
  const knowledgeImport = {
    fileName,
    mimeType: file.type || "",
    extension: fileExtension(fileName) || (kind === "pdf" ? ".pdf" : ".txt"),
    importedAt: new Date().toISOString(),
    sizeBytes: file.size ?? 0,
  };

  let textContent = "";
  if (kind === "text") {
    try {
      textContent = String(await file.text() || "").trim();
    } catch {
      textContent = "";
    }
  }

  return {
    title: stripExtension(fileName) || "Untitled",
    knowledgeImport,
    ...(textContent ? { textContent } : {}),
  };
}
