// Shared bits for the tests: a fresh app state, bins built the way the app builds them, and a hash of exported bytes.
import { createState, makeBin, BIN_OPTS } from "../src/state.js";
import { stockLayout } from "../src/layout.js";
import { createGeometry } from "../src/geometry.js";
import { createExport, zip } from "../src/export.js";

export function fresh(caseType) {
  var S = createState(), id = 1;
  S.caseType = caseType || "M";
  var newBin = function (zone, c, r, w, n, opts) { return makeBin(id++, zone, c, r, w, n, opts); };
  var geo = createGeometry(S), ex = createExport(S, geo);
  return { S: S, newBin: newBin, geo: geo, ex: ex, stock: function () { S.bins = stockLayout(S.caseType, newBin); S.selId = S.bins[0].id; } };
}

// The same checksum the browser probe used when the baselines were recorded: two FNV-style passes plus the byte count.
export async function hashZip(files) {
  var u = new Uint8Array(await zip(files).arrayBuffer()), h1 = 0x811c9dc5, h2 = 0x1000193;
  for (var i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 0x01000193) >>> 0; h2 = Math.imul(h2 ^ u[i], 0x9E3779B1) >>> 0; }
  return h1.toString(16) + h2.toString(16) + ":" + u.length;
}

// "Use this bin's options on all bins", as the panel does it
export function applyAll(S, b) {
  var keys = Object.keys(BIN_OPTS).filter(function (k) { return k !== "labels" && k !== "labelSide" && k !== "labelPlate" && k !== "trayLabels"; });
  S.bins.forEach(function (o) { keys.forEach(function (k) { o[k] = b[k]; }); });
}

export async function unzip(files) { // names and STL triangle counts of a file list, via the real zip bytes
  var u = new Uint8Array(await zip(files).arrayBuffer()), dv = new DataView(u.buffer), out = [], o = 0;
  while (o + 30 <= u.length && dv.getUint32(o, true) === 0x04034b50) {
    var size = dv.getUint32(o + 18, true), nl = dv.getUint16(o + 26, true), el = dv.getUint16(o + 28, true);
    var name = new TextDecoder().decode(u.subarray(o + 30, o + 30 + nl)), start = o + 30 + nl + el;
    out.push({ name: name, size: size, tris: name.endsWith(".stl") ? new DataView(u.buffer, start).getUint32(80, true) : null, text: name.endsWith(".txt") ? new TextDecoder().decode(u.subarray(start, start + size)) : null });
    o = start + size;
  }
  return out;
}
