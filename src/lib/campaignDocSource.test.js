import { describe, expect, it } from "vitest";
import {
  campaignDocInitials,
  campaignLaunchCanvasNodeId,
  canSetCampaignTimelineSource,
  isCampaignSourceLaunchDateNode,
  isCampaignTimelineFileInsert,
  replaceCampaignFoldersInTimelineQueue,
  resolveCampaignFolderSourceDate,
  resolveCampaignSourceMicroLabel,
  resolveCampaignSourceNode,
  syncCampaignFolderLaunchDateQueue,
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

  it("allows any child file under the folder as timeline source (insert switch)", () => {
    expect(canSetCampaignTimelineSource(folder, nodes["node-d"])).toBe(true);
    expect(canSetCampaignTimelineSource(folder, nodes["node-a"])).toBe(true);
    expect(resolveCampaignSourceNode(folder, nodes)?.id).toBe("node-d");
  });

  it("requires a file entity for campaign timeline insert", () => {
    expect(isCampaignTimelineFileInsert(
      { noteId: "node-d" },
      nodes,
      { "folder-1": folder },
    )).toBe(true);
    expect(isCampaignTimelineFileInsert(
      { canvasKind: "document", docId: "folder-1" },
      nodes,
      { "folder-1": folder },
    )).toBe(false);
  });

  it("keeps only one campaign folder in the timeline queue", () => {
    const docs = {
      "folder-1": { campaignActive: true },
      "folder-2": { campaignActive: true },
      content: { campaignActive: false },
    };
    const { queue, removed } = replaceCampaignFoldersInTimelineQueue(
      ["content", "folder-1", "folder-2"],
      docs,
      "folder-2",
    );
    expect(queue).toEqual(["content", "folder-2"]);
    expect(removed).toEqual(["folder-1"]);
  });

  it("switches Launch date type when the source file changes", () => {
    const launchA = campaignLaunchCanvasNodeId("node-a");
    const launchD = campaignLaunchCanvasNodeId("node-d");
    const canvasNodes = [
      { id: launchA, canvasKind: "launch", parentDocId: "folder-1", sourceNodeId: "node-a" },
      { id: launchD, canvasKind: "launch", parentDocId: "folder-1", sourceNodeId: "node-d" },
      { id: "CN-date-other", dataType: "date", parentDocId: "content" },
    ];
    const next = syncCampaignFolderLaunchDateQueue(
      [launchA, "CN-date-other"],
      { folderDocId: "folder-1", sourceEntityId: "node-d", canvasNodes },
    );
    expect(next).toContain(launchD);
    expect(next).toContain("CN-date-other");
    expect(next).not.toContain(launchA);
    expect(isCampaignSourceLaunchDateNode(
      { id: launchD, canvasKind: "launch", sourceNodeId: "node-d" },
      folder,
    )).toBe(true);
    expect(isCampaignSourceLaunchDateNode(
      { id: launchA, canvasKind: "launch", sourceNodeId: "node-a" },
      folder,
    )).toBe(false);
  });
});
