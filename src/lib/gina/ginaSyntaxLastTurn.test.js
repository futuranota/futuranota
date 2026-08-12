/**
 * Tests: lastTurn store + follow-up syntax (“modificar este calendario”).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  clearGinaLastTurn,
  getGinaLastTurn,
  setGinaLastTurn,
  stampGinaLastTurnFromRouted,
  isGinaLastTurnScheduleLike,
} from "./ginaLastTurn.js";
import {
  parseLastTurnIntent,
  wantsGinaLastTurnFollowUp,
  buildLastTurnModifyMessage,
  buildLastTurnModifyChips,
} from "./ginaSyntaxLastTurn.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

describe("ginaSyntaxLastTurn", () => {
  beforeEach(() => {
    clearGinaLastTurn();
  });

  it("matches modify / open follow-ups", () => {
    expect(parseLastTurnIntent("Quiero modificar este calendario")).toBe("modify_ref");
    expect(parseLastTurnIntent("modificar este horario")).toBe("modify_ref");
    expect(parseLastTurnIntent("I want to change this schedule")).toBe("modify_ref");
    expect(parseLastTurnIntent("no, quiero que me modiques este calendario")).toBe("modify_ref");
    expect(parseLastTurnIntent("quiero que me modifiques este calendario")).toBe("modify_ref");
    expect(parseLastTurnIntent("ábrelo")).toBe("open_ref");
    expect(parseLastTurnIntent("open it")).toBe("open_ref");
    expect(parseLastTurnIntent("abreme el documento")).toBe("open_ref");
    expect(parseLastTurnIntent("ábreme el documento")).toBe("open_ref");
    expect(parseLastTurnIntent("abre el primero")).toBe("open_first");
  });

  it("does not steal classic horarios de hoy", () => {
    expect(wantsGinaLastTurnFollowUp("Muéstrame los horarios de hoy")).toBe(false);
    expect(wantsGinaLastTurnFollowUp("Abrir Blog Post Trends")).toBe(false);
  });

  it("stamps schedule turn and answers modify with chips", () => {
    stampGinaLastTurnFromRouted({
      family: "today",
      toolContext: {
        documents: [
          { id: "n1", title: "Pitch A" },
          { id: "n2", title: "Pitch B" },
        ],
      },
    }, { objectId: "co1", userText: "Muéstrame los horarios de hoy" });

    const turn = getGinaLastTurn();
    expect(turn?.refKind).toBe("schedule");
    expect(isGinaLastTurnScheduleLike(turn)).toBe(true);
    expect(turn?.documents?.map((d) => d.id)).toEqual(["n1", "n2"]);

    const routed = runGinaQueryFamily("Quiero modificar este calendario", {
      docs: {},
      nodes: {},
      departments: [],
      lastTurn: turn,
    });
    expect(routed.family).toBe("last_turn_modify");
    expect(routed.toolContext?.documents?.length).toBe(2);

    const msg = buildLastTurnModifyMessage({
      locale: "es",
      hasLastTurn: true,
      refKind: "schedule",
      documents: routed.toolContext.documents,
    });
    expect(msg).toMatch(/aún no muevo schedules/i);

    const chips = buildLastTurnModifyChips({
      locale: "es",
      documents: routed.toolContext.documents,
    });
    expect(chips.some((c) => c.text === "GinaOpenDocument:n1")).toBe(true);
    expect(chips.some((c) => /horarios de hoy/i.test(c.text))).toBe(true);
  });

  it("honest reply when modify without lastTurn", () => {
    const routed = runGinaQueryFamily("Quiero modificar este calendario", {
      docs: {},
      nodes: {},
      departments: [],
    });
    expect(routed.family).toBe("last_turn_missing");
    const msg = buildLastTurnModifyMessage({ locale: "es", hasLastTurn: false });
    expect(msg).toMatch(/horarios de hoy/i);
  });

  it("routes live wording from chat: modiques + ábreme el documento", () => {
    stampGinaLastTurnFromRouted({
      family: "today",
      toolContext: {
        documents: [{ id: "pdn1", title: "PDN" }],
      },
    }, { userText: "gina hola, me puedes dar los horarios de hoy" });

    const modify = runGinaQueryFamily(
      "no, quiero que me modiques este calendario",
      { docs: {}, nodes: {}, departments: [] },
    );
    expect(modify.family).toBe("last_turn_modify");
    expect(modify.toolContext?.documents?.[0]?.id).toBe("pdn1");

    const open = runGinaQueryFamily("abreme el documento", {
      docs: {},
      nodes: { pdn1: { id: "pdn1", title: "PDN" } },
      departments: [],
    });
    expect(open.family).toBe("focus_open");
    expect(open.openDocumentId).toBe("pdn1");
  });
});
