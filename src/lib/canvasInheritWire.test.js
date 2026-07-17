import { describe, expect, it } from "vitest";
import { computeEdgeTemporalLabel } from "../temporal.js";
import {
  formatLaunchCountdownLabel,
  normalizeCrossFamilyConnectionEndpoints,
  resolveCanvasWireTemporalLabel,
  shouldShowCrossFamilyCenterPorts,
} from "./canvasInheritWire.js";
import { buildAdjacentDayGapSegments } from "./tacticalTimelineView.js";

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

describe("canvas inherit wire UX", () => {
  it("normalizes endpoints so authority host is from and guest is to", () => {
    const flipped = normalizeCrossFamilyConnectionEndpoints("cn-fn", "cn-hd", {
      canvasNodes,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "home",
    });
    expect(flipped.from).toBe("cn-hd");
    expect(flipped.to).toBe("cn-fn");

    const already = normalizeCrossFamilyConnectionEndpoints("cn-hd", "cn-fn", {
      canvasNodes,
      docsById,
      nodeEntitiesById: {},
      objectsById,
      primaryObjectId: "home",
    });
    expect(already.from).toBe("cn-hd");
    expect(already.to).toBe("cn-fn");
  });

  it("shows center ports only in inherit mode when another company is on canvas", () => {
    expect(shouldShowCrossFamilyCenterPorts(canvasNodes[0], {
      inheritObjMode: false,
      canvasNodes,
      docsById,
      objectsById,
    })).toBe(false);

    expect(shouldShowCrossFamilyCenterPorts(canvasNodes[0], {
      inheritObjMode: true,
      canvasNodes,
      docsById,
      objectsById,
    })).toBe(true);

    expect(shouldShowCrossFamilyCenterPorts(canvasNodes[0], {
      inheritObjMode: true,
      canvasNodes: [canvasNodes[0], canvasNodes[2]],
      docsById,
      objectsById,
    })).toBe(false);
  });

  it("suppresses day-gap labels on cross-family wires", () => {
    const label = resolveCanvasWireTemporalLabel(
      canvasNodes[0],
      canvasNodes[1],
      new Date("2026-07-17T12:00:00.000Z"),
      canvasNodes,
      [],
      [],
      { docsById, nodeEntitiesById: {}, objectsById },
      computeEdgeTemporalLabel,
    );
    expect(label).toBeNull();
  });

  it("labels folder→Launch with pending countdown, not same-day", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const label = formatLaunchCountdownLabel(new Date("2026-08-01T12:00:00.000Z"), now);
    expect(label).toMatch(/Pending 15 days/i);
    expect(label).not.toMatch(/same day/i);

    const wireLabel = resolveCanvasWireTemporalLabel(
      canvasNodes[0],
      canvasNodes[2],
      now,
      canvasNodes,
      [],
      [],
      { docsById, nodeEntitiesById: {}, objectsById },
      computeEdgeTemporalLabel,
    );
    expect(wireLabel).toMatch(/Pending 15 days/i);
  });

  it("buildAdjacentDayGapSegments uses launch countdown for folder↔launch columns", () => {
    const folderDate = new Date("2026-07-17T10:00:00.000Z");
    const launchDate = new Date("2026-07-17T18:00:00.000Z");
    const now = new Date("2026-07-10T12:00:00.000Z");
    const columns = [
      {
        columnKey: "folder",
        date: folderDate,
        leftPct: 20,
        items: [{ dataType: "document", docId: "hdFolder", date: folderDate }],
      },
      {
        columnKey: "launch",
        date: launchDate,
        leftPct: 60,
        items: [{ dataType: "date", canvasKind: "launch", timeMarker: true, date: launchDate }],
      },
    ];
    const grid = {
      today: now,
      pct: (d) => (d === folderDate ? 20 : 60),
      todayPct: 10,
      nowPct: 10,
    };

    const segments = buildAdjacentDayGapSegments(columns, grid, { now, today: now });
    expect(segments).toHaveLength(1);
    expect(segments[0].isLaunchCountdownGap).toBe(true);
    expect(segments[0].isSameDayGap).toBe(false);
    expect(segments[0].schedule?.kind).toBe("pending");
    expect(segments[0].label).toMatch(/Pending 7 days/i);
    expect(segments[0].label || "").not.toMatch(/same day|next schedule/i);
  });
});
