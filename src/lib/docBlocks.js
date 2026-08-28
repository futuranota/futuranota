import {
  DEFAULT_CODE_LANGUAGE,
  normalizeCodeLanguage,
  normalizePromptFormat,
} from "./codeBlockLanguages.js";
import { generateId } from "./ids.js";
import { NO_NODE_LINK_COLOR_ID, normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import { splitBodyForSlash } from "./docSlashTail.js";
import { mergeMentionBlocks, normalizeMentions } from "./docMentions.js";
import { mergeTagRefBlocks, normalizeTagRefs } from "./docTagRefs.js";
import { mergeLibraryNameRefBlocks, normalizeLibraryNameRefs } from "./docLibraryNameRefs.js";
import { mergeBlockMarkerRanges, normalizeMarkerRanges } from "./docTextMarkerRanges.js";
import { mergeBlockBoldRanges, normalizeBoldRanges } from "./docTextBoldRanges.js";
import { normalizeAnchorFields } from "./nodeAnchor.js";
import { normalizeWallColor } from "./folderLibraryNormalize.js";
import { normalizeLibraryFrameAspect } from "./libraryFrameAspect.js";
import { parseVideoEmbedInput } from "./videoEmbed.js";
import { normalizeLinkEntries, normalizePasswordEntries } from "./vaultBlocks.js";

const DOC_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  TODO: "todo",
  DATE: "date",
  METRIC: "metric",
  PRODUCT_CARD: "product_card",
  VIDEO_EMBED: "video_embed",
  IMAGE: "image",
  IMAGE_SPLIT: "image_split",
  MOODBOARD: "moodboard",
  BANNER: "banner",
  CODE: "code",
  PASSWORD_VAULT: "password_vault",
  LINK_VAULT: "link_vault",
  AGENT: "agent",
  STEP_SEQUENCE: "step_sequence",
};

export const DEFAULT_AGENT_BLOCK_TITLE = "Agent";

export const DEFAULT_CHECKBOX_LIST_TITLE = "Todo list:";

/** Right column of Image card: plain text or embedded todo. */
export const IMAGE_SPLIT_BODY_MODE = {
  TEXT: "text",
  TODO: "todo",
};

export function createTodoItem(patch = {}) {
  const { id: patchId, ...rest } = patch;
  return {
    id: patchId || generateId("TODO"),
    text: "",
    checked: false,
    ...rest,
  };
}

function normalizeEmbeddedTodoItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return [createTodoItem()];
  }
  return rawItems.map((item) =>
    createTodoItem({
      id: item?.id,
      text: item?.text || "",
      checked: Boolean(item?.checked),
    }),
  );
}

export function normalizeStepCode(code) {
  if (code == null) return undefined;
  const raw = typeof code === "object" ? code : {};
  return {
    language: normalizeCodeLanguage(raw.language || DEFAULT_CODE_LANGUAGE),
    code: String(raw.code ?? ""),
    saved: Boolean(raw.saved),
  };
}

const STEP_ALLOWED_BLOCK_TYPES = new Set([
  DOC_BLOCK_TYPES.TEXT,
  DOC_BLOCK_TYPES.CODE,
]);

function migrateLegacyStepToBlocks(patch) {
  if (Array.isArray(patch?.blocks) && patch.blocks.length) {
    return patch.blocks;
  }
  const blocks = [];
  const text = patch?.text ?? "";
  if (String(text).length > 0) {
    blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: String(text) }));
  }
  if (patch?.code != null) {
    const normalized = normalizeStepCode(patch.code);
    blocks.push(createDocBlock(DOC_BLOCK_TYPES.CODE, {
      language: normalized.language,
      code: normalized.code,
      codeSaved: normalized.saved || Boolean(normalized.code.trim()),
    }));
  }
  if (!blocks.length) {
    blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" }));
  }
  return blocks;
}

export function normalizeStepBlocks(blocks) {
  const raw = Array.isArray(blocks) && blocks.length
    ? blocks
    : [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  const normalized = normalizeDocBlocks(raw).filter((block) => STEP_ALLOWED_BLOCK_TYPES.has(block.type));
  return normalized.length ? normalized : [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
}

const STEP_IMAGE_MAX = 2;

export function normalizeStepImage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = String(raw.src ?? "").trim();
  if (!src) return null;
  const width = Number(raw.width);
  const height = Number(raw.height);
  return {
    src,
    name: String(raw.name ?? "").trim(),
    alt: String(raw.alt ?? "").trim(),
    caption: String(raw.caption ?? "").trim(),
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  };
}

function pushStepImages(target, rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  for (const item of list) {
    const image = normalizeStepImage(item);
    if (!image) continue;
    target.push(image);
    if (target.length >= STEP_IMAGE_MAX) break;
  }
}

/** Max 2. Migrates legacy refImage + variantImages when `images` is empty. */
export function normalizeStepImages(raw, legacy = {}) {
  const images = [];
  if (Array.isArray(raw) && raw.length) {
    pushStepImages(images, raw);
    return images;
  }
  const ref = normalizeStepImage(legacy.refImage);
  if (ref) images.push(ref);
  if (images.length < STEP_IMAGE_MAX) {
    pushStepImages(images, legacy.variantImages);
  }
  return images;
}

export function normalizeStepVariantImages(raw) {
  const images = [];
  pushStepImages(images, raw);
  return images;
}

function stepBlocksHaveContent(blocks) {
  return normalizeStepBlocks(blocks).some((block) => {
    if (block.type === DOC_BLOCK_TYPES.TEXT) return Boolean((block.text || "").trim());
    if (block.type === DOC_BLOCK_TYPES.CODE) {
      return Boolean((block.code || "").trim()) || Boolean(block.codeSaved);
    }
    return false;
  });
}

export function stepEntryHasRecipeFields(step) {
  const meta = String(step?.meta ?? "").trim();
  const prompt = String(step?.prompt ?? "").trim();
  if (meta || prompt || Boolean(step?.promptSaved && prompt)) return true;
  return normalizeStepImages(step?.images, step).length > 0;
}

/** New / recipe steps use the visual card; old playbooks with only blocks keep the editor. */
export function stepUsesRecipeLayout(step) {
  if (stepEntryHasRecipeFields(step)) return true;
  return !stepBlocksHaveContent(step?.blocks);
}

export function createStepEntry(patch = {}) {
  const prompt = String(patch.prompt ?? "");
  const promptFormat = normalizePromptFormat(patch.promptFormat, {
    promptMd: patch.promptMd,
  });
  return {
    id: patch.id || generateId("STEP"),
    images: normalizeStepImages(patch.images, patch),
    meta: String(patch.meta ?? ""),
    prompt,
    promptSaved: Boolean(patch.promptSaved) && Boolean(prompt.trim()),
    promptFormat,
    /** Derived for older readers; prefer promptFormat. */
    promptMd: promptFormat === "markdown",
    blocks: normalizeStepBlocks(migrateLegacyStepToBlocks(patch)),
  };
}

/** CODE block shells defined on step 1 — language only, no content. */
export function getStepCodeTemplateShells(step) {
  return normalizeStepBlocks(step?.blocks)
    .filter((block) => block.type === DOC_BLOCK_TYPES.CODE)
    .map((block) => ({
      type: DOC_BLOCK_TYPES.CODE,
      language: normalizeCodeLanguage(block.language),
    }));
}

export function createStepBlocksFromTemplate(templateShells = []) {
  const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  for (const shell of templateShells) {
    if (shell.type !== DOC_BLOCK_TYPES.CODE) continue;
    blocks.push(createDocBlock(DOC_BLOCK_TYPES.CODE, {
      language: shell.language,
      code: "",
      codeSaved: false,
    }));
  }
  return normalizeStepBlocks(blocks);
}

export function createStepEntryFromTemplate(templateShells = [], patch = {}) {
  return createStepEntry({
    ...patch,
    blocks: createStepBlocksFromTemplate(templateShells),
  });
}

/** Adds empty CODE shells from step-1 template when missing (keeps existing content). */
export function applyStepCodeTemplateToBlocks(blocks, templateShells = []) {
  const normalized = normalizeStepBlocks(blocks);
  if (!templateShells.length) return normalized;

  const mainTextIndex = normalized.findIndex((block) => block.type === DOC_BLOCK_TYPES.TEXT);
  const mainText = mainTextIndex >= 0 ? (normalized[mainTextIndex].text ?? "") : "";

  const result = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: mainText })];

  for (const shell of templateShells) {
    if (shell.type !== DOC_BLOCK_TYPES.CODE) continue;
    const language = normalizeCodeLanguage(shell.language);
    const existing = normalized.find(
      (block) => block.type === DOC_BLOCK_TYPES.CODE
        && normalizeCodeLanguage(block.language) === language,
    );
    if (existing) {
      result.push(normalizeDocBlock(existing));
    } else {
      result.push(createDocBlock(DOC_BLOCK_TYPES.CODE, {
        language,
        code: "",
        codeSaved: false,
      }));
    }
  }

  return normalizeStepBlocks(result);
}

export function propagateStepCodeTemplate(steps) {
  if (!Array.isArray(steps) || steps.length < 2) return steps;
  const shells = getStepCodeTemplateShells(steps[0]);
  if (!shells.length) return steps;
  return steps.map((step, index) => (
    index === 0
      ? step
      : { ...step, blocks: applyStepCodeTemplateToBlocks(step.blocks, shells) }
  ));
}

export function stepEntryHasContent(step) {
  if (stepEntryHasRecipeFields(step)) return true;
  return stepBlocksHaveContent(step?.blocks);
}

export function getStepPreviewText(step) {
  const meta = String(step?.meta ?? "").trim();
  if (meta) return meta;
  const blocks = normalizeStepBlocks(step?.blocks);
  for (const block of blocks) {
    if (block.type === DOC_BLOCK_TYPES.TEXT && (block.text || "").trim()) {
      return String(block.text).trim();
    }
  }
  return "";
}

