# Stackable bins (prototype)

Two levels in one slot. A shorter bottom bin, with a removable top tray resting on it. Together they fill the full case height, so the lid still closes. Best in the Large case, where 94 mm is a lot of wasted depth for small parts.

Status: prototype on the `stackable` branch. Nothing printed yet.

## How it fits together

```
        ┌──────────────┐  ← top tray, straight walls, no taper
        │              │
        │              │
        └┐            ┌┘  ← 45° chamfer, prints without support
   ──────┤   plug     ├──────  ← bottom bin rim
   │     └────────────┘     │     plug drops 4 mm inside, 0.4 mm clearance per side
   │                        │
   │      bottom bin        │  ← normal tapered bin, shorter
   └────────────────────────┘
```

- **Plug.** The tray's underside steps in by one wall plus 0.4 mm. That plug drops 4 mm inside the bottom bin's rim, so the tray can't slide off.
- **Seat.** The chamfer meets the rim's inner edge. It centers itself like a cone, and the tray ends up about 0.4 mm lower than nominal.
- **Heights.** Bottom bin height is adjustable. The tray is whatever is left, plus the 4 mm plug. Large case default is 47 + 47.
- **Usable depth.** The bottom bin loses 4 mm to the plug. Dividers in the bottom bin stop 1 mm below it.

## Split tops

| Option | Trays | Bottom bin gets |
|---|---|---|
| 1 tray | one, full footprint | nothing extra |
| 2 across W | two side by side | one support rib |
| 2 across N | two end to end | one support rib |
| 4 trays | four quarters | a cross of ribs |

Without ribs, split trays only touch the rim on their outer edges and can tip into the middle. The rib runs up to rim height, fits between neighboring plugs, and doubles as a divider in the bottom bin.

## Files

A stacked bin exports two parts. Matching parts group as usual.

- `L-2x4-stack-base47.stl` or `L-2x4-stack-base47-rib4.stl`
- `L-2x4-stack-top51-split4-x4.stl` (51 = 47 mm visible + 4 mm plug)

## Things to test once the printer is back

1. **Plug clearance.** 0.4 mm per side is a guess. Too tight and trays stick, too loose and they rattle.
2. **Seat height.** Check the lid closes with a tray in place. If it's tight, drop the bottom bin by 1 mm.
3. **Lifting trays out.** Full-size trays have nothing to grab. Quarters lift easily. A finger notch may help single trays.
4. **Rib strength.** 3.8 mm thick, full height. Probably plenty.

## Not done yet

- Stacking in the OpenSCAD file. It only builds the bottom bin.
- Dividers inside top trays.
- Trays that span two bottom bins.
