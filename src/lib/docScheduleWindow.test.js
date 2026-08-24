import { describe, expect, it } from "vitest";
import { isoFromAnchorFields } from "./nodeAnchor.js";
import {
  getTimelineLedVariant,
  hasDocumentScheduleHours,
  isDocumentInScheduleWindow,
  isTimelineScheduleLedCandidate,
  readTimelineLedVariant,
  resolveTimelineScheduleLed,
  resolveTimelineScheduleSubject,
} from "./docScheduleWindow.js";

describe("docScheduleWindow", () => {
  const scheduled = {
    anchorAt: "2026-08-24T15:00:00.000Z",
    anchorFinishAt: "2026-08-24T17:00:00.000Z",
    status: "not_started",
  };

  it("hasDocumentScheduleHours is false without anchorAt", () => {
    expect(hasDocumentScheduleHours({})).toBe(false);
    expect(hasDocumentScheduleHours({ anchorFinishAt: scheduled.anchorFinishAt })).toBe(false);
  });

  it("hasDocumentScheduleHours is true with parseable anchorAt", () => {
    expect(hasDocumentScheduleHours(scheduled)).toBe(true);
  });

  it("hasDocumentScheduleHours is false for date-only noon default without finish", () => {
    expect(hasDocumentScheduleHours({ anchorAt: "2026-08-24" })).toBe(false);
  });

  it("resolveTimelineScheduleSubject backfills finish from block when start exists on entity", () => {
    const entity = {
      id: "NODE-1",
      parentDocId: "DOC-1",
      anchorAt: isoFromAnchorFields("2026-08-24", "15:00"),
    };
    const docsById = {
      "DOC-1": {
        blocks: [{
          nodeId: "NODE-1",
          anchorDate: "2026-08-24",
          anchorTime: "15:00",
          anchorFinishTime: "17:00",
        }],
      },
    };
    const subject = resolveTimelineScheduleSubject(entity, { docsById, entityId: "NODE-1" });
    expect(subject?.anchorFinishAt).toBeTruthy();
    const probe = new Date(subject.anchorAt);
    probe.setMinutes(probe.getMinutes() + 30);
    expect(isDocumentInScheduleWindow(subject, probe)).toBe(true);
  });

  it("resolveTimelineScheduleSubject prefers doc block for full local range", () => {
    const entity = {
      id: "NODE-1",
      parentDocId: "DOC-1",
      anchorAt: isoFromAnchorFields("2026-08-24", "09:00"),
      anchorFinishAt: isoFromAnchorFields("2026-08-24", "09:00"),
    };
    const docsById = {
      "DOC-1": {
        blocks: [{
          nodeId: "NODE-1",
          anchorDate: "2026-08-24",
          anchorTime: "15:00",
          anchorFinishTime: "17:00",
        }],
      },
    };
    const subject = resolveTimelineScheduleSubject(entity, { docsById, entityId: "NODE-1" });
    const mid = new Date(subject.anchorAt);
    mid.setMinutes(mid.getMinutes() + 30);
    expect(isDocumentInScheduleWindow(subject, mid)).toBe(true);
    expect(resolveTimelineScheduleLed(subject, mid, { ledVariant: "green" }).active).toBe(true);
  });

  it("resolveTimelineScheduleLed is off before window starts", () => {
    const subject = resolveTimelineScheduleSubject(
      { id: "NODE-1", parentDocId: "DOC-1" },
      {
        docsById: {
          "DOC-1": {
            blocks: [{
              nodeId: "NODE-1",
              anchorDate: "2026-08-24",
              anchorTime: "15:00",
              anchorFinishTime: "17:00",
            }],
          },
        },
        entityId: "NODE-1",
      },
    );
    const before = new Date(subject.anchorAt);
    before.setMinutes(before.getMinutes() - 5);
    expect(resolveTimelineScheduleLed(subject, before, { ledVariant: "green" }).active).toBe(false);
  });

  it("isTimelineScheduleLedCandidate excludes folder doc chips", () => {
    expect(isTimelineScheduleLedCandidate(
      { dataType: "document", docId: "DOC-1", entityId: "NODE-1" },
      { isTimeMarker: false, isAgentSet: false },
    )).toBe(false);
    expect(isTimelineScheduleLedCandidate(
      { dataType: "text", entityId: "NODE-1" },
      { isTimeMarker: false, isAgentSet: false },
    )).toBe(true);
  });

  it("isDocumentInScheduleWindow respects [start, finish]", () => {
    expect(isDocumentInScheduleWindow(scheduled, new Date("2026-08-24T14:59:00.000Z"))).toBe(false);
    expect(isDocumentInScheduleWindow(scheduled, new Date("2026-08-24T16:00:00.000Z"))).toBe(true);
    expect(isDocumentInScheduleWindow(scheduled, new Date("2026-08-24T17:01:00.000Z"))).toBe(false);
  });

  it("isDocumentInScheduleWindow uses start as finish when finish missing", () => {
    const point = { anchorAt: "2026-08-24T16:00:00.000Z" };
    expect(isDocumentInScheduleWindow(point, new Date("2026-08-24T16:00:00.000Z"))).toBe(true);
    expect(isDocumentInScheduleWindow(point, new Date("2026-08-24T16:01:00.000Z"))).toBe(false);
  });

  it("readTimelineLedVariant defaults to green", () => {
    expect(readTimelineLedVariant(null)).toBe("green");
    expect(readTimelineLedVariant("brown")).toBe("brown");
  });

  it("getTimelineLedVariant reads from storage", () => {
    expect(getTimelineLedVariant({ getItem: () => "brown" })).toBe("brown");
    expect(getTimelineLedVariant({ getItem: () => null })).toBe("green");
  });

  it("resolveTimelineScheduleLed is off outside window", () => {
    const out = resolveTimelineScheduleLed(
      scheduled,
      new Date("2026-08-24T12:00:00.000Z"),
      { ledVariant: "green" },
    );
    expect(out.active).toBe(false);
    expect(out.variant).toBeNull();
  });

  it("resolveTimelineScheduleLed is on inside window with variant", () => {
    const out = resolveTimelineScheduleLed(
      scheduled,
      new Date("2026-08-24T16:00:00.000Z"),
      { ledVariant: "brown" },
    );
    expect(out.active).toBe(true);
    expect(out.variant).toBe("brown");
    expect(out.notificationActive).toBe(false);
  });

  it("resolveTimelineScheduleLed is off for completed", () => {
    const out = resolveTimelineScheduleLed(
      { ...scheduled, status: "completed" },
      new Date("2026-08-24T16:00:00.000Z"),
      { ledVariant: "green" },
    );
    expect(out.active).toBe(false);
  });

  it("resolveTimelineScheduleLed can force on via notificationActive (future hook)", () => {
    const out = resolveTimelineScheduleLed(
      scheduled,
      new Date("2026-08-24T12:00:00.000Z"),
      { notificationActive: true, ledVariant: "green" },
    );
    expect(out.active).toBe(true);
    expect(out.notificationActive).toBe(true);
  });
});
