// The page: state, the floor map, the panel, the 3D view, downloads. Everything that touches the DOM lives here.
import * as layout from "./layout.js";
import { MAP, MAIN_H, STRIP_H, FLOOR_W, ZONE_W, zones, TOTAL_CELLS, PRESETS, span, sizeFromSpan, binRect } from "./layout.js";
import { MEASURED, BIN_OPTS, STEP_LIMITS, ADV_KEYS, ADV_LIMITS, makeBin, createState, restoreState } from "./state.js";
import { LABEL, f1, splitOf, cleanLabel, gridShape, trayNames } from "./bins.js";
import { createGeometry, tanDeg } from "./geometry.js";
import { createExport, zip } from "./export.js";

(function () {
  "use strict";

  // ================================================================ state
  var nextId = 1;
  function newBin(zone, c, r, w, n, opts) { return makeBin(nextId++, zone, c, r, w, n, opts); }
  var S = createState();
  try { nextId = restoreState(S, JSON.parse(localStorage.getItem("sbb-state-v4") || "null")); } catch (e) {}
  function persist() { try { localStorage.setItem("sbb-state-v4", JSON.stringify(S)); } catch (e) {} }

  var $ = function (id) { return document.getElementById(id); };
  function sel() { for (var i = 0; i < S.bins.length; i++) if (S.bins[i].id === S.selId) return S.bins[i]; return null; }
  function idx(b) { return S.bins.indexOf(b) + 1; }
  var status = $("status"), undoBtn = $("undo");
  var undo = null; // one step back from the last delete, empty case, or stock layout
  function say(t) { status.textContent = t; undo = null; undoBtn.hidden = true; }
  function sayUndo(t, u) { status.textContent = t; undo = u; undoBtn.hidden = false; }
  function doUndo() {
    var u = undo; if (!u) return;
    if (u.bin) { // put the deleted bin back where it was, or the nearest free spot
      var b = u.bin;
      if (!canPlace(b.zone, b.c, b.r, b.w, b.n)) {
        var spot = findSpot(b.w, b.n);
        if (!spot) { say("No room to put bin " + codeOf(b) + " back. Move or delete a bin first."); update(); return; }
        b.zone = spot.zone; b.c = spot.c; b.r = spot.r;
      }
      S.bins.splice(Math.min(u.index, S.bins.length), 0, b); S.selId = b.id;
    } else { S.bins = u.bins; S.selId = u.selId; }
    say(u.undone); update();
  }
  undoBtn.addEventListener("click", doUndo);

  // layout helpers bound to the bins in the case
  function canPlace(zone, c, r, w, n, exceptId) { return layout.canPlace(S.bins, zone, c, r, w, n, exceptId); }
  function findSpot(w, n, exceptId) { return layout.findSpot(S.bins, w, n, exceptId); }
  function binAt(zone, c, r) { return layout.binAt(S.bins, zone, c, r); }
  function usedCells() { return layout.usedCells(S.bins); }

  // geometry and export bound to the state
  var geo = createGeometry(S), ex = createExport(S, geo);
  var dims = geo.dims, caseH = geo.caseH, caseName = geo.caseName, lowerH = geo.lowerH, trayH = geo.trayH, trays = geo.trays, outerAt = geo.outerAt, innerAt = geo.innerAt;
  var binLabelTop = geo.binLabelTop, dividerTop = geo.dividerTop, trayInner = geo.trayInner, shelfSegments = geo.shelfSegments, labelFitSeg = geo.labelFitSeg, hasShelf = geo.hasShelf, buildBin = geo.buildBin;
  var codeOf = ex.codeOf, fileStem = ex.fileStem, partsOf = ex.partsOf, describe = ex.describe, groups = ex.groups, scadText = ex.scadText;

  // ================================================================ floor map
  var svgNS = "http://www.w3.org/2000/svg", floor = $("floor"), binG, cellEls = [];
  function el(tag, attrs, parent) { var e = document.createElementNS(svgNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function drawFloor() {
    floor.innerHTML = ""; cellEls = [];
    el("rect", { x: -8, y: -8, width: FLOOR_W + 16, height: MAIN_H + STRIP_H + 16, rx: 6, style: "fill:var(--case)" }, floor);
    var hx = ZONE_W, hw = FLOOR_W - 2 * ZONE_W;
    var defs = el("defs", {}, floor);
    var pat = el("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 6, height: 6, style: "fill:var(--case)" }, pat);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, style: "stroke:var(--case-line)", "stroke-width": 2 }, pat);
    el("rect", { x: hx + 4, y: MAIN_H + 4, width: hw - 8, height: STRIP_H - 4, rx: 4, fill: "url(#hatch)", style: "stroke:var(--case-line)" }, floor);
    el("text", { x: hx + hw / 2, y: MAIN_H + STRIP_H / 2 + 4, "text-anchor": "middle", class: "handle-label" }, floor).textContent = "HANDLE";
    Object.keys(zones).forEach(function (zk) {
      var z = zones[zk];
      for (var r = 0; r < z.rows; r++) for (var c = 0; c < z.cols; c++)
        cellEls.push(el("rect", { x: z.x0 + c * z.cw, y: z.y0 + r * z.rh, width: z.cw, height: z.rh, class: "cell", "data-zone": zk, "data-c": c, "data-r": r }, floor));
    });
    var pg = el("g", {}, floor);
    for (var r2 = 0; r2 <= MAP.mainRows; r2++) for (var c2 = 0; c2 <= MAP.mainCols; c2++) el("circle", { cx: c2 * MAP.cw, cy: r2 * MAP.rh, r: 10, class: "pocket" }, pg);
    ["left", "right"].forEach(function (zk) {
      var z = zones[zk];
      for (var r3 = 1; r3 <= z.rows; r3++) for (var c3 = 0; c3 <= z.cols; c3++) el("circle", { cx: z.x0 + c3 * z.cw, cy: z.y0 + r3 * z.rh, r: 10, class: "pocket" }, pg);
    });
    el("text", { x: FLOOR_W / 2, y: -15, "text-anchor": "middle", class: "axis" }, floor).textContent = "N cells · 40 mm";
    el("text", { x: -15, y: MAIN_H / 2, "text-anchor": "middle", class: "axis", transform: "rotate(-90 -15 " + MAIN_H / 2 + ")" }, floor).textContent = "W cells · 54 mm";
    binG = el("g", {}, floor);
  }
  function drawBins() {
    binG.innerHTML = "";
    cellEls.forEach(function (ce) { ce.classList.toggle("taken", !!binAt(ce.getAttribute("data-zone"), +ce.getAttribute("data-c"), +ce.getAttribute("data-r"))); });
    var on = sel();
    S.bins.forEach(function (b) { if (b !== on) drawOne(b, false); });
    if (on) drawOne(on, true);
  }
  function drawOne(b, isOn) {
    var R = binRect(b);
    el("rect", { x: R.x + 2.5, y: R.y + 2.5, width: R.w - 5, height: R.h - 5, rx: 3, class: "bin" + (isOn ? " on" : "") }, binG);
    if (b.stack) {
      el("rect", { x: R.x + 7, y: R.y + 7, width: R.w - 14, height: R.h - 14, rx: 2, class: "stack-mark" }, binG);
      var k = splitOf(b.split), horiz = b.zone === "main"; // in the main block, W runs down the map and N runs across
      var vx = horiz ? k.ky : k.kx, vy = horiz ? k.kx : k.ky;
      for (var i = 1; i < vx; i++) el("line", { x1: R.x + R.w * i / vx, y1: R.y + 7, x2: R.x + R.w * i / vx, y2: R.y + R.h - 7, class: "stack-mark" }, binG);
      for (var j = 1; j < vy; j++) el("line", { x1: R.x + 7, y1: R.y + R.h * j / vy, x2: R.x + R.w - 7, y2: R.y + R.h * j / vy, class: "stack-mark" }, binG);
    }
    el("text", { x: R.x + R.w / 2, y: R.y + R.h / 2 + 6, "text-anchor": "middle", class: "bin-num" }, binG).textContent = idx(b);
  }

  // drawing and moving
  var drag = null;
  function cellAt(evt) {
    var t = document.elementFromPoint(evt.clientX, evt.clientY);
    if (!t || !t.classList || !t.classList.contains("cell")) return null;
    return { zone: t.getAttribute("data-zone"), c: +t.getAttribute("data-c"), r: +t.getAttribute("data-r") };
  }
  floor.addEventListener("pointerdown", function (e) {
    var c = cellAt(e); if (!c) return;
    e.preventDefault();
    var hit = binAt(c.zone, c.c, c.r);
    if (hit) {
      S.selId = hit.id;
      drag = { mode: "move", id: hit.id, offC: c.c - hit.c, offR: c.r - hit.r, zone: hit.zone };
      update();
    } else {
      var base = sel(), opts = {};
      if (base) ["ht", "customH", "feet"].forEach(function (k) { opts[k] = base[k]; });
      var nb = newBin(c.zone, c.c, c.r, 1, 1, opts);
      S.bins.push(nb); S.selId = nb.id;
      drag = { mode: "draw", id: nb.id, start: c };
      update();
    }
  });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var c = cellAt(e); if (!c) return;
    var b = sel(); if (!b || b.id !== drag.id) return;
    if (drag.mode === "draw") {
      if (c.zone !== drag.start.zone) return;
      var c0 = Math.min(c.c, drag.start.c), c1 = Math.max(c.c, drag.start.c), r0 = Math.min(c.r, drag.start.r), r1 = Math.max(c.r, drag.start.r);
      var sz = sizeFromSpan(c.zone, c1 - c0 + 1, r1 - r0 + 1);
      if ((b.c !== c0 || b.r !== r0 || b.w !== sz.w || b.n !== sz.n) && canPlace(c.zone, c0, r0, sz.w, sz.n, b.id)) {
        b.c = c0; b.r = r0; b.w = sz.w; b.n = sz.n; update(false);
      }
    } else {
      var offC = c.zone === drag.zone ? drag.offC : 0, offR = c.zone === drag.zone ? drag.offR : 0;
      var nc = c.c - offC, nr = c.r - offR;
      if ((b.zone !== c.zone || b.c !== nc || b.r !== nr) && canPlace(c.zone, nc, nr, b.w, b.n, b.id)) {
        b.zone = c.zone; b.c = nc; b.r = nr; update(false);
      }
    }
  });
  window.addEventListener("pointerup", function () { if (drag) { drag = null; update(); } });


  // ================================================================ downloads
  var downloadsP = (window.claude && window.claude.use) ? window.claude.use("downloads").catch(function () { return null; }) : Promise.resolve(null);
  function save(filename, blob, doneMsg) {
    say("Preparing " + filename + "…");
    downloadsP.then(function (dl) {
      if (!dl) { // plain browser (GitHub Pages, local file): normal download link
        try {
          var url = URL.createObjectURL(blob), a = document.createElement("a");
          a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          say(doneMsg);
        } catch (e) { say("Couldn't start the download in this browser."); }
        return;
      }
      return dl.save({ filename: filename, data: blob }).then(function () { say(doneMsg); }, function (err) {
        var c = err && err.code;
        say(c === "declined" ? "Download canceled." : c === "rate_limited" ? "A save prompt is already open. Finish that one first." : "Couldn't save the file here (" + (c || "error") + ").");
      });
    });
  }
  $("dlAll").addEventListener("click", function () {
    if (!S.bins.length) return;
    var z = ex.allBinsFiles();
    save(z.name, zip(z.files), "Saved " + z.name + ": " + z.groups.length + " STL file" + (z.groups.length > 1 ? "s" : "") + " for " + S.bins.length + " bins, plus layout.txt.");
  });
  $("fitTest").addEventListener("click", function () {
    var z = ex.fitTestFiles();
    save(z.name, zip(z.files), "Saved " + z.name + ": a base, three trays, and a README.");
  });
  $("dlOne").addEventListener("click", function () {
    var b = sel(); if (!b) return;
    var z = ex.oneBinFiles(b);
    save(z.name, zip(z.files), "Saved " + z.name + " with " + z.files.length + " STL file" + (z.files.length > 1 ? "s" : "") + ".");
  });

  // ================================================================ 3D view
  var three = null, geoCache = {};
  function initThree() {
    var stage = $("stage");
    function fail() {
      var d = document.createElement("div"); d.className = "err"; d.textContent = "3D preview couldn't load. Layout and downloads still work.";
      stage.appendChild(d);
    }
    if (!window.THREE || !THREE.OrbitControls) { fail(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { fail(); return; } // no WebGL context (headless, disabled GPU, old browser)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 4 / 3, 1, 6000);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = 40; controls.maxDistance = 1400; controls.maxPolarAngle = Math.PI / 2 - 0.04;
    renderer.domElement.addEventListener("dblclick", function () { resetView(); });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6450, 0.85));
    var key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(160, 300, 220); scene.add(key);
    var fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(-220, 90, -140); scene.add(fill);
    var world = new THREE.Group(); scene.add(world);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 16, 3, MAIN_H + STRIP_H + 16), new THREE.MeshStandardMaterial({ color: 0x232321, roughness: 0.8 }));
    plate.position.y = -1.6; scene.add(plate);
    var handle = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W - 2 * ZONE_W - 8, 14, STRIP_H - 6), new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: 0.7 }));
    handle.position.set(0, 7, MAIN_H / 2 + 1); scene.add(handle);
    var grid = new THREE.GridHelper(700, 35, 0x888888, 0x888888); grid.material.transparent = true; grid.material.opacity = 0.14; grid.position.y = -3.2; scene.add(grid);
    three = {
      renderer: renderer, scene: scene, camera: camera, controls: controls, world: world, plate: plate, handle: handle,
      matOn: new THREE.MeshStandardMaterial({ color: 0xF2B200, roughness: 0.55, flatShading: true }),
      matOff: new THREE.MeshStandardMaterial({ color: 0xC7A55A, roughness: 0.7, flatShading: true }),
      matTray: new THREE.MeshStandardMaterial({ color: 0xFFC933, roughness: 0.5, flatShading: true }),
      lineMat: new THREE.LineBasicMaterial({ color: 0x5a4300, transparent: true, opacity: 0.45 })
    };
    function resize() { var w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(stage); resize();
    (function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();
  }
  function geoFor(b) { return geoPart(fileStem(b), function () { return buildBin(b); }); }
  function geoPart(stem, make) {
    var k = JSON.stringify([stem, S.caseType, ADV_KEYS.map(function (q) { return S[q]; })]);
    if (!geoCache[k]) {
      var tris = make(), pos = new Float32Array(tris.length * 9), o = 0;
      tris.forEach(function (t) { for (var i = 0; i < 3; i++) { pos[o++] = t[i][0]; pos[o++] = t[i][1]; pos[o++] = t[i][2]; } });
      var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
      geoCache[k] = { mesh: g, edges: new THREE.EdgesGeometry(g, 35) };
    }
    return geoCache[k];
  }
  function binObject(b, mat) {
    var G = geoFor(b), inner = new THREE.Group();
    inner.rotation.x = -Math.PI / 2;
    inner.add(new THREE.Mesh(G.mesh, mat), new THREE.LineSegments(G.edges, three.lineMat));
    if (b.stack) {
      var tps = partsOf(b).slice(1), lift = S.liftTrays ? 30 : 0;
      trays(b).forEach(function (t, k) {
        var TG = geoPart(tps[k].stem, tps[k].make), tm = new THREE.Group();
        tm.add(new THREE.Mesh(TG.mesh, mat === three.matOn ? three.matTray : three.matOff), new THREE.LineSegments(TG.edges, three.lineMat));
        tm.position.set(t.cx, t.cy, lowerH(b) - S.plugDepth + lift);
        inner.add(tm);
      });
    }
    var outer = new THREE.Group(); outer.add(inner);
    return outer;
  }
  var lastFrame = "";
  function resetView() {
    if (three) { // drop any leftover drag momentum so the camera stays put
      three.controls.enableDamping = false; three.controls.update(); three.controls.enableDamping = true;
    }
    lastFrame = ""; show3D();
  }
  function show3D() {
    if (!three) return;
    while (three.world.children.length) three.world.remove(three.world.children[0]);
    if (Object.keys(geoCache).length > 120) { // the scene is empty here, so nothing still uses these buffers
      Object.keys(geoCache).forEach(function (k) { geoCache[k].mesh.dispose(); geoCache[k].edges.dispose(); });
      geoCache = {};
    }
    var on = sel(), caseView = S.view === "case";
    three.plate.visible = caseView; three.handle.visible = caseView;
    var frameKey;
    if (caseView) {
      S.bins.forEach(function (b) {
        var o = binObject(b, b === on ? three.matOn : three.matOff), R = binRect(b);
        o.position.set(R.x + R.w / 2 - FLOOR_W / 2, 0, R.y + R.h / 2 - (MAIN_H + STRIP_H) / 2);
        if (b.zone === "main") o.rotation.y = Math.PI / 2;
        three.world.add(o);
      });
      frameKey = "case|" + S.caseType;
    } else if (on) {
      var one = binObject(on, three.matOn); // turned the way it sits in the case, so the label wall faces the camera
      if (on.zone === "main") one.rotation.y = Math.PI / 2;
      three.world.add(one);
      frameKey = "bin|" + on.id + "|" + on.w + "x" + on.n + "|" + S.caseType + "|" + on.ht + "|" + on.stack;
    }
    if (frameKey && frameKey !== lastFrame) {
      lastFrame = frameKey;
      if (caseView) {
        var hh = caseH();
        three.camera.position.set(170, 330 + hh, 420);
        three.controls.target.set(0, hh * 0.3, 10);
      } else {
        var D = dims(on), hh2 = on.stack ? caseH() : D.h, sp = Math.max(D.bx, D.by, hh2), dist = sp * 2.4 + 40;
        three.camera.position.set(dist * 0.62, dist * 0.62, dist * 0.78);
        three.controls.target.set(0, hh2 * 0.4, 0);
      }
      three.controls.update();
    }
  }

  // ================================================================ UI
  var presetsFor = null; // case type the preset chips were built for
  function drawPresets() {
    if (presetsFor === S.caseType) return;
    presetsFor = S.caseType;
    var p = $("presets"); p.innerHTML = "";
    var l = document.createElement("span"); l.className = "lbl"; l.textContent = "Add"; p.appendChild(l);
    PRESETS[S.caseType].forEach(function (pr) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip";
      b.innerHTML = S.caseType + "-" + pr[0] + "x" + pr[1] + " <span>" + pr[2] + "</span>";
      b.addEventListener("click", function () {
        var spot = findSpot(pr[0], pr[1]);
        if (!spot) { say("No open spot for a " + pr[0] + "x" + pr[1] + ". Move or delete a bin first."); return; }
        var base = sel(), opts = {};
        if (base) ["ht", "customH", "feet"].forEach(function (k) { opts[k] = base[k]; });
        var nb = newBin(spot.zone, spot.c, spot.r, pr[0], pr[1], opts); S.bins.push(nb); S.selId = nb.id; say(""); update();
      });
      p.appendChild(b);
    });
  }
  function setPressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + attr) === val)); }); }

  function drawList() {
    var ol = $("binlist"); ol.innerHTML = "";
    S.bins.forEach(function (b) {
      var li = document.createElement("li"); li.tabIndex = 0; if (b.id === S.selId) li.className = "on";
      li.innerHTML = '<span class="num">' + idx(b) + '</span><span class="what">' + codeOf(b) + "<small>" + describe(b) + '</small></span><button type="button" class="del" aria-label="Delete bin ' + idx(b) + '">×</button>';
      li.addEventListener("click", function (e) {
        if (e.target.classList.contains("del")) { removeBin(b.id); return; }
        S.selId = b.id; update();
      });
      li.addEventListener("keydown", function (e) {
        if (e.target.classList.contains("del")) return; // let the button handle its own Enter/Space
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.selId = b.id; update(); }
      });
      ol.appendChild(li);
    });
    $("emptyNote").hidden = S.bins.length > 0;
  }
  function removeBin(id) {
    var i = S.bins.findIndex(function (b) { return b.id === id; }); if (i < 0) return;
    var gone = S.bins.splice(i, 1)[0], label = "bin " + (i + 1) + " (" + codeOf(gone) + ")";
    if (S.selId === id) S.selId = S.bins.length ? S.bins[Math.min(i, S.bins.length - 1)].id : null;
    sayUndo("Deleted " + label + ".", { bin: gone, index: i, undone: "Restored " + label + "." });
    update();
  }
  function snapshot(undone) { return { bins: S.bins, selId: S.selId, undone: undone }; }

  function updateHeader(b, D) {
    var code = $("code");
    code.textContent = b ? codeOf(b) : "No bin";
    code.classList.toggle("empty", !b);
    $("codeMeta").innerHTML = b ? "<span>bin <b>" + idx(b) + "</b> of " + S.bins.length + " · slot <b>" + b.w * S.pitchW + " × " + b.n * S.pitchN + "</b> mm</span><span>" +
      caseName() + " case · " + (b.stack ? "stacked <b>" + Math.round(D.h) + " + " + Math.round(trayH(b) - S.plugDepth) + "</b> mm" : "<b>" + f1(D.h) + "</b> mm tall") + "</span>" : "<span>Draw a bin on the floor grid.</span>";
  }
  function updateBinPanel(b, D) {
    $("binGroup").classList.toggle("disabled", !b);
    if (!b) { $("binWhich").textContent = ""; $("specs").innerHTML = ""; return; }
    $("binWhich").textContent = "#" + idx(b) + " · " + codeOf(b);
    $("w-out").textContent = b.w; $("n-out").textContent = b.n;
    setPressed("ht", b.ht); setPressed("feet", b.feet); setPressed("stack", b.stack ? "on" : "off"); setPressed("split", b.split);
    $("stackBox").hidden = !b.stack; $("heightBox").hidden = !!b.stack;
    $("divLabel").textContent = b.stack ? "Bottom bin dividers" : "Dividers";
    $("lowerH").min = 15; $("lowerH").max = caseH() - 15; $("lowerH").value = lowerH(b);
    $("lowerH-v").textContent = Math.round(lowerH(b)) + " mm bin + " + Math.round(trayH(b) - S.plugDepth) + " mm tray";
    $("trayDivW-out").textContent = b.trayDivW; $("trayDivN-out").textContent = b.trayDivN;
    $("customHField").hidden = b.ht !== "custom";
    $("customH").max = D.full; $("customH").value = Math.min(b.customH, D.full); $("customH-v").textContent = f1(Math.min(b.customH, D.full)) + " mm";
    $("divW-out").textContent = b.divW; $("divN-out").textContent = b.divN;
    $("divPct").value = b.divPct; $("divPct-v").textContent = b.divPct + "%";
    var allText = renderLabelGrids(b, D);
    $("labelPlate").checked = !!b.labelPlate; $("plateWrap").hidden = allText; // with text in every compartment the shelves are there anyway
    $("labelSideBox").hidden = !hasShelf(b); setPressed("side", b.labelSide);
    $("specs").innerHTML = specRows(b, D).map(function (s) { return '<div class="spec"><span>' + s[0] + "</span><b>" + s[1] + "</b></div>"; }).join("");
  }
  function fitNote(F, text) {
    if (F.noRoom) return "no room for a shelf here";
    if (!text) return "blank plate";
    return f1(F.cap) + " mm letters" + (F.dropped ? " · " + F.shown.length + " of " + text.length + " fit" : "");
  }
  // The parts of the selected bin that carry labels, with what the fit check and the grid need
  function labelParts(b, D) {
    var P = [{ name: b.stack ? "Bottom bin" : "", nW: b.divW, nN: b.divN, labels: b.labels || {}, inner: function (z) { return innerAt(D, z); },
               zTop: binLabelTop(D, b), zDivTop: dividerTop(b, D), zFloor: D.zf, set: function (k, v) { b.labels = b.labels || {}; b.labels[k] = v; } }];
    if (b.stack) {
      var t = trays(b)[0], H = trayH(b), inner = trayInner(t, H, S.wall + S.plugClear, S.plugDepth * tanDeg(S.draft));
      trayNames(b).forEach(function (name, k) {
        P.push({ name: name, nW: b.trayDivW, nN: b.trayDivN, labels: (b.trayLabels || [])[k] || {}, inner: inner, zTop: H, zDivTop: H, zFloor: S.floorT,
                 set: function (key, v) { b.trayLabels = b.trayLabels || []; b.trayLabels[k] = b.trayLabels[k] || {}; b.trayLabels[k][key] = v; } });
      });
    }
    return P;
  }
  var gridsFor = "", labelNotes = {}; // what the label cells in the DOM were built for, and each cell's fit note
  function renderLabelGrids(b, D) { // one small grid of text cells per part, shaped like its compartments as seen from the front
    var parts = labelParts(b, D), box = $("labelGrids");
    var sig = [b.id, b.zone, b.split, parts.map(function (P) { return P.nW + "x" + P.nN; }).join("|")].join("|");
    if (sig !== gridsFor) { // rebuild the cells only when the layout changes, so typing keeps focus
      gridsFor = sig; box.innerHTML = "";
      parts.forEach(function (P, pi) {
        var sh = gridShape(b, P.nW, P.nN), g = document.createElement("div"); g.className = "lgrid";
        if (P.name) { var nm = document.createElement("div"); nm.className = "lgrid-name"; nm.textContent = P.name; g.appendChild(nm); }
        var cells = document.createElement("div"); cells.className = "cells"; cells.style.gridTemplateColumns = "repeat(" + sh.cols + ", minmax(0, 1fr))";
        for (var r = sh.rows - 1; r >= 0; r--) for (var c = 0; c < sh.cols; c++) { // far row on top, like the floor map
          var inp = document.createElement("input"); inp.type = "text"; inp.className = "cell"; inp.maxLength = LABEL.maxLen; inp.autocomplete = "off"; inp.spellcheck = false;
          inp.dataset.part = pi; inp.dataset.key = r + "," + c; inp.placeholder = sh.rows * sh.cols > 1 ? "" : "e.g. M3 NUTS";
          inp.setAttribute("aria-label", (P.name || "Bin") + " label, row " + (r + 1) + " column " + (c + 1));
          cells.appendChild(inp);
        }
        g.appendChild(cells); box.appendChild(g);
      });
    }
    var allText = true; labelNotes = {};
    parts.forEach(function (P, pi) {
      var fits = {}; shelfSegments(b, P).forEach(function (seg) { fits[seg.key] = labelFitSeg(seg, P.zFloor); });
      box.querySelectorAll('.cell[data-part="' + pi + '"]').forEach(function (inp) {
        var key = inp.dataset.key, raw = P.labels[key] || "", text = cleanLabel(raw), F = fits[key];
        if (document.activeElement !== inp) inp.value = raw;
        if (!text) allText = false;
        var note = F ? fitNote(F, text) : "";
        inp.title = note; inp.classList.toggle("bad", !!(F && (F.noRoom || F.dropped)));
        labelNotes[pi + ":" + key] = note;
      });
    });
    var a = document.activeElement;
    $("label-v").textContent = a && a.classList && a.classList.contains("cell") ? labelNotes[a.dataset.part + ":" + a.dataset.key] || "" : "";
    return allText;
  }
  function specRows(b, D) {
    if (b.stack) {
      var t0 = trays(b)[0];
      return [["Bottom bin top", f1(D.bx) + " × " + f1(D.by)], ["Usable below tray", f1(D.h - S.floorT - S.plugDepth) + " mm"], ["Each tray", f1(t0.bx) + " × " + f1(t0.by)], ["Heights", Math.round(D.h) + " + " + Math.round(trayH(b) - S.plugDepth) + " mm"]];
    }
    var ob = outerAt(D, D.zb), inn = innerAt(D, D.zt);
    return [["Top outside", f1(D.bx) + " × " + f1(D.by)], ["Bottom outside", f1(ob.x) + " × " + f1(ob.y)], ["Inside at rim", f1(inn.x) + " × " + f1(inn.y)], ["Height", f1(D.h) + " mm"]];
  }
  function updateSummary(b) {
    ADV_KEYS.forEach(function (k) { if (document.activeElement !== $(k)) $(k).value = S[k]; });
    var used = usedCells(), gs = groups(S.bins);
    $("fullNote").hidden = used < TOTAL_CELLS;
    $("summary").textContent = S.bins.length ? S.bins.length + " bin" + (S.bins.length > 1 ? "s" : "") + " · " + used + " of " + TOTAL_CELLS + " cells filled · " + gs.length + " unique STL" + (gs.length > 1 ? "s" : "") : "Empty case.";
    $("dlAll").disabled = !S.bins.length; $("dlOne").disabled = !b; $("copyScad").disabled = !b;
    $("liftTrays").checked = !!S.liftTrays;
    $("liftWrap").hidden = !S.bins.some(function (o) { return o.stack; }) || (S.view === "bin" && !(b && b.stack));
  }
  // Redraw everything from S. During a drag, fullRedraw === false skips the list and preset chips.
  function update(fullRedraw) {
    var b = sel(), D = b ? dims(b) : null;
    updateHeader(b, D);
    setPressed("case", S.caseType); setPressed("view", S.view);
    updateBinPanel(b, D);
    updateSummary(b);
    drawBins();
    if (fullRedraw !== false) { drawList(); drawPresets(); }
    show3D();
    persist();
  }

  // controls
  document.querySelectorAll("[data-case]").forEach(function (x) { x.addEventListener("click", function () { S.caseType = x.getAttribute("data-case"); update(); }); });
  $("resetView").addEventListener("click", resetView);
  document.querySelectorAll("[data-view]").forEach(function (x) { x.addEventListener("click", function () { S.view = x.getAttribute("data-view"); update(); }); });
  document.querySelectorAll("[data-ht]").forEach(function (x) { x.addEventListener("click", function () { var b = sel(); if (b) { b.ht = x.getAttribute("data-ht"); update(); } }); });
  document.querySelectorAll("[data-stack]").forEach(function (x) { x.addEventListener("click", function () { var b = sel(); if (b) { b.stack = x.getAttribute("data-stack") === "on"; update(); } }); });
  document.querySelectorAll("[data-split]").forEach(function (x) { x.addEventListener("click", function () { var b = sel(); if (b) { b.split = x.getAttribute("data-split"); update(); } }); });
  $("liftTrays").addEventListener("change", function () { S.liftTrays = $("liftTrays").checked; update(); });
  $("lowerH").addEventListener("input", function () { var b = sel(); if (b) { b.lowerH = +$("lowerH").value; update(); } });
  document.querySelectorAll("[data-feet]").forEach(function (x) { x.addEventListener("click", function () { var b = sel(); if (b) { b.feet = x.getAttribute("data-feet"); update(); } }); });
  function resize(dw, dn) {
    var b = sel(); if (!b) return;
    var w = b.w + dw, n = b.n + dn;
    if (w < 1 || n < 1) return;
    if (canPlace(b.zone, b.c, b.r, w, n, b.id)) { b.w = w; b.n = n; say(""); update(); return; }
    var spot = findSpot(w, n, b.id);
    if (spot) { b.zone = spot.zone; b.c = spot.c; b.r = spot.r; b.w = w; b.n = n; say("Moved bin " + idx(b) + " to fit " + w + "x" + n + "."); update(); }
    else say("No room for a " + w + "x" + n + ". Move or delete a bin first.");
  }
  $("w-minus").addEventListener("click", function () { resize(-1, 0); });
  $("w-plus").addEventListener("click", function () { resize(1, 0); });
  $("n-minus").addEventListener("click", function () { resize(0, -1); });
  $("n-plus").addEventListener("click", function () { resize(0, 1); });
  ["divPct", "customH"].forEach(function (k) { $(k).addEventListener("input", function () { var b = sel(); if (b) { b[k] = +$(k).value; update(); } }); });
  Object.keys(STEP_LIMITS).forEach(function (k) {
    function bump(d) { var b = sel(); if (!b) return; var v = Math.min(STEP_LIMITS[k][1], Math.max(STEP_LIMITS[k][0], b[k] + d)); if (v !== b[k]) { b[k] = v; update(); } }
    $(k + "-minus").addEventListener("click", function () { bump(-1); });
    $(k + "-plus").addEventListener("click", function () { bump(1); });
  });
  $("labelGrids").addEventListener("input", function (e) {
    var inp = e.target; if (!inp.classList.contains("cell")) return;
    var b = sel(); if (!b) return;
    var P = labelParts(b, dims(b))[+inp.dataset.part];
    if (P) { P.set(inp.dataset.key, inp.value.slice(0, LABEL.maxLen)); update(); }
  });
  $("labelGrids").addEventListener("focusin", function (e) { var inp = e.target; if (inp.classList.contains("cell")) $("label-v").textContent = labelNotes[inp.dataset.part + ":" + inp.dataset.key] || ""; });
  $("labelGrids").addEventListener("focusout", function () { $("label-v").textContent = ""; });
  $("labelPlate").addEventListener("change", function () { var b = sel(); if (b) { b.labelPlate = $("labelPlate").checked; update(); } });
  document.querySelectorAll("[data-side]").forEach(function (x) { x.addEventListener("click", function () { var b = sel(); if (b) { b.labelSide = x.getAttribute("data-side"); update(); } }); });
  ADV_KEYS.forEach(function (k) {
    $(k).addEventListener("change", function () {
      var v = parseFloat($(k).value);
      if (isFinite(v)) S[k] = Math.min(ADV_LIMITS[k][1], Math.max(ADV_LIMITS[k][0], v));
      update();
    });
  });
  $("resetAdv").addEventListener("click", function () { Object.assign(S, MEASURED); update(); });
  $("applyAll").addEventListener("click", function () {
    var b = sel(); if (!b) return;
    var keys = Object.keys(BIN_OPTS).filter(function (k) { return k !== "labels" && k !== "labelSide" && k !== "labelPlate" && k !== "trayLabels"; }); // labels stay per bin
    S.bins.forEach(function (o) { keys.forEach(function (k) { o[k] = b[k]; }); });
    say("Applied bin " + idx(b) + "'s height, dividers and feet to all " + S.bins.length + " bins."); update();
  });
  $("delSel").addEventListener("click", function () { var b = sel(); if (b) removeBin(b.id); });
  $("stockLayout").addEventListener("click", function () {
    var u = snapshot("Put the previous layout back.");
    S.bins = layout.stockLayout(S.caseType, newBin); S.selId = S.bins[0].id; sayUndo("Loaded the stock " + caseName() + " case layout.", u); update();
  });
  $("clearAll").addEventListener("click", function () {
    var u = snapshot("Put the previous layout back.");
    S.bins = []; S.selId = null; sayUndo("Case emptied. Drag on the grid to draw a bin.", u); update();
  });
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      var b = sel(); if (b) { e.preventDefault(); removeBin(b.id); }
    } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && undo) {
      e.preventDefault(); doUndo();
    }
  });

  // The label map as an OpenSCAD vector: rows counted from the label wall inward, columns along the wall from -W/-N to +W/+N
  $("copyScad").addEventListener("click", function () {
    var b = sel(); if (!b) return;
    var txt = scadText(b), box = $("copyFallback");
    function fallback() { box.hidden = false; box.value = txt; box.focus(); box.select(); say("Select and copy the settings below."); }
    var note = b.stack ? " Render once with part = \"base\" and once with part = \"tray\"." : "";
    try { navigator.clipboard.writeText(txt).then(function () { box.hidden = true; say("Bin " + idx(b) + " settings copied. Paste them over the top of storehouse_bin.scad." + note); }, fallback); }
    catch (e) { fallback(); }
  });

  function starter() {
    S.bins = [newBin("main", 0, 0, 2, 2), newBin("main", 2, 0, 1, 2)];
    S.selId = S.bins[1].id;
  }
  if (!S.bins.length) { try { if (localStorage.getItem("sbb-state-v4") === null) starter(); } catch (e) { starter(); } }
  drawFloor();
  initThree();
  update();
})();
