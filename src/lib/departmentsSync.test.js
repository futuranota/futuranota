import { describe, expect, it } from "vitest";
import {
  applyDepartmentTombstones,
  markDepartmentDeleted,
  markDepartmentTagsDeleted,
} from "./departmentsSync.js";

describe("department tombstones", () => {
  it("drops tombstoned departments", () => {
    const id = `DEPT-tombstone-${Date.now()}-a`;
    markDepartmentDeleted(id);
    const stripped = applyDepartmentTombstones([
      {
        id,
        objectId: "OBJ-1",
        category: "Ghost",
        description: "",
        subcategories: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(stripped.find((d) => d.id === id)).toBeUndefined();
  });

  it("drops tombstoned category tags", () => {
    const id = `DEPT-tombstone-${Date.now()}-b`;
    markDepartmentTagsDeleted(id, ["this-is-about-to-get-erased", "Inversionistas"]);
    const stripped = applyDepartmentTombstones([
      {
        id,
        objectId: "OBJ-1",
        category: "Estrategias",
        description: "",
        subcategories: [
          { label: "Plan de Negocio", description: "" },
          { label: "this-is-about-to-get-erased", description: "" },
          { label: "Inversionistas", description: "" },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(stripped).toHaveLength(1);
    expect(stripped[0].subcategories.map((t) => t.label)).toEqual(["Plan de Negocio"]);
  });
});
