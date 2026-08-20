import { describe, expect, it } from "vitest";
import { validateCampaignDatetimes, buildCampaignChildScheduleFields } from "./campaignDates.js";

describe("validateCampaignDatetimes", () => {
  it("allows both empty (draft)", () => {
    expect(validateCampaignDatetimes("", "", "", "").ok).toBe(true);
  });

  it("allows only Activate At or only Target Launch", () => {
    expect(validateCampaignDatetimes("2026-07-20", "10:00", "", "").ok).toBe(true);
    expect(validateCampaignDatetimes("", "", "2026-07-22", "12:00").ok).toBe(true);
  });

  it("rejects Activate At after Target Launch", () => {
    const result = validateCampaignDatetimes(
      "2026-07-22",
      "15:00",
      "2026-07-22",
      "10:00",
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("activateAfterLaunch");
  });

  it("accepts Activate At equal to Target Launch", () => {
    expect(
      validateCampaignDatetimes("2026-07-22", "10:00", "2026-07-22", "10:00").ok,
    ).toBe(true);
  });

  it("builds child persist fields without copying launch into Date start", () => {
    const onlyLaunch = buildCampaignChildScheduleFields({
      launchDate: "2026-09-15",
      launchTime: "15:30",
      subcategory: "iPhone 18",
    });
    expect(onlyLaunch.ok).toBe(true);
    expect(onlyLaunch.windowStartAt).toBeNull();
    expect(onlyLaunch.launchAt).toBeTruthy();
    expect(onlyLaunch.windowEndAt).toBe(onlyLaunch.launchAt);
    expect(onlyLaunch.subcategory).toBe("iPhone 18");
  });

  it("rejects Date start after Launch", () => {
    const result = buildCampaignChildScheduleFields({
      announceDate: "2026-09-16",
      launchDate: "2026-09-15",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("activateAfterLaunch");
  });
});
