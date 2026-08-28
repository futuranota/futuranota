import { describe, expect, it } from "vitest";
import { DOC_KIND_CONTENT, DOC_KIND_STANDARD, isUncategorizedFolderDoc } from "./templateDoc.js";
import {
  canReassignDocumentParent,
  isUnassignedDepartmentFolder,
  listMoveTargetFolders,
} from "./nodeParentAdoption.js";

describe("move to folder — department + Uncategorized targets", () => {
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
  const blogsMarketing = {
    id: "blogs-1",
    title: "Blogs",
    docKind: DOC_KIND_CONTENT,
    parentObjectId: "obj-1",
    departmentId: "dept-marketing",
    subcategoryDocIds: ["sub-1"],
  };
  const salesFolder = {
    id: "sales-1",
    title: "Pipeline",
    docKind: DOC_KIND_CONTENT,
    parentObjectId: "obj-1",
    departmentId: "dept-sales",
    subcategoryDocIds: ["sub-2"],
  };
  const stagingNoDept = {
    id: "staging-1",
    title: "Staging",
    docKind: DOC_KIND_CONTENT,
    parentObjectId: "obj-1",
    subcategoryDocIds: [],
  };

  const allDocs = {
    [ideasNoDept.id]: ideasNoDept,
    [ideasWithDept.id]: ideasWithDept,
    [blogsMarketing.id]: blogsMarketing,
    [salesFolder.id]: salesFolder,
    [stagingNoDept.id]: stagingNoDept,
  };

  it("keeps legacy isUncategorizedFolderDoc for sidebar boxes", () => {
    expect(isUncategorizedFolderDoc(legacyUncategorized)).toBe(true);
    expect(isUncategorizedFolderDoc(ideasNoDept)).toBe(false);
  });

  it("detects unassigned-department folders", () => {
    expect(isUnassignedDepartmentFolder(ideasNoDept)).toBe(true);
    expect(isUncategorizedFolderDoc(legacyUncategorized)).toBe(true);
    expect(isUnassignedDepartmentFolder(ideasWithDept)).toBe(false);
    expect(isUnassignedDepartmentFolder(null)).toBe(false);
  });

  it("allows reassign when orphan (no parent folder)", () => {
    expect(canReassignDocumentParent(null, { parentDocId: null })).toBe(true);
    expect(canReassignDocumentParent(null, {})).toBe(true);
  });

  it("allows reassign for content folders with or without departmentId", () => {
    expect(
      canReassignDocumentParent(ideasNoDept, { parentDocId: ideasNoDept.id }),
    ).toBe(true);
    expect(
      canReassignDocumentParent(ideasWithDept, { parentDocId: ideasWithDept.id }),
    ).toBe(true);
  });

  it("blocks reassign for knowledge/template hosts", () => {
    expect(
      canReassignDocumentParent(
        { id: "k-1", docKind: "knowledge", parentObjectId: "obj-1" },
        { parentDocId: "k-1" },
      ),
    ).toBe(false);
    expect(
      canReassignDocumentParent(
        { id: "t-1", docKind: "template", parentObjectId: "obj-1" },
        { parentDocId: "t-1" },
      ),
    ).toBe(false);
  });

  it("lists all adoptable folders when origin is Uncategorized", () => {
    const targets = listMoveTargetFolders(allDocs, {
      parentObjectId: "obj-1",
      fromFolderDoc: ideasNoDept,
      excludeFolderId: ideasNoDept.id,
    });
    expect(targets.map((d) => d.id).sort()).toEqual(
      [blogsMarketing.id, ideasWithDept.id, salesFolder.id, stagingNoDept.id].sort(),
    );
  });

  it("lists same department + Uncategorized when origin has departmentId", () => {
    const targets = listMoveTargetFolders(allDocs, {
      parentObjectId: "obj-1",
      fromFolderDoc: ideasWithDept,
      excludeFolderId: ideasWithDept.id,
    });
    expect(targets.map((d) => d.id).sort()).toEqual(
      [blogsMarketing.id, ideasNoDept.id, stagingNoDept.id].sort(),
    );
    expect(targets.some((d) => d.id === salesFolder.id)).toBe(false);
  });

  it("excludes the origin folder from move targets", () => {
    const targets = listMoveTargetFolders(allDocs, {
      parentObjectId: "obj-1",
      fromFolderDoc: blogsMarketing,
      excludeFolderId: blogsMarketing.id,
    });
    expect(targets.some((d) => d.id === blogsMarketing.id)).toBe(false);
  });

  it("sorts same-department folders before Uncategorized targets", () => {
    const targets = listMoveTargetFolders(allDocs, {
      parentObjectId: "obj-1",
      fromFolderDoc: ideasWithDept,
      excludeFolderId: ideasWithDept.id,
    });
    const blogsIdx = targets.findIndex((d) => d.id === blogsMarketing.id);
    const stagingIdx = targets.findIndex((d) => d.id === stagingNoDept.id);
    expect(blogsIdx).toBeGreaterThanOrEqual(0);
    expect(stagingIdx).toBeGreaterThan(blogsIdx);
  });
});
