import { describe, expect, it } from "vitest";
import {
  LAZY_TODO_SHELL_CARD_LIMIT,
  collectQueuedLazyTodosForShell,
  groupLazyTodosByShell,
  resolveShellId,
  shellIdForDocument,
} from "./lazyTodoShell.js";

describe("lazyTodoShell", () => {
  it("uses stable shell per document and per standalone item", () => {
    expect(shellIdForDocument("doc-a")).toBe("shell-doc-doc-a");
    expect(resolveShellId({ id: "x", documentId: "doc-a" })).toBe("shell-doc-doc-a");
    expect(resolveShellId({ id: "solo-1", documentId: null })).toBe("shell-solo-1");
    expect(resolveShellId({ id: "solo-2", shellId: "custom" })).toBe("custom");
  });

  it("groups by shell id regardless of document schedule date", () => {
    const groups = groupLazyTodosByShell(
      [
        {
          id: "a",
          shellId: "shell-one",
          documentId: "n1",
          reminder: "A",
          items: [{ id: "1", text: "x", checked: false }],
          updatedAt: "2026-08-24T10:00:00.000Z",
          createdAt: "2026-08-24T10:00:00.000Z",
        },
        {
          id: "b",
          shellId: "shell-one",
          documentId: "n2",
          reminder: "B",
          items: [{ id: "2", text: "y", checked: false }],
          updatedAt: "2026-08-24T11:00:00.000Z",
          createdAt: "2026-08-24T11:00:00.000Z",
        },
        {
          id: "c",
          shellId: "shell-two",
          documentId: null,
          reminder: "solo",
          items: [{ id: "3", text: "z", checked: false }],
          updatedAt: "2026-08-24T12:00:00.000Z",
          createdAt: "2026-08-24T12:00:00.000Z",
        },
      ],
      {
        nodesById: {
          n1: { id: "n1", anchorDate: "2026-08-24" },
          n2: { id: "n2", anchorDate: "2026-08-27" },
        },
      },
    );
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.shellId === "shell-one")?.items).toHaveLength(2);
    expect(groups.find((g) => g.shellId === "shell-two")?.items).toHaveLength(1);
  });

  it("collects queued siblings for a shell", () => {
    const items = [
      {
        id: "a",
        objectId: "obj-1",
        shellId: "shell-x",
        status: "queued",
        reminder: "r",
        items: [{ id: "1", text: "x", checked: false }],
        updatedAt: "2026-08-24T10:00:00.000Z",
        createdAt: "2026-08-24T10:00:00.000Z",
      },
      {
        id: "b",
        objectId: "obj-1",
        shellId: "shell-y",
        status: "queued",
        reminder: "other shell",
        items: [{ id: "2", text: "y", checked: false }],
        updatedAt: "2026-08-24T11:00:00.000Z",
        createdAt: "2026-08-24T11:00:00.000Z",
      },
    ];
    const draft = {
      id: "draft",
      objectId: "obj-1",
      shellId: "shell-x",
      status: "active",
      reminder: "",
      items: [],
      updatedAt: "2026-08-24T13:00:00.000Z",
      createdAt: "2026-08-24T13:00:00.000Z",
    };
    const collected = collectQueuedLazyTodosForShell(
      "obj-1",
      "shell-x",
      items,
      { extraItem: draft },
    );
    expect(collected.map((item) => item.id)).toEqual(["draft", "a"]);
  });

  it("exports a card limit constant", () => {
    expect(LAZY_TODO_SHELL_CARD_LIMIT).toBeGreaterThan(1);
  });
});
