import { describe, expect, it, beforeEach } from "vitest";
import {
  addLocalGinaKnowledge,
  buildGinaKnowledgePromptBlock,
  inferGinaKnowledgeSource,
  installGinaKnowledgeFromBrief,
  isGinaLearnSaveConfirm,
  parseGinaLearnReply,
  readLocalGinaKnowledge,
  writeLocalGinaKnowledge,
} from "./ginaKnowledgeStore.js";
import {
  resolveGinaLearnBrief,
  resolveGinaLearnBriefByTitle,
} from "./resolveGinaLearnBrief.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaKnowledgeStore learn protocol", () => {
  beforeEach(() => {
    memory.clear();
    writeLocalGinaKnowledge([]);
  });

  it("parses LEARN block and strips it from display", () => {
    const reply = [
      "Entendí que datos cualitativos son insights narrativos.",
      "<<<GINA_LEARN",
      "title: Datos cualitativos",
      "body: Insights narrativos del usuario; no métricas numéricas.",
      ">>>",
      "¿Lo guardo?",
    ].join("\n");
    const parsed = parseGinaLearnReply(reply);
    expect(parsed.displayText).toContain("Entendí");
    expect(parsed.displayText).toContain("¿Lo guardo?");
    expect(parsed.displayText).not.toContain("<<<GINA_LEARN");
    expect(parsed.learnProposal).toEqual({
      title: "Datos cualitativos",
      body: "Insights narrativos del usuario; no métricas numéricas.",
      source: "taught",
    });
  });

  it("detects save confirmations", () => {
    expect(isGinaLearnSaveConfirm("sí")).toBe(true);
    expect(isGinaLearnSaveConfirm("guarda")).toBe(true);
    expect(isGinaLearnSaveConfirm("save it")).toBe(true);
    expect(isGinaLearnSaveConfirm("qué significa X")).toBe(false);
  });

  it("infers source tags for voice, tasks, skill", () => {
    expect(inferGinaKnowledgeSource({ title: "Voice", body: "tono y expresiones" })).toBe("voice");
    expect(inferGinaKnowledgeSource({ title: "Daily loop", body: "tasks del día a día" })).toBe("tasks");
    expect(inferGinaKnowledgeSource({ title: "Product skill", body: "habilidad canónica" })).toBe("skill");
    expect(inferGinaKnowledgeSource({ title: "X", body: "y", source: "taught" })).toBe("taught");
  });

  it("installs from brief as skill", () => {
    installGinaKnowledgeFromBrief({
      title: "Skill Futura",
      body: "Sección A significa dashboard.",
    });
    const rows = readLocalGinaKnowledge();
    expect(rows[0].source).toBe("skill");
    expect(buildGinaKnowledgePromptBlock()).toContain("[skill]");
  });

  it("builds prompt from folder knowledge docs", () => {
    const block = buildGinaKnowledgePromptBlock({
      k1: {
        id: "k1",
        docKind: "knowledge",
        title: "Skill voz",
        body: "Gina habla breve y clara.",
        knowledgeImport: { fileName: "voice.md", mimeType: "text/markdown", extension: ".md", importedAt: "", sizeBytes: 10 },
      },
    });
    expect(block).toContain("Skill voz");
    expect(block).toContain("voice.md");
    expect(block).toContain("[folder]");
  });

  it("persists taught memory and builds prompt block", () => {
    addLocalGinaKnowledge({
      title: "Datos cuantitativos",
      body: "Números y métricas medibles.",
      source: "taught",
    });
    const rows = readLocalGinaKnowledge();
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("taught");
    const block = buildGinaKnowledgePromptBlock();
    expect(block).toContain("Datos cuantitativos");
    expect(block).toContain("[taught]");
  });

  it("updates same title instead of duplicating", () => {
    addLocalGinaKnowledge({ title: "Voz", body: "v1" });
    addLocalGinaKnowledge({ title: "Voz", body: "v2 corregida" });
    expect(readLocalGinaKnowledge()).toHaveLength(1);
    expect(readLocalGinaKnowledge()[0].body).toBe("v2 corregida");
  });
});

describe("resolveGinaLearnBrief", () => {
  it("reads selected canvas doc as skill brief", () => {
    const brief = resolveGinaLearnBrief({
      selectedCanvasNodeIds: ["cn1"],
      canvasNodes: { cn1: { id: "cn1", docId: "d1" } },
      docs: {
        d1: {
          id: "d1",
          title: "Skill producto",
          body: "Sección A = dashboard de la compañía.",
        },
      },
      nodes: {},
    });
    expect(brief?.title).toBe("Skill producto");
    expect(brief?.body).toContain("Sección A");
  });

  it("matches aprende by document title", () => {
    const brief = resolveGinaLearnBriefByTitle("aprende Skill producto", {
      d1: {
        id: "d1",
        title: "Skill producto",
        body: "Definición canónica.",
      },
    });
    expect(brief?.documentId).toBe("d1");
    expect(brief?.body).toContain("Definición");
  });

  it("returns null for bare aprende esto without title", () => {
    expect(resolveGinaLearnBriefByTitle("aprende esto", {
      d1: { id: "d1", title: "X", body: "y" },
    })).toBeNull();
  });
});
