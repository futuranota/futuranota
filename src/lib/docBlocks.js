import { generateId } from "./ids.js";
import { NO_NODE_LINK_COLOR_ID, normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import { normalizeAnchorFields } from "./nodeAnchor.js";

const DOC_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  TODO: "todo",
  DATE: "date",
  METRIC: "metric",
  PRODUCT_CARD: "product_card",
};

const DEFAULT_CHECKBOX_LIST_TITLE = "Checkbox:";

export function createTodoItem(patch = {}) {
  return {
    id: generateId("TODO"),
    text: "",
    checked: false,
    ...patch,
  };
}

function normalizeDateContent(block) {
  if (block.date != null || block.time != null) {
    return { date: block.date || "", time: block.time || "" };
  }
  if (block.content && typeof block.content === "object") {
    return { date: block.content.date || "", time: block.content.time || "" };
  }
  return { date: "", time: "" };
}

function normalizeMetricContent(block) {
  if (block.value != null || block.unit != null) {
    return { value: block.value ?? "", unit: block.unit || "" };
  }
  if (block.content && typeof block.content === "object") {
    return { value: block.content.value ?? "", unit: block.content.unit || "" };
  }
  return { value: "", unit: "" };
}

function normalizeProductCard(block) {
  const specs = block?.specs && typeof block.specs === "object" ? block.specs : {};
  const dims = specs.dimensions && typeof specs.dimensions === "object" ? specs.dimensions : {};
  const images = Array.isArray(block?.images) ? block.images : [];
  return {
    title: block?.title || "ProductCard",
    specs: {
      category: specs.category || "",
      partNumber: specs.partNumber || "",
      dimensions: {
        x: dims.x || "",
        y: dims.y || "",
        z: dims.z || "",
        xUnit: dims.xUnit || "",
        yUnit: dims.yUnit || "",
        zUnit: dims.zUnit || "",
      },
      material: specs.material || "",
      mountingPointDistance: specs.mountingPointDistance || "",
    },
    images: images
      .map((img) => (img && typeof img === "object"
        ? {
            id: img.id || generateId("PRDIMG"),
            src: img.src || "",
            name: img.name || "image.webp",
          }
        : null))
      .filter(Boolean),
    activeImageIndex:
      Number.isInteger(block?.activeImageIndex) && block.activeImageIndex >= 0
        ? block.activeImageIndex
        : 0,
    specsSaved: Boolean(block?.specsSaved),
  };
}

export function createDocBlock(type = DOC_BLOCK_TYPES.TEXT, patch = {}) {
  const id = patch.id || generateId("BLK");
  const base = { id };

  if (type === DOC_BLOCK_TYPES.H1) {
    return {
      ...base,
      type: DOC_BLOCK_TYPES.H1,
      title: "",
      queryEnabled: false,
      nodeLinkColor: NO_NODE_LINK_COLOR_ID,
      ...patch,
    };
  }

  if (type === DOC_BLOCK_TYPES.TODO) {
    const items = patch.items || [createTodoItem()];
    return {
      ...base,
      type: DOC_BLOCK_TYPES.TODO,
      listTitle: patch.listTitle ?? DEFAULT_CHECKBOX_LIST_TITLE,
      items,
      showIntroAnim: false,
      queryEnabled: false,
      nodeLinkColor: NO_NODE_LINK_COLOR_ID,
      ...patch,
    };
  }

  if (type === DOC_BLOCK_TYPES.DATE) {
    const { date, time } = normalizeDateContent(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.DATE,
      title: patch.title || "",
      date,
      time,
      nodeId: patch.nodeId,
      sourceQuery: patch.sourceQuery,
    };
  }

  if (type === DOC_BLOCK_TYPES.METRIC) {
    const { value, unit } = normalizeMetricContent(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.METRIC,
      title: patch.title || "",
      value,
      unit,
      nodeId: patch.nodeId,
      sourceQuery: patch.sourceQuery,
    };
  }

  if (type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    const normalized = normalizeProductCard(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.PRODUCT_CARD,
      ...normalized,
    };
  }

  return { ...base, type: DOC_BLOCK_TYPES.TEXT, text: "", ...patch };
}

