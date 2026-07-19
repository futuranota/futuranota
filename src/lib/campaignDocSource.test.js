import { describe, expect, it } from "vitest";
import {
  campaignDocInitials,
  canSetCampaignTimelineSource,
  resolveCampaignFolderSourceDate,
  resolveCampaignSourceMicroLabel,
  resolveCampaignSourceNode,
} from "./campaignDocSource.js";

describe("campaignDocSource", () => {
  const folder = {
    id: "folder-1",
    campaignActive: true,
    timelineSourceNodeId: "node-d",
    createdAt: "2026-01-01T12:00:00.000Z",
  };

  const nodes = {
    "node-a": {
      id: "node-a",
      parentDocId: "folder-1",
      title: "File A",
      campaignStatus: "inactive",
      launchAt: "2026-08-01T12:00:00.000Z",
    },
    "node-d": {
      id: "node-d",
      parentDocId: "folder-1",
      title: "Campaign D",
      campaignStatus: "active",
      launchAt: "2026-09-15T15:30:00.000Z",
    },
    "node-c": {
      id: "node-c",
      parentDocId: "folder-1",
      title: "Campaign C",
      campaignStatus: "active",
      launchAt: "2026-10-01T12:00:00.000Z",
    },
  };

  it("resolves active source launch date for the folder row", () => {
    const date = resolveCampaignFolderSourceDate(folder, nodes);
    expect(date?.toISOString()).toBe("2026-09-15T15:30:00.000Z");
  });

  it("ignores inactive source", () => {
    const inactiveSource = {
      ...folder,
      timelineSourceNodeId: "node-a",
    };
    expect(resolveCampaignFolderSourceDate(inactiveSource, nodes)).toBeNull();
  });

  it("builds micro initials from source title", () => {
    expect(resolveCampaignSourceMicroLabel(folder, nodes)).toBe("CD");
    expect(campaignDocInitials("Campaign IG")).toBe("CI");
  });

  it("only allows active children as timeline source", () => {
    expect(canSetCampaignTimelineSource(folder, nodes["node-d"])).toBe(true);
    expect(canSetCampaignTimelineSource(folder, nodes["node-a"])).toBe(false);
    expect(resolveCampaignSourceNode(folder, nodes)?.id).toBe("node-d");
  });
});
