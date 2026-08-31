import { describe, expect, it } from "vitest";
import {
  getSpecsCardPanelTheme,
  resolveSpecsCardActiveLinkColorId,
  resolveSpecsCardPanelLinkColorId,
} from "./specsCardPanelThemes.js";

describe("specsCardPanelThemes", () => {
  it("maps node link colors to panel themes", () => {
    expect(getSpecsCardPanelTheme("rose").surface).toBe("#EACDCC");
    expect(getSpecsCardPanelTheme("sky").text).toBe("#000000");
    expect(getSpecsCardPanelTheme("mint").text).toBe("#024A06");
    expect(getSpecsCardPanelTheme("white").surface).toBe("#505152");
  });

  it("uses doc fallback while editing", () => {
    expect(resolveSpecsCardActiveLinkColorId({}, "mint")).toBe("mint");
    expect(resolveSpecsCardActiveLinkColorId({ nodeLinkColor: "rose" }, "mint")).toBe("rose");
  });

  it("freezes saved cards to panelLinkColor", () => {
    const saved = {
      specsSaved: true,
      panelLinkColor: "sky",
      nodeLinkColor: "rose",
    };
    expect(resolveSpecsCardPanelLinkColorId(saved, "mint")).toBe("sky");
  });

  it("does not use doc fallback when saved without frozen color", () => {
    const saved = { specsSaved: true, nodeLinkColor: "rose" };
    expect(resolveSpecsCardPanelLinkColorId(saved, "mint")).toBe("rose");
  });
});
