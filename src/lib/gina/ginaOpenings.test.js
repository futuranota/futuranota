import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildGinaDocumentSyncOpening,
  hasCompletedTodayDocs,
  pickGinaOpening,
  resolveGinaDashboardOpeningMode,
} from "./ginaOpenings.js";
import {
  clearTodayAgendaChecked,
  markTodayAgendaChecked,
} from "./ginaTodayAgendaCheckStore.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

const now = new Date("2026-08-13T15:00:00");

const ctx = {
  objectId: "co1",
  now,
  userId: "open-user",
  departments: [{
    id: "dept_m",
    objectId: "co1",
    category: "Marketing",
    subcategories: [{ label: "blogs", description: "" }],
  }],
  docs: {
    f1: {
      id: "f1",
      title: "Horizon",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "blogs",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Done blog",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-13T09:00:00",
      anchorFinishAt: "2026-08-13T10:00:00",
      status: "completed",
      completed: true,
    },
    n2: {
      id: "n2",
      title: "Pending blog",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-13T14:00:00",
      anchorFinishAt: "2026-08-13T16:00:00",
      status: "not_started",
    },
  },
};

describe("resolveGinaDashboardOpeningMode", () => {
  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("stays first until agenda is checked", () => {
    expect(resolveGinaDashboardOpeningMode({
      userId: "open-user",
      now,
      ctx,
    })).toBe("first");
  });

  it("uses progress when checked and today has completed", () => {
    markTodayAgendaChecked("open-user", now);
    expect(hasCompletedTodayDocs(ctx)).toBe(true);
    expect(resolveGinaDashboardOpeningMode({
      userId: "open-user",
      now,
      ctx,
    })).toBe("progress");
  });

  it("uses return when checked without completed today", () => {
    markTodayAgendaChecked("open-user", now);
    const bare = {
      ...ctx,
      nodes: {
        n2: ctx.nodes.n2,
      },
    };
    expect(resolveGinaDashboardOpeningMode({
      userId: "open-user",
      now,
      ctx: bare,
    })).toBe("return");
  });

  it("pending chip text routes to today", () => {
    const routed = runGinaQueryFamily("revisar los pendientes de hoy", ctx);
    expect(routed.family).toBe("today");
  });

  it("clear returns to first", () => {
    markTodayAgendaChecked("open-user", now);
    clearTodayAgendaChecked("open-user");
    expect(resolveGinaDashboardOpeningMode({
      userId: "open-user",
      now,
      ctx,
    })).toBe("first");
  });

  it("document sync opening names the live document", () => {
    const es = buildGinaDocumentSyncOpening({
      locale: "es",
      documentTitle: "Campaña agosto",
    });
    expect(es.searchingText).toMatch(/un momento por favor/i);
    expect(es.greeting).toMatch(/documento "Campaña agosto"/);
    expect(es.greeting).toMatch(/Qué necesitas hacer hoy/i);
  });
});
