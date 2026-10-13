// Meshes for bins, trays, dividers, ribs, feet, and label shelves, as triangle lists ready for STL.
// createGeometry(S) binds the builders to a settings object (fit settings plus caseType); everything else is pure.
import { TRAY_GAP, DIVIDER_T, FOOT_INSET } from "./state.js";
import { LABEL, FONT, splitOf, labelUnits, labelAdvance, cleanLabel, gridShape, cellToLocal, labelFace, mapTexts } from "./bins.js";

// ---------------------------------------------------------------- mesh primitives
function flatten(parts) { var all = []; parts.forEach(function (q) { Array.prototype.push.apply(all, q); }); return all; }
// Trig that gives the same bits in every JavaScript engine. Engines differ in the last bit of Math.sin and friends,
// which shows up in exported STL bytes and would make golden tests engine-dependent. Reduce to [-pi/4, pi/4], then a
// short series in plain arithmetic, which IEEE 754 rounds identically everywhere. Accurate to about 1e-14.
function sincos(a) {
  var k = Math.round(a / (Math.PI / 2)), r = a - k * (Math.PI / 2), r2 = r * r;
  var s = r * (1 - r2 / 6 * (1 - r2 / 20 * (1 - r2 / 42 * (1 - r2 / 72 * (1 - r2 / 110 * (1 - r2 / 156 * (1 - r2 / 210)))))));
  var c = 1 - r2 / 2 * (1 - r2 / 12 * (1 - r2 / 30 * (1 - r2 / 56 * (1 - r2 / 90 * (1 - r2 / 132 * (1 - r2 / 182))))));
  switch (((k % 4) + 4) % 4) { case 0: return [c, s]; case 1: return [-s, c]; case 2: return [-c, -s]; default: return [s, -c]; }
}
function cosz(a) { return sincos(a)[0]; }
function sinz(a) { return sincos(a)[1]; }
function tanDeg(deg) { var sc = sincos(deg * Math.PI / 180); return sc[1] / sc[0]; }
function hyp(a, b) { return Math.sqrt(a * a + b * b); }
function ring(w, h, r, z, seg) {
  r = Math.max(0.3, Math.min(r, w / 2 - 0.05, h / 2 - 0.05));
  var pts = [], cx = w / 2 - r, cy = h / 2 - r;
  [[cx, -cy, -90], [cx, cy, 0], [-cx, cy, 90], [-cx, -cy, 180]].forEach(function (cr) {
    for (var i = 0; i <= seg; i++) { var a = (cr[2] + 90 * i / seg) * Math.PI / 180; pts.push([cr[0] + r * cosz(a), cr[1] + r * sinz(a), z]); }
  });
  return pts;
}
function strip(tris, a, b) { var n = a.length; for (var i = 0; i < n; i++) { var j = (i + 1) % n; tris.push([a[i], a[j], b[j]], [a[i], b[j], b[i]]); } }
function capFace(tris, p, up) {
  var c = [0, 0, 0]; p.forEach(function (q) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; });
  c = c.map(function (v) { return v / p.length; });
  for (var i = 0; i < p.length; i++) { var j = (i + 1) % p.length; tris.push(up ? [c, p[i], p[j]] : [c, p[j], p[i]]); }
}
function signedVol(tris) {
  var v = 0;
  tris.forEach(function (t) { var a = t[0], b = t[1], c = t[2]; v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); });
  return v / 6;
}
function solid(tris) { if (signedVol(tris) < 0) tris.forEach(function (t) { var s = t[1]; t[1] = t[2]; t[2] = s; }); return tris; }
function hexa(v) {
  var F = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  return solid(F.map(function (f) { return [v[f[0]], v[f[1]], v[f[2]]]; }));
}
function cylinder(x, y, z0, z1, d, seg) {
  var t = [], r = d / 2, bot = [], top = [];
  for (var i = 0; i < seg; i++) { var a = 2 * Math.PI * i / seg; bot.push([x + r * cosz(a), y + r * sinz(a), z0]); top.push([x + r * cosz(a), y + r * sinz(a), z1]); }
  strip(t, bot, top); capFace(t, top, true); capFace(t, bot, false);
  return solid(t);
}

