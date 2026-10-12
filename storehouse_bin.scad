// =====================================================================
// STOREHOUSE Bin Generator  (Harbor Freight Medium 20-bin + Large 8-bin)
// v0.3  —  grid from caliper measurements. Pairs with the Storehouse Bin Builder web app
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
// ---------------------------------------------------------------------

/* [Bin] */
case_type   = "M";   // [M:Medium case (50 mm), L:Large case (94 mm)]
cells_w     = 1;     // [1:1:4]   wide cells, 54 mm each
cells_n     = 2;     // [1:1:10]  narrow cells, 40 mm each
half_height = false; // half-height bin (stack two in one slot)
custom_height = 0;   // mm. 0 = use case height. Overrides half_height

/* [Dividers] */
div_w = 1;  // compartments across the W direction
div_n = 1;  // compartments across the N direction
divider_height_pct = 100; // [20:5:100]

/* [Feet] */
feet = "corners"; // [corners:Corners (like stock), perimeter:Every cell corner on the edge, none:None]

/* [Grid calibration] */
pitch_w   = 54;    // mm per W cell (stock large bin: 108 = 2 cells)
pitch_n   = 40;    // mm per N cell (stock large bin: 160 = 4 cells)
height_M  = 50;    // mm, Medium case bins
height_L  = 94;    // mm, Large case bins
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
$fn = 48;

// ------------------------------------------------ derived
function outer(cells, pitch) = cells * pitch - 2 * clearance;

bin_x  = outer(cells_w, pitch_w);
bin_y  = outer(cells_n, pitch_n);
full_h = (case_type == "L") ? height_L : height_M;
bin_h  = custom_height > 0 ? min(custom_height, full_h)
       : half_height ? full_h / 2 : full_h;
body_h = bin_h - (feet == "none" ? 0 : foot_h);
inset  = body_h * tan(draft_deg);  // body bottom is this much smaller per side

echo(str("BIN ", case_type, "-", cells_w, "x", cells_n,
         half_height ? " half" : "",
         "   top ", bin_x, " x ", bin_y,
         "   bottom ", bin_x - 2*inset, " x ", bin_y - 2*inset,
         "   height ", bin_h, " mm"));

// ------------------------------------------------ helpers
module rrect(x, y, r) {
    r2 = min(r, x/2 - 0.01, y/2 - 0.01);
    offset(r2) square([x - 2*r2, y - 2*r2], center = true);
}

// tapered rounded box, smaller at z=0, full size at z=h
module tapered(x, y, h, r, ins) {
    hull() {
        linear_extrude(0.01) rrect(x - 2*ins, y - 2*ins, max(r - ins, 0.5));
        translate([0, 0, h - 0.01]) linear_extrude(0.01) rrect(x, y, r);
    }
}

// ------------------------------------------------ parts (built on z = 0, raised later)
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
    dh = (body_h - floor_t) * divider_height_pct / 100;
    if (div_w > 1) for (i = [1 : div_w - 1])
        translate([-ix/2 + i * ix / div_w - divider_t/2, -iy/2, floor_t])
            cube([divider_t, iy, dh]);
    if (div_n > 1) for (j = [1 : div_n - 1])
        translate([-ix/2, -iy/2 + j * iy / div_n - divider_t/2, floor_t])
            cube([ix, divider_t, dh]);
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

// ------------------------------------------------ build
module body() {
    intersection() {
        tapered(bin_x, bin_y, body_h, corner_r, inset);
        union() {
            shell();
            dividers();
        }
    }
}

if (feet == "none") {
    body();
} else {
    all_feet();
    translate([0, 0, foot_h]) body();
}
