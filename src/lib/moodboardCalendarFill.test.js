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
  isMoodboardCalendarWireTarget,
  resolveMoodboardCalendarFillPlan,
} from "./moodboardCalendarFill.js";

function moodboardBlock(id = "mb1") {
  return {
    id,
    type: DOC_BLOCK_TYPES.MOODBOARD,
    columns: [
      createMoodboardColumn(null),
      createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, { calendarWireEnabled: true }),
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
  it("finds first calendar-wire notes column", () => {
    const target = findMoodboardStickyTarget([moodboardBlock()]);
    expect(target?.blockId).toBe("mb1");
    expect(target?.colIndex).toBe(1);
  });

  it("ignores empty notes without calendar wire toggle", () => {
    const block = moodboardBlock();
    block.columns[1] = createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY);
    expect(findMoodboardStickyTarget([block])).toBeNull();
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

  it("omits scanner intro for document integration", () => {
    const content = buildStickyContentFromCalendarSource({
      status: "success",
      rangeDays: 7,
      scheduleIso: "2026-01-01",
      rangeEnd: new Date("2026-01-08"),
      events: [{
        title: "New Year's Day",
        date: "2026-01-01",
        dateEnd: "2026-01-01",
      }],
      event: {
        title: "New Year's Day",
        date: "2026-01-01",
        dateEnd: "2026-01-01",
      },
    });
    expect(content?.stickyText).not.toMatch(/scanned/i);
    expect(content?.stickyText).toMatch(/Winter/i);
    expect(content?.stickyText).not.toMatch(/Event \[/i);
  });

  it("integrates all events from calendar-event payload displayModel (connect path)", () => {
    const content = buildStickyContentFromCalendarSource({
      kind: "calendar-event",
      scheduleIso: "2025-12-31",
      rangeDays: 7,
      rangeLabel: "Week",
      title: "New Year's Eve",
      date: "2025-12-31",
      displayModel: {
        intro: "",
        sections: [{
          season: "Winter",
          events: [
            { name: "New Year's Eve", date: "12/31" },
            { name: "New Year's Day", date: "01/01" },
            { name: "Orthodox Christmas Day", date: "01/07" },
          ],
        }],
      },
    });
    expect(content?.stickyTitle).toBe("Winter");
    expect(content?.stickyText).toMatch(/New Year's Eve/i);
    expect(content?.stickyText).toMatch(/New Year's Day/i);
    expect(content?.stickyText).toMatch(/Orthodox Christmas Day/i);
  });

  it("integrates all events from panel fetchResult", () => {
    const content = buildStickyContentFromCalendarSource({
      status: "success",
      rangeDays: 7,
      scheduleIso: "2025-12-31",
      rangeEnd: new Date("2026-01-08T12:00:00"),
      rangeLabel: "Week",
      events: [
        { title: "New Year's Eve", date: "2025-12-31", dateEnd: "2025-12-31" },
        { title: "New Year's Day", date: "2026-01-01", dateEnd: "2026-01-01" },
        { title: "Orthodox Christmas Day", date: "2026-01-07", dateEnd: "2026-01-07" },
      ],
      event: { title: "New Year's Eve", date: "2025-12-31", dateEnd: "2025-12-31" },
    });
    expect(content?.stickyTitle).toBe("Winter");
    expect(content?.stickyText).toMatch(/Orthodox Christmas Day/i);
    expect(content?.stickyText).not.toMatch(/scanned/i);
  });
});

describe("isMoodboardCalendarWireTarget", () => {
  it("requires empty notes and wire toggle", () => {
    const wired = createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, {
      calendarWireEnabled: true,
    });
    expect(isMoodboardCalendarWireTarget(wired)).toBe(true);

    const emptyNoWire = createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY);
    expect(isMoodboardCalendarWireTarget(emptyNoWire)).toBe(false);
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
      scheduleIso: "2026-09-01",
      rangeDays: 7,
      title: "Labor Day",
      date: "2026-09-01",
      rangeLabel: "Week",
      displayModel: {
        intro: "",
        sections: [{
          season: "Summer",
          events: [{ name: "Labor Day", date: "09/01" }],
        }],
      },
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
