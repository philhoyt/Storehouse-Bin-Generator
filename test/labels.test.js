import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLabel, gridShape, cellToLocal, trayNames, labelFace, cleanLabelMap, spreadLabel, labelUnits } from "../src/bins.js";
import { fresh } from "./helpers.js";

test("labels are cleaned to the stroke font's alphabet", () => {
  assert.equal(cleanLabel("  m3  nuts!! "), "M3 NUTS");
  assert.equal(cleanLabel("1/4-20 + 3/8\" bolts"), "1/4-20 + 3/8 BOLTS");
  assert.equal(cleanLabel("x".repeat(40)).length, 24);
  assert.equal(labelUnits("AB"), 1.7);
});

test("the grid is seen from the front: W rows in the main block, N rows in the handle pockets", () => {
  const main = { zone: "main" }, pocket = { zone: "left" };
  assert.deepEqual(gridShape(main, 2, 3), { rows: 2, cols: 3 });
  assert.deepEqual(gridShape(pocket, 2, 3), { rows: 3, cols: 2 });
  assert.deepEqual(cellToLocal(main, 2, 3, 1, 0), { ix: 1, iy: 2 }); // far row, left column: +x, +y
  assert.deepEqual(cellToLocal(pocket, 2, 3, 2, 0), { ix: 0, iy: 2 }); // far row, left column: -x, +y
  assert.deepEqual(labelFace(main), { p: 0, sign: 1 });
  assert.deepEqual(labelFace(pocket), { p: 1, sign: 1 });
  assert.deepEqual(labelFace({ zone: "main", labelSide: "left" }), { p: 1, sign: 1 });
});

test("tray names follow the split and the viewer", () => {
  assert.deepEqual(trayNames({ zone: "main", split: "4" }), ["Near right tray", "Near left tray", "Far right tray", "Far left tray"]);
  assert.deepEqual(trayNames({ zone: "main", split: "w" }), ["Near tray", "Far tray"]);
  assert.deepEqual(trayNames({ zone: "left", split: "w" }), ["Left tray", "Right tray"]);
  assert.deepEqual(trayNames({ zone: "left", split: "1" }), ["Tray"]);
});

test("saved label maps keep only cells inside the grid; old single labels spread along the far row", () => {
  assert.deepEqual(cleanLabelMap({ "0,0": "A", "5,5": "B", bad: "C", "0,1": 7 }, { rows: 2, cols: 2 }), { "0,0": "A" });
  assert.equal(cleanLabelMap("A", { rows: 1, cols: 1 }), null);
  assert.deepEqual(spreadLabel({ zone: "main" }, 2, 3, "OLD"), { "1,0": "OLD", "1,1": "OLD", "1,2": "OLD" });
  assert.deepEqual(spreadLabel({ zone: "main" }, 2, 3, ""), {});
});

test("shelves go on the wall for the far row and on the divider for nearer rows", () => {
  const { S, geo, newBin } = fresh("M");
  const b = newBin("main", 0, 0, 2, 2, { divW: 2, divN: 2 }), D = geo.dims(b);
  b.labels = { "1,0": "M4", "0,0": "NUTS" };
  const segs = geo.shelfSegments(b, { nW: 2, nN: 2, labels: b.labels, inner: z => geo.innerAt(D, z), zTop: D.zt, zDivTop: geo.dividerTop(b, D), zFloor: D.zf });
  const far = segs.find(s => s.key === "1,0"), near = segs.find(s => s.key === "0,0");
  assert.equal(far.atWall, true); assert.equal(near.atWall, false);
  assert.ok(far.uFace(D.zt) > 50, "far shelf meets the far wall"); // inner half width of a 2x2 bin is about 52
  assert.ok(Math.abs(near.uFace(D.zt)) < 1, "near shelf hangs on the middle divider");
  const F = geo.labelFitSeg(far, D.zf);
  assert.equal(F.noRoom, undefined); assert.equal(F.cap, 6); assert.equal(F.shown, "M4");
});

test("long text shrinks then truncates; tiny compartments get no shelf", () => {
  const { S, geo, newBin } = fresh("M");
  const b = newBin("left", 0, 0, 1, 1), D = geo.dims(b);
  b.labels = { "0,0": "ABCDEFGHIJKLMNOPQRSTUVWX" };
  const seg = geo.shelfSegments(b, { nW: 1, nN: 1, labels: b.labels, inner: z => geo.innerAt(D, z), zTop: D.zt, zDivTop: D.zt, zFloor: D.zf })[0];
  const F = geo.labelFitSeg(seg, D.zf);
  assert.ok(F.cap >= 3.5 && F.cap < 4); assert.ok(F.dropped > 0); assert.equal(F.shown.length + F.dropped, 24);
  const c = newBin("main", 0, 0, 1, 1, { divN: 8 }), Dc = geo.dims(c); c.labels = { "0,0": "AB" };
  const segc = geo.shelfSegments(c, { nW: 1, nN: 8, labels: c.labels, inner: z => geo.innerAt(Dc, z), zTop: Dc.zt, zDivTop: Dc.zt, zFloor: Dc.zf })[0];
  assert.equal(geo.labelFitSeg(segc, Dc.zf).noRoom, true);
});

test("a label adds the shelf prism and letter boxes to the mesh", () => {
  const { geo, newBin } = fresh("M");
  const plain = newBin("main", 0, 0, 2, 2), labeled = newBin("main", 0, 0, 2, 2); labeled.labels = { "0,0": "M3" };
  const n0 = geo.buildBin(plain).length, n1 = geo.buildBin(labeled).length;
  assert.equal(n0, 288);
  assert.ok(n1 > n0 + 8, "prism plus letters");
  const plate = newBin("main", 0, 0, 2, 2, { labelPlate: true });
  assert.equal(geo.buildBin(plate).length, n0 + 8);
});
