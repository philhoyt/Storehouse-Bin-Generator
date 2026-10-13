// Golden exports. Each checksum was recorded by driving the real UI in Chrome through the same steps and checked
// against this Node build, so the two agree byte for byte. If one changes, the geometry or the export format changed;
// re-record only on purpose, and confirm the browser produces the same value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, hashZip, applyAll } from "./helpers.js";

test("Medium stock layout, download all", async () => {
  const { ex, stock } = fresh("M"); stock();
  assert.equal(await hashZip(ex.allBinsFiles().files), "c68c3c4a4a9554ba:44154");
});

test("stacked bin with four trays, dividers, feet: download selected and all", async () => {
  const { S, ex, stock } = fresh("M"); stock();
  const b = S.bins[0];
  Object.assign(b, { stack: true, split: "4", trayDivW: 2, trayDivN: 2, divW: 2, divN: 3, divPct: 50, feet: "corners", lowerH: 20 });
  assert.equal(await hashZip(ex.oneBinFiles(b).files), "c264e680cf3e5f2c:59908");
  const b17 = S.bins[16];
  Object.assign(b17, { stack: true, split: "w", divW: 3 });
  assert.equal(await hashZip(ex.oneBinFiles(b17).files), "66c5280ff2f0b06f:38274");
  assert.equal(await hashZip(ex.allBinsFiles().files), "123e22858fdaf91d:142623");
});

function largeScenario() {
  const t = fresh("L"); t.stock();
  const { S } = t;
  Object.assign(S.bins[0], { ht: "custom", customH: 60, feet: "edge" });
  Object.assign(S, { wall: 2, clearance: 0.3, draft: 2 });
  Object.assign(S.bins[6], { stack: true, split: "n", trayDivN: 3 });
  return t;
}

test("Large stock layout with custom height, edge feet, changed fit settings, a stacked pocket bin", async () => {
  const { ex } = largeScenario();
  assert.equal(await hashZip(ex.allBinsFiles().files), "ce7b9df2d059e92a:140198");
});

test("fit test kit with changed fit settings", async () => {
  const { ex } = largeScenario();
  assert.equal(await hashZip(ex.fitTestFiles().files), "cfae072b2fc785e:80808");
});

test("apply one bin's options to all, then half height on the first", async () => {
  const { S, ex } = largeScenario();
  applyAll(S, S.bins[0]);
  assert.equal(await hashZip(ex.allBinsFiles().files), "9a3c835aa5419c1:125573");
  S.bins[0].ht = "half";
  assert.equal(await hashZip(ex.oneBinFiles(S.bins[0]).files), "e831531fb5ed959:72228");
});