export function getStepCodePreview(step) {
  const blocks = normalizeStepBlocks(step?.blocks);
  for (const block of blocks) {
    if (block.type === DOC_BLOCK_TYPES.CODE && (block.code || "").trim()) {
      return String(block.code).trim().split("\n")[0];
    }
  }
  return "";
}

export function getStepPlaybookPreview(step) {
  const prompt = String(step?.prompt ?? "").trim();
  if (prompt) return prompt.split("\n")[0];
  return getStepPreviewText(step) || getStepCodePreview(step);
}

export function normalizeStepEntries(steps) {
  return normalizeStepSequenceSteps(steps);
}

export function finalizeStepBlocks(blocks) {
  return normalizeStepBlocks(blocks).map((block) => {
    if (block.type === DOC_BLOCK_TYPES.CODE && (block.code || "").trim()) {
      return normalizeDocBlock({ ...block, codeSaved: true });
    }
    return block;
  });
}

function normalizeStepSequenceSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [createStepEntry()];
  }
  return steps.map((step) => createStepEntry(step));
}

function normalizeStepSequenceBlock(block) {
  const sourceDocumentId = String(block?.sourceDocumentId ?? "").trim();
  return {
    title: String(block?.title ?? ""),
    steps: normalizeStepSequenceSteps(block?.steps),
    saved: Boolean(block?.saved),
    ...(sourceDocumentId ? { sourceDocumentId } : {}),
  };
}

/** Trim trailing empty steps and guarantee at least one step. */
export function finalizeStepSequence(steps) {
  const normalized = normalizeStepSequenceSteps(steps).map((step) => ({
    ...step,
    promptSaved: Boolean((step.prompt || "").trim()) || Boolean(step.promptSaved),
    blocks: finalizeStepBlocks(step.blocks),
  }));
  let end = normalized.length;
  while (end > 1 && !stepEntryHasContent(normalized[end - 1])) {
    end -= 1;
  }
  return normalized.slice(0, end);
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
        unit: dims.unit || dims.xUnit || dims.yUnit || dims.zUnit || "",
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

function normalizeImageBlock(block) {
  return {
    src: block?.src || "",
    name: block?.name || "",
    alt: block?.alt || "",
    width: Number.isFinite(block?.width) ? block.width : 0,
    height: Number.isFinite(block?.height) ? block.height : 0,
    imageSaved: Boolean(block?.imageSaved && block?.src),
    openFilePicker: Boolean(block?.openFilePicker),
  };
}

export const IMAGE_SPLIT_TITLE_MAX = 160;
export const IMAGE_SPLIT_DESC_MAX = 220;
/** Hard ceiling for the right-hand body (doc font ~14px / lh 1.45). */
export const IMAGE_SPLIT_BODY_MAX_LINES = 17;

/** Short Pangolin caption on moodboard left card (≤2 lines in UI). */
export const MOODBOARD_CAPTION_MAX = 64;
/** Hard ceiling for Pangolin caption lines in the card. */
export const MOODBOARD_CAPTION_MAX_LINES = 2;

/** Default / legacy board is three equal columns. */
export const MOODBOARD_COLUMN_COUNT = 3;

/** Top-level board grid (how many columns + proportions). */
export const MOODBOARD_BOARD_LAYOUTS = {
  /** ⅓ · ⅓ · ⅓ — current default. */
  THIRDS: "thirds",
  /** ½ · ½ */
  HALVES: "halves",
  /** ⅔ · ⅓ — wide hero + narrow/tall companion. */
  WIDE_NARROW: "wide_narrow",
  /** Full-width single column (one large image). */
  FULL: "full",
};

export const MOODBOARD_LAYOUT_COLUMN_COUNT = {
  [MOODBOARD_BOARD_LAYOUTS.THIRDS]: 3,
  [MOODBOARD_BOARD_LAYOUTS.HALVES]: 2,
  [MOODBOARD_BOARD_LAYOUTS.WIDE_NARROW]: 2,
  [MOODBOARD_BOARD_LAYOUTS.FULL]: 1,
};

const MOODBOARD_BOARD_LAYOUT_SET = new Set(Object.values(MOODBOARD_BOARD_LAYOUTS));

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMoodboardBoardLayout(value) {
  const raw = String(value ?? "");
  return MOODBOARD_BOARD_LAYOUT_SET.has(raw) ? raw : MOODBOARD_BOARD_LAYOUTS.THIRDS;
}

/** Board canvas fill: solid light board vs transparent (inherits doc surface). */
export const MOODBOARD_BOARD_SURFACES = {
  SOLID: "solid",
  TRANSPARENT: "transparent",
};

const MOODBOARD_BOARD_SURFACE_SET = new Set(Object.values(MOODBOARD_BOARD_SURFACES));

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMoodboardBoardSurface(value) {
  const raw = String(value ?? "");
  return MOODBOARD_BOARD_SURFACE_SET.has(raw) ? raw : MOODBOARD_BOARD_SURFACES.SOLID;
}

/**
 * @param {string} layout
 * @returns {number}
 */
export function moodboardColumnCountForLayout(layout) {
  const resolved = normalizeMoodboardBoardLayout(layout);
  return MOODBOARD_LAYOUT_COLUMN_COUNT[resolved] || MOODBOARD_COLUMN_COUNT;
}

/**
 * Resize a columns array to `targetCount` (pad empty / truncate extras).
 * @param {unknown} list
 * @param {number} targetCount
 */
export function resizeMoodboardColumns(list, targetCount) {
  const n = Math.max(1, Math.min(MOODBOARD_COLUMN_COUNT, Math.floor(Number(targetCount)) || MOODBOARD_COLUMN_COUNT));
  const incoming = Array.isArray(list) ? list.map(normalizeMoodboardColumn) : [];
  const out = incoming.slice(0, n);
  while (out.length < n) out.push(createMoodboardColumn(null));
  return out;
}

export const MOODBOARD_RECIPES = {
  LARGE: "large",
  MEDIUM_STACK: "medium_stack",
  /** Notes card only (no image below). Also allowed on wide_narrow col 1. */
  MEDIUM_STICKY: "medium_sticky",
};

/** Image frames each recipe owns (medium stack = two frames, one under the other). */
export const MOODBOARD_RECIPE_SLOTS = {
  [MOODBOARD_RECIPES.LARGE]: 1,
  [MOODBOARD_RECIPES.MEDIUM_STACK]: 2,
  [MOODBOARD_RECIPES.MEDIUM_STICKY]: 0,
};

/** Soft cap for leftover stickyText on non-notes columns (legacy). */
export const MOODBOARD_STICKY_MAX = 360;
/** Notes body (medium_sticky). Higher than orange sticky — card is taller. */
export const MOODBOARD_NOTES_BODY_MAX = 900;
/** Absolute max lines for medium_sticky Notes body (adaptive clamp may be lower). */
export const MOODBOARD_NOTES_MAX_LINES = 36;
/** Notes card title (medium_sticky headline). */
export const MOODBOARD_STICKY_TITLE_MAX = 40;
/** Arrow label above the medium stack. */
export const MOODBOARD_INFO_MAX = 28;
/** Per-image tag label (Permanent Marker). */
export const MOODBOARD_TAG_MAX = 28;
/** 3:2 research sticky — optional headline. */
export const MOODBOARD_SLOT_NOTE_HEADLINE_MAX = 40;
/** 3:2 research sticky — body. */
export const MOODBOARD_SLOT_NOTE_BODY_MAX = 400;
/**
 * Body char threshold: ≤ limit → large Marker callout; over → regular body size.
 * Counts noteBody only (headline excluded).
 */
export const MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT = 30;

/** Per-slot content: image, research sticky, or weather forecast (3:2 medium). */
export const MOODBOARD_SLOT_CONTENT_MODES = {
  IMAGE: "image",
  NOTE: "note",
  WEATHER: "weather",
};

/**
 * @param {unknown} value
 * @returns {"image" | "note" | "weather"}
 */
export function normalizeMoodboardSlotContentMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === MOODBOARD_SLOT_CONTENT_MODES.NOTE) return MOODBOARD_SLOT_CONTENT_MODES.NOTE;
  if (raw === MOODBOARD_SLOT_CONTENT_MODES.WEATHER) return MOODBOARD_SLOT_CONTENT_MODES.WEATHER;
  return MOODBOARD_SLOT_CONTENT_MODES.IMAGE;
}

/**
 * Persistable weather-forecast payload for a moodboard slot (or null).
 * @param {unknown} raw
 * @returns {object|null}
 */
export function normalizeMoodboardWeatherPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (String(raw.kind || "") !== "weather-forecast") return null;
  return {
    kind: "weather-forecast",
    scheduleLabel: raw.scheduleLabel ?? null,
    scheduleIso: raw.scheduleIso ?? null,
    resolvedFrom: raw.resolvedFrom ?? null,
    uiDate: String(raw.uiDate || ""),
    location: String(raw.location || ""),
    asOf: raw.asOf ?? null,
    condition: raw.condition ?? null,
    conditionIcon: raw.conditionIcon ?? null,
    high: raw.high ?? null,
    low: raw.low ?? null,
    precipPct: raw.precipPct ?? null,
    wind: raw.wind && typeof raw.wind === "object" ? raw.wind : {},
    summary: raw.summary ?? null,
    disclaimer: raw.disclaimer ?? null,
    fetchedAt: String(raw.fetchedAt || ""),
  };
}

/**
 * Weather mode + no payload yet (waiting for canvas connect).
 * @param {object|null|undefined} slot
 */
export function isMoodboardWeatherPlaceholder(slot) {
  if (normalizeMoodboardSlotContentMode(slot?.contentMode) !== MOODBOARD_SLOT_CONTENT_MODES.WEATHER) {
    return false;
  }
  return !normalizeMoodboardWeatherPayload(slot?.weatherPayload);
}

/**
 * Weather mode with a live forecast payload.
 * @param {object|null|undefined} slot
 */
export function isMoodboardWeatherFilled(slot) {
  if (normalizeMoodboardSlotContentMode(slot?.contentMode) !== MOODBOARD_SLOT_CONTENT_MODES.WEATHER) {
    return false;
  }
  return Boolean(normalizeMoodboardWeatherPayload(slot?.weatherPayload));
}