export function normalizeDocBlock(block) {
  if (!block || typeof block !== "object") return createDocBlock();

  const type = block.type || DOC_BLOCK_TYPES.TEXT;

  if (type === DOC_BLOCK_TYPES.H1) {
    const anchor = normalizeAnchorFields(block);
    const queryEnabled = Boolean(block.queryEnabled ?? block.nodeId);
    return createDocBlock(DOC_BLOCK_TYPES.H1, {
      id: block.id,
      title: block.title || "",
      nodeId: block.nodeId || undefined,
      sourceQuery: block.sourceQuery || undefined,
      anchorDate: anchor.anchorDate,
      anchorTime: anchor.anchorTime,
      anchorFromNode: Boolean(block.anchorFromNode),
      queryEnabled,
      nodeLinkColor: block.nodeLinkColor != null
        ? normalizeNodeLinkColorId(block.nodeLinkColor)
        : NO_NODE_LINK_COLOR_ID,
    });
  }

  if (type === DOC_BLOCK_TYPES.TODO) {
    const rawItems = Array.isArray(block.items) ? block.items : [];
    const items =
      rawItems.length > 0
        ? rawItems.map((item) =>
            createTodoItem({
              id: item.id,
              text: item.text || "",
              checked: Boolean(item.checked),
            }),
          )
        : [createTodoItem()];
    const anchor = normalizeAnchorFields(block);
    const queryEnabled = Boolean(block.queryEnabled ?? block.nodeId);
    return createDocBlock(DOC_BLOCK_TYPES.TODO, {
      id: block.id,
      listTitle: block.listTitle ?? DEFAULT_CHECKBOX_LIST_TITLE,
      items,
      nodeId: block.nodeId || undefined,
      sourceQuery: block.sourceQuery || undefined,
      anchorDate: anchor.anchorDate,
      anchorTime: anchor.anchorTime,
      anchorFromNode: Boolean(block.anchorFromNode),
      showIntroAnim: false,
      queryEnabled,
      nodeLinkColor: block.nodeLinkColor != null
        ? normalizeNodeLinkColorId(block.nodeLinkColor)
        : NO_NODE_LINK_COLOR_ID,
    });
  }

  if (type === DOC_BLOCK_TYPES.DATE) {
    const { date, time } = normalizeDateContent(block);
    return createDocBlock(DOC_BLOCK_TYPES.DATE, {
      id: block.id,
      title: block.title || "",
      date,
      time,
      nodeId: block.nodeId || undefined,
      sourceQuery: block.sourceQuery || undefined,
    });
  }

  if (type === DOC_BLOCK_TYPES.METRIC) {
    const { value, unit } = normalizeMetricContent(block);
    return createDocBlock(DOC_BLOCK_TYPES.METRIC, {
      id: block.id,
      title: block.title || "",
      value,
      unit,
      nodeId: block.nodeId || undefined,
      sourceQuery: block.sourceQuery || undefined,
    });
  }

  if (type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    return createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, {
      id: block.id,
      ...normalizeProductCard(block),
    });
  }

  return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
    id: block.id,
    text: block.text || "",
  });
}

function mergeAdjacentTextBlocks(blocks) {
  const merged = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (
      block.type === DOC_BLOCK_TYPES.TEXT
      && prev?.type === DOC_BLOCK_TYPES.TEXT
    ) {
      merged[merged.length - 1] = {
        ...prev,
        text: `${prev.text || ""}\n${block.text || ""}`,
      };
      continue;
    }
    merged.push(block);
  }
  return merged;
}

export function normalizeDocBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  return mergeAdjacentTextBlocks(blocks.map(normalizeDocBlock));
}

export function isEmptyTextBlock(block) {
  return block?.type === DOC_BLOCK_TYPES.TEXT && !(block.text || "").trim();
}

/** Drop unfocused empty text rows so they do not occupy layout space. */
export function compactEmptyTextBlocks(blocks, keepBlockIds = null) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];

  const keep = new Set(
    keepBlockIds == null
      ? []
      : (Array.isArray(keepBlockIds) ? keepBlockIds : [keepBlockIds]).filter(Boolean),
  );

  const compacted = blocks.filter((block, _i, arr) => {
    if (!isEmptyTextBlock(block)) return true;
    if (arr.length === 1) return true;
    if (keep.has(block.id)) return true;
    return false;
  });

  return compacted.length > 0
    ? compacted
    : [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
}

