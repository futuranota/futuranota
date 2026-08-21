import { describe, expect, it, vi, beforeEach } from "vitest";
import { collectWorkspaceExportSnapshot } from "./exportWorkspaceDataZip.js";

vi.mock("../stores/authStore.js", () => ({
  useAuthStore: {
    getState: () => ({ user: { id: "u1", email: "a@b.com" } }),
  },
}));

vi.mock("../stores/objectsStore.js", () => ({
  useObjectsStore: {
    getState: () => ({ objects: { o1: { id: "o1", name: "Acme" } } }),
  },
}));

vi.mock("../stores/docsStore.js", () => ({
  useDocsStore: {
    getState: () => ({ docs: { d1: { id: "d1", title: "Folder" } } }),
  },
}));

vi.mock("../stores/nodesStore.js", () => ({
  useNodesStore: {
    getState: () => ({
      nodes: {
        n1: {
          id: "n1",
          content: {
                kind: "node-body",
                blocks: [
              {
                id: "pw1",
                type: "password_vault",
                entries: [{ id: "e1", description: "Admin", password: "hunter2-xyz" }],
              },
            ],
          },
        },
      },
    }),
  },
}));

vi.mock("../stores/canvasStore.js", () => ({
  useCanvasStore: {
    getState: () => ({
      canvasNodes: {},
      canvasConnections: {},
      groupings: {},
    }),
  },
}));

vi.mock("../stores/timelineStore.js", () => ({
  useTimelineStore: {
    getState: () => ({ timelines: {} }),
  },
}));

describe("collectWorkspaceExportSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds manifest counts and redacts password vault secrets", () => {
    const snap = collectWorkspaceExportSnapshot();
    expect(snap.manifest.kind).toBe("futuranota.workspace-export");
    expect(snap.manifest.counts.objects).toBe(1);
    expect(snap.manifest.counts.docs).toBe(1);
    expect(snap.manifest.counts.nodes).toBe(1);
    const entry = snap.nodes.n1.content.blocks[0].entries[0];
    expect(entry.password).toBe("[omitted]");
    expect(JSON.stringify(snap)).not.toContain("hunter2-xyz");
  });
});
