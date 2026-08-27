import { describe, expect, it } from "vitest";
import {
  DOC_BLOCK_TYPES,
  MOODBOARD_RECIPES,
  MOODBOARD_SLOT_CONTENT_MODES,
  createMoodboardColumn,
  fillMoodboardWeatherSlot,
  findMoodboardWeatherTarget,
  isMoodboardWeatherFilled,
  isMoodboardWeatherPlaceholder,
  moodboardHasWeatherPayload,
  normalizeMoodboardWeatherPayload,
} from "./docBlocks.js";

const samplePayload = {
  kind: "weather-forecast",
  uiDate: "Mar 12",
  location: "Madrid",
  fetchedAt: "2026-03-12T10:00:00.000Z",
  high: 72,
  low: 54,
  condition: "Clear",
  conditionIcon: "clear",
  precipPct: 0,
  wind: { dir: "N", speed: 5, unit: "mph" },
};

function moodboardWithWeatherPlaceholder() {
  return {
    id: "mb1",
    type: DOC_BLOCK_TYPES.MOODBOARD,
    columns: [
      createMoodboardColumn(null),
      createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STACK, {
        images: [
          {
            contentMode: MOODBOARD_SLOT_CONTENT_MODES.WEATHER,
            weatherPayload: null,
          },
          null,
        ],
      }),
      createMoodboardColumn(null),
    ],
  };
}

describe("moodboard weather slot", () => {
  it("normalizes weather payloads", () => {
    expect(normalizeMoodboardWeatherPayload(null)).toBeNull();
    expect(normalizeMoodboardWeatherPayload({ kind: "nope" })).toBeNull();
    const n = normalizeMoodboardWeatherPayload(samplePayload);
    expect(n.kind).toBe("weather-forecast");
    expect(n.uiDate).toBe("Mar 12");
    expect(n.fetchedAt).toBe(samplePayload.fetchedAt);
  });

  it("detects placeholders vs filled", () => {
    expect(isMoodboardWeatherPlaceholder({
      contentMode: "weather",
      weatherPayload: null,
    })).toBe(true);
    expect(isMoodboardWeatherFilled({
      contentMode: "weather",
      weatherPayload: samplePayload,
    })).toBe(true);
    expect(isMoodboardWeatherPlaceholder({
      contentMode: "weather",
      weatherPayload: samplePayload,
    })).toBe(false);
  });

  it("finds the first weather placeholder", () => {
    const block = moodboardWithWeatherPlaceholder();
    expect(findMoodboardWeatherTarget([block])).toEqual({
      blockId: "mb1",
      colIndex: 1,
      imageIndex: 0,
    });
  });

  it("finds weather placeholder in node writing blocks (macronode body)", () => {
    const block = moodboardWithWeatherPlaceholder();
    block.type = "moodboard";
    expect(findMoodboardWeatherTarget([block])).toEqual({
      blockId: "mb1",
      colIndex: 1,
      imageIndex: 0,
    });
  });

  it("fills the placeholder and dedupes by fetchedAt+uiDate", () => {
    const block = moodboardWithWeatherPlaceholder();
    const target = findMoodboardWeatherTarget([block]);
    const next = fillMoodboardWeatherSlot([block], target, samplePayload);
    expect(next).not.toBeNull();
    const slot = next[0].columns[1].images[0];
    expect(isMoodboardWeatherFilled(slot)).toBe(true);
    expect(findMoodboardWeatherTarget(next)).toBeNull();
    expect(moodboardHasWeatherPayload(next, samplePayload)).toBe(true);
  });
});
