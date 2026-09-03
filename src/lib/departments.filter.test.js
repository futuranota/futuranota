import { describe, expect, it } from "vitest";
import {
  ALL_DEPARTMENT_FILTER_ID,
  UNASSIGNED_DEPARTMENT_FILTER_ID,
  folderMatchesDepartmentFilter,
} from "./departments.js";

describe("folderMatchesDepartmentFilter", () => {
  it("shows all folders when filter is ALL", () => {
    expect(
      folderMatchesDepartmentFilter(
        { departmentId: "dept-marketing" },
        ALL_DEPARTMENT_FILTER_ID,
      ),
    ).toBe(true);
    expect(
      folderMatchesDepartmentFilter(
        { departmentId: null },
        ALL_DEPARTMENT_FILTER_ID,
      ),
    ).toBe(true);
  });

  it("Uncategorized only matches folders without department", () => {
    expect(
      folderMatchesDepartmentFilter(
        { departmentId: "dept-marketing" },
        UNASSIGNED_DEPARTMENT_FILTER_ID,
      ),
    ).toBe(false);
    expect(
      folderMatchesDepartmentFilter(
        { departmentId: null },
        UNASSIGNED_DEPARTMENT_FILTER_ID,
      ),
    ).toBe(true);
  });
});
