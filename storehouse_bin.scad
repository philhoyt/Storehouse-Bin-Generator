// =====================================================================
// STOREHOUSE Bin Generator  (Harbor Freight Medium 20-bin + Large 8-bin)
// v0.5  —  grid from caliper measurements. Pairs with the Storehouse Bin Builder web app
// =====================================================================
//
// THE GRID LANGUAGE
//   Every bin is   <case>-<W>x<N>     e.g.  M-1x1   M-2x2   L-2x4
//
//   W = wide cells   (54 mm each)
//   N = narrow cells (40 mm each)
//   case = M (Medium case, 50 mm tall)  or  L (Large case, 94 mm tall)
//
//   Both cases share one floor:  10 x 4 main block  +  2-deep handle strip.
//   In the handle strip, bins sit rotated 90 degrees. Same code, turned.
//
//   Stock bins:
//     Medium case:  small M-1x1   medium M-1x2   big M-2x2
//     Large case:   small L-2x2   large  L-2x4
//
//   Size formula:  top outer = cells * pitch - 2 * clearance
//
// STACKING
//   A stacked slot is a shorter bottom bin plus top tray(s) that fill the
//   rest of the case height. Each tray has a plug that drops inside the
//   bin's rim. Set stack = true, then render part = "base" and part = "tray"
//   and export each. part = "assembled" shows them together (not for printing).
// ---------------------------------------------------------------------

/* [Bin] */
case_type   = "M";   // [M:Medium case (50 mm), L:Large case (94 mm)]
cells_w     = 1;     // [1:1:4]   wide cells, 54 mm each
cells_n     = 2;     // [1:1:10]  narrow cells, 40 mm each
half_height = false; // half-height bin. Ignored when stacked
custom_height = 0;   // mm. 0 = use case height. Overrides half_height. Ignored when stacked

/* [Dividers] */
div_w = 1;  // compartments across the W direction (bottom bin when stacked)
div_n = 1;  // compartments across the N direction (bottom bin when stacked)
divider_height_pct = 100; // [20:5:100]

/* [Feet] */
feet = "none";    // [none:None (prints flat, no supports), corners:Corners (like stock), perimeter:Every cell corner on the edge]

/* [Label] */
label       = "";     // one label, on every compartment touching the label wall. Or fill `labels` below, one per compartment
labels      = [];     // e.g. [["M3", "M4"], ["", ""]]: row 0 touches the label wall, later rows go inward; columns run along the wall. Copy OpenSCAD settings in the app fills this in
label_plate = false;  // the shelf with no letters, for a sticker or a marker
label_wall  = "W+";   // [W+:+W wall, W-:-W wall, N+:+N wall, N-:-N wall]  (Copy OpenSCAD settings in the app picks the wall farthest from you)
label_depth = 6;      // mm the shelf reaches into the bin
label_face  = 10;     // mm, height of the sloped face the letters sit on
label_raise = 0.5;    // mm the letters stand off the face
label_font  = "Liberation Sans:style=Bold";

/* [Stacking] */
stack        = false;
part         = "base";  // [base:Bottom bin, tray:Top tray, assembled:Assembled preview]
lower_height = 0;       // mm, bottom bin height. 0 = half the case height
split        = "1";     // [1:One tray, w:Two across W, n:Two across N, 4:Four trays]
tray_div_w   = 1;       // compartments inside each tray, across W
tray_div_n   = 1;       // compartments inside each tray, across N

/* [Grid calibration] */
pitch_w   = 54;    // mm per W cell (stock large bin: 108 = 2 cells)
pitch_n   = 40;    // mm per N cell (stock large bin: 160 = 4 cells)
height_M  = 48;    // mm, Medium case bins
height_L  = 92;    // mm, Large case bins
clearance = 0.25;  // mm off each side so printed bins drop in (stock fit is snug)

