import { describe, expect, it } from "vitest";
import {
  reconcileWritingCaret,
  resolveH1KeydownCaret,
} from "./writingCaretReconcile.js";
import {
  applyH1MarkdownShortcutToDocBlocks,
  resolveH1MarkdownShortcutFromKey,
} from "./docMarkdownHeadingShortcut.js";
import { DOC_BLOCK_TYPES, createDocBlock } from "./docBlocks.js";

describe("reconcileWritingCaret", () => {
  it("keeps DOM caret when snapshot is absent", () => {
    expect(reconcileWritingCaret(5, null, 100)).toBe(5);
    expect(reconcileWritingCaret(1, undefined, 100)).toBe(1);
  });

  it("keeps DOM caret when both are near the start", () => {
    expect(reconcileWritingCaret(1, 2, 100)).toBe(1);
    expect(reconcileWritingCaret(2, 10, 100)).toBe(2);
  });

  it("uses snapshot when DOM is stuck at start but user clicked deep", () => {
    const deep = 101;
    expect(reconcileWritingCaret(1, deep, deep)).toBe(deep);
    expect(reconcileWritingCaret(0, 50, 50)).toBe(50);
  });

  it("clamps to text length", () => {
    expect(reconcileWritingCaret(999, 200, 50)).toBe(50);
    expect(reconcileWritingCaret(1, 999, 50)).toBe(50);
  });
});

describe("resolveH1KeydownCaret", () => {
  it("reconciles only for the matching block index", () => {
    expect(resolveH1KeydownCaret(1, { blockIndex: 0, caret: 80 }, 0, 80)).toBe(80);
    expect(resolveH1KeydownCaret(1, { blockIndex: 0, caret: 80 }, 1, 80)).toBe(1);
  });
});

describe("H1 ## deep-line integration", () => {
  it("does not create H1 at line 1 when DOM caret is stale", () => {
    const newlines = "\n".repeat(100);
    const text = `#${newlines}`;
    const snapshotCaret = text.length;
    const wrongDomCaret = 1;

    const reconciled = reconcileWritingCaret(wrongDomCaret, snapshotCaret, text.length);
    const resolved = resolveH1MarkdownShortcutFromKey(text, reconciled, "#");
    expect(resolved).toBeNull();
  });

  it("creates H1 at the deep line when caret is reconciled", () => {
    const prefix = "lkmdfdskf\n\n";
    const text = `${prefix}`;
    const caret = text.length;
    const resolved = resolveH1MarkdownShortcutFromKey(`${text}#`, caret + 1, "#");
    expect(resolved).not.toBeNull();

    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: `${text}#` })];
    const applied = applyH1MarkdownShortcutToDocBlocks(
      blocks,
      0,
      resolved.text,
      resolved.caret,
    );
    expect(applied?.blocks[0].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(applied?.blocks[0].text).toBe(prefix);
    expect(applied?.blocks[1].type).toBe(DOC_BLOCK_TYPES.H1);
  });
});
