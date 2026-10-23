import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, toSTL, zip } from "../src/export.js";
import { fresh, unzip } from "./helpers.js";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xCBF43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("STL is binary with an 80 byte header, a count, and 50 bytes per triangle", () => {
  const tris = [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]]];
  const u = toSTL(tris, "test");
  assert.equal(u.length, 84 + 2 * 50);
  assert.equal(new DataView(u.buffer).getUint32(80, true), 2);
  assert.equal(new TextDecoder().decode(u.subarray(0, 18)), "Storehouse bin tes");
  const nz = new DataView(u.buffer).getFloat32(84 + 8, true); // the first triangle's normal points +z
  assert.ok(Math.abs(nz - 1) < 1e-6);
});

test("zip round-trips names, sizes, and text", async () => {
  const files = [{ name: "a.txt", data: "hello" }, { name: "b.bin", data: new Uint8Array([1, 2, 3]) }];
  const got = await unzip(files);
  assert.deepEqual(got.map(f => [f.name, f.size]), [["a.txt", 5], ["b.bin", 3]]);
  assert.equal(got[0].text, "hello");
  const u = new Uint8Array(await zip(files).arrayBuffer());
  assert.equal(new DataView(u.buffer).getUint32(u.length - 22, true), 0x06054b50); // end of central directory
});

test("file names describe the bin, and matching bins share one file", async () => {
  const { S, ex, newBin } = fresh("M");
  const a = newBin("main", 0, 0, 1, 2), b = newBin("main", 2, 0, 1, 2), c = newBin("main", 4, 0, 1, 2, { divW: 2, divPct: 50, feet: "corners" });
  S.bins = [a, b, c];
  assert.equal(ex.fileStem(a), "M-1x2");
  assert.equal(ex.fileStem(c), "M-1x2-div2x1-50pct-feet");
  const gs = ex.groups(S.bins);
  assert.deepEqual(gs.map(g => [g.stem, g.nums]), [["M-1x2", [1, 2]], ["M-1x2-div2x1-50pct-feet", [3]]]);
  const files = await unzip(ex.allBinsFiles().files);
  assert.deepEqual(files.map(f => f.name), ["M-1x2-x2.stl", "M-1x2-div2x1-50pct-feet.stl", "layout.txt"]);
  assert.match(files[2].text, /M-1x2-x2\.stl {2}print 2 {2}\(bins 1, 2\)/);
});

test("stacked bins export a base and trays, trays with the same labels share a file", async () => {
  const { S, ex, newBin } = fresh("M");
  const b = newBin("main", 0, 0, 2, 2, { stack: true, split: "4", lowerH: 20 });
  S.bins = [b];
  b.labels = { "0,0": "BASE" }; b.trayLabels = [{ "0,0": "M3" }, { "0,0": "M4" }, { "0,0": "M3" }, {}];
  const names = (await unzip(ex.oneBinFiles(b).files)).map(f => f.name);
  assert.deepEqual(names, ["M-2x2-stack-base20-rib4-lbl-BASE.stl", "M-2x2-stack-top32-split4-lbl-M3-x2.stl", "M-2x2-stack-top32-split4-lbl-M4.stl", "M-2x2-stack-top32-split4.stl"]);
  b.labelPlate = true;
  assert.ok((await unzip(ex.oneBinFiles(b).files)).some(f => f.name === "M-2x2-stack-top32-split4-plate.stl"));
});

test("OpenSCAD settings carry the bin and its labels", () => {
  const { S, ex, newBin } = fresh("L");
  const b = newBin("main", 0, 0, 2, 4, { divW: 2, divN: 2, feet: "edge" });
  S.bins = [b]; b.labels = { "1,0": "M4", "1,1": "M5", "0,0": "NUTS", "0,1": "BOLTS" };
  const t = ex.scadText(b);
  assert.match(t, /^case_type = "L";\ncells_w = 2;\ncells_n = 4;/);
  assert.match(t, /feet = "perimeter";/);
  assert.match(t, /labels = \[\["M5", "M4"\], \["BOLTS", "NUTS"\]\];/); // row 0 is the far row; columns run from -N to +N, which is right to left as seen from the front
  assert.match(t, /label_wall = "W\+";/);
});
