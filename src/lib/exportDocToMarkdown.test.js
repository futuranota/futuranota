import { describe, expect, it } from "vitest";
import {
  buildWritingBlocksMarkdown,
  exportWritingBlocksToMarkdown,
  sanitizeMarkdownFileName,
  segmentsToMarkdown,
} from "./exportDocToMarkdown.js";
import {
  createEmptyTextBlock,
  createInlineCodeBlock,
  createInlineH1Block,
  createInlineH2Block,
  createInlineTodoBlock,
} from "./nodeInlineContent.js";
import { createTodoItem } from "./docBlocks.js";

describe("exportDocToMarkdown", () => {
  it("serializes headings, text, code, and todos", () => {
    const todo = createInlineTodoBlock("Checklist");
    todo.items = [
      createTodoItem({ text: "Ship", checked: true }),
      createTodoItem({ text: "Review", checked: false }),
    ];
    const md = buildWritingBlocksMarkdown([
      createInlineH1Block("Title"),
      createEmptyTextBlock("Body paragraph."),
      createInlineH2Block("Section"),
      createInlineCodeBlock("js", "const x = 1;"),
      todo,
    ]);

    expect(md).toContain("# Title");
    expect(md).toContain("Body paragraph.");
    expect(md).toContain("## Section");
    expect(md).toContain("```javascript\nconst x = 1;\n```");
    expect(md).toContain("### Checklist");
    expect(md).toContain("- [x] Ship");
    expect(md).toContain("- [ ] Review");
  });

  it("returns empty for blank writing", () => {
    expect(buildWritingBlocksMarkdown([createEmptyTextBlock("")])).toBe("");
    expect(exportWritingBlocksToMarkdown([createEmptyTextBlock("")])).toEqual({
      ok: false,
      empty: true,
    });
  });

  it("skips non-http image srcs but keeps caption text via segments", () => {
    const md = segmentsToMarkdown([
      { kind: "image", src: "blob:abc", caption: "Local shot" },
      { kind: "image", src: "https://cdn.example.com/a.png", caption: "Remote" },
    ]);
    expect(md).toContain("Local shot");
    expect(md).toContain("![Remote](https://cdn.example.com/a.png)");
    expect(md).not.toContain("blob:");
  });

  it("sanitizes markdown filenames", () => {
    expect(sanitizeMarkdownFileName("My Doc.pdf")).toBe("My Doc.md");
    expect(sanitizeMarkdownFileName("notes")).toBe("notes.md");
  });
});
