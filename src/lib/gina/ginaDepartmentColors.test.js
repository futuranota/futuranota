import { describe, expect, it } from "vitest";
import {
  buildGinaDepartmentRail,
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
});
