import { convertImageSourceToWebp } from "./convertImageToWebp.js";

/** Matches `[Imagen Calendar]()` or `[Imagen Calendar](/uploads/foo.svg)`. */
export const PLAYBOOK_IMAGE_COMMAND_RE = /^\[Imagen\s+([^\]]+)\]\(([^)]*)\)\s*$/i;

/**
 * Default reference assets per playbook section label.
 * Override the path in the command when you need a different source file.
 * @type {Record<string, string>}
 */
export const PLAYBOOK_IMAGE_REFERENCES = {
  product: "/uploads/product.png",
  idea: "/uploads/idea.jpg",
};

/**
 * @param {string} label
 */
export function normalizePlaybookImageLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/**
 * @param {string} label
 * @returns {string|null}
 */
export function resolvePlaybookImageReference(label) {
  const normalized = normalizePlaybookImageLabel(label);
  if (!normalized) return null;

  if (PLAYBOOK_IMAGE_REFERENCES[normalized]) {
    return PLAYBOOK_IMAGE_REFERENCES[normalized];
  }

  const fuzzy = Object.entries(PLAYBOOK_IMAGE_REFERENCES).find(([key]) =>
    normalized.includes(key) || key.includes(normalized),
  );
  return fuzzy?.[1] || null;
}

/**
 * @param {string} line
 * @returns {{ label: string, src: string, raw: string }|null}
 */
export function parsePlaybookImageCommand(line) {
  const match = String(line || "").trim().match(PLAYBOOK_IMAGE_COMMAND_RE);
  if (!match) return null;

  const label = match[1].trim();
  const explicitSrc = match[2].trim();
  const src = explicitSrc || resolvePlaybookImageReference(label) || "";

  return { label, src, raw: match[0] };
}

/**
 * Build the markdown command used in playbook files.
 * @param {string} label
 * @param {string} [src]
 */
export function formatPlaybookImageCommand(label, src = "") {
  const safeLabel = String(label || "").trim();
  const safeSrc = String(src || "").trim();
  return `[Imagen ${safeLabel}](${safeSrc})`;
}

/**
 * SVG assets keep their URL — rasterizing complex SVGs (patterns, filters) often fails in canvas.
 * Raster formats still convert to embedded webp for persistence.
 * @param {{ label: string, src: string }} command
 * @param {{ quality?: number }} [options]
 * @returns {Promise<{ alt: string, src: string, width: number, height: number, markdown: string }|null>}
 */
export async function insertPlaybookImageFromCommand(command, options = {}) {
  const label = command?.label?.trim();
  const src = command?.src?.trim();
  if (!label || !src) return null;

  const useDirectSrc = /^\/uploads\//i.test(src)
    || /\.(svg|jpe?g|png|webp)(\?.*)?$/i.test(src);
  if (useDirectSrc) {
    const markdown = `![${label}](${src})`;
    return { alt: label, src, width: 0, height: 0, markdown };
  }

  const converted = await convertImageSourceToWebp(src, {
    quality: options.quality,
    fileName: normalizePlaybookImageLabel(label) || "image",
    idPrefix: "PBIMG",
  });

  const resolvedSrc = converted?.src || src;
  const markdown = `![${label}](${resolvedSrc})`;
  return {
    alt: label,
    src: resolvedSrc,
    width: converted?.width || 0,
    height: converted?.height || 0,
    markdown,
  };
}

/**
 * Replaces `[Imagen …](…)` lines with markdown images backed by webp data URLs.
 * @param {string} text
 * @param {{ quality?: number, onError?: (command: { label: string, src: string }, error?: unknown) => void }} [options]
 * @returns {Promise<string>}
 */
export async function resolvePlaybookImageCommandsInText(text, options = {}) {
  const lines = String(text || "").split("\n");
  /** @type {string[]} */
  const next = [];

  for (const line of lines) {
    const command = parsePlaybookImageCommand(line);
    if (!command) {
      next.push(line);
      continue;
    }

    if (!command.src) {
      options.onError?.({ label: command.label, src: "" });
      next.push(line);
      continue;
    }

    try {
      const inserted = await insertPlaybookImageFromCommand(command, options);
      if (inserted?.markdown) {
        next.push(inserted.markdown);
      } else {
        options.onError?.({ label: command.label, src: command.src });
        next.push(`![${command.label}](${command.src})`);
      }
    } catch (error) {
      options.onError?.({ label: command.label, src: command.src }, error);
      next.push(`![${command.label}](${command.src})`);
    }
  }

  return next.join("\n");
}
