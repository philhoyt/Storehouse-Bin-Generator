// Names, grouping, and files: STL and zip writers, layout.txt, the OpenSCAD settings block, the fit test.
// createExport(S, geo) binds the naming and packaging to the app state and a geometry instance.
import { SPLIT_NAME, f1, splitOf, cleanLabel, gridShape, labelFace, mapTexts } from "./bins.js";
import { BIN_OPTS } from "./state.js";
import { TOTAL_CELLS, usedCells } from "./layout.js";

// ---------------------------------------------------------------- file formats
function toSTL(tris, label) {
  var buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf);
  var head = "Storehouse bin " + label;
  for (var i = 0; i < head.length && i < 80; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  var o = 84;
  tris.forEach(function (t) {
    var a = t[0], b = t[1], c = t[2];
    var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    [nx/l, ny/l, nz/l].concat(a, b, c).forEach(function (v) { dv.setFloat32(o, v, true); o += 4; });
    dv.setUint16(o, 0, true); o += 2;
  });
  return new Uint8Array(buf);
}
var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  var enc = new TextEncoder(), locals = [], central = [], offset = 0;
  files.forEach(function (f) {
    var name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data), size = data.length;
    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    locals.push(new Uint8Array(lh.buffer), name, data);
    var ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  });
  var cSize = central.reduce(function (s, a) { return s + a.length; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
  return new Blob(locals.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
}
function stlName(g) { return g.stem + (g.nums.length > 1 ? "-x" + g.nums.length : "") + ".stl"; }

// ---------------------------------------------------------------- bound to the app state
function createExport(S, geo) {
  var dims = geo.dims, lowerH = geo.lowerH, trayH = geo.trayH, trays = geo.trays, buildBin = geo.buildBin, buildTray = geo.buildTray, caseName = geo.caseName, partLabelMaps = geo.partLabelMaps;
  function idx(b) { return S.bins.indexOf(b) + 1; }
  function codeOf(b) { return S.caseType + "-" + b.w + "x" + b.n + (b.stack ? "-stack" : b.ht === "half" ? "-half" : b.ht === "custom" ? "-" + Math.round(dims(b).h) + "mm" : ""); }
  function partsOf(b) { // every printable part of a bin: the bin itself, plus one entry per tray when stacked
    var base = { stem: fileStem(b), make: function () { return buildBin(b); } };
    if (!b.stack) return [base];
    var ts = trays(b); // every tray has the same footprint; only its labels can differ
    return [base].concat(ts.map(function (t, k) {
      var m = (b.trayLabels || [])[k] || {};
      return { stem: trayStem(b, m), make: function () { return buildTray(b, ts[0], undefined, undefined, m); } };
    }));
  }
  function trayStem(b, m) {
    return S.caseType + "-" + b.w + "x" + b.n + "-stack-top" + Math.round(trayH(b)) + SPLIT_NAME[b.split] +
      (b.trayDivW > 1 || b.trayDivN > 1 ? "-div" + b.trayDivW + "x" + b.trayDivN : "") + labelStem(b, m, b.trayDivW, b.trayDivN);
  }
  // What to call each tray in the panel, as seen from the front of the case
  function labelStem(b, m, nW, nN) { // a part's label map in its file name: cells far to near, left to right
    var sh = gridShape(b, nW, nN), cells = [], any = false;
    for (var r = sh.rows - 1; r >= 0; r--) for (var c = 0; c < sh.cols; c++) { var t = cleanLabel((m || {})[r + "," + c]); if (t) any = true; cells.push(t.replace(/[^A-Z0-9]+/g, "-")); }
    if (!any && !b.labelPlate) return "";
    return (any ? "-lbl-" + cells.join("_") : "-plate") + (b.labelSide !== "back" ? "-" + b.labelSide : "");
  }
  function fileStem(b) {
    var s = codeOf(b);
    if (b.stack) s += "-base" + Math.round(lowerH(b)) + (b.split === "1" ? "" : "-rib" + b.split);
    if (b.divW > 1 || b.divN > 1) s += "-div" + b.divW + "x" + b.divN + (b.divPct < 100 ? "-" + b.divPct + "pct" : "");
    if (b.feet === "corners") s += "-feet"; else if (b.feet === "edge") s += "-edgefeet";
    return s + labelStem(b, b.labels, b.divW, b.divN);
  }
  function describe(b) {
    var bits = [];
    var D = dims(b);
    var k = splitOf(b.split), nTrays = k.kx * k.ky;
    if (b.stack) bits.push("stacked " + Math.round(lowerH(b)) + " + " + Math.round(trayH(b) - S.plugDepth) + " mm" + (nTrays > 1 ? " · " + nTrays + " trays" : ""));
    else bits.push(b.ht === "full" ? "full height" : b.ht === "half" ? "half height" : Math.round(D.h) + " mm tall");
    if (b.divW > 1 || b.divN > 1) bits.push(b.divW * b.divN + " sections");
    if (b.feet !== "none") bits.push(b.feet === "corners" ? "corner feet" : "edge feet");
    var labels = []; partLabelMaps(b).forEach(function (m) { labels = labels.concat(mapTexts(m)); });
    if (labels.length) bits.push(labels.map(function (l) { return '"' + l + '"'; }).join(" ")); else if (b.labelPlate) bits.push("blank label plate");
    if (b.zone !== "main") bits.push("handle pocket");
    return bits.join(" · ");
  }
  function groups(list) { // one entry per unique printable part, with every bin number that uses it
    var map = {}, order = [];
    list.forEach(function (b) {
      partsOf(b).forEach(function (pt) {
        if (!map[pt.stem]) { map[pt.stem] = { stem: pt.stem, make: pt.make, nums: [] }; order.push(pt.stem); }
        map[pt.stem].nums.push(idx(b));
      });
    });
    return order.map(function (k) { return map[k]; });
  }
  function stlFiles(gs) { return gs.map(function (g) { return { name: stlName(g), data: toSTL(g.make(), g.stem) }; }); }
  function layoutText(list) {
    var lines = ["Storehouse " + caseName() + " case layout", list.length + " bins, " + usedCells(S.bins) + " of " + TOTAL_CELLS + " cells used", ""];
    groups(list).forEach(function (g) {
      var bins = g.nums.filter(function (v, i, a) { return a.indexOf(v) === i; });
      lines.push(stlName(g) + "  print " + g.nums.length + "  (bin" + (bins.length > 1 ? "s " : " ") + bins.join(", ") + ")");
    });
    if (list.some(function (b) { return b.stack; })) lines.push("", "Stacked bins: print the -base and -top files. Each top tray has a " + S.plugDepth + " mm plug that drops inside its base's rim.");
    lines.push("", "Cell " + S.pitchW + " x " + S.pitchN + " mm (W x N). Clearance " + S.clearance + " mm per side. Wall " + S.wall + " mm.");
    return lines.join("\n");
  }
  function scadLabels(b, m, nW, nN) {
    var f = labelFace(b), p = f.p, np = p === 0 ? nW : nN, ns = p === 0 ? nN : nW, rows = [];
    for (var i = 0; i < np; i++) {
      var row = [];
      for (var j = 0; j < ns; j++) {
        var ip = f.sign > 0 ? np - 1 - i : i, ix = p === 0 ? ip : j, iy = p === 0 ? j : ip;
        var r = b.zone === "main" ? ix : iy, c = b.zone === "main" ? nN - 1 - iy : ix;
        row.push('"' + cleanLabel((m || {})[r + "," + c]).replace(/[\\"]/g, "") + '"');
      }
      rows.push("[" + row.join(", ") + "]");
    }
    return "[" + rows.join(", ") + "]";
  }
  function scadText(b) {
    return [
      "case_type = \"" + S.caseType + "\";", "cells_w = " + b.w + ";", "cells_n = " + b.n + ";",
      "half_height = " + (!b.stack && b.ht === "half") + ";", "custom_height = " + (!b.stack && b.ht === "custom" ? f1(dims(b).h) : 0) + ";",
      "stack = " + !!b.stack + ";", "part = \"base\";  // base, tray, or assembled",
      "lower_height = " + (b.stack ? Math.round(lowerH(b)) : 0) + ";", "split = \"" + b.split + "\";",
      "tray_div_w = " + b.trayDivW + ";", "tray_div_n = " + b.trayDivN + ";",
      "div_w = " + b.divW + ";", "div_n = " + b.divN + ";", "divider_height_pct = " + b.divPct + ";",
      "feet = \"" + (b.feet === "edge" ? "perimeter" : b.feet) + "\";",
      "label = \"\";", "label_wall = \"" + (labelFace(b).p === 0 ? "W" : "N") + (labelFace(b).sign > 0 ? "+" : "-") + "\";",
      "labels = " + scadLabels(b, b.labels, b.divW, b.divN) + ";  // rows from the label wall inward, columns along it" +
        (b.stack ? "  trays: " + trays(b).map(function (t, k) { return scadLabels(b, (b.trayLabels || [])[k], b.trayDivW, b.trayDivN); }).join(" ") + " (use for part = \"tray\")" : ""),
      "label_plate = " + !!b.labelPlate + ";", "label_depth = " + S.labelDepth + ";", "label_face = " + S.labelFace + ";",
      "pitch_w = " + S.pitchW + ";", "pitch_n = " + S.pitchN + ";", "height_M = " + S.hM + ";", "height_L = " + S.hL + ";",
      "clearance = " + S.clearance + ";", "wall = " + S.wall + ";", "floor_t = " + S.floorT + ";",
      "corner_r = " + S.cornerR + ";", "draft_deg = " + S.draft + ";", "foot_d = " + S.footD + ";", "foot_h = " + S.footH + ";",
      "plug_depth = " + S.plugDepth + ";", "plug_clearance = " + S.plugClear + ";"
    ].join("\n");
  }
  // the zip of every bin in the case, with layout.txt
  function allBinsFiles() {
    var gs = groups(S.bins), files = stlFiles(gs);
    files.push({ name: "layout.txt", data: layoutText(S.bins) });
    return { name: "storehouse-" + S.caseType + "-layout-" + S.bins.length + "-bins.zip", files: files, groups: gs };
  }
  // the zip of one bin: its STL, or its base and trays
  function oneBinFiles(b) { return { name: "storehouse-" + fileStem(b) + ".zip", files: stlFiles(groups([b])) }; }
  // four small prints to settle the stacking plug clearance
  function fitTestFiles() {
    var base = Object.assign({ id: 0, zone: "left", c: 0, r: 0, w: 1, n: 1 }, BIN_OPTS, { stack: true, lowerH: 15 });
    var t = trays(base)[0], files = [{ name: "fit-test-base-1x1-15mm.stl", data: toSTL(buildBin(base), "fit test base") }];
    var steps = [-0.15, 0, 0.15].map(function (d, i) { return { c: Math.max(0, Math.round((S.plugClear + d) * 100) / 100), h: 8 + 2 * i }; });
    steps.forEach(function (st) {
      st.total = st.h + S.plugDepth;
      files.push({ name: "fit-test-tray-clear" + st.c.toFixed(2) + "-" + st.total + "mm-tall.stl", data: toSTL(buildTray(base, t, st.total, st.c), "fit test tray " + st.c) });
    });
    files.push({ name: "README.txt", data: [
      "Storehouse stacking fit test", "",
      "Print the base and all three trays, open side up, no supports.", "",
      "Trays are told apart by overall height:",
      steps.map(function (st) { return "  " + st.total + " mm tall: " + st.c.toFixed(2) + " mm plug clearance per side"; }).join("\n"), "",
      "Drop each tray onto the base. Pick the one that seats with light friction and lifts out without the base coming with it.",
      "Enter its clearance under Fit and print > Stack plug clearance.", "",
      "The base is also an M-1x1 footprint, so you can check it in a handle pocket of the Medium case to test bin clearance."
    ].join("\n") });
    return { name: "storehouse-stacking-fit-test.zip", files: files };
  }
  return { codeOf: codeOf, fileStem: fileStem, trayStem: trayStem, labelStem: labelStem, partsOf: partsOf, describe: describe, groups: groups, stlName: stlName, stlFiles: stlFiles,
           layoutText: layoutText, scadLabels: scadLabels, scadText: scadText, allBinsFiles: allBinsFiles, oneBinFiles: oneBinFiles, fitTestFiles: fitTestFiles };
}

export { createExport, toSTL, crc32, zip, stlName };
