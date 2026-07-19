import { describe, expect, it } from "vitest";
import {
  resolveCampaignFolderCreatedDate,
  resolveCampaignFolderTimelineDate,
} from "./campaignTimelineRail.js";

describe("campaignTimelineRail", () => {
  it("falls back to Created when no active source launch", () => {
    const doc = {
      campaignActive: true,
      createdAt: "2026-07-10T12:00:00.000Z",
      timelineSourceNodeId: null,
    };
    expect(resolveCampaignFolderCreatedDate(doc)?.toISOString())
      .toBe("2026-07-10T12:00:00.000Z");
    expect(resolveCampaignFolderTimelineDate(doc, {})?.toISOString())
      .toBe("2026-07-10T12:00:00.000Z");
  });

  it("prefers active source document launchAt over Created", () => {
    const doc = {
      id: "folder-1",
      campaignActive: true,
      createdAt: "2026-07-10T12:00:00.000Z",
      timelineSourceNodeId: "node-d",
    };
    const nodes = {
      "node-d": {
        id: "node-d",
        parentDocId: "folder-1",
        campaignStatus: "active",
        launchAt: "2026-09-15T15:30:00.000Z",
      },
    };
    expect(resolveCampaignFolderTimelineDate(doc, nodes)?.toISOString())
      .toBe("2026-09-15T15:30:00.000Z");
  });

  it("ignores inactive source and falls back to Created", () => {
    const doc = {
      id: "folder-1",
      campaignActive: true,
      createdAt: "2026-07-10T12:00:00.000Z",
      timelineSourceNodeId: "node-a",
    };
    const nodes = {
      "node-a": {
        id: "node-a",
        parentDocId: "folder-1",
        campaignStatus: "inactive",
        launchAt: "2026-09-15T15:30:00.000Z",
      },
    };
    expect(resolveCampaignFolderTimelineDate(doc, nodes)?.toISOString())
      .toBe("2026-07-10T12:00:00.000Z");
  });
});
