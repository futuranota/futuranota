import { describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";

describe("normalizeDoc campaign vs schedule", () => {
  it("does not mirror Launch into Schedule for campaignActive docs", () => {
    const doc = normalizeDoc({
      id: "c1",
      title: "Campaign",
      campaignActive: true,
      launchAt: "2026-08-01T16:00:00.000Z",
      campaignActivateAt: "2026-07-20T10:00:00.000Z",
    });
    expect(doc.launchAt).toBe("2026-08-01T16:00:00.000Z");
    expect(doc.campaignActivateAt).toBe("2026-07-20T10:00:00.000Z");
    expect(doc.scheduleStartAt).toBeNull();
    expect(doc.scheduleFinishAt).toBeNull();
  });

  it("does not invent Schedule from Launch for Content folders (Clear stays cleared)", () => {
    const doc = normalizeDoc({
      id: "f1",
      title: "Content",
      campaignActive: false,
      launchAt: "2026-08-01T16:00:00.000Z",
    });
    expect(doc.scheduleStartAt).toBeNull();
    expect(doc.scheduleFinishAt).toBeNull();
    expect(doc.launchAt).toBe("2026-08-01T16:00:00.000Z");
  });

  it("keeps explicit Schedule and does not wipe Launch when both set", () => {
    const doc = normalizeDoc({
      id: "f2",
      title: "Content",
      scheduleStartAt: "2026-08-02T12:00:00.000Z",
      scheduleFinishAt: "2026-08-05T12:00:00.000Z",
      launchAt: "2026-07-01T12:00:00.000Z",
    });
    expect(doc.scheduleStartAt).toBe("2026-08-02T12:00:00.000Z");
    expect(doc.scheduleFinishAt).toBe("2026-08-05T12:00:00.000Z");
    expect(doc.launchAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("fills missing scheduleFinishAt from scheduleStartAt only", () => {
    const doc = normalizeDoc({
      id: "f3",
      scheduleStartAt: "2026-08-01T16:00:00.000Z",
      scheduleFinishAt: null,
      launchAt: null,
    });
    expect(doc.scheduleStartAt).toBe("2026-08-01T16:00:00.000Z");
    expect(doc.scheduleFinishAt).toBe("2026-08-01T16:00:00.000Z");
    expect(doc.launchAt).toBeNull();
  });

  it("preserves explicit campaignCompleted and activate fields", () => {
    const doc = normalizeDoc({
      id: "c2",
      campaignActive: true,
      campaignActivateAt: "2026-07-18T08:00:00.000Z",
      campaignCompleted: true,
      launchAt: "2026-07-30T12:00:00.000Z",
    });
    expect(doc.campaignCompleted).toBe(true);
    expect(doc.campaignActivateAt).toBe("2026-07-18T08:00:00.000Z");
  });
});