/* [Construction] */
wall       = 1.6;
floor_t    = 1.6;
corner_r   = 3.0;
draft_deg  = 1.5;  // per side. Stock large bin: 108 top, 103 bottom over 94 tall
divider_t  = 1.2;
foot_d     = 5;    // stock: 5 mm
foot_h     = 1.6;  // stock: 1.6 mm. Case pockets are 20 mm wide, so placement is forgiving
foot_inset = 4;    // foot center to bin edge
plug_depth = 4;    // how far a tray drops inside the bin below
plug_clearance = 0.4; // per side, between tray plug and bin rim
tray_gap   = 0.6;  // between split trays
$fn = 48;

// ------------------------------------------------ derived
function outer(cells, pitch) = cells * pitch - 2 * clearance;

bin_x  = outer(cells_w, pitch_w);
bin_y  = outer(cells_n, pitch_n);
full_h = (case_type == "L") ? height_L : height_M;
low_h  = max(15, min(full_h - 15, lower_height > 0 ? lower_height : full_h / 2));
bin_h  = stack ? low_h
       : custom_height > 0 ? min(custom_height, full_h)
       : half_height ? full_h / 2 : full_h;
body_h = bin_h - (feet == "none" ? 0 : foot_h);
inset  = body_h * tan(draft_deg);  // body bottom is this much smaller per side

tray_h = full_h - low_h + plug_depth;  // overall tray height, plug included
kx     = (split == "w" || split == "4") ? 2 : 1;
ky     = (split == "n" || split == "4") ? 2 : 1;
tray_x = (bin_x - (kx - 1) * tray_gap) / kx;
tray_y = (bin_y - (ky - 1) * tray_gap) / ky;

echo(str("BIN ", case_type, "-", cells_w, "x", cells_n,
         stack ? str(" stacked ", low_h, " + ", tray_h - plug_depth) : half_height ? " half" : "",
         "   top ", bin_x, " x ", bin_y,
         "   bottom ", bin_x - 2*inset, " x ", bin_y - 2*inset,
         "   height ", bin_h, " mm"));
if (stack) echo(str("TRAY x", kx * ky, "   ", tray_x, " x ", tray_y,
                    "   overall height ", tray_h, " mm (", plug_depth, " mm plug)"));

// ------------------------------------------------ helpers
module rrect(x, y, r) {
    r2 = max(0.3, min(r, x/2 - 0.01, y/2 - 0.01));
    offset(r2) square([x - 2*r2, y - 2*r2], center = true);
}

// thin slab of a rounded rectangle at height z, used to build lofts with hull()
module slab(x, y, r, z) {
    translate([0, 0, z]) linear_extrude(0.01) rrect(x, y, r);
}

// tapered rounded box, smaller at z=0, full size at z=h
module tapered(x, y, h, r, ins) {
    hull() {
        slab(x - 2*ins, y - 2*ins, max(r - ins, 0.5), 0);
        slab(x, y, r, h - 0.01);
    }
}

// ------------------------------------------------ label shelf
// A triangular prism fused to the inside of one wall just below z_top. Its face slopes up toward the viewer and
// carries the letters; its underside runs back to the wall at 45 degrees, so it prints without supports.
lab_p  = (label_wall == "W+" || label_wall == "W-") ? 0 : 1;   // 0: wall perpendicular to W (x), 1: perpendicular to N (y)
lab_s  = (label_wall == "W+" || label_wall == "N+") ? 1 : -1;
lab_ov = wall * 0.7;
lab_ep = lab_p == 0 ? [1, 0, 0] : [0, 1, 0];
lab_es = lab_p == 0 ? [0, 1, 0] : [1, 0, 0];
function bin_inner(z, axis)  = (axis == 0 ? bin_x : bin_y) - 2 * wall - 2 * inset * (1 - z / body_h);
function tray_inner(z, axis) = let(a = (axis == 0 ? tr_px - 2 * tr_dr : tr_py - 2 * tr_dr) - 2 * wall, b = (axis == 0 ? tray_x : tray_y) - 2 * wall)
                               a + (b - a) * (z - floor_t) / (tray_h + 1 - floor_t);
function lab_inner(z, axis, tray) = tray ? tray_inner(z, axis) : bin_inner(z, axis);
function lab_scale(z_top) = min(1, (z_top - floor_t - 0.5) / (label_face + label_depth));  // shrink the shelf on short parts

