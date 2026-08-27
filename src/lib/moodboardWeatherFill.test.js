import { describe, expect, it } from "vitest";
import {
  DOC_BLOCK_TYPES,
  MOODBOARD_RECIPES,
  MOODBOARD_SLOT_CONTENT_MODES,
  createMoodboardColumn,
} from "./docBlocks.js";
import { NODE_BODY_KIND, NODE_BLOCK_TYPES } from "./nodeInlineContent.js";
import {
  applyMoodboardWeatherFill,
  resolveMoodboardWeatherFillPlan,
} from "./moodboardWeatherFill.js";

const samplePayload = {
  kind: "weather-forecast",
  uiDate: "Aug 28",
  location: "Orlando",
  fetchedAt: "2026-08-28T10:00:00.000Z",
  high: 90,
  low: 73,
  condition: "Clouds",
  conditionIcon: "clouds",
  precipPct: 100,
  wind: { dir: "E", speed: 8, unit: "mph" },
};

function moodboardBlock(id = "mb1") {
  return {
    id,
    type: DOC_BLOCK_TYPES.MOODBOARD,
    columns: [
      createMoodboardColumn(null),
      createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STACK, {
        images: [{ contentMode: MOODBOARD_SLOT_CONTENT_MODES.WEATHER, weatherPayload: null }, null],
      }),
      createMoodboardColumn(null),
    ],
  };
}

describe("resolveMoodboardWeatherFillPlan", () => {
  it("prefers weather placeholder in macronode writing body", () => {
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
    const plan = resolveMoodboardWeatherFillPlan(activeNode, { id: "DOC-FOLDER", title: "Ideas" });
    expect(plan?.scope).toBe("node");
    expect(plan?.target.blockId).toBe("mb-node");
    expect(plan?.nodeId).toBe("NODE-1");
  });

  it("falls back to folder doc blocks when node body has no placeholder", () => {
    const activeNode = {
      id: "NODE-1",
      parentDocId: "DOC-FOLDER",
      content: { kind: NODE_BODY_KIND, blocks: [] },
    };
    const parentDoc = { id: "DOC-FOLDER", title: "Ideas", blocks: [moodboardBlock()] };
    const plan = resolveMoodboardWeatherFillPlan(activeNode, parentDoc);
    expect(plan?.scope).toBe("doc");
    expect(plan?.parentDocId).toBe("DOC-FOLDER");
  });
});

describe("applyMoodboardWeatherFill", () => {
  it("writes payload into node writing moodboard", () => {
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
    const plan = resolveMoodboardWeatherFillPlan(nodes["NODE-1"], null);
    const ok = applyMoodboardWeatherFill(plan, samplePayload, {
      getNode: (id) => nodes[id],
      updateNode: (id, patch) => {
        nodes[id] = { ...nodes[id], ...patch };
      },
      getDoc: () => null,
      updateDoc: () => {},
    });
    expect(ok).toBe(true);
    const slot = nodes["NODE-1"].content.blocks[0].columns[1].images[0];
    expect(slot.weatherPayload?.uiDate).toBe("Aug 28");
  });
});
