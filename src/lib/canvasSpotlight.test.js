import { describe, expect, it } from "vitest";
import { computeFocusView, computeSpotlightView } from "./canvasSpotlight.js";

const stageRect = { width: 800, height: 600 };

describe("computeFocusView", () => {
  it("frames a single unwired node so Focus works after insert", () => {
    const nodes = [{ id: "a", x: 40, y: 40, _w: 180, _h: 72 }];
    const wired = computeSpotlightView({
      nodes,
      connections: [],
      stageRect,
    });
    expect(wired).toBeNull();

    const focus = computeFocusView({
      nodes,
      connections: [],
      stageRect,
      minScale: 0.35,
      maxScale: 2.5,
    });
    expect(focus).toBeTruthy();
    expect(focus.scale).toBeGreaterThan(0);
    const screenX = focus.panX + 40 * focus.scale;
    const screenY = focus.panY + 40 * focus.scale;
    expect(screenX).toBeGreaterThan(-20);
    expect(screenX).toBeLessThan(stageRect.width);
    expect(screenY).toBeGreaterThan(-20);
    expect(screenY).toBeLessThan(stageRect.height);
  });

  it("still prefers the wired cluster when connections exist", () => {
    const nodes = [
      { id: "a", x: 0, y: 0, _w: 180, _h: 72 },
      { id: "b", x: 200, y: 0, _w: 180, _h: 72 },
      { id: "lonely", x: 4000, y: 0, _w: 180, _h: 72 },
    ];
    const connections = [{ id: "c1", from: "a", to: "b" }];
    const focus = computeFocusView({
      nodes,
      connections,
      stageRect,
      minScale: 0.35,
      maxScale: 2.5,
    });
    const lonelyScreen = focus.panX + 4000 * focus.scale;
    expect(lonelyScreen).toBeGreaterThan(stageRect.width);
  });
});