/**
 * First free weather placeholder across moodboard blocks.
 * @param {unknown} blocks
 * @returns {{ blockId: string, colIndex: number, imageIndex: number } | null}
 */
export function findMoodboardWeatherTarget(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!block || block.type !== DOC_BLOCK_TYPES.MOODBOARD || !block.id) continue;
    const columns = Array.isArray(block.columns) ? block.columns : [];
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const images = Array.isArray(columns[colIndex]?.images) ? columns[colIndex].images : [];
      for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        if (isMoodboardWeatherPlaceholder(images[imageIndex])) {
          return { blockId: String(block.id), colIndex, imageIndex };
        }
      }
    }
  }
  return null;
}

/**
 * True when any moodboard weather slot already holds this forecast instance.
 * @param {unknown} blocks
 * @param {object} payload
 */
export function moodboardHasWeatherPayload(blocks, payload) {
  const next = normalizeMoodboardWeatherPayload(payload);
  if (!next || !Array.isArray(blocks)) return false;
  for (const block of blocks) {
    if (!block || block.type !== DOC_BLOCK_TYPES.MOODBOARD) continue;
    const columns = Array.isArray(block.columns) ? block.columns : [];
    for (const column of columns) {
      const images = Array.isArray(column?.images) ? column.images : [];
      for (const slot of images) {
        const existing = normalizeMoodboardWeatherPayload(slot?.weatherPayload);
        if (
          existing
          && existing.fetchedAt === next.fetchedAt
          && existing.uiDate === next.uiDate
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Write forecast payload into a weather placeholder slot.
 * @param {unknown} blocks
 * @param {{ blockId: string, colIndex: number, imageIndex: number }} target
 * @param {object} payload
 * @returns {object[]|null} next blocks array, or null on failure
 */
export function fillMoodboardWeatherSlot(blocks, target, payload) {
  const weatherPayload = normalizeMoodboardWeatherPayload(payload);
  if (!weatherPayload || !target?.blockId) return null;
  if (!Array.isArray(blocks)) return null;
  const colIndex = Number(target.colIndex);
  const imageIndex = Number(target.imageIndex);
  if (!Number.isInteger(colIndex) || !Number.isInteger(imageIndex)) return null;
  if (colIndex < 0 || imageIndex < 0) return null;

  let found = false;
  const nextBlocks = blocks.map((block) => {
    if (!block || block.id !== target.blockId || block.type !== DOC_BLOCK_TYPES.MOODBOARD) {
      return block;
    }
    const columns = Array.isArray(block.columns) ? block.columns.map((col, cIdx) => {
      if (cIdx !== colIndex) return col;
      const images = Array.isArray(col?.images) ? [...col.images] : [];
      if (imageIndex >= images.length) return col;
      const prev = images[imageIndex] || emptyMoodboardSlot();
      if (!isMoodboardWeatherPlaceholder(prev)) return col;
      images[imageIndex] = normalizeMoodboardSlot({
        ...prev,
        contentMode: MOODBOARD_SLOT_CONTENT_MODES.WEATHER,
        weatherPayload,
        imageSaved: true,
      });
      found = true;
      return createMoodboardColumn(col.recipe, {
        images,
        stickyText: col.stickyText,
        stickyTitle: col.stickyTitle,
        infoLabel: col.infoLabel,
        noteStyle: col.noteStyle,
      });
    }) : [];
    if (!found) return block;
    return { ...block, columns, moodboardSaved: false };
  });
  return found ? nextBlocks : null;
}

/**
 * Auto text scale for 3:2 Marker sticky body.
 * @param {unknown} text
 * @param {number} [limit]
 * @returns {"large" | "body"}
 */
export function resolveStickyNoteTextScale(
  text,
  limit = MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT,
) {
  const n = String(text ?? "").trim().length;
  const cap = Number.isFinite(limit) && limit > 0
    ? limit
    : MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT;
  return n > cap ? "body" : "large";
}
/** Default board/thumb icon for link-only (non-image) moodboard slots. */
export const MOODBOARD_FILE_ICON_SRC = "/uploads/Folders/MediaFolder.png";
/** Medium-sticky notes card paper (runtime bg). */
export const MOODBOARD_NOTES_BG_SRC = "/uploads/background.svg";
/** @deprecated Oval no longer used on notes cards; kept for old refs. */
export const MOODBOARD_NOTES_CIRC_SRC = "/uploads/circ.png";
/** Default title shown on a new medium_sticky notes card. */
export const MOODBOARD_NOTES_TITLE_DEFAULT = "Notes:";

/** Notes card typography trial: Marker (hand) vs Inter (clean). */
export const MOODBOARD_NOTE_STYLES = {
  MARKER: "marker",
  INTER: "inter",
};

const MOODBOARD_NOTE_STYLE_SET = new Set(Object.values(MOODBOARD_NOTE_STYLES));

/**
 * @param {unknown} value
 * @returns {"marker" | "inter"}
 */
export function normalizeMoodboardNoteStyle(value) {
  const raw = String(value || "").trim().toLowerCase();
  return MOODBOARD_NOTE_STYLE_SET.has(raw) ? raw : MOODBOARD_NOTE_STYLES.MARKER;
}

/** Freeform overlays on the moodboard board (Edit palette). */
export const MOODBOARD_OVERLAY_KINDS = {
  TWISTED: "twisted",
  STRAIGHT: "straight",
  UP: "up",
  DOWN: "down",
  CIRCLE: "circle",
  ELLIPSE: "ellipse",
  /** Dashed circle + stretchable arrow tip (circle product → point elsewhere). */
  POINTER: "pointer",
};

/** Absolute /uploads paths — use as <img src>, never CSS url(). */
export const MOODBOARD_OVERLAY_SRC = {
  [MOODBOARD_OVERLAY_KINDS.TWISTED]: "/uploads/arrow-twisted.svg",
  [MOODBOARD_OVERLAY_KINDS.STRAIGHT]: "/uploads/arrow-straight.svg",
  [MOODBOARD_OVERLAY_KINDS.UP]: "/uploads/arrow-up.svg",
  [MOODBOARD_OVERLAY_KINDS.DOWN]: "/uploads/arrow-down.svg",
  // Prefer PNG: circle.svg in uploads is ~2.4MB export; PNG is lightweight.
  [MOODBOARD_OVERLAY_KINDS.CIRCLE]: "/uploads/circle.png",
  [MOODBOARD_OVERLAY_KINDS.ELLIPSE]: "/uploads/ellipse.svg",
  // Pointer is SVG-drawn in the board (no static asset).
  [MOODBOARD_OVERLAY_KINDS.POINTER]: "",
};

/** Board box width (px) per kind — shapes need more room than arrows. */
export const MOODBOARD_OVERLAY_SIZE_PX = {
  [MOODBOARD_OVERLAY_KINDS.TWISTED]: 44,
  [MOODBOARD_OVERLAY_KINDS.STRAIGHT]: 44,
  [MOODBOARD_OVERLAY_KINDS.UP]: 44,
  [MOODBOARD_OVERLAY_KINDS.DOWN]: 44,
  [MOODBOARD_OVERLAY_KINDS.CIRCLE]: 110,
  [MOODBOARD_OVERLAY_KINDS.ELLIPSE]: 140,
  [MOODBOARD_OVERLAY_KINDS.POINTER]: 78,
};

/** Default tip offset from circle center when placing a pointer overlay. */
export const MOODBOARD_POINTER_DEFAULT_END_DX_PCT = 12;
export const MOODBOARD_POINTER_DEFAULT_END_DY_PCT = 0;

/** Overlay stroke on light photos (default), dark photos, or sky accent. */
export const MOODBOARD_POINTER_CONTRAST = {
  INK: "ink",
  LIGHT: "light",
  /** Same sky as node-link #B9E5FE */
  SKY: "sky",
};

/** Resolved CSS colors for overlay strokes / tints. */
export const MOODBOARD_OVERLAY_STROKE_BY_CONTRAST = {
  [MOODBOARD_POINTER_CONTRAST.INK]: "rgba(22, 26, 29, 0.85)",
  [MOODBOARD_POINTER_CONTRAST.LIGHT]: "rgba(220, 224, 228, 0.92)",
  [MOODBOARD_POINTER_CONTRAST.SKY]: "#B9E5FE",
};

const MOODBOARD_POINTER_CONTRAST_SET = new Set(Object.values(MOODBOARD_POINTER_CONTRAST));

/**
 * @param {unknown} value
 * @returns {"ink"|"light"|"sky"}
 */
export function normalizeMoodboardPointerContrast(value) {
  const raw = String(value ?? "");
  return MOODBOARD_POINTER_CONTRAST_SET.has(raw)
    ? raw
    : MOODBOARD_POINTER_CONTRAST.INK;
}

const MOODBOARD_OVERLAY_KIND_SET = new Set(Object.values(MOODBOARD_OVERLAY_KINDS));

/**
 * Normalize a pasted Drive/Dropbox/any http(s) URL. Returns "" if invalid.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMoodboardExternalUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

/** Banner headline (bold copy beside image). */
export const BANNER_HEADLINE_MAX = 280;
/** Hard ceiling for banner headline lines (~doc cell line count). */
export const BANNER_HEADLINE_MAX_LINES = 9;

/**
 * Convert image-split ↔ moodboard / banner ↔ moodboard (preserve id + best-effort fields).
 * @param {object} block
 * @param {"image_split"|"moodboard"|"banner"} targetType
 */
export function convertImageLayoutBlock(block, targetType) {
  if (!block || typeof block !== "object") return null;
  const id = block.id;

  if (targetType === DOC_BLOCK_TYPES.MOODBOARD) {
    if (block.type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
      const imageSaved = Boolean(block.imageSaved && block.src);
      const image = {
        src: block.src || "",
        name: block.name || "",
        alt: block.alt || "",
        width: block.width || 0,
        height: block.height || 0,
        imageSaved,
      };
      return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, {
        id,
        caption: String(block.overlayTitle || "").slice(0, MOODBOARD_CAPTION_MAX),
        columns: [
          createMoodboardColumn(MOODBOARD_RECIPES.LARGE, {
            images: imageSaved ? [image] : [],
          }),
          createMoodboardColumn(null),
          createMoodboardColumn(null),
        ],
        body: String(block.body || ""),
        bodyMode: block.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
          ? IMAGE_SPLIT_BODY_MODE.TODO
          : IMAGE_SPLIT_BODY_MODE.TEXT,
        todoListTitle: block.todoListTitle,
        todoItems: block.todoItems,
        moodboardSaved: Boolean(block.splitSaved && imageSaved),
        openFilePicker: false,
      });
    }
    if (block.type === DOC_BLOCK_TYPES.BANNER) {
      const imageSaved = Boolean(block.imageSaved && block.src);
      const image = {
        src: block.src || "",
        name: block.name || "",
        alt: block.alt || "",
        width: block.width || 0,
        height: block.height || 0,
        imageSaved,
      };
      return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, {
        id,
        caption: String(block.headline || "").slice(0, MOODBOARD_CAPTION_MAX),
        columns: [
          createMoodboardColumn(MOODBOARD_RECIPES.LARGE, {
            images: imageSaved ? [image] : [],
          }),
          createMoodboardColumn(null),
          createMoodboardColumn(null),
        ],
        moodboardSaved: Boolean(block.bannerSaved && imageSaved),
        openFilePicker: false,
      });
    }
  }

  if (targetType === DOC_BLOCK_TYPES.IMAGE_SPLIT && block.type === DOC_BLOCK_TYPES.MOODBOARD) {
    const normalized = normalizeMoodboardBlock(block);
    const first = firstMoodboardImage(normalized);
    const imageSaved = Boolean(first?.imageSaved && first?.src);
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      id,
      overlayTitle: String(normalized.caption || "").slice(0, IMAGE_SPLIT_TITLE_MAX),
      overlayDescription: "",
      src: first?.src || "",
      name: first?.name || "",
      alt: first?.alt || "",
      width: first?.width || 0,
      height: first?.height || 0,
      imageSaved,
      body: String(normalized.body || ""),
      bodyMode: normalized.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
        ? IMAGE_SPLIT_BODY_MODE.TODO
        : IMAGE_SPLIT_BODY_MODE.TEXT,
      todoListTitle: normalized.todoListTitle,
      todoItems: normalized.todoItems,
      splitSaved: Boolean(normalized.moodboardSaved && imageSaved),
      openFilePicker: false,
    });
  }

  if (targetType === DOC_BLOCK_TYPES.BANNER && block.type === DOC_BLOCK_TYPES.MOODBOARD) {
    const normalized = normalizeMoodboardBlock(block);
    const first = firstMoodboardImage(normalized);
    const imageSaved = Boolean(first?.imageSaved && first?.src);
    return createDocBlock(DOC_BLOCK_TYPES.BANNER, {
      id,
      headline: String(normalized.caption || "").slice(0, BANNER_HEADLINE_MAX),
      src: first?.src || "",
      name: first?.name || "",
      alt: first?.alt || "",
      width: first?.width || 0,
      height: first?.height || 0,
      imageSaved,
      bannerSaved: Boolean(normalized.moodboardSaved && imageSaved),
      openFilePicker: false,
    });
  }

  return null;
}

function normalizeImageSplitLibraryOwnerKind(value) {
  const raw = String(value || "").trim();
  return raw === "folder" || raw === "document" ? raw : "";
}

function normalizeImageSplitMediaFace(block, hasSrc, hasPrompt) {
  const raw = String(block?.mediaFace || "").trim();
  if (raw === "prompt" && (hasPrompt || hasSrc)) return "prompt";
  if (raw === "image" && hasSrc) return "image";
  if (!hasSrc && hasPrompt) return "prompt";
  return "image";
}

function normalizeImageSplitBlock(block) {
  const title = String(block?.overlayTitle ?? block?.title ?? "").slice(0, IMAGE_SPLIT_TITLE_MAX);
  const description = String(block?.overlayDescription ?? block?.description ?? "")
    .slice(0, IMAGE_SPLIT_DESC_MAX);
  const src = block?.src || "";
  const imageSaved = Boolean(block?.imageSaved && src);
  const libraryPrompt = String(block?.libraryPrompt ?? "").slice(0, BANNER_HEADLINE_MAX);
  const hasPrompt = Boolean(libraryPrompt.trim());
  const filled = imageSaved || hasPrompt;
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  return {
    overlayTitle: title,
    overlayDescription: description,
    src,
    name: block?.name || "",
    alt: block?.alt || "",
    width: Number.isFinite(block?.width) ? block.width : 0,
    height: Number.isFinite(block?.height) ? block.height : 0,
    imageSaved,
    libraryItemId: String(block?.libraryItemId || "").trim(),
    libraryOwnerKind: normalizeImageSplitLibraryOwnerKind(block?.libraryOwnerKind),
    libraryOwnerId: String(block?.libraryOwnerId || "").trim(),
    libraryPrompt,
    libraryTag: String(block?.libraryTag || "").trim().slice(0, IMAGE_SPLIT_TITLE_MAX),
    wallColor: normalizeWallColor(block?.wallColor),
    mediaFace: normalizeImageSplitMediaFace(block, imageSaved, hasPrompt),
    openFilePicker: Boolean(block?.openFilePicker),
    body: String(block?.body ?? ""),
    bodyMode,
    todoListTitle: String(block?.todoListTitle ?? DEFAULT_CHECKBOX_LIST_TITLE),
    todoItems: bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
      ? normalizeEmbeddedTodoItems(block?.todoItems)
      : Array.isArray(block?.todoItems)
        ? normalizeEmbeddedTodoItems(block.todoItems)
        : [],
    splitSaved: Boolean(block?.splitSaved) && filled,
  };
}

/**
 * Confirm `/todo` inside Image card body → embed compact todo in the right column
 * (does not insert a sibling TODO block).
 * @param {object} block
 * @param {string} bodyValue
 */
export function applyTodoSlashToImageSplit(block, _bodyValue) {
  if (!block || block.type !== DOC_BLOCK_TYPES.IMAGE_SPLIT) return null;
  return {
    body: "",
    bodyMode: IMAGE_SPLIT_BODY_MODE.TODO,
    todoListTitle: DEFAULT_CHECKBOX_LIST_TITLE,
    todoItems: [createTodoItem()],
    splitSaved: false,
  };
}

function normalizeMoodboardSlot(slot) {
  const src = slot?.src || "";
  const externalUrl = normalizeMoodboardExternalUrl(slot?.externalUrl);
  const libraryItemId = String(slot?.libraryItemId || "").trim();
  const hasImage = Boolean(src) || Boolean(libraryItemId);
  const hasLink = Boolean(externalUrl);
  const frameAspect = normalizeLibraryFrameAspect(slot?.frameAspect);
  const sourceMediaUrl = typeof slot?.sourceMediaUrl === "string" && slot.sourceMediaUrl.trim()
    ? slot.sourceMediaUrl.trim()
    : "";
  const wallColor = normalizeWallColor(slot?.wallColor);
  const contentMode = normalizeMoodboardSlotContentMode(slot?.contentMode);
  const weatherPayload = contentMode === MOODBOARD_SLOT_CONTENT_MODES.WEATHER
    ? normalizeMoodboardWeatherPayload(slot?.weatherPayload)
    : null;
  const weatherFilled = Boolean(weatherPayload);
  return {
    slotId: String(slot?.slotId || generateId("MBS")),
    src,
    name: slot?.name || "",
    alt: slot?.alt || "",
    width: Number.isFinite(slot?.width) ? slot.width : 0,
    height: Number.isFinite(slot?.height) ? slot.height : 0,
    /** Filled slot: local image, external link, or weather payload. */
    imageSaved: Boolean(
      (slot?.imageSaved && hasImage)
      || hasLink
      || weatherFilled,
    ),
    /** "image" when src exists; "file" when link-only (board shows file icon). */
    kind: hasImage ? "image" : (hasLink ? "file" : "image"),
    externalUrl,
    tagLabel: String(slot?.tagLabel ?? "").trim().slice(0, MOODBOARD_TAG_MAX),
    libraryItemId: String(slot?.libraryItemId || "").trim(),
    libraryOwnerKind: normalizeImageSplitLibraryOwnerKind(slot?.libraryOwnerKind),
    libraryOwnerId: String(slot?.libraryOwnerId || "").trim(),
    frameAspect,
    sourceMediaUrl,
    wallColor,
    contentMode,
    weatherPayload,
    noteHeadline: String(slot?.noteHeadline ?? "").slice(0, MOODBOARD_SLOT_NOTE_HEADLINE_MAX),
    noteBody: String(slot?.noteBody ?? "").slice(0, MOODBOARD_SLOT_NOTE_BODY_MAX),
  };
}

function emptyMoodboardSlot() {
  return normalizeMoodboardSlot(null);
}

function isMoodboardRecipe(value) {
  return value === MOODBOARD_RECIPES.LARGE
    || value === MOODBOARD_RECIPES.MEDIUM_STACK
    || value === MOODBOARD_RECIPES.MEDIUM_STICKY;
}

/** Legacy `semi_sticky` (image + orange note) → large image column. */
function migrateMoodboardRecipe(value) {
  if (value === "semi_sticky") return MOODBOARD_RECIPES.LARGE;
  return isMoodboardRecipe(value) ? value : null;
}

/**
 * @param {string|null} recipe
 * @param {{ images?: object[], stickyText?: string, stickyTitle?: string, infoLabel?: string, noteStyle?: string, calendarWireEnabled?: boolean, stickyFromCalendar?: boolean }} [patch]
 */
export function createMoodboardColumn(recipe = null, patch = {}) {
  const resolved = migrateMoodboardRecipe(recipe);
  const slotCount = resolved ? MOODBOARD_RECIPE_SLOTS[resolved] : 0;
  const incoming = Array.isArray(patch.images) ? patch.images : [];
  const images = Array.from({ length: slotCount }, (_, index) => (
    normalizeMoodboardSlot(incoming[index] || null)
  ));
  const titleDefault = resolved === MOODBOARD_RECIPES.MEDIUM_STICKY
    ? MOODBOARD_NOTES_TITLE_DEFAULT
    : "";
  const stickyTitle = Object.prototype.hasOwnProperty.call(patch, "stickyTitle")
    ? String(patch.stickyTitle ?? "").slice(0, MOODBOARD_STICKY_TITLE_MAX)
    : titleDefault;
  const stickyTextMax = resolved === MOODBOARD_RECIPES.MEDIUM_STICKY
    ? MOODBOARD_NOTES_BODY_MAX
    : MOODBOARD_STICKY_MAX;
  const noteStyle = normalizeMoodboardNoteStyle(
    Object.prototype.hasOwnProperty.call(patch, "noteStyle")
      ? patch.noteStyle
      : MOODBOARD_NOTE_STYLES.MARKER,
  );
  const calendarWireEnabled = resolved === MOODBOARD_RECIPES.MEDIUM_STICKY
    && Object.prototype.hasOwnProperty.call(patch, "calendarWireEnabled")
    ? Boolean(patch.calendarWireEnabled)
    : false;
  const stickyFromCalendar = resolved === MOODBOARD_RECIPES.MEDIUM_STICKY
    && Object.prototype.hasOwnProperty.call(patch, "stickyFromCalendar")
    ? Boolean(patch.stickyFromCalendar)
    : false;
  return {
    recipe: resolved,
    images,
    stickyText: String(patch.stickyText ?? "").slice(0, stickyTextMax),
    stickyTitle,
    infoLabel: String(patch.infoLabel ?? "").slice(0, MOODBOARD_INFO_MAX),
    noteStyle,
    calendarWireEnabled,
    stickyFromCalendar,
  };
}

function normalizeMoodboardColumn(column) {
  return createMoodboardColumn(migrateMoodboardRecipe(column?.recipe ?? null), {
    images: column?.images,
    stickyText: column?.stickyText,
    stickyTitle: column?.stickyTitle,
    infoLabel: column?.infoLabel,
    noteStyle: column?.noteStyle,
    calendarWireEnabled: column?.calendarWireEnabled,
    stickyFromCalendar: column?.stickyFromCalendar,
  });
}

/**
 * Migrate legacy a/b collage → column recipes; pad/trim to board layout.
 * @param {object} block
 */
function migrateLegacyMoodboardColumns(block) {
  const layout = normalizeMoodboardBoardLayout(block?.boardLayout);
  const targetCount = moodboardColumnCountForLayout(layout);

  if (Array.isArray(block?.columns) && block.columns.length > 0) {
    return resizeMoodboardColumns(block.columns, targetCount);
  }

  const a = normalizeMoodboardSlot(block?.a);
  const b = normalizeMoodboardSlot(block?.b);
  const seeded = [
    createMoodboardColumn(
      a.imageSaved || a.src ? MOODBOARD_RECIPES.LARGE : null,
      { images: a.imageSaved || a.src ? [a] : [] },
    ),
    createMoodboardColumn(
      b.imageSaved || b.src ? MOODBOARD_RECIPES.LARGE : null,
      { images: b.imageSaved || b.src ? [b] : [] },
    ),
    createMoodboardColumn(null),
  ];
  return resizeMoodboardColumns(seeded, targetCount);
}

/**
 * @param {object} block — already normalized or raw moodboard
 */
export function countMoodboardSavedImages(block) {
  const columns = Array.isArray(block?.columns) ? block.columns : migrateLegacyMoodboardColumns(block);
  let count = 0;
  for (const column of columns) {
    const images = Array.isArray(column?.images) ? column.images : [];
    for (const image of images) {
      if (isMoodboardWeatherFilled(image)) {
        count += 1;
        continue;
      }
      if (image?.imageSaved && (
        image?.src
        || image?.libraryItemId
        || image?.externalUrl
      )) count += 1;
    }
  }
  return count;
}

/**
 * Notes columns with body text count as savable moodboard content.
 * @param {object} block
 */
export function countMoodboardNotesContent(block) {
  const columns = Array.isArray(block?.columns) ? block.columns : migrateLegacyMoodboardColumns(block);
  let count = 0;
  for (const column of columns) {
    if (column?.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) continue;
    if (String(column?.stickyText ?? "").trim()) count += 1;
  }
  return count;
}

/**
 * Images, weather slots, or filled Notes columns — enough to Save moodboard.
 * @param {object} block
 */
export function countMoodboardSavableContent(block) {
  return countMoodboardSavedImages(block) + countMoodboardNotesContent(block);
}

/**
 * First filled image across columns (for Image card / Banner convert).
 * @param {object} block
 */
export function firstMoodboardImage(block) {
  const columns = Array.isArray(block?.columns) ? block.columns : migrateLegacyMoodboardColumns(block);
  for (const column of columns) {
    const images = Array.isArray(column?.images) ? column.images : [];
    for (const image of images) {
      if (image?.src) return normalizeMoodboardSlot(image);
    }
  }
  return emptyMoodboardSlot();
}

/**
 * Clamp a moodboard overlay position percentage (board space).
 * @param {unknown} value
 * @param {number} [fallback=50]
 * @returns {number}
 */
function clampMoodboardOverlayPct(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

/**
 * Image-local % may sit slightly outside the photo (pointer tip).
 * @param {unknown} value
 * @param {number} [fallback=50]
 * @returns {number}
 */
function clampMoodboardOverlayImagePct(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-50, Math.min(150, n));
}

/**
 * @param {unknown} raw
 * @returns {{
 *   id: string,
 *   kind: string,
 *   xPct: number,
 *   yPct: number,
 *   endXPct?: number,
 *   endYPct?: number,
 *   contrast?: string,
 *   anchorSlotId?: string,
 * } | null}
 */
function normalizeMoodboardOverlay(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = String(raw.kind || "");
  if (!MOODBOARD_OVERLAY_KIND_SET.has(kind)) return null;
  const anchorSlotId = String(raw.anchorSlotId || "").trim();
  const clampPct = anchorSlotId ? clampMoodboardOverlayImagePct : clampMoodboardOverlayPct;
  const xPct = clampPct(raw.xPct, 45);
  const yPct = clampPct(raw.yPct, 40);
  /** @type {{ id: string, kind: string, xPct: number, yPct: number, endXPct?: number, endYPct?: number, contrast?: string, anchorSlotId?: string }} */
  const item = {
    id: String(raw.id || generateId("MBO")),
    kind,
    xPct,
    yPct,
    contrast: normalizeMoodboardPointerContrast(raw.contrast),
  };
  if (anchorSlotId) item.anchorSlotId = anchorSlotId;
  if (kind === MOODBOARD_OVERLAY_KINDS.POINTER) {
    item.endXPct = clampPct(
      raw.endXPct,
      Math.min(100, xPct + MOODBOARD_POINTER_DEFAULT_END_DX_PCT),
    );
    item.endYPct = clampPct(
      raw.endYPct,
      Math.max(0, Math.min(100, yPct + MOODBOARD_POINTER_DEFAULT_END_DY_PCT)),
    );
  }
  return item;
}

/**
 * @param {unknown} list
 * @returns {{
 *   id: string,
 *   kind: string,
 *   xPct: number,
 *   yPct: number,
 *   endXPct?: number,
 *   endYPct?: number,
 *   contrast?: string,
 *   anchorSlotId?: string,
 * }[]}
 */
export function normalizeMoodboardOverlays(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  /** @type {{ id: string, kind: string, xPct: number, yPct: number, endXPct?: number, endYPct?: number, contrast?: string, anchorSlotId?: string }[]} */
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const item = normalizeMoodboardOverlay(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * @param {string} kind
 * @param {{ xPct?: number, yPct?: number, endXPct?: number, endYPct?: number, contrast?: string, id?: string, anchorSlotId?: string }} [patch]
 */
export function createMoodboardOverlay(kind, patch = {}) {
  const xPct = patch.xPct ?? 45;
  const yPct = patch.yPct ?? 40;
  return normalizeMoodboardOverlay({
    id: patch.id || generateId("MBO"),
    kind,
    xPct,
    yPct,
    contrast: patch.contrast,
    anchorSlotId: patch.anchorSlotId,
    ...(kind === MOODBOARD_OVERLAY_KINDS.POINTER
      ? {
        endXPct: patch.endXPct ?? Math.min(100, xPct + MOODBOARD_POINTER_DEFAULT_END_DX_PCT),
        endYPct: patch.endYPct ?? Math.max(0, Math.min(100, yPct + MOODBOARD_POINTER_DEFAULT_END_DY_PCT)),
      }
      : {}),
  });
}

function normalizeMoodboardBlock(block) {
  const boardLayout = normalizeMoodboardBoardLayout(block?.boardLayout);
  const boardSurface = normalizeMoodboardBoardSurface(block?.boardSurface);
  const columns = migrateLegacyMoodboardColumns({ ...block, boardLayout });
  const savedCount = countMoodboardSavedImages({ columns });
  const savableCount = countMoodboardSavableContent({ columns });
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  // Keep a/b mirrors so older readers still see something until fully cut over.
  const a = columns[0]?.images?.[0] ? normalizeMoodboardSlot(columns[0].images[0]) : emptyMoodboardSlot();
  const b = columns[1]?.images?.[0] ? normalizeMoodboardSlot(columns[1].images[0]) : emptyMoodboardSlot();
  const body = String(block?.body ?? "");
  const tagRefs = normalizeTagRefs(body, block?.tagRefs);
  const overlays = normalizeMoodboardOverlays(block?.overlays);
  return {
    caption: String(block?.caption ?? "").slice(0, MOODBOARD_CAPTION_MAX),
    boardLayout,
    boardSurface,
    columns,
    a,
    b,
    body,
    ...(tagRefs.length ? { tagRefs } : {}),
    overlays,
    bodyMode,
    todoListTitle: String(block?.todoListTitle ?? DEFAULT_CHECKBOX_LIST_TITLE),
    todoItems: bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
      ? normalizeEmbeddedTodoItems(block?.todoItems)
      : Array.isArray(block?.todoItems)
        ? normalizeEmbeddedTodoItems(block.todoItems)
        : [],
    openFilePicker: Boolean(block?.openFilePicker),
    moodboardSaved: Boolean(block?.moodboardSaved) && savableCount > 0,
  };
}

function normalizeBannerBlock(block) {
  const imageSaved = Boolean(block?.imageSaved && block?.src);
  return {
    headline: String(block?.headline ?? block?.overlayTitle ?? "").slice(0, BANNER_HEADLINE_MAX),
    src: block?.src || "",
    name: block?.name || "",
    alt: block?.alt || "",
    width: Number.isFinite(block?.width) ? block.width : 0,
    height: Number.isFinite(block?.height) ? block.height : 0,
    imageSaved,
    openFilePicker: Boolean(block?.openFilePicker),
    bannerSaved: Boolean(block?.bannerSaved) && imageSaved,
  };
}

function normalizeCodeBlock(block) {
  const code = block?.code || "";
  const hasCode = Boolean(code.trim());
  return {
    language: normalizeCodeLanguage(block?.language),
    code,
    codeSaved: Boolean(block?.codeSaved ?? hasCode) && hasCode,
  };
}

function normalizePasswordVaultBlock(block) {
  return {
    entries: normalizePasswordEntries(block?.entries),
  };
}

function normalizeLinkVaultBlock(block) {
  return {
    entries: normalizeLinkEntries(block?.entries),
  };
}

function normalizeAgentBlock(block) {
  return {
    instruction: String(block?.instruction ?? ""),
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
      macronodeHeading: Boolean(patch.macronodeHeading),
      ...patch,
      id,
    };
  }

  if (type === DOC_BLOCK_TYPES.H2 || type === DOC_BLOCK_TYPES.H3) {
    return {
      ...base,
      type,
      title: "",
      ...patch,
      id,
    };
  }

  if (type === DOC_BLOCK_TYPES.TODO) {
    const items = patch.items || [createTodoItem({ id: `${id}__empty` })];
    return {
      ...base,
      type: DOC_BLOCK_TYPES.TODO,
      listTitle: patch.listTitle ?? DEFAULT_CHECKBOX_LIST_TITLE,
      items,
      showIntroAnim: false,
      queryEnabled: false,
      nodeLinkColor: NO_NODE_LINK_COLOR_ID,
      ...patch,
      id,
      items,
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

  if (type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
    const rawInput = patch.rawInput || "";
    const parsed = rawInput ? parseVideoEmbedInput(rawInput) : null;
    const embedSrc = patch.embedSrc || parsed?.embedSrc || "";
    return {
      ...base,
      type: DOC_BLOCK_TYPES.VIDEO_EMBED,
      rawInput,
      provider: patch.provider || parsed?.provider || "unknown",
      videoId: patch.videoId || parsed?.videoId || "",
      embedSrc,
      ownerH1Id: patch.ownerH1Id || undefined,
      parseError: patch.parseError ?? parsed?.error ?? null,
      embedSaved: patch.embedSaved !== undefined
        ? Boolean(patch.embedSaved)
        : Boolean(embedSrc),
    };
  }

  if (type === DOC_BLOCK_TYPES.IMAGE) {
    const normalized = normalizeImageBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.IMAGE,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
    const normalized = normalizeImageSplitBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.IMAGE_SPLIT,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.MOODBOARD) {
    const normalized = normalizeMoodboardBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.MOODBOARD,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.BANNER) {
    const normalized = normalizeBannerBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.BANNER,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.CODE) {
    const normalized = normalizeCodeBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.CODE,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
    const normalized = normalizePasswordVaultBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.PASSWORD_VAULT,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.LINK_VAULT) {
    const normalized = normalizeLinkVaultBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.LINK_VAULT,
      ...normalized,
    };
  }

  if (type === DOC_BLOCK_TYPES.AGENT) {
    const normalized = normalizeAgentBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.AGENT,
      instruction: normalized.instruction,
    };
  }

  if (type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    const normalized = normalizeStepSequenceBlock(patch);
    return {
      ...base,
      type: DOC_BLOCK_TYPES.STEP_SEQUENCE,
      ...normalized,
    };
  }

  return { ...base, type: DOC_BLOCK_TYPES.TEXT, text: "", ...patch, id };
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
      anchorFinishTime: anchor.anchorFinishTime,
      anchorFromNode: Boolean(block.anchorFromNode),
      queryEnabled,
      nodeLinkColor: block.nodeLinkColor != null
        ? normalizeNodeLinkColorId(block.nodeLinkColor)
        : NO_NODE_LINK_COLOR_ID,
      macronodeHeading: block.macronodeHeading != null
        ? Boolean(block.macronodeHeading)
        : Boolean(block.nodeId || queryEnabled),
      hideColorLink: Boolean(block.hideColorLink),
    });
  }

  if (type === DOC_BLOCK_TYPES.H2 || type === DOC_BLOCK_TYPES.H3) {
    return createDocBlock(type, {
      id: block.id,
      title: block.title || "",
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
        : [createTodoItem({
          id: block.id ? `${block.id}__empty` : "TODO_EMPTY",
        })];
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
      anchorFinishTime: anchor.anchorFinishTime,
      anchorFromNode: Boolean(block.anchorFromNode),
      showIntroAnim: false,
      queryEnabled,
      nodeLinkColor: block.nodeLinkColor != null
        ? normalizeNodeLinkColorId(block.nodeLinkColor)
        : NO_NODE_LINK_COLOR_ID,
      hideColorLink: Boolean(block.hideColorLink),
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

  if (type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
    return createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED, {
      id: block.id,
      rawInput: block.rawInput || "",
      provider: block.provider || "unknown",
      videoId: block.videoId || "",
      embedSrc: block.embedSrc || "",
      ownerH1Id: block.ownerH1Id || undefined,
      parseError: block.parseError || null,
      embedSaved: Boolean(block.embedSaved ?? block.embedSrc),
    });
  }

  if (type === DOC_BLOCK_TYPES.IMAGE) {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE, {
      id: block.id,
      src: block.src,
      name: block.name,
      alt: block.alt,
      width: block.width,
      height: block.height,
      imageSaved: block.imageSaved,
      openFilePicker: block.openFilePicker,
    });
  }

  if (type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      id: block.id,
      ...normalizeImageSplitBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.MOODBOARD) {
    return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, {
      id: block.id,
      ...normalizeMoodboardBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.BANNER) {
    return createDocBlock(DOC_BLOCK_TYPES.BANNER, {
      id: block.id,
      ...normalizeBannerBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.CODE) {
    return createDocBlock(DOC_BLOCK_TYPES.CODE, {
      id: block.id,
      ...normalizeCodeBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
    return createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT, {
      id: block.id,
      ...normalizePasswordVaultBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.LINK_VAULT) {
    return createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT, {
      id: block.id,
      ...normalizeLinkVaultBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.AGENT) {
    return createDocBlock(DOC_BLOCK_TYPES.AGENT, {
      id: block.id,
      ...normalizeAgentBlock(block),
    });
  }

  if (type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: block.id,
      ...normalizeStepSequenceBlock(block),
    });
  }

  const text = block.text || "";
  const mentions = normalizeMentions(text, block.mentions);
  const tagRefs = normalizeTagRefs(text, block.tagRefs);
  const libraryNameRefs = normalizeLibraryNameRefs(text, block.libraryNameRefs);
  const markerRanges = normalizeMarkerRanges(text, block.markerRanges);
  const boldRanges = normalizeBoldRanges(text, block.boldRanges);
  return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
    ...(block.id ? { id: block.id } : {}),
    text,
    ...(mentions.length ? { mentions } : {}),
    ...(tagRefs.length ? { tagRefs } : {}),
    ...(libraryNameRefs.length ? { libraryNameRefs } : {}),
    ...(markerRanges.length ? { markerRanges } : {}),
    ...(boldRanges.length ? { boldRanges } : {}),
    ...(block.embedded && typeof block.embedded === "object"
      ? { embedded: block.embedded }
      : {}),
    ...(block.macroNodeSlot ? { macroNodeSlot: block.macroNodeSlot } : {}),
  });
}

function mergeAdjacentTextBlocks(blocks) {
  const merged = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (
      block.type === DOC_BLOCK_TYPES.TEXT
      && prev?.type === DOC_BLOCK_TYPES.TEXT
      && !block.embedded
      && !prev.embedded
      && !block.macroNodeSlot
      && !prev.macroNodeSlot
    ) {
      const combined = mergeMentionBlocks(
        prev.text || "",
        prev.mentions || [],
        block.text || "",
        block.mentions || [],
        "\n",
      );
      const combinedTagRefs = mergeTagRefBlocks(
        prev.text || "",
        prev.tagRefs || [],
        block.text || "",
        block.tagRefs || [],
        "\n",
      );
      const combinedNames = mergeLibraryNameRefBlocks(
        prev.text || "",
        prev.libraryNameRefs || [],
        block.text || "",
        block.libraryNameRefs || [],
        "\n",
      );
      const combinedMarkers = mergeBlockMarkerRanges(
        { text: prev.text || "", markerRanges: prev.markerRanges || [] },
        { text: block.text || "", markerRanges: block.markerRanges || [] },
        "\n",
      );
      const combinedBolds = mergeBlockBoldRanges(prev, block);
      merged[merged.length - 1] = {
        ...prev,
        text: combined.text,
        ...(combined.mentions.length ? { mentions: combined.mentions } : { mentions: undefined }),
        ...(combinedTagRefs.tagRefs.length
          ? { tagRefs: combinedTagRefs.tagRefs }
          : { tagRefs: undefined }),
        ...(combinedNames.libraryNameRefs.length
          ? { libraryNameRefs: combinedNames.libraryNameRefs }
          : { libraryNameRefs: undefined }),
        ...(combinedMarkers.length ? { markerRanges: combinedMarkers } : { markerRanges: undefined }),
        ...(combinedBolds.length ? { boldRanges: combinedBolds } : { boldRanges: undefined }),
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
  if (block?.type !== DOC_BLOCK_TYPES.TEXT) return false;
  if (block.embedded?.kind) return false;
  return !(block.text || "").trim();
}

/** True when a single block carries user-authored content (not a default empty shell). */
export function docBlockHasContent(block) {
  if (!block || typeof block !== "object") return false;
  const type = block.type || DOC_BLOCK_TYPES.TEXT;

  if (type === DOC_BLOCK_TYPES.TEXT) {
    if (block.embedded?.kind) return true;
    return Boolean((block.text || "").trim());
  }
  if (type === DOC_BLOCK_TYPES.H1 || type === DOC_BLOCK_TYPES.H2 || type === DOC_BLOCK_TYPES.H3) {
    return Boolean((block.title || "").trim());
  }
  if (type === DOC_BLOCK_TYPES.TODO) {
    if ((block.listTitle || "").trim() && block.listTitle !== DEFAULT_CHECKBOX_LIST_TITLE) {
      return true;
    }
    return (block.items || []).some(
      (item) => Boolean((item.text || "").trim()) || Boolean(item.checked),
    );
  }
  if (type === DOC_BLOCK_TYPES.DATE) {
    return Boolean((block.date || "").trim());
  }
  if (type === DOC_BLOCK_TYPES.METRIC) {
    return block.value != null && String(block.value).trim() !== "";
  }
  if (type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    return Boolean(block.specsSaved)
      || Boolean((block.title || "").trim())
      || (Array.isArray(block.images) && block.images.some((img) => img?.src));
  }
  if (type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
    return Boolean((block.embedSrc || "").trim()) || Boolean(block.embedSaved);
  }
  if (type === DOC_BLOCK_TYPES.IMAGE) {
    return Boolean((block.src || "").trim()) || Boolean(block.imageSaved);
  }
  if (type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
    const hasTodo = block.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
      && (
        Boolean((block.todoListTitle || "").trim())
        || (Array.isArray(block.todoItems) && block.todoItems.some((item) =>
          Boolean((item?.text || "").trim()) || Boolean(item?.checked)
        ))
      );
    return Boolean((block.src || "").trim())
      || Boolean(block.imageSaved)
      || Boolean((block.libraryPrompt || "").trim())
      || Boolean(block.splitSaved)
      || Boolean((block.overlayTitle || "").trim())
      || Boolean((block.overlayDescription || "").trim())
      || Boolean((block.body || "").trim())
      || hasTodo;
  }
  if (type === DOC_BLOCK_TYPES.MOODBOARD) {
    const normalized = normalizeMoodboardBlock(block);
    return countMoodboardSavableContent(normalized) > 0
      || Boolean(normalized.moodboardSaved)
      || Boolean((normalized.caption || "").trim())
      || Boolean((normalized.body || "").trim())
      || normalized.columns.some((col) => Boolean(col.recipe)
        || Boolean((col.stickyText || "").trim())
        || Boolean((col.stickyTitle || "").trim())
        || Boolean((col.infoLabel || "").trim())
        || (Array.isArray(col.images) && col.images.some((img) => (
          img?.contentMode === MOODBOARD_SLOT_CONTENT_MODES.NOTE
          && (
            Boolean(String(img?.noteHeadline || "").trim())
            || Boolean(String(img?.noteBody || "").trim())
          )
        ))));
  }
  if (type === DOC_BLOCK_TYPES.BANNER) {
    return Boolean((block.src || "").trim())
      || Boolean(block.imageSaved)
      || Boolean(block.bannerSaved)
      || Boolean((block.headline || "").trim());
  }
  if (type === DOC_BLOCK_TYPES.CODE) {
    return Boolean((block.code || "").trim()) || Boolean(block.codeSaved);
  }
  if (type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
    return normalizePasswordEntries(block.entries).length > 0;
  }
  if (type === DOC_BLOCK_TYPES.LINK_VAULT) {
    return normalizeLinkEntries(block.entries).length > 0;
  }
  if (type === DOC_BLOCK_TYPES.AGENT) {
    return Boolean((block.instruction || "").trim());
  }
  if (type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    const normalized = normalizeStepSequenceBlock(block);
    if ((normalized.title || "").trim()) return true;
    if (normalized.saved) return true;
    return (normalized.steps || []).some(stepEntryHasContent);
  }
  return false;
}

/** True when the block list contains any user-authored content. */
export function docBlocksHaveContent(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  const normalized = normalizeDocBlocks(blocks);
  if (normalized.length === 0) return false;
  if (normalized.length === 1 && isEmptyTextBlock(normalized[0])) return false;
  return normalized.some(docBlockHasContent);
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

function parseVideoEmbedSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::videoembed")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) {
    return createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED);
  }
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED, { rawInput: payload });
  }
}

export function createEmbedVideoBlocks() {
  const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, { title: "" });
  const video = createDocBlock(DOC_BLOCK_TYPES.VIDEO_EMBED, { ownerH1Id: h1.id });
  return [h1, video];
}

