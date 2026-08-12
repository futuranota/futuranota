import { describe, expect, it } from "vitest";
import { resolveSupabaseStorageMeterKind } from "./quotaCatalog.js";

describe("resolveSupabaseStorageMeterKind", () => {
  it("maps 100 GB included to bucket and 8 GB to postgres", () => {
    expect(resolveSupabaseStorageMeterKind({
      provider: "supabase",
      included: 100,
      unit: "GB",
    })).toBe("bucket");
    expect(resolveSupabaseStorageMeterKind({
      provider: "supabase",
      included: 8,
      unit: "GB",
    })).toBe("postgres");
  });

  it("honors notes/name override", () => {
    expect(resolveSupabaseStorageMeterKind({
      provider: "supabase",
      included: 100,
      unit: "GB",
      notes: "postgres toast",
    })).toBe("postgres");
    expect(resolveSupabaseStorageMeterKind({
      provider: "supabase",
      included: 8,
      unit: "GB",
      productName: "doc-images bucket",
    })).toBe("bucket");
  });
});
