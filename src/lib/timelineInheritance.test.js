import { describe, expect, it } from "vitest";
import {
  classifyCanvasConnection,
  validateCanvasConnectionAttempt,
  hasCrossFamilyLinkBetweenObjects,
} from "./timelineGraph.js";
import {
  buildGuestInheritanceProjections,
  resolveHostFolderCreatedDate,
  resolveHostFolderLaunchDate,
  resolveHostGuestSides,
} from "./timelineInheritance.js";

function makeDoc(id, objectId, extra = {}) {
  return {
    id,
    title: id,
    parentObjectId: objectId,
    createdAt: "2026-07-17T12:00:00.000Z",
    campaignActive: true,
    ...extra,
  };
}

describe("cross-family folder inheritance", () => {
  const objectsById = {
    home: { id: "home", name: "Home Depot", role: "corpus" },
    futura: { id: "futura", name: "Futura Nota" },
  };

  const docsById = {
    hdFolder: makeDoc("hdFolder", "home", {
      title: "HD Campaign",
      launchAt: "2026-08-01T12:00:00.000Z",
    }),
    fnFolder: makeDoc("fnFolder", "futura", {
      title: "FN Track",
      createdAt: "2026-07-10T12:00:00.000Z",
    }),
  };

  const canvasNodes = [
    {
      id: "cn-hd",
      canvasKind: "document",
      dataType: "document",
      docId: "hdFolder",
      noteId: "hdFolder",
    },
    {
      id: "cn-fn",
      canvasKind: "document",
      dataType: "document",
      docId: "fnFolder",
      noteId: "fnFolder",
    },
    {
      id: "cn-hd-launch",
      canvasKind: "launch",
      dataType: "date",
      parentDocId: "hdFolder",
      title: "Launch",
      content: "2026-08-01",
      launchAt: "2026-08-01T12:00:00.000Z",
    },
  ];

  it("classifies folder↔folder as cross-family-doc", () => {
    const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
    const classified = classifyCanvasConnection(
      { id: "c1", from: "cn-hd", to: "cn-fn" },
      nodeById,
      docsById,
      {},
      objectsById,
    );
    expect(classified.kind).toBe("cross-family-doc");
    expect(classified.fromDocId).toBe("hdFolder");
    expect(classified.toDocId).toBe("fnFolder");
  });

  it("allows doc↔doc and date↔date between the same companies", () => {
    const connections = [{ id: "c1", from: "cn-hd", to: "cn-fn" }];
    const draftDate = {
      id: "draft",
      from: "cn-hd-launch",
      to: "cn-fn",
      kind: "cross-family-date",
      fromObjectId: "home",
      toObjectId: "futura",
      fromDocId: "hdFolder",
      toDocId: "fnFolder",
      wireType: "date",
    };
    // Without draft → company-pair block (legacy callers)
    expect(hasCrossFamilyLinkBetweenObjects(
      "home",
      "futura",
      connections,
      canvasNodes,
      docsById,
      {},
      objectsById,
    )).toBe(true);

    // With draft of different wire type / pair → allow
    const dateNodes = [
      ...canvasNodes,
      {
        id: "cn-fn-launch",
        canvasKind: "launch",
        dataType: "date",
        parentDocId: "fnFolder",
        content: "2026-07-20",
      },
    ];
    const ok = validateCanvasConnectionAttempt({
      fromNodeId: "cn-hd-launch",
      toNodeId: "cn-fn-launch",
      canvasNodes: dateNodes,
      connections,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      inheritObjMode: true,
    });
    expect(ok.ok).toBe(true);
    expect(draftDate.kind).toBe("cross-family-date");
  });

  it("rejects duplicate folder↔folder wire", () => {
    const connections = [{ id: "c1", from: "cn-hd", to: "cn-fn" }];
    const result = validateCanvasConnectionAttempt({
      fromNodeId: "cn-hd",
      toNodeId: "cn-fn",
      canvasNodes,
      connections,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      inheritObjMode: true,
    });
    expect(result.ok).toBe(false);
  });

  it("resolves host/guest from wire direction (from = parent)", () => {
    const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
    const classified = classifyCanvasConnection(
      { id: "c1", from: "cn-fn", to: "cn-hd" },
      nodeById,
      docsById,
      {},
      objectsById,
    );
    const sides = resolveHostGuestSides(classified);
    expect(sides.hostObjectId).toBe("futura");
    expect(sides.guestObjectId).toBe("home");
    expect(sides.hostDocId).toBe("fnFolder");
    expect(sides.guestDocId).toBe("hdFolder");
  });

  it("aligns guest to the host's displayed date (explicit schedule beats createdAt)", () => {
    // Non-campaign host whose chip shows its explicit Schedule (Jul 26), not
    // its raw createdAt (Jul 2). The guest must inherit the displayed date.
    const host = makeDoc("hostDoc", "futura", {
      campaignActive: false,
      createdAt: "2026-07-02T12:00:00.000Z",
      scheduleStartAt: "2026-07-26T12:00:00.000Z",
    });
    const resolved = resolveHostFolderCreatedDate(host);
    expect(resolved.toISOString()).toBe("2026-07-26T12:00:00.000Z");

    // Without any explicit schedule, createdAt still applies.
    const bare = makeDoc("bareDoc", "futura", {
      campaignActive: false,
      createdAt: "2026-07-02T12:00:00.000Z",
    });
    expect(resolveHostFolderCreatedDate(bare).toISOString())
      .toBe("2026-07-02T12:00:00.000Z");
  });

  it("projects guest folder onto host Created + Launch without mutating guest", () => {
    const guestCreatedBefore = docsById.fnFolder.createdAt;
    const projections = buildGuestInheritanceProjections({
      connections: [{ id: "c1", from: "cn-hd", to: "cn-fn" }],
      canvasNodes,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "home",
      timelineDocQueue: ["hdFolder", "fnFolder"],
      timelineDateNodeIds: ["cn-hd-launch"],
    });

    expect(projections.guestFolderMarkers).toHaveLength(1);
    const folder = projections.guestFolderMarkers[0];
    expect(folder.docId).toBe("fnFolder");
    expect(folder.inherited).toBe(true);
    expect(folder.authorityObjectId).toBe("home");
    expect(folder.inheritedFromDocId).toBe("hdFolder");
    const hostCreated = resolveHostFolderCreatedDate(docsById.hdFolder);
    expect(folder.date.getTime()).toBe(hostCreated.getTime());
    expect(docsById.fnFolder.createdAt).toBe(guestCreatedBefore);

    expect(projections.guestLaunchMarkers.length).toBeGreaterThanOrEqual(1);
    expect(projections.guestLaunchMarkers[0].inheritanceKind).toBe("launchAt");
    expect(projections.crossLinks.length).toBeGreaterThanOrEqual(1);
    expect(projections.alertTargets.some((a) => a.key.includes("fnFolder"))).toBe(true);
  });

  it("does not project host folders when viewing the guest company", () => {
    // Wire Home Depot → Futura Nota: Futura is guest. Opening Futura must not
    // invent reverse inheritance.
    const projections = buildGuestInheritanceProjections({
      connections: [{ id: "c1", from: "cn-hd", to: "cn-fn" }],
      canvasNodes,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "futura",
      timelineDocQueue: ["hdFolder", "fnFolder"],
      timelineDateNodeIds: ["cn-hd-launch"],
    });

    expect(projections.guestFolderMarkers).toHaveLength(0);
    expect(projections.guestLaunchMarkers).toHaveLength(0);
    expect(projections.crossLinks).toHaveLength(0);
    expect(projections.alertTargets).toHaveLength(0);
  });

  it("lets Futura Nota be parent when the wire starts there", () => {
    const projections = buildGuestInheritanceProjections({
      connections: [{ id: "c1", from: "cn-fn", to: "cn-hd" }],
      canvasNodes,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "futura",
      timelineDocQueue: ["hdFolder", "fnFolder"],
      timelineDateNodeIds: ["cn-hd-launch"],
    });

    expect(projections.guestFolderMarkers).toHaveLength(1);
    expect(projections.guestFolderMarkers[0].docId).toBe("hdFolder");
    expect(projections.guestFolderMarkers[0].inheritedFromDocId).toBe("fnFolder");
    expect(projections.guestFolderMarkers[0].authorityObjectId).toBe("futura");
  });

  it("does not invent Launch from host Schedule", () => {
    const host = makeDoc("schedHost", "futura", {
      campaignActive: false,
      createdAt: "2026-07-02T12:00:00.000Z",
      scheduleStartAt: "2026-07-26T12:00:00.000Z",
      launchAt: null,
    });
    const guest = makeDoc("schedGuest", "home", {
      title: "Campaign Results",
      campaignActive: true,
      createdAt: "2026-07-02T12:00:00.000Z",
    });
    const nodes = [
      {
        id: "cn-sched-host",
        canvasKind: "document",
        dataType: "document",
        docId: "schedHost",
        noteId: "schedHost",
      },
      {
        id: "cn-sched-guest",
        canvasKind: "document",
        dataType: "document",
        docId: "schedGuest",
        noteId: "schedGuest",
      },
    ];
    const docs = { schedHost: host, schedGuest: guest };

    expect(resolveHostFolderLaunchDate(
      "schedHost",
      nodes,
      docs,
      [],
    )).toBeNull();

    const projections = buildGuestInheritanceProjections({
      connections: [{ id: "c1", from: "cn-sched-host", to: "cn-sched-guest" }],
      canvasNodes: nodes,
      docsById: docs,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "futura",
      timelineDocQueue: ["schedHost", "schedGuest"],
      timelineDateNodeIds: [],
    });

    expect(projections.guestFolderMarkers).toHaveLength(1);
    expect(projections.guestFolderMarkers[0].date.toISOString())
      .toBe("2026-07-26T12:00:00.000Z");
    expect(projections.guestLaunchMarkers).toHaveLength(0);
  });

  it("inherits Launch only when host campaign date node is on the timeline", () => {
    // launchAt alone (even on a campaign) is not enough without a queued date node.
    expect(resolveHostFolderLaunchDate(
      "hdFolder",
      canvasNodes,
      docsById,
      [],
    )).toBeNull();

    const withLaunch = resolveHostFolderLaunchDate(
      "hdFolder",
      canvasNodes,
      docsById,
      ["cn-hd-launch"],
    );
    expect(withLaunch.toISOString()).toBe("2026-08-01T12:00:00.000Z");
  });
});
