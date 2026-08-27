import { describe, expect, it } from "vitest";
import { mergeEntityMapsPreferNewer } from "./mergeEntityMapsPreferNewer.js";
import {
  isLinkedFolderChildNode,
  nodeEntityPersistedContentCharCount,
  nodeHasPersistedContent,
} from "./nodePersistedContentScore.js";

const richLocal = {
  id: "NODE-1",
  parentDocId: "DOC-FOLDER",
  linkedToDoc: true,
  title: "Code doc",
  updatedAt: "2026-08-27T04:00:00.000Z",
  content: {
    kind: "node-body",
    blocks: [
      {
        type: "code",
        language: "tsx",
        code: "export function Toggle() { return <button /> }",
        codeSaved: true,
      },
    ],
  },
};

const remoteStub = {
  id: "NODE-1",
  parentDocId: "DOC-FOLDER",
  title: "Code doc",
  updatedAt: "2026-08-27T05:00:00.000Z",
  content: "",
};

describe("mergeEntityMapsPreferNewer preferRicherContent", () => {
  it("keeps richer local node-body when remote stub is newer", () => {
    const merged = mergeEntityMapsPreferNewer(
      { "NODE-1": remoteStub },
      { "NODE-1": richLocal },
      nodeEntityPersistedContentCharCount,
      { preferRicherContent: true, lastSyncedAt: "2026-08-27T05:30:00.000Z" },
    );
    expect(merged["NODE-1"]).toBe(richLocal);
    expect(nodeEntityPersistedContentCharCount(merged["NODE-1"]))
      .toBeGreaterThan(nodeEntityPersistedContentCharCount(remoteStub));
  });
});

describe("mergeEntityMapsPreferNewer shouldKeepLocalOnly", () => {
  it("keeps linked local-only node when updatedAt ≤ lastSyncedAt", () => {
    const merged = mergeEntityMapsPreferNewer(
      { "OTHER": { id: "OTHER", title: "x", updatedAt: "2026-08-27T05:00:00.000Z", content: "hi" } },
      { "NODE-1": richLocal },
      nodeEntityPersistedContentCharCount,
      {
        lastSyncedAt: "2026-08-27T05:30:00.000Z",
        shouldKeepLocalOnly: (node) =>
          nodeHasPersistedContent(node) && isLinkedFolderChildNode(node),
      },
    );
    expect(merged["NODE-1"]).toBe(richLocal);
  });

  it("drops unlinked local-only stale node without keep predicate match", () => {
    const orphan = {
      id: "NODE-ORPHAN",
      title: "orphan",
      updatedAt: "2026-08-27T04:00:00.000Z",
      content: "text",
    };
    const merged = mergeEntityMapsPreferNewer(
      { "OTHER": { id: "OTHER", title: "x", updatedAt: "2026-08-27T05:00:00.000Z", content: "hi" } },
      { "NODE-ORPHAN": orphan },
      nodeEntityPersistedContentCharCount,
      {
        lastSyncedAt: "2026-08-27T05:30:00.000Z",
        shouldKeepLocalOnly: (node) =>
          nodeHasPersistedContent(node) && isLinkedFolderChildNode(node),
      },
    );
    expect(merged["NODE-ORPHAN"]).toBeUndefined();
  });
});
