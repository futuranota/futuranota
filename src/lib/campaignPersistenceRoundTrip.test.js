import { describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import { migrateCampaignWorkspaceDocs } from "./campaignWorkspaceMigration.js";

/**
 * Persistence columns map to camelCase fields on hydrate; this covers the
 * normalize + migrate path that applyStateToStores runs after fetch.
 */
describe("campaign persistence round-trip fields", () => {
  it("does not map folder activate_at — Date start lives on the child document", () => {
    const fromSnake = normalizeDoc({
      id: "c2",
      campaignActive: true,
      launchAt: "2026-08-01T12:00:00.000Z",
      activate_at: "2026-07-20T09:30:00.000Z",
      campaign_completed: true,
    });
    expect(fromSnake.campaignActivateAt).toBeUndefined();
    expect(fromSnake.launchAt).toBe("2026-08-01T12:00:00.000Z");
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
