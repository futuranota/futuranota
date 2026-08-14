/**
 * Table contract + week prefs.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  getGinaPrefs,
  setGinaPrefs,
  resetGinaPrefs,
} from "./ginaPrefs.js";
import {
  GINA_TABLE_MAX_COLUMNS,
  GINA_TABLE_MAX_PREDICATES,
  resolveGinaTableView,
} from "./ginaTableViewContract.js";
import { ginaWeekBounds } from "./ginaTimeScope.js";
import { formatGinaWeekdayLetter } from "./ginaRelativeDay.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { wantsFolderDocsList, wantsNamedCategoryListFolders } from "./ginaQueryFamily.js";

const NOW = new Date(2026, 7, 12, 12, 0, 0); // Wed Aug 12

describe("ginaPrefs + week bounds", () => {
  beforeEach(() => {
    resetGinaPrefs();
  });

  it("defaults to Monday start", () => {
    expect(getGinaPrefs().weekStartsOn).toBe(1);
    const { monday, sunday, weekStartsOn } = ginaWeekBounds(NOW, 0);
    expect(weekStartsOn).toBe(1);
    expect(monday.getDay()).toBe(1);
    expect(sunday.getDay()).toBe(0);
  });

  it("can switch to Sunday start via prefs", () => {
    setGinaPrefs({ weekStartsOn: 0 });
    const { weekStart, weekEnd } = ginaWeekBounds(NOW, 0);
    expect(weekStart.getDay()).toBe(0);
    expect(weekEnd.getDay()).toBe(6);
  });
});

describe("resolveGinaTableView", () => {
  beforeEach(() => {
    resetGinaPrefs();
  });

  it("default Doc + Category, dept rail", () => {
    const v = resolveGinaTableView({});
    expect(v.columns[0]).toBe("document");
    expect(v.columns[1]).toBe("category");
    expect(v.columns.length).toBeLessThanOrEqual(GINA_TABLE_MAX_COLUMNS);
    expect(v.railMode).toBe("department");
    expect(GINA_TABLE_MAX_PREDICATES).toBe(3);
  });

  it("pref secondaryColumn folder swaps category", () => {
    setGinaPrefs({ secondaryColumn: "folder" });
    const v = resolveGinaTableView({});
    expect(v.columns).toContain("folder");
    expect(v.columns).not.toContain("category");
  });

  it("category folders view: Doc+Folder, category rail", () => {
    const v = resolveGinaTableView({
      secondaryColumn: "folder",
      railPrefer: "category",
      columns: ["document", "folder"],
    });
    expect(v.columns).toEqual(["document", "folder"]);
    expect(v.railMode).toBe("category");
  });

  it("all_docs layout: Doc|Cat|Status|Time + dept rail", () => {
    const v = resolveGinaTableView({ layout: "all_docs" });
    expect(v.columns).toEqual(["document", "category", "status", "time"]);
    expect(v.railMode).toBe("department");
    expect(v.timedOnly).toBe(false);
  });

  it("schedules_all: Doc|Cat|Time|Status timed only + dept rail", () => {
    const v = resolveGinaTableView({ layout: "schedules_all" });
    expect(v.columns).toEqual(["document", "category", "time", "status"]);
    expect(v.timedOnly).toBe(true);
    expect(v.showStatus).toBe(true);
    expect(v.railMode).toBe("department");
  });

  it("week layout: Doc|Folder|Time|Status + weekday rail (no weekday column)", () => {
    const v = resolveGinaTableView({
      layout: "schedules_week",
      scheduleScope: "week",
    });
    expect(v.columns).toEqual(["document", "folder", "time", "status"]);
    expect(v.columns).not.toContain("weekday");
    expect(v.columns.length).toBeLessThanOrEqual(4);
    expect(v.railMode).toBe("weekday");
    expect(v.timedOnly).toBe(true);
  });
});

describe("weekday letter", () => {
  it("ES letters L M X…", () => {
    expect(formatGinaWeekdayLetter(NOW, "es")).toBe("X"); // Wednesday
  });
});

describe("folder / category table shapes", () => {
  it("detects folders de la categoría blogs", () => {
    expect(wantsNamedCategoryListFolders(
      "gina cual es el nombre de los folders de la categoria blogs",
    )).toBe(true);
  });

  it("detects del folder X documentos", () => {
    expect(wantsFolderDocsList(
      "gina del folder plan de negocio entregame todos los documentos",
    )).toBe(true);
  });

  it("folder_summary listAll titles with folder name + Doc columns", () => {
    const viz = buildGinaVisualization("folder_summary", {
      listAll: true,
      folderName: "Plan de Negocio",
      departmentName: "Estrategias",
      category: "plan de negocio",
      documents: [
        {
          id: "d1",
          title: "Canvas",
          status: "flexible",
          category: "plan de negocio",
          folder: "Plan de Negocio",
        },
      ],
      aggregated: { total: 1, completed: 0, inProgress: 0, notStarted: 0, pastDue: 0 },
    }, { locale: "es", now: NOW });
    expect(viz.type).toBe("table");
    expect(viz.data.title).toBe("Plan de Negocio");
    expect(viz.data.columns).toContain("document");
    expect(viz.data.railMode).toBe("none");
  });
});
