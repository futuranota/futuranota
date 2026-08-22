import { describe, expect, it } from "vitest";
import {
  buildTacticalObjectRows,
  buildTacticalDocWireRow,
  DOC_WIRE_ROW_ID,
  syncGuestRailToHostPositions,
} from "./tacticalTimelineView.js";

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
      timelineSourceNodeId: "campaignResearch",
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
      campaignStatus: "active",
      launchAt: "2026-07-26T15:00:00.000Z",
      // Schedule must not control Campaign expand chronology.
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
    expect(guest.hideRuler).toBe(false);
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

  it("places Campaign expand children on Launch, not Schedule", () => {
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
      .toBe("2026-07-26T15:00:00.000Z");
  });

  it("pins guest folder center to host folder when host stretch moves", () => {
    const launchNode = {
      id: "cn-fn-launch",
      canvasKind: "launch",
      dataType: "date",
      parentDocId: "fnFolder",
      title: "Launch",
      content: "2026-08-02",
      launchAt: "2026-08-02T12:00:00.000Z",
    };
    const view = buildTacticalObjectRows({
      canvasNodes: [...canvasNodes, launchNode],
      connections: [{ id: "w1", from: "cn-fn", to: "cn-hd" }],
      docsById: {
        ...docsById,
        fnFolder: {
          ...docsById.fnFolder,
          campaignActive: true,
          launchAt: "2026-08-02T12:00:00.000Z",
        },
      },
      nodeEntitiesById,
      objectsById,
      timelineDocQueue: ["fnFolder", "hdFolder"],
      timelineDocSnapshotsByDocId: {},
      timelineDateNodeIds: ["cn-fn-launch"],
      expandedDocIds: [],
      today: new Date("2026-07-19T12:00:00.000Z"),
      filterObjectId: "futura",
      primaryTimelineObjectId: "futura",
      pairStretches: [{
        rowId: "object-futura",
        focusMs: new Date("2026-07-26T12:00:00.000Z").getTime(),
        pairNextMs: new Date("2026-08-02T12:00:00.000Z").getTime(),
        targetPct: 35,
      }],
    });

    const host = view.displayRows.find((r) => r.id === "object-futura");
    const guest = view.displayRows.find((r) => r.rowKind === "inherit-guest");
    expect(host?.rail?.nodeGroups?.length).toBeGreaterThan(0);
    expect(guest?.rail?.nodeGroups?.length).toBeGreaterThan(0);

    const hostFolder = host.rail.nodeGroups.find((g) =>
      (g.items || []).some((i) => i.docId === "fnFolder" && i.dataType === "document"),
    );
    const guestFolder = guest.rail.nodeGroups.find((g) =>
      (g.items || []).some((i) => i.dataType === "document" && i.inherited),
    );
    expect(hostFolder).toBeTruthy();
    expect(guestFolder).toBeTruthy();
    expect(guestFolder.leftPct).toBe(hostFolder.leftPct);

    // Manual sync still centers after an independent host nudge.
    hostFolder.leftPct = 42;
    syncGuestRailToHostPositions(host, guest);
    expect(guestFolder.leftPct).toBe(42);
  });
});

describe("buildTacticalDocWireRow (timeline v2)", () => {
  const objectsById = {
    futura: { id: "futura", name: "Futura nota" },
  };

  const docsById = {
    research: {
      id: "research",
      title: "Research demanda",
      parentObjectId: "futura",
      createdAt: "2026-07-02T10:00:00.000Z",
      scheduleStartAt: "2026-07-26T09:00:00.000Z",
      campaignActive: false,
      blocks: [],
      nodeIds: [],
    },
    draft: {
      id: "draft",
      title: "Primer borrador",
      parentObjectId: "futura",
      createdAt: "2026-07-02T12:00:00.000Z",
      scheduleStartAt: "2026-07-26T14:00:00.000Z",
      campaignActive: false,
      blocks: [],
      nodeIds: [],
    },
  };

  const canvasNodes = [
    {
      id: "cn-research",
      canvasKind: "document",
      dataType: "document",
      docId: "research",
      noteId: "research",
    },
    {
      id: "cn-draft",
      canvasKind: "document",
      dataType: "document",
      docId: "draft",
      noteId: "draft",
    },
  ];

  const baseParams = {
    canvasNodes,
    connections: [],
    docsById,
    nodeEntitiesById: {},
    objectsById,
    timelineDocQueue: ["research", "draft"],
    timelineDocSnapshotsByDocId: {},
    timelineDateNodeIds: [],
    expandedDocIds: [],
    today: new Date("2026-07-17T20:00:00.000Z"),
    filterObjectId: "futura",
    inheritObjMode: false,
    primaryTimelineObjectId: "futura",
  };

  it("keeps v1 same-day folders stacked in one column", () => {
    const view = buildTacticalObjectRows(baseParams);
    const objectRow = view.displayRows.find((r) => r.rowKind === "object");
    expect(objectRow).toBeTruthy();
    const folderCols = (objectRow.columns || []).filter((c) =>
      (c.items || []).some((i) => i.dataType === "document"),
    );
    expect(folderCols).toHaveLength(1);
    expect(folderCols[0].items.map((i) => i.docId).sort()).toEqual(["draft", "research"]);
  });

  it("shows an empty doc-wire rail when only folders are queued (no files)", () => {
    const view = buildTacticalDocWireRow(baseParams);
    expect(view.displayRows).toHaveLength(0);
  });

  it("shows queued files without schedule and does not insert parent folders", () => {
    const view = buildTacticalDocWireRow({
      ...baseParams,
      timelineDocQueue: [],
      timelineFileQueue: ["studios", "slot"],
      nodeEntitiesById: {
        studios: {
          id: "studios",
          parentDocId: "research",
          title: "Studios plan",
          dataType: "text",
        },
        slot: {
          id: "slot",
          parentDocId: "draft",
          title: "Slot 9am",
          dataType: "text",
          anchorAt: "2026-08-12T13:00:00.000Z",
        },
      },
      canvasNodes: [
        {
          id: "cn-studios",
          noteId: "studios",
          parentDocId: "research",
          dataType: "text",
        },
        {
          id: "cn-slot",
          noteId: "slot",
          parentDocId: "draft",
          dataType: "text",
        },
      ],
    });

    const row = view.displayRows[0];
    const items = (row.columns || []).flatMap((c) => c.items || []);
    expect(items.map((i) => i.entityId)).toEqual(["studios", "slot"]);
    expect(items.find((i) => i.entityId === "studios").unscheduled).toBe(true);
    expect(items.find((i) => i.entityId === "slot").unscheduled).toBe(false);
    expect(items.every((i) => i.dataType === "text")).toBe(true);
  });
});

