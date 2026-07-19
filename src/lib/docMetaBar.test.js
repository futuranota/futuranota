import { describe, expect, it } from "vitest";
import {
  buildMetaBarFromDoc,
  buildMetaBarFromCanvas,
  resolveCampaignFolderFromTimelineQueue,
} from "./docMetaBar.js";

describe("docMetaBar campaign source child", () => {
  const today = new Date(2026, 6, 19, 12, 0, 0);
  const folder = {
    id: "folder-1",
    campaignActive: true,
    category: "Beer",
    parentObjectId: "obj-1",
    timelineSourceNodeId: "node-d",
    launchAt: "2026-01-01T12:00:00.000Z",
    subcategoryDocIds: [],
  };
  const objectsById = {
    "obj-1": { id: "obj-1", name: "Futura nota", brand: "Admin" },
  };
  const nodes = {
    "node-d": {
      id: "node-d",
      parentDocId: "folder-1",
      campaignStatus: "active",
      launchAt: "2026-08-02T15:00:00.000Z",
      windowStartAt: "2026-08-02T15:00:00.000Z",
      windowEndAt: "2026-08-11T15:00:00.000Z",
    },
  };

  it("reads CAMPAIGN/LAUNCH/WINDOW from source child, not folder.launchAt", () => {
    const meta = buildMetaBarFromDoc({
      doc: folder,
      objectsById,
      selectedObjectId: "obj-1",
      nodeEntitiesById: nodes,
      today,
    });
    expect(meta.corpus).toBe("Futura nota");
    expect(meta.brand).toBe("Admin");
    expect(meta.product).toBe("Beer");
    expect(meta.campaign).toBe("active");
    expect(meta.launch).toMatch(/08/);
    expect(meta.window).toBe("9 days");
  });

  it("leaves CAMPAIGN/LAUNCH empty when campaign folder has no source", () => {
    const meta = buildMetaBarFromDoc({
      doc: { ...folder, timelineSourceNodeId: null, launchAt: "2026-09-01T12:00:00.000Z" },
      objectsById,
      selectedObjectId: "obj-1",
      nodeEntitiesById: {},
      today,
    });
    expect(meta.campaign).toBeNull();
    expect(meta.launch).toBeNull();
    expect(meta.window).toBeNull();
    expect(meta.product).toBe("Beer");
  });

  it("resolves campaign folder from timeline queue for MetaBar", () => {
    const docs = { "folder-1": folder, content: { id: "content", campaignActive: false } };
    expect(resolveCampaignFolderFromTimelineQueue(["content", "folder-1"], docs)?.id)
      .toBe("folder-1");
    const meta = buildMetaBarFromCanvas({
      selection: [],
      canvasNodes: [],
      docs,
      objectsById,
      selectedObjectId: "obj-1",
      timelineDocQueue: ["folder-1"],
      nodeEntitiesById: nodes,
      today,
    });
    expect(meta.campaign).toBe("active");
    expect(meta.launch).toBeTruthy();
  });
});
