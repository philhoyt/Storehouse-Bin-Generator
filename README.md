# Storehouse Bin Builder

Print custom bins that drop right into Harbor Freight STOREHOUSE parts cases. Draw the bins you want on the case floor, preview them in 3D, and download every STL in one zip.

**Live app:** https://philhoyt.github.io/Storehouse-Bin-Generator/

Works with:

- [20-Bin Medium Portable Parts Storage Case](https://www.harborfreight.com/20-bin-medium-portable-parts-storage-case-93928.html)
- [8-Bin Large Portable Parts Storage Case](https://www.harborfreight.com/8-bin-portable-parts-storage-case-93927.html)

## Use it

**[Open the Storehouse Bin Builder](https://philhoyt.github.io/Storehouse-Bin-Generator/)**

It runs in your browser. No install, no account. You can also open `index.html` locally.

1. Pick the case: Medium or Large.
2. Drag across empty cells on the floor map to draw a bin. Drag a bin to move it.
3. Select a bin to set its height, dividers, and feet.
4. Click **Download all bins**. Matching bins share one STL, and `layout.txt` tells you how many of each to print.

## The grid

Both cases share one floor grid. Each cell is one pocket in the case floor.

| | Size |
|---|---|
| W cell | 54 mm |
| N cell | 40 mm |
| Medium case height | 50 mm |
| Large case height | 94 mm |

Every bin has a code: `<case>-<W>x<N>`. `M-1x2` is one W cell by two N cells, Medium case height.

The floor is a 10 × 4 main block plus a 2-cell handle strip with a 2 × 2 pocket at each end. Bins in the handle strip sit turned 90°.

Stock bins in this language:

| Case | Bin | Code |
|---|---|---|
| Medium | small | M-1x1 |
| Medium | medium | M-1x2 |
| Medium | big | M-2x2 |
| Large | small | L-2x2 |
| Large | large | L-2x4 |

## Fit

Measured from stock bins with calipers:

- Walls taper 1.5° per side. A large bin is 108 mm wide at the top, 103 mm at the bottom.
- Feet are 5 mm round and 1.6 mm tall, one per corner. They drop into 20 mm pockets, so placement is forgiving.
- Stock bins touch with no gap. Printed bins get 0.25 mm of clearance per side by default.

If a test print is tight, raise **Clearance per side** under **Fit and print**. Start with an `M-1x1`. It's small and quick.

## OpenSCAD

`storehouse_bin.scad` builds the same bins in OpenSCAD with the Customizer. In the web app, **Copy OpenSCAD settings** gives you a block to paste over the top of the file.

## Files

| File | What it is |
|---|---|
| `index.html` | The web app. One file, loads three.js from a CDN. |
| `storehouse_bin.scad` | OpenSCAD version of the generator. |
| `Previous Attempts/` | The original plain-box SCAD. |
