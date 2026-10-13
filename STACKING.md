# Stackable bins

Get two levels out of one slot. A shorter bottom bin holds the bulk parts, and a removable top tray rides on it. Together they fill the full case height, so the lid still closes. Best in the Large case, where 94 mm is a lot of depth for small parts.

Status: built in the web app and the OpenSCAD file on the `stackable` branch. Not printed yet.

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

- **Plug.** The tray's underside steps in by one wall plus the plug clearance. It drops 4 mm inside the bottom bin's rim, so the tray can't slide off.
- **Seat.** The chamfer meets the rim's inner edge. It centers itself like a cone, and the tray sits about 0.4 mm lower than nominal.
- **Heights.** Bottom bin height is adjustable. The tray is whatever is left, plus the plug. Large case default is 47 + 47 mm.
- **Usable depth.** The bottom bin loses 4 mm to the plug. Its dividers stop 1 mm below the plug.
- **Medium case.** Works too, from 15 + 35 to 35 + 15 mm. Shallow, but handy for tiny parts.

## Split tops

| Option | Trays | Bottom bin gets |
|---|---|---|
| 1 tray | one, full footprint | nothing extra |
| 2 across W | two side by side | one support rib |
| 2 across N | two end to end | one support rib |
| 4 trays | four quarters | a cross of ribs |

Without ribs, split trays only touch the rim on their outer edges and can tip into the middle. Each rib runs up to rim height, fits between the neighboring plugs, and doubles as a divider in the bottom bin.

Trays can have their own dividers, set separately from the bottom bin's.

## In the web app

1. Select a bin and switch it to **Stacked**.
2. Set the bottom bin height and how the top splits.
3. Turn on **Lift trays in the 3D view** to see the parts apart.

**Download all bins** exports both parts for every stacked bin. Matching parts group as usual:

- `L-2x4-stack-base47-rib4.stl`
- `L-2x4-stack-top51-split4-x4.stl` (51 = 47 mm visible + 4 mm plug)

Plug depth and clearance live under **Fit and print**.

## In OpenSCAD

Set `stack = true`, then render twice:

- `part = "base"` for the bottom bin
- `part = "tray"` for one tray. Print as many as the split needs.

`part = "assembled"` shows them together for checking, not for printing. **Copy OpenSCAD settings** in the app fills all of this in.

## Fit test

**Fit and print > Download fit test** gives you four tiny prints: a 15 mm tall 1x1 base and three trays at different plug clearances. The trays are 12, 14, and 16 mm tall so you can tell them apart. Keep the one that seats with light friction and enter its clearance in the app. The README in the zip walks through it.

## To test once the printer is back

1. **Fit test first.** Settle plug clearance before printing anything big.
2. **Lid clearance.** Seat a tray and close the lid. If it's tight, lower the bottom bin by 1 mm.
3. **Lifting trays out.** Quarters should be easy. Full-size trays may need a fingertip under an edge.
4. **Rib strength.** 3.8 mm thick, full height. Probably plenty.

## Not built

- **Trays that span two bottom bins.** The plug needs a rim on every side to locate against. Spanning trays would need a different seat.
- **Finger notches on trays.** Left out on purpose until a print shows whether full trays are hard to lift.
