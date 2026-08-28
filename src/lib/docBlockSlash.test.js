import { describe, expect, it } from "vitest";
import {
  buildSlashMenuSections,
  DOC_SLASH_COMMANDS,
  DOCUMENT_SLASH_GHOST_HINTS,
  getDocumentSlashCommandsForUser,
  getDocumentSlashGhostHintsForUser,
  parseDocumentSlashQuery,
  parseSlashQuery,
} from "./docBlockSlash.js";

describe("getDocumentSlashCommandsForUser", () => {
  it("hides legacy menu items from the writing toolkit", () => {
    const labels = getDocumentSlashCommandsForUser(true).map((cmd) => cmd.label);
    expect(labels).not.toContain("ProductCard");
    expect(labels).not.toContain("Imagen");
    expect(labels).not.toContain("Password");
    expect(labels).not.toContain("URL");
  });

  it("shows Agent only for admin users", () => {
    const adminLabels = getDocumentSlashCommandsForUser(true).map((cmd) => cmd.label);
    const userLabels = getDocumentSlashCommandsForUser(false).map((cmd) => cmd.label);
    expect(adminLabels).toContain("Agent");
    expect(userLabels).not.toContain("Agent");
  });

  it("groups CARDS and EXTRA for admin picker menu", () => {
    const sections = buildSlashMenuSections(getDocumentSlashCommandsForUser(true));
    const groups = sections.filter((section) => section.kind === "group");
    expect(groups.map((group) => group.label)).toEqual(["CARDS", "EXTRA"]);
    expect(groups[0].commands.map((cmd) => cmd.menuLabel)).toEqual([
      "Image Card",
      "Banner Card",
      "Moodboard",
    ]);
    expect(groups[1].commands.map((cmd) => cmd.label)).toEqual(["Code", "Agent"]);
  });
});

describe("document slash ghost hints", () => {
  it("omits hidden commands from base document hints", () => {
    expect(DOCUMENT_SLASH_GHOST_HINTS).not.toContain("productcard");
    expect(DOCUMENT_SLASH_GHOST_HINTS).not.toContain("imagen");
    expect(DOCUMENT_SLASH_GHOST_HINTS).not.toContain("queue to table");
  });

  it("omits Agent from non-admin ghost hints", () => {
    expect(getDocumentSlashGhostHintsForUser(false)).not.toContain("agent");
    expect(getDocumentSlashGhostHintsForUser(true)).toContain("agent");
  });
});

describe("slash query parsing", () => {
  it("still resolves legacy commands in the global parser", () => {
    expect(parseSlashQuery("productcard")?.label).toBe("ProductCard");
  });

  it("does not insert hidden commands through document slash parsing", () => {
    expect(parseDocumentSlashQuery("productcard")).toBeNull();
    expect(parseDocumentSlashQuery("imagen")).toBeNull();
    expect(parseDocumentSlashQuery("password")).toBeNull();
    expect(parseDocumentSlashQuery("url")).toBeNull();
  });

  it("keeps active document commands available", () => {
    expect(parseDocumentSlashQuery("image card")?.label).toBe("Image card");
    expect(parseDocumentSlashQuery("banner")?.label).toBe("Banner");
    expect(parseDocumentSlashQuery("moodboard")?.label).toBe("Moodboard");
    expect(parseDocumentSlashQuery("code")?.label).toBe("Code");
    expect(parseDocumentSlashQuery("agent")?.label).toBe("Agent");
  });
});

describe("DOC_SLASH_COMMANDS metadata", () => {
  it("marks hidden legacy commands without removing them from the registry", () => {
    const hidden = DOC_SLASH_COMMANDS.filter((cmd) => cmd.menuHidden).map((cmd) => cmd.label);
    expect(hidden).toEqual(expect.arrayContaining(["ProductCard", "Imagen", "Password", "URL"]));
  });
});
