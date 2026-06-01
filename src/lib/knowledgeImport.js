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
];

export const KNOWLEDGE_FILE_ACCEPT = [
  ".pdf",
  ...TEXT_EXTENSIONS,
  "text/*",
  "application/pdf",
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
 * Register an uploaded file on a knowledge doc (metadata only — does not fill the text area).
 * @returns {Promise<{ title: string, knowledgeImport: KnowledgeImportMeta }>}
 */
export async function importKnowledgeFile(file) {
  if (!file) throw new Error("No file selected");
  const kind = resolveImportKind(file);
  if (!kind) {
    throw new Error("Unsupported file type. Use PDF or a text-based file (.txt, .md, .csv, …)");
  }

  const fileName = file.name || "document";
  return {
    title: stripExtension(fileName) || "Untitled",
    knowledgeImport: {
      fileName,
      mimeType: file.type || "",
      extension: fileExtension(fileName) || (kind === "pdf" ? ".pdf" : ".txt"),
      importedAt: new Date().toISOString(),
      sizeBytes: file.size ?? 0,
    },
  };
}
