import { describe, expect, it } from "vitest";
import {
  get_today_scope,
  get_past_due_documents,
  get_folder_children_summary,
  get_schedule_conflicts,
  get_all_company_folders,
  get_workspace_inventory,
  resolveNameAmbiguity,
} from "./ginaTools.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { parseGinaTimeScope } from "./ginaTimeScope.js";
import { pickGinaOpening } from "./ginaOpenings.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "blogs", description: "" }, { label: "Trends", description: "" }],
    },
    {
      id: "dept_s",
      objectId: "co1",
      category: "Ventas",
      subcategories: [{ label: "campaigns", description: "" }],
    },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Snapchat",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "blogs",
      scheduleStartAt: "2026-08-01",
      scheduleFinishAt: "2026-08-07",
    },
    f2: {
      id: "f2",
      title: "Trends",
      parentObjectId: "co1",
      departmentId: "dept_s",
      category: "campaigns",
      scheduleStartAt: "2026-08-01",
      scheduleFinishAt: "2026-08-03",
    },
    f3: {
      id: "f3",
      title: "Trends",
      parentObjectId: "co1",
      // loose folder
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Blog Post",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T08:00:00",
      anchorFinishAt: "2026-08-01T15:00:00",
      status: "in_progress",
    },
    n2: {
      id: "n2",
      title: "Email campaign",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-07-31T10:00:00",
      anchorFinishAt: "2026-07-31T12:00:00",
      status: "past_due",
    },
    n3: {
      id: "n3",
      title: "Moodboard",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T10:00:00",
      anchorFinishAt: "2026-08-01T13:00:00",
      status: "not_started",
    },
    n4: {
      id: "n4",
      title: "Done piece",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T09:00:00",
      anchorFinishAt: "2026-08-01T11:00:00",
      status: "completed",
    },
  },
};

