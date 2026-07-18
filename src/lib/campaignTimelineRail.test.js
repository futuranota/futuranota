import { describe, expect, it } from "vitest";
import {
  buildCampaignTimelineMarkers,
  resolveCampaignActivateDate,
} from "./campaignTimelineRail.js";

describe("campaignTimelineRail", () => {
  it("resolves Activate At only for campaign files", () => {
    expect(resolveCampaignActivateDate({
      campaignActive: true,
      campaignActivateAt: "2026-07-20T10:00:00.000Z",
    })?.toISOString()).toBe("2026-07-20T10:00:00.000Z");
    expect(resolveCampaignActivateDate({
      campaignActive: true,
      launchAt: "2026-08-01T12:00:00.000Z",
    })).toBeNull();
    expect(resolveCampaignActivateDate({
      campaignActive: false,
      campaignActivateAt: "2026-07-20T10:00:00.000Z",
    })).toBeNull();
  });

  it("builds activation + Target Launch markers and spans", () => {
    const { markers, spans } = buildCampaignTimelineMarkers({
      objectId: "co1",
      timelineDocQueue: ["c1", "c2", "other"],
      docsById: {
        c1: {
          id: "c1",
          parentObjectId: "co1",
          campaignActive: true,
          campaignActivateAt: "2026-07-20T10:00:00.000Z",
          launchAt: "2026-07-25T12:00:00.000Z",
          campaignCompleted: true,
        },
        c2: {
          id: "c2",
          parentObjectId: "co1",
          campaignActive: true,
          campaignActivateAt: "2026-07-21T09:00:00.000Z",
        },
        other: {
          id: "other",
          parentObjectId: "co1",
          campaignActive: false,
          scheduleStartAt: "2026-07-20T12:00:00.000Z",
        },
      },
    });

    expect(markers).toHaveLength(3);
    expect(markers[0].campaignMarkerKind).toBe("activation");
    expect(markers[0].completed).toBe(true);
    expect(markers[1].campaignMarkerKind).toBe("target-launch");
    expect(markers[1].title).toBe("Target Launch");
    expect(markers[2].docId).toBe("c2");
    expect(spans).toHaveLength(1);
    expect(spans[0].docId).toBe("c1");
  });
});