function parseTodoSection(section) {
  const lines = section.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  const todoLines = lines.filter((line) => /^-\s*\[[ xX]\]/.test(line.trim()));
  if (todoLines.length === 0) return null;

  const headerLines = lines.filter((line) => !/^-\s*\[[ xX]\]/.test(line.trim()));
  const listTitle = headerLines.join("\n").trim() || DEFAULT_CHECKBOX_LIST_TITLE;
  const items = todoLines.map((line) => {
    const checked = /^-\s*\[x\]/i.test(line.trim());
    const text = line.replace(/^-\s*\[[ xX]\]\s*/, "").trim();
    return createTodoItem({ text, checked });
  });

  return createDocBlock(DOC_BLOCK_TYPES.TODO, { listTitle, items });
}

function parseDateSection(section) {
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] || "";
  const m = first.match(/^::date\s+(.+)$/i);
  if (!m) return null;
  const rest = lines.slice(1).join("\n").trim();
  const title = rest || m[1].trim();
  const datePart = m[1].trim().split(/\s+/)[0] || "";
  return createDocBlock(DOC_BLOCK_TYPES.DATE, { title, date: datePart });
}

function parseMetricSection(section) {
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] || "";
  const m = first.match(/^::metric\s+(.+)$/i);
  if (!m) return null;
  const rest = lines.slice(1).join("\n").trim();
  const title = rest || "";
  const parts = m[1].trim().split(/\s+/);
  const value = parts[0] || "";
  const unit = parts.slice(1).join(" ") || "";
  return createDocBlock(DOC_BLOCK_TYPES.METRIC, { title, value, unit });
}

function parseProductCardSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::productcard")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD);
  }
}

export function docBlocksFromBody(body) {
  const raw = String(body ?? "").trim();
  if (!raw) return [];

  const sections = raw.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (sections.length === 0) return [];

  const blocks = [];

  for (const section of sections) {
    const firstLine = section.split("\n")[0]?.trim() || "";

    if (firstLine.startsWith("# ")) {
      blocks.push(
        createDocBlock(DOC_BLOCK_TYPES.H1, {
          title: firstLine.slice(2).trim(),
        }),
      );
      const rest = section.split("\n").slice(1).join("\n").trim();
      if (rest) blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: rest }));
      continue;
    }

    const dateBlock = parseDateSection(section);
    if (dateBlock) {
      blocks.push(dateBlock);
      continue;
    }

    const metricBlock = parseMetricSection(section);
    if (metricBlock) {
      blocks.push(metricBlock);
      continue;
    }

    const productCardBlock = parseProductCardSection(section);
    if (productCardBlock) {
      blocks.push(productCardBlock);
      continue;
    }

    const todoBlock = parseTodoSection(section);
    if (todoBlock) {
      blocks.push(todoBlock);
      continue;
    }

    blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: section }));
  }

  return blocks;
}

