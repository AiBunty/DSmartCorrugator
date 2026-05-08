# 01 — FORMULA MASTER REFERENCE
## BoxCostPro — Corrugated Box Costing Engine

> **Purpose**: Standalone, exhaustive reference of every formula used in the costing system.
> A Python backend must be able to reproduce all outputs solely from this document.
> Source files are cited for traceability; the new system does not depend on them.

---

## INDEX OF ALL FORMULAS

| # | Formula | Section |
|---|---------|---------|
| F01 | RSC Sheet Length | §3.1 |
| F02 | RSC Sheet Width | §3.2 |
| F03 | Flat Sheet Length | §3.3 |
| F04 | Flat Sheet Width | §3.4 |
| F05 | ID ↔ OD Dimension Adjustment | §4 |
| F06 | Layer Weight | §5.1 |
| F07 | Sheet Weight (total) | §5.2 |
| F08 | Paper Rate (BF pricing engine) | §6 |
| F09 | Paper Cost | §7 |
| F10 | Burst Strength (BS) | §8 |
| F11 | Edge Crush Test (ECT) | §9 |
| F12 | Board Compression Test / McKee BCT | §10 |
| F13 | Board Thickness | §11 |
| F14 | Printing Cost per Box | §12 |
| F15 | Lamination Cost per Box | §13 |
| F16 | Die Cost per Box | §14 |
| F17 | Punching / Varnish Cost per Box | §15 |
| F18 | Conversion Cost per Box | §16 |
| F19 | Total Cost per Box | §17 |
| F20 | Subtotal (Quote) | §18 |
| F21 | GST / Tax Amount | §19 |
| F22 | Round-Off | §20 |
| F23 | Grand Total | §21 |
| — | Currency & Locale Context | §1.10 |
| — | International Formula Considerations | §32 |
| — | Sheet Mode with Optional Box Dimensions | §33 |
| — | Grouped Quote Items / Product Sets | §34 |
| — | Negotiated Price vs Final Billing Price | §35 |
| — | AI Extraction Confidence Model | §36 |
| — | Bulk Import Row Normalization Rules | §37 |
| — | Job Card & QA Data Derivation | §38 |
| — | Price Increase Comparison Formulas | §39 |
| — | Specification Sheet as Derivative Output | §40 |

---

## §1 — CONSTANTS & DEFAULTS

### 1.1 Flute Factor Constants
*Source: `client/src/components/FlutingSettings.tsx` → `DEFAULT_FLUTING_FACTORS`*

| Flute | `flutingFactor` | `fluteHeightMm` | Description |
|-------|-----------------|-----------------|-------------|
| A | 1.55 | 4.8 mm | Coarse flute, max cushioning |
| B | 1.35 | 2.5 mm | Fine flute, good printability |
| C | 1.45 | 3.6 mm | Medium flute, general use |
| E | 1.25 | 1.2 mm | Micro-flute, folding cartons |
| F | 1.20 | 0.8 mm | Ultra-micro flute |

> **DB source of truth**: `flute_settings` table (`flute_type`, `fluting_factor`, `flute_height_mm`). If a tenant customises their flute values in the admin panel, those override the defaults above. The Python backend must load from `flute_settings` first and fall back to the table above if no record exists.

### 1.2 Ply Layer Composition
*Source: `client/src/pages/calculator.tsx` → `createLayersForPly`*

Layers are indexed from 0. Flute layers occupy odd indices for multi-wall boards.

| Ply | Layer count | Layer types (index 0 → last) |
|-----|-------------|------------------------------|
| 1 | 1 | Liner |
| 3 | 3 | Liner, Flute, Liner |
| 5 | 5 | Liner, Flute, Liner, Flute, Liner |
| 7 | 7 | Liner, Flute, Liner, Flute, Liner, Flute, Liner |
| 9 | 9 | Liner, Flute, Liner, Flute, Liner, Flute, Liner, Flute, Liner |

Rule: layer is **Flute** if its zero-based index is **odd** (1, 3, 5, 7); else **Liner**.

### 1.3 Default Glue Flap Values
*Source: `client/src/pages/calculator.tsx` → `GLUE_FLAP_DEFAULTS`*

| Ply | Default Glue Flap (mm) |
|-----|------------------------|
| 1 | 50 |
| 3 | 45 |
| 5 | 50 |
| 7 | 60 |
| 9 | 70 |

### 1.4 Default Deckle Allowance Values
*Source: `client/src/pages/calculator.tsx` → `DECKLE_ALLOWANCE_DEFAULTS`*

| Ply | Default Deckle Allowance (mm) |
|-----|-------------------------------|
| 1 | 30 |
| 3 | 25 |
| 5 | 30 |
| 7 | 35 |
| 9 | 40 |

### 1.5 Default Board Thickness (PLY_THICKNESS)
*Source: `client/src/pages/calculator.tsx` → `PLY_THICKNESS`*
Used as fallback when thickness cannot be computed from flute heights.

| Ply | Default Thickness (mm) |
|-----|------------------------|
| 1 | 0.45 |
| 3 | 3.0 |
| 5 | 5.0 |
| 7 | 7.0 |
| 9 | 11.0 |

> Note: `appSettings.plyThicknessMap` in the DB stores overrides per tenant:
> `{'1':0.45, '3':2.5, '5':3.5, '7':5.5, '9':6.5}` — always use DB values when present.

### 1.6 Valid Flute Combinations per Ply
*Source: `client/src/components/FlutingSettings.tsx` → `FLUTE_COMBINATIONS`*

| Ply | Allowed flute combination strings |
|-----|-----------------------------------|
| 3 | `A`, `B`, `C`, `E`, `F` |
| 5 | `AA`, `AB`, `AC`, `AE`, `BB`, `BC`, `BE`, `CC`, `CE`, `EE`, `EF`, `FF` |
| 7 | `AAA`, `AAB`, `ABC`, `ABB`, `BBC`, `BCC`, `BCB`, `BCE`, `BBE`, `CCE`, `CEE` |
| 9 | `AAAA`, `AABB`, `ABBC`, `BBCC`, `BCCE`, `BBCE`, `CCEE` |

Each character in the string represents one flute layer (left to right, inner to outer). The length of the string equals the number of flute layers in that ply (ply/2 rounded down).

### 1.7 BF (Bursting Factor) Options
*Source: `client/src/pages/paper-setup.tsx` → `BF_OPTIONS`*

Valid BF values: `14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40`

### 1.8 Paper Shade Abbreviations
*Source: `shared/paperUtils.ts`, `shared/schema.ts` → `DEFAULT_PAPER_SHADES`*

| Shade Name (long form) | Abbreviation | Category | Is Fluting? |
|------------------------|-------------|----------|-------------|
| Kraft/Natural | KRA | kraft | No |
| Testliner | TST | liner | No |
| Virgin Kraft Liner | VKL | liner | No |
| White Kraft Liner | WKL | liner | No |
| White Top Testliner | WTT | liner | No |
| Duplex Grey Back (LWC) | LWC | duplex | No |
| Duplex Grey Back (HWC) | HWC | duplex | No |
| Semi Chemical Fluting | SCF | flute | Yes |
| Recycled Fluting | RCF | flute | Yes |
| Bagasse (Agro based) | BAG | kraft | No |
| Golden Kraft | GOL | kraft | No |

### 1.9 Other System Defaults

| Parameter | Default Value | DB source |
|-----------|---------------|-----------|
| Markup (profit) | 15% | `business_defaults.default_markup_percent` (editable per tenant) |
| Conversion cost | 15 LCU/Kg | `business_defaults.conversion_cost_per_kg` (editable per tenant) |
| Default GST | 5% | `business_defaults.default_gst_percent` |
| Max sheet length threshold | None (user-configurable) | calculator state |

### 1.10 Currency & Locale Context

**The formula engine is currency-agnostic.** All monetary outputs from F06–F23 are in **Local Currency Units (LCU)** — the unit the tenant has configured (₹ INR by default; USD, EUR, AED, GBP, SGD, etc. for international tenants).

| Principle | Detail |
|-----------|--------|
| Formulas store | Raw float values, no currency symbol |
| Currency symbol | Resolved at display/PDF layer from `business_defaults.currency_code` |
| Number formatting | Controlled by `business_defaults.locale` (e.g. `en-IN` uses ₹1,23,456.78; `en-US` uses $123,456.78) |
| No FX conversion | The engine does not convert between currencies. A tenant priced in USD enters costs in USD; all outputs are USD. |
| Document references to ₹ | Throughout this file, `₹` is used as the example LCU. Substitute with the tenant's currency symbol at display time. |

The formula result object must carry the tenant's currency for the rendering layer:

```python
@dataclass
class CostingResult:
    formula_version: str         # e.g. "1.0"
    currency_code: str           # ISO 4217, e.g. "INR", "USD"
    currency_symbol: str         # display symbol, e.g. "₹", "$"
    locale: str                  # BCP-47, e.g. "en-IN", "en-US"
    # ... all formula outputs as float (no currency embedded)
    paper_cost_per_box: float
    conversion_cost_per_box: float
    total_cost_per_box: float
    subtotal: float
    gst_amount: float
    grand_total: float
    # ...
```

> All formula constants that were historically expressed as ₹ (e.g. `conversion_cost_per_kg = 15`) are **LCU values** loaded from `business_defaults` per tenant. There are no hardcoded currency amounts in the formula engine itself.

---

## §2 — PAPER SPEC STRING FORMAT

*Source: `shared/paperUtils.ts` → `generatePaperSpec`*

The **Paper Specification** is a compact string that identifies every layer of a board construction. It is used in quotes and reports.

### Format per Layer
```
{ABBR}{GSM}/{BF}
```
- `ABBR` = 3-letter shade abbreviation from §1.8
- `GSM` = integer GSM value
- `BF` = integer BF value; **flute layers use `"F"` suffix** instead of a numeric BF
  
> Wait — from code: flute layers still use their actual BF value if set. The `/BF` portion is only written when `bf` is defined for a layer. For flute layers with no BF configured, the BF portion may be omitted.

### Layer Order in String
Layers are joined with `+` in order from index 0 (first liner) to last. Example:
```
KRA120/18+SCF100+KRA120/18
```
This is a 3-ply board: outer Kraft liner 120gsm BF18, Semi-Chemical Fluting medium 100gsm, inner Kraft liner 120gsm BF18.

### Validation
A spec is valid if every layer generates an abbreviation without error. Use `validatePaperSpec(spec)` → boolean.

---

## §3 — SHEET SIZE CALCULATION

### 3.1 — F01: RSC Sheet Length

*Source: `client/src/lib/calculations.ts` → `calculateRSCSheet`*

**RSC** = Regular Slotted Container. The sheet is scored and folded to form the box.

```
SheetLength = 2 × (L + W) + GlueFlap
```

**Variables:**
- `L` = inner length of box (mm), already adjusted for ID/OD (see §4)
- `W` = inner width of box (mm), already adjusted for ID/OD
- `GlueFlap` = overlap flap width (mm), default from §1.3

**Additional Flap Rule** (when `maxLengthThreshold` is set):
```
IF SheetLength > maxLengthThreshold:
    SheetLength = SheetLength + (maxLengthThreshold × 0.10)
    additionalFlapApplied = true
```
The additional flap is 10% of the threshold value, added to accommodate printing grippers or folding constraints.

**Return fields:** `sheetLength`, `additionalFlapApplied` (boolean)

---

### 3.2 — F02: RSC Sheet Width

*Source: `client/src/lib/calculations.ts` → `calculateRSCSheet`*

```
SheetWidth = W + H + DeckleAllowance
```

**Variables:**
- `W` = inner width of box (mm)
- `H` = inner height of box (mm)
- `DeckleAllowance` = trim/reel waste allowance (mm), default from §1.4

---

### 3.3 — F03: Flat Sheet Length

*Source: `client/src/lib/calculations.ts` → `calculateFlatSheet`*

Used for single-sheet items (e.g., liner sheets, pads, wraps — not boxes).

```
FlatSheetLength = L + SheetAllowance
```

**Variables:**
- `L` = length dimension (mm)
- `SheetAllowance` = trim allowance, typically 25mm; user configurable

