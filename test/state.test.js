import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, restoreState, makeBin, MEASURED } from "../src/state.js";
import { canPlace, findSpot, binAt, stockLayout, TOTAL_CELLS, usedCells } from "../src/layout.js";

test("restore drops bad bins and resets bad fields", () => {
  const S = createState();
  const next = restoreState(S, { caseType: "Z", view: "weird", wall: "abc", draft: 99, selId: 999, liftTrays: 1, bins: [
    { id: 1, zone: "main", c: 0, r: 0, w: 2, n: 2, split: "x", divW: "3", feet: "perimeter", stack: true },
    { id: 2, zone: "nowhere", c: 0, r: 0, w: 1, n: 1 },
    { id: 3, zone: "main", c: 1, r: 1, w: 1, n: 1 },
    { id: 4, zone: "main", c: 50, r: 0, w: 1, n: 1 },
    { id: 5, zone: "constructor", c: 0, r: 0, w: 1, n: 1 },
    null, "junk",
    { id: 6, zone: "left", c: 0, r: 0, w: 1, n: 1, ht: "half", divN: 40 }
  ] });
  assert.equal(S.caseType, "M"); assert.equal(S.view, "case"); assert.equal(S.wall, 1.6); assert.equal(S.draft, 4);
  assert.deepEqual(S.bins.map(b => [b.id, b.zone, b.split, b.divW, b.feet, b.stack, b.ht, b.divN]), [[1, "main", "1", 1, "none", true, "full", 1], [6, "left", "1", 1, "none", false, "half", 10]]);
  assert.equal(S.selId, 1); assert.equal(next, 7);
});

test("restore migrates old single labels and keeps per-cell maps", () => {
  const S = createState();
  restoreState(S, { caseType: "M", bins: [
    { id: 1, zone: "main", c: 0, r: 0, w: 2, n: 2, divW: 2, divN: 3, label: "OLD STYLE" },
    { id: 2, zone: "main", c: 3, r: 0, w: 1, n: 2, labels: { "0,0": "GOOD", "9,9": "FAR OUT" }, labelPlate: "yes" },
    { id: 3, zone: "left", c: 0, r: 0, w: 1, n: 1, stack: true, split: "w", trayDivN: 2, trayLabels: ["OLD TRAY", { "0,1": "MAP" }, 7] }
  ] });
  assert.deepEqual(S.bins[0].labels, { "1,0": "OLD STYLE", "1,1": "OLD STYLE", "1,2": "OLD STYLE" });
  assert.deepEqual(S.bins[1].labels, { "0,0": "GOOD" }); assert.equal(S.bins[1].labelPlate, true);
  assert.deepEqual(S.bins[2].trayLabels, [{ "1,0": "OLD TRAY" }, {}, {}]);
});

test("the older single-bin save format still loads", () => {
  const S = createState();
  restoreState(S, { caseType: "L", w: 2, n: 4, ht: "half", divW: 2, feet: "corners", sel: { zone: "main", c: 2, r: 0 }, wall: 2 });
  assert.equal(S.caseType, "L"); assert.equal(S.wall, 2);
  assert.deepEqual(S.bins.map(b => [b.zone, b.c, b.r, b.w, b.n, b.ht, b.divW, b.feet]), [["main", 2, 0, 2, 4, "half", 2, "corners"]]);
});

test("new bins never share label containers", () => {
  const a = makeBin(1, "main", 0, 0, 1, 1), b = makeBin(2, "main", 2, 0, 1, 1);
  a.labels["0,0"] = "A"; a.trayLabels.push({ "0,0": "T" });
  assert.deepEqual(b.labels, {}); assert.deepEqual(b.trayLabels, []);
});

test("stock layouts fill the case and respect placement rules", () => {
  let id = 1; const nb = (...a) => makeBin(id++, ...a);
  const M = stockLayout("M", nb), L = stockLayout("L", nb);
  assert.equal(M.length, 20); assert.equal(L.length, 8);
  assert.equal(usedCells(M), TOTAL_CELLS); assert.equal(usedCells(L), TOTAL_CELLS);
  assert.equal(findSpot(M, 1, 1), null);
  assert.equal(binAt(M, "main", 4, 0).w, 1);
  assert.equal(canPlace(M, "main", 0, 0, 1, 1), false);
  assert.equal(canPlace(M, "main", 0, 0, 1, 1, M[0].id), true); // the bin's own cells don't block it
  assert.equal(canPlace([], "main", 9, 3, 1, 2), false); // runs off the grid
});
