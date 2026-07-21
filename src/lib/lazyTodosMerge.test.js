import { describe, expect, it } from "vitest";
import {
  filterLazyTodosAgainstDeletedIds,
  mergeLazyTodoLists,
  preferNewerLazyTodo,
} from "./lazyTodosMerge.js";

function todo(patch) {
  return {
    id: "A",
    objectId: null,
    reminder: "",
    listTitle: "To do",
    items: [{ id: "i1", text: "", checked: false }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "queued",
    ...patch,
  };
}

describe("mergeLazyTodoLists", () => {
  it("keeps local-only todos when remote has other items", () => {
    const local = [
      todo({
        id: "local-1",
        reminder: "Ship pack",
        items: [{ id: "i1", text: "Write brief", checked: false }],
        updatedAt: "2026-07-14T12:00:00.000Z",
      }),
    ];
    const remote = [
      todo({
        id: "remote-1",
        reminder: "Old leftover",
        updatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ];

    const merged = mergeLazyTodoLists(local, remote);
    expect(merged.map((item) => item.id).sort()).toEqual(["local-1", "remote-1"]);
  });

  it("does not resurrect tombstoned ids from remote", () => {
    const remote = [todo({ id: "gone", reminder: "Deleted locally" })];
    const merged = mergeLazyTodoLists([], remote, ["gone"]);
    expect(merged).toEqual([]);
  });

  it("keeps tombstone effective after a stale remote row would otherwise win", () => {
    // Simulates: user deleted X, then a late upsert rewrote X on remote,
    // then hydrate runs — deletedIds must still block resurrection.
    const local = [];
    const remote = [
      todo({
        id: "X",
        reminder: "Resurrected by stale upsert",
        updatedAt: "2026-07-21T15:00:00.000Z",
      }),
    ];
    const deletedIds = ["X"];

    const merged = mergeLazyTodoLists(local, remote, deletedIds);
    expect(merged.map((item) => item.id)).toEqual([]);

    // Without tombstone, remote would reappear (documents the bug class).
    const resurrected = mergeLazyTodoLists(local, remote, []);
    expect(resurrected.map((item) => item.id)).toEqual(["X"]);
  });

  it("prefers richer local over newer-but-poorer remote", () => {
    const local = todo({
      reminder: "Campaign",
      items: [
        { id: "i1", text: "Draft email", checked: false },
        { id: "i2", text: "Send follow-up", checked: true },
      ],
      updatedAt: "2026-07-14T10:00:00.000Z",
    });
    const remote = todo({
      reminder: "",
      items: [{ id: "i1", text: "", checked: false }],
      updatedAt: "2026-07-14T12:00:00.000Z",
    });

    expect(preferNewerLazyTodo(local, remote)).toBe(local);
    expect(mergeLazyTodoLists([local], [remote])[0].items).toHaveLength(2);
  });
});

describe("filterLazyTodosAgainstDeletedIds", () => {
  it("strips tombstoned ids from an upsert candidate list", () => {
    const items = [
      todo({ id: "keep", reminder: "Stay" }),
      todo({ id: "gone", reminder: "Delete me" }),
    ];
    const filtered = filterLazyTodosAgainstDeletedIds(items, ["gone"]);
    expect(filtered.map((item) => item.id)).toEqual(["keep"]);
  });

  it("returns all items when deletedIds is empty", () => {
    const items = [todo({ id: "a" }), todo({ id: "b" })];
    expect(filterLazyTodosAgainstDeletedIds(items, []).map((i) => i.id))
      .toEqual(["a", "b"]);
  });
});
