w = 54;
l = 160;
h = 94;
t = 1.2;
r = 4;  // corner radius

module rounded(w, l, r) {
    hull() {
        translate([r, r])     circle(r, $fn=32);
        translate([w-r, r])   circle(r, $fn=32);
        translate([r, l-r])   circle(r, $fn=32);
        translate([w-r, l-r]) circle(r, $fn=32);
    }
}

difference() {
    linear_extrude(h) rounded(w, l, r);
    translate([t, t, t]) linear_extrude(h) rounded(w - t*2, l - t*2, r - t);
}
