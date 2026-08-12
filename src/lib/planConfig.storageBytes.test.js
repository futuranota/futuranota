import { describe, expect, it } from "vitest";
import { formatStorageBytes, formatStorageBytesParts } from "./planConfig.js";

describe("formatStorageBytes", () => {
  it("formats common sizes", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(2048)).toBe("2 KB");
    expect(formatStorageBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatStorageBytes(5 * 1024 * 1024 * 1024)).toBe("5 GB");
  });
});

describe("formatStorageBytesParts", () => {
  it("keeps GB and MB when summing mixed plan caps", () => {
    const twoProPlusFree = (5 + 5) * 1024 ** 3 + 5 * 1024 ** 2;
    expect(formatStorageBytesParts(twoProPlusFree)).toBe("10 GB + 5 MB");
  });
});
