import { describe, expect, it } from "vitest";
import {
  collectTagCandidatesForObject,
  collectTagCandidatesForTable,
  collectUniqueTagLabels,
  filterTagCandidates,
  findTagConflictInTable,
  formatMentionToken,
  normalizeTagKey,
} from "./urlTableTags.js";

describe("urlTableTags", () => {
  it("treats tags as case-insensitive", () => {
    expect(normalizeTagKey(" Blog ")).toBe("blog");
    expect(formatMentionToken("blog")).toBe("@blog");
    expect(formatMentionToken("@blog")).toBe("@blog");
  });

  it("finds conflicts only inside the same table", () => {
    const entries = [
      { id: "1", objectId: "c1", tableId: "t1", tag: "Blog" },
      { id: "2", objectId: "c1", tableId: "t1", tag: "sales" },
      { id: "3", objectId: "c1", tableId: "t2", tag: "blog" },
    ];
    expect(findTagConflictInTable(entries, "t1", "blog").conflict).toBe(true);
    expect(findTagConflictInTable(entries, "t1", "blog", "1").conflict).toBe(false);
    expect(findTagConflictInTable(entries, "t2", "sales").conflict).toBe(false);
    expect(findTagConflictInTable(entries, "t2", "blog").conflict).toBe(true);
  });

  it("keeps duplicate tag text across tables as separate candidates", () => {
    const tags = collectTagCandidatesForObject([
      {
        id: "a",
        objectId: "c1",
        tableId: "t1",
        tag: "Blog",
        name: "Old",
        description: "from table 1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "b",
        objectId: "c1",
        tableId: "t2",
        tag: "blog",
        name: "New",
        description: "from table 2",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "c",
        objectId: "c1",
        tableId: "t1",
        tag: "sales",
        name: "Sales",
        description: "",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ], "c1");
    expect(tags).toHaveLength(3);
    expect(tags.filter((t) => normalizeTagKey(t.tag) === "blog")).toHaveLength(2);
  });

  it("lists tagged entries for one table only", () => {
    const tags = collectTagCandidatesForTable([
      { id: "a", tableId: "t1", tag: "blog", name: "A" },
      { id: "b", tableId: "t2", tag: "blog", name: "B" },
    ], "t1");
    expect(tags.map((t) => t.entryId)).toEqual(["a"]);
  });

  it("collects unique labels for column pickers", () => {
    expect(collectUniqueTagLabels([
      { tag: "Blog" },
      { tag: "blog" },
      { tag: "sales" },
      { tag: "" },
    ])).toEqual(["Blog", "sales"]);
  });

  it("filters candidates by tag, name, or description", () => {
    const list = [
      { entryId: "1", tag: "blog", name: "Posts", description: "Weekly" },
      { entryId: "2", tag: "sales", name: "CRM", description: "Pipeline" },
    ];
    expect(filterTagCandidates(list, "wee").map((i) => i.tag)).toEqual(["blog"]);
    expect(filterTagCandidates(list, "crm").map((i) => i.tag)).toEqual(["sales"]);
  });
});
