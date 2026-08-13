/**
 * Live table schema + NL column refine (typos / multi-predicate).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  buildGinaTableSchemaFromVisualization,
  wantsGinaTableColumnRefine,
  parseGinaTableColumnRefine,
  filterDocsByTableColumnRefine,
  buildGinaTableColumnRefineMessage,
  ginaTableColumnLabel,
  matchGinaTableSchemaValue,
  matchAllGinaTableSchemaValues,
  tryParseGinaLastTurnTableBridge,
} from "./ginaTableColumnRefine.js";
import { foldGinaText } from "./ginaTimeScope.js";
import {
  clearGinaLastTurn,
  setGinaLastTurn,
  enrichGinaLastTurnFromVisualization,
  getGinaLastTurn,
} from "./ginaLastTurn.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { parseLastTurnIntent } from "./ginaSyntaxLastTurn.js";

const NOW = new Date(2026, 7, 12, 12, 0, 0); // Wed Aug 12, 2026

function tableViz(docs, opts = {}) {
  return {
    type: "table",
    data: {
      fromCountDocuments: true,
      locale: opts.locale || "es",
      department: opts.department || "Estrategias",
      columns: opts.columns || ["document", "category", "time", "status"],
      view: { showSchedule: true, showStatus: true },
      documents: docs,
    },
  };
}

describe("ginaTableColumnLabel", () => {
  it("ES headers are locale-pure", () => {
    expect(ginaTableColumnLabel("document", "es")).toBe("Documento");
    expect(ginaTableColumnLabel("category", "es")).toBe("Categoría");
    expect(ginaTableColumnLabel("status", "es")).toBe("Estado");
    expect(ginaTableColumnLabel("time", "es")).toBe("Fecha y Hora");
  });
});

describe("buildGinaTableSchemaFromVisualization", () => {
  it("stamps columns + Flexible cell values", () => {
    const schema = buildGinaTableSchemaFromVisualization(
      tableViz([
        { id: "a", title: "Doc A", category: "Blogs", timeLabel: "Flexible", status: "flexible" },
        {
          id: "b",
          title: "Doc B",
          category: "Script",
          dayBadge: "14 Ago",
          timeLabel: "14 Ago · 9:00 a. m. – 10:00 a. m.",
          anchorAt: "2026-08-14T13:00:00.000Z",
          status: "not_started",
        },
      ]),
    );
    expect(schema).toBeTruthy();
    expect(schema.columns.map((c) => c.key)).toEqual(["document", "category", "time", "status"]);
    expect(schema.columns.find((c) => c.key === "time")?.label).toBe("Fecha y Hora");
    expect(schema.valuesByKey.time.some((v) => /flexible/i.test(v))).toBe(true);
  });
});

describe("wantsGinaTableColumnRefine + parse", () => {
  const schema = buildGinaTableSchemaFromVisualization(
    tableViz([
      { id: "a", title: "A", category: "uncategorized", timeLabel: "Flexible" },
      { id: "b", title: "B", category: "Blogs", dayBadge: "12 Ago", timeLabel: "12 Ago · 9:00 a. m." },
    ]),
  );

  it("typo flexymnbles → flexible_only", () => {
    expect(wantsGinaTableColumnRefine("de esta tabla entregame los flexymnbles")).toBe(true);
    const parsed = parseGinaTableColumnRefine("de esta tabla entregame los flexymnbles", schema, NOW);
    expect(parsed?.predicates?.some((p) => p.kind === "flexible_only")).toBe(true);
  });

  it("organiza por Plan de negocios → category cell value", () => {
    const pdnSchema = buildGinaTableSchemaFromVisualization(
      tableViz([
        { id: "a", title: "Apify", category: "—", timeLabel: "Flexible" },
        { id: "b", title: "PDN slot", category: "Plan de Negocio", dayBadge: "08 Ago" },
        { id: "c", title: "Flexible PDN", category: "Plan de Negocio", timeLabel: "Flexible" },
      ]),
    );
    const phrase = "Quiero que le organices si es posible por todos los Plan de negocios";
    expect(parseLastTurnIntent(phrase)).toBe("refine_filter_category");
    expect(wantsGinaTableColumnRefine(phrase, pdnSchema)).toBe(true);
    const hit = matchGinaTableSchemaValue(phrase, pdnSchema);
    expect(hit?.key).toBe("category");
    expect(foldGinaText(hit?.value || "")).toMatch(/plan de negocio/);
    const parsed = tryParseGinaLastTurnTableBridge(phrase, pdnSchema, NOW);
    expect(parsed?.predicates?.[0]?.kind).toBe("value_includes");
    expect(parsed?.predicates?.[0]?.needle).toMatch(/Plan de Negocio/i);
  });

  it("vigentes → upcoming", () => {
    const parsed = parseGinaTableColumnRefine("dame los vigentes de esta tabla", schema, NOW);
    expect(parsed?.predicates?.some((p) => p.kind === "upcoming")).toBe(true);
  });

  it("sin categorías → uncategorized", () => {
    const parsed = parseGinaTableColumnRefine("entregame los sin categorías", schema, NOW);
    expect(parsed?.predicates?.some((p) => p.kind === "uncategorized")).toBe(true);
  });
});

describe("filterDocsByTableColumnRefine", () => {
  const docs = [
    { id: "flex", title: "F", category: "Blogs", status: "flexible" },
    {
      id: "today",
      title: "T",
      category: "Script",
      status: "not_started",
      anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
      anchorFinishAt: new Date(2026, 7, 12, 10, 0, 0).toISOString(),
    },
    {
      id: "past",
      title: "P",
      category: "uncategorized",
      status: "past_due",
      anchorAt: new Date(2026, 7, 10, 9, 0, 0).toISOString(),
      anchorFinishAt: new Date(2026, 7, 10, 10, 0, 0).toISOString(),
    },
  ];

  it("flexible_only keeps unscheduled", () => {
    const out = filterDocsByTableColumnRefine(
      docs,
      { predicates: [{ kind: "flexible_only", key: "time", role: "schedule" }] },
      NOW,
    );
    expect(out.map((d) => d.id)).toEqual(["flex"]);
  });

  it("upcoming keeps today+, drops past and flexible", () => {
    const out = filterDocsByTableColumnRefine(
      docs,
      { predicates: [{ kind: "upcoming", key: "time", role: "schedule" }] },
      NOW,
    );
    expect(out.map((d) => d.id)).toEqual(["today"]);
  });

  it("AND: uncategorized + past", () => {
    const out = filterDocsByTableColumnRefine(
      docs,
      {
        predicates: [
          { kind: "uncategorized", key: "category", role: "category" },
          { kind: "past", key: "time", role: "schedule" },
        ],
      },
      NOW,
    );
    expect(out.map((d) => d.id)).toEqual(["past"]);
  });
});

describe("buildGinaTableColumnRefineMessage", () => {
  it("flexible count copy", () => {
    expect(
      buildGinaTableColumnRefineMessage({
        locale: "es",
        predicates: [{ kind: "flexible_only" }],
        count: 3,
      }),
    ).toMatch(/3 filas flexibles/);
  });
});

describe("lastTurn stamp + router refine", () => {
  beforeEach(() => {
    clearGinaLastTurn();
  });

  it("enrich stamps tableSchema from viz", () => {
    setGinaLastTurn({
      family: "count_documents",
      refKind: "department",
      department: "Estrategias",
      documents: [{ id: "a", title: "A" }, { id: "b", title: "B" }],
      ts: Date.now(),
    });
    enrichGinaLastTurnFromVisualization(
      tableViz([
        { id: "a", title: "A", category: "Blogs", timeLabel: "Flexible" },
        { id: "b", title: "B", category: "Script", dayBadge: "14 Ago", timeLabel: "14 Ago" },
      ]),
      { locale: "es" },
    );
    const last = getGinaLastTurn();
    expect(last?.tableSchema?.columns?.length).toBeGreaterThan(0);
    expect(last?.tableSchema?.columns?.find((c) => c.key === "time")?.label).toBe("Fecha y Hora");
  });

  it("router filters flexibles within last table ids", () => {
    setGinaLastTurn({
      family: "count_documents",
      refKind: "department",
      department: "Estrategias",
      documents: [
        { id: "d1", title: "Flex one" },
        { id: "d2", title: "Timed" },
        { id: "d3", title: "Other flex" },
      ],
      tableSchema: buildGinaTableSchemaFromVisualization(
        tableViz([
          { id: "d1", title: "Flex one", timeLabel: "Flexible" },
          { id: "d2", title: "Timed", dayBadge: "12 Ago", timeLabel: "12 Ago · 9:00 a. m." },
          { id: "d3", title: "Other flex", timeLabel: "Flexible" },
        ]),
      ),
      ts: Date.now(),
    });

    const ctx = {
      objectId: "co1",
      corpusName: "General",
      now: NOW,
      departments: [
        {
          id: "dept_e",
          objectId: "co1",
          category: "Estrategias",
          subcategories: [{ label: "Blogs", description: "" }],
        },
      ],
      docs: {
        f1: {
          id: "f1",
          title: "Folder",
          parentObjectId: "co1",
          departmentId: "dept_e",
          category: "Blogs",
        },
      },
      nodes: {
        d1: {
          id: "d1",
          title: "Flex one",
          parentDocId: "f1",
          objectId: "co1",
          status: "flexible",
        },
        d2: {
          id: "d2",
          title: "Timed",
          parentDocId: "f1",
          objectId: "co1",
          status: "not_started",
          anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
          anchorFinishAt: new Date(2026, 7, 12, 10, 0, 0).toISOString(),
        },
        d3: {
          id: "d3",
          title: "Other flex",
          parentDocId: "f1",
          objectId: "co1",
          status: "flexible",
        },
      },
    };

    const routed = runGinaQueryFamily(
      "de esta tabla entregame los flexymnbles",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext?.fromLastTurnTableRefine).toBe(true);
    expect(routed.toolContext?.documents?.map((d) => d.id).sort()).toEqual(["d1", "d3"]);
  });

  it("bridge: organiza por Plan de negocios filters last table (no ask)", () => {
    setGinaLastTurn({
      family: "count_documents",
      refKind: "list",
      department: null,
      documents: [
        { id: "pdn1", title: "08/08 PDN", category: "Plan de Negocio" },
        { id: "pdn2", title: "Flexible PDN", category: "Plan de Negocio" },
        { id: "other", title: "Tabla de Apify", category: null },
      ],
      tableSchema: buildGinaTableSchemaFromVisualization(
        tableViz([
          { id: "pdn1", title: "08/08 PDN", category: "Plan de Negocio" },
          { id: "pdn2", title: "Flexible PDN", category: "Plan de Negocio" },
          { id: "other", title: "Tabla de Apify", category: "" },
        ], { department: null }),
      ),
      ts: Date.now(),
    });

    const ctx = {
      objectId: "co1",
      corpusName: "Futura nota",
      now: NOW,
      departments: [
        {
          id: "dept_e",
          objectId: "co1",
          category: "Estrategias",
          subcategories: [{ label: "Plan de Negocio", description: "" }],
        },
      ],
      docs: {
        f1: {
          id: "f1",
          title: "PDN folder",
          parentObjectId: "co1",
          departmentId: "dept_e",
          category: "Plan de Negocio",
        },
        f2: {
          id: "f2",
          title: "Other folder",
          parentObjectId: "co1",
          departmentId: "dept_e",
          category: "Blogs",
        },
      },
      nodes: {
        pdn1: {
          id: "pdn1",
          title: "08/08 PDN",
          parentDocId: "f1",
          objectId: "co1",
          status: "not_started",
          category: "Plan de Negocio",
        },
        pdn2: {
          id: "pdn2",
          title: "Flexible PDN",
          parentDocId: "f1",
          objectId: "co1",
          status: "flexible",
          category: "Plan de Negocio",
        },
        other: {
          id: "other",
          title: "Tabla de Apify",
          parentDocId: "f2",
          objectId: "co1",
          status: "flexible",
        },
      },
    };

    const routed = runGinaQueryFamily(
      "Quiero que le organices si es posible por todos los Plan de negocios",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext?.fromLastTurnTableRefine).toBe(true);
    expect(routed.toolContext?.empty).toBe(false);
    const ids = (routed.toolContext?.documents || []).map((d) => d.id).sort();
    expect(ids).toEqual(["pdn1", "pdn2"]);
    expect(ids).not.toContain("other");
  });
});

describe("universal live categories (Birthday — any user corpus)", () => {
  beforeEach(() => {
    clearGinaLastTurn();
  });

  const birthdayViz = () => tableViz(
    [
      {
        id: "b1",
        title: "Cake notes",
        category: "Birthday",
        department: "Personal",
        dayBadge: "12 Ago",
        timeLabel: "12 Ago · 9:00 a. m.",
        status: "not_started",
        anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
      },
      {
        id: "w1",
        title: "Venue",
        category: "Wedding",
        department: "Personal",
        dayBadge: "14 Ago",
        timeLabel: "14 Ago · 11:00 a. m.",
        status: "completed",
        anchorAt: new Date(2026, 7, 14, 11, 0, 0).toISOString(),
      },
      {
        id: "b2",
        title: "Gifts",
        category: "Birthday",
        department: "Ops",
        dayBadge: "12 Ago",
        timeLabel: "12 Ago · 3:00 p. m.",
        status: "completed",
        anchorAt: new Date(2026, 7, 12, 15, 0, 0).toISOString(),
      },
    ],
    {
      columns: ["document", "category", "time", "status"],
      department: null,
    },
  );

  it("stamps invented category Birthday + dept rail names into valuesByKey", () => {
    const schema = buildGinaTableSchemaFromVisualization({
      type: "table",
      data: {
        ...birthdayViz().data,
        departmentRail: [
          { id: "p", name: "Personal", count: 2, color: "#fff" },
          { id: "o", name: "Ops", count: 1, color: "#eee" },
        ],
        railMode: "department",
      },
    });
    expect(schema.valuesByKey.category).toEqual(
      expect.arrayContaining(["Birthday", "Wedding"]),
    );
    expect(schema.valuesByKey.category).not.toContain("Blogs");
    expect(schema.valuesByKey.department).toEqual(
      expect.arrayContaining(["Personal", "Ops"]),
    );
  });

  it("Filtrame por Birthday → value_includes live cell only", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    expect(wantsGinaTableColumnRefine("Filtrame por Birthday", schema)).toBe(true);
    const hit = matchGinaTableSchemaValue("Filtrame por Birthday", schema);
    expect(hit?.key).toBe("category");
    expect(hit?.value).toBe("Birthday");
    const parsed = tryParseGinaLastTurnTableBridge("Filtrame por Birthday", schema, NOW);
    expect(parsed?.predicates?.some((p) => p.kind === "value_includes" && /birthday/i.test(p.needle))).toBe(true);
  });

  it("bare Birthday triggers bridge", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    expect(wantsGinaTableColumnRefine("Birthday", schema)).toBe(true);
    const parsed = tryParseGinaLastTurnTableBridge("Birthday", schema, NOW);
    expect(parsed?.predicates?.[0]?.needle).toMatch(/Birthday/i);
  });

  it("unknown Blogs not in schema → no live category predicate", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    const hit = matchGinaTableSchemaValue("Filtrame por Blogs", schema);
    expect(hit?.key === "category" && /blogs/i.test(hit?.value || "")).toBeFalsy();
  });

  it("completed without saying estado → status_eq", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    const parsed = parseGinaTableColumnRefine("filtrame completed", schema, NOW);
    expect(parsed?.predicates?.some((p) => p.kind === "status_eq" && p.status === "completed")).toBe(true);
  });

  it("Birthday de hoy → AND category + day_offset 0", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    const parsed = parseGinaTableColumnRefine("Birthday de hoy", schema, NOW);
    const kinds = (parsed?.predicates || []).map((p) => p.kind);
    expect(kinds).toContain("value_includes");
    expect(kinds).toContain("day_offset");
    expect(parsed?.predicates?.find((p) => p.kind === "day_offset")?.dayOffset).toBe(0);
    expect(matchAllGinaTableSchemaValues("Birthday de hoy", schema).some((h) => h.value === "Birthday")).toBe(true);

    const docs = [
      {
        id: "b1",
        title: "Cake notes",
        category: "Birthday",
        status: "not_started",
        anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
      },
      {
        id: "w1",
        title: "Venue",
        category: "Wedding",
        status: "completed",
        anchorAt: new Date(2026, 7, 14, 11, 0, 0).toISOString(),
      },
      {
        id: "b2",
        title: "Gifts",
        category: "Birthday",
        status: "completed",
        anchorAt: new Date(2026, 7, 12, 15, 0, 0).toISOString(),
      },
    ];
    const out = filterDocsByTableColumnRefine(docs, parsed, NOW);
    expect(out.map((d) => d.id).sort()).toEqual(["b1", "b2"]);
  });

  it("router: Filtrame por Birthday keeps only Birthday rows from last table", () => {
    const schema = buildGinaTableSchemaFromVisualization(birthdayViz());
    setGinaLastTurn({
      family: "count_documents",
      refKind: "list",
      department: null,
      documents: [
        { id: "b1", title: "Cake notes" },
        { id: "w1", title: "Venue" },
        { id: "b2", title: "Gifts" },
      ],
      tableSchema: schema,
      ts: Date.now(),
    });

    const ctx = {
      objectId: "co1",
      corpusName: "AnyCorp",
      now: NOW,
      departments: [
        {
          id: "dept_p",
          objectId: "co1",
          category: "Personal",
          subcategories: [{ label: "Birthday", description: "" }, { label: "Wedding", description: "" }],
        },
        {
          id: "dept_o",
          objectId: "co1",
          category: "Ops",
          subcategories: [{ label: "Birthday", description: "" }],
        },
      ],
      docs: {
        f1: {
          id: "f1",
          title: "Party",
          parentObjectId: "co1",
          departmentId: "dept_p",
          category: "Birthday",
        },
        f2: {
          id: "f2",
          title: "Wed",
          parentObjectId: "co1",
          departmentId: "dept_p",
          category: "Wedding",
        },
        f3: {
          id: "f3",
          title: "Ops gifts",
          parentObjectId: "co1",
          departmentId: "dept_o",
          category: "Birthday",
        },
      },
      nodes: {
        b1: {
          id: "b1",
          title: "Cake notes",
          parentDocId: "f1",
          objectId: "co1",
          status: "not_started",
          anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
        },
        w1: {
          id: "w1",
          title: "Venue",
          parentDocId: "f2",
          objectId: "co1",
          status: "completed",
          anchorAt: new Date(2026, 7, 14, 11, 0, 0).toISOString(),
        },
        b2: {
          id: "b2",
          title: "Gifts",
          parentDocId: "f3",
          objectId: "co1",
          status: "completed",
          anchorAt: new Date(2026, 7, 12, 15, 0, 0).toISOString(),
        },
      },
    };

    const routed = runGinaQueryFamily("Filtrame por Birthday", ctx);
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext?.fromLastTurnTableRefine).toBe(true);
    expect(routed.toolContext?.documents?.map((d) => d.id).sort()).toEqual(["b1", "b2"]);
    expect(routed.toolContext?.empty).toBe(false);

    const empty = runGinaQueryFamily("Filtrame por Blogs", ctx);
    // No live "Blogs" cell → either empty refine or non-bridge route; never invent Birthday→Blogs
    if (empty.toolContext?.fromLastTurnTableRefine) {
      expect(empty.toolContext.empty).toBe(true);
      expect(empty.toolContext.documents || []).toHaveLength(0);
    }
  });
});
