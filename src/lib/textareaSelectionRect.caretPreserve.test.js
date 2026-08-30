import { describe, expect, it } from "vitest";
import { withPreservedTextareaLayout } from "./textareaSelectionRect.js";

function mockTextarea(value, selectionStart, selectionEnd = selectionStart, scrollTop = 0) {
  const state = {
    value,
    selectionStart,
    selectionEnd,
    scrollTop,
    style: { height: "100px" },
    scrollHeight: value.length * 2,
    offsetHeight: 100,
  };
  const el = {
    tagName: "TEXTAREA",
    value: state.value,
    selectionStart: state.selectionStart,
    selectionEnd: state.selectionEnd,
    scrollTop: state.scrollTop,
    style: state.style,
    scrollHeight: state.scrollHeight,
    offsetHeight: state.offsetHeight,
    setSelectionRange(start, end) {
      state.selectionStart = start;
      state.selectionEnd = end;
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
  return { el, state };
}

describe("withPreservedTextareaLayout", () => {
  it("restores caret and inner scroll after height:auto remeasure", () => {
    const manyLines = "\n".repeat(248);
    const { el, state } = mockTextarea(manyLines, 247, 247, 1200);

    withPreservedTextareaLayout(el, () => {
      el.style.height = "auto";
      el.style.height = "200px";
      state.selectionStart = manyLines.length;
      state.selectionEnd = manyLines.length;
      state.scrollTop = 9999;
      el.selectionStart = state.selectionStart;
      el.selectionEnd = state.selectionEnd;
      el.scrollTop = state.scrollTop;
    });

    expect(el.selectionStart).toBe(247);
    expect(el.selectionEnd).toBe(247);
    expect(el.scrollTop).toBe(1200);
  });
});
