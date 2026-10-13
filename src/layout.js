// The case floor: the cell grid, where bins may go, and the stock layouts. Bins are passed in; no app state here.

// Long axis: 10 N cells. Main block: 4 W rows. Handle strip: 2 N rows, a 2-cell (W) pocket each end.
var MAP = { mainCols: 10, mainRows: 4, cw: 40, rh: 54, stripRows: 2, zoneCols: 2 };
var MAIN_H = MAP.mainRows * MAP.rh, STRIP_H = MAP.stripRows * MAP.cw, FLOOR_W = MAP.mainCols * MAP.cw, ZONE_W = MAP.zoneCols * MAP.rh;
var zones = {
  main:  { x0: 0, y0: 0, cols: MAP.mainCols, rows: MAP.mainRows, cw: MAP.cw, rh: MAP.rh, colIs: "n" },
  left:  { x0: 0, y0: MAIN_H, cols: MAP.zoneCols, rows: MAP.stripRows, cw: MAP.rh, rh: MAP.cw, colIs: "w" },
  right: { x0: FLOOR_W - ZONE_W, y0: MAIN_H, cols: MAP.zoneCols, rows: MAP.stripRows, cw: MAP.rh, rh: MAP.cw, colIs: "w" }
};
function span(zone, w, n) { var z = zones[zone]; return z.colIs === "n" ? { cols: n, rows: w } : { cols: w, rows: n }; }
function sizeFromSpan(zone, cols, rows) { return zones[zone].colIs === "n" ? { w: rows, n: cols } : { w: cols, n: rows }; }
function inBounds(zone, c, r, w, n) { var z = zones[zone], s = span(zone, w, n); return c >= 0 && r >= 0 && c + s.cols <= z.cols && r + s.rows <= z.rows; }
function collides(bins, zone, c, r, w, n, exceptId) {
  var s = span(zone, w, n);
  return bins.some(function (b) {
    if (b.id === exceptId || b.zone !== zone) return false;
    var t = span(b.zone, b.w, b.n);
    return c < b.c + t.cols && b.c < c + s.cols && r < b.r + t.rows && b.r < r + s.rows;
  });
}
function canPlace(bins, zone, c, r, w, n, exceptId) { return inBounds(zone, c, r, w, n) && !collides(bins, zone, c, r, w, n, exceptId); }
function findSpot(bins, w, n, exceptId) {
  var order = ["main", "left", "right"];
  for (var i = 0; i < order.length; i++) {
    var z = zones[order[i]];
    for (var r = 0; r < z.rows; r++) for (var c = 0; c < z.cols; c++) if (canPlace(bins, order[i], c, r, w, n, exceptId)) return { zone: order[i], c: c, r: r };
  }
  return null;
}
function binAt(bins, zone, c, r) {
  for (var i = 0; i < bins.length; i++) {
    var b = bins[i]; if (b.zone !== zone) continue;
    var t = span(zone, b.w, b.n);
    if (c >= b.c && c < b.c + t.cols && r >= b.r && r < b.r + t.rows) return b;
  }
  return null;
}
function usedCells(bins) { return bins.reduce(function (s, b) { return s + b.w * b.n; }, 0); }
var TOTAL_CELLS = MAP.mainCols * MAP.mainRows + 2 * MAP.zoneCols * MAP.stripRows;

function binRect(b) {
  var z = zones[b.zone], s = span(b.zone, b.w, b.n);
  return { x: z.x0 + b.c * z.cw, y: z.y0 + b.r * z.rh, w: s.cols * z.cw, h: s.rows * z.rh };
}

var PRESETS = {
  M: [[1, 1, "small"], [1, 2, "medium"], [2, 2, "big"]],
  L: [[2, 2, "small"], [2, 4, "large"], [1, 4, "half large"]]
};

function stockLayout(caseType, newBin) { // the bins the case ships with
  var B = [];
  if (caseType === "M") {
    // bigs on both sides, the four mediums in the center lane
    [0, 2, 6, 8].forEach(function (cc) { for (var rr = 0; rr < 4; rr += 2) B.push(["main", cc, rr, 2, 2]); });
    for (var r4 = 0; r4 < 4; r4++) B.push(["main", 4, r4, 1, 2]);
    ["left", "right"].forEach(function (z) { for (var c5 = 0; c5 < 2; c5++) for (var r5 = 0; r5 < 2; r5++) B.push([z, c5, r5, 1, 1]); });
  } else {
    B.push(["main", 0, 0, 2, 4], ["main", 0, 2, 2, 4], ["main", 4, 0, 2, 2], ["main", 4, 2, 2, 2], ["main", 6, 0, 2, 4], ["main", 6, 2, 2, 4]);
    B.push(["left", 0, 0, 2, 2], ["right", 0, 0, 2, 2]);
  }
  return B.map(function (x) { return newBin(x[0], x[1], x[2], x[3], x[4]); });
}

export { MAP, MAIN_H, STRIP_H, FLOOR_W, ZONE_W, zones, TOTAL_CELLS, PRESETS, span, sizeFromSpan, inBounds, collides, canPlace, findSpot, binAt, usedCells, binRect, stockLayout };