lab_corner = max(corner_r - wall, 0.5) + 0.5;
div_h0     = (body_h - floor_t) * divider_height_pct / 100;
lab_div_top = floor_t + (stack ? min(div_h0, body_h - floor_t - plug_depth - 1) : div_h0);   // top of the bin's dividers
function lab_text(i, j) = len(labels) > i && len(labels[i]) > j ? labels[i][j] : (len(labels) == 0 && i == 0 ? label : "");
function lab_wp(z, tray) = lab_inner(z, lab_p, tray);        // inner width across the label axis
function lab_ws(z, tray) = lab_inner(z, 1 - lab_p, tray);    // inner width along the wall
function lab_div(z, m, np, tray) = lab_s * (-lab_wp(z, tray) / 2 + m * lab_wp(z, tray) / np);   // divider m, as a distance toward the wall
function lab_u_back(z, at_wall, m, np, tray) = at_wall ? lab_wp(z, tray) / 2 + lab_ov : lab_div(z, m, np, tray) + divider_t / 2 - 0.2;
function lab_u_face(z, at_wall, m, np, tray) = at_wall ? lab_wp(z, tray) / 2 : lab_div(z, m, np, tray) - divider_t / 2;
function lab_s_lo(z, j, ns, tray) = -lab_ws(z, tray) / 2 + j * lab_ws(z, tray) / ns + (j == 0 ? lab_corner : divider_t / 2 + 0.5);
function lab_s_hi(z, j, ns, tray) = -lab_ws(z, tray) / 2 + (j + 1) * lab_ws(z, tray) / ns - (j == ns - 1 ? lab_corner : divider_t / 2 + 0.5);

// One shelf per compartment with text (or a blank plate). Row 0 sits on the label wall; deeper rows hang on the near
// face of the divider in front of them. nW x nN are the part's compartments, z_div_top the top of its dividers.
module label_shelves(z_top, z_div_top, nW, nN, tray = false) {
    np = lab_p == 0 ? nW : nN;  ns = lab_p == 0 ? nN : nW;
    for (i = [0 : np - 1], j = [0 : ns - 1]) if (lab_text(i, j) != "" || label_plate) {
        at_wall = i == 0;
        zt = at_wall ? z_top : min(z_top, z_div_top);
        sc = lab_scale(zt);
        ip = lab_s > 0 ? np - 1 - i : i;   // compartment index along +axis
        m  = lab_s > 0 ? ip + 1 : ip;      // the divider on its wall side
        txt = lab_text(i, j);
        if (sc >= 0.5) {
            fh = label_face * sc;  xd = label_depth * sc;  z_mid = zt - fh;  z_under = z_mid - xd;
            u_top = lab_u_back(zt, at_wall, m, np, tray);  u_face = lab_u_face(zt, at_wall, m, np, tray);
            u_in = lab_u_face(z_mid, at_wall, m, np, tray) - xd;  u_under = lab_u_back(z_under, at_wall, m, np, tray);
            s_lo = max(lab_s_lo(z_under, j, ns, tray), lab_s_lo(zt, j, ns, tray));
            s_hi = min(lab_s_hi(z_under, j, ns, tray), lab_s_hi(zt, j, ns, tray));
            L = s_hi - s_lo;  s_mid = (s_lo + s_hi) / 2;
            depth = lab_wp(z_mid, tray) / np - (at_wall ? divider_t / 2 : divider_t);
            face_len = norm([u_face - u_in, fh]);
            cap = txt == "" ? 0 : min(6, face_len - 3, (L - 3) / (0.8 * len(txt)));
            if (L >= 8 && depth >= xd + 4) {
                // the prism: a triangle in the (u, z) plane, extruded along the wall, moved to this compartment
                translate(lab_es * s_mid)
                    multmatrix([[lab_ep[0] * lab_s, 0, lab_es[0], 0], [lab_ep[1] * lab_s, 0, lab_es[1], 0], [0, 1, 0, 0], [0, 0, 0, 1]])
                        linear_extrude(L, center = true) polygon([[u_top, zt], [u_in, z_mid], [u_under, z_under]]);
                // the letters: text drawn in a frame on the face (h = reading direction, q = up the slope, n = out of the face)
                if (txt != "" && cap >= 3.5) {
                    c = lab_ep * lab_s * (u_face + u_in) / 2 + lab_es * s_mid + [0, 0, (zt + z_mid) / 2];
                    q = (lab_ep * lab_s * (u_face - u_in) + [0, 0, fh]) / face_len;
                    h = cross(lab_ep * lab_s, [0, 0, 1]);
                    n = cross(h, q);
                    multmatrix([[h[0], q[0], n[0], c[0]], [h[1], q[1], n[1], c[1]], [h[2], q[2], n[2], c[2]], [0, 0, 0, 1]])
                        translate([0, 0, -0.3]) linear_extrude(label_raise + 0.3)
                            text(txt, size = cap, font = label_font, halign = "center", valign = "center");
                } else if (txt != "") echo(str("Label '", txt, "' skipped: no room for readable letters in that compartment"));
            } else echo(str("Label shelf skipped in compartment ", i, ",", j, ": compartment too small"));
        } else echo("Label shelf skipped: part too short");
    }
}
// What a rib must stay out of: everything inboard of each wall shelf's face, from its underside up, across that
// compartment. Dividers need no cut, since wall shelves sit between them.
module label_keepout(z_top, nW, nN, tray = false) {
    np = lab_p == 0 ? nW : nN;  ns = lab_p == 0 ? nN : nW;
    sc = lab_scale(z_top);
    if (sc >= 0.5) for (j = [0 : ns - 1]) if (lab_text(0, j) != "" || label_plate) {
        fh = label_face * sc;  xd = label_depth * sc;  z_mid = z_top - fh;  z_under = z_mid - xd;
        u_in = lab_wp(z_mid, tray) / 2 - xd;
        s_lo = lab_s_lo(z_under, j, ns, tray);  s_hi = lab_s_hi(z_under, j, ns, tray);
        big = max(bin_x, bin_y) + 20;
        translate(lab_ep * lab_s * (u_in - 0.5 + big / 2) + lab_es * (s_lo + s_hi) / 2 + [0, 0, z_under + 0.5 + big / 2])
            cube([lab_p == 0 ? big : s_hi - s_lo, lab_p == 0 ? s_hi - s_lo : big, big], center = true);
    }
}
lab_top = stack ? body_h - plug_depth - 1 : body_h;   // on a stacked bin the shelf sits under the tray plug

