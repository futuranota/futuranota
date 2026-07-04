import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
} from "../docBlocks.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";

/**
 * @param {string} docId
 * @param {object} output
 * @param {string} reportKind
 * @param {string[]} [extraTextParts]
 */
export function applyAgentPlanOutputToDoc(docId, output, reportKind, extraTextParts = []) {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc || !output) return false;

  const blocksToAppend = [];

  const headline = String(output.writtenContent?.headline || "").trim();
  const body = String(output.writtenContent?.body || "").trim();

  if (headline) {
    blocksToAppend.push(createDocBlock(DOC_BLOCK_TYPES.H1, { title: headline }));
  }

  if (body) {
    for (const section of body.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)) {
      blocksToAppend.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: section }));
    }
  }

  const items = (output.items || [])
    .map((item) => createTodoItem({
      text: String(item?.text || "").trim(),
      checked: false,
    }))
    .filter((item) => item.text);

  if (items.length > 0) {
    blocksToAppend.push(createDocBlock(DOC_BLOCK_TYPES.TODO, {
      listTitle: String(output.listTitle || "").trim(),
      items,
    }));
  }

  const textParts = [
    ...extraTextParts,
    output.nextStepsMessage,
  ].map((part) => String(part || "").trim()).filter(Boolean);

  if (textParts.length > 0) {
    blocksToAppend.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, {
      text: textParts.join("\n\n"),
    }));
  }

  if (blocksToAppend.length === 0) return false;

  const draft = useUIStateStore.getState().docEditorDrafts[docId];
  const existingBlocks = normalizeDocBlocks(
    draft?.blocks?.length
      ? draft.blocks
      : (Array.isArray(doc.blocks) && doc.blocks.length > 0
        ? doc.blocks
        : docBlocksFromBody(doc.body || doc.content || "")),
  );

  const newBlocks = [...existingBlocks, ...blocksToAppend];
  const bodyText = docBlocksToBody(newBlocks);

  store.updateDoc(docId, {
    blocks: newBlocks,
    content: bodyText,
    body: bodyText,
    reportPresentation: {
      kind: reportKind,
      animateOnOpen: true,
      animatedAt: null,
    },
  });

  useUIStateStore.getState().clearDocEditorDraft(docId);
  return true;
}
