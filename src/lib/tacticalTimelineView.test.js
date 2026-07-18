import { describe, expect, it } from "vitest";
import { buildTacticalObjectRows } from "./tacticalTimelineView.js";

describe("tactical inherit-guest + children ordering", () => {
  const objectsById = {
    futura: { id: "futura", name: "Futura nota" },
    home: { id: "home", name: "Home Depot", role: "corpus" },
  };

  const docsById = {
    fnFolder: {
      id: "fnFolder",
      title: "My product idea",
      parentObjectId: "futura",
      createdAt: "2026-07-02T12:00:00.000Z",
      scheduleStartAt: "2026-07-26T12:00:00.000Z",
      campaignActive: false,
      blocks: [],
      nodeIds: ["child1"],
    },
    hdFolder: {
      id: "hdFolder",
      title: "Campaign Results",
      parentObjectId: "home",
      createdAt: "2026-07-02T12:00:00.000Z",
      campaignActive: true,
      launchAt: "2026-07-26T12:00:00.000Z",
      blocks: [],
      nodeIds: ["campaignResearch"],
    },
  };

  const nodeEntitiesById = {
    child1: {
      id: "child1",
      parentDocId: "fnFolder",
      dataType: "text",
      title: "Mi doc personal",
      createdAt: "2026-07-17T10:00:00.000Z",
    },
    campaignResearch: {
      id: "campaignResearch",
      parentDocId: "hdFolder",
      dataType: "text",
      title: "Research note",
      createdAt: "2026-07-05T10:00:00.000Z",
      // Legacy task data must not control Campaign research chronology.
      anchorAt: "2026-07-25T18:00:00.000Z",
    },
  };

  const canvasNodes = [
    {
      id: "cn-fn",
      canvasKind: "document",
      dataType: "document",
      docId: "fnFolder",
      noteId: "fnFolder",
    },
    {
      id: "cn-hd",
      canvasKind: "document",
      dataType: "document",
      docId: "hdFolder",
      noteId: "hdFolder",
    },
  ];

  it("keeps host children between host row and ruler-less guest strip", () => {
    const view = buildTacticalObjectRows({
      canvasNodes,
      connections: [{ id: "w1", from: "cn-fn", to: "cn-hd" }],
      docsById,
      nodeEntitiesById,
      objectsById,
      timelineDocQueue: ["fnFolder", "hdFolder"],
      timelineDocSnapshotsByDocId: {},
      timelineDateNodeIds: [],
      expandedDocIds: ["fnFolder"],
      today: new Date("2026-07-17T20:00:00.000Z"),
      filterObjectId: "futura",
      inheritObjMode: false,
      primaryTimelineObjectId: "futura",
    });

    const kinds = view.displayRows.map((r) => `${r.rowKind}:${r.id}`);
    expect(kinds[0]).toBe("object:object-futura");
    expect(kinds).toContain("children:children-fnFolder");
    expect(kinds).toContain("inherit-guest:inherit-futura-hdFolder");

    const childIdx = view.displayRows.findIndex((r) => r.id === "children-fnFolder");
    const guestIdx = view.displayRows.findIndex((r) => r.id === "inherit-futura-hdFolder");
    expect(childIdx).toBeGreaterThan(0);
    expect(guestIdx).toBeGreaterThan(childIdx);

    const guest = view.displayRows[guestIdx];
    expect(guest.hideRuler).toBe(true);
    expect(guest.isInheritLayer).toBe(true);
    // Schedule alone must not invent a Launch chip on the guest strip.
    const guestTypes = (guest.columns || []).flatMap((c) =>
      (c.items || []).map((i) => i.dataType),
    );
    expect(guestTypes).toContain("document");
    expect(guestTypes).not.toContain("date");
  });

  it("still surfaces children when a cross-family wire exists", () => {
    const withoutWire = buildTacticalObjectRows({
      canvasNodes,
      connections: [],
      docsById,
      nodeEntitiesById,
      objectsById,
      timelineDocQueue: ["fnFolder"],
      timelineDocSnapshotsByDocId: {},
      expandedDocIds: ["fnFolder"],
      today: new Date("2026-07-17T20:00:00.000Z"),
      filterObjectId: "futura",
      primaryTimelineObjectId: "futura",
    });
    const withWire = buildTacticalObjectRows({
      canvasNodes,
      connections: [{ id: "w1", from: "cn-fn", to: "cn-hd" }],
      docsById,
      nodeEntitiesById,
      objectsById,
      timelineDocQueue: ["fnFolder", "hdFolder"],
      timelineDocSnapshotsByDocId: {},
      expandedDocIds: ["fnFolder"],
      today: new Date("2026-07-17T20:00:00.000Z"),
      filterObjectId: "futura",
      primaryTimelineObjectId: "futura",
    });

    expect(withoutWire.displayRows.some((r) => r.id === "children-fnFolder")).toBe(true);
    expect(withWire.displayRows.some((r) => r.id === "children-fnFolder")).toBe(true);
  });

  it("places Campaign research children by Created, not Schedule", () => {
    const view = buildTacticalObjectRows({
      canvasNodes,
      connections: [],
      docsById,
      nodeEntitiesById,
      objectsById,
      timelineDocQueue: ["hdFolder"],
      timelineDocSnapshotsByDocId: {},
      expandedDocIds: ["hdFolder"],
      today: new Date("2026-07-17T20:00:00.000Z"),
      filterObjectId: "home",
      primaryTimelineObjectId: "home",
    });

    const childRow = view.displayRows.find((r) => r.id === "children-hdFolder");
    expect(childRow).toBeTruthy();
    expect(childRow.columns).toHaveLength(1);
    expect(childRow.columns[0].date.toISOString())
      .toBe("2026-07-05T10:00:00.000Z");
  });
});