// ------------------------------------------------ bottom bin / single bin (built on z = 0, raised later)
module shell() {
    difference() {
        tapered(bin_x, bin_y, body_h, corner_r, inset);
        translate([0, 0, floor_t])
            tapered(bin_x - 2*wall, bin_y - 2*wall, body_h,
                    max(corner_r - wall, 0.5), inset * (1 - floor_t / body_h));
    }
}

module dividers() {
    ix = bin_x - 2*wall;
    iy = bin_y - 2*wall;
    dh0 = (body_h - floor_t) * divider_height_pct / 100;
    dh = stack ? min(dh0, body_h - floor_t - plug_depth - 1) : dh0;  // leave room for the tray plug
    if (div_w > 1) for (i = [1 : div_w - 1])
        translate([-ix/2 + i * ix / div_w - divider_t/2, -iy/2, floor_t])
            cube([divider_t, iy, dh]);
    if (div_n > 1) for (j = [1 : div_n - 1])
        translate([-ix/2, -iy/2 + j * iy / div_n - divider_t/2, floor_t])
            cube([ix, divider_t, dh]);
}

// support ribs under the lines where split trays meet, up to rim height
module ribs() {
    rib_t = 2 * wall + tray_gap;  // fits between neighboring tray plugs
    if (stack && kx == 2)
        translate([-rib_t/2, -bin_y/2, floor_t - 0.01]) cube([rib_t, bin_y, body_h - floor_t + 0.01]);
    if (stack && ky == 2)
        translate([-bin_x/2, -rib_t/2, floor_t - 0.01]) cube([bin_x, rib_t, body_h - floor_t + 0.01]);
}

module foot_at(x, y) {
    translate([x, y, 0]) cylinder(d = foot_d, h = foot_h + 0.01);
}

