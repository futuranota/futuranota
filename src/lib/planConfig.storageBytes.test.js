import { describe, expect, it } from "vitest";
import { formatStorageBytes } from "./planConfig.js";

describe("formatStorageBytes", () => {
  it("formats common sizes", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(2048)).toBe("2 KB");
    expect(formatStorageBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatStorageBytes(5 * 1024 * 1024 * 1024)).toBe("5 GB");
  });
});
