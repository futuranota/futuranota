import { describe, expect, it } from "vitest";
import {
  buildScriptCatalogMap,
  buildScriptSegments,
  compileAssetScript,
  detectManualSpeakSegments,
  segmentsToKlingText,
} from "./compileAssetScript.js";

const ginaItem = {
  id: "img-gina",
  tag: "Gina",
  description: "assistant character",
  category: "image",
  mediaUrl: "https://cdn.example/gina.webp",
  wallColor: "#151515",
};

const tasaItem = {
  id: "img-tasa",
  tag: "tasa_de_tea",
  description: "tea cup on table",
  category: "image",
  mediaUrl: "https://cdn.example/tasa.webp",
};

const catalogs = [
  { ownerKind: "folder", ownerId: "folder1", items: [ginaItem, tasaItem] },
  { ownerKind: "document", ownerId: "doc1", items: [] },
];

describe("compileAssetScript", () => {
  it("builds catalog with document overriding folder", () => {
    const map = buildScriptCatalogMap([
      { ownerKind: "folder", items: [{ ...ginaItem, description: "folder" }] },
      { ownerKind: "document", items: [{ ...ginaItem, description: "doc" }] },
    ]);
    expect(map.get("gina")?.description).toBe("doc");
  });

  it("prefixes resolved refs with @ in kling text", () => {
    const script = "Gina se levanta";
    const { klingText } = compileAssetScript({
      asset: { tag: "scene01" },
      description: script,
      libraryNameRefs: [{
        id: "LNR1",
        itemId: "img-gina",
        tag: "Gina",
        setId: null,
        start: 0,
        end: 4,
        insertedAt: "2026-01-01T00:00:00.000Z",
      }],
      catalogs,
    });
    expect(klingText).toBe("@Gina se levanta");
  });

  it("detects manual quoted dialogue", () => {
    const script = 'Gina dijo "No me hables" y sigue';
    const map = buildScriptCatalogMap(catalogs);
    const segments = buildScriptSegments(script, [], [], map);
    const speak = segments.find((seg) => seg.type === "speak");
    expect(speak?.dialogue).toBe("No me hables");
    expect(segmentsToKlingText(segments)).toContain('@Gina "No me hables"');
  });

  it("detects screenplay colon dialogue", () => {
    const script = "Gina: Oye escuchame\ncontinua";
    const map = buildScriptCatalogMap(catalogs);
    const manual = detectManualSpeakSegments(script, [], map);
    expect(manual[0]?.dialogue).toBe("Oye escuchame");
    expect(segmentsToKlingText(buildScriptSegments(script, [], manual, map))).toContain(
      '@Gina "Oye escuchame"',
    );
  });

  it("includes constants in manifest", () => {
    const { manifest } = compileAssetScript({
      asset: { tag: "scene01", id: "SET1" },
      description: "Gina camina",
      libraryNameRefs: [{
        id: "LNR1",
        itemId: "img-gina",
        tag: "Gina",
        setId: null,
        start: 0,
        end: 4,
        insertedAt: "2026-01-01T00:00:00.000Z",
      }],
      catalogs,
    });
    expect(manifest.format).toBe("futura-nota-script-v1");
    expect(manifest.constants.gina.prompt).toBe("assistant character");
    expect(manifest.constants.gina.image).toBe("Gina.webp");
  });

  it("leaves unknown names as plain text", () => {
    const { klingText } = compileAssetScript({
      description: "Unknown camina",
      catalogs,
    });
    expect(klingText).toBe("Unknown camina");
  });

  it("uses structured speak refs", () => {
    const script = 'Gina ""hola amiga""';
    const { klingText, manifest } = compileAssetScript({
      description: script,
      librarySpeakRefs: [{
        id: "LSR1",
        itemId: "img-gina",
        tag: "Gina",
        start: 0,
        end: 17,
        dialogueStart: 7,
        dialogueEnd: 15,
        dialogue: "hola amiga",
        insertedAt: "2026-01-01T00:00:00.000Z",
      }],
      catalogs,
    });
    expect(klingText).toContain('@Gina "hola amiga"');
    expect(manifest.segments.some((seg) => seg.type === "speak")).toBe(true);
  });
});
