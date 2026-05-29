import { generateId } from "./ids.js";
import { normalizeAnchorFields } from "./nodeAnchor.js";

const DOC_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  TODO: "todo",
  DATE: "date",
  METRIC: "metric",
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

export function createDocBlock(type = DOC_BLOCK_TYPES.TEXT, patch = {}) {
  const id = patch.id || generateId("BLK");
  const base = { id };

  if (type === DOC_BLOCK_TYPES.H1) {
    return {
      ...base,
      type: DOC_BLOCK_TYPES.H1,
      title: "",
      queryEnabled: false,
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
      queryEnabled,
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
      showIntroAnim: false,
      queryEnabled,
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

  return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
    id: block.id,
    text: block.text || "",
  });
}

export function normalizeDocBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  return blocks.map(normalizeDocBlock);
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
  ) {
    return block;
  }
  return null;
}

export { DOC_BLOCK_TYPES };
