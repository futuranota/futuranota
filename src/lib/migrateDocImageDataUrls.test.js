import { describe, expect, it } from "vitest";
import {
  countImageDataUrlsInBlocks,
  dataUrlToBlob,
  docBlocksHaveImageDataUrls,
  isDocImageDataUrl,
  migrateDocBlocksImageDataUrls,
  resolveDocBlocksForImageMigration,
} from "./migrateDocImageDataUrls.js";
import { DOC_BLOCK_TYPES, createDocBlock } from "./docBlocks.js";

describe("isDocImageDataUrl", () => {
  it("detects raster data URLs", () => {
    expect(isDocImageDataUrl("data:image/webp;base64,AAAA")).toBe(true);
    expect(isDocImageDataUrl("data:image/png;base64,AAAA")).toBe(true);
  });

  it("ignores http URLs and tiny svg icons", () => {
    expect(isDocImageDataUrl("https://example.com/a.webp")).toBe(false);
    expect(isDocImageDataUrl("data:image/svg+xml;utf8,<svg></svg>")).toBe(false);
  });
});

describe("dataUrlToBlob", () => {
  it("decodes base64 webp payload", () => {
    const blob = dataUrlToBlob("data:image/webp;base64,QQ==");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBe(1);
  });
});

describe("docBlocksHaveImageDataUrls", () => {
  it("finds nested moodboard and product images", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.IMAGE, {
        id: "b1",
        src: "https://cdn.example/x.webp",
        imageSaved: true,
      }),
      createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, {
        id: "b2",
        images: [{ id: "i1", src: "data:image/webp;base64,QQ==", name: "a.webp" }],
      }),
    ];
    expect(docBlocksHaveImageDataUrls(blocks)).toBe(true);
    expect(countImageDataUrlsInBlocks(blocks)).toBe(1);
  });
});

describe("resolveDocBlocksForImageMigration", () => {
  it("falls back to body when blocks lack data URLs", () => {
    const body = `::image\n${JSON.stringify({
      src: "data:image/webp;base64,QQ==",
      name: "a.webp",
      alt: "",
      width: 1,
      height: 1,
      imageSaved: true,
    })}`;
    const blocks = resolveDocBlocksForImageMigration({
      blocks: [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "hi" })],
      body,
    });
    expect(docBlocksHaveImageDataUrls(blocks)).toBe(true);
  });
});

describe("migrateDocBlocksImageDataUrls", () => {
  it("leaves blocks unchanged when there are no data URLs", async () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.IMAGE, {
        id: "b1",
        src: "https://cdn.example/x.webp",
        imageSaved: true,
      }),
    ];
    const result = await migrateDocBlocksImageDataUrls(blocks, { docId: "DOC1" });
    expect(result.migratedCount).toBe(0);
    expect(result.blocks[0].src).toBe("https://cdn.example/x.webp");
  });
});
