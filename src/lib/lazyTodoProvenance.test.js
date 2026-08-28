import { describe, expect, it } from "vitest";
import {
  LAZY_TODO_UNSCHEDULED_DAY_KEY,
  classifyLazyTodoDayKey,
  collectQueuedLazyTodosForDay,
  compareLazyTodoDayKeys,
  groupLazyTodosByScheduleDay,
  listDocumentsScheduledForDay,
  resolveLazyTodoProvenance,
  scheduleDayKeyForLazyTodo,
  scheduleDayKeyForNode,
} from "./lazyTodoProvenance.js";

describe("lazyTodoProvenance", () => {
  it("reads schedule day from anchorDate or anchorAt", () => {
    expect(scheduleDayKeyForNode({ anchorDate: "2026-08-13" })).toBe("2026-08-13");
    expect(scheduleDayKeyForNode({
      anchorAt: new Date(2026, 7, 24, 15, 0, 0).toISOString(),
    })).toBe("2026-08-24");
    expect(scheduleDayKeyForNode({})).toBe("");
  });

  it("falls back to unscheduled without document or date", () => {
    expect(scheduleDayKeyForLazyTodo({ documentId: null }, {})).toBe(LAZY_TODO_UNSCHEDULED_DAY_KEY);
    expect(scheduleDayKeyForLazyTodo(
      { documentId: "n1" },
      { n1: { id: "n1", title: "Ideas" } },
    )).toBe(LAZY_TODO_UNSCHEDULED_DAY_KEY);
  });

  it("resolves folder provenance from parentDocId", () => {
    const provenance = resolveLazyTodoProvenance(
      { documentId: "n1", listTitle: "Ideas" },
      {
        nodesById: {
          n1: {
            id: "n1",
            title: "Ideas child",
            parentDocId: "folder-1",
            anchorDate: "2026-08-13",
          },
        },
        docsById: {
          "folder-1": { id: "folder-1", title: "Estrategias" },
        },
      },
    );
    expect(provenance.documentTitle).toBe("Ideas child");
    expect(provenance.folderId).toBe("folder-1");
    expect(provenance.folderTitle).toBe("Estrategias");
    expect(provenance.dayKey).toBe("2026-08-13");
    expect(provenance.canOpenDocument).toBe(true);
    expect(provenance.canOpenFolder).toBe(true);
  });

  it("resolves product folder display title from category and version", () => {
    const provenance = resolveLazyTodoProvenance(
      { documentId: "n1" },
      {
        nodesById: {
          n1: {
            id: "n1",
            title: "Launch doc",
            parentDocId: "folder-prod",
          },
        },
        docsById: {
          "folder-prod": {
            id: "folder-prod",
            docKind: "product",
            category: "Marketing",
            version: "Q3",
          },
        },
      },
    );
    expect(provenance.folderTitle).toBe("Marketing Q3");
  });

  it("groups todos by document schedule day", () => {
    const today = "2026-08-24";
    const groups = groupLazyTodosByScheduleDay(
      [
        {
          id: "a",
          documentId: "n-today",
          reminder: "r",
          items: [{ id: "1", text: "x", checked: false }],
          updatedAt: "2026-08-24T10:00:00.000Z",
          createdAt: "2026-08-24T10:00:00.000Z",
        },
        {
          id: "b",
          documentId: "n-tom",
          reminder: "r2",
          items: [{ id: "2", text: "y", checked: false }],
          updatedAt: "2026-08-24T11:00:00.000Z",
          createdAt: "2026-08-24T11:00:00.000Z",
        },
        {
          id: "c",
          documentId: null,
          reminder: "loose",
          items: [],
          updatedAt: "2026-08-24T12:00:00.000Z",
          createdAt: "2026-08-24T12:00:00.000Z",
        },
      ],
      {
        today,
        nodesById: {
          "n-today": { id: "n-today", anchorDate: today },
          "n-tom": { id: "n-tom", anchorDate: "2026-08-25" },
        },
      },
    );
    expect(groups.map((g) => g.dayKey)).toEqual([
      today,
      "2026-08-25",
      LAZY_TODO_UNSCHEDULED_DAY_KEY,
    ]);
    expect(classifyLazyTodoDayKey(today, { today })).toBe("today");
    expect(classifyLazyTodoDayKey("2026-08-25", { today })).toBe("tomorrow");
    expect(compareLazyTodoDayKeys(today, "2026-08-25", today)).toBeLessThan(0);
  });

  it("collects queued siblings for a day and appends an extra draft", () => {
    const today = "2026-08-24";
    const nodesById = {
      "n-today": { id: "n-today", anchorDate: today },
      "n-tom": { id: "n-tom", anchorDate: "2026-08-25" },
    };
    const items = [
      {
        id: "a",
        objectId: "obj-1",
        documentId: "n-today",
        status: "queued",
        reminder: "r",
        items: [{ id: "1", text: "x", checked: false }],
        updatedAt: "2026-08-24T10:00:00.000Z",
        createdAt: "2026-08-24T10:00:00.000Z",
      },
      {
        id: "b",
        objectId: "obj-1",
        documentId: "n-tom",
        status: "queued",
        reminder: "r2",
        items: [{ id: "2", text: "y", checked: false }],
        updatedAt: "2026-08-24T11:00:00.000Z",
        createdAt: "2026-08-24T11:00:00.000Z",
      },
      {
        id: "c",
        objectId: "obj-2",
        documentId: "n-today",
        status: "queued",
        reminder: "other company",
        items: [{ id: "3", text: "z", checked: false }],
        updatedAt: "2026-08-24T12:00:00.000Z",
        createdAt: "2026-08-24T12:00:00.000Z",
      },
    ];
    const draft = {
      id: "draft",
      objectId: "obj-1",
      documentId: null,
      status: "active",
      reminder: "",
      items: [],
      updatedAt: "2026-08-24T13:00:00.000Z",
      createdAt: "2026-08-24T13:00:00.000Z",
    };
    const collected = collectQueuedLazyTodosForDay(
      "obj-1",
      today,
      items,
      nodesById,
      { extraItem: draft },
    );
    expect(collected.map((item) => item.id)).toEqual(["draft", "a"]);
  });

  it("lists documents scheduled for a day", () => {
    const today = "2026-08-24";
    const listed = listDocumentsScheduledForDay(
      {
        n1: {
          id: "n1",
          title: "Blog A",
          parentDocId: "folder-1",
          anchorDate: today,
        },
        n2: {
          id: "n2",
          title: "Blog B",
          parentDocId: "folder-1",
          anchorDate: "2026-08-25",
        },
        n3: {
          id: "n3",
          title: "Orphan",
          parentDocId: null,
          anchorDate: today,
        },
      },
      today,
    );
    expect(listed.map((row) => row.id)).toEqual(["n1"]);
  });
});
