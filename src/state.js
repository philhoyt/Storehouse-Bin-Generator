// Defaults, limits, and the restore of saved state. Anything from storage is checked before use.
import { zones, canPlace } from "./layout.js";
import { cleanLabelMap, spreadLabel, gridShape } from "./bins.js";

var MEASURED = { wall: 1.6, floorT: 1.6, cornerR: 3, draft: 1.5, clearance: 0.25, pitchW: 54, pitchN: 40, hM: 50, hL: 94, footD: 5, footH: 1.6, plugDepth: 4, plugClear: 0.4, labelDepth: 6, labelFace: 10 };
var BIN_OPTS = { ht: "full", customH: 30, divW: 1, divN: 1, divPct: 100, feet: "none", stack: false, lowerH: 0, split: "1", trayDivW: 1, trayDivN: 1, labels: {}, labelSide: "back", labelPlate: false, trayLabels: [] };
var STEP_LIMITS = { divW: [1, 8], divN: [1, 10], trayDivW: [1, 6], trayDivN: [1, 8] };
var TRAY_GAP = 0.6; // stacking: gap between split trays (plug depth and clearance live in S)
var DIVIDER_T = 1.2; // divider wall thickness
var ADV_KEYS = Object.keys(MEASURED);
var FOOT_INSET = 4;
// what the Fit and print inputs allow, used to clamp saved values and edits
var ADV_LIMITS = { wall: [0.8, 4], floorT: [0.8, 4], cornerR: [0.5, 10], draft: [0, 4], clearance: [0, 2], pitchW: [30, 80], pitchN: [30, 80], hM: [20, 120], hL: [20, 140],
                   footD: [2, 12], footH: [0.4, 5], plugDepth: [2, 10], plugClear: [0, 1.5], labelDepth: [3, 12], labelFace: [6, 20] };
var BIN_ENUMS = { ht: ["full", "half", "custom"], feet: ["none", "corners", "edge"], split: ["1", "w", "n", "4"], labelSide: ["back", "left", "right"] };
function isNum(v) { return typeof v === "number" && isFinite(v); }
function isInt(v, lo, hi) { return isNum(v) && v === Math.floor(v) && v >= lo && v <= hi; }

function makeBin(id, zone, c, r, w, n, opts) {
  return Object.assign({ id: id, zone: zone, c: c, r: r, w: w, n: n }, BIN_OPTS, { labels: {}, trayLabels: [] }, opts || {});
}
function createState() { return Object.assign({ caseType: "M", view: "case", bins: [], selId: null }, MEASURED); }
function cleanBin(raw) { // a saved bin with every field checked, or null if it can't be trusted
  if (!raw || typeof raw !== "object" || !Object.prototype.hasOwnProperty.call(zones, raw.zone)) return null;
  var b = Object.assign({}, BIN_OPTS, raw);
  if (!isInt(b.id, 1, 1e9) || !isInt(b.c, 0, 99) || !isInt(b.r, 0, 99) || !isInt(b.w, 1, 10) || !isInt(b.n, 1, 10)) return null;
  Object.keys(BIN_ENUMS).forEach(function (k) { if (BIN_ENUMS[k].indexOf(b[k]) < 0) b[k] = BIN_OPTS[k]; });
  ["customH", "divW", "divN", "divPct", "lowerH", "trayDivW", "trayDivN"].forEach(function (k) { if (!isNum(b[k])) b[k] = BIN_OPTS[k]; });
  b.stack = !!b.stack;
  b.labelPlate = !!b.labelPlate;
  Object.keys(STEP_LIMITS).forEach(function (k) { b[k] = Math.min(STEP_LIMITS[k][1], Math.max(STEP_LIMITS[k][0], Math.round(b[k]))); });
  // labels are maps keyed "row,col" as seen from the front; older saves had one string per part
  b.labels = cleanLabelMap(raw.labels, gridShape(b, b.divW, b.divN)) || spreadLabel(b, b.divW, b.divN, raw.label);
  b.trayLabels = (Array.isArray(raw.trayLabels) ? raw.trayLabels : []).slice(0, 4).map(function (m) { return cleanLabelMap(m, gridShape(b, b.trayDivW, b.trayDivN)) || spreadLabel(b, b.trayDivW, b.trayDivN, m); });
  return { id: b.id, zone: b.zone, c: b.c, r: b.r, w: b.w, n: b.n, ht: b.ht, customH: b.customH, divW: b.divW, divN: b.divN, divPct: b.divPct,
           feet: b.feet, stack: b.stack, lowerH: b.lowerH, split: b.split, trayDivW: b.trayDivW, trayDivN: b.trayDivN, labels: b.labels, labelSide: b.labelSide, labelPlate: b.labelPlate, trayLabels: b.trayLabels };
}
// Fills S from whatever was saved: a bad zone, an overlapping bin, or a wrong type is dropped rather than breaking startup.
// Returns the next free bin id.
function restoreState(S, saved) {
  var nextId = 1;
  function addSavedBin(raw) {
    var b = cleanBin(raw);
    if (b && canPlace(S.bins, b.zone, b.c, b.r, b.w, b.n) && !S.bins.some(function (o) { return o.id === b.id; })) { S.bins.push(b); nextId = Math.max(nextId, b.id + 1); }
  }
  if (saved && typeof saved === "object") {
    if (saved.caseType === "M" || saved.caseType === "L") S.caseType = saved.caseType;
    ADV_KEYS.forEach(function (k) { if (isNum(saved[k])) S[k] = Math.min(ADV_LIMITS[k][1], Math.max(ADV_LIMITS[k][0], saved[k])); });
    if (Array.isArray(saved.bins)) {
      if (saved.view === "case" || saved.view === "bin") S.view = saved.view;
      S.liftTrays = !!saved.liftTrays;
      saved.bins.forEach(addSavedBin);
      S.selId = saved.selId;
    } else { // older single-bin save
      var sv = saved.sel || {};
      addSavedBin(makeBin(1, sv.zone || "main", sv.c || 0, sv.r || 0, saved.w || 1, saved.n || 2,
        { ht: saved.ht || "full", customH: saved.customH || 30, divW: saved.divW || 1, divN: saved.divN || 1, divPct: saved.divPct || 100, feet: saved.feet || "corners" }));
    }
    if (!S.bins.some(function (b) { return b.id === S.selId; })) S.selId = S.bins.length ? S.bins[0].id : null;
  }
  return nextId;
}

export { MEASURED, BIN_OPTS, STEP_LIMITS, TRAY_GAP, DIVIDER_T, FOOT_INSET, ADV_KEYS, ADV_LIMITS, BIN_ENUMS, makeBin, createState, cleanBin, restoreState };