> **[V2 Addition] Cost Basis in Sheet Mode**: For Sheet-type items, the **cost basis is always the sheet size** (F03 + F04 outputs). Even when optional box dimensions are entered for display or BCT purposes, the costing engine uses sheet dimensions. See §33 for full rules.

---

### 3.4 — F04: Flat Sheet Width

*Source: `client/src/lib/calculations.ts` → `calculateFlatSheet`*

```
FlatSheetWidth = W + SheetAllowance
```

---

## §4 — MEASUREMENT MODE: ID vs OD

*Source: `client/src/pages/calculator.tsx` → `adjustForMeasurement`*

Boxes can be measured as **Inside Dimensions (ID)** or **Outside Dimensions (OD)**. When OD is used, the board thickness must be subtracted to get inner working dimensions.

### OD → ID Conversion

```
L_inner = L_outer − 2 × boardThickness
W_inner = W_outer − 2 × boardThickness
H_inner = H_outer − boardThickness
```

> Height is subtracted by only **one** board thickness because the RSC height fold only accounts for the top and bottom of one side panel.

**boardThickness** used here = `PLY_THICKNESS[ply]` from §1.5 (the system default, not the calculated value from flute heights). This is a deliberate simplification for the dimension-adjustment step.

When `measuredOn = 'ID'` (default), no adjustment is applied — L, W, H are used directly.

---

## §5 — WEIGHT CALCULATION

### 5.1 — F06: Layer Weight

*Source: `client/src/lib/calculations.ts` → `calculateLayerWeight`*

Computes the paper weight contribution of a single layer in kilograms.

```
LayerWeight (kg) = (GSM × flutingFactor × reelSize × sheetLength) / 1,000,000
```

**Variables:**
- `GSM` = grams per square meter of the paper
- `flutingFactor` = 1.0 for liner layers; flute type factor (e.g., 1.45 for C) for flute layers
- `reelSize` = sheet width in **meters** (i.e., `sheetWidth_mm / 1000`)
- `sheetLength` = sheet length in **meters** (i.e., `sheetLength_mm / 1000`)

The division by 1,000,000 converts `(g/m²) × m × m` to kilograms.

> For liner layers, `flutingFactor = 1.0` exactly. Flute layers multiply by their factor because the fluting process stretches the paper.

---

### 5.2 — F07: Sheet Weight (Total)

*Source: `client/src/lib/calculations.ts` → `calculateSheetWeight`*

Computes the total weight of one complete board sheet in kilograms.

**Method A — from layer specs (preferred):**

```
TotalWeightedGSM = Σ (GSM_i × flutingFactor_i)     for all i layers

SheetWeight (kg) = (SheetLength_mm × SheetWidth_mm × TotalWeightedGSM) / 1,000,000,000
```

- Division by 10^9 converts `mm × mm × g/m²` → `kg`
- `flutingFactor_i = 1.0` for liner layers; flute factor from §1.1 for flute layers

**Method B — fallback (no layer specs):**
```
If layerSpecs is empty, SheetWeight = 0
```

The function returns `{ totalWeight: number, layerWeights: number[] }` where `layerWeights[i]` is the individual contribution of layer i.

---

## §6 — PAPER RATE ENGINE (BF PRICING)

*Source: `client/src/lib/paperPricing.ts` → `calculatePaperRate`*
*DB tables: `paper_bf_prices`, `shade_premiums`, `paper_pricing_rules`*

The paper rate (₹ per Kg) for any given paper combination is computed from four additive components:

```
finalRate = bfBasePrice + gsmAdjustment + shadePremium + marketAdjustment
```

### Component 1: BF Base Price
Looked up directly from the `paper_bf_prices` table by matching `bf` value.
```
bfBasePrice = paper_bf_prices WHERE bf = inputBF → basePrice
```
**If no record found for the BF**: the calculation is **blocked** with a validation error. The system must never silently use ₹0 — a zero bfBasePrice means paper is free, which produces a catastrophically underpriced quote.

**Error message**: *"No price configured for BF [X]. Go to Paper Master to add it before calculating."*

**Suggested price hint**: Each row in `paper_bf_prices` stores an optional `step_increment` (₹/Kg). When a BF has no price, the system finds the nearest lower BF that does have a price and sums the `step_increment` values up to the target BF. The suggested price is shown as a hint — the user must confirm it in Paper Master before the calculation is unblocked.

**Default step increments** (stored in `paper_bf_prices.step_increment`, per-tenant configurable):

| BF | Default Step (₹/Kg) | Notes |
|----|---------------------|-------|
| 14 | 0 | Base anchor |
| 16 | +1 | |
| 18 | +1 | |
| 20 | +1 | |
| 22 | +2 | |
| 24 | +2 | |
| 25 | +2 | |
| 28 | +6 | |
| 30 | +2 | |
| 32 | +2 | |
| 35 | +8 | |
| 40 | +10 | |

Example: BF 28 is missing, BF 24 = ₹32/Kg → suggested = 32 + 2(BF25 step) + 6(BF28 step) = ₹40/Kg.

### Component 2: GSM Adjustment
Loaded from `paper_pricing_rules` table (one row per tenant).

```
IF gsm < lowGsmLimit:
    gsmAdjustment = lowGsmAdjustment
ELSE IF gsm > highGsmLimit:
    gsmAdjustment = highGsmAdjustment
ELSE:
    gsmAdjustment = 0
```

**Default values** from schema:
- `lowGsmLimit` = 101 (GSM **strictly below** 101 → apply low adjustment; GSM 101 gets no adjustment)
- `lowGsmAdjustment` = 1 (₹/Kg add-on)
- `highGsmLimit` = 201 (GSM **strictly above** 201 → apply high adjustment; GSM 201 gets no adjustment)
- `highGsmAdjustment` = 1 (₹/Kg add-on)

> **Canonical boundary rule**: Operators are strict `<` and `>`. A paper at exactly `lowGsmLimit` (e.g. GSM=101) receives **no** adjustment. Worked example: GSM=101, lowGsmLimit=101 → `gsmAdjustment = 0`.

### Component 3: Shade Premium
Looked up from `shade_premiums` table by matching `shade` name.
```
shadePremium = shade_premiums WHERE shade = inputShade → premium
```
Default: 0 if no record for that shade.

### Component 4: Market Adjustment
A global flat offset from `paper_pricing_rules.marketAdjustment`.
```
marketAdjustment = paper_pricing_rules.marketAdjustment
```
Default: 0.

### Full Return Type (PaperPriceBreakdown)
```
{
  bfBasePrice: number,
  gsmAdjustment: number,
  shadePremium: number,
  marketAdjustment: number,
  finalRate: number,        // sum of the above four
  notes: string[]           // transparency notes e.g. "No price found for BF 22"
}
```

### Price Override (per layer)
Each layer in the calculator has a `priceOverride: boolean` flag.

- When `priceOverride = false` (default): the rate is computed via the BF pricing engine above.
- When `priceOverride = true`: the `manualRate` entered by the user is used directly.

The field `rate` on a `LayerSpec` always holds the effective rate (either calculated or manual).

---

## §7 — F09: PAPER COST

*Source: `client/src/lib/calculations.ts` → `calculatePaperCost`*

```
PaperCost (₹) = SheetWeight (kg) × WeightedAverageRate (₹/kg)
```

Where:
```
WeightedAverageRate = Σ (rate_i × weight_i) / Σ weight_i
```
with `weight_i` = individual layer weight from F06, and `rate_i` = effective rate for that layer (from §6).

**No layer specs / missing rate — BLOCK**:
If `layers` is empty, or any layer has no resolved rate (BF price not configured), the calculation is **blocked** with a validation error. The system must never silently fall back to ₹0 or ₹55 — an unpriced layer produces a catastrophically underpriced quote.

**Error message**: *"Cannot calculate paper cost: one or more layers have no price configured. Go to Paper Master to add BF prices before calculating."*

---

## §8 — F10: BURST STRENGTH (BS)

*Source: `client/src/lib/calculations.ts` → `calculateBurstStrength`*

Burst Strength measures the pressure a board face can withstand before puncture.

```
For each liner layer:
    BS_contribution = (GSM × BF) / 1000

For each flute layer:
    BS_contribution = (GSM × BF) / 2000

TotalBS = Σ all BS_contribution values
```

**Units**: kgf/cm² (kilogram-force per square centimeter)

> Flute layers contribute at half the rate of liners because the corrugated medium is not a flat structural face.
> If `BF` is not defined for a layer, its contribution is 0.

---

## §9 — F11: EDGE CRUSH TEST (ECT)

*Source: `client/src/lib/calculations.ts` → `calculateECT`*

ECT measures the stacking strength per unit edge length of the corrugated board.

```
For each liner layer:
    ECT_contribution = RCT_value        (Ring Crush Test value, kN/m)

For each flute layer:
    ECT_contribution = RCT_value × flutingFactor

TotalECT = Σ all ECT_contribution values
```

**Units**: kN/m (kilonewtons per meter)

Parameters:
- `rctValue` is entered per layer by the user on the calculator (optional; if absent, contribution = 0)
- `flutingFactor` for flute layers from §1.1

---

## §10 — F12: BOX COMPRESSION TEST (BCT) — McKee Formula

*Source: `client/src/lib/calculations.ts` → `calculateMcKeeFormula`*

The McKee formula estimates the compressive load a filled box can sustain before collapsing.

```
BCT (kg) = 5.87 × ECT × √( (boardThickness / 10) × boxPerimeter )
```

**Variable definitions:**
- `ECT` = total ECT from F11 (kN/m)
- `boardThickness` = total board thickness in **mm** from F13 below
- `boardThickness / 10` converts mm → cm (for correct dimensional analysis)
- `boxPerimeter` = 2 × (L + W) in **cm** (i.e., `(2 × (L_mm + W_mm)) / 10`)
- `√(...)` = square root

**Units of result**: kg (kilogram-force)

> The factor 5.87 is the empirical McKee constant. ECT is in kN/m and the formula produces kg when dimensions are in cm. This is the internationally recognised simplified McKee formula (1963).

> **[V2 Addition] BCT Basis in Sheet Mode** (cross-ref §33): When a Quote Item is of type `'sheet'`, BCT is computed only if optional box dimensions (`boxLength`, `boxWidth`, `boxHeight`) are present and valid. In that case, `boxPerimeter = 2 × (boxLength + boxWidth)` uses the **optional box dimensions**, not the sheet dimensions. If optional box dimensions are absent, BCT must be **null** — the field is hidden in quote output and the calculation trace records `bct_basis = null`.

---

## §11 — F13: BOARD THICKNESS

*Source: `client/src/components/FlutingSettings.tsx` → `calculateBoardThicknessFromFlutes`*
*Also: `client/src/lib/calculations.ts` → `calculateBoardThickness`*

Board thickness is the sum of the flute heights for all flute layers in the combination.

### Method A — from flute combination string (preferred)

Given flute combination string (e.g., `"BC"` for 5-ply), and each character maps to a flute type:

```
boardThickness = Σ fluteHeightMm[char]   for each char in combinationString
```

Example: `"BC"` → `fluteHeightMm['B'] + fluteHeightMm['C']` = `2.5 + 3.6 = 6.1 mm`

### Method B — from PLY_THICKNESS defaults

If the combination is not available or thickness cannot be computed:
```
boardThickness = PLY_THICKNESS[ply]      (from §1.5)
```

### Manual Override
The user can override board thickness in the calculator UI. When overridden:
- `thicknessSource = 'manual'`
- Stored in `quoteVersions.thicknessSource` and `quoteVersions.boardThicknessMm`

When auto-calculated:
- `thicknessSource = 'auto'` (default)

---

## §12 — F14: PRINTING COST PER BOX

*Source: `client/src/pages/calculator.tsx` → `calculateManufacturingCosts`*

```
PrintingCostPerBox = CostPerPrint + (PlateCost / Qty)
```

**Overrun / MOQ penalty** (when `moqEnabled = true` and `Qty < MOQ`):
```
PrintingCostPerBox += CostPerPrint × (MOQ − Qty) / Qty
```

This adds the proportional cost of wasted prints (the machine must run to MOQ minimum even if fewer boxes are ordered).