export function docBlocksToBody(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  if (normalized.length === 0) return "";

  return normalized
    .map((block) => {
      if (block.type === DOC_BLOCK_TYPES.H1) {
        return block.title ? `# ${block.title}` : "";
      }
      if (block.type === DOC_BLOCK_TYPES.TODO) {
        const header = block.listTitle?.trim() ? `${block.listTitle}\n` : "";
        const lines = (block.items || [])
          .map((item) => {
            const mark = item.checked ? "[x]" : "[ ]";
            return item.text ? `- ${mark} ${item.text}` : `- ${mark}`;
          })
          .join("\n");
        return header + lines;
      }
      if (block.type === DOC_BLOCK_TYPES.DATE) {
        const dateLine = block.date ? `::date ${block.date}` : "::date";
        return block.title ? `${dateLine}\n${block.title}` : dateLine;
      }
      if (block.type === DOC_BLOCK_TYPES.METRIC) {
        const val = block.value != null && block.value !== "" ? String(block.value) : "";
        const unit = block.unit ? ` ${block.unit}` : "";
        const metricLine = val ? `::metric ${val}${unit}`.trim() : "::metric";
        return block.title ? `${metricLine}\n${block.title}` : metricLine;
      }
      if (block.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
        return `::productcard\n${JSON.stringify({
          title: block.title || "ProductCard",
          specs: block.specs || {},
          images: block.images || [],
          activeImageIndex: block.activeImageIndex || 0,
          specsSaved: Boolean(block.specsSaved),
        })}`;
      }
      return block.text || "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function updateBlockAt(blocks, index, patch) {
  const normalized = normalizeDocBlocks(blocks);
  if (index < 0 || index >= normalized.length) return normalized;
  const next = normalized.map((block, i) =>
    i === index ? normalizeDocBlock({ ...block, ...patch }) : block,
  );
  return next;
}

export function insertBlockAfter(blocks, index, block) {
  const normalized = normalizeDocBlocks(blocks);
  const next = [...normalized];
  next.splice(index + 1, 0, normalizeDocBlock(block));
  return next;
}

export function removeBlockAt(blocks, index) {
  const normalized = normalizeDocBlocks(blocks);
  if (index < 0 || index >= normalized.length) return normalized;
  return normalized.filter((_, i) => i !== index);
}

export function replaceBlocksFromSlashInText(blocks, blockIndex, textValue, newBlock) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return normalized;

  const raw = String(textValue ?? "");
  const slashIdx = raw.search(/\/[^\n]*$/);
  const prefix = slashIdx >= 0 ? raw.slice(0, slashIdx) : raw;

  const next = [...normalized];
  const newNormalized = normalizeDocBlock(newBlock);

  if (!prefix.trim()) {
    next[blockIndex] = newNormalized;
  } else {
    next[blockIndex] = normalizeDocBlock({ ...block, text: prefix });
    next.splice(blockIndex + 1, 0, newNormalized);
  }
  return next;
}

export function replaceBlockFromSlashInLinkable(blocks, blockIndex, fieldValue, newBlock) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (
    !block
    || ![
      DOC_BLOCK_TYPES.H1,
      DOC_BLOCK_TYPES.TODO,
      DOC_BLOCK_TYPES.DATE,
      DOC_BLOCK_TYPES.METRIC,
      DOC_BLOCK_TYPES.PRODUCT_CARD,
    ].includes(block.type)
  ) {
    return normalized;
  }

  const raw = String(fieldValue ?? "");
  const slashIdx = raw.search(/\/[^\n]*$/);
  const prefix = slashIdx >= 0 ? raw.slice(0, slashIdx) : raw;
  const titleField = block.type === DOC_BLOCK_TYPES.TODO ? "listTitle" : "title";

  const next = [...normalized];
  const newNormalized = normalizeDocBlock(newBlock);

  if (!prefix.trim()) {
    next[blockIndex] = newNormalized;
  } else {
    next[blockIndex] = normalizeDocBlock({ ...block, [titleField]: prefix });
    next.splice(blockIndex + 1, 0, newNormalized);
  }
  return next;
}

export function ensureEmptyTextBlockAfter(blocks, blockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return normalized;
  const after = normalized[blockIndex + 1];
  if (isEmptyTextBlock(after)) return normalized;
  return insertBlockAfter(
    normalized,
    blockIndex,
    createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" }),
  );
}

/** @deprecated Use full blocks stack instead */
export function getActiveContentBlock(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  if (normalized.length === 0) return null;
  const block = normalized[0];
  if (
    block.type === DOC_BLOCK_TYPES.H1
    || block.type === DOC_BLOCK_TYPES.TODO
    || block.type === DOC_BLOCK_TYPES.DATE
    || block.type === DOC_BLOCK_TYPES.METRIC
    || block.type === DOC_BLOCK_TYPES.PRODUCT_CARD
  ) {
    return block;
  }
  return null;
}

export function hasProductCardBlock(blocks) {
  return normalizeDocBlocks(blocks).some(
    (block) => block.type === DOC_BLOCK_TYPES.PRODUCT_CARD,
  );
}

export { DOC_BLOCK_TYPES };
