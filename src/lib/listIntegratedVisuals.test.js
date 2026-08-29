import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import { createLibraryItem } from "./folderLibrary.js";
import { createEmptyTextBlock } from "./nodeInlineContent.js";
import {
  filterIntegratedVisuals,
  listIntegratedVisualsFromBlocks,
} from "./listIntegratedVisuals.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";

function textBlock(text, refs) {
  return {
    ...createEmptyTextBlock(text),
    ...(refs?.length ? { libraryNameRefs: refs } : {}),
  };
}

describe("listIntegratedVisualsFromBlocks", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Folder",
          nodeIds: ["node1"],
          libraryItems: [],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          dataType: "text",
          parentDocId: "folder1",
          libraryItems: [],
        },
      },
    });
  });

  it("returns only referenced fichas that have media", () => {
    const withPhoto = createLibraryItem("document", "node1", {
      tag: "Gina",
      category: "image",
      mediaUrl: "https://example.com/gina.webp",
      loop: true,
      aliases: ["mi hermana"],
    });
    createLibraryItem("document", "node1", {
      tag: "solo_texto",
      category: "image",
      description: "no photo",
      loop: true,
    });
    const blocks = [
      textBlock("Gina y mi hermana", [
        {
          id: "r1",
          itemId: withPhoto.id,
          tag: "Gina",
          setId: null,
          start: 0,
          end: 4,
          insertedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "r2",
          itemId: withPhoto.id,
          tag: "mi hermana",
          setId: null,
          start: 7,
          end: 17,
          insertedAt: "2020-01-01T00:00:00.000Z",
        },
      ]),
    ];

    const rows = listIntegratedVisualsFromBlocks(blocks, "node1", "folder1");
    expect(rows).toHaveLength(1);
    expect(rows[0].tag).toBe("Gina");
    expect(rows[0].mentionCount).toBe(2);
    expect(rows[0].mediaUrl).toContain("gina.webp");
  });

  it("filters by name or alias", () => {
    const rows = [
      {
        itemId: "1",
        tag: "Gina",
        mediaUrl: "x",
        ownerKind: "document",
        ownerId: "n1",
        aliases: ["mi hermana"],
        mentionCount: 1,
      },
      {
        itemId: "2",
        tag: "polvo",
        mediaUrl: "y",
        ownerKind: "document",
        ownerId: "n1",
        aliases: [],
        mentionCount: 1,
      },
    ];
    expect(filterIntegratedVisuals(rows, "her").map((r) => r.tag)).toEqual(["Gina"]);
    expect(filterIntegratedVisuals(rows, "pol").map((r) => r.tag)).toEqual(["polvo"]);
  });
});
