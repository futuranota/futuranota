import { describe, expect, it } from "vitest";
import {
  isGenericLazyTodoListTitle,
  lazyTodoDisplayTitle,
  liveDocumentTitleForTodo,
  resolveLazyTodoListTitle,
} from "./lazyTodos.js";

describe("lazy todo document title", () => {
  it("treats To do chrome as generic", () => {
    expect(isGenericLazyTodoListTitle("To do")).toBe(true);
    expect(isGenericLazyTodoListTitle("Snapchat brief")).toBe(false);
  });

  it("prefers live document title over stored To do", () => {
    const item = {
      documentId: "n1",
      listTitle: "To do",
      reminder: "note",
      items: [],
    };
    expect(liveDocumentTitleForTodo(item, { n1: { title: "Campaña agosto" } }))
      .toBe("Campaña agosto");
    expect(resolveLazyTodoListTitle(item, { liveDocTitle: "Campaña agosto" }))
      .toBe("Campaña agosto");
    expect(lazyTodoDisplayTitle(item, { liveDocTitle: "Campaña agosto" }))
      .toBe("Campaña agosto");
  });

  it("uses stored listTitle when it is a real document name", () => {
    const item = { documentId: "n1", listTitle: "Campaña agosto", reminder: "", items: [] };
    expect(lazyTodoDisplayTitle(item)).toBe("Campaña agosto");
  });

  it("falls back to reminder for pack todos without a document name", () => {
    const item = { documentId: null, listTitle: "To do", reminder: "Ship pack", items: [] };
    expect(lazyTodoDisplayTitle(item)).toBe("Ship pack");
  });
});