describe("ginaTools", () => {
  it("lists folders with child counts", () => {
    const folders = get_all_company_folders(ctx);
    expect(folders.length).toBeGreaterThanOrEqual(2);
  });

  it("get_today_scope excludes completed and includes folder-window incompletes", () => {
    const scope = get_today_scope(ctx);
    expect(scope.date).toBe("2026-08-01");
    expect(scope.documents.every((d) => d.status !== "completed")).toBe(true);
    expect(scope.totalDocumentsToday).toBeGreaterThanOrEqual(2);
    expect(scope.documents.some((d) => d.title === "Done piece")).toBe(false);
  });

  it("get_workspace_inventory only lists live departments", () => {
    const inv = get_workspace_inventory(ctx);
    const names = inv.departments.map((d) => d.name);
    expect(names).toContain("Marketing");
    expect(names).toContain("Ventas");
    expect(names).not.toContain("Productos");
  });

  it("resolveNameAmbiguity for Trends", () => {
    const amb = resolveNameAmbiguity(ctx, "Trends");
    expect(amb.ambiguous).toBe(true);
    expect(amb.options.length).toBeGreaterThanOrEqual(2);
  });

  it("get_past_due_documents", () => {
    const out = get_past_due_documents(ctx);
    expect(out.totalPastDue).toBeGreaterThanOrEqual(1);
  });

  it("folder summary", () => {
    const sum = get_folder_children_summary(ctx, "f1");
    expect(sum.folderName).toBe("Snapchat");
  });

  it("detects schedule conflicts same day", () => {
    const { conflicts } = get_schedule_conflicts(ctx);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ginaTimeScope", () => {
  it("parses para mañana exclusive", () => {
    const t = parseGinaTimeScope("qué tengo para mañana", now);
    expect(t.kind).toBe("tomorrow_only");
    expect(t.startKey).toBe("2026-08-02");
    expect(t.endKey).toBe("2026-08-02");
  });

  it("parses hasta mañana as two days", () => {
    const t = parseGinaTimeScope("qué tengo hasta mañana", now);
    expect(t.kind).toBe("through_tomorrow");
    expect(t.startKey).toBe("2026-08-01");
    expect(t.endKey).toBe("2026-08-02");
  });

  it("parses dentro de 3 días with confirm", () => {
    const t = parseGinaTimeScope("qué tengo dentro de 3 días", now);
    expect(t.kind).toBe("day_offset");
    expect(t.dayOffset).toBe(3);
    expect(t.needsConfirm).toBe(true);
    expect(t.confirmDateKey).toBe("2026-08-04");
  });

  it("parses hoy", () => {
    const t = parseGinaTimeScope("qué hay para hoy", now);
    expect(t.kind).toBe("today");
  });
});

describe("ginaQueryFamily", () => {
  it("routes today questions", () => {
    const r = runGinaQueryFamily("Gina, qué tengo para hoy?", ctx);
    expect(r.family).toBe("today");
    expect(r.toolsCalled).toContain("get_today_scope");
    expect(r.workspaceInventory?.departments?.length).toBeGreaterThan(0);
  });

  it("routes past due", () => {
    const r = runGinaQueryFamily("qué está vencido?", ctx);
    expect(r.family).toBe("past_due");
  });

  it("routes hasta mañana", () => {
    const r = runGinaQueryFamily("qué tengo hasta mañana", ctx);
    expect(r.family).toBe("through_tomorrow");
  });

  it("asks confirm for dentro de 3 días", () => {
    const r = runGinaQueryFamily("qué tengo dentro de 3 días", ctx);
    expect(r.family).toBe("confirm_date");
    expect(r.toolContext.needsConfirm).toBe(true);
  });

  it("disambiguates Trends", () => {
    const r = runGinaQueryFamily("qué hay en Trends", ctx);
    expect(r.family).toBe("name_ambiguity");
    expect(r.toolContext.ambiguity.options.length).toBeGreaterThanOrEqual(2);
  });

  it("treats xxx as unclear without today overview", () => {
    const r = runGinaQueryFamily("xxx", ctx);
    expect(r.family).toBe("unclear");
    expect(r.toolContext.unclear).toBe(true);
    expect(r.toolsCalled).not.toContain("get_today_scope");
    expect(r.toolsCalled).not.toContain("get_incomplete_documents");
  });

  it("routes greetings as social without today overview", () => {
    const r = runGinaQueryFamily("Gina hora como estas ?", ctx);
    expect(r.family).toBe("social");
    expect(r.toolContext.social).toBe(true);
    expect(r.toolsCalled).not.toContain("get_today_scope");
    expect(r.toolsCalled).not.toContain("get_incomplete_documents");
  });

  it("routes sí/ok as social (not unclear)", () => {
    expect(runGinaQueryFamily("Si", ctx).family).toBe("social");
    expect(runGinaQueryFamily("ok", ctx).family).toBe("social");
  });

  it("routes hola as social", () => {
    const r = runGinaQueryFamily("hola como estas?", ctx);
    expect(r.family).toBe("social");
  });

  it("routes dismiss without today overview", () => {
    const r = runGinaQueryFamily("no en nada gracias", ctx);
    expect(r.family).toBe("dismiss");
    expect(r.toolContext.dismiss).toBe(true);
    expect(r.toolsCalled).not.toContain("get_today_scope");
    expect(r.toolsCalled).not.toContain("get_incomplete_documents");
  });

  it("routes no gracias as dismiss", () => {
    expect(runGinaQueryFamily("no gracias", ctx).family).toBe("dismiss");
  });

  it("routes bueno chao / chao as dismiss", () => {
    expect(runGinaQueryFamily("bueno chao", ctx).family).toBe("dismiss");
    expect(runGinaQueryFamily("chao", ctx).family).toBe("dismiss");
  });

  it("routes necesito saber como estas as social", () => {
    const r = runGinaQueryFamily("Bueno, necesito saber como estas tu primeramente?", ctx);
    expect(r.family).toBe("social");
    expect(r.toolsCalled).not.toContain("get_today_scope");
  });

  it("keeps cómo está {folder} as work, not social", () => {
    const r = runGinaQueryFamily("cómo está Trends", ctx);
    expect(r.family).not.toBe("social");
  });

  it("routes unknown chat to free_chat without today tools", () => {
    const r = runGinaQueryFamily("como esta mi pierna izquierda", ctx);
    expect(r.family).toBe("free_chat");
    expect(r.toolsCalled).not.toContain("get_today_scope");
    expect(r.toolsCalled).not.toContain("get_incomplete_documents");
  });

  it("routes hoy no / hasta luego as dismiss not today", () => {
    const r = runGinaQueryFamily("hoy no, dentro de un rato, he dicho hasta luego", ctx);
    expect(r.family).toBe("dismiss");
    expect(r.toolsCalled).not.toContain("get_today_scope");
  });

  it("routes gracias buenas noches as dismiss", () => {
    expect(runGinaQueryFamily("Gracias buenas noches", ctx).family).toBe("dismiss");
  });

  it("routes sleepy chat to free_chat", () => {
    const r = runGinaQueryFamily("creo que tengo sueno debo de descansar", ctx);
    expect(r.family).toBe("free_chat");
    expect(r.toolsCalled).not.toContain("get_today_scope");
  });

  it("still routes today after greeting words if work cue present", () => {
    const r = runGinaQueryFamily("hola, qué tengo para hoy?", ctx);
    expect(r.family).toBe("today");
    expect(r.toolsCalled).toContain("get_today_scope");
  });
});

describe("ginaOpenings", () => {
  it("varies by salt", () => {
    const a = pickGinaOpening({ locale: "es", userName: "Ross", salt: 0, now });
    const b = pickGinaOpening({ locale: "es", userName: "Ross", salt: 1, now });
    expect(a).toMatch(/Ross|asist|mente|revisar/i);
    expect(a).not.toBe(b);
  });

  it("does not suggest Hoy vencidos in opening", () => {
    for (let salt = 0; salt < 8; salt += 1) {
      const line = pickGinaOpening({ locale: "es", userName: "Futura", salt, now });
      expect(line).not.toMatch(/Hoy,\s*vencidos/i);
    }
  });
});
