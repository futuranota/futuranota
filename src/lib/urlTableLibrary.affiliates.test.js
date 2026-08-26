import { describe, it, expect, beforeEach } from "vitest";
import { createLinkEntry, normalizeLinkEntries } from "./vaultBlocks.js";
import {
  AFFILIATES_BOARD_TITLE,
  filterUrlTableEntriesByCategory,
  getOrCreateAffiliatesTable,
  uniqueUrlTableCategories,
} from "./urlTableLibrary.js";
import { useUrlTablesStore } from "../stores/urlTablesStore.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";

describe("affiliate board helpers", () => {
  it("keeps imageUrl on createLinkEntry", () => {
    const entry = createLinkEntry({
      name: "Amazon",
      url: "https://amazon.com",
      imageUrl: "https://cdn.example/logo.webp",
    });
    expect(entry.imageUrl).toBe("https://cdn.example/logo.webp");
  });

  it("keeps requirements and allows save without url", () => {
    const entry = createLinkEntry({
      name: "Pending program",
      requirements: "Need tax form",
      affiliateStatus: "pending",
    });
    expect(entry.requirements).toBe("Need tax form");
    expect(entry.url).toBe("");
    const kept = normalizeLinkEntries([entry]);
    expect(kept).toHaveLength(1);
    expect(kept[0].name).toBe("Pending program");
  });

  it("lists unique categories case-insensitively", () => {
    const cats = uniqueUrlTableCategories([
      { category: "Amazon" },
      { category: "amazon" },
      { category: "ShareASale" },
      { category: "  " },
    ]);
    expect(cats).toEqual(["Amazon", "ShareASale"]);
  });

  it("filters entries by category", () => {
    const entries = [
      { name: "a", category: "Amazon" },
      { name: "b", category: "other" },
    ];
    expect(filterUrlTableEntriesByCategory(entries, "amazon").map((e) => e.name)).toEqual(["a"]);
    expect(filterUrlTableEntriesByCategory(entries, "").length).toBe(2);
  });
});

describe("getOrCreateAffiliatesTable", () => {
  beforeEach(() => {
    useUrlTablesStore.setState({ tables: [] });
    useUrlTableStore.setState({ entries: [] });
  });

  it("creates one Affiliates board and reopens it", () => {
    const first = getOrCreateAffiliatesTable("OBJ-aff-1");
    expect(first?.kind).toBe("affiliates");
    expect(first?.title).toBe(AFFILIATES_BOARD_TITLE);
    const second = getOrCreateAffiliatesTable("OBJ-aff-1");
    expect(second?.tableId).toBe(first.tableId);
    const tables = useUrlTablesStore.getState().getTablesForObject("OBJ-aff-1");
    expect(tables.filter((table) => table.kind === "affiliates")).toHaveLength(1);
  });
});
