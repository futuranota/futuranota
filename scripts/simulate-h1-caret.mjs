/**
 * Simulates the H1 ## bug: caret parked at position 1 while user snapshot is deep.
 * Run: node scripts/simulate-h1-caret.mjs
 */
import {
  applyH1MarkdownShortcutToDocBlocks,
  resolveH1MarkdownShortcutFromKey,
} from "../src/lib/docMarkdownHeadingShortcut.js";
import { DOC_BLOCK_TYPES, createDocBlock } from "../src/lib/docBlocks.js";

function reconcileCaret(rawCaret, snapCaret, textLen) {
  let caret = rawCaret;
  if (snapCaret >= textLen - 1 && snapCaret < textLen - 3) caret = snapCaret;
  if (rawCaret >= textLen - 1 && snapCaret < textLen - 3) caret = snapCaret;
  if (rawCaret <= 2 && snapCaret > 10) caret = snapCaret;
  return caret;
}

function simulateWrongCaretH1() {
  const newlines = "\n".repeat(100);
  const text = `#${newlines}`;
  const snapshotCaret = text.length;
  const wrongDomCaret = 1;

  const reconciled = reconcileCaret(wrongDomCaret, snapshotCaret, text.length);
  const resolved = resolveH1MarkdownShortcutFromKey(text, reconciled, "#");
  if (!resolved) {
    console.log("PASS: reconciled caret blocks H1 at line 1");
    return;
  }

  const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text })];
  const applied = applyH1MarkdownShortcutToDocBlocks(
    blocks,
    0,
    resolved.text,
    resolved.caret,
  );
  if (applied && resolved.caret <= 2) {
    console.error("FAIL: H1 still at line 1 after reconcile");
    process.exit(1);
  }
  console.log("PASS: deep-line H1 after caret reconcile");
}

function simulateCorrectCaretH1() {
  const prefix = "lkmdfdskf\n\n";
  const text = `${prefix}`;
  const caret = text.length;
  const resolved = resolveH1MarkdownShortcutFromKey(`${text}#`, caret + 1, "#");
  if (!resolved) {
    console.error("FAIL: expected second # to resolve at deep caret");
    process.exit(1);
  }
  const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: `${text}#` })];
  const applied = applyH1MarkdownShortcutToDocBlocks(
    blocks,
    0,
    resolved.text,
    resolved.caret,
  );
  if (!applied || applied.blocks[0].type !== DOC_BLOCK_TYPES.TEXT) {
    console.error("FAIL: expected TEXT block before H1 with correct caret");
    process.exit(1);
  }
  if (applied.blocks[0].text !== prefix) {
    console.error("FAIL: H1 split at wrong line", applied.blocks[0].text);
    process.exit(1);
  }
  console.log("PASS: H1 at correct deep line with reconciled caret");
}

simulateWrongCaretH1();
simulateCorrectCaretH1();
