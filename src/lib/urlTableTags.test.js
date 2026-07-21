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

  it("never reports tag conflicts (duplicates are allowed)", () => {
    const entries = [
      { id: "1", objectId: "c1", tableId: "t1", tag: "Blog" },
      { id: "2", objectId: "c1", tableId: "t1", tag: "blog" },
    ];
    expect(findTagConflictInTable(entries, "t1", "blog").conflict).toBe(false);
    expect(findTagConflictInTable(entries, "t1", "Blog", "1").conflict).toBe(false);
  });

  it("keeps duplicate tag text within and across tables as separate candidates", () => {
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
        tag: "Blog",
        name: "Also blogs",
        description: "second row same table",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "d",
        objectId: "c1",
        tableId: "t1",
        tag: "sales",
        name: "Sales",
        description: "",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ], "c1");
    expect(tags).toHaveLength(4);
    expect(tags.filter((t) => normalizeTagKey(t.tag) === "blog")).toHaveLength(3);
    expect(tags.map((t) => t.entryId).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("lists tagged entries for one table only (including duplicate tags)", () => {
    const tags = collectTagCandidatesForTable([
      { id: "a", tableId: "t1", tag: "blog", name: "A" },
      { id: "b", tableId: "t2", tag: "blog", name: "B" },
      { id: "c", tableId: "t1", tag: "blog", name: "C" },
    ], "t1");
    expect(tags.map((t) => t.entryId).sort()).toEqual(["a", "c"]);
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