// ---------------------------------------------------------------- labels
// A stroke font for raised letters. Each glyph is a list of polylines in a box 0.7 wide and 1 tall (cap height = 1).
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function prism6(v) { // triangular prism: v[0..2] one end, v[3..5] the other end in the same order
  var F = [[0,1,2],[3,5,4],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]];
  return solid(F.map(function (f) { return [v[f[0]], v[f[1]], v[f[2]]]; }));
}
// Which inner wall carries the label: p = axis the wall is perpendicular to (0 = x/W, 1 = y/N), sign = which end.
// The viewer stands at the handle strip. In the main block W runs away from the viewer; in the handle pockets N does.
function labelLetters(parts, text, cap, o, hv, qv, nv) {
  var hw = LABEL.stroke / 2, n0 = -0.3, n1 = LABEL.raise; // letters start inside the shelf so they fuse with it
  function P(hh, qq, nn) { return [o[0] + hv[0] * hh + qv[0] * qq + nv[0] * nn, o[1] + hv[1] * hh + qv[1] * qq + nv[1] * nn, o[2] + hv[2] * hh + qv[2] * qq + nv[2] * nn]; }
  var x = -labelUnits(text) * cap / 2, y = -cap / 2;
  for (var i = 0; i < text.length; i++) {
    var g = FONT[text[i]];
    if (g) g.forEach(function (poly) {
      for (var k = 0; k + 1 < poly.length; k++) { // each stroke is a box with square ends so joints close up
        var x1 = x + poly[k][0] * cap, y1 = y + poly[k][1] * cap, x2 = x + poly[k + 1][0] * cap, y2 = y + poly[k + 1][1] * cap;
        var dx = x2 - x1, dy = y2 - y1, l = hyp(dx, dy) || 1, ex = dx / l * hw, ey = dy / l * hw, px = -dy / l * hw, py = dx / l * hw;
        var c = [[x1 - ex - px, y1 - ey - py], [x2 + ex - px, y2 + ey - py], [x2 + ex + px, y2 + ey + py], [x1 - ex + px, y1 - ey + py]];
        parts.push(hexa(c.map(function (q) { return P(q[0], q[1], n0); }).concat(c.map(function (q) { return P(q[0], q[1], n1); }))));
      }
    });
    x += labelAdvance(text[i]) * cap;
  }
}


