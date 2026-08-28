import { describe, expect, it } from "vitest";
import {
  DOC_BLOCK_TYPES,
  MOODBOARD_RECIPES,
  createMoodboardColumn,
} from "./docBlocks.js";
import { NODE_BODY_KIND, NODE_BLOCK_TYPES } from "./nodeInlineContent.js";
import {
  applyMoodboardCalendarFill,
  buildStickyContentFromCalendarSource,
  findMoodboardStickyTarget,
  isMoodboardStickyEmpty,
  resolveMoodboardCalendarFillPlan,
} from "./moodboardCalendarFill.js";

function moodboardBlock(id = "mb1") {
  return {
    id,
    type: DOC_BLOCK_TYPES.MOODBOARD,
    columns: [
      createMoodboardColumn(null),
      createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY),
      createMoodboardColumn(null),
    ],
  };
}

describe("isMoodboardStickyEmpty", () => {
  it("detects empty medium_sticky column", () => {
    const col = createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY);
    expect(isMoodboardStickyEmpty(col)).toBe(true);
  });

  it("rejects column with body text", () => {
    const col = createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, {
      stickyText: "Spring promos",
    });
    expect(isMoodboardStickyEmpty(col)).toBe(false);
  });
});

describe("findMoodboardStickyTarget", () => {
  it("finds first empty notes column", () => {
    const target = findMoodboardStickyTarget([moodboardBlock()]);
    expect(target?.blockId).toBe("mb1");
    expect(target?.colIndex).toBe(1);
  });
});

describe("buildStickyContentFromCalendarSource", () => {
  it("maps scope brief body to sticky text", () => {
    const content = buildStickyContentFromCalendarSource({
      status: "success",
      rangeDays: 7,
      scheduleIso: "2026-08-28",
      rangeEnd: new Date("2026-09-04"),
      events: [{
        title: "Labor Day",
        date: "2026-09-01",
        dateEnd: "2026-09-01",
      }],
      event: {
        title: "Labor Day",
        date: "2026-09-01",
        dateEnd: "2026-09-01",
      },
    });
    expect(content?.stickyTitle).toBe("Labor Day");
    expect(content?.stickyText).toMatch(/Labor Day/i);
  });
});

describe("resolveMoodboardCalendarFillPlan", () => {
  it("prefers sticky slot in macronode writing body", () => {
    const activeNode = {
      id: "NODE-1",
      parentDocId: "DOC-FOLDER",
      title: "My doc",
      content: {
        kind: NODE_BODY_KIND,
        blocks: [
          { id: "mb-node", type: NODE_BLOCK_TYPES.MOODBOARD, ...moodboardBlock("mb-node") },
        ],
      },
    };
    const plan = resolveMoodboardCalendarFillPlan(activeNode, { id: "DOC-FOLDER", title: "Ideas" });
    expect(plan?.scope).toBe("node");
    expect(plan?.target.blockId).toBe("mb-node");
  });
});

describe("applyMoodboardCalendarFill", () => {
  it("writes calendar brief into node writing moodboard", () => {
    const moodboard = moodboardBlock("mb-node");
    const nodes = {
      "NODE-1": {
        id: "NODE-1",
        content: {
          kind: NODE_BODY_KIND,
          blocks: [{ ...moodboard, type: NODE_BLOCK_TYPES.MOODBOARD }],
        },
      },
    };
    const plan = resolveMoodboardCalendarFillPlan(nodes["NODE-1"], null);
    const ok = applyMoodboardCalendarFill(plan, {
      kind: "calendar-event",
      scopeBrief: "Within 7 days: Labor Day on Sep 1.",
      title: "Labor Day",
      date: "2026-09-01",
      rangeLabel: "Week",
    }, {
      getNode: (id) => nodes[id],
      updateNode: (id, patch) => {
        nodes[id] = { ...nodes[id], ...patch };
      },
      getDoc: () => null,
      updateDoc: () => {},
    });
    expect(ok).toBe(true);
    const col = nodes["NODE-1"].content.blocks[0].columns[1];
    expect(col.stickyText).toContain("Labor Day");
    expect(col.stickyTitle).toBe("Labor Day");
  });
});
