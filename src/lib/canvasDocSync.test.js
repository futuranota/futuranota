import { describe, expect, it } from "vitest";
import { syncContentDocCanvasNodes } from "./canvasDocSync.js";

function makeContentDoc(id, extra = {}) {
  return {
    id,
    title: id,
    docKind: "content",
    blocks: [],
    ...extra,
  };
}

describe("Launch canvas nodes are campaigns-only", () => {
  const docNode = {
    id: "cn-doc",
    canvasKind: "document",
    dataType: "document",
    docId: "docA",
    noteId: "docA",
    x: 0,
    y: 0,
  };

  const sourceEntity = {
    id: "node-d",
    parentDocId: "docA",
    campaignStatus: "active",
    launchAt: "2026-07-26T12:00:00.000Z",
  };

  it("does not spawn a Launch node from a Schedule on a non-campaign folder", () => {
    const docs = {
      docA: makeContentDoc("docA", {
        campaignActive: false,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const next = syncContentDocCanvasNodes([docNode], docs);
    expect(next.some((n) => n.canvasKind === "launch")).toBe(false);
  });

  it("removes an existing Launch node when the folder is not a campaign", () => {
    const docs = {
      docA: makeContentDoc("docA", {
        campaignActive: false,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const launchNode = {
      id: "cn-launch",
      canvasKind: "launch",
      dataType: "date",
      parentDocId: "docA",
      content: "2026-07-26",
      launchAt: "2026-07-26T12:00:00.000Z",
    };
    const next = syncContentDocCanvasNodes([docNode, launchNode], docs);
    expect(next.some((n) => n.id === "cn-launch")).toBe(false);
  });

  it("spawns Launch from the source child doc, not folder.launchAt", () => {
    const docs = {
      docA: makeContentDoc("docA", {
        campaignActive: true,
        timelineSourceNodeId: "node-d",
        launchAt: null,
      }),
    };
    const next = syncContentDocCanvasNodes([docNode], docs, {
      nodeEntitiesById: { "node-d": sourceEntity },
    });
    const launch = next.find((n) => n.canvasKind === "launch");
    expect(launch).toBeTruthy();
    expect(launch.parentDocId).toBe("docA");
    expect(launch.sourceNodeId).toBe("node-d");
  });

  it("does not spawn Launch when campaign folder has no source child launch", () => {
    const docs = {
      docA: makeContentDoc("docA", {
        campaignActive: true,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const next = syncContentDocCanvasNodes([docNode], docs);
    expect(next.some((n) => n.canvasKind === "launch")).toBe(false);
  });

  it("respawns the Launch node with the same id so timeline refs survive", () => {
    const campaignDocs = {
      docA: makeContentDoc("docA", {
        campaignActive: true,
        timelineSourceNodeId: "node-d",
      }),
    };
    const opts = { nodeEntitiesById: { "node-d": sourceEntity } };
    const first = syncContentDocCanvasNodes([docNode], campaignDocs, opts);
    const firstLaunch = first.find((n) => n.canvasKind === "launch");
    expect(firstLaunch).toBeTruthy();

    const offDocs = {
      docA: makeContentDoc("docA", {
        campaignActive: false,
        timelineSourceNodeId: "node-d",
      }),
    };
    const removed = syncContentDocCanvasNodes(first, offDocs, opts);
    expect(removed.some((n) => n.canvasKind === "launch")).toBe(false);

    const restored = syncContentDocCanvasNodes(removed, campaignDocs, opts);
    const restoredLaunch = restored.find((n) => n.canvasKind === "launch");
    expect(restoredLaunch).toBeTruthy();
    expect(restoredLaunch.id).toBe(firstLaunch.id);
  });
});
