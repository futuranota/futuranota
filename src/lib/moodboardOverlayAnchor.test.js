import { describe, expect, it } from "vitest";
import {
  contentRectToBoardPct,
  mergeSlotAnchorRects,
  parseObjectPosition,
  projectBoardPctToImagePct,
  projectImagePctToBoardPct,
  resolveOverlayBoardPosition,
} from "./moodboardOverlayAnchor.js";

describe("parseObjectPosition", () => {
  it("defaults to center", () => {
    expect(parseObjectPosition("")).toEqual({ x: 0.5, y: 0.5 });
    expect(parseObjectPosition("center")).toEqual({ x: 0.5, y: 0.5 });
  });

  it("reads percent pairs", () => {
    expect(parseObjectPosition("0% 100%")).toEqual({ x: 0, y: 1 });
  });
});

describe("image ↔ board projection", () => {
  const imageRect = {
    leftPct: 10,
    topPct: 20,
    widthPct: 40,
    heightPct: 50,
  };

  it("maps image center to board mid of the photo", () => {
    expect(projectImagePctToBoardPct(imageRect, 50, 50)).toEqual({
      xPct: 30,
      yPct: 45,
    });
  });

  it("round-trips board → image → board", () => {
    const board = { xPct: 30, yPct: 45 };
    const image = projectBoardPctToImagePct(imageRect, board.xPct, board.yPct);
    expect(image.xPct).toBeCloseTo(50);
    expect(image.yPct).toBeCloseTo(50);
    const back = projectImagePctToBoardPct(imageRect, image.xPct, image.yPct);
    expect(back.xPct).toBeCloseTo(30);
    expect(back.yPct).toBeCloseTo(45);
  });

  it("contentRectToBoardPct normalizes viewport boxes", () => {
    const board = { left: 100, top: 200, width: 400, height: 200 };
    const content = { left: 140, top: 220, width: 80, height: 100 };
    expect(contentRectToBoardPct(board, content)).toEqual({
      leftPct: 10,
      topPct: 10,
      widthPct: 20,
      heightPct: 50,
    });
  });

  it("resolveOverlayBoardPosition uses anchor when rect exists", () => {
    const pos = resolveOverlayBoardPosition(
      { xPct: 25, yPct: 50, endXPct: 75, endYPct: 50, anchorSlotId: "MBS1" },
      { MBS1: imageRect },
    );
    expect(pos.anchored).toBe(true);
    expect(pos.pending).toBe(false);
    expect(pos.xPct).toBeCloseTo(20);
    expect(pos.yPct).toBeCloseTo(45);
    expect(pos.endXPct).toBeCloseTo(40);
    expect(pos.endYPct).toBeCloseTo(45);
  });

  it("resolveOverlayBoardPosition marks pending when anchored without rect", () => {
    const pos = resolveOverlayBoardPosition(
      { xPct: 12, yPct: 34, anchorSlotId: "missing" },
      {},
    );
    expect(pos.pending).toBe(true);
    expect(pos.anchored).toBe(false);
  });

  it("resolveOverlayBoardPosition stays board-local without anchor", () => {
    const pos = resolveOverlayBoardPosition(
      { xPct: 12, yPct: 34 },
      {},
    );
    expect(pos.pending).toBe(false);
    expect(pos.anchored).toBe(false);
    expect(pos.xPct).toBe(12);
    expect(pos.yPct).toBe(34);
  });
});

describe("mergeSlotAnchorRects", () => {
  const a = { leftPct: 1, topPct: 2, widthPct: 3, heightPct: 4 };

  it("keeps previous when next is empty", () => {
    expect(mergeSlotAnchorRects({ S1: a }, {})).toEqual({ S1: a });
  });

  it("upserts without dropping sibling keys on partial next", () => {
    const b = { leftPct: 10, topPct: 20, widthPct: 30, heightPct: 40 };
    expect(mergeSlotAnchorRects({ S1: a, S2: a }, { S1: b })).toEqual({
      S1: b,
      S2: a,
    });
  });
});
