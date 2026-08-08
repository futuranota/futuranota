import { describe, expect, it } from "vitest";
import {
  buildGinaDepartmentRail,
  buildGinaDepartmentRailRuns,
  ginaDepartmentRailColor,
  GINA_DEPT_RAIL_UNASSIGNED,
} from "./ginaDepartmentColors.js";

describe("ginaDepartmentColors", () => {
  it("builds proportional segments in appearance order", () => {
    const rail = buildGinaDepartmentRail([
      { department: "Marketing", title: "a" },
      { department: "Marketing", title: "b" },
      { department: "Sales", title: "c" },
      { department: "", title: "orphan" },
    ]);
    expect(rail).toHaveLength(3);
    expect(rail[0]).toMatchObject({ name: "Marketing", count: 2 });
    expect(rail[1]).toMatchObject({ name: "Sales", count: 1 });
    expect(rail[2]).toMatchObject({ name: "# Department", count: 1, color: GINA_DEPT_RAIL_UNASSIGNED });
    expect(rail[0].color).not.toBe(rail[1].color);
  });

  it("spreads colors across palette for few departments", () => {
    expect(ginaDepartmentRailColor(0, 2)).toBeTruthy();
    expect(ginaDepartmentRailColor(1, 2)).not.toBe(ginaDepartmentRailColor(0, 2));
  });

  it("rail runs keep interleaved departments aligned to row order", () => {
    const colorByDept = {
      Marketing: "#008AF5",
      Sales: "#EAA65D",
      "Estrategias de negocios": "#E87898",
    };
    const runs = buildGinaDepartmentRailRuns(
      [
        { department: "Marketing", title: "m1" },
        { department: "Marketing", title: "m2" },
        { department: "Sales", title: "s1" },
        { department: "Estrategias de negocios", title: "e1" },
        { department: "Marketing", title: "m3" },
      ],
      { colorByDept },
    );
    // Not Marketing×3 | Sales | Estrategias — that misaligned the 3rd/4th/5th rows
    expect(runs.map((r) => `${r.name}:${r.count}`)).toEqual([
      "Marketing:2",
      "Sales:1",
      "Estrategias de negocios:1",
      "Marketing:1",
    ]);
    expect(runs[0].color).toBe("#008AF5");
    expect(runs[1].color).toBe("#EAA65D");
    expect(runs[2].color).toBe("#E87898");
    expect(runs[3].color).toBe("#008AF5");
    expect(runs.reduce((acc, r) => acc + r.count, 0)).toBe(5);
  });

  it("rail runs prefer departmentColor on the doc", () => {
    const runs = buildGinaDepartmentRailRuns([
      { department: "Sales", departmentColor: "#ff0000", title: "a" },
      { department: "Sales", departmentColor: "#ff0000", title: "b" },
    ]);
    expect(runs).toEqual([
      { name: "Sales", count: 2, color: "#ff0000" },
    ]);
  });
});