export function getVideoEmbedBlockAfterH1(blocks, h1Index) {
  const normalized = normalizeDocBlocks(blocks);
  const next = normalized[h1Index + 1];
  if (next?.type === DOC_BLOCK_TYPES.VIDEO_EMBED) return next;
  return null;
}

export function h1HasVideoEmbedSibling(blocks, h1Index) {
  return Boolean(getVideoEmbedBlockAfterH1(blocks, h1Index));
}

export function replaceBlocksFromSlashWithEmbedVideo(blocks, blockIndex, textValue) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return normalized;

  const { prefix } = splitBodyForSlash(textValue);
  const [h1Block, videoBlock] = createEmbedVideoBlocks();

  const next = [...normalized];
  if (!prefix.trim()) {
    next.splice(blockIndex, 1, h1Block, videoBlock);
  } else {
    next[blockIndex] = normalizeDocBlock({ ...block, text: prefix });
    next.splice(blockIndex + 1, 0, h1Block, videoBlock);
  }
  return next;
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

function parseImageSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  // Exact ::image only — do not match ::image_split
  if (!/^::image(?:\s|$)/.test(first)) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.IMAGE);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE);
  }
}

function parseImageSplitSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::image_split")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT);
  }
}

function parseMoodboardSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::moodboard")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD);
  }
}

function parseBannerSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::banner")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.BANNER);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.BANNER, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.BANNER);
  }
}

function parseCodeSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::code")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) {
    return createDocBlock(DOC_BLOCK_TYPES.CODE, { language: DEFAULT_CODE_LANGUAGE, code: "" });
  }
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.CODE, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.CODE, { language: DEFAULT_CODE_LANGUAGE, code: payload });
  }
}

function parsePasswordVaultSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::password")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT);
  }
}

function parseLinkVaultSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::link")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT);
  }
}

function parseStepSequenceSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::stepsequence")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE);
  try {
    const parsed = JSON.parse(payload);
    return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, parsed);
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE);
  }
}

/** Text block with @mention snapshots (plain body cannot carry ranges). */
function parseTextMentionsSection(section) {
  const lines = section.split("\n");
  const first = lines[0]?.trim() || "";
  if (!first.startsWith("::textmeta")) return null;
  const payload = lines.slice(1).join("\n").trim();
  if (!payload) return createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
  try {
    const parsed = JSON.parse(payload);
    const text = String(parsed?.text ?? "");
    const mentions = normalizeMentions(text, parsed?.mentions);
    const tagRefs = normalizeTagRefs(text, parsed?.tagRefs);
    const libraryNameRefs = normalizeLibraryNameRefs(text, parsed?.libraryNameRefs);
    const markerRanges = normalizeMarkerRanges(text, parsed?.markerRanges);
    const boldRanges = normalizeBoldRanges(text, parsed?.boldRanges);
    return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
      text,
      ...(mentions.length ? { mentions } : {}),
      ...(tagRefs.length ? { tagRefs } : {}),
      ...(libraryNameRefs.length ? { libraryNameRefs } : {}),
      ...(markerRanges.length ? { markerRanges } : {}),
      ...(boldRanges.length ? { boldRanges } : {}),
      ...(parsed?.embedded && typeof parsed.embedded === "object"
        ? { embedded: parsed.embedded }
        : {}),
    });
  } catch {
    return createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: payload });
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

    if (firstLine.startsWith("### ")) {
      blocks.push(
        createDocBlock(DOC_BLOCK_TYPES.H3, {
          title: firstLine.slice(4).trim(),
        }),
      );
      const rest = section.split("\n").slice(1).join("\n").trim();
      if (rest) blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: rest }));
      continue;
    }

    if (firstLine.startsWith("## ")) {
      blocks.push(
        createDocBlock(DOC_BLOCK_TYPES.H2, {
          title: firstLine.slice(3).trim(),
        }),
      );
      const rest = section.split("\n").slice(1).join("\n").trim();
      if (rest) blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: rest }));
      continue;
    }

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

    const imageSplitBlock = parseImageSplitSection(section);
    if (imageSplitBlock) {
      blocks.push(imageSplitBlock);
      continue;
    }

    const moodboardBlock = parseMoodboardSection(section);
    if (moodboardBlock) {
      blocks.push(moodboardBlock);
      continue;
    }

    const bannerBlock = parseBannerSection(section);
    if (bannerBlock) {
      blocks.push(bannerBlock);
      continue;
    }

    const imageBlock = parseImageSection(section);
    if (imageBlock) {
      blocks.push(imageBlock);
      continue;
    }

    const codeBlock = parseCodeSection(section);
    if (codeBlock) {
      blocks.push(codeBlock);
      continue;
    }

    const passwordVaultBlock = parsePasswordVaultSection(section);
    if (passwordVaultBlock) {
      blocks.push(passwordVaultBlock);
      continue;
    }

    const linkVaultBlock = parseLinkVaultSection(section);
    if (linkVaultBlock) {
      blocks.push(linkVaultBlock);
      continue;
    }

    const stepSequenceBlock = parseStepSequenceSection(section);
    if (stepSequenceBlock) {
      blocks.push(stepSequenceBlock);
      continue;
    }

    const textMetaBlock = parseTextMentionsSection(section);
    if (textMetaBlock) {
      blocks.push(textMetaBlock);
      continue;
    }

    const videoEmbedBlock = parseVideoEmbedSection(section);
    if (videoEmbedBlock) {
      blocks.push(videoEmbedBlock);
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
      if (block.type === DOC_BLOCK_TYPES.H2) {
        return block.title ? `## ${block.title}` : "";
      }
      if (block.type === DOC_BLOCK_TYPES.H3) {
        return block.title ? `### ${block.title}` : "";
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
      if (block.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
        return `::videoembed\n${JSON.stringify({
          rawInput: block.rawInput || "",
          provider: block.provider || "unknown",
          videoId: block.videoId || "",
          embedSrc: block.embedSrc || "",
          ownerH1Id: block.ownerH1Id || null,
          embedSaved: Boolean(block.embedSaved),
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.IMAGE) {
        return `::image\n${JSON.stringify({
          src: block.src || "",
          name: block.name || "",
          alt: block.alt || "",
          width: block.width || 0,
          height: block.height || 0,
          imageSaved: Boolean(block.imageSaved),
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
        const normalized = normalizeImageSplitBlock(block);
        return `::image_split\n${JSON.stringify({
          overlayTitle: normalized.overlayTitle,
          overlayDescription: normalized.overlayDescription,
          src: normalized.src,
          name: normalized.name,
          alt: normalized.alt,
          width: normalized.width,
          height: normalized.height,
          imageSaved: normalized.imageSaved,
          libraryItemId: normalized.libraryItemId,
          libraryOwnerKind: normalized.libraryOwnerKind,
          libraryOwnerId: normalized.libraryOwnerId,
          libraryPrompt: normalized.libraryPrompt,
          libraryTag: normalized.libraryTag,
          wallColor: normalized.wallColor,
          mediaFace: normalized.mediaFace,
          body: normalized.body,
          bodyMode: normalized.bodyMode,
          todoListTitle: normalized.todoListTitle,
          todoItems: normalized.todoItems,
          splitSaved: normalized.splitSaved,
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.MOODBOARD) {
        const normalized = normalizeMoodboardBlock(block);
        return `::moodboard\n${JSON.stringify({
          caption: normalized.caption,
          boardLayout: normalized.boardLayout,
          boardSurface: normalized.boardSurface,
          columns: normalized.columns,
          body: normalized.body,
          ...(Array.isArray(normalized.tagRefs) && normalized.tagRefs.length > 0
            ? { tagRefs: normalized.tagRefs }
            : {}),
          ...(normalized.overlays.length > 0 ? { overlays: normalized.overlays } : {}),
          bodyMode: normalized.bodyMode,
          todoListTitle: normalized.todoListTitle,
          todoItems: normalized.todoItems,
          moodboardSaved: normalized.moodboardSaved,
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.BANNER) {
        const normalized = normalizeBannerBlock(block);
        return `::banner\n${JSON.stringify({
          headline: normalized.headline,
          src: normalized.src,
          name: normalized.name,
          alt: normalized.alt,
          width: normalized.width,
          height: normalized.height,
          imageSaved: normalized.imageSaved,
          bannerSaved: normalized.bannerSaved,
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.CODE) {
        return `::code\n${JSON.stringify({
          language: normalizeCodeLanguage(block.language),
          code: block.code || "",
          codeSaved: Boolean(block.codeSaved),
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
        return `::password\n${JSON.stringify({
          entries: normalizePasswordEntries(block.entries),
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.LINK_VAULT) {
        return `::link\n${JSON.stringify({
          entries: normalizeLinkEntries(block.entries),
        })}`;
      }
      if (block.type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
        const normalized = normalizeStepSequenceBlock(block);
        return `::stepsequence\n${JSON.stringify({
          title: normalized.title,
          steps: normalized.steps,
          saved: normalized.saved,
        })}`;
      }
      if (
        block.type === DOC_BLOCK_TYPES.TEXT
        && (
          (Array.isArray(block.mentions) && block.mentions.length > 0)
          || (Array.isArray(block.tagRefs) && block.tagRefs.length > 0)
          || (Array.isArray(block.libraryNameRefs) && block.libraryNameRefs.length > 0)
          || (Array.isArray(block.markerRanges) && block.markerRanges.length > 0)
          || (Array.isArray(block.boldRanges) && block.boldRanges.length > 0)
        )
      ) {
        return `::textmeta\n${JSON.stringify({
          text: block.text || "",
          ...(Array.isArray(block.mentions) && block.mentions.length > 0
            ? { mentions: block.mentions }
            : {}),
          ...(Array.isArray(block.tagRefs) && block.tagRefs.length > 0
            ? { tagRefs: block.tagRefs }
            : {}),
          ...(Array.isArray(block.libraryNameRefs) && block.libraryNameRefs.length > 0
            ? { libraryNameRefs: block.libraryNameRefs }
            : {}),
          ...(Array.isArray(block.markerRanges) && block.markerRanges.length > 0
            ? { markerRanges: block.markerRanges }
            : {}),
          ...(Array.isArray(block.boldRanges) && block.boldRanges.length > 0
            ? { boldRanges: block.boldRanges }
            : {}),
          ...(block.embedded && typeof block.embedded === "object"
            ? { embedded: block.embedded }
            : {}),
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

/** Removes H1 + immediate VIDEO_EMBED sibling (embedvideo pair). */
export function removeEmbedVideoPairAt(blocks, h1Index) {
  const normalized = normalizeDocBlocks(blocks);
  if (h1Index < 0 || h1Index >= normalized.length) return normalized;
  const h1 = normalized[h1Index];
  const video = normalized[h1Index + 1];
  if (h1?.type !== DOC_BLOCK_TYPES.H1 || video?.type !== DOC_BLOCK_TYPES.VIDEO_EMBED) {
    return removeBlockAt(normalized, h1Index);
  }
  return normalized.filter((_, i) => i !== h1Index && i !== h1Index + 1);
}

/** Removes embed pair when invoked from the video block index. */
export function removeEmbedVideoPairFromVideoIndex(blocks, videoIndex) {
  const normalized = normalizeDocBlocks(blocks);
  if (videoIndex <= 0 || videoIndex >= normalized.length) {
    return removeBlockAt(normalized, videoIndex);
  }
  const h1Index = videoIndex - 1;
  if (
    normalized[h1Index]?.type === DOC_BLOCK_TYPES.H1
    && normalized[videoIndex]?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
  ) {
    return removeEmbedVideoPairAt(normalized, h1Index);
  }
  return removeBlockAt(normalized, videoIndex);
}

export function replaceBlocksFromSlashInText(blocks, blockIndex, textValue, newBlock) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return normalized;

  const { prefix } = splitBodyForSlash(textValue);

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

  const { prefix } = splitBodyForSlash(fieldValue);
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

export function replaceBlocksFromSlashInImageSplitBody(blocks, blockIndex, bodyValue, newBlock) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.IMAGE_SPLIT) return normalized;

  const { prefix } = splitBodyForSlash(bodyValue);
  const next = [...normalized];
  next[blockIndex] = normalizeDocBlock({ ...block, body: prefix });
  next.splice(blockIndex + 1, 0, normalizeDocBlock(newBlock));
  return next;
}

export function replaceBlocksFromSlashInMoodboardBody(blocks, blockIndex, bodyValue, newBlock) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.MOODBOARD) return normalized;

  const { prefix } = splitBodyForSlash(bodyValue);
  const next = [...normalized];
  next[blockIndex] = normalizeDocBlock({ ...block, body: prefix });
  next.splice(blockIndex + 1, 0, normalizeDocBlock(newBlock));
  return next;
}

export function ensureEmptyTextBlockAfter(blocks, blockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return normalized;
  const current = normalized[blockIndex];
  const after = normalized[blockIndex + 1];
  if (
    current?.type === DOC_BLOCK_TYPES.H1
    && after?.type === DOC_BLOCK_TYPES.VIDEO_EMBED
  ) {
    return normalized;
  }
  if (isEmptyTextBlock(after)) return normalized;
  return insertBlockAfter(
    normalized,
    blockIndex,
    createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" }),
  );
}

/** Ensure the document ends with an empty text block so the user can keep writing. */
export function ensureWritableDocTail(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  if (!normalized.length) {
    return [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  }
  return ensureEmptyTextBlockAfter(normalized, normalized.length - 1);
}

/** @deprecated Use full blocks stack instead */
export function getActiveContentBlock(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  if (normalized.length === 0) return null;
  const block = normalized[0];
  if (
    block.type === DOC_BLOCK_TYPES.H1
    || block.type === DOC_BLOCK_TYPES.H2
    || block.type === DOC_BLOCK_TYPES.H3
    || block.type === DOC_BLOCK_TYPES.TODO
    || block.type === DOC_BLOCK_TYPES.DATE
    || block.type === DOC_BLOCK_TYPES.METRIC
    || block.type === DOC_BLOCK_TYPES.PRODUCT_CARD
    || block.type === DOC_BLOCK_TYPES.VIDEO_EMBED
    || block.type === DOC_BLOCK_TYPES.IMAGE
    || block.type === DOC_BLOCK_TYPES.IMAGE_SPLIT
    || block.type === DOC_BLOCK_TYPES.MOODBOARD
    || block.type === DOC_BLOCK_TYPES.BANNER
    || block.type === DOC_BLOCK_TYPES.CODE
    || block.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
    || block.type === DOC_BLOCK_TYPES.LINK_VAULT
    || block.type === DOC_BLOCK_TYPES.AGENT
    || block.type === DOC_BLOCK_TYPES.STEP_SEQUENCE
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