**Input fields** (per item in calculator):
- `CostPerPrint`: printing cost per box (manual entry, ₹)
- `PlateCost`: total plate/block making charge (₹), amortised over `Qty`
- `MOQ`: minimum order quantity for printing
- `Qty`: actual order quantity

---

## §13 — F15: LAMINATION COST PER BOX

*Source: `client/src/pages/calculator.tsx` → `calculateManufacturingCosts`*

```
LaminationCostPerBox = (SheetLengthInches × SheetWidthInches × LaminationRate) / 100
```

**Variables:**
- `SheetLengthInches` = `SheetLength_mm / 25.4`
- `SheetWidthInches` = `SheetWidth_mm / 25.4`
- `LaminationRate` = ₹ per 100 square inches (manual entry, industry convention in India)

---

## §14 — F16: DIE COST PER BOX

*Source: `client/src/pages/calculator.tsx` → `calculateManufacturingCosts`*

```
DieCostPerBox = DieDevelopmentCharge / Qty
```

- `DieDevelopmentCharge` = total cost of the die (₹), one-time charge
- Amortised over the order quantity

---

## §15 — F17: PUNCHING & VARNISH COST PER BOX

Both are flat per-box rates entered manually by the operator.

```
PunchingCostPerBox = punchingRate    (₹/box, direct input)
VarnishCostPerBox  = varnishRate     (₹/box, direct input)
```

---

## §16 — F18: CONVERSION COST PER BOX

*Source: `client/src/pages/calculator.tsx` → `calculateTotalCost`*

```
ConversionCostPerBox = SheetWeight (kg) × ConversionCostPerKg (₹/kg)
```

Default: `ConversionCostPerKg = 15` (₹15 per kilogram). This covers corrugation, gluing, slotting, cutting — the manufacturing overhead beyond paper cost.

> `ConversionCostPerKg` is configurable per tenant in `businessDefaults`.

---

## §17 — F19: TOTAL COST PER BOX

*Source: `client/src/lib/calculations.ts` → `calculateTotalCost`*

This is the primary output of the costing engine — the price per box before negotiation.

```
AddOns = PrintingCost + LaminationCost + VarnishCost + DieCost + PunchingCost

TotalCostPerBox = (PaperCost + AddOns) × (1 + Markup/100) + ConversionCostPerBox
```

**Markup source**: `business_defaults.default_markup_percent` (default 15%). Loaded per tenant from the admin panel. Never hardcoded.

> The markup is applied to (PaperCost + AddOns) only. Conversion cost is added **after** markup. This is intentional — conversion cost represents manufacturing overhead that is costed at cost, not marked up.

The function signature:
```
calculateTotalCost({
  paperCost,
  printingCost,   // default 0
  laminationCost, // default 0
  varnishCost,    // default 0
  dieCost,        // default 0
  punchingCost,   // default 0
  markup          // from business_defaults.default_markup_percent
}) → totalCostPerBox
```

---

## §18 — F20: SUBTOTAL (QUOTE LEVEL)

*Source: `client/src/pages/calculator.tsx` — in-component quote state logic*

A quote contains multiple line items. Each item has:
- `finalCostPerBox` = either `negotiatedPrice` (if negotiated) or `totalCostPerBox`
- `quantity`

```
Subtotal = Σ (finalCostPerBox_i × quantity_i)   for all selected items
```

Only items with `selected = true` are included. Unselected items are visible in the UI but excluded from pricing.

---

## §18B — TRANSPORT CHARGE

*Source: `shared/schema.ts` → `quoteVersions.transportCharge`*
*DB: `quoteVersions.transport_charge`, `quoteVersions.transport_remark`*

Transport is a flat per-quote charge added **after** the item subtotal and **before** GST.

```
SubtotalWithTransport = Subtotal + TransportCharge
```

**Variables:**
- `TransportCharge` = flat ₹ amount entered by the operator (default 0; optional field)
- `TransportRemark` = free-text description stored alongside the charge (e.g., "Mumbai delivery")

**GST on transport:**
```
GSTAmount = SubtotalWithTransport × (gstPercent / 100)
```
Transport is included in the GST base by default (freight is taxable under GST in India). If the operator wishes to exempt transport from GST, they should enter it outside the system and add it manually post-GST.

**Formula chain position:**
```
Subtotal  →  + TransportCharge  →  SubtotalWithTransport  →  × GST  →  + RoundOff  →  GrandTotal
```

**Stored in** `quoteVersions`:
- `transport_charge` real (NULL = no charge)
- `transport_remark` text (NULL = no remark)

> If `TransportCharge` is NULL or 0, `SubtotalWithTransport = Subtotal` (no change).

---

## §19 — F21: GST / TAX AMOUNT

*Source: `client/src/pages/calculator.tsx`, `shared/schema.ts` → `businessDefaults`*

```
GSTAmount = SubtotalWithTransport × (gstPercent / 100)
```

- `SubtotalWithTransport` = Subtotal + TransportCharge (from §18B)
- `gstPercent` default = `5` (India GST rate for corrugated boxes, HSN 4819)
- Loaded from `business_defaults.default_gst_percent`
- Can be overridden per quote

### IGST vs Split GST

Controlled by `businessDefaults.igstApplicable`:
- `igstApplicable = false` (default): CGST = gstPercent/2, SGST = gstPercent/2 (intra-state)
- `igstApplicable = true`: IGST = gstPercent (inter-state)

The split is **display-only** — the calculation of `GSTAmount` is identical in both cases.

---

## §20 — F22: ROUND-OFF

*Source: `shared/schema.ts` → `quoteVersions.roundOffEnabled`, `quoteVersions.roundOffValue`*

When `roundOffEnabled = true`:
```
RoundedTotal = Math.round(SubtotalWithTransport + GSTAmount)
RoundOffValue = RoundedTotal − (SubtotalWithTransport + GSTAmount)   // can be positive or negative
```

The `roundOffValue` is stored in the quote version and shown separately on invoices.

---

## §21 — F23: GRAND TOTAL

```
IF roundOffEnabled:
    GrandTotal = Math.round(SubtotalWithTransport + GSTAmount)
ELSE:
    GrandTotal = SubtotalWithTransport + GSTAmount
```

Stored in: `quoteVersions.finalTotal`

---

## §22 — QUOTE VERSIONING AND SNAPSHOT LOGIC

*Source: `shared/schema.ts` → `quoteVersions`, `quoteItemVersions`*

Every time a quote is saved or edited, a **new version** is created. The `quotes` table header (`quoteNo`, `partyId`, `status`) stays constant. The `activeVersionId` pointer is updated to the latest version.

### quoteVersions table: key pricing fields

| Column | Type | Purpose |
|--------|------|---------|
| `subtotal` | real | F20 result |
| `gstPercent` | real | GST rate used |
| `gstAmount` | real | F21 result |
| `roundOffEnabled` | bool | true/false snapshot |
| `roundOffValue` | real | F22 delta |
| `finalTotal` | real | F23 result |
| `isNegotiated` | bool | whether negotiation was applied |
| `negotiationType` | varchar | `'flat'` or `'percentage'` |
| `negotiationValue` | real | discount value |
| `isLocked` | bool | locked once negotiated |
| `isArchived` | bool | true for all but the latest version |

### Flute factor snapshots (critical)

The quote version snapshots every flute constant at the time of saving:

| Column | Purpose |
|--------|---------|
| `fluteFactorA` | flutingFactor for A at save time |
| `fluteFactorB` | flutingFactor for B at save time |
| `fluteFactorC` | flutingFactor for C at save time |
| `fluteFactorE` | flutingFactor for E at save time |
| `fluteFactorF` | flutingFactor for F at save time |
| `fluteHeightA` through `fluteHeightF` | height values at save time |
| `boardThicknessMm` | final board thickness used |
| `thicknessSource` | `'auto'` or `'manual'` |

This ensures that if an admin later changes flute constants, old quotes remain intact.

### quoteItemVersions table: key fields per line item

| Column | Purpose |
|--------|---------|
| `originalCostPerBox` | Calculated cost before negotiation |
| `negotiatedCostPerBox` | Negotiated price (null if none) |
| `finalCostPerBox` | Active price used in subtotal |
| `originalTotalCost` | originalCostPerBox × quantity |
| `finalTotalCost` | finalCostPerBox × quantity |
| `itemDataSnapshot` | Full `QuoteItem` JSON — complete state |

### paperPricesSnapshot JSONB Structure (quoteVersions)

At the time a quote version is saved, the complete active paper price state is captured in `quoteVersions.paper_prices_snapshot` (JSONB). This ensures that if BF prices are later edited in the admin panel, the saved quote's pricing rationale is fully auditable.

**Structure:**
```json
{
  "bfPrices": [
    { "bf": 18, "basePrice": 38.0, "stepIncrement": 1.0 },
    { "bf": 20, "basePrice": 39.0, "stepIncrement": 1.0 }
  ],
  "shadePremiums": [
    { "shade": "Kraft/Natural", "premium": 0.0 },
    { "shade": "Semi Chemical Fluting", "premium": 1.5 }
  ],
  "pricingRules": {
    "lowGsmLimit": 101,
    "lowGsmAdjustment": 1.0,
    "highGsmLimit": 201,
    "highGsmAdjustment": 1.0,
    "marketAdjustment": 0.0
  },
  "capturedAt": "2026-04-10T14:30:00Z"
}
```

- `bfPrices`: all BF rows configured for this tenant at save time
- `shadePremiums`: all shade rows configured for this tenant at save time
- `pricingRules`: the full `paper_pricing_rules` row for this tenant at save time
- `capturedAt`: ISO 8601 timestamp when snapshot was taken

On quoteVersion creation: this snapshot is written in the same DB transaction as the version insert. It is immutable once written.

---

## §23 — NEGOTIATION LOGIC

*Source: `shared/schema.ts` → `quoteItemSchema.negotiationMode`*

Negotiation is per line item. The mode determines how the final price is computed.

| `negotiationMode` | Meaning |
|-------------------|---------|
| `'none'` | No negotiation; `finalCostPerBox = totalCostPerBox` |
| `'percentage'` | `negotiatedCostPerBox = totalCostPerBox × (1 − negotiationValue/100)` |
| `'fixed'` | `negotiatedCostPerBox = negotiationValue` (direct price) |

When any item has negotiation applied, `quoteVersions.isNegotiated = true`.
A negotiated quote version is **locked** (`isLocked = true`) — it cannot be edited, only viewed or restored.

---

## §24 — GST VALIDATION (GSTIN)

*Source: `shared/gst.ts` → `validateGSTIN`*

Indian GSTIN format (15 characters):
```
Positions:  1-2   = State code (e.g., "27" for Maharashtra)
            3-12  = PAN number (10 chars: 5 alpha + 4 digit + 1 alpha)
            13    = Entity number (digit 1-9)
            14    = "Z" (always)
            15    = Check digit (validated via Luhn-like algorithm)
```

### Checksum Algorithm (position 15)
```
charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
factor = 1
sum = 0
for each char in GSTIN[0..13]:
    code = position of char in charset
    digit = factor × code
    digit = (digit / 36) + (digit % 36)  // divide-and-remainder
    sum += digit
    factor = 3 if factor == 1 else 1    // alternates 1, 3, 1, 3, ...

checkDigit = charset[ (36 - (sum % 36)) % 36 ]
valid = (GSTIN[14] == checkDigit)
```

### State Codes (partial — most common)
Full map in `shared/gst.ts` → `GST_STATE_CODES`. Examples:

| Code | State |
|------|-------|
| 07 | Delhi |
| 27 | Maharashtra |
| 29 | Karnataka |
| 33 | Tamil Nadu |
| 36 | Telangana |
| 09 | Uttar Pradesh |
| 24 | Gujarat |

### Helper Functions
- `extractPANFromGST(gstin)` → returns characters 3–12 (PAN)
- `getStateFromGST(gstin)` → returns `{ code: "27", name: "Maharashtra" }` or null

---

## §25 — COMPLETE WORKED EXAMPLE

**Scenario**: 3-ply RSC box, 400×300×200mm (ID), Kraft/BF18 liners, SCF fluting medium

### Step 1: Layer Setup
- Layer 0 (Liner): KRA, GSM=120, BF=18, flutingFactor=1.0
- Layer 1 (Flute-C): SCF, GSM=100, flutingFactor=1.45 (C-flute)
- Layer 2 (Liner): KRA, GSM=120, BF=18, flutingFactor=1.0

