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

  it("spawns and keeps the Launch node for active campaigns", () => {
    const docs = {
      docA: makeContentDoc("docA", {
        campaignActive: true,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const next = syncContentDocCanvasNodes([docNode], docs);
    const launch = next.find((n) => n.canvasKind === "launch");
    expect(launch).toBeTruthy();
    expect(launch.parentDocId).toBe("docA");
  });

  it("respawns the Launch node with the same id so timeline refs survive", () => {
    // Insert on timeline → node removed (e.g. campaign toggled off) → toggled
    // back on. The new node must reuse the id referenced by timelineDateNodeIds.
    const campaignDocs = {
      docA: makeContentDoc("docA", {
        campaignActive: true,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const first = syncContentDocCanvasNodes([docNode], campaignDocs);
    const firstLaunch = first.find((n) => n.canvasKind === "launch");
    expect(firstLaunch).toBeTruthy();

    const offDocs = {
      docA: makeContentDoc("docA", {
        campaignActive: false,
        launchAt: "2026-07-26T12:00:00.000Z",
      }),
    };
    const removed = syncContentDocCanvasNodes(first, offDocs);
    expect(removed.some((n) => n.canvasKind === "launch")).toBe(false);

    const restored = syncContentDocCanvasNodes(removed, campaignDocs);
    const restoredLaunch = restored.find((n) => n.canvasKind === "launch");
    expect(restoredLaunch).toBeTruthy();
    expect(restoredLaunch.id).toBe(firstLaunch.id);
  });
});
