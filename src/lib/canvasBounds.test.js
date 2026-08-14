import { describe, expect, it } from "vitest";
import {
  MIN_BOARD_HEIGHT,
  MIN_BOARD_WIDTH,
  clampGroupDelta,
  clampNodePosition,
  clampViewToBoard,
  getCanvasBoardBounds,
  isNodeVisibleInView,
} from "./canvasBounds.js";

describe("getCanvasBoardBounds", () => {
  it("uses a home board at least as big as the stage", () => {
    const board = getCanvasBoardBounds([], { width: 1200, height: 800 });
    expect(board.minX).toBe(0);
    expect(board.minY).toBe(0);
    expect(board.width).toBe(1200);
    expect(board.height).toBe(800);
  });

  it("never shrinks below the readable minimum", () => {
    const board = getCanvasBoardBounds([], { width: 200, height: 100 });
    expect(board.width).toBe(MIN_BOARD_WIDTH);
    expect(board.height).toBe(MIN_BOARD_HEIGHT);
  });

  it("expands to include nodes that already sit outside the home board", () => {
    const board = getCanvasBoardBounds(
      [{ id: "far", x: 2400, y: 40, _w: 180, _h: 72 }],
      { width: 960, height: 640 },
    );
    expect(board.maxX).toBeGreaterThan(2400);
    expect(board.minX).toBe(0);
  });
});

describe("clampNodePosition", () => {
  const board = { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 };

  it("keeps a node inside the board", () => {
    expect(clampNodePosition(-80, -20, { w: 180, h: 72 }, board)).toEqual({ x: 8, y: 8 });
    const far = clampNodePosition(900, 900, { w: 180, h: 72 }, board);
    expect(far.x).toBe(400 - 180 - 8);
    expect(far.y).toBe(300 - 72 - 8);
  });
});

describe("clampGroupDelta", () => {
  it("stops the whole group at the board edge", () => {
    const board = { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 };
    const nodes = [
      { id: "a", x: 10, y: 10, _w: 180, _h: 72 },
      { id: "b", x: 200, y: 10, _w: 180, _h: 72 },
    ];
    const { dx } = clampGroupDelta(nodes, -80, 0, board);
    expect(dx).toBeGreaterThan(-80);
    expect(nodes[0].x + dx).toBeGreaterThanOrEqual(0);
  });
});

describe("clampViewToBoard", () => {
  const board = { minX: 0, minY: 0, maxX: 960, maxY: 640, width: 960, height: 640 };
  const stage = { width: 960, height: 640 };

  it("locks pan at 100% when the board fills the stage", () => {
    const next = clampViewToBoard({ scale: 1, panX: -400, panY: 200 }, board, stage);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  it("centers a smaller board when zoomed out", () => {
    const next = clampViewToBoard({ scale: 0.5, panX: 0, panY: 0 }, board, stage);
    expect(next.panX).toBe((960 - 480) / 2);
    expect(next.panY).toBe((640 - 320) / 2);
  });
});

describe("isNodeVisibleInView", () => {
  const view = { scale: 1, panX: 0, panY: 0 };
  const stage = { width: 800, height: 600 };

  it("detects nodes in the default viewport", () => {
    expect(isNodeVisibleInView({ x: 40, y: 40, _w: 180, _h: 72 }, view, stage)).toBe(true);
  });

  it("detects nodes parked far off-screen", () => {
    expect(isNodeVisibleInView({ x: 4000, y: 40, _w: 180, _h: 72 }, view, stage)).toBe(false);
  });
});
