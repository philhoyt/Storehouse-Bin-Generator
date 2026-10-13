// Pure helpers about one bin: its orientation in the case, label cells, the stroke font. No app state here.

export const LABEL = { raise: 0.5, stroke: 0.8, capMax: 6, capMin: 3.5, maxLen: 24 }; // raised label letters, mm
export const SPLIT_NAME = { "1": "", w: "-split2w", n: "-split2n", "4": "-split4" };
export function f1(v) { return (Math.round(v * 10) / 10).toString(); }
export function splitOf(split) { return { kx: (split === "w" || split === "4") ? 2 : 1, ky: (split === "n" || split === "4") ? 2 : 1 }; } // trays across W and N

var GLYPH_W = 0.7, GLYPH_ADV = 1, SPACE_ADV = 0.6;
var FONT = {
  A: [[[0,0],[.35,1],[.7,0]], [[.12,.35],[.58,.35]]],
  B: [[[0,0],[0,1],[.5,1],[.7,.85],[.7,.65],[.5,.5],[0,.5]], [[.5,.5],[.7,.35],[.7,.15],[.5,0],[0,0]]],
  C: [[[.7,.8],[.5,1],[.2,1],[0,.8],[0,.2],[.2,0],[.5,0],[.7,.2]]],
  D: [[[0,0],[0,1],[.45,1],[.7,.75],[.7,.25],[.45,0],[0,0]]],
  E: [[[.7,1],[0,1],[0,0],[.7,0]], [[0,.5],[.5,.5]]],
  F: [[[.7,1],[0,1],[0,0]], [[0,.5],[.5,.5]]],
  G: [[[.7,.8],[.5,1],[.2,1],[0,.8],[0,.2],[.2,0],[.5,0],[.7,.2],[.7,.45],[.4,.45]]],
  H: [[[0,0],[0,1]], [[.7,0],[.7,1]], [[0,.5],[.7,.5]]],
  I: [[[.35,0],[.35,1]], [[.1,1],[.6,1]], [[.1,0],[.6,0]]],
  J: [[[.7,1],[.7,.2],[.5,0],[.2,0],[0,.2]]],
  K: [[[0,0],[0,1]], [[.7,1],[0,.4]], [[.25,.55],[.7,0]]],
  L: [[[0,1],[0,0],[.7,0]]],
  M: [[[0,0],[0,1],[.35,.45],[.7,1],[.7,0]]],
  N: [[[0,0],[0,1],[.7,0],[.7,1]]],
  O: [[[.2,0],[.5,0],[.7,.2],[.7,.8],[.5,1],[.2,1],[0,.8],[0,.2],[.2,0]]],
  P: [[[0,0],[0,1],[.5,1],[.7,.85],[.7,.6],[.5,.45],[0,.45]]],
  Q: [[[.2,0],[.5,0],[.7,.2],[.7,.8],[.5,1],[.2,1],[0,.8],[0,.2],[.2,0]], [[.4,.3],[.7,0]]],
  R: [[[0,0],[0,1],[.5,1],[.7,.85],[.7,.6],[.5,.45],[0,.45]], [[.3,.45],[.7,0]]],
  S: [[[.7,.8],[.5,1],[.2,1],[0,.85],[0,.65],[.2,.5],[.5,.5],[.7,.35],[.7,.15],[.5,0],[.2,0],[0,.2]]],
  T: [[[0,1],[.7,1]], [[.35,1],[.35,0]]],
  U: [[[0,1],[0,.2],[.2,0],[.5,0],[.7,.2],[.7,1]]],
  V: [[[0,1],[.35,0],[.7,1]]],
  W: [[[0,1],[.15,0],[.35,.55],[.55,0],[.7,1]]],
  X: [[[0,0],[.7,1]], [[0,1],[.7,0]]],
  Y: [[[0,1],[.35,.5],[.7,1]], [[.35,.5],[.35,0]]],
  Z: [[[0,1],[.7,1],[0,0],[.7,0]]],
  "0": [[[.2,0],[.5,0],[.7,.2],[.7,.8],[.5,1],[.2,1],[0,.8],[0,.2],[.2,0]], [[.15,.25],[.55,.75]]],
  "1": [[[.12,.8],[.35,1],[.35,0]], [[.1,0],[.6,0]]],
  "2": [[[0,.8],[.2,1],[.5,1],[.7,.8],[.7,.6],[0,0],[.7,0]]],
  "3": [[[0,1],[.7,1],[.35,.58],[.5,.58],[.7,.4],[.7,.18],[.5,0],[.2,0],[0,.18]]],
  "4": [[[.55,0],[.55,1],[0,.3],[.7,.3]]],
  "5": [[[.7,1],[0,1],[0,.55],[.45,.58],[.7,.4],[.7,.18],[.5,0],[.2,0],[0,.18]]],
  "6": [[[.65,1],[.3,1],[0,.65],[0,.18],[.2,0],[.5,0],[.7,.18],[.7,.4],[.5,.58],[0,.52]]],
  "7": [[[0,1],[.7,1],[.25,0]]],
  "8": [[[.2,.52],[0,.68],[0,.85],[.2,1],[.5,1],[.7,.85],[.7,.68],[.5,.52],[.2,.52],[0,.36],[0,.16],[.2,0],[.5,0],[.7,.16],[.7,.36],[.5,.52]]],
  "9": [[[.7,.48],[.2,.42],[0,.6],[0,.82],[.2,1],[.5,1],[.7,.82],[.7,.35],[.4,0]]],
  "-": [[[.1,.5],[.6,.5]]],
  ".": [[[.3,0],[.4,0]]],
  "/": [[[0,0],[.7,1]]],
  "+": [[[.35,.2],[.35,.8]], [[.05,.5],[.65,.5]]],
  "'": [[[.35,1],[.35,.78]]]
};
function cleanLabel(t) { return String(t || "").toUpperCase().replace(/[^A-Z0-9 \-./+']/g, "").replace(/\s+/g, " ").trim().slice(0, LABEL.maxLen); }
function labelAdvance(ch) { return ch === " " ? SPACE_ADV : GLYPH_ADV; }
function labelUnits(text) { var u = 0; for (var i = 0; i < text.length; i++) u += labelAdvance(text[i]); return u - (GLYPH_ADV - GLYPH_W); }
function labelFace(b) {
  var map = b.zone === "main" ? { back: [0, 1], left: [1, 1], right: [1, -1] } : { back: [1, 1], right: [0, 1], left: [0, -1] };
  var m = map[b.labelSide] || map.back; return { p: m[0], sign: m[1] };
}
function gridShape(b, nW, nN) { return b.zone === "main" ? { rows: nW, cols: nN } : { rows: nN, cols: nW }; }
function cellToLocal(b, nW, nN, r, c) { return b.zone === "main" ? { ix: r, iy: nN - 1 - c } : { ix: c, iy: r }; } // compartment indexes along x (W) and y (N)
function cleanLabelMap(m, sh) { // a saved label map with only cells inside the grid and string values, or null if it isn't a map at all
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  var out = {};
  Object.keys(m).forEach(function (k) {
    var rc = /^(\d{1,2}),(\d{1,2})$/.exec(k);
    if (rc && +rc[1] < sh.rows && +rc[2] < sh.cols && typeof m[k] === "string" && m[k]) out[k] = m[k].slice(0, LABEL.maxLen);
  });
  return out;
}
function spreadLabel(b, nW, nN, text) { // an old single label goes on every compartment along the far wall
  var out = {}; if (typeof text !== "string" || !cleanLabel(text)) return out;
  var sh = gridShape(b, nW, nN);
  for (var c = 0; c < sh.cols; c++) out[(sh.rows - 1) + "," + c] = text.slice(0, LABEL.maxLen);
  return out;
}
function mapTexts(m) { return Object.keys(m || {}).map(function (k) { return cleanLabel(m[k]); }).filter(Boolean); }
function trayNames(b) {
  var k = splitOf(b.split), main = b.zone === "main", out = [];
  for (var i = 0; i < k.kx; i++) for (var j = 0; j < k.ky; j++) {
    var depth = main ? (i ? "far" : "near") : (j ? "far" : "near"), side = main ? (j ? "left" : "right") : (i ? "right" : "left");
    var bits = []; if ((main ? k.kx : k.ky) > 1) bits.push(depth); if ((main ? k.ky : k.kx) > 1) bits.push(side);
    out.push(bits.length ? bits.join(" ") + " tray" : "Tray");
  }
  return out.map(function (n) { return n.charAt(0).toUpperCase() + n.slice(1); });
}

export { FONT, GLYPH_W, GLYPH_ADV, SPACE_ADV, cleanLabel, labelAdvance, labelUnits, labelFace, gridShape, cellToLocal, cleanLabelMap, spreadLabel, mapTexts, trayNames };
