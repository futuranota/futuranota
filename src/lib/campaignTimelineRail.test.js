import { describe, expect, it } from "vitest";
import { startOfCalendarDay } from "../temporal.js";
import {
  clampTimelineLaunchNotBeforeToday,
  resolveCampaignFolderCreatedDate,
  resolveCampaignFolderTimelineDate,
  resolveTimelineDateNodeDate,
} from "./campaignTimelineRail.js";

describe("campaignTimelineRail", () => {
  const today = new Date(2026, 6, 19, 12, 0, 0);

  it("places the campaign folder chip on today (not launchAt)", () => {
    const doc = {
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
    const expected = startOfCalendarDay(today).getTime();
    expect(resolveCampaignFolderTimelineDate(doc, nodes, today)?.getTime()).toBe(expected);
    expect(resolveCampaignFolderCreatedDate(doc, today)?.getTime()).toBe(expected);
  });

  it("does not place Launch markers before today (no reverse)", () => {
    const past = new Date(2026, 6, 1, 12, 0, 0);
    const future = new Date(2026, 7, 2, 15, 0, 0);
    expect(clampTimelineLaunchNotBeforeToday(past, today)).toBeNull();
    expect(clampTimelineLaunchNotBeforeToday(future, today)?.getTime())
      .toBe(future.getTime());

    const pastLaunch = resolveTimelineDateNodeDate({
      canvasKind: "launch",
      launchAt: past.toISOString(),
    }, today);
    expect(pastLaunch).toBeNull();

    const futureLaunch = resolveTimelineDateNodeDate({
      canvasKind: "launch",
      launchAt: future.toISOString(),
    }, today);
    expect(futureLaunch?.getTime()).toBe(future.getTime());
  });
});
