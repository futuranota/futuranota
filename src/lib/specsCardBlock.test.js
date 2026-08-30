import { describe, expect, it } from "vitest";
import {
  createDocBlock,
  docBlocksFromBody,
  docBlocksToBody,
  DOC_BLOCK_TYPES,
  docBlockHasContent,
  formatSpecsCardDimensions,
  formatSpecsCardWeight,
  normalizeSpecsCard,
} from "./docBlocks.js";
import { DIMENSION_UNIT_OPTIONS } from "./metricUnits.js";

describe("normalizeSpecsCard", () => {
  it("normalizes media and specs fields", () => {
    const normalized = normalizeSpecsCard({
      src: "/img.webp",
      imageSaved: true,
      specs: {
        partNumber: "PN-42",
        dimensions: { x: "10", y: "20", z: "5", unit: "mm" },
        material: "Steel",
        weight: { value: "2.5", unit: "kg" },
      },
      specsSaved: true,
    });

    expect(normalized.imageSaved).toBe(true);
    expect(normalized.specsSaved).toBe(true);
    expect(normalized.specs.partNumber).toBe("PN-42");
    expect(normalized.specs.name).toBe("");
    expect(normalized.specs.dimensions.unit).toBe("mm");
    expect(normalized.specs.weight.unit).toBe("kg");
  });

  it("preserves name whitespace while editing", () => {
    const normalized = normalizeSpecsCard({
      specs: { name: "  Widget Pro  " },
    });
    expect(normalized.specs.name).toBe("  Widget Pro  ");
  });

  it("trims name when saved", () => {
    const normalized = normalizeSpecsCard({
      imageSaved: true,
      src: "/img.webp",
      specsSaved: true,
      specs: { name: "  Widget Pro  " },
    });
    expect(normalized.specs.name).toBe("Widget Pro");
  });

  it("clears specsSaved when image is missing", () => {
    const normalized = normalizeSpecsCard({ specsSaved: true, imageSaved: false });
    expect(normalized.specsSaved).toBe(false);
  });
});

describe("formatSpecsCardDimensions", () => {
  it("formats L x W x H with unit", () => {
    expect(formatSpecsCardDimensions({
      dimensions: { x: "120", y: "80", z: "45", unit: "mm" },
    })).toBe("120 × 80 × 45 mm");
  });

  it("formats L x W x H with px unit", () => {
    expect(formatSpecsCardDimensions({
      dimensions: { x: "10", y: "20", z: "15", unit: "px" },
    })).toBe("10 × 20 × 15 px");
  });

  it("returns empty string when empty", () => {
    expect(formatSpecsCardDimensions({ dimensions: {} })).toBe("");
  });
});

describe("formatSpecsCardWeight", () => {
  it("formats value with unit", () => {
    expect(formatSpecsCardWeight({ value: "12", unit: "lb" })).toBe("12 lb");
  });
});

describe("specs card serialize/parse", () => {
  it("round-trips through body markers", () => {
    const block = createDocBlock(DOC_BLOCK_TYPES.SPECS_CARD, {
      src: "/spec.webp",
      imageSaved: true,
      specsSaved: true,
      specs: {
        name: "Widget Pro",
        partNumber: "ABC-1",
        dimensions: { x: "1", y: "2", z: "3", unit: "cm" },
        material: "Aluminum",
        weight: { value: "4", unit: "kg" },
      },
    });

    const body = docBlocksToBody([block]);
    expect(body.startsWith("::specscard\n")).toBe(true);

    const parsed = docBlocksFromBody(body);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe(DOC_BLOCK_TYPES.SPECS_CARD);
    expect(normalizeSpecsCard(parsed[0]).specs.name).toBe("Widget Pro");
    expect(normalizeSpecsCard(parsed[0]).specs.partNumber).toBe("ABC-1");
  });
});

describe("DIMENSION_UNIT_OPTIONS", () => {
  it("includes px after mm", () => {
    const ids = DIMENSION_UNIT_OPTIONS.map((opt) => opt.id);
    expect(ids).toContain("px");
    expect(ids.indexOf("px")).toBe(ids.indexOf("mm") + 1);
  });
});

describe("docBlockHasContent specs_card", () => {
  it("detects name without image", () => {
    expect(docBlockHasContent(createDocBlock(DOC_BLOCK_TYPES.SPECS_CARD, {
      specs: { name: "Widget" },
    }))).toBe(true);
  });

  it("detects part number without image", () => {
    expect(docBlockHasContent(createDocBlock(DOC_BLOCK_TYPES.SPECS_CARD, {
      specs: { partNumber: "X1" },
    }))).toBe(true);
  });
});
