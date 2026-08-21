import { describe, expect, it, vi } from "vitest";
import {
  appendCapturedTextToStepPlaybook,
  appendPromptToStepEntries,
  findStepPlaybookForSourceDocument,
} from "./appendCapturedTextToStepPlaybook.js";
import {
  createDocBlock,
  createStepEntry,
  DOC_BLOCK_TYPES,
} from "./docBlocks.js";
import {
  persistStepPlaybookSession,
  stepPlaybookSessionFromRef,
} from "./stepPlaybookSession.js";

describe("appendPromptToStepEntries", () => {
  it("fills an empty trailing step", () => {
    const { steps, changed, stepIndex } = appendPromptToStepEntries(
      [createStepEntry()],
      "Do the pour shot",
    );
    expect(changed).toBe(true);
    expect(stepIndex).toBe(0);
    expect(steps[0].prompt).toBe("Do the pour shot");
  });

  it("appends after a filled step", () => {
    const { steps, stepIndex } = appendPromptToStepEntries(
      [createStepEntry({ prompt: "First" })],
      "Second",
    );
    expect(steps).toHaveLength(2);
    expect(stepIndex).toBe(1);
    expect(steps[1].prompt).toBe("Second");
  });
});

describe("findStepPlaybookForSourceDocument", () => {
  it("matches by sourceDocumentId even when block is unsaved", () => {
    const block = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: "BLK_1",
      title: "Story",
      saved: false,
      sourceDocumentId: "NODE_1",
      steps: [createStepEntry({ prompt: "First" })],
    });
    const docs = {
      DOC_1: {
        id: "DOC_1",
        title: "Story",
        parentObjectId: "OBJ_1",
        blocks: [block],
      },
    };
    const found = findStepPlaybookForSourceDocument(docs, "NODE_1", "OBJ_1");
    expect(found?.docId).toBe("DOC_1");
    expect(found?.blockId).toBe("BLK_1");
  });
});

describe("appendCapturedTextToStepPlaybook", () => {
  it("creates a playbook linked to the source document", () => {
    const addDoc = vi.fn(() => "DOC_NEW");
    const updateDoc = vi.fn();
    const result = appendCapturedTextToStepPlaybook({
      promptText: "A kid pours cereal",
      sourceDocumentId: "NODE_1",
      documentTitle: "Kling Ai Cereal Ad",
      objectId: "OBJ_1",
      docs: {},
      objects: { OBJ_1: { name: "Marketing" } },
      addDoc,
      updateDoc,
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(addDoc).toHaveBeenCalled();
    const blocks = addDoc.mock.calls[0][6];
    expect(blocks[0].type).toBe(DOC_BLOCK_TYPES.STEP_SEQUENCE);
    expect(blocks[0].sourceDocumentId).toBe("NODE_1");
    expect(blocks[0].title).toBe("Kling Ai Cereal Ad");
    expect(blocks[0].steps[0].prompt).toBe("A kid pours cereal");
  });

  it("appends into an existing source-linked playbook", () => {
    const block = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: "BLK_1",
      title: "Kling Ai Cereal Ad",
      saved: true,
      sourceDocumentId: "NODE_1",
      steps: [createStepEntry({ prompt: "First" })],
    });
    const docs = {
      DOC_1: {
        id: "DOC_1",
        title: "Kling Ai Cereal Ad",
        parentObjectId: "OBJ_1",
        blocks: [block],
      },
    };
    const updateDoc = vi.fn();
    const addDoc = vi.fn();
    const found = findStepPlaybookForSourceDocument(docs, "NODE_1", "OBJ_1");
    expect(found?.docId).toBe("DOC_1");

    const result = appendCapturedTextToStepPlaybook({
      promptText: "Second beat",
      sourceDocumentId: "NODE_1",
      documentTitle: "Kling Ai Cereal Ad",
      objectId: "OBJ_1",
      docs,
      objects: {},
      addDoc,
      updateDoc,
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.docId).toBe("DOC_1");
    expect(result.stepIndex).toBe(1);
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalled();
    const nextBlocks = updateDoc.mock.calls[0][1].blocks;
    expect(nextBlocks[0].steps).toHaveLength(2);
    expect(nextBlocks[0].steps[1].prompt).toBe("Second beat");
  });

  it("still appends after persist keeps sourceDocumentId (no second playbook)", () => {
    const block = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: "BLK_1",
      title: "Story",
      saved: true,
      sourceDocumentId: "NODE_1",
      steps: [createStepEntry({ prompt: "First" })],
    });
    let docs = {
      DOC_1: {
        id: "DOC_1",
        title: "Story",
        parentObjectId: "OBJ_1",
        blocks: [block],
      },
    };

    const session = stepPlaybookSessionFromRef({
      id: "DOC_1:BLK_1",
      docId: "DOC_1",
      blockId: "BLK_1",
      title: "Story",
      preview: "",
      stepCount: 1,
      objectId: "OBJ_1",
      docKind: "standard",
      category: "",
      steps: block.steps,
      sourceDocumentId: "NODE_1",
    }, { saved: false });

    expect(session.sourceDocumentId).toBe("NODE_1");

    const updateDoc = vi.fn((id, patch) => {
      docs = {
        ...docs,
        [id]: { ...docs[id], ...patch },
      };
    });
    const addDoc = vi.fn();

    persistStepPlaybookSession(
      { ...session, steps: [createStepEntry({ prompt: "First polished" })], saved: true },
      {
        addDoc,
        updateDoc,
        docs,
        objects: { OBJ_1: { name: "Marketing" } },
        defaultTitle: "Step by step",
      },
    );

    expect(addDoc).not.toHaveBeenCalled();
    expect(docs.DOC_1.blocks[0].sourceDocumentId).toBe("NODE_1");

    const result = appendCapturedTextToStepPlaybook({
      promptText: "Second beat",
      sourceDocumentId: "NODE_1",
      documentTitle: "Story",
      objectId: "OBJ_1",
      docs,
      objects: {},
      addDoc,
      updateDoc,
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.docId).toBe("DOC_1");
    expect(result.stepIndex).toBe(1);
    expect(addDoc).not.toHaveBeenCalled();
  });
});
