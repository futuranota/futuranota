import { describe, expect, it } from "vitest";
import { migrateCampaignWorkspaceDocs } from "./campaignWorkspaceMigration.js";

describe("migrateCampaignWorkspaceDocs", () => {
  it("backfills Activate At from Target Launch without changing ids or content", () => {
    const docs = {
      c1: {
        id: "c1",
        title: "Google campaign",
        campaignActive: true,
        launchAt: "2026-08-01T12:00:00.000Z",
        body: "script body",
        blocks: [{ id: "b1", type: "paragraph", text: "hello" }],
        nodeIds: ["n1"],
        icon: "/uploads/File.svg",
        parentObjectId: "co1",
      },
      f1: {
        id: "f1",
        title: "Content folder",
        campaignActive: false,
        scheduleStartAt: "2026-07-20T12:00:00.000Z",
        scheduleFinishAt: "2026-07-22T12:00:00.000Z",
      },
    };

    const first = migrateCampaignWorkspaceDocs(docs);
    expect(first.changed).toBe(true);
    expect(first.migratedIds).toEqual(["c1"]);
    expect(first.docs.c1.id).toBe("c1");
    expect(first.docs.c1.campaignActivateAt).toBe("2026-08-01T12:00:00.000Z");
    expect(first.docs.c1.campaignCompleted).toBe(false);
    expect(first.docs.c1.body).toBe("script body");
    expect(first.docs.c1.blocks).toHaveLength(1);
    expect(first.docs.c1.nodeIds).toEqual(["n1"]);
    expect(first.docs.f1.scheduleStartAt).toBe("2026-07-20T12:00:00.000Z");

    const second = migrateCampaignWorkspaceDocs(first.docs);
    expect(second.changed).toBe(false);
    expect(second.migratedIds).toEqual([]);
    expect(second.docs.c1.campaignActivateAt).toBe("2026-08-01T12:00:00.000Z");
  });

  it("does not overwrite an existing Activate At", () => {
    const docs = {
      c1: {
        id: "c1",
        campaignActive: true,
        campaignActivateAt: "2026-07-10T09:00:00.000Z",
        launchAt: "2026-08-01T12:00:00.000Z",
        campaignCompleted: true,
      },
    };
    const result = migrateCampaignWorkspaceDocs(docs);
    expect(result.changed).toBe(false);
    expect(result.docs.c1.campaignActivateAt).toBe("2026-07-10T09:00:00.000Z");
    expect(result.docs.c1.campaignCompleted).toBe(true);
  });
});
