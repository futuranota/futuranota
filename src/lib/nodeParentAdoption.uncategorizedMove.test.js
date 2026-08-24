import { describe, expect, it } from "vitest";
import { DOC_KIND_CONTENT, DOC_KIND_STANDARD, isUncategorizedFolderDoc } from "./templateDoc.js";
import {
  canReassignDocumentParent,
  isUnassignedDepartmentFolder,
} from "./nodeParentAdoption.js";

describe("move from no-department folder gate", () => {
  const legacyUncategorized = {
    id: "uncat-1",
    title: "Legacy box",
    docKind: DOC_KIND_STANDARD,
    parentObjectId: "obj-1",
  };
  const ideasNoDept = {
    id: "ideas-1",
    title: "Ideas",
    docKind: DOC_KIND_CONTENT,
    parentObjectId: "obj-1",
    subcategoryDocIds: ["sub-1"],
  };
  const ideasWithDept = {
    ...ideasNoDept,
    id: "ideas-2",
    departmentId: "dept-marketing",
  };

  it("keeps legacy isUncategorizedFolderDoc for sidebar boxes", () => {
    expect(isUncategorizedFolderDoc(legacyUncategorized)).toBe(true);
    expect(isUncategorizedFolderDoc(ideasNoDept)).toBe(false);
  });

  it("detects unassigned-department folders", () => {
    expect(isUnassignedDepartmentFolder(ideasNoDept)).toBe(true);
    expect(isUnassignedDepartmentFolder(legacyUncategorized)).toBe(true);
    expect(isUnassignedDepartmentFolder(ideasWithDept)).toBe(false);
    expect(isUnassignedDepartmentFolder(null)).toBe(false);
  });

  it("allows reassign when orphan (no parent)", () => {
    expect(canReassignDocumentParent(null, { parentDocId: null })).toBe(true);
    expect(canReassignDocumentParent(null, {})).toBe(true);
  });

  it("allows reassign when parent has no departmentId", () => {
    expect(
      canReassignDocumentParent(ideasNoDept, { parentDocId: ideasNoDept.id }),
    ).toBe(true);
    expect(
      canReassignDocumentParent(legacyUncategorized, {
        parentDocId: legacyUncategorized.id,
      }),
    ).toBe(true);
  });

  it("locks reassign when parent already has a department", () => {
    expect(
      canReassignDocumentParent(ideasWithDept, { parentDocId: ideasWithDept.id }),
    ).toBe(false);
  });
});
