import { DEFAULT_CODE_LANGUAGE, normalizeCodeLanguage } from "./codeBlockLanguages.js";
import { generateId } from "./ids.js";
import { NO_NODE_LINK_COLOR_ID, normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import { splitBodyForSlash } from "./docSlashTail.js";
import { mergeMentionBlocks, normalizeMentions } from "./docMentions.js";
import { normalizeAnchorFields } from "./nodeAnchor.js";
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
  return {
    id: generateId("TODO"),
    text: "",
    checked: false,
    ...patch,
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

export function createStepEntry(patch = {}) {
  return {
    id: patch.id || generateId("STEP"),
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
  const blocks = normalizeStepBlocks(step?.blocks);
  return blocks.some((block) => {
    if (block.type === DOC_BLOCK_TYPES.TEXT) return Boolean((block.text || "").trim());
    if (block.type === DOC_BLOCK_TYPES.CODE) {
      return Boolean((block.code || "").trim()) || Boolean(block.codeSaved);
    }
    return false;
  });
}

export function getStepPreviewText(step) {
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
  return {
    title: String(block?.title ?? ""),
    steps: normalizeStepSequenceSteps(block?.steps),
    saved: Boolean(block?.saved),
  };
}

/** Trim trailing empty steps and guarantee at least one step. */
export function finalizeStepSequence(steps) {
  const normalized = normalizeStepSequenceSteps(steps).map((step) => ({
    ...step,
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
      return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, {
        id,
        caption: String(block.overlayTitle || "").slice(0, MOODBOARD_CAPTION_MAX),
        a: {
          src: block.src || "",
          name: block.name || "",
          alt: block.alt || "",
          width: block.width || 0,
          height: block.height || 0,
          imageSaved,
        },
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
      return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, {
        id,
        caption: String(block.headline || "").slice(0, MOODBOARD_CAPTION_MAX),
        a: {
          src: block.src || "",
          name: block.name || "",
          alt: block.alt || "",
          width: block.width || 0,
          height: block.height || 0,
          imageSaved,
        },
        moodboardSaved: Boolean(block.bannerSaved && imageSaved),
        openFilePicker: false,
      });
    }
  }

  if (targetType === DOC_BLOCK_TYPES.IMAGE_SPLIT && block.type === DOC_BLOCK_TYPES.MOODBOARD) {
    const a = block.a || {};
    const imageSaved = Boolean(a.imageSaved && a.src);
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      id,
      overlayTitle: String(block.caption || "").slice(0, IMAGE_SPLIT_TITLE_MAX),
      overlayDescription: "",
      src: a.src || "",
      name: a.name || "",
      alt: a.alt || "",
      width: a.width || 0,
      height: a.height || 0,
      imageSaved,
      body: String(block.body || ""),
      bodyMode: block.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
        ? IMAGE_SPLIT_BODY_MODE.TODO
        : IMAGE_SPLIT_BODY_MODE.TEXT,
      todoListTitle: block.todoListTitle,
      todoItems: block.todoItems,
      splitSaved: Boolean(block.moodboardSaved && imageSaved),
      openFilePicker: false,
    });
  }

  if (targetType === DOC_BLOCK_TYPES.BANNER && block.type === DOC_BLOCK_TYPES.MOODBOARD) {
    const a = block.a || {};
    const imageSaved = Boolean(a.imageSaved && a.src);
    return createDocBlock(DOC_BLOCK_TYPES.BANNER, {
      id,
      headline: String(block.caption || "").slice(0, BANNER_HEADLINE_MAX),
      src: a.src || "",
      name: a.name || "",
      alt: a.alt || "",
      width: a.width || 0,
      height: a.height || 0,
      imageSaved,
      bannerSaved: Boolean(block.moodboardSaved && imageSaved),
      openFilePicker: false,
    });
  }

  return null;
}

function normalizeImageSplitBlock(block) {
  const title = String(block?.overlayTitle ?? block?.title ?? "").slice(0, IMAGE_SPLIT_TITLE_MAX);
  const description = String(block?.overlayDescription ?? block?.description ?? "")
    .slice(0, IMAGE_SPLIT_DESC_MAX);
  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  return {
    overlayTitle: title,
    overlayDescription: description,
    src: block?.src || "",
    name: block?.name || "",
    alt: block?.alt || "",
    width: Number.isFinite(block?.width) ? block.width : 0,
    height: Number.isFinite(block?.height) ? block.height : 0,
    imageSaved,
    openFilePicker: Boolean(block?.openFilePicker),
    body: String(block?.body ?? ""),
    bodyMode,
    todoListTitle: String(block?.todoListTitle ?? DEFAULT_CHECKBOX_LIST_TITLE),
    todoItems: bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
      ? normalizeEmbeddedTodoItems(block?.todoItems)
      : Array.isArray(block?.todoItems)
        ? normalizeEmbeddedTodoItems(block.todoItems)
        : [],
    splitSaved: Boolean(block?.splitSaved) && imageSaved,
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
  return {
    src,
    name: slot?.name || "",
    alt: slot?.alt || "",
    width: Number.isFinite(slot?.width) ? slot.width : 0,
    height: Number.isFinite(slot?.height) ? slot.height : 0,
    imageSaved: Boolean(slot?.imageSaved && src),
  };
}

function normalizeMoodboardBlock(block) {
  const a = normalizeMoodboardSlot(block?.a);
  const b = normalizeMoodboardSlot(block?.b);
  const bothSaved = Boolean(a.imageSaved && b.imageSaved);
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  return {
    caption: String(block?.caption ?? "").slice(0, MOODBOARD_CAPTION_MAX),
    a,
    b,
    body: String(block?.body ?? ""),
    bodyMode,
    todoListTitle: String(block?.todoListTitle ?? DEFAULT_CHECKBOX_LIST_TITLE),
    todoItems: bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
      ? normalizeEmbeddedTodoItems(block?.todoItems)
      : Array.isArray(block?.todoItems)
        ? normalizeEmbeddedTodoItems(block.todoItems)
        : [],
    openFilePicker: Boolean(block?.openFilePicker),
    moodboardSaved: Boolean(block?.moodboardSaved) && bothSaved,
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
    };
  }

  if (type === DOC_BLOCK_TYPES.H2 || type === DOC_BLOCK_TYPES.H3) {
    return {
      ...base,
      type,
      title: "",
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
  return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
    ...(block.id ? { id: block.id } : {}),
    text,
    ...(mentions.length ? { mentions } : {}),
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
      merged[merged.length - 1] = {
        ...prev,
        text: combined.text,
        ...(combined.mentions.length ? { mentions: combined.mentions } : { mentions: undefined }),
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
      || Boolean(block.splitSaved)
      || Boolean((block.overlayTitle || "").trim())
      || Boolean((block.overlayDescription || "").trim())
      || Boolean((block.body || "").trim())
      || hasTodo;
  }
  if (type === DOC_BLOCK_TYPES.MOODBOARD) {
    const normalized = normalizeMoodboardBlock(block);
    return Boolean(normalized.a.imageSaved)
      || Boolean(normalized.b.imageSaved)
      || Boolean(normalized.moodboardSaved)
      || Boolean((normalized.caption || "").trim())
      || Boolean((normalized.body || "").trim());
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
    return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
      text,
      ...(mentions.length ? { mentions } : {}),
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
          a: normalized.a,
          b: normalized.b,
          body: normalized.body,
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
        && Array.isArray(block.mentions)
        && block.mentions.length > 0
      ) {
        return `::textmeta\n${JSON.stringify({
          text: block.text || "",
          mentions: block.mentions,
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