### Step 2: Paper Rates (illustrative values, loaded from DB)
- BF18 base price = ₹38/Kg
- KRA shade premium = ₹0
- SCF shade premium = ₹0
- GSM adjustments = 0 (all in middle range)
- Market adjustment = 0
- Rate for all layers = ₹38/Kg

### Step 3: RSC Sheet Size
```
glueFlap = 45mm (3-ply default)
deckle = 25mm (3-ply default)
SheetLength = 2 × (400 + 300) + 45 = 2×700 + 45 = 1445 mm
SheetWidth  = 300 + 200 + 25 = 525 mm
```

### Step 4: Board Thickness
```
C-flute height = 3.6mm → boardThickness = 3.6mm
```

### Step 5: Sheet Weight
```
TotalWeightedGSM = 120×1.0 + 100×1.45 + 120×1.0
                 = 120 + 145 + 120 = 385 gsm (equivalent)

SheetWeight = (1445 × 525 × 385) / 1,000,000,000
            = 292,046,250 / 1,000,000,000
            = 0.2920 kg per sheet
```

### Step 6: Paper Cost
```
WeightedAverageRate = ₹38/Kg (all layers same rate)
PaperCost = 0.2920 × 38 = ₹11.10
```

### Step 7: Burst Strength
```
BS = (120×18)/1000 + (100×18)/2000 + (120×18)/1000
   = 2.16 + 0.90 + 2.16
   = 5.22 kgf/cm²
```

### Step 8: ECT (assume RCT values: liners=4.0 kN/m, flute=3.5 kN/m)
```
ECT = 4.0 + 3.5×1.45 + 4.0
    = 4.0 + 5.075 + 4.0
    = 13.075 kN/m
```

### Step 9: Box Perimeter and BCT
```
boxPerimeter = 2×(400+300) / 10 = 2×700/10 = 140 cm
BCT = 5.87 × 13.075 × √((3.6/10) × 140)
    = 5.87 × 13.075 × √(50.4)
    = 5.87 × 13.075 × 7.099
    = 5.87 × 92.82
    ≈ 545 kg
```

### Step 10: Total Cost (no add-ons, markup from admin default 15%, ₹15/Kg conversion)
```
ConversionCost = 0.2920 × 15 = ₹4.38
AddOns = 0
TotalCostPerBox = (11.10 + 0) × 1.15 + 4.38
                = 12.765 + 4.38
                = ₹17.15 per box
```

### Step 11: Quote for Qty = 1000 (no transport)
```
finalCostPerBox = ₹17.15 (no negotiation)
Subtotal = 17.15 × 1000 = ₹17,150
TransportCharge = 0
SubtotalWithTransport = ₹17,150
GST (5%) = 17150 × 0.05 = ₹857.50
GrandTotal = 17150 + 857.50 = ₹18,007.50
RoundOff → ₹18,008 (if roundOff enabled)
```

---

## §26 — FORMULA DEPENDENCY MAP

```
User Inputs (L, W, H, Ply, Flute, GSM, BF, Shade, Qty)
        │
        ├──→ [§4 ID/OD Adjust] → L_inner, W_inner, H_inner
        │
        ├──→ [§3 Sheet Size F01-F04] → SheetLength, SheetWidth
        │         └── uses L_inner, W_inner, H_inner, GlueFlap, DeckleAllowance
        │
        ├──→ [§11 Board Thickness F13] → boardThickness
        │         └── uses flute combination + fluteHeightMm constants
        │
        ├──→ [§6 Paper Rate F08] → rate_per_layer
        │         └── DB: paper_bf_prices, shade_premiums, paper_pricing_rules
        │
        ├──→ [§5 Weight F06,F07] → LayerWeights, SheetWeight
        │         └── uses SheetLength, SheetWidth, GSM, flutingFactor
        │
        ├──→ [§7 Paper Cost F09] → PaperCost
        │         └── uses SheetWeight, rate_per_layer
        │
        ├──→ [§8 Burst Strength F10] → BS
        │         └── uses GSM, BF per layer
        │
        ├──→ [§9 ECT F11] → ECT
        │         └── uses RCT per layer, flutingFactor
        │
        ├──→ [§10 BCT F12] → BCT
        │         └── uses ECT, boardThickness, L_inner, W_inner
        │
        ├──→ [§12-§15 Add-Ons F14-F17] → PrintCost, LamCost, DieCost, etc.
        │         └── uses SheetLength, SheetWidth (inches), Qty, manual inputs
        │
        ├──→ [§16 Conversion Cost F18] → ConversionCost
        │         └── uses SheetWeight
        │
        └──→ [§17 Total Cost F19] → TotalCostPerBox
                  └── uses PaperCost, AddOns, Markup (from business_defaults), ConversionCost
                            │
                  [§18 Subtotal F20] → Subtotal
                  [§18B Transport] → SubtotalWithTransport = Subtotal + TransportCharge
                  [§19 GST F21] → GSTAmount = SubtotalWithTransport × gstPercent
                  [§20 RoundOff F22] → RoundOffValue
                  [§21 GrandTotal F23] → SubtotalWithTransport + GSTAmount ± RoundOff
```

---

## §27 — DATA TYPES REFERENCE

```python
# Python type equivalents for each formula input

class LayerSpec:
    layer_index: int          # 0-based
    layer_type: Literal['liner', 'flute']
    gsm: float
    bf: Optional[float]       # BF value; None for flute layers without BF
    fluting_factor: float     # 1.0 for liners; A/B/C/E/F factor for flutes
    rct_value: Optional[float]# kN/m; user entered
    shade: str                # full shade name e.g. "Kraft/Natural"
    rate: float               # effective ₹/Kg; calculated or manual
    price_override: bool      # True → use manual_rate
    manual_rate: Optional[float]

class RSCInputs:
    length: float             # mm (inner dimension)
    width: float              # mm (inner dimension)  
    height: float             # mm (inner dimension)
    glue_flap: float          # mm
    deckle_allowance: float   # mm
    max_length_threshold: Optional[float]  # mm

class FlatSheetInputs:
    length: float             # mm
    width: float              # mm
    allowance: float          # mm

class QuoteItem:
    # ── Identity ──────────────────────────────────────────
    id: str                   # UUID
    box_name: str             # user-entered display name
    box_description: str      # optional notes

    # ── Box Configuration ─────────────────────────────────
    type: Literal['rsc', 'sheet']
    ply: Literal['1','3','5','7','9']
    flute_combination: str    # e.g. "C", "BC", "ABC"
    measured_on: Literal['ID','OD']

    # ── Dimensions (always stored as inner mm regardless of measuredOn) ──
    length: float             # inner length mm
    width: float              # inner width mm
    height: Optional[float]   # inner height mm; None for Sheet type
    glue_flap: float          # mm (RSC only)
    deckle_allowance: float   # mm (RSC only)
    sheet_allowance: float    # mm (Sheet type only)
    max_length_threshold: Optional[float]  # mm

    # ── Optional Box Dimensions (Sheet mode only) [V2 Addition] ──
    # Used only for: (1) displaying box size in quote, (2) computing BCT.
    # Does NOT affect cost basis. Must be all-or-nothing (all three present, or all absent).
    box_length: Optional[float]   # mm inner; None if not entered
    box_width: Optional[float]    # mm inner; None if not entered
    box_height: Optional[float]   # mm inner; None if not entered

    # ── Board Setup ───────────────────────────────────────
    thickness_source: Literal['auto', 'manual']
    custom_board_thickness: Optional[float]  # mm; only when manual
    conversion_cost_per_kg: float            # ₹/Kg; from business_defaults

    # ── Layers ────────────────────────────────────────────
    quantity: int
    layers: List[LayerSpec]

    # ── Manufacturing Add-Ons ─────────────────────────────
    printing_enabled: bool
    print_type: Optional[str]          # e.g. "Flexo"
    print_colours: Optional[int]
    cost_per_print: Optional[float]    # ₹/box
    plate_cost: Optional[float]        # ₹ total (amortised by qty)
    print_moq: Optional[int]           # qty below which penalty applies
    moq_enabled: bool                  # True = apply MOQ penalty if qty < print_moq

    lamination_enabled: bool
    lamination_rate: Optional[float]   # ₹/100 sq inches
    custom_lamination_l: Optional[float]  # mm override
    custom_lamination_w: Optional[float]  # mm override

    die_enabled: bool
    die_development_charge: Optional[float]  # ₹ total

    punching_enabled: bool
    varnish_enabled: bool

    # ── Negotiation ───────────────────────────────────────
    negotiation_mode: Literal['none', 'percentage', 'fixed']
    negotiation_value: Optional[float]  # % for 'percentage'; ₹ for 'fixed'

    # ── Computed Outputs (read-only after calculation) ────
    sheet_length: float       # mm
    sheet_width: float        # mm
    sheet_weight: float       # kg
    board_thickness: float    # mm (may be manual)
    bs: float                 # kgf/cm²
    ect: float                # kN/m
    bct: Optional[float]      # kg; None when Sheet type and no optional box dimensions [V2 Clarification]
    paper_cost: float         # ₹
    printing_cost: float      # ₹
    lamination_cost: float    # ₹
    varnish_cost: float       # ₹
    die_cost: float           # ₹
    punching_cost: float      # ₹
    conversion_cost: float    # ₹ (sheet_weight × conversion_cost_per_kg)
    total_cost_per_box: float # ₹ (before negotiation)
    negotiated_price: Optional[float]  # ₹; None if no negotiation
    final_cost_per_box: float # ₹ (negotiated if set, else total)
    cost_basis: Literal['sheet', 'rsc']  # always 'sheet' for Sheet type [V2 Addition]
    bct_basis: Optional[Literal['box', 'sheet', 'null']]  # 'box' when optional dims present; None when absent [V2 Addition]

    # ── Quote line item state ─────────────────────────────
    selected: bool            # included in subtotal when True
    paper_mill: Optional[str] # display-only mill name annotation

    # ── Grouping (Feature B — see §34) [V2 Addition] ──────────────
    group_id: Optional[str]   # UUID of the QuoteItemGroup this item belongs to; None = ungrouped

    # ── V3 Additions ──────────────────────────────────────────────
    negotiated_price: Optional[float] = None        # [V3 Addition] accepted/locked override sell price (₹/box); set via negotiation timeline
    final_billing_price: Optional[float] = None     # [V3 Addition] billing truth (₹/box); = negotiated_price if set, else = final_cost_per_box
    source_type: str = 'manual'                     # [V3 Addition] origin of inputs — 'manual' | 'excel_import' | 'ai_pdf' | 'ai_email' | 'ai_image'
    extraction_confidence: Optional[float] = None   # [V3 Addition] overall AI confidence 0.0–1.0; None when source_type = 'manual'
```

### QuoteItemGroup entity [V2 Addition]

Group metadata tracked separately, referenced by `group_id` on member items.

```python
@dataclass
class QuoteItemGroup:
    id: str                         # UUID
    quote_id: str                   # parent quote UUID
    group_name: str                 # operator-entered display name, e.g. "Box A + Plate B + Partition C"
    group_code: Optional[str]       # optional short reference code, e.g. "SET-001"
    member_item_ids: List[str]      # ordered list of QuoteItem UUIDs (min 2); see V-G01
    group_total_sell_price: float   # computed: sum of (member.final_cost_per_box × member.quantity)
    created_by: str                 # user_id
    created_at: str                 # ISO 8601 datetime
```

> **Subtotal rule**: each member item's `selected = True` line is suppressed from the quote subtotal row when it belongs to a group. The group header contributes `group_total_sell_price` instead. (See §34.)

---

## §28 — EXECUTION MODES

The costing engine operates in four distinct modes. The Python backend must honour this model.

| Mode | Who runs it | When | Output |
|------|-------------|------|--------|
| **Preview** | Browser (frontend JS) | On every keypress / field change in calculator | Approximate live numbers for UX responsiveness |
| **Authoritative** | Python backend | On quote save (`POST /api/quotes`) | Canonical final numbers stored in `quoteVersions` |
| **Snapshot** | Stored at save time | Immutable after save | `quoteItemVersions.item_data_snapshot` JSONB |
| **Batch** | Python backend cron | Quote expiry checks, bulk recalc jobs | Side-effect only (status updates) |

