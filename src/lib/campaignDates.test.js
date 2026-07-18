import { describe, expect, it } from "vitest";
import { validateCampaignDatetimes } from "./campaignDates.js";

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
});
