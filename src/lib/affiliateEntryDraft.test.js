import { describe, expect, it } from "vitest";
import { createLinkEntry } from "./vaultBlocks.js";
import {
  affiliateDraftToLinkEntry,
  isAffiliateDraftComplete,
  linkEntryToAffiliateDraft,
  mergeAffiliateDraftAndStaging,
} from "./affiliateEntryDraft.js";

describe("isAffiliateDraftComplete", () => {
  it("requires a name", () => {
    expect(isAffiliateDraftComplete({ description: "hello" })).toBe(false);
  });

  it("requires at least one content field besides name", () => {
    expect(isAffiliateDraftComplete({ name: "Acme" })).toBe(false);
    expect(isAffiliateDraftComplete({ name: "Acme", tag: "saas" })).toBe(true);
    expect(isAffiliateDraftComplete({ name: "Acme", url: "https://x.com" })).toBe(true);
  });
});

describe("affiliateDraftToLinkEntry", () => {
  it("normalizes url and defaults status to pending", () => {
    const entry = affiliateDraftToLinkEntry({
      name: "Acme",
      url: "example.com",
      affiliateStatus: "pending",
    });
    expect(entry.name).toBe("Acme");
    expect(entry.url).toBe("https://example.com");
    expect(entry.affiliateStatus).toBe("pending");
  });
});

describe("linkEntryToAffiliateDraft", () => {
  it("maps page-1 fields", () => {
    const draft = linkEntryToAffiliateDraft({
      id: "a",
      name: "Hub",
      tag: "crm",
      category: "SaaS",
      description: "Notes",
      url: "https://hub.com",
      imageUrl: "https://img",
      requirements: "Apply",
      affiliateStatus: "active",
    });
    expect(draft.name).toBe("Hub");
    expect(draft.tag).toBe("crm");
    expect(draft.affiliateStatus).toBe("active");
  });
});

describe("mergeAffiliateDraftAndStaging", () => {
  it("keeps page-2 fields from staging", () => {
    const staging = createLinkEntry({
      name: "Old",
      commissionRate: 10,
      productPrice: 100,
      cookieDays: 30,
      clientsWon: 2,
    });
    const merged = mergeAffiliateDraftAndStaging(
      { name: "New", description: "Updated", affiliateStatus: "pending" },
      staging,
      staging.id,
    );
    expect(merged.name).toBe("New");
    expect(merged.description).toBe("Updated");
    expect(merged.commissionRate).toBe(10);
    expect(merged.productPrice).toBe(100);
  });
});