// ---------------------------------------------------------------- builders bound to the settings
function createGeometry(S) {
  function caseH() { return S.caseType === "L" ? S.hL : S.hM; }
  function caseName() { return S.caseType === "L" ? "Large" : "Medium"; }
  function dims(b) {
    var bx = b.w * S.pitchW - 2 * S.clearance, by = b.n * S.pitchN - 2 * S.clearance;
    var full = caseH();
    var h = b.stack ? lowerH(b) : b.ht === "half" ? full / 2 : b.ht === "custom" ? Math.min(b.customH, full) : full;
    var zb = b.feet !== "none" ? S.footH : 0, bodyH = h - zb;
    return { bx: bx, by: by, h: h, full: full, zb: zb, zt: h, bodyH: bodyH, ins: bodyH * tanDeg(S.draft), zf: zb + S.floorT };
  }
  function lowerH(b) { var full = caseH(), v = b.lowerH > 0 ? b.lowerH : full / 2; return Math.max(15, Math.min(full - 15, v)); }
  function trayH(b) { return caseH() - lowerH(b) + S.plugDepth; }
  function trays(b) { // footprints of the top tray(s), in the base bin's local coordinates
    var D = dims(b), k = splitOf(b.split), kx = k.kx, ky = k.ky;
    var tx = (D.bx - (kx - 1) * TRAY_GAP) / kx, ty = (D.by - (ky - 1) * TRAY_GAP) / ky, out = [];
    for (var i = 0; i < kx; i++) for (var j = 0; j < ky; j++)
      out.push({ bx: tx, by: ty, cx: -D.bx / 2 + tx / 2 + i * (tx + TRAY_GAP), cy: -D.by / 2 + ty / 2 + j * (ty + TRAY_GAP) });
    return out;
  }
  // Inner outline of a tray at height z: straight from the floor ring up to the rim ring.
  function trayInner(t, H, e, dr) {
    var i0x = t.bx - 2 * e - 2 * dr - 2 * S.wall, i0y = t.by - 2 * e - 2 * dr - 2 * S.wall, i1x = t.bx - 2 * S.wall, i1y = t.by - 2 * S.wall;
    return function (z) { var k = (z - S.floorT) / (H - S.floorT); return { x: i0x + (i1x - i0x) * k, y: i0y + (i1y - i0y) * k }; };
  }
  function buildTray(b, t, hOverride, clearOverride, labels) {
    // Prints right side up. Plug (sits inside the bin below) -> 45 deg chamfer -> straight body.
    var H = hOverride || trayH(b), plugClear = clearOverride != null ? clearOverride : S.plugClear;
    var e = S.wall + plugClear, seg = 8, r = S.cornerR, dr = S.plugDepth * tanDeg(S.draft);
    var px = t.bx - 2 * e, py = t.by - 2 * e, sh = [];
    var P0 = ring(px - 2 * dr, py - 2 * dr, r - e, 0, seg), P1 = ring(px, py, r - e, S.plugDepth, seg);
    var B0 = ring(t.bx, t.by, r, S.plugDepth + e, seg), B1 = ring(t.bx, t.by, r, H, seg);
    var I1 = ring(t.bx - 2 * S.wall, t.by - 2 * S.wall, r - S.wall, H, seg);
    var I0 = ring(px - 2 * dr - 2 * S.wall, py - 2 * dr - 2 * S.wall, r - e - S.wall, S.floorT, seg);
    strip(sh, P0, P1); strip(sh, P1, B0); strip(sh, B0, B1); strip(sh, B1, I1); strip(sh, I1, I0); capFace(sh, I0, true); capFace(sh, P0, false);
    var parts = [solid(sh)];
    var inner = trayInner(t, H, e, dr), z0 = S.floorT - 0.05;
    var labs = labelShelves(parts, b, { nW: b.trayDivW, nN: b.trayDivN, labels: labels || {}, inner: inner, zTop: H, zDivTop: H, zFloor: S.floorT });
    dividerWalls(parts, b.trayDivW, b.trayDivN, inner, z0, H, labs);
    return flatten(parts);
  }
  // Divider walls: nW across W (perpendicular to x) and nN across N, from zlo to zhi. inner(z) gives the inner outline at z.
  function dividerWalls(parts, nW, nN, inner, zlo, zhi, lab) {
    for (var i = 1; i < nW; i++) spanBox(parts, inner, 0, i / nW - 0.5, DIVIDER_T, zlo, zhi, lab);
    for (var j = 1; j < nN; j++) spanBox(parts, inner, 1, j / nN - 0.5, DIVIDER_T, zlo, zhi, lab);
  }
  // A box between two opposite walls: perpendicular to axis p (0 = x, 1 = y) at fraction f of the inner width, t thick.
  // It runs a little into the walls so the slicer unions it with the shell. Where it meets the label wall (lab), it stops
  // short of the label face at full height and only continues to the wall underneath the shelf.
  function spanBox(parts, inner, p, f, t, zlo, zhi, labs) {
    var K = ["x", "y"], s = 1 - p, ov = S.wall * 0.7, lab = null;
    if (labs && labs.length) { // does this box run into a label shelf on the wall it meets?
      var pos0 = f * inner(zlo)[K[p]];
      labs.forEach(function (L) { if (L.p === s && zhi > L.zUnder && pos0 > L.sLo && pos0 < L.sHi) lab = L; });
    }
    function ext(z) { return inner(z)[K[s]] / 2 + ov; }
    function corners(z, lo, hi) {
      var pos = f * inner(z)[K[p]], a = pos - t / 2, c = pos + t / 2;
      return p === 0 ? [[a, lo, z], [c, lo, z], [c, hi, z], [a, hi, z]] : [[lo, a, z], [hi, a, z], [hi, c, z], [lo, c, z]];
    }
    function box(zA, eA, zB, eB) { parts.push(hexa(corners(zA, eA[0], eA[1]).concat(corners(zB, eB[0], eB[1])))); }
    if (lab) {
      var edge = lab.uIn - 0.5, sg = lab.sign, zs = Math.min(zhi, lab.zUnder + 0.5);
      function ends(z, upper) {
        var e = ext(z);
        if (upper) return sg > 0 ? [-e, edge] : [-edge, e];
        return sg > 0 ? [edge - 0.5, e] : [-e, -edge + 0.5];
      }
      box(zlo, ends(zlo, true), zhi, ends(zhi, true));
      box(zlo, ends(zlo, false), zs, ends(zs, false));
    } else {
      box(zlo, [-ext(zlo), ext(zlo)], zhi, [-ext(zhi), ext(zhi)]);
    }
  }
  function outerAt(D, z) { var k = 1 - (z - D.zb) / D.bodyH; return { x: D.bx - 2 * D.ins * k, y: D.by - 2 * D.ins * k }; }
  function innerAt(D, z) { var o = outerAt(D, z); return { x: o.x - 2 * S.wall, y: o.y - 2 * S.wall }; }
  function binLabelTop(D, b) { return b.stack ? D.zt - S.plugDepth - 1 : D.zt; } // the shelf sits under the tray plug on a stacked bin
  // Where the shelf and letters go for one part, or null without a label. inner(z) is the inner outline at height z,
  // zTop is where the shelf meets the wall. Short parts get a smaller shelf; long labels get smaller letters, then fewer.
  // ---- compartments. Labels live in a map keyed "row,col" as seen from the front: row 0 is nearest, col 0 is leftmost.
  function partLabelMaps(b) { return [b.labels || {}].concat(b.stack ? trays(b).map(function (t, k) { return (b.trayLabels || [])[k] || {}; }) : []); }
  function hasShelf(b) { return !!(b.labelPlate || partLabelMaps(b).some(function (m) { return mapTexts(m).length; })); }
  function dividerTop(b, D) { var z1 = D.zf + (D.zt - D.zf) * b.divPct / 100; return b.stack ? Math.min(z1, D.zt - S.plugDepth - 1) : z1; } // leave room for the tray plug
  // One shelf per compartment that has text (or a blank plate): on the label wall for the row touching it, otherwise on
  // the near face of the divider between the compartment and the next one toward the wall.
  // P describes a part: nW, nN, labels, inner(z), zTop (shelf top at the wall), zDivTop (top of its dividers), zFloor.
  function shelfSegments(b, P) {
    var f = labelFace(b), p = f.p, sg = f.sign, s = 1 - p, K = ["x", "y"];
    var np = p === 0 ? P.nW : P.nN, ns = p === 0 ? P.nN : P.nW, t = DIVIDER_T, ov = S.wall * 0.7;
    var corner = Math.max(S.cornerR - S.wall, 0.5) + 0.5, sh = gridShape(b, P.nW, P.nN), segs = [];
    function cellSegment(r, c) {
      var key = r + "," + c, text = cleanLabel((P.labels || {})[key]);
      if (!text && !b.labelPlate) return;
      var L = cellToLocal(b, P.nW, P.nN, r, c), ip = p === 0 ? L.ix : L.iy, is = p === 0 ? L.iy : L.ix;
      var atWall = sg > 0 ? ip === np - 1 : ip === 0, m = sg > 0 ? ip + 1 : ip; // m: the divider on the wall side of this compartment
      function wp(z) { return P.inner(z)[K[p]]; }
      function ws(z) { return P.inner(z)[K[s]]; }
      function div(z) { return sg * (-wp(z) / 2 + m * wp(z) / np); } // that divider's center, as a distance toward the wall
      // distances toward the label wall ("u"): where the shelf's back and its face meet the boundary
      function uBack(z) { return atWall ? wp(z) / 2 + ov : div(z) + t / 2 - 0.2; }
      function uFace(z) { return atWall ? wp(z) / 2 : div(z) - t / 2; }
      function depth(z) { return wp(z) / np - (atWall ? t / 2 : t); } // how deep the compartment is, toward the wall
      function sRange(z) { // the compartment's extent along the wall, clear of dividers and corners
        var w = ws(z);
        return [-w / 2 + is * w / ns + (is === 0 ? corner : t / 2 + 0.5), -w / 2 + (is + 1) * w / ns - (is === ns - 1 ? corner : t / 2 + 0.5)];
      }
      segs.push({ key: key, text: text, p: p, s: s, sign: sg, atWall: atWall, uBack: uBack, uFace: uFace, depth: depth, sRange: sRange, zTop: atWall ? P.zTop : Math.min(P.zTop, P.zDivTop) });
    }
    for (var r = 0; r < sh.rows; r++) for (var c = 0; c < sh.cols; c++) cellSegment(r, c);
    return segs;
  }
  // Shelf and letter sizes for one segment, or noRoom. Short parts get a smaller shelf; long text gets smaller letters, then fewer.
  function labelFitSeg(seg, zFloor) {
    var sc = Math.min(1, (seg.zTop - zFloor - 0.5) / (S.labelFace + S.labelDepth));
    if (sc < 0.5) return { seg: seg, text: seg.text, noRoom: true };
    var FH = S.labelFace * sc, X = S.labelDepth * sc, zMid = seg.zTop - FH, zUnder = zMid - X;
    var a = seg.sRange(zUnder), c = seg.sRange(seg.zTop), lo = Math.max(a[0], c[0]), hi = Math.min(a[1], c[1]), L = hi - lo;
    if (L < 8 || seg.depth(zMid) < X + 4) return { seg: seg, text: seg.text, noRoom: true };
    var capMax = Math.min(LABEL.capMax, hyp(FH, X) - 3), shown = seg.text, cap = capMax;
    if (shown) {
      cap = Math.min(capMax, (L - 3) / labelUnits(shown));
      while (cap < LABEL.capMin && shown.length > 1) { shown = shown.slice(0, -1).trim(); cap = Math.min(capMax, (L - 3) / labelUnits(shown)); }
      if (cap < LABEL.capMin) return { seg: seg, text: seg.text, noRoom: true };
    }
    return { seg: seg, text: seg.text, shown: shown, dropped: seg.text.length - shown.length, cap: cap, zMid: zMid, zUnder: zUnder, sLo: lo, sHi: hi, uIn: seg.uFace(zMid) - X };
  }
  // The shelf: a triangular prism fused to its boundary just below the top. Its face slopes up toward the viewer and
  // carries the letters; its underside runs back at 45 degrees so it prints without supports. Returns clip info for spanBox.
  function labelShelf(parts, F) {
    var seg = F.seg, p = seg.p, sg = seg.sign;
    function pt(u, v, z) { var cp = sg * u; return p === 0 ? [cp, v, z] : [v, cp, z]; }
    var uTop = seg.uBack(seg.zTop), uUnder = seg.uBack(F.zUnder);
    parts.push(prism6([pt(uTop, F.sLo, seg.zTop), pt(F.uIn, F.sLo, F.zMid), pt(uUnder, F.sLo, F.zUnder), pt(uTop, F.sHi, seg.zTop), pt(F.uIn, F.sHi, F.zMid), pt(uUnder, F.sHi, F.zUnder)]));
    if (F.shown) {
      // a frame on the face: origin at its center, hv = reading direction along the wall, qv = up the slope, nv = out of the face
      var uFace = seg.uFace(seg.zTop), du = sg * (uFace - F.uIn), dz = seg.zTop - F.zMid, len = hyp(du, dz);
      var ep = p === 0 ? [1, 0, 0] : [0, 1, 0], hv = p === 0 ? [0, -sg, 0] : [sg, 0, 0];
      var qv = [ep[0] * du / len, ep[1] * du / len, dz / len], nv = cross(hv, qv);
      labelLetters(parts, F.shown, F.cap, pt((uFace + F.uIn) / 2, (F.sLo + F.sHi) / 2, (seg.zTop + F.zMid) / 2), hv, qv, nv);
    }
    return { p: p, sign: sg, atWall: seg.atWall, uIn: F.uIn, zUnder: F.zUnder, sLo: F.sLo, sHi: F.sHi };
  }
  // Every shelf of a part. Returns the wall shelves, which spanBox keeps ribs off of.
  function labelShelves(parts, b, P) {
    var labs = [];
    shelfSegments(b, P).forEach(function (seg) { var F = labelFitSeg(seg, P.zFloor); if (!F.noRoom) { var c = labelShelf(parts, F); if (c.atWall) labs.push(c); } });
    return labs;
  }
  function buildBin(b) {
    var D = dims(b), seg = 8, parts = [], r = S.cornerR;
    var ob = outerAt(D, D.zb), it = innerAt(D, D.zt), ifl = innerAt(D, D.zf);
    var sh = [];
    var O0 = ring(ob.x, ob.y, r - D.ins, D.zb, seg), O1 = ring(D.bx, D.by, r, D.zt, seg);
    var I1 = ring(it.x, it.y, r - S.wall, D.zt, seg), I0 = ring(ifl.x, ifl.y, r - S.wall - D.ins, D.zf, seg);
    strip(sh, O0, O1); strip(sh, O1, I1); strip(sh, I1, I0); capFace(sh, I0, true); capFace(sh, O0, false);
    parts.push(solid(sh));

    var z0 = D.zf - 0.05, z1 = dividerTop(b, D), innerB = function (z) { return innerAt(D, z); };
    var labs = labelShelves(parts, b, { nW: b.divW, nN: b.divN, labels: b.labels, inner: innerB, zTop: binLabelTop(D, b), zDivTop: z1, zFloor: D.zf });
    dividerWalls(parts, b.divW, b.divN, innerB, z0, z1, labs);
    if (b.stack && b.split !== "1") {
      // support ribs under split lines, up to rim height, sized to sit between neighboring tray plugs
      var rt = 2 * S.wall + TRAY_GAP, sp = splitOf(b.split);
      if (sp.kx === 2) spanBox(parts, innerB, 0, 0, rt, D.zf - 0.05, D.zt, labs);
      if (sp.ky === 2) spanBox(parts, innerB, 1, 0, rt, D.zf - 0.05, D.zt, labs);
    }
    if (b.feet !== "none") {
      var bxH = ob.x / 2 - FOOT_INSET, byH = ob.y / 2 - FOOT_INSET, pts = [];
      if (b.feet === "corners") pts = [[-bxH, -byH], [bxH, -byH], [bxH, byH], [-bxH, byH]];
      else {
        var xs = [-bxH], ys = [-byH];
        for (var k = 1; k < b.w; k++) xs.push(-ob.x / 2 + k * ob.x / b.w);
        for (var m = 1; m < b.n; m++) ys.push(-ob.y / 2 + m * ob.y / b.n);
        xs.push(bxH); ys.push(byH);
        xs.forEach(function (x) { pts.push([x, -byH], [x, byH]); });
        ys.slice(1, -1).forEach(function (y) { pts.push([-bxH, y], [bxH, y]); });
      }
      pts.forEach(function (p) { parts.push(cylinder(p[0], p[1], 0, D.zb + 0.4, S.footD, 24)); });
    }
    return flatten(parts);
  }

  return { caseH: caseH, caseName: caseName, dims: dims, lowerH: lowerH, trayH: trayH, trays: trays, trayInner: trayInner, buildTray: buildTray, buildBin: buildBin,
           outerAt: outerAt, innerAt: innerAt, binLabelTop: binLabelTop, dividerTop: dividerTop, shelfSegments: shelfSegments, labelFitSeg: labelFitSeg,
           hasShelf: hasShelf, partLabelMaps: partLabelMaps };
}

export { createGeometry, flatten, ring, strip, capFace, signedVol, solid, hexa, prism6, cylinder, cross, labelLetters, sincos, tanDeg };