module all_feet() {
    bx = bin_x / 2 - inset - foot_inset;
    by = bin_y / 2 - inset - foot_inset;
    if (feet == "corners") {
        for (sx = [-1, 1], sy = [-1, 1]) foot_at(sx * bx, sy * by);
    } else if (feet == "perimeter") {
        // corners of every cell that sit on the outer edge
        xs = [for (i = [0 : cells_w]) (i == 0) ? -bx : (i == cells_w) ? bx
                                       : -bin_x/2 + clearance + i * pitch_w];
        ys = [for (j = [0 : cells_n]) (j == 0) ? -by : (j == cells_n) ? by
                                       : -bin_y/2 + clearance + j * pitch_n];
        for (x = xs, y = [-by, by]) foot_at(x, y);
        for (y = ys, x = [-bx, bx]) foot_at(x, y);
    }
}

module body() {
    intersection() {
        tapered(bin_x, bin_y, body_h, corner_r, inset);
        union() {
            shell();
            dividers();
            difference() { ribs(); label_keepout(lab_top, div_w, div_n); }
            label_shelves(lab_top, lab_div_top, div_w, div_n);
        }
    }
}

module bin() {
    if (feet == "none") {
        body();
    } else {
        all_feet();
        translate([0, 0, foot_h]) body();
    }
}

// ------------------------------------------------ top tray (one; split trays are all the same)
// Prints right side up: plug -> 45 degree chamfer -> straight body. No supports.
tr_e  = wall + plug_clearance;              // plug is inset this much on every side
tr_dr = plug_depth * tan(draft_deg);        // plug tapers like the bin wall it sits in
tr_px = tray_x - 2 * tr_e;
tr_py = tray_y - 2 * tr_e;

module tray_outer() {
    hull() {  // plug
        slab(tr_px - 2*tr_dr, tr_py - 2*tr_dr, corner_r - tr_e, 0);
        slab(tr_px, tr_py, corner_r - tr_e, plug_depth - 0.01);
    }
    hull() {  // chamfer
        slab(tr_px, tr_py, corner_r - tr_e, plug_depth - 0.01);
        slab(tray_x, tray_y, corner_r, plug_depth + tr_e - 0.01);
    }
    translate([0, 0, plug_depth + tr_e - 0.02])  // body
        linear_extrude(tray_h - plug_depth - tr_e + 0.02) rrect(tray_x, tray_y, corner_r);
}

module tray_cavity() {
    hull() {  // straight from the floor ring up past the rim
        slab(tr_px - 2*tr_dr - 2*wall, tr_py - 2*tr_dr - 2*wall, corner_r - tr_e - wall, floor_t);
        slab(tray_x - 2*wall, tray_y - 2*wall, corner_r - wall, tray_h + 1);
    }
}

module tray_dividers() {
    ix = tray_x - 2*wall;
    iy = tray_y - 2*wall;
    h  = tray_h - floor_t;
    if (tray_div_w > 1) for (i = [1 : tray_div_w - 1])
        translate([-ix/2 + i * ix / tray_div_w - divider_t/2, -iy/2, floor_t - 0.01]) cube([divider_t, iy, h]);
    if (tray_div_n > 1) for (j = [1 : tray_div_n - 1])
        translate([-ix/2, -iy/2 + j * iy / tray_div_n - divider_t/2, floor_t - 0.01]) cube([ix, divider_t, h]);
}

module tray() {
    difference() { tray_outer(); tray_cavity(); }
    intersection() {
        tray_outer();
        union() {
            tray_dividers();
            label_shelves(tray_h, tray_h, tray_div_w, tray_div_n, true);
        }
    }
}

// ------------------------------------------------ output
if (!stack) {
    bin();
} else if (part == "base") {
    bin();
} else if (part == "tray") {
    tray();
} else {  // assembled preview: trays seated on the bottom bin
    color("gold") bin();
    for (i = [0 : kx - 1], j = [0 : ky - 1])
        color("orange")
            translate([-bin_x/2 + tray_x/2 + i * (tray_x + tray_gap),
                       -bin_y/2 + tray_y/2 + j * (tray_y + tray_gap),
                       bin_h - plug_depth])
                tray();
}