### Preview vs Authoritative

The **frontend** runs all formulas client-side using cached master data (BF prices, flute settings) from the last API fetch. This is intentional — it gives instant feedback without a round-trip.

The **backend** re-runs every formula independently at save time, using fresh data read directly from the database within the same transaction. The backend result is the authoritative one. If there is a discrepancy (e.g., master data changed between the user's last load and their save), the backend value wins and is stored.

**Implementation rule**: The Python backend must implement the full formula chain in `app/services/costing.py` (or equivalent). It must NEVER trust the frontend-calculated numbers sent in the request body — it must recalculate from the raw inputs.

### Snapshot Immutability

Once a `quoteVersions` row is written:
- `paper_prices_snapshot` — immutable
- `flute_factor_*` / `flute_height_*` columns — immutable
- All computed totals (`subtotal`, `gst_amount`, `final_total`) — immutable

These are never updated in-place. A new version is always created for any change.

---

## §29 — VALIDATION RULES (MASTER LIST)

All validations the backend must enforce before running any formula. Return HTTP 422 with a structured error body on violation.

### Input Validations (reject before calculating)

| Rule | Field | Condition | Error |
|------|-------|-----------|-------|
| V01 | `length` | Must be > 0 | "Length must be greater than 0" |
| V02 | `width` | Must be > 0 | "Width must be greater than 0" |
| V03 | `height` | Must be > 0 for RSC type | "Height required for RSC boxes" |
| V04 | `ply` | Must be one of `1,3,5,7,9` | "Invalid ply value" |
| V05 | `flute_combination` | Must be in §1.6 allowed list for the given ply | "Invalid flute combination for ply N" |
| V06 | `gsm` | Must be 80–400 (inclusive) for each layer | "GSM must be between 80 and 400" |
| V07 | `bf` | Must be in §1.7 BF list for each liner layer | "BF value X is not a valid BF option" |
| V08 | `quantity` | Must be ≥ 1 | "Quantity must be at least 1" |
| V09 | `glue_flap` | Must be ≤ width | "Glue flap cannot exceed box width" |
| V10 | `layers` | Must not be empty | "No layers defined for this item" |

### Pricing Validations (reject during price calculation)

| Rule | Condition | Error |
|------|-----------|-------|
| P01 | BF price exists in `paper_bf_prices` for each liner layer's BF | "No price configured for BF [X]. Go to Paper Master." |
| P02 | `flute_settings` row exists for each flute type used | "No flute settings found for flute type [X]." |
| P03 | `paper_pricing_rules` row exists for tenant | "Paper pricing rules not configured. Run paper setup." |
| P04 | `paper_setup_completed = true` | "Paper Master setup is incomplete. Complete setup before calculating." |

### Business Logic Validations

| Rule | Condition | Error |
|------|-----------|-------|
| B01 | MOQ penalty: only if `moq_enabled = true` AND `quantity < print_moq` | (no error — penalty is applied, not blocked) |
| B02 | OD conversion: `boardThickness` must be > 0 before subtracting | "Board thickness unavailable for OD conversion" |
| B03 | Negotiation `fixed` mode: negotiation value must be > 0 | "Negotiated price must be greater than 0" |
| B04 | Transport charge: must be ≥ 0 | "Transport charge cannot be negative" |

### Sheet Mode — Optional Box Dimension Validations [V2 Addition]

Applied only when `item_type = 'sheet'`.

| Rule | Field(s) | Condition | Error |
|------|----------|-----------|-------|
| S01 | `box_length`, `box_width`, `box_height` | Must all be present (non-null) **or** all be absent (null). Partial entry (1 or 2 of 3 filled) is invalid. | "Box dimensions for Sheet mode must be complete — enter all three or leave all blank" |
| S02 | `box_length`, `box_width`, `box_height` | When all three are provided, each must be > 0 | "Each box dimension must be greater than 0" |
| S03 | `box_length`, `box_width`, `box_height` | Box dimensions are ignored for cost calculation even if present. BCT uses them; cost always uses sheet size. | (informational — no error, enforced by engine design) |
| S04 | `bct` output | If box dims absent (`S01` all-null pass), server must set `bct = null` and `bct_basis = null` in `CostingTrace` and snapshot | (enforced by engine, not a user-facing validation) |

### Grouped Quote Item Validations [V2 Addition]

Applied when creating or modifying a `QuoteItemGroup`.

| Rule | Condition | Error |
|------|-----------|-------|
| G01 | `member_item_ids` must contain ≥ 2 items | "A group must have at least 2 items" |
| G02 | All member items must have identical `quantity` values | "All items in a group must have the same quantity" |
| G03 | All member items must belong to the same parent quote (`quote_id`) | "Cannot group items from different quotes" |
| G04 | Each member item must have `group_id = null` before grouping (no multi-group membership) | "Item [X] already belongs to another group" |
| G05 | `group_name` must be non-empty string | "Group name is required" |
| G06 | On ungroup: deletes `QuoteItemGroup` record and sets `group_id = null` on all member items; does not delete or modify the items themselves | (enforced by API, not user-facing error) |

### AI Extraction Validations [V3 Addition]

Applied when `source_type` ≠ `'manual'` (i.e., item originated from AI extraction or Excel import).

| Rule | Condition | Error |
|------|-----------|-------|
| AI01 | `extraction_confidence` must be between 0.0 and 1.0 inclusive | "Confidence score must be between 0.0 and 1.0" |
| AI02 | When `extraction_confidence < 0.6` (low confidence), item draft `status` must be `'review'` — cannot advance to `'ready'` without a manual field-level override | "Low-confidence item must be reviewed before costing" |
| AI03 | `negotiated_price`, if provided on an AI-origin item, must be > 0 | "Negotiated price must be greater than 0" |
| AI04 | `final_billing_price` must never be null on a saved quote — it defaults to `final_cost_per_box` when `negotiated_price` is not set | (enforced by engine before save; not a user-facing error) |
| AI05 | `source_type` must be one of: `'manual'`, `'excel_import'`, `'ai_pdf'`, `'ai_email'`, `'ai_image'` | "Invalid source_type value" |

### Bulk Import Row Validations [V3 Addition]

Applied per row during bulk costing import (Excel or AI-extracted). See §37 for row normalization rules.

| Rule | Condition | Error |
|------|-----------|-------|
| BK01 | At least one of: RSC dimensions (L, W, H) or Sheet dimensions (L, W) must be resolvable from the import row | "Row [N]: Could not extract box dimensions — row blocked" |
| BK02 | If ply or flute combination is missing and cannot be inferred from pattern matching, row `status` must be `'blocked'` | "Row [N]: Ply/flute combination missing — needs manual entry" |
| BK03 | If `quantity` is missing or zero, it defaults to `1` and a warning is added to the row's `warnings` list | (warning-only — row proceeds to `'review'` status) |
| BK04 | Rows where any field required for cost calculation has `extraction_confidence < 0.6` must be assigned `status = 'review'`; the engine must not auto-cost them until confidence is accepted by a user | "Row [N]: Required field has low AI confidence — manual review required" |

---

## §30 — CALCULATION TRACE FORMAT

The Python costing service must return a structured trace alongside every authoritative calculation. This is stored in `quoteItemVersions.item_data_snapshot` and used for auditing pricing discrepancies.

### Trace Step Object

```python
@dataclass
class CalcStep:
    step: int            # sequential number (1-based)
    label: str           # human-readable name e.g. "Sheet Length (F01)"
    formula: str         # symbolic formula string e.g. "2 × (L + W) + GlueFlap"
    inputs: dict         # all input values used  e.g. {"L": 400, "W": 300, "GlueFlap": 45}
    output: float        # numeric result
    unit: str            # unit of output e.g. "mm", "kg", "₹", "kN/m"
    notes: list[str]     # optional transparency notes e.g. ["No BF price; BLOCKED"]
```

### Full Trace Structure

```python
@dataclass
class CostingTrace:
    quote_item_id: str
    formula_version: str    # e.g. "1.0" — from §31
    calculated_at: str      # ISO 8601
    steps: list[CalcStep]
    result: CostingResult   # final outputs (all computed fields)
    warnings: list[str]     # non-blocking notes
    errors: list[str]       # blocking errors (if any; normally empty if calc succeeded)
    cost_basis: Literal['sheet', 'rsc']   # [V2 Addition] always 'sheet' for Sheet type items
    bct_basis: Optional[str]              # [V2 Addition] 'box' | None — None when Sheet mode and no box dims entered

    # ── V3 Additions ──────────────────────────────────────────────
    source_type: str = 'manual'                          # [V3 Addition] origin of inputs — 'manual' | 'excel_import' | 'ai_pdf' | 'ai_email' | 'ai_image'
    confidence_score: Optional[float] = None             # [V3 Addition] overall AI extraction confidence 0.0–1.0; None for manual entries
    extraction_method: Optional[str] = None              # [V3 Addition] AI model/pattern used e.g. "llm_v1", "regex_v3_rsc"; None for manual
    low_confidence_fields: list[str] = field(default_factory=list)  # [V3 Addition] field names where individual confidence < 0.6
```

### Canonical Step Labels (in order)

| Step | Label | Formula ref |
|------|-------|-------------|
| 1 | ID/OD Dimension Adjust | §4 |
| 2 | Sheet Length (F01) | F01 |
| 3 | Sheet Width (F02) | F02 |
| 4 | Board Thickness (F13) | F13 |
| 5 | Layer Weight × N (F06) | F06 per layer |
| 6 | Sheet Weight (F07) | F07 |
| 7 | Paper Rate × N (F08) | F08 per layer |
| 8 | Paper Cost (F09) | F09 |
| 9 | Burst Strength (F10) | F10 |
| 10 | ECT (F11) | F11 |
| 11 | BCT McKee (F12) | F12 |
| 12 | Printing Cost (F14) | F14 |
| 13 | Lamination Cost (F15) | F15 |
| 14 | Die Cost (F16) | F16 |
| 15 | Punching/Varnish Cost (F17) | F17 |
| 16 | Conversion Cost (F18) | F18 |
| 17 | Total Cost per Box (F19) | F19 |
| 18 | Subtotal (F20) | F20 |
| 19 | Transport | §18B |
| 20 | GST Amount (F21) | F21 |
| 21 | Round-Off (F22) | F22 |
| 22 | Grand Total (F23) | F23 |

#### Sheet Mode step label notes [V2 Addition]

When `item_type = 'sheet'`, steps 2 and 3 use sheet-specific labels:

| Step | Sheet Mode Label | Formula ref |
|------|-----------------|-------------|
| 2 | Sheet Length — from flat sheet size (F03) | F03 |
| 3 | Sheet Width — from flat sheet size (F04) | F04 |

Step 11 (BCT McKee) is **conditional** in Sheet mode:
- If optional box dimensions are present (`box_length`, `box_width`, `box_height` all non-null): step runs using box dims. Label: `"BCT McKee — box dimensions (F12)"`.
- If optional box dimensions absent: step is **skipped**. Trace emits a stub step with `output = null` and `notes = ["BCT skipped — no box dimensions entered in Sheet mode"]`.

#### Group total trace note [V2 Addition]

For grouped items, the quote-level trace must include an additional step after step 18 (Subtotal):

| Step | Label | Formula ref |
|------|-------|-------------|
| 18b | Group Total — commercial sum of grouped member items | §34.1 |

This step records `group_id`, the list of member item IDs, each member's `final_cost_per_box × quantity`, and the `group_total_sell_price` sum.

---

## §31 — FORMULA VERSIONING

### Version Identifier

Every quote version stores the formula revision used to produce it. This allows future formula changes to be applied without invalidating old quotes.

**Field**: `quoteVersions.formula_version VARCHAR(10)` — e.g. `"1.0"`

**Current version**: `"1.0"`

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-10 | Initial canonical version. All formulas F01–F23 as documented in this file. Transport integrated. Markup from admin. BF missing price = BLOCK. |
| 1.1 | [V3 Addition] | Minor bump: new output fields only — no formula logic changed. Added `negotiated_price`, `final_billing_price`, `source_type`, `extraction_confidence` on `QuoteItem`; added `source_type`, `confidence_score`, `extraction_method`, `low_confidence_fields` on `CostingTrace`. New V3 validation codes AI01–AI05 and BK01–BK04. |

### Rules for Bumping the Version

| Change type | Version bump |
|-------------|-------------|
| New formula added (new output field) | Minor: `1.0` → `1.1` |
| Existing formula logic changed (same output, different calculation) | Major: `1.0` → `2.0` |
| Constants changed (e.g. McKee factor) | Major |
| DB schema-only change, no formula logic change | No bump |

### Backend Implementation

```python
CURRENT_FORMULA_VERSION = "1.1"  # [V3 Addition] bumped from 1.0

def save_quote_version(db, quote_id, costing_result, trace):
    db.execute("""
        INSERT INTO quote_versions (
            quote_id, formula_version, subtotal, gst_amount,
            final_total, paper_prices_snapshot, ...
        ) VALUES (
            :quote_id, :fv, :subtotal, :gst_amount,
            :final_total, :snapshot, ...
        )
    """, {
        "fv": CURRENT_FORMULA_VERSION,
        "snapshot": json.dumps(costing_result.paper_prices_snapshot),
        ...
    })
```

When displaying a saved quote in the UI, `formula_version` is shown in the quote metadata panel so operators can tell at a glance whether a quote was built with an older formula.

---

## §32 — INTERNATIONAL FORMULA CONSIDERATIONS

### 32.1 Tax Model Variations

Formula F21 (GST/Tax) uses a single GST rate from `business_defaults.default_gst_percent`. This works for India's corrugated box GST (currently 12% or 18% depending on classification, or 5% for certain packaging).

For international deployments, the tax model must be adapted:

| Country/Region | Tax type | Typical rate | Formula impact |
|---------------|----------|-------------|----------------|
| India | GST (CGST + SGST, or IGST) | 12–18% on packaging | F21 unchanged; `igst_applicable` flag in `business_defaults` controls whether to split as CGST+SGST |
| UAE | VAT | 5% | F21 unchanged; rename label to "VAT" in PDF |
| EU | VAT | 19–22% | F21 unchanged; rate configurable per tenant |
| USA | Sales tax | 0–10% (state-dependent) | F21 unchanged; rate configurable per tenant |
| Singapore | GST | 9% | F21 unchanged |
| Malaysia | SST | 6% | F21 unchanged |
| UK | VAT | 20% | F21 unchanged |

**Implementation**: `business_defaults.default_gst_percent` is the single tax rate used in F21. The label shown in the PDF/quote ("GST", "VAT", "Tax") is controlled by a `tax_label` field (add to `business_defaults`, default `'GST'`).

```sql
ALTER TABLE business_defaults ADD COLUMN IF NOT EXISTS
    tax_label VARCHAR(20) NOT NULL DEFAULT 'GST';
    -- India: 'GST'  |  UAE: 'VAT'  |  EU: 'VAT'  |  USA: 'Tax'
```

### 32.2 Board Height Convention

The RSC H-dimension adjustment (F05, §4) uses the convention: `H_inner = H_outer - boardThickness` (subtract one board thickness for height). This is the **single-fold** convention — one thickness subtracted because the bottom fold only accounts for one panel face.

Some markets (notably UK/EU suppliers) use the **double-fold** convention: `H_inner = H_outer - 2 × boardThickness`. If a factory outside India uses the double-fold convention, the ply setting in `business_defaults` (or an explicit `h_fold_convention` flag) must toggle the formula:

```python
if h_fold_convention == 'single':
    h_inner = h_outer - board_thickness          # current BoxCostPro default
else:  # 'double'
    h_inner = h_outer - 2 * board_thickness
```

Add `h_fold_convention VARCHAR(10) DEFAULT 'single' CHECK (h_fold_convention IN ('single','double'))` to `business_defaults`.

### 32.3 BCT Formula Variants (McKee)

BoxCostPro uses the **Simplified McKee** formula (F12, §10):
```
BCT = 5.87 × ECT × sqrt(boardThickness × boxPerimeter_cm)
```

Other variants are used in different markets:
- **Modified McKee** (adds compression eccentricity factor): used in North American standard TAPPI T804.
- **Complex McKee** (includes humidity correction): used in EU for export packaging.

For Phase 1 (India + initial international), the Simplified McKee is sufficient and widely accepted. A `bct_formula` tenant setting can be added later to switch variants without changing stored quotes (each quote already stores `formula_version`).

### 32.4 Weight Units

BoxCostPro stores all weights in **grams (g)** internally. Display formatting can show g or kg based on `business_defaults.locale`:
- India: typically display as g/m² (GSM) and Kg for sheet weight
- EU/USA: same units, but decimal formatting differs (see §1.10)

### 32.5 Dimension Units

All dimensions are stored and calculated in **mm**. The calculator supports three user-facing input units:

| Unit | `dimension_unit` value | Conversion to mm |
|------|------------------------|-----------------|
| Millimetres | `'mm'` | ×1 (unchanged) |
| Centimetres | `'cm'` | `cm × 10 = mm` |
| Inches | `'inch'` | `inch × 25.4 = mm` |

Rules:
- The formula engine **always receives mm**. Conversion happens at the UI input layer only.
- `dimension_unit` is stored in `business_defaults` per tenant; it is a display/entry preference, not a data-storage format. All saved quote dimensions are always in mm.
- **Glue Flap** and **Deckle Allowance** are **always entered in mm** regardless of `dimension_unit` — they are internal manufacturing tolerances, not box dimensions.

```sql
-- business_defaults: supported dimension_unit values
ALTER TABLE business_defaults
    ADD COLUMN IF NOT EXISTS dimension_unit VARCHAR(6) NOT NULL DEFAULT 'mm'
    CHECK (dimension_unit IN ('mm', 'cm', 'inch'));
```

Python conversion helper (call before passing any dimension to the formula engine):
```python
def to_mm(value: float, unit: str) -> float:
    """Convert user-entered dimension value to millimetres."""
    if unit == 'cm':   return value * 10
    if unit == 'inch': return value * 25.4
    return value  # already mm
```

---

*End of §32*

---

## §33 — SHEET MODE WITH OPTIONAL BOX DIMENSIONS [V2 Addition]

This section is the single authoritative reference for how Sheet-type items handle the optional box dimension inputs. All other sections that reference sheet mode or BCT in sheet mode must be consistent with this section.

### 33.1 Cost Basis Rule

> **Rule**: For all items where `item_type = 'sheet'`, the **cost basis is always the sheet size**, regardless of whether optional box dimensions are entered.

- The costing engine computes `sheet_length` (F03) and `sheet_width` (F04) from the entered flat sheet dimensions.
- These sheet dimensions drive all cost formulas: paper area, paper cost, layer weight, sheet weight, conversion cost, etc.
- The optional box dimensions (`box_length`, `box_width`, `box_height`) do **not** affect any cost formula.
- `cost_basis` field on `CostingTrace` must be set to `'sheet'` for all Sheet-type items.

### 33.2 BCT Basis Rule

> **Rule**: BCT is computed for Sheet-type items **only when all three optional box dimensions are present and valid**. If any are absent, BCT is null.

| State | `bct_basis` | `bct` output | BCT step in trace |
|-------|------------|-------------|-------------------|
| All three box dims provided (non-null, > 0) | `'box'` | Computed via F12 using **box dims** | Step 11 runs: `"BCT McKee — box dimensions (F12)"` |
| No box dims provided (all null) | `null` | `null` | Step 11 skipped; stub emitted with `output = null` |
| Partial dims provided (1 or 2 of 3) | — | — | **Hard validation error S01 is raised before engine runs** |

When `bct_basis = 'box'`:
```
boxPerimeter_cm = 2 × (box_length + box_width) / 10
BCT = 5.87 × ECT × sqrt(boardThickness × boxPerimeter_cm)
```
`box_length` and `box_width` here are the **optional box dimensions**, not the sheet dimensions.

### 33.3 Validation Rule (All-or-Nothing)

A partial entry of box dimensions in Sheet mode is a **hard error** — the backend returns HTTP 422 and blocks save / add-to-quote.

- Rule reference: **S01** (§29)
- Rule text: All three of `box_length`, `box_width`, `box_height` must be provided together, or all must be absent.
- Frontend must enforce this before submitting; backend must independently enforce it.

### 33.4 Quote Display Rules

| Condition | "Box Size" column in quote | BCT row in quote |
|-----------|---------------------------|-----------------|
| Sheet mode, no box dims | Hidden / blank | Hidden / blank |
| Sheet mode, box dims present | Shows formatted `box_length × box_width × box_height` in `dimension_unit` | Shows computed BCT value |
| RSC mode | Shows `length × width × height` (always present) | Always shown |

- The "Box Size" label in quote output for Sheet-mode items with box dims must be annotated (e.g., "(die-cut box size — for reference only)") to make clear it is not the costing basis.
- The cost breakdown, per-box cost, and subtotal lines always reflect sheet costing only.

### 33.5 Calculation Trace Notes

The `CostingTrace` for a Sheet-type item must include:
1. `cost_basis = 'sheet'` (always).
2. `bct_basis = 'box'` or `null` (depending on box dim presence).
3. Step 11 outcome as described in §33.2.
4. If box dims are present, `inputs` of step 11 must include `box_length`, `box_width`, `box_height` to distinguish them from sheet dims.

---

## §34 — GROUPED QUOTE ITEMS / PRODUCT SETS [V2 Addition]

This section covers how multiple quote items can be combined into a single named commercial group (e.g., "Box + Plate + Partition Set"). All other sections that reference grouping must be consistent with this section.

### 34.1 Group Total Formula

```
group_total_sell_price = Σ (member_i.final_cost_per_box × member_i.quantity)
```

where the sum is over all items in `member_item_ids`.

- `final_cost_per_box` is the post-negotiation per-box price (or `total_cost_per_box` if no negotiation).
- Each member's quantity is maintained independently. All members must have the same quantity value (V1 constraint — rule G02 in §29).
- `group_total_sell_price` is **recomputed** whenever any member item is edited or recalculated.

### 34.2 Subtotal Contribution Rule

When a `QuoteItemGroup` exists:
- **Member items** (`group_id ≠ null`): each member's total line is suppressed from the quote subtotal. Their individual `selected = true` lines do not contribute directly to the quote subtotal row.
- **Group header** (the `QuoteItemGroup` record): contributes `group_total_sell_price` as a single commercial line to the subtotal.

```
quote_subtotal = Σ (ungrouped_selected_items.final_cost_per_box × quantity)
               + Σ (active_groups.group_total_sell_price)
```

### 34.3 Validation Rules (V1)

As defined in §29 (rules G01–G06), applicable for V1:

| Constraint | Value |
|-----------|-------|
| Minimum group members | 2 |
| Maximum group members | No V1 limit (practical limit: number of items in the quote) |
| Quantity requirement | All members must have identical `quantity` |
| Scope | Same quote only (no cross-quote grouping) |
| Multi-group membership | Not permitted — each item can belong to at most one group |
| Group name | Required, non-empty |
| Group code | Optional |

### 34.4 Audit Requirement

The following group events must be recorded in the audit log:

| Event | `action` value | Payload |
|-------|---------------|---------|
| Group created | `group_created` | `group_id`, `group_name`, `member_item_ids`, `created_by` |
| Group dissolved | `group_dissolved` | `group_id`, `group_name`, `member_item_ids`, `dissolved_by` |
| Group name/code edited | `group_edited` | `group_id`, changed fields before/after |
| Grouped item price edited | `grouped_item_price_edited` | `item_id`, `group_id`, old/new `final_cost_per_box` |

### 34.5 RBAC for Grouping

| Role | Create group | Edit group name/code | Dissolve group | View groups |
|------|-------------|---------------------|----------------|-------------|
| Owner | ✅ any quote | ✅ any quote | ✅ any quote | ✅ |
| Admin | ✅ any quote | ✅ any quote | ✅ any quote | ✅ |
| Manager | ✅ any quote | ✅ any quote | ✅ any quote | ✅ |
| Salesperson | ✅ own quotes | ✅ own quotes | ✅ own quotes | ✅ |
| Viewer | ❌ | ❌ | ❌ | ✅ (read-only) |

### 34.6 Lifecycle and Persistence

- Groups and their member assignments **must persist** in all quote versions and snapshots.
- When a quote version is created (e.g., quote is submitted, or edit → new version), the `QuoteItemGroup` record is cloned into the version snapshot JSONB alongside member item snapshots.
- Snapshots store the `group_total_sell_price` value at the time of the snapshot — it is immutable after snapshot creation.
- If a member item is deleted from a quote, it must first be removed from any group it belongs to (or the group dissolved if this leaves fewer than 2 members).

---

## §35 — NEGOTIATED PRICE VS FINAL BILLING PRICE [V3 Addition]

This section defines the authoritative distinction between the formula engine's output price and the price ultimately billed to the customer. This is required because real-world negotiation can accept a price different from the computed cost-plus-markup output.

### 35.1 Field Definitions

| Field | Type | Source | Meaning |
|-------|------|--------|---------|
| `total_cost_per_box` | `float` | Formula engine (F19) | Pure cost-plus-markup calculated value. Never manually altered. |
| `final_cost_per_box` | `float` | Formula engine post-negotiation | = `total_cost_per_box` adjusted by `negotiation_mode` (percentage or fixed); or = `total_cost_per_box` if negotiation mode is `'none'`. |
| `negotiated_price` | `Optional[float]` | [V3] Explicit manual override set via negotiation timeline | When set, represents the accepted/locked sell price confirmed in a negotiation round. Stored separately; does not overwrite `total_cost_per_box`. |
| `final_billing_price` | `Optional[float]` | [V3] Derived from the above; billing truth | = `negotiated_price` if set; else = `final_cost_per_box`. This is the price used in invoice generation and Tally push. |

### 35.2 Formula

```
final_billing_price =
    negotiated_price           if negotiated_price IS NOT NULL and negotiated_price > 0
    else final_cost_per_box
```

**Constraints**:
- `total_cost_per_box` is **never** modified by negotiation. It always reflects the engine output.
- `final_billing_price` is the **only field** used for invoice creation, Tally export, and billing reports.
- Audit log must record both `final_cost_per_box` and `final_billing_price` at the time of each quote version snapshot so historical billing accuracy can be verified.

### 35.3 Negotiation Timeline

`negotiated_price` is set through the negotiation timeline flow (see `02-system-flow-master.md §37`), not by directly editing the calculator field. Each negotiation round creates a `negotiation_events` record with the offered/accepted price and a timestamp:

```python
@dataclass
class NegotiationEvent:
    id: str                  # UUID
    quote_id: str
    item_id: str
    round_number: int        # 1-based; each accept/counter creates a new round
    event_type: Literal['offer', 'counter', 'accept', 'reject']
    price_offered: float     # ₹/box offered in this round
    offered_by: str          # user_id
    note: Optional[str]      # free-text reason or comment
    created_at: str          # ISO 8601
```

When `event_type = 'accept'`, `negotiated_price` on the `QuoteItem` is set to `price_offered` and `final_billing_price` is recomputed.

### 35.4 Group Items — Negotiation Rule

For a grouped item (`group_id ≠ null`), negotiation modifies the **individual member item's** `negotiated_price`. The `group_total_sell_price` is then recomputed from the updated member `final_billing_price` values:

```
group_total_sell_price (V3) = Σ (member_i.final_billing_price × member_i.quantity)
```

Note: this supersedes the §34.1 formula which used `final_cost_per_box`. V3 uses `final_billing_price` for all totalling.

---

## §36 — AI EXTRACTION CONFIDENCE MODEL [V3 Addition]

This section defines how the system models and communicates AI extraction reliability for items sourced from PDF, email, image, or Excel import.

### 36.1 Confidence Tiers

| Tier | Score Range | Label | Behaviour |
|------|------------|-------|-----------|
| High | 0.85 – 1.00 | ✅ Auto-accepted | Field value used directly in costing engine. No manual review required. |
| Medium | 0.60 – 0.84 | ⚠️ Review recommended | Field pre-filled but highlighted. User can accept-as-is or edit. Costing proceeds after explicit acceptance. |
| Low | 0.00 – 0.59 | 🔴 Review required | Field flagged. Row `status` must be `'review'`. Engine will not auto-cost this item until user has accepted or corrected the value. |

### 36.2 Field-Level Confidence

Each extracted field carries its own confidence score. The `CostingTrace.low_confidence_fields` list contains the names of fields where confidence < 0.60.

**Field confidence payload example:**
```json
{
  "field_confidence": {
    "length":   { "value": 400, "confidence": 0.97, "tier": "high" },
    "width":    { "value": 300, "confidence": 0.95, "tier": "high" },
    "height":   { "value": 200, "confidence": 0.88, "tier": "high" },
    "ply":      { "value": "3", "confidence": 0.72, "tier": "medium" },
    "flute":    { "value": "B", "confidence": 0.58, "tier": "low" },
    "gsm_l1":   { "value": 150, "confidence": 0.45, "tier": "low" }
  }
}
```

### 36.3 Overall Item Confidence

`CostingTrace.confidence_score` (overall) = minimum confidence across all fields that are **required for cost calculation** (i.e., dimensions, ply, flute, GSM). Optional/display fields (box dims in sheet mode, box description) are excluded from the minimum.

```python
def compute_overall_confidence(field_confidence: dict, required_fields: list[str]) -> float:
    scores = [field_confidence[f]["confidence"] for f in required_fields if f in field_confidence]
    return min(scores) if scores else 1.0
```

### 36.4 Formula Disclaimer Rule

When any required field's confidence is below `0.85` (medium or low), the `CostingTrace.warnings` list must include:

```
"WARNING: One or more fields were auto-extracted with less than full confidence.
 Review flagged values before using this costing for commercial decisions."
```

When confidence < 0.60 on a cost-critical field, additionally:
```
"BLOCKED: Field '{field_name}' has low extraction confidence (score: {score:.2f}).
 Manual review required before costing can proceed."
```

### 36.5 Pattern Matching vs LLM Models

The `CostingTrace.extraction_method` field records which extraction strategy was used:

| Value | Description |
|-------|-------------|
| `'regex_v{N}_rsc'` | Tenant or global regex pattern for RSC-type spec lines |
| `'regex_v{N}_sheet'` | Tenant or global regex pattern for sheet-type spec lines |
| `'llm_v1'` | Full LLM-based agent extraction (used as fallback when regex has low confidence) |
| `'llm_v1_enhanced'` | LLM + domain-specific corrugated packaging grammar |
| `'manual'` | User entered data by hand (no AI involved) |

The extraction pipeline tries pattern matching first. If confidence is below an acceptance threshold (configurable in AI admin settings), it falls back to LLM extraction.

---

## §37 — BULK IMPORT ROW NORMALIZATION RULES [V3 Addition]

This section defines the normalization rules applied to each row imported via Excel upload or AI extraction before the costing engine runs.

### 37.1 Common Draft Costing Row

All bulk import sources (Excel, AI PDF, AI email, AI image) produce rows in the same **Common Draft Costing Row** format before any costing calculations run.

```python
@dataclass
class DraftCostingRow:
    # ── Identity ─────────────────────────────────────────
    id: str                          # UUID (generated on import)
    import_job_id: str               # UUID of the parent bulk import job
    row_number: int                  # 1-based position in source file / extraction batch
    source_type: str                 # 'excel_import' | 'ai_pdf' | 'ai_email' | 'ai_image'

    # ── Extracted / Entered Fields (pre-normalization) ───
    raw_data: dict                   # original extracted key-value dict before normalization

    # ── Normalized Fields (post-normalization) ───────────
    box_name: Optional[str]
    item_type: Optional[Literal['rsc', 'sheet']]
    length: Optional[float]          # inner mm
    width: Optional[float]           # inner mm
    height: Optional[float]          # inner mm (RSC); None for Sheet
    ply: Optional[str]               # '1','3','5','7','9'
    flute_combination: Optional[str]
    quantity: int = 1               # defaults to 1 if missing (BK03)
    gsm_layers: Optional[list]       # list of GSM values per layer
    bf_layers: Optional[list]        # list of BF values per liner layer

    # ── Confidence ───────────────────────────────────────
    field_confidence: Optional[dict] # field-level confidence scores (AI sources only)
    overall_confidence: Optional[float]  # §36.3

    # ── Status ───────────────────────────────────────────
    status: Literal['draft', 'review', 'ready', 'blocked', 'costed']
    warnings: list[str]              # non-blocking notes
    errors: list[str]                # blocking error messages

    # ── Output (post-costing) ─────────────────────────────
    costing_result: Optional[dict]   # Populated when status advances to 'costed'
```

### 37.2 Status Flow

```
Source file / extraction
        ↓
   [Normalization]
        ↓
   'draft'  →  [Validation]  →  'ready'   → [Costing engine] → 'costed'
               (errors found)  ↓
               'blocked'    (warnings only) → 'review' → [User accepts] → 'ready'
```

- `'draft'`: Freshly normalized; validation not yet run.
- `'review'`: Validation passed but low-confidence fields or missing-but-defaulted fields require human sign-off.
- `'ready'`: All required fields present, confidence accepted (or user-overridden). Engine can cost this row.
- `'blocked'`: Hard validation error (BK01, BK02). Engine will not run; row needs manual correction.
- `'costed'`: Engine has produced a `CostingResult`. Row can be promoted to a full `QuoteItem`.

### 37.3 Normalization Steps

In order:
1. **Dimension parsing**: Parse dimension strings from raw_data (handles "400×300×200", "400 x 300 x 200", "L400 W300 H200", etc.) → store as `length`, `width`, `height` floats in mm.
2. **Unit detection**: Detect if source is in mm, cm, or inches from context; convert to mm.
3. **Type inference**: Infer `item_type` ('rsc' or 'sheet') from the presence of height dimension or explicit "sheet"/"rsc" label.
4. **Ply/flute parsing**: Parse "3-ply B flute", "5LB", "DF" (double-face) etc. Map to canonical ply + flute combination.
5. **GSM/BF parsing**: Map paper grade strings (e.g. "150/120/150 GSM") to layer assignments.
6. **Quantity parsing**: Parse "1000 Nos", "Qty: 500", bare integers.
7. **Confidence assignment**: For AI sources, attach field-level confidence from extraction engine. For Excel, mark all fields as `confidence = 1.0` (trusted human input).
8. **Validation run**: Apply BK01–BK04 and standard V01–V10 validations. Set `status` accordingly.

### 37.4 Dimension String Patterns (Reference)

The normalization engine must handle at minimum:

| Pattern | Example | Parse result |
|---------|---------|-------------|
| Separator × with spaces | `400 × 300 × 200` | L=400, W=300, H=200 |
| Lowercase x | `400x300x200` | L=400, W=300, H=200 |
| Named fields | `L 400 W 300 H 200` | L=400, W=300, H=200 |
| Slash separator | `400/300/200` | L=400, W=300, H=200 |
| Two-dim (sheet) | `450 × 300` | L=450, W=300, H=None |
| With unit annotations | `400mm × 300mm × 200mm` | Convert, L=400, W=300, H=200 |
| With "Inner" label | `Inner: 400×300×200` | Strip label, same result |

---

## §38 — JOB CARD & QA DATA DERIVATION [V3 Addition]

This section defines which costing fields feed job card and QA report generation. These are downstream derivative documents produced from an accepted (final billing) quote item.

### 38.1 Derivation Principle

> Job card and QA report are **read-only projections** of a saved quote item. They never modify costing data. All values are sourced from the immutable `quoteItemVersions.item_data_snapshot`.

### 38.2 Job Card Fields and Source Mapping

| Job Card Field | Source Field / Formula |
|---------------|------------------------|
| **Box Spec** | |
| Box reference / name | `QuoteItem.box_name` |
| Item type | `QuoteItem.type` (RSC / Sheet) |
| Inner dimensions (L × W × H mm) | `length`, `width`, `height` |
| Outer dimensions | Derived: `inner + boardThickness × 2` (display only) |
| Ply | `QuoteItem.ply` |
| Flute combination | `QuoteItem.flute_combination` |
| Board thickness (mm) | `CostingTrace.boardThickness` (step 4 output) |
| **Paper Spec** | |
| Layer-wise paper (GSM / BF / Shade) | `QuoteItem.layers[*].gsm`, `.bf`, `.shade` |
| Sheet size (L × W mm) | `sheet_length`, `sheet_width` (F01/F02 or F03/F04) |
| Sheet weight (kg) | `sheet_weight` (F07) |
| **Add-Ons** | |
| Printing | `print_type`, `print_colours`, `cost_per_print` |
| Lamination | `lamination_rate` (if enabled) |
| Die | `die_development_charge` (if enabled) |
| **Production Numbers** | |
| Quantity | `quantity` |
| Final sell price / box | `final_billing_price` |
| Total order value | `final_billing_price × quantity` |
| **Quality Targets** | |
| BCT (kg) | `bct` output (if available) |
| BS (kgf/cm²) | `bs` output |
| ECT (kN/m) | `ect` output |

### 38.3 QA Report Checklist Derivation

The QA report contains pass/fail check items whose targets come directly from the costing trace:

| QA Check | Target Value | Source |
|----------|-------------|--------|
| Ply count match | `ply` value | `QuoteItem.ply` |
| Board thickness ± 0.5 mm tolerance | `boardThickness` ± 0.5 | Step 4 output |
| GSM per layer (each liner): ± 5 gsm | `layer.gsm` | `QuoteItem.layers[*]` |
| BF per liner layer | `layer.bf` | `QuoteItem.layers[*]` |
| BCT ≥ target (if bct_basis = 'box') | `bct` | F12 output |
| ECT ≥ target | `ect` | F11 output |
| Sheet size match (± 2 mm) | `sheet_length × sheet_width` | F03/F04 outputs |
| Quantity received matches PO | `quantity` | `QuoteItem.quantity` |

QA report `status` per check: `'pass'` / `'fail'` / `'not_applicable'`. The template includes space for the actual measured value beside each target.

---

## §39 — PRICE INCREASE COMPARISON FORMULAS [V3 Addition]

This section defines the formulas used in the price increase workflow. Price increases are applied when raw material costs rise and existing quoted prices need updating.

### 39.1 Core Definitions

| Symbol | Meaning |
|--------|---------|
| `P_old` | `final_billing_price` (₹/box) from the most recent accepted quote version |
| `P_new` | New `final_cost_per_box` after recalculating with updated master data (new BF prices) |
| `Δ_abs` | Absolute difference: `P_new - P_old` |
| `Δ_pct` | Percentage change: `(Δ_abs / P_old) × 100` |

### 39.2 Price Increase Formulas

**Absolute increase:**
```
Δ_abs = P_new - P_old
```

**Percentage increase:**
```
Δ_pct = ((P_new - P_old) / P_old) × 100
```
(Positive = increase; negative = decrease)

**Proposed new billing price (default = P_new, can be overridden):**
```
proposed_price = P_new   # default; operator can adjust before sending
```

### 39.3 Batch Price Increase

For a batch of quote items to the same client, the aggregate impact is:

```
total_old_value   = Σ (item_i.P_old × item_i.quantity)
total_new_value   = Σ (item_i.proposed_price × item_i.quantity)
overall_Δ_abs     = total_new_value - total_old_value
overall_Δ_pct     = (overall_Δ_abs / total_old_value) × 100
```

### 39.4 Price Increase Event Record

Each price increase proposal creates a `price_increase_events` record (see `03-admin-flow-master.md §28` for table DDL):

```python
@dataclass
class PriceIncreaseEvent:
    id: str                    # UUID
    tenant_id: str
    quote_item_id: str
    old_price: float           # P_old
    new_calculated_price: float  # P_new from engine
    proposed_price: float      # operator-set, defaults to P_new
    delta_abs: float           # Δ_abs
    delta_pct: float           # Δ_pct
    reason: Optional[str]      # e.g. "BF price increase April 2026"
    status: Literal['proposed', 'accepted', 'rejected', 'sent']
    created_by: str            # user_id
    created_at: str            # ISO 8601
```

---

## §40 — SPECIFICATION SHEET AS DERIVATIVE OUTPUT [V3 Addition]

This section defines the data fields and derivation rules for the **Specification Sheet** — a structured, single-page document summarising the technical specification of a quoted box. It is distinct from the customer quote (commercial document) and the job card (production document).

### 40.1 Purpose

The Specification Sheet is shared with:
- The paper mill (for material ordering)
- The customer's QA team (for incoming inspection)
- Internal engineering/design (for die development or printing plate setup)

It is a **reference-only document** — it contains no pricing information.

### 40.2 Specification Sheet Field Derivation

| Spec Sheet Section | Field | Source |
|-------------------|-------|--------|
| **Box Identity** | Box name / reference | `QuoteItem.box_name` |
| | Item type (RSC / Sheet) | `QuoteItem.type` |
| | Ply | `QuoteItem.ply` |
| | Flute combination | `QuoteItem.flute_combination` |
| **Dimensions** | Inner L × W × H (mm) | `length`, `width`, `height` |
| | Sheet size (mm) | `sheet_length × sheet_width` |
| | Board thickness (mm) | `boardThickness` (step 4) |
| **Board Specification** | Layer-wise paper (position, GSM, BF, shade) | `QuoteItem.layers[*]` |
| | Board grammage (g/m²) | Derived: `sheet_weight / (sheet_length × sheet_width / 1,000,000)` |
| **Structural Properties** | BCT (kg) | `bct` (F12; when available) |
| | BS (kgf/cm²) | `bs` (F10) |
| | ECT (kN/m) | `ect` (F11) |
| **Print / Finish** | Print type & colours | `print_type`, `print_colours` |
| | Lamination | `lamination_rate`, `lamination_type` |
| **Quantity** | Order quantity | `quantity` |
| **Reference** | Quote number | `quote_id` / `quote_version.quote_number` |
| | Created date | `created_at` |
| | Formula version | `CostingTrace.formula_version` |

### 40.3 Pricing Excluded

No pricing field (`total_cost_per_box`, `final_billing_price`, `paper_cost`, etc.) must appear on the Specification Sheet. Its purpose is purely technical specification.

### 40.4 Spec Sheet Generation Rule

```python
def generate_spec_sheet_data(snapshot: dict) -> dict:
    """
    Extract only the non-pricing fields from a quoteItemVersions.item_data_snapshot
    for use in Specification Sheet PDF generation.
    Price and negotiation fields are explicitly excluded.
    """
    excluded = {
        'total_cost_per_box', 'final_cost_per_box', 'final_billing_price',
        'negotiated_price', 'paper_cost', 'printing_cost', 'lamination_cost',
        'die_cost', 'punching_cost', 'conversion_cost', 'varnish_cost',
        'negotiation_mode', 'negotiation_value', 'extraction_confidence',
    }
    return {k: v for k, v in snapshot.items() if k not in excluded}
```

---

## §41 — ACCOUNTING EXPORT DATA MAPPING [V3 Addition]

This section defines the canonical mapping from BoxCostPro's internal data model to the `AccountingExportPayload` dataclass (see §47.2 of 02-system-flow-master.md). All accounting integrations (Tally, Zoho, QuickBooks, Busy, CSV, Webhook) derive their output from this mapping.

### 41.1 Trigger Data — Which Quote Data Is Exported

Only **accepted** quote items are exported to accounting software. The export scope:

| Scope | Rule |
|-------|------|
| `QuoteItem.status` | Must be `'accepted'` |
| `QuoteItem.final_billing_price` | Used as unit rate (NOT `total_cost_per_box`) |
| Quantity | `QuoteItem.quantity` |
| Party | From `party_profiles` linked to the quote |
| GST | From `business_defaults.default_gst_pct` at time of export |

### 41.2 Field-by-Field Mapping

| `AccountingExportPayload` field | Source | Notes |
|--------------------------------|--------|-------|
| `export_id` | `gen_random_uuid()` | Generated at export time |
| `tenant_id` | `quotes.tenant_id` | |
| `quote_id` | `quotes.id` | |
| `quote_ref` | `quote_versions.quote_number` | e.g. `Q-2026-0042` |
| `invoice_date` | `NOW()` at export time | Date of push, not quote date |
| `due_date` | `invoice_date + business_defaults.payment_due_days` | If `payment_due_days` is set |
| `currency` | `"INR"` (hardcoded V3) | |
| **Party** | | |
| `party.name` | `party_profiles.company_name` | |
| `party.gstin` | `party_profiles.gst_number` | |
| `party.address` | `party_profiles.address` | |
| `party.email` | `party_profiles.email` | |
| `party.phone` | `party_profiles.mobile` | |
| **Line items** (one per accepted `QuoteItem`) | | |
| `line_item.description` | `"{QuoteItem.box_name} — {ply}-ply {flute_combination} {print_type}"` | Auto-generated description |
| `line_item.hsn_sac` | `business_defaults.hsn_code` | Configurable per tenant |
| `line_item.quantity` | `QuoteItem.quantity` | |
| `line_item.unit` | `"Nos"` | Fixed |
| `line_item.unit_price` | `QuoteItem.final_billing_price` | Post-negotiation price |
| `line_item.line_total` | `unit_price × quantity` | |
| `line_item.discount_pct` | `NULL` (discount already embedded in `final_billing_price`) | |
| `line_item.taxable_amount` | `line_total` (before GST) | |
| **Tax summary** | | |
| `tax_summary.tax_type` | `'igst'` if `business_defaults.igst_applicable = true` else `'cgst_sgst'` | |
| `tax_summary.tax_rate_pct` | `business_defaults.default_gst_pct` | e.g. `18.0` |
| `tax_summary.igst_amount` | `subtotal × (gst_pct / 100)` if IGST | |
| `tax_summary.cgst_amount` | `subtotal × (gst_pct / 200)` if CGST+SGST | |
| `tax_summary.sgst_amount` | Same as `cgst_amount` | |
| **Totals** | | |
| `totals.subtotal` | `SUM(line_item.taxable_amount)` across all lines | |
| `totals.tax_amount` | Total GST (IGST or CGST+SGST) | |
| `totals.round_off` | `ROUND(grand_total_before_rounding) - grand_total_before_rounding` | F22 |
| `totals.grand_total` | `subtotal + tax_amount + round_off` | |
| `notes` | `quote_versions.notes` (if set) or `NULL` | |

### 41.3 Transport Charge Handling

If `business_defaults.transport_charge_type` is set and `transport_amount > 0`:
- Transport charge is added as a **separate line item** in `AccountingExportPayload.line_items`:
  - `description`: `"Transport Charges"`
  - `hsn_sac`: `"996511"` (standard HSN for freight services)
  - `quantity`: `1`
  - `unit`: `"Job"`
  - `unit_price`: `transport_amount` (full charge, or per-box × total_boxes)
  - `taxable_amount`: `transport_amount`
- Transport is taxable at the same GST rate unless `transport_gst_exempt = true`.

### 41.4 Negotiated Price vs. Billing Price

The accounting export always uses `final_billing_price`, which is:
- `negotiated_price` when a negotiation event of type `'accept'` exists (§23 of 01-formula-master.md)
- `sell_price` (markup-applied price) otherwise

This ensures accounting entries reflect the actual agreed commercial price, not the internal cost.

### 41.5 Price Increase Reconciliation

When a price increase event (§38 of 02-system-flow-master.md) results in a `proposed_price` accepted by the client:
1. A new `NegotiationEvent` of type `'price_revision_accepted'` is recorded.
2. `QuoteItem.final_billing_price` is updated to `proposed_price`.
3. The accounting export for the **next** invoice for this item (e.g., re-order) uses the revised `final_billing_price`.
4. Historical invoices (past exports) are **not** retroactively changed — they retain their original `final_billing_price` at time of export.

### 41.6 Multi-Item Quote Export

When a quote has multiple accepted items:
- All items are exported as separate line items in a **single invoice** (one invoice per quote).
- If items belong to the same `QuoteItemGroup`, the group appears as one line item using `group_name` as description and `group_total_sell_price` as `line_total` (consistent with PDF output — see §22 of 03-admin-flow-master.md).

### 41.7 Formula Version Tracing

The `accounting_push_log.request_payload` stores the `formula_version` from `CostingTrace` for each line item, enabling future audits to reconstruct which formula version produced the cost that underpins the billing price.

---

