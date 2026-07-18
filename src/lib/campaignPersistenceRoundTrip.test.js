import { describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import { migrateCampaignWorkspaceDocs } from "./campaignWorkspaceMigration.js";

/**
 * Persistence columns map to camelCase fields on hydrate; this covers the
 * normalize + migrate path that applyStateToStores runs after fetch.
 */
describe("campaign persistence round-trip fields", () => {
  it("hydrates activate_at / campaign_completed from DB-shaped rows", () => {
    const hydrated = normalizeDoc({
      id: "c1",
      title: "Campaign",
      campaignActive: true,
      launch_at: "2026-08-01T12:00:00.000Z",
      activate_at: "2026-07-20T09:30:00.000Z",
      campaign_completed: true,
      launchAt: "2026-08-01T12:00:00.000Z",
    });
    // normalize prefers camelCase; snake_case activate is accepted as fallback.
    const fromSnake = normalizeDoc({
      id: "c2",
      campaignActive: true,
      launchAt: "2026-08-01T12:00:00.000Z",
      activate_at: "2026-07-20T09:30:00.000Z",
      campaign_completed: true,
    });
    expect(fromSnake.campaignActivateAt).toBe("2026-07-20T09:30:00.000Z");
    expect(fromSnake.campaignCompleted).toBe(true);
    expect(hydrated.campaignCompleted).toBe(true);
  });

  it("keeps schedule null for campaigns after migrate + normalize", () => {
    const { docs } = migrateCampaignWorkspaceDocs({
      c1: {
        id: "c1",
        campaignActive: true,
        launchAt: "2026-08-01T12:00:00.000Z",
        scheduleStartAt: null,
        scheduleFinishAt: null,
      },
    });
    const again = normalizeDoc(docs.c1);
    expect(again.campaignActivateAt).toBe("2026-08-01T12:00:00.000Z");
    expect(again.scheduleStartAt).toBeNull();
    expect(again.scheduleFinishAt).toBeNull();
    expect(again.launchAt).toBe("2026-08-01T12:00:00.000Z");
  });
});
