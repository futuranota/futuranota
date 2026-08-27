import { describe, expect, it } from "vitest";
import { getForecastSearchGate } from "./forecastSearch.js";

const dayIds = ["2026-08-27", "2026-08-28", "2026-08-29"];

function baseParams(overrides = {}) {
  return {
    hasLocation: true,
    panelStatus: "ready",
    panelLocationKey: "city:houston",
    locationKey: "city:houston",
    dayIds,
    selectedDayId: "",
    node: null,
    ...overrides,
  };
}

describe("getForecastSearchGate", () => {
  it("prefers panel-selected day over node date", () => {
    const node = {
      id: "n1",
      anchorAt: "2026-08-28T09:00:00",
    };
    const gate = getForecastSearchGate(baseParams({
      selectedDayId: "2026-08-27",
      node,
    }));
    expect(gate.enabled).toBe(true);
    expect(gate.reason).toBe("panelDay");
    expect(gate.dateIso).toBe("2026-08-27");
    expect(gate.fromPanel).toBe(true);
  });

  it("requires opening a panel day when no node is selected", () => {
    const gate = getForecastSearchGate(baseParams());
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe("noDay");
  });

  it("falls back to node date when panel day is not selected", () => {
    const node = {
      id: "n1",
      anchorAt: "2026-08-28T14:00:00",
    };
    const gate = getForecastSearchGate(baseParams({ node }));
    expect(gate.enabled).toBe(true);
    expect(gate.reason).toBe("ready");
    expect(gate.dateIso).toBe("2026-08-28");
    expect(gate.fromPanel).toBe(false);
  });

  it("ignores stale selectedDayId outside loaded window", () => {
    const node = {
      id: "n1",
      anchorAt: "2026-08-29T10:00:00",
    };
    const gate = getForecastSearchGate(baseParams({
      selectedDayId: "2026-09-01",
      node,
    }));
    expect(gate.enabled).toBe(true);
    expect(gate.reason).toBe("ready");
    expect(gate.dateIso).toBe("2026-08-29");
    expect(gate.fromPanel).toBe(false);
  });
});
