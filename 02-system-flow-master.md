# 02 — SYSTEM FLOW MASTER REFERENCE
## BoxCostPro — Calculator, Quote, and Delivery Workflow

> **Purpose**: Exhaustive description of every user-facing flow in the system.
> A Python/FastAPI backend and any frontend can be rebuilt from this document alone.
> All API endpoints, state transitions, validation rules, and side-effects are documented.

---

## INDEX

1. [Onboarding Gate](#1-onboarding-gate)
2. [Calculator Page Structure](#2-calculator-page-structure)
3. [Input Fields — Complete Reference](#3-input-fields-complete-reference)
   - [3.3 Sheet Tab Dimensions + Optional Box Dims](#33-sheet-tab-dimensions)
4. [Live Preview Computation Model](#4-live-preview-computation-model)
5. [RSC Tab — Full Flow](#5-rsc-tab-full-flow)
6. [Sheet Tab — Full Flow](#6-sheet-tab-full-flow)
   - [6.3 Optional Box Dimensions in Sheet Mode [V2]](#63--optional-box-dimensions-in-sheet-mode-v2-addition)
   - [6.4 Calculator API Error States](#64--calculator-api-error-states)
7. [Layer Management](#7-layer-management)
8. [Manufacturing Add-On Costs](#8-manufacturing-add-on-costs)
9. [Quantity and Per-Box Output](#9-quantity-and-per-box-output)
10. [Party Profile Management](#10-party-profile-management)
11. [Add to Quote — Full Flow](#11-add-to-quote-full-flow)
12. [Quote Item Table — Operations](#12-quote-item-table-operations)
    - [12.5 Grouped Quote Items Flow [V2]](#125--grouped-quote-items-flow-v2-addition)
13. [Negotiation Flow](#13-negotiation-flow)
14. [Save Quote — Full Flow](#14-save-quote-full-flow)
15. [Quote Versioning](#15-quote-versioning)
    - [15.1a Group Persistence in Versions [V2]](#151a-group-persistence-in-versions-v2-addition)
16. [Edit Quote from Reports](#16-edit-quote-from-reports)
17. [Send Quote via WhatsApp / Email](#17-send-quote-via-whatsapp--email)
    - [17.6 Grouped Items in Message Output [V2]](#176-grouped-items-in-message-output-v2-addition)
18. [Bulk Upload via Excel](#18-bulk-upload-via-excel)
19. [Box Specification History](#19-box-specification-history)
20. [Company Profile (Read-Only in Calculator)](#20-company-profile-read-only-in-calculator)
21. [Rate Memory](#21-rate-memory)
22. [API Endpoints Reference](#22-api-endpoints-reference)
23. [State Machine: Quote Status](#23-state-machine-quote-status)
24. [Data Immutability and Snapshot Rules](#24-data-immutability-and-snapshot-rules)
25. [PDF / Document Generation Flow](#25-pdf--document-generation-flow)
26. [Quote Expiry Automation](#26-quote-expiry-automation)
27. [Security Notes](#27-security-notes)
28. [Unsaved Data and Navigation Guard](#28-unsaved-data-and-navigation-guard)
29. [Concurrent Edit Handling](#29-concurrent-edit-handling)
30. [RBAC — Frontend Role Guard Rules](#30-rbac--frontend-role-guard-rules)
31. [Scalability & Background Architecture](#31-scalability--background-architecture)
32. [Document Storage Flow](#32-document-storage-flow) [V3]
33. [AI Extraction + Review Flow](#33-ai-extraction--review-flow) [V3]
34. [Common Draft Costing Rows Model](#34-common-draft-costing-rows-model) [V3]
35. [AI Pattern Learning — User-Facing Notes](#35-ai-pattern-learning--user-facing-notes) [V3]
36. [Reports-to-Requote Flow](#36-reports-to-requote-flow) [V3]
37. [Client-Wise Pricing & Negotiation Timeline](#37-client-wise-pricing--negotiation-timeline) [V3]
38. [Price Increase Workflow](#38-price-increase-workflow) [V3]
39. [Sales Automation / Follow-Up Engine](#39-sales-automation--follow-up-engine) [V3]
40. [Rich Editor / Template Management](#40-rich-editor--template-management) [V3]
41. [Specification Download Flow](#41-specification-download-flow) [V3]
42. [Job Card Generation Flow](#42-job-card-generation-flow) [V3]
43. [QA Report Generation Flow](#43-qa-report-generation-flow) [V3]
44. [Tally Export / Push Flow](#44-tally-export--push-flow) [V3]

---

## 1 — ONBOARDING GATE

*Source: `client/src/pages/calculator.tsx` — profile completeness check*

### 1.1 Business Profile Completeness Gate
Before the calculator renders, the app checks if the company profile is complete.

**Required fields for gate to pass:**
- `companyProfile.companyName` — non-empty
- `companyProfile.ownerName` — non-empty
- `companyProfile.email` — non-empty
- `companyProfile.phone` — non-empty

**If incomplete**: The calculator page is replaced with a blocking card: *"Complete Your Business Profile"* with a link to Settings → Account Profile.

**If loading**: Show loading state (do not show blocking card).

**API used**: `GET /api/company-profiles` — returns array; uses `isDefault = true` entry as primary, falls back to first in array.

### 1.2 Flute Onboarding Prompt
*Source: `FlutingOnboarding` component*

On first load, if no flute settings exist in the DB, show the onboarding dialog prompting the user to configure flute types. On completion, invalidate the `/api/flute-settings` cache.

---

## 2 — CALCULATOR PAGE STRUCTURE

The calculator is a **single-page** React component (~2000 lines) at route `/` or `/calculator`.

### 2.1 Top Level Tabs

| Tab | Value | Description |
|-----|-------|-------------|
| RSC | `"rsc"` | Regular Slotted Container — 3D box with dimensions L×W×H |
| Sheet | `"sheet"` | Flat corrugated/paper sheet — 2D dimensions L×W only |

Default active tab: `"rsc"`.

### 2.2 Layout Regions

```
┌─────────────────────────────────────────────────────┐
│  Header: Company profile selector + Nav + User menu  │
├─────────────────────────────────────────────────────┤
│  [Preview Mode Banner — only when editing from       │
│   Reports with ?quoteId= in URL]                     │
├──────────────────────┬──────────────────────────────┤
│  LEFT PANEL          │  RIGHT PANEL                  │
│  (Calculator Inputs) │  (Live Results + Quote Items) │
│                      │                               │
│  Tab: RSC | Sheet    │  Output card:                 │
│  Dimensions          │  - Sheet Size (mm)            │
│  Ply + Flute         │  - Sheet Size (inches)        │
│                      │  - Sheet Size (cm)            │
│  Layer table         │  - Board Thickness            │
│  Mfg costs           │  - Sheet Weight (kg)          │
│  Quantity            │  - Paper Cost (₹)             │
│  Box name            │  - BS / ECT / BCT             │
│  [Add to Quote]      │  - Total Cost per Box (₹)     │
│                      │                               │
│                      │  Quote Items Table            │
│                      │  Party + Terms panel          │
│                      │  [Save Quote]                 │
└──────────────────────┴──────────────────────────────┘
```

---

## 3 — INPUT FIELDS — COMPLETE REFERENCE

### 3.1 Global / Persistent State

| Field | State Variable | Type | Default | Stored In |
|-------|---------------|------|---------|-----------|
| Active tab | `activeTab` | `"rsc" | "sheet"` | `"rsc"` | Component state |
| Ply count | `ply` | `"1"|"3"|"5"|"7"|"9"` | `"5"` | Component state |
| Flute combination | `fluteCombination` | string | `"BC"` | Component state |
| Input unit | `inputUnit` | `"mm" | "inches" | "cm"` | `"mm"` | Component state |
| Measurement mode | `measuredOn` | `"ID" | "OD"` | `"OD"` | Component state |
| Paper Mill | `paperMill` | string | `""` | Component state (display only) |
| Custom board thickness | `customBoardThickness` | string | auto-computed | Component state |
| Manual thickness override | `thicknessManualOverride` | boolean | `false` | Component state |
| Conversion cost | `conversionCost` | string (₹/kg) | `"15"` | Component state |
| Quantity | `quantity` | string | `"1000"` | Component state |
| Box name | `boxName` | string | `""` | Component state |
| Box description | `boxDescription` | string | `""` | Component state |

### 3.2 RSC Tab Dimensions

| Field | State Variable | Unit | Validation |
|-------|---------------|------|-----------|
| Length | `rscLength` | mm, cm, or inches (per `inputUnit`) | Must be numeric > 0 |
| Width | `rscWidth` | mm, cm, or inches | Must be numeric > 0 |
| Height | `rscHeight` | mm, cm, or inches | Must be numeric > 0 |
| Glue Flap | `glueFlap` | mm | Default from §1.3 of formula doc |
| Deckle Allowance | `deckleAllowance` | mm | Default from §1.4 of formula doc |
| Max Length Threshold | `maxLengthThreshold` | mm | Optional; `"1500"` default |

### 3.3 Sheet Tab Dimensions

| Field | State Variable | Unit | Required |
|-------|---------------|------|----------|
| Length | `sheetLength` | mm, cm, or inches (per `inputUnit`) | Yes |
| Width | `sheetWidth` | mm, cm, or inches | Yes |
| Sheet Allowance | `sheetAllowance` | mm, default `"10"` | Yes |

#### Optional Box Dimensions (Sheet Tab only) [V2 Addition]

For die-cut or folded box items, the operator can optionally enter the **finished box dimensions**. These are used exclusively for: **(1)** showing "Box Size" in the quote for customer reference, and **(2)** computing BCT. They do not affect sheet size or cost in any way.

| Field | State Variable | Unit | Required |
|-------|---------------|------|----------|
| Box Length | `boxDimLength` | mm, cm, or inches (per `inputUnit`) | Optional |
| Box Width | `boxDimWidth` | mm, cm, or inches | Optional |
| Box Height | `boxDimHeight` | mm, cm, or inches | Optional |

> **All-or-nothing rule**: all three box dim fields must be filled together, or all left blank. If 1 or 2 of 3 are filled, it is a validation error (rule S01 in formula doc §29). The form must show an inline error and block Add to Quote / Save. (See §6.3 for UI behavior.)

### 3.4 Layer Fields (per layer, see §7)

Each layer in the `layers` array (type `LayerState`) has:

| Field | Type | Default for Liner | Default for Flute |
|-------|------|-------------------|-------------------|
| `gsm` | string | `"180"` | `"120"` |
| `bf` | string | `"16"` | `"16"` |
| `flutingFactor` | string | `"1.0"` | per flute type |
| `rctValue` | string | `"5"` | `"5"` |
| `shade` | string | `"Kraft/Natural"` | `"Semi Chemical Fluting"` |
| `rate` | string | computed | computed |
| `priceOverride` | boolean | `false` | `false` |
| `calculatedRate` | string | from BF engine | from BF engine |
| `manualRate` | string | undefined | undefined |
| `layerType` | `"liner" | "flute"` | `"liner"` | `"flute"` |

### 3.5 Quote Header Fields

| Field | State Variable | Required | Notes |
|-------|---------------|----------|-------|
| Party name | `partyName` | Yes (if no company) | Free text or from party profile |
| Customer company | `customerCompany` | Yes (if no party name) | |
| Customer email | `customerEmail` | No | For email delivery |
| Customer mobile | `customerMobile` | No | For WhatsApp delivery |
| Payment terms | `paymentTerms` | Yes | Persisted in localStorage |
| Delivery days | `deliveryDays` | Yes | Persisted in localStorage |
| Transport charge | `transportCharge` | No | ₹ flat amount |
| Transport remark | `transportRemark` | No | Free text description |
| Selected party profile | `selectedPartyProfileId` | Yes (to Add to Quote) | Must be selected before adding items |

---

## 4 — LIVE PREVIEW COMPUTATION MODEL

### 4.1 How It Works

All calculations are **fully client-side**. There is no API call and no server involvement.

**Debounce (200ms):** The live preview re-computation is debounced at 200ms. Rapid successive keystrokes (typing dimensions digit-by-digit) do not trigger a recalculation on every character — the timer resets on each state change and fires once the user pauses for 200ms. This eliminates visible flicker on large layer tables and avoids redundant recalculations mid-keystroke.

**Batch updates:** When a single user action causes multiple simultaneous state changes (e.g., a ply change resetting the layers array, flute combination, and board thickness all at once), all downstream state updates are batched into one React render cycle and one recalculation tick — not N separate re-renders.

The `result` variable is recomputed in the debounced callback:
```typescript
const result = activeTab === "rsc" ? calculateRSC() : calculateSheet();
```

Both `calculateRSC()` and `calculateSheet()` are plain functions (not hooks) that read from component state and produce a `CalculationResult` object. They return `null` if required inputs are missing.

### 4.2 Trigger Conditions

The live preview updates when ANY of these change:
- Any dimension field (L, W, H, Sheet L, Sheet W)
- `ply` or `fluteCombination`
- `inputUnit` (`"mm"` / `"cm"` / `"inches"`)
- `measuredOn` (`"ID"` / `"OD"`)
- `glueFlap`, `deckleAllowance`, `sheetAllowance`, `maxLengthThreshold`
- Any layer field (GSM, BF, shade, rate, flutingFactor, RCT)
- `thicknessManualOverride` or `customBoardThickness`
- Pricing data loads (BF prices, shade premiums, rules from API)
- Manufacturing cost inputs (if enabled)
- `quantity`
- `conversionCost`

### 4.3 CalculationResult Object

```typescript
interface CalculationResult {
  sheetLength: number;      // mm
  sheetWidth: number;       // mm
  sheetWeight: number;      // kg per sheet
  layerWeights: number[];   // kg per layer
  bs: number;               // Burst Strength kgf/cm²
  paperCost: number;        // ₹
  boardThickness: number;   // mm
  boxPerimeter: number;     // cm  — (2 × (L_mm + W_mm)) / 10; stored in cm for direct use in McKee F12
  ect: number;              // kN/m
  bct: number | null;       // kg (McKee BCT); null in Sheet mode when no optional box dims entered [V2 Clarification]
  layerSpecs: LayerSpec[];  // full per-layer data
  // [V2 Addition]
  costBasis: 'sheet' | 'rsc';  // always 'sheet' for Sheet tab items
  bctBasis: 'box' | null;     // 'box' = BCT computed from optional box dims; null = BCT not available
}
```

### 4.4 Downstream Calculations from `result`

After `result` is computed, additional derived values are computed:

```typescript
// Manufacturing costs (only when toggles are enabled)
const mfgCosts = calculateManufacturingCosts();

// Conversion cost
const conversionCostPerBox = result.sheetWeight * parseFloat(conversionCost);

// Total cost per box
const totalCostPerBox = calculateTotalCost({
  paperCost: result.paperCost,
  printingCost: mfgCosts.printing,
  laminationCost: mfgCosts.lamination,
  varnishCost: mfgCosts.varnish,
  dieCost: mfgCosts.die,
  punchingCost: mfgCosts.punching,
  markup: 15,
}) + conversionCostPerBox;

// Quote totals
const qty = parseFloat(quantity) || 1000;
const totalValue = totalCostPerBox * qty;
const subtotal = sum(selected items: finalCostPerBox × quantity);
const taxRateValue = businessDefaults.defaultGstPercent ?? 5;
const taxAmount = subtotal × (taxRateValue / 100);
const grandTotal = subtotal + taxAmount;
```

---

## 5 — RSC TAB — FULL FLOW

### 5.1 User Entry Sequence

1. User selects **RSC** tab.
2. User selects **Ply** (1/3/5/7/9). Changing ply:
   - Resets the layers array via `createLayersForPly(newPly)`.
   - Auto-applies pricing from Paper Price Settings if available.
   - Resets flute combination to the first valid option for the new ply.
3. User selects **Flute Combination** (e.g., `BC` for 5-ply). Changing this:
   - Triggers auto-recalculation of board thickness via `calculateBoardThicknessFromFlutes`.
   - Only if `thicknessManualOverride = false`.
4. User selects measurement mode: **ID** (Inside Dimension) or **OD** (Outside Dimension).
5. User selects input unit: **mm** or **inches**.
6. User enters **Length**, **Width**, **Height**.
7. User optionally edits **Glue Flap** and **Deckle Allowance** (auto-populated from defaults).
8. User optionally edits **Max Length Threshold** (default 1500mm).
9. User fills in **Layer table** (GSM, BF, shade, rate per layer).
10. Results display instantly in the right panel.

### 5.2 Internal Calculation Sequence (`calculateRSC`)

```
1. Parse L, W, H from state strings to floats
2. Return null if any is missing/invalid
3. Convert to mm based on `inputUnit`:
   - `"cm"`:     value × 10
   - `"inches"`: value × 25.4
   - `"mm"`:     no-op
4. Apply ID/OD adjustment:
   - If OD: L -= 2×thickness, W -= 2×thickness, H -= thickness
   - thickness = appSettings.plyThicknessMap[ply] ?? PLY_THICKNESS[ply]
5. Calculate RSC sheet dimensions:
   - sheetLength = 2×(L+W) + glueFlap
   - sheetWidth = W + H + deckleAllowance
   - If sheetLength > maxLengthThreshold:
       sheetLength += maxLengthThreshold × 0.10
6. Build layerSpecs[] from layers[] state:
   - For each layer: parse gsm, bf, flutingFactor, rctValue, rate
   - Attach price breakdown snapshot from lookupPaperPriceWithBreakdown()
7. Calculate sheet weight using F07
8. Calculate burst strength using F10
9. Calculate paper cost using F09
10. Calculate board thickness:
    - If thicknessManualOverride: use customBoardThickness
    - Else: calculateBoardThickness(ply, layerSpecs, PLY_THICKNESS)
11. boxPerimeter = (2 × (L + W)) / 10   [in **cm** — required by McKee formula F12; divide mm sum by 10]
12. Calculate ECT using F11
13. Calculate BCT using F12
14. Return CalculationResult
```

---

## 6 — SHEET TAB — FULL FLOW

### 6.1 User Entry Sequence

1. User selects **Sheet** tab.
2. User selects **Ply** (same selector as RSC, shared state).
3. User selects **Flute Combination** (same selector).
4. User enters **Length**, **Width** (no Height — sheets are flat).
5. User optionally edits **Sheet Allowance** (default 10mm).
6. User fills in **Layer table**.
7. *(Optional)* User expands **"Box Dimensions (optional)"** panel and enters `Box Length`, `Box Width`, `Box Height`. (See §6.3.)
8. Results display instantly. BCT appears in preview only when box dims are provided.

### 6.2 Differences from RSC
- No height input required.
- No glue flap or deckle allowance.
- No ID/OD adjustment (sheet input is always treated as-is).
- Sheet input respects `inputUnit`: L and W are converted to mm before the sheet size formula.
- Sheet size formula: `sheetLength = L + allowance`, `sheetWidth = W + allowance`.
- **Cost basis**: always sheet size. Box dims (if entered) do not affect sheet size or cost. [V2 Clarification]
- **BCT**: computed only if optional box dims are all present. BCT row hidden in preview when absent. [V2 Clarification]
- Box dims (if entered) follow the same `inputUnit` as other dimensions and are converted to mm before BCT formula.

### 6.3 — Optional Box Dimensions in Sheet Mode [V2 Addition]

#### 6.3.1 UI Component

A collapsible panel labeled **"Box Dimensions (optional — for BCT and quote display)"** appears below the Sheet Allowance field in the Sheet tab.

- Default state: **collapsed** (no fields visible).
- When expanded: shows three numeric inputs — **Box Length**, **Box Width**, **Box Height** — in the current `inputUnit`.
- A subtitle reads: *"Enter the finished box size. Used only to calculate BCT and show box dimensions in the quote. Cost is always based on sheet size."*

#### 6.3.2 Preview Behavior

| State | BCT row in preview panel | "Box Size" in preview |
|-------|--------------------------|----------------------|
| All three box dims filled | BCT computed and shown | Shown (L × W × H in `inputUnit`) |
| All three empty | BCT row hidden | Hidden |
| 1 or 2 of 3 filled | BCT hidden; inline error shown | Hidden |

#### 6.3.3 Validation Error UI

If the user fills 1 or 2 of the 3 box dim fields (partial entry):
- Show inline error beneath the panel: *"Please enter all three box dimensions or leave all blank."*
- Disable the **Add to Quote** button.
- The preview area shows BCT as hidden; no spinner or loading state.
- Backend will independently reject partial entry with HTTP 422 (rule S01).

#### 6.3.4 Save / Load / Edit Behavior

- When an item is added to the quote, `box_length`, `box_width`, `box_height` are included in the `QuoteItem` payload. If not entered, they are sent as `null`.
- When a quote is loaded for editing (§16), if the item has box dims in the snapshot, the Box Dimensions panel auto-expands and populates the fields.
- The edit dialog (§12.4) does **not** allow editing box dims post-add. Box dims are fixed at the point of adding to the quote (same immutability as board-level dimensions).
- To change box dims, the user must remove the item and re-add it with the corrected values.

#### 6.3.5 Quote Rendering

- When `box_length/width/height` are present on a `QuoteItem`: the generated quote shows a `"Box Size"` row below the sheet size row, formatted as `L × W × H (mm)` with label `"Finished box size (die-cut)"`. BCT is shown in the strength metrics row.
- When absent: neither "Box Size" row nor BCT row appears in the quote output.

### 6.4 — Calculator API Error States

*Applies to all API calls made during calculator operation.*

| Error Scenario | HTTP / Condition | UI Response |
|----------------|-----------------|-------------|
| BF price not found for a layer | No DB row for `bf` value | Block calculation. Show red banner: *"No price set for BF [X]. Add it in Paper Master before calculating."* |
| All quotes load fails (Reports edit flow) | `GET /api/quotes/:id` 404 | Show toast error: *"Quote not found."* Navigate back to Reports. |
| Session expired | 401 on any API call | Redirect to `/login`. Show toast: *"Session expired. Please sign in again."* |
| Save quote fails (500) | `POST /api/quotes` ≥ 500 | Show toast: *"Failed to save quote. Your data is preserved. Try again."* Do NOT clear form state. |
| Flute settings load fails | `GET /api/flute-settings` error | Use hardcoded defaults (§1.1 of formula doc). Show warning badge: *"Using default flute values — check Settings."* |
| Paper prices load fails | `GET /api/paper-bf-prices` error | Block calculation. Show error card: *"Paper prices unavailable. Cannot calculate costs."* |
| Rate memory save fails | `POST /api/rate-memory` error | Silent fail. Log to console. Do not show user error (non-critical). |
| Party profile save fails | POST/PATCH 4xx | Show inline form error. Keep dialog open. Preserve entered data. |
| Email send fails | `POST /api/send-email` error | Show toast: *"Failed to send email. Check your email settings."* Keep message dialog open. |
| WhatsApp link (unvalidated phone) | Mobile < 10 digits | Disable WhatsApp button. Show tooltip: *"Valid 10-digit mobile required."* |

---

## 7 — LAYER MANAGEMENT

### 7.1 Layer Table Structure

The layer table has one row per layer (1 to 9 rows depending on ply). Each row shows:
- Layer number + type label (L1 Liner, L2 Flute-C, etc.)
- GSM input
- BF input (liners only; flute layers show fluting factor instead)
- Shade selector (dropdown from shade list)
- Rate (₹/Kg) — computed or manual
- RCT value input
- Pin/Override toggle for rate
- Copy-down button (copies this layer's specs to all subsequent layers)

### 7.2 Ply Change Behavior

When ply changes:
1. `updateLayersForPlyWithPricing(newPly)` is called.
2. Creates new layer array via `createLayersForPly(plyNum)`.
3. Applied current BF prices from API to all layers.
4. All previous layer edits are **lost**. Before resetting, the UI:
   - **Auto-saves** the current layer state to `previousLayersSnapshot` (temporary component state).
   - Shows a **confirmation modal**:
     > *"Changing ply will reset all layer settings. Your current layers will be lost. Are you sure?"*
     > Buttons: **[Cancel]** | **[Reset Layers]** | **[Undo — Restore Previous]** (shown if `previousLayersSnapshot` exists)
   - If user clicks **Cancel**: ply change is reverted, layers unchanged.
   - If user clicks **Reset Layers**: proceed with ply change, `previousLayersSnapshot` kept for 1 more ply change.
   - If user clicks **Undo**: restore layers from `previousLayersSnapshot`, ply reverted.
   - `previousLayersSnapshot` is cleared after any subsequent ply change or after saving a quote item.

### 7.3 Rate Auto-Fill Logic

When BF prices load (or change), a `useEffect` runs over all layers:
- For each layer where `priceOverride = false`:
  - Calls `lookupPaperPriceWithBreakdown(gsm, bf, shade)`
  - If a price is found, updates `rate`, `calculatedRate`, and `priceBreakdown`
  - Only updates when the rate differs (prevents unnecessary renders)

### 7.4 Manual Rate Override

User can toggle `priceOverride = true` on any layer:
- The `rate` field becomes free-text editable.
- The auto-fill useEffect skips this layer.
- `manualRate` stores the entered value.
- `priceBreakdown` is NOT computed for this layer.
- `rate` = `manualRate` in the calculation.

### 7.5 Copy Layer Down

Button on each row: "Copy to following layers"
- Copies from source row: `gsm`, `bf`, `rctValue`, `shade`, `rate`, `priceOverride`, `calculatedRate`, `manualRate`, `priceBreakdown`
- For flute layers at odd indices: also copies `flutingFactor`
- Does NOT copy `layerType` (liner/flute is fixed by position)

### 7.6 Layer Edit Dialog

A separate edit dialog opens when user clicks "Edit" on a layer row:
- State: `editingLayerIdx`, `editingLayerData`
- Allows fine-grained editing of all fields
- On save: replaces the layer at `editingLayerIdx` in the array

### 7.7 Fluting Factor and Height Loading

On mount and when `fluteSettingsData` arrives from `GET /api/flute-settings`:
```
for each setting in fluteSettingsData:
    fluteSettings[setting.fluteType] = setting.flutingFactor
    fluteHeights[setting.fluteType] = setting.fluteHeight
```
These two maps are used in all board thickness and weight calculations.

---

## 8 — MANUFACTURING ADD-ON COSTS

### 8.1 Toggle System

Each add-on has a checkbox toggle. When disabled, its cost contribution = 0.

| Toggle | State Variable | Cost Formula Reference |
|--------|---------------|----------------------|
| Printing | `printingEnabled` | Formula §12 (F14) |
| Lamination | `laminationEnabled` | Formula §13 (F15) |
| Die | `dieEnabled` | Formula §14 (F16) |
| Punching | `punchingEnabled` | Manual rate per box |
| Varnish | `varnishEnabled` | Manual rate per box |

### 8.2 Printing Fields

| Field | Variable | Notes |
|-------|----------|-------|
| Print type | `printType` | `"Flexo"`, `"Offset"`, `"Screen"` (free text allowed) |
| Colours | `printColours` | Integer, stored on item |
| Cost per print | `costPerPrint` | ₹/box |
| Plate cost | `plateCost` | Total ₹ (amortised by qty) |
| MOQ | `printMoq` | If qty < MOQ, adds penalty cost |
| MOQ enabled | `moqEnabled` | Boolean toggle. When `false`, MOQ penalty never applies regardless of `printMoq` value. Default: `false`. Must be documented as a field on the `QuoteItem` object. |

### 8.3 Lamination Fields

| Field | Variable | Notes |
|-------|----------|-------|
| Rate | `laminationRate` | ₹ per 100 square inches |
| Custom dimensions | `customLaminationL`, `customLaminationW` | Optional override of sheet dimensions in inches |
| Use custom | `showLaminationCustomize` | Toggle. If false, uses actual sheet dimensions |

### 8.4 Die Fields

| Field | Variable | Notes |
|-------|----------|-------|
| Development charge | `dieDevelopmentCharge` | ₹ total, divided by quantity |

### 8.5 Punching & Varnish

| Field | Variable | Notes |
|-------|----------|-------|
| Punching cost | `punchingCost` | ₹/box direct |
| Varnish cost | `varnishCost` | ₹/box direct |

---

## 9 — QUANTITY AND PER-BOX OUTPUT

| Output | How Computed | Displayed As |
|--------|-------------|-------------|
| Sheet Length | F01 / F03 | mm and inches |
| Sheet Width | F02 / F04 | mm and inches |
| Board Thickness | F13 | mm |
| Sheet Weight | F07 | kg per sheet |
| Burst Strength | F10 | kgf/cm² |
| ECT | F11 | kN/m |
| BCT (compression) | F12 | kg | **Sheet mode only**: shown when optional box dims are provided; hidden when absent. [V2 Clarification] |
| Paper Cost | F09 | ₹ per box |
| Printing Cost | F14 | ₹ per box (only if enabled) |
| Lamination Cost | F15 | ₹ per box (only if enabled) |
| Conversion Cost | F18 | ₹ per box |
| Total Cost per Box | F19 | ₹ |
| Total Value | `totalCostPerBox × qty` | ₹ |

The **quantity** input defaults to 1000. User can change it freely — all totals update instantly.

---

## 10 — PARTY PROFILE MANAGEMENT

### 10.1 Purpose

The party profile represents the **customer/buyer**. It must be selected before adding items to a quote. It is stored in `party_profiles` table.

### 10.2 Selecting a Party

1. Dropdown list populated from `GET /api/party-profiles`.
2. User selects a party → `selectedPartyProfileId` and display fields update.
3. If the party is not in the list, user can create a new one via the party dialog.

### 10.3 Creating / Editing a Party Profile

Fields:
| Field | Required | Notes |
|-------|----------|-------|
| Person name | Yes | Contact person |
| Company name | No | Customer's company |
| Mobile | No | 10-digit (used for WhatsApp) |
| Email | No | Used for email delivery |
| GST number | No | Validated using §24 of formula doc (GSTIN format) |
| Address | No | Full address, free text |

On save: `POST /api/party-profiles` (new) or `PATCH /api/party-profiles/:id` (edit).
On delete: `DELETE /api/party-profiles/:id`.
Cache invalidated: `["/api/party-profiles"]`.

### 10.4 Party Snapshot in Quote

When a quote is saved, the party's current data is **snapshotted** into `quoteVersions.partySnapshot` (JSONB). This ensures the quote remains accurate even if the party profile is later edited or deleted.

---

## 11 — ADD TO QUOTE — FULL FLOW

### 11.1 Prerequisites

Before "Add to Quote" button is enabled, **all** of the following must be true:

| Condition | State check | Error if violated |
|-----------|-------------|-------------------|
| Party profile selected | `selectedPartyProfileId` is set | Toast: *"Please select a party before adding items."* |
| Calculation valid | `result !== null` | Button stays grayed out (no toast) |
| BF prices loaded | `paperBfPricesQuery.isSuccess` | Button shows loading spinner; toast on click: *"Pricing data is still loading. Please wait."* |
| Flute settings loaded | `fluteSettingsQuery.isSuccess` | Same as above |
| Company profile loaded | `companyProfileQuery.isSuccess` | Same as above |

**Rationale for loading guard**: If BF prices have not yet arrived from the API when the user clicks "Add to Quote", `lookupPaperPriceWithBreakdown()` returns no price, the paper cost computes as ₹0, and a ₹0-cost item is silently added to the quote. The loading guard prevents this class of ghost-cost bug.

### 11.2 What Happens on Click

1. Build `layerSpecs[]` from current `layers[]` state, with full price breakdown snapshots.
2. Build `QuoteItem` object (see schema in §27 of formula doc) with:
   - All dimension data
   - All computed sheet sizes and strength metrics
   - All cost components
   - `selected: true` (included in totals by default)
   - All visibility flags set to `true`
   - `negotiationMode: 'none'`
   - `originalPrice: totalCostPerBox`
   - `cost_basis: 'sheet'` (for Sheet-tab items) or `'rsc'` (for RSC-tab items) [V2 Addition]
   - `bct_basis: 'box'` if optional box dims present; `null` if absent [V2 Addition]
   - `box_length`, `box_width`, `box_height`: optional box dims in mm if entered; `null` if not [V2 Addition]
   - `group_id: null` (ungrouped at point of creation) [V2 Addition]
3. Append to `quoteItems` array.
4. **Reset the form** — all dimension inputs, box name, description, quantity (→ "1000"), and all manufacturing toggles cleared.
5. Show toast: "Item added to your quote."

### 11.3 Reset After Adding

Fields reset to:
- `boxName`, `boxDescription` → `""`
- Dimension inputs (RSC or Sheet) → `""`
- `quantity` → `"1000"`
- `printingEnabled`, `laminationEnabled`, `dieEnabled`, `punchingEnabled`, `varnishEnabled` → `false`
- `printType` → `"Flexo"`, `printColours` → `"1"`
- `costPerPrint`, `plateCost`, `printMoq` → `"0"`
- `laminationRate` → `"0"`, custom lamination fields cleared
- `dieDevelopmentCharge` → `"0"`
- `varnishCost`, `punchingCost` → `"0"`

Layers, ply, flute combination, and paper settings are **NOT** reset — they persist for the next item.

---

## 12 — QUOTE ITEM TABLE — OPERATIONS

### 12.1 Display Columns

Items in the quote table show (configurable visibility per item):
- Box name + description
- Box type (RSC / Sheet)
- Ply + flute combination
- Dimensions (L×W×H)
- Paper spec string (e.g., `KRA120/18+SCF100+KRA120/18`)
- Sheet size (mm)
- Sheet weight (kg)
- BS / ECT / BCT *(BCT shown only when `bct_basis = 'box'`; hidden for Sheet items without box dims)* [V2 Clarification]
- **Box Size** *(Sheet mode only, conditional: shown when optional box dims present; hidden when absent)* [V2 Addition]
- Printing info (if enabled on item)
- Cost per box
- Quantity
- Total value
- Negotiated price (if negotiated)
- Group label *(if item belongs to a group, shows group name badge)* [V2 Addition]
- Selection checkbox

### 12.2 Column Visibility Toggle

Per-item visibility flags:
- `showPaperSpec` — show/hide paper spec column
- `showPrinting` — show/hide printing details
- `showBS` — show/hide Burst Strength
- `showCS` — show/hide BCT (compression strength)
- `showWeight` — show/hide box weight

These flags are stored in the `QuoteItem` object and flow into the WhatsApp/email message generation.

### 12.3 Item Level Actions

| Action | Description |
|--------|-------------|
| Select/Deselect | `item.selected` toggle — excluded from subtotal if false |
| Select All / Deselect All | Sets all items' `selected` flag at once |
| Edit | Opens edit dialog (box name, qty, per-box add-on costs only — not dimensions) |
| Negotiate | Opens negotiation dialog (see §13) |
| Remove | Removes item from `quoteItems` array (item must be ungrouped first if in a group) |
| Toggle visibility flags | Show/hide columns per item |
| **Group** | Available when ≥2 items are selected; opens Group dialog. (See §12.5.) [V2 Addition] |
| **Ungroup** | Available on grouped items; dissolves the group and restores items to independent lines. (See §12.5.) [V2 Addition] |

### 12.4 Edit Dialog (`handleSaveEditedQuoteItem`)

Editable in the dialog:
- `boxName`, `boxDescription`
- `quantity`
- `printingCost`, `laminationCost`, `varnishCost`, `dieCost`, `punchingCost` (per-box values)

**Recalculation on save:**
```
conversionCostVal = item.sheetWeight × conversionCost
newTotalCostPerBox = calculateTotalCost({
  paperCost: item.paperCost,   // original, unchanged
  printingCost: newPrintingCost,
  ...other edited costs,
  markup: 15,
}) + conversionCostVal
totalValue = newTotalCostPerBox × qty
```
Paper cost is not re-fetched — it uses the stored value from when the item was first added.

---

## 12.5 — GROUPED QUOTE ITEMS FLOW [V2 Addition]

### 12.5.1 Overview

The operator can group two or more quote items into a single named **Product Set** (commercial group). The group appears as one commercial line in the customer-facing quote while preserving the individual item details for internal reference.

### 12.5.2 Create Group Flow

1. Operator selects ≥ 2 items using the row checkboxes.
2. A **"Group Selected"** button appears in the toolbar above the quote table (only when ≥ 2 items selected and all selected items are currently ungrouped).
3. Operator clicks **"Group Selected"**. A dialog opens:
   - **Group Name** (required text input) — e.g. `"Box A + Plate B + Partition C"`
   - **Group Code** (optional) — e.g. `"SET-001"`
   - Preview shows: list of member items with individual prices and the computed `group_total_sell_price`
4. Validation (client-side, before submit):
   - All selected items must have identical quantity — if not, show: `"All items in a group must have the same quantity. Adjust quantities first."`
   - Group name must be non-empty.
   - Minimum 2 members.
5. Operator clicks **"Create Group"**. A `QuoteItemGroup` record is created (local state; persisted to DB on save quote).

### 12.5.3 Display After Grouping

Once grouped, the quote item table changes:
- **Group header row** is inserted above the member items, showing:
  - Group name and code
  - Combined `group_total_sell_price`
  - A collapse/expand toggle (▶ / ▼)
- **Member item rows** are either:
  - **Collapsed** (default): hidden under the group header; only the header row is visible in customer-facing view.
  - **Expanded**: visible below the header with a visual indent; showing individual prices but grayed out (they do not contribute independently to subtotal).
- The group header's total replaces the individual member totals in the **quote subtotal** calculation:
  ```
  quote_subtotal = Σ(ungrouped selected items) + Σ(group header totals)
  ```
- A **group badge** (e.g., `🗂 SET-001`) appears on each member row when expanded.

### 12.5.4 Ungroup Flow

1. On the group header row, operator clicks **"Ungroup"** (or right-click context menu on any member row).
2. Confirmation dialog: `"Ungroup this set? Items will return to independent lines."` Buttons: **[Cancel]** | **[Ungroup]**
3. On confirm: `QuoteItemGroup` record is deleted, all member `group_id`s are cleared. Member items return to independent rows in the table and resume contributing individually to the subtotal.
4. The operator can re-group members differently after ungrouping.

### 12.5.5 Edit Restrictions Within a Group

- **Group name and code** are editable via a pencil icon on the group header row.
- **Individual item prices** (per-box costs) within a group can be edited via the normal edit dialog (\u00a712.4). `group_total_sell_price` is recomputed automatically after any member price edit.
- **Individual item quantities** can be edited but the operator must ensure all members remain at the same quantity. If a quantity edit would create a mismatch, show: `"All items in a group must have the same quantity."` and revert.
- **Box dims, sheet size, paper spec** of member items cannot be changed post-add (same rule as ungrouped items — must remove and re-add).
- A **grouped item cannot be removed** from the quote without ungrouping it first. Attempting to "Remove" a grouped item shows: `"Ungroup this item first before removing it."`.

### 12.5.6 Group Total Calculation (client-side)

```typescript
const groupTotal = group.member_item_ids
  .map(id => quoteItems.find(item => item.id === id))
  .filter(Boolean)
  .reduce((sum, item) => sum + item.finalCostPerBox * item.quantity, 0);
```

This mirrors formula doc §34.1. The backend will independently recompute this at save time.

### 12.5.7 Quote Subtotal with Groups

```
subtotal = ungroupedSelectedItems.reduce(sum of finalCostPerBox × quantity, 0)
         + activeGroups.reduce(sum of group_total_sell_price, 0)
```

### 12.5.8 Group RBAC Enforcement

| Role | Create group | Ungroup | Edit group name |
|------|-------------|---------|-----------------|
| Owner / Admin / Manager | ✅ any quote | ✅ any quote | ✅ any quote |
| Salesperson | ✅ own quotes | ✅ own quotes | ✅ own quotes |
| Viewer | ❌ disabled | ❌ disabled | ❌ read-only |

"Group Selected" button and "Ungroup" button are hidden/disabled for Viewer role. (See §30 for frontend role guards.)

---

## 13 — NEGOTIATION FLOW

*Source: `client/src/pages/calculator.tsx` — negotiation dialog state*

### 13.1 Opening Negotiation

Clicking "Negotiate" on a quote item:
- Sets `negotiatingItemIdx` to the item index
- Sets `negotiationMode = 'none'`
- Sets `negotiationValue = ''`

### 13.2 Negotiation Modes

| Mode | Input | Resulting `negotiatedPrice` |
|------|-------|-----------------------------|
| `'none'` | — | No negotiation; `finalCostPerBox = totalCostPerBox` |
| `'percentage'` | Discount % | `totalCostPerBox × (1 − value/100)` |
| `'fixed'` | Target price (₹) | `value` directly |

### 13.3 Applying Negotiation

On confirm:
```python
item.negotiationMode = mode
item.negotiationValue = value
item.originalPrice = totalCostPerBox
item.negotiatedPrice = computed value above
item.totalValue = (negotiatedPrice or totalCostPerBox) × quantity
```

The `subtotal` computation uses `item.negotiatedPrice || item.totalCostPerBox` for all selected items.

### 13.4 Removing Negotiation

Selecting mode `'none'` and saving resets `negotiatedPrice` to `null` and `totalCostPerBox` takes effect again.

---

## 14 — SAVE QUOTE — FULL FLOW

### 14.1 Pre-Save Validation

Before `POST /api/quotes` is called:
1. `quoteItems.length > 0` — at least one item required
2. `partyName` OR `customerCompany` — at least one required
3. `paymentTerms.trim()` — must not be empty
4. `deliveryDays.trim()` — must not be empty

Failures show descriptive toast errors; save is blocked.

### 14.2 Pre-Save Actions

- `localStorage.setItem("lastPaymentTerms", paymentTerms)`
- `localStorage.setItem("lastDeliveryDays", deliveryDays)`

### 14.3 API Call

```
POST /api/quotes
Body:
{
  partyId: string | undefined,         // selectedPartyProfileId (if selected)
  partyName: string,
  customerCompany: string,
  customerEmail: string,
  customerMobile: string,
  paymentTerms: string,
  deliveryDays: string,
  transportCharge: number | undefined,
  transportRemark: string | undefined,
  totalValue: number,                  // sum(all items totalValue) + transportCharge
  items: QuoteItem[]                   // full array including unselected items
}
```

### 14.4 Server-Side Processing

The server:
1. Generates a `quoteNo` (sequential, format: `Q-{YEAR}-{SEQ}` e.g. `Q-2025-0042`)
2. Creates a `quotes` row with `status = 'draft'`
3. Creates a `quoteVersions` row (version 1) with all pricing + terms data
4. Creates `quoteItemVersions` rows for each item
5. Snapshots all current flute factors and heights into the version row
6. Sets `quotes.activeVersionId` to the new version's ID
7. Returns `{ quoteNo, versionNo, isNewVersion }`

### 14.5 On Success

- Invalidates `["/api/quotes"]` and `["/api/quotes?include=items"]` query caches
- Shows toast: "Quote saved" or "New version created (Version N)"
- Closes save dialog

### 14.6 Re-save Existing Quote (New Version)

If the current `quoteItems` came from loading an existing quote (via `currentQuoteId`), the server detects the existing `quoteNo` and creates a new version instead of a new quote:
- `isNewVersion = true` in response
- Old versions are marked `isArchived = true`
- `quotes.activeVersionId` points to the new version

---

## 15 — QUOTE VERSIONING

### 15.1 Version Model

```
quotes
  id
  quoteNo          (Q-2025-0042)  — never changes
  partyName        — header info, never changes
  status           — draft / sent / accepted / rejected / expired
  activeVersionId  → quoteVersions.id

quoteVersions
  id
  quoteId
  versionNo       (1, 2, 3, ...)
  isArchived      (false for current, true for old)
  isLocked        (true if negotiated)
  subtotal / gstPercent / gstAmount / finalTotal
  paymentTerms / deliveryDays / transportCharge
  fluteFactorA/B/C/E/F    ← snapshotted
  fluteHeightA/B/C/E/F    ← snapshotted
  boardThicknessMm / thicknessSource
  partySnapshot   ← JSONB snapshot of party at save time
  paperPricesSnapshot
  termsSnapshot
  transportSnapshot

quoteItemVersions
  quoteVersionId
  itemIndex         (order)
  itemDataSnapshot  ← full QuoteItem JSON (includes box_length/width/height if present; group_id if grouped) [V2 Clarification]
  originalCostPerBox / negotiatedCostPerBox / finalCostPerBox
  originalTotalCost / finalTotalCost

quoteItemGroups  ← [V2 Addition] persists group definitions per version
  quoteVersionId
  groupSnapshot   ← full QuoteItemGroup JSON (includes group_total_sell_price at snapshot time)
```

### 15.1a Group Persistence in Versions [V2 Addition]

When a quote version is created (first save, or edit → new version):
- All `QuoteItemGroup` records for the quote are serialized into `quoteItemGroups.groupSnapshot` JSONB alongside the corresponding `quoteItemVersions`.
- `group_total_sell_price` is frozen to its value at snapshot time.
- When a version is restored, both `quoteItemVersions` (item snapshots) and `quoteItemGroups` (group snapshots) are restored together.
- Loading an older version re-populates groups in the UI exactly as they were at that version's save time.

### 15.2 Version History UI

"Version History" button on a quote opens a dialog:
- Fetches `GET /api/quotes/:id/versions`
- Lists all versions with date, version number, and total
- "Restore" button calls `POST /api/quotes/:id/restore/:versionNumber`
- Invalidates quote and version caches

### 15.3 Locked Versions

If a version has `isLocked = true` (was negotiated), it cannot be edited. It can only be viewed or a new version can be branched from it.

---

## 16 — EDIT QUOTE FROM REPORTS

### 16.1 URL Structure

When a user clicks "Edit" on a quote in the Reports page, they are navigated to:
```
/calculator?quoteId={id}&from=reports&state={encodedStateJSON}
```

`encodedStateJSON` contains the current filter state of the reports page (tab, party filter, search, dates, page number) so the user can return to the same view.

### 16.2 Loading the Quote

On mount, if `urlParams.quoteId` is present:
1. `loadingQuoteFromUrl = true`
2. Fetch `GET /api/quotes/:quoteId` — load **only this single quote** with its items.
   > **IMPORTANT**: Do NOT load all quotes via `GET /api/quotes?include=items` and then filter client-side. At scale (2000+ quotes), this transfers thousands of item objects over the wire and exposes all quote data to the browser unnecessarily.
3. Populate all form state from the returned quote: `quoteItems`, `partyName`, `customerCompany`, `customerEmail`, `customerMobile`, `paymentTerms`, `deliveryDays`, `transportCharge`, `transportRemark`
4. Set `loadingQuoteFromUrl = false`

### 16.3 Preview Mode Banner

While in edit mode (`isEditMode = true`), a yellow banner appears:
*"Quote Preview Mode — This quote is in read-only mode. Click 'Update Quote' to create a new version."*

The user must click "Update Quote" to explicitly create a new version. Simply navigating to the calculator with a `quoteId` does NOT auto-create a version.

### 16.4 Return to Reports

"Back to Reports" button calls `handleReturnToReports()` which decodes the `state` URL param and navigates back to `/reports` with the same filters restored.

---

## 17 — SEND QUOTE VIA WHATSAPP / EMAIL

### 17.1 Message Dialog

Triggered by: "Send via WhatsApp" or "Send via Email" buttons. State: `showMessageDialog = "whatsapp" | "email" | null`.

### 17.2 Message Generation

Messages are generated from the current `quoteItems`, `companyProfile`, party info, and quote totals. The content depends on:
- `item.selected` — only selected items appear
- Per-item visibility flags (`showPaperSpec`, `showPrinting`, `showBS`, `showCS`, `showWeight`)
- `businessDefaults` column visibility settings (`showColumnBoxSize`, `showColumnBoard`, etc.)

### 17.3 WhatsApp Message

Generated as plain text with Unicode formatting:
```
*[Company Name]* | *[Owner Name]* | [Phone]
Quotation for: *[Party Company]* / *[Party Name]*
Quote Ref: Q-2025-0042 | Date: DD/MM/YYYY

[item rows formatted as table-like text blocks]

*Subtotal: ₹X,XXX*
*GST (5%): ₹XXX*
*Total: ₹X,XXX*

Payment: [paymentTerms]
Delivery: [deliveryDays]
```

Pre-filled into `editableWhatsAppMessage` (editable before sending). Clicking "Send" opens `wa.me/{mobile}?text={encoded}` in a new tab.

### 17.4 Email Message

Generated as HTML body. Pre-filled into `editableEmailBody` and `editableEmailSubject`. Sent via `POST /api/send-email` or the user's configured SMTP/OAuth provider.

### 17.5 Column Visibility Applied to Messages

The `businessDefaults` flags control which columns appear in generated messages (single source of truth):

| Flag | Column |
|------|--------|
| `showColumnBoxSize` | L×W×H dimensions |
| `showColumnBoard` | Ply (3-ply, 5-ply…) |
| `showColumnFlute` | Flute combination |
| `showColumnPaper` | Paper spec string |
| `showColumnPrinting` | Printing details |
| `showColumnLamination` | Lamination cost |
| `showColumnVarnish` | Varnish cost |
| `showColumnWeight` | Box weight |

### 17.6 Grouped Items in Message Output [V2 Addition]

When the quote contains `QuoteItemGroup` records:

**Customer-facing output (WhatsApp / email / PDF):**
- The group appears as a **single combined commercial line**, using the `group_name` as the line description.
- The line shows `group_total_sell_price` as the line price.
- Member item detail rows are **not** shown in the customer-facing message by default.

**Internal / full-detail output:**
- An expanded view can be toggled (operator-facing only, not shown to customer).
- Shows all member items with individual prices, indented under the group name.

**Message generation logic:**
```
for each line in quoteItems (selected only):
    if item.group_id is not null and item is NOT the first member of the group:
        skip (suppress duplicate group line)
    else if item.group_id is not null and item IS the first member:
        output group header line: group_name | group_total_sell_price
    else:
        output normal item line
```

The generator must use a passed-in `quoteItemGroups` map to look up group metadata when rendering group lines.

---

## 18 — BULK UPLOAD VIA EXCEL [V3 Note: See §33–34 for Full Bulk Costing Module]

> **[V3 Clarification]** This section documents the **Excel-only** bulk upload flow (basic pipeline). The full V3 Bulk Costing Module — which integrates Excel, AI PDF/email/image extraction, and the Common Draft Costing Rows model — is documented in **§33** (AI Extraction + Review Flow) and **§34** (Common Draft Costing Rows Model). All Excel rows processed here pass through the same `DraftCostingRow` normalization pipeline described in §34 before costing runs.

### 18.1 Access

"Bulk Upload" button on calculator. Toggle: `showBulkUpload`. Can also be pre-opened via `initialShowBulkUpload = true` prop (used from navigation).

### 18.2 Template Download

Calls `downloadSampleTemplate()` — downloads a pre-built Excel template with correct column structure.

### 18.3 Upload Flow (Server-Side Async)

Bulk upload processing runs **server-side** to support large files (400+ rows) with authoritative costing and per-row error reporting.

**Step-by-step:**
1. User selects an `.xlsx` / `.xls` file via file picker.
2. Frontend sends:
   ```
   POST /api/bulk-upload
   Content-Type: multipart/form-data
   Body: { file: <xlsx binary> }
   ```
3. Server parses the file (Python `openpyxl`), validates column headers, enqueues a background job, and immediately returns:
   ```json
   { "jobId": "uuid", "totalRows": 42 }
   ```
4. Frontend polls `GET /api/bulk-upload/jobs/:jobId/status` every **1000ms**. A progress bar is shown using `processed / totalRows`.
5. Server processes each row using the **authoritative** formula chain (same engine as `POST /api/calculate`). Uses live BF prices, flute settings, and markup from `business_defaults` — not browser state.
6. When `status = "complete"`, frontend calls `GET /api/bulk-upload/jobs/:jobId/results`, which returns `{ items: QuoteItem[], errors: RowError[] }`.
7. All `items` are appended to `quoteItems`. Dialog closes.
8. If `errors.length > 0`, an error panel appears inside the dialog listing per-row failures. User can download the error log as CSV. Successfully processed rows are still added to the quote.

### 18.4 Server-Side Processing (Per Row)

For each Excel row, the server:
1. Parses and validates: `boxName`, `type` (`rsc`/`sheet`), `ply`, `length`, `width`, `height` (optional for sheet type), `quantity`, `layers[]`.
2. Runs input validations V01–V10 (§29 of formula doc). Invalid rows → `errors[]`, not `items[]`.
3. Executes the full F01–F23 authoritative formula chain.
4. Loads live BF prices and markup from DB (same path as `/api/calculate`).
5. Missing BF price → row error P01: *"No price configured for BF [X]."*
6. Successful rows → full `QuoteItem` JSON stored in the job results.
7. `formula_version` written per row using `CURRENT_FORMULA_VERSION`.

### 18.5 Job Status Response

```json
{
  "jobId": "uuid",
  "status": "pending | processing | complete | failed",
  "processed": 35,
  "totalRows": 42,
  "errors": [
    { "rowNumber": 7, "boxName": "Sample Box", "errorCode": "P01", "message": "No price configured for BF 26." }
  ]
}
```

### 18.6 Job Retention

- Job results retained for **24 hours**, then purged.
- `jobId` stored in component state and `sessionStorage` — if the user navigates away and returns within 24 hours, the same `jobId` can fetch results again.
- DB table: `bulk_upload_jobs` — columns: `id`, `tenant_id`, `status`, `total_rows`, `processed_rows`, `result_jsonb`, `errors_jsonb`, `created_at`, `expires_at`.

---

## 19 — BOX SPECIFICATION HISTORY

*Source: `GET /api/box-specifications`, `GET /api/box-specifications/:id/versions`*

### 19.1 Purpose

Box specifications track unique box designs (L×W×H, ply, flute config) over time. Each time a box spec is saved with changes, a new version is created.

### 19.2 Version Restore

`POST /api/box-specifications/:id/restore/:versionNumber`
- Restores the `dataSnapshot` from that version as the current spec
- Invalidates `/api/box-specifications` and `/api/box-specifications/:id/versions` caches

### 19.3 Box Spec Structure

| Table | Key fields |
|-------|-----------|
| `box_specifications` | `id`, `boxType`, `length`, `breadth`, `height`, `ply`, `currentVersion`, `customerId` |
| `box_spec_versions` | `specId`, `versionNumber`, `dataSnapshot` (JSONB), `editedBy`, `editedAt`, `changeNote` |

---

## 20 — COMPANY PROFILE (READ-ONLY IN CALCULATOR)

**The calculator does NOT edit the company profile.**

It reads the profile from `GET /api/company-profiles` and uses it for:
- Quote header (company name, owner, address, GST, logo)
- WhatsApp/email message generation
- Profile completeness gate (§1.1)

Company profile editing is exclusively in **Settings → Account Profile**. Any attempt to edit from the calculator was intentionally removed.

**Multi-profile support**: Users can have multiple company profiles. A selector at the top of the calculator allows choosing which profile to use for a quote. Default profile (`isDefault = true`) is pre-selected.

---

## 21 — RATE MEMORY

*Source: `rate_memory` table, `GET /api/rate-memory`, `POST /api/rate-memory`*

### 21.1 Purpose

Rate Memory caches (BF value + Shade) → Rate combinations. When a user sets a manual rate for a layer with a specific BF+Shade, it is saved to rate memory so the same combination auto-fills in future sessions.

### 21.2 Key Structure

```
key = "{bfValue}|{shade}"    e.g. "18|Kraft/Natural"
rate = "38.5"                ₹/Kg
```

### 21.3 Load on Mount

```python
GET /api/rate-memory
# Returns array of { bfValue, shade, rate }
# Builds map: key → rate string
```

### 21.4 Save on Rate Entry

```python
POST /api/rate-memory
Body: { bfValue: "18", shade: "Kraft/Natural", rate: 38.5 }
```

Saved **only when user manually overrides a rate** (`priceOverride = true`). Auto-calculated BF engine rates do NOT write to rate memory.

**Master Price Update Prompt**: After saving to rate memory, if the stored rate differs from the current `paper_bf_prices` master for this BF, the UI shows a non-blocking prompt:
> *"Calculated rate for BF [X] (Shade: [Y]) is ₹[Z]/Kg, which differs from the master price of ₹[M]/Kg. Update Paper Master?"*
> Buttons: **[Yes, Update Master]** | **[No, Keep Separate]**

- If **Yes**: `POST /api/paper-bf-prices/:id` with the new rate, invalidates `['/api/paper-bf-prices']` cache. The master base price is updated for all future calculations.
- If **No**: rate memory entry is kept privately for this session/user without touching the master.

---

## 22 — API ENDPOINTS REFERENCE

> **API versioning**: All new endpoints use the `/api/v1/` prefix. Existing unversioned routes remain active during the migration window. When rebuilding in Python/FastAPI, implement under `/api/v1/` from the start. The frontend should read the base URL from an env var (`VITE_API_BASE = /api/v1`).

### 22.1 Read-Only Data Endpoints (Calculator Consumers)

| Endpoint | Method | Response | Purpose |
|----------|--------|----------|---------|
| `/api/company-profiles` | GET | `CompanyProfile[]` | Load company profiles |
| `/api/business-defaults` | GET | `BusinessDefaults` | Load GST rate, round-off flag |
| `/api/party-profiles` | GET | `PartyProfile[]` | Load customer list |
| `/api/paper-bf-prices` | GET | `PaperBfPrice[]` | BF base prices for rate engine |
| `/api/shade-premiums` | GET | `ShadePremium[]` | Shade premium map |
| `/api/paper-pricing-rules` | GET | `PaperPricingRules` | GSM limits and market adjustment |
| `/api/flute-settings` | GET | `FluteSetting[]` | Flute factors and heights |
| `/api/settings` | GET | `AppSettings` | PLY_THICKNESS map overrides |
| `/api/rate-memory` | GET | `RateMemoryEntry[]` | Cached BF+Shade rates |
| `/api/quotes?include=items` | GET | `Quote[]` | All quotes with items (Reports page only) |
| `/api/quotes/:id` | GET | `Quote` with items | Load single quote for editing (calculator edit flow) |
| `/api/box-specifications` | GET | `BoxSpecification[]` | Saved box spec history |
| `/api/box-specifications/:id/versions` | GET | `BoxSpecVersion[]` | Version list for a spec |

### 22.2 Write Endpoints (Calculator Actions)

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/quotes` | POST | Quote payload (§14.3) | Save new quote / create new version |
| `/api/party-profiles` | POST | Party fields | Create new party |
| `/api/party-profiles/:id` | PATCH | Partial party fields | Edit party |
| `/api/party-profiles/:id` | DELETE | — | Delete party |
| `/api/rate-memory` | POST | `{bfValue, shade, rate}` | Save rate memory entry |
| `/api/box-specifications/:id/restore/:versionNumber` | POST | — | Restore box spec version |
| `/api/bulk-upload` | POST | `multipart/form-data {file}` | Submit Excel file; returns `{jobId, totalRows}` |
| `/api/bulk-upload/jobs/:jobId/status` | GET | — | Poll job status, progress, and per-row errors |
| `/api/bulk-upload/jobs/:jobId/results` | GET | — | Fetch `{items: QuoteItem[], errors: RowError[]}` when complete |
| `/api/quotes/:id/lock` | POST | — | Acquire soft edit lock |
| `/api/quotes/:id/lock` | DELETE | — | Release edit lock |
| `/api/quotes/:id/lock` | GET | — | Check if lock is held by another user |

### 22.4 V3 Endpoints — Document Storage [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/documents` | GET | — | List documents for tenant (filterable by category, party, quote) |
| `/api/v1/documents` | POST | `multipart` | Upload a file (PDF/image/email) |
| `/api/v1/documents/:id` | GET | — | Fetch document metadata |
| `/api/v1/documents/:id/download` | GET | — | Download document binary |
| `/api/v1/documents/:id` | DELETE | — | Soft-delete a document |
| `/api/v1/documents/:id/extract` | POST | `{mode: 'auto'\|'llm'}` | Trigger AI extraction job on a stored document |

### 22.5 V3 Endpoints — Bulk Costing / AI Extraction [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/bulk-jobs` | POST | `{source_type, document_id?}` | Start AI or Excel bulk costing job |
| `/api/v1/bulk-jobs/:id/status` | GET | — | Poll job status + per-row results |
| `/api/v1/bulk-jobs/:id/rows` | GET | — | Fetch all `DraftCostingRow` records for job |
| `/api/v1/bulk-jobs/:id/rows/:rowId` | PATCH | `{field: value}` | Manually correct a single draft row field |
| `/api/v1/bulk-jobs/:id/rows/:rowId/accept` | POST | — | Accept row (set status `'ready'` after review) |
| `/api/v1/bulk-jobs/:id/promote` | POST | `{row_ids: []}` | Promote `'costed'` rows to `QuoteItem`s in current quote |

### 22.6 V3 Endpoints — Negotiation Timeline [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/quotes/:qid/items/:iid/negotiation` | GET | — | Fetch full negotiation event history for a quote item |
| `/api/v1/quotes/:qid/items/:iid/negotiation` | POST | `{event_type, price_offered, note}` | Add a negotiation round (offer/counter/accept/reject) |
| `/api/v1/client-pricing/:partyId` | GET | — | Get client-specific pricing policy |
| `/api/v1/client-pricing/:partyId` | PUT | pricing policy body | Upsert client pricing policy |

### 22.7 V3 Endpoints — Price Increase [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/price-increase/preview` | POST | `{quote_item_ids: []}` | Compute `Δ_abs`, `Δ_pct` for listed items using current master data |
| `/api/v1/price-increase/events` | POST | event list | Save price increase event records |
| `/api/v1/price-increase/events` | GET | — | List all price increase events for tenant |
| `/api/v1/price-increase/events/:id/send` | POST | — | Trigger email/WhatsApp send for a price increase notification |

### 22.8 V3 Endpoints — Follow-Up Automation [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/follow-ups` | GET | — | List all active follow-up automations for tenant |
| `/api/v1/follow-ups` | POST | automation config | Create a follow-up rule for a quote |
| `/api/v1/follow-ups/:id` | PATCH | `{status: 'paused'\|'active'}` | Pause or resume a follow-up rule |
| `/api/v1/follow-ups/:id` | DELETE | — | Delete a follow-up rule |
| `/api/v1/follow-ups/logs` | GET | — | Fetch history of all automated follow-up sends |

### 22.9 V3 Endpoints — Spec, Job Card, QA, Tally [V3 Addition]

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/v1/quotes/:id/spec-sheet` | GET | — | Generate specification sheet PDF (no pricing) |
| `/api/v1/quotes/:id/job-cards` | GET | — | List job cards derived from accepted quote items |
| `/api/v1/quotes/:id/job-cards/:jcid` | GET | — | Fetch a single job card with all production fields |
| `/api/v1/quotes/:id/qa-reports/:jcid` | GET | — | Fetch QA report checklist for a job card |
| `/api/v1/tally/parties` | POST | `{party_ids: []}` | Push party profiles to Tally as ledger entries |
| `/api/v1/tally/products` | POST | `{item_ids: []}` | Push quote items to Tally as stock items |
| `/api/v1/tally/invoices` | POST | `{quote_id}` | Push accepted quote as sales voucher to Tally |
| `/api/v1/tally/logs` | GET | — | List Tally push log entries for tenant |

### 22.3 Response Format Conventions

All endpoints:
- Return JSON
- Return 200/201 on success
- Return 400 with `{ error: string }` on validation failure
- Return 401 on auth failure
- Return 500 with `{ error: string }` on server error

All `id` fields are UUIDs (via `gen_random_uuid()`).

---

## 25 — PDF / DOCUMENT GENERATION FLOW

*Triggered from: Quote detail view (Reports page) → "Generate PDF" / "Download Invoice" / "Download Challan" buttons.*

### 25.1 Document Types

| Type | When Available | Content |
|------|---------------|--------|
| Quote PDF | Any saved quote status | Company header, party details, all selected items, pricing table, terms, GST breakdown, totals |
| Delivery Challan | Status = `accepted` | Line items (box name, qty, dimensions) without pricing |
| Tax Invoice | Status = `accepted` | Full pricing with HSN code, GSTIN of both parties, tax breakdown |

### 25.2 Generation Trigger

```
GET /api/quotes/:id/pdf?type=quote|challan|invoice
```

- Returns: `application/pdf` binary stream OR `{ url: string }` if generation is async
- Auth: session cookie required
- Tenant isolation: server validates `quoteId` belongs to requesting `tenant_id`

### 25.3 Data Sources (immutable snapshots only)

The PDF generator reads exclusively from stored snapshots — never from live master tables:

| PDF Section | Source |
|-------------|--------|
| Company header | `company_profiles` (live — current branding) |
| Customer details | `quoteVersions.partySnapshot` JSONB |
| Item specs & pricing | `quoteItemVersions.itemDataSnapshot` JSONB |
| Subtotal / GST / Total | `quoteVersions.subtotal`, `gstAmount`, `finalTotal` |
| Flute details | `quoteVersions.fluteFactorA/B/C/E/F` |
| Payment terms | `quoteVersions.paymentTerms` |
| Transport charge | `quoteVersions.transportCharge` |

### 25.4 Template Fields (Quote PDF)

**Header block:**
- Company logo (from `company_profiles.logo_url`)
- Company name, address, GSTIN, phone
- Quote reference: `Q-{YEAR}-{SEQ}`, date, valid until

**Party block:**
- Party name, company, address, GSTIN (from `partySnapshot`)

**Items table** (one row per `quoteItemVersions` with `selected=true`):
- Sr. No., Box Name, Type, Ply, L×W×H, Paper Spec, Sheet Size, Qty, Rate/Box, Total
- Conditional columns per `businessDefaults` visibility flags

**Totals block:**
- Subtotal, Transport Charge, GST (CGST+SGST or IGST), Round Off, Grand Total

**Footer block:**
- Payment terms, delivery days, quote validity, authorised signatory line

### 25.5 Security

- `logo_url` must be served from your own storage (S3/local). **Never fetch external URLs server-side** during PDF generation (SSRF risk).
- Box name in email/PDF body must be HTML-escaped before rendering. **Never inject raw user input into HTML templates** (XSS risk).

---

## 26 — QUOTE EXPIRY AUTOMATION

*Source: scheduled job — runs daily.*

### 26.1 Mechanism

A daily scheduled task (cron job or task queue) runs at **00:05 UTC** and marks expired quotes:

```sql
UPDATE quotes
SET status = 'expired'
WHERE status IN ('draft', 'sent')
  AND valid_until < CURRENT_DATE
  AND tenant_id = ANY(SELECT id FROM tenants WHERE active = true);
```

### 26.2 Python Implementation

```python
# FastAPI background task or APScheduler job
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=0, minute=5)
async def expire_overdue_quotes():
    async with get_db() as db:
        result = await db.execute(
            """
            UPDATE quotes SET status = 'expired'
            WHERE status IN ('draft', 'sent')
              AND valid_until < CURRENT_DATE
            """
        )
        # Optionally log: result.rowcount rows expired
```

### 26.3 validUntil Field

- Stored in `quoteVersions.validUntil` (DATE, nullable).
- Default: 30 days from quote creation date (configurable in `business_defaults.default_validity_days`).
- User can override per quote at save time.
- If `validUntil IS NULL`, quote never automatically expires.

### 26.4 Accepted Quotes

Once a quote reaches `status = 'accepted'`, it is **never** auto-expired by the cron job. Only `draft` and `sent` statuses are eligible.

---

## 27 — SECURITY NOTES

*These are known risks that must be mitigated during implementation.*

### 27.1 Unsigned OAuth State Parameter

**Risk**: The `state` URL parameter used in OAuth email authentication flows is not cryptographically signed. An attacker can craft a `state` value to trigger arbitrary redirects after OAuth callback.

**Mitigation**: Generate `state` as `base64(HMAC-SHA256(nonce + timestamp, OAUTH_STATE_SECRET))`. Validate signature on callback before processing.

### 27.2 WhatsApp URL — Unvalidated Mobile Number

**Risk**: The `wa.me/{mobile}?text={msg}` URL is opened in a new tab using whatever is in `customerMobile`. If the mobile contains injection characters (e.g., `/../` or `javascript:`), it could construct a malformed URL.

**Mitigation**: Validate `customerMobile` against `/^[0-9]{10}$/` before building the `wa.me` URL. Disable the WhatsApp button if validation fails. Show tooltip: *"Enter a valid 10-digit mobile number to send via WhatsApp."*

### 27.3 XSS via Box Name in Email Body

**Risk**: `boxName` is a free-text field entered by the user. If it is interpolated directly into the HTML email body without escaping, a user could enter `<script>alert(1)</script>` as a box name, and the resulting email body would carry XSS payload to recipients.

**Mitigation**: Always HTML-escape all user-supplied strings before inserting into email body templates. In Python: `html.escape(box_name)`. In Jinja2 templates, auto-escaping must be enabled (`autoescape=True`).

### 27.4 SSRF via Company Logo URL

**Risk**: If the PDF generator or email template fetches `company_profiles.logo_url` server-side (e.g., to embed it in a PDF), and the URL points to an internal network address (e.g., `http://169.254.169.254/...`), the server would make an outbound request to internal infrastructure.

**Mitigation**: Store all logos in your own object storage (S3/local disk). The `logo_url` should always be a relative path or a pre-validated hostname. Never allow arbitrary external URLs in `logo_url`.

```
        [Create]
           │
           ▼
        "draft"   ←──────────── [New version saved]
           │
           │ [Send]
           ▼
         "sent"
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
"accepted"   "rejected"
    
"expired" — can be set at any time (validity period elapsed)
```

### Status Transitions

| From | To | Trigger |
|------|----|---------|
| draft | sent | User sends via WhatsApp/Email |
| sent | accepted | User marks as accepted |
| sent | rejected | User marks as rejected |
| any | expired | Validity date passed / manual |
| any | draft | New version created from existing |

---

## 24 — DATA IMMUTABILITY AND SNAPSHOT RULES

This is a **critical** design invariant. When a quote is saved:

### What Is Snapshotted

| Data | Where stored | Why |
|------|-------------|-----|
| Party details | `quoteVersions.partySnapshot` | Party may be edited or deleted later |
| Flute factors | `quoteVersions.fluteFactorA/B/C/E/F` | Admin may change flute settings |
| Flute heights | `quoteVersions.fluteHeightA/B/C/E/F` | Same reason |
| Board thickness | `quoteVersions.boardThicknessMm` | Preserves exact calculation used |
| Thickness source | `quoteVersions.thicknessSource` | `'auto'` or `'manual'` |
| Paper prices | `quoteVersions.paperPricesSnapshot` | Prices may change |
| Terms | `quoteVersions.termsSnapshot` | Terms may be edited |
| Full item data | `quoteItemVersions.itemDataSnapshot` | Complete `QuoteItem` JSON |

### What Is NOT Snapshotted (live links)

- `quotes.partyId` — FK to the party record (but party snapshot is also stored)
- `quotes.companyProfileId` — FK to company profile
- `quotes.status` — live mutable field

### Python Backend Implication

When generating a quote document (PDF, WhatsApp, email) for a saved quote:
1. **Always read from `quoteVersions` and `quoteItemVersions`**, not from current master tables.
2. The `itemDataSnapshot` JSONB contains the complete `QuoteItem` — use it as the source of truth.
3. For display, use the snapshotted flute factors/heights, not current `flute_settings`.
4. For party display, use `partySnapshot`, not current `party_profiles`.

---

## 28 — UNSAVED DATA AND NAVIGATION GUARD

### 28.1 What Counts as Dirty State

The calculator is considered "dirty" (has unsaved work) when **any** of the following are true:

- `quoteItems.length > 0` — one or more items added to the current quote
- Any dimension field is non-empty (`rscLength`, `rscWidth`, `rscHeight`, `sheetLength`, `sheetWidth`)
- `boxName` is non-empty

### 28.2 Browser-Level Guard (`beforeunload`)

When dirty state is detected, a `beforeunload` event listener is registered:

```javascript
useEffect(() => {
  if (isDirty) {
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }
}, [isDirty]);
```

This triggers the browser's native "Leave page?" confirmation if the user closes the tab, refreshes, or navigates away externally.

### 28.3 React Router Navigation Block

When dirty and the user clicks an in-app link (Reports, Settings, etc.), the router navigation is blocked and a confirmation modal appears:

> *"You have unsaved items in your quote. If you leave now, your work will be lost."*
> Buttons: **[Stay]** | **[Leave Anyway]**

- **Stay**: dismisses the dialog, navigation cancelled.
- **Leave Anyway**: navigation proceeds; `quoteItems` is NOT auto-saved.

### 28.4 Exceptions — Guard Not Active

- Immediately after a successful save (`POST /api/quotes` returns 200) — `quoteItems` is cleared, state is clean.
- While `quoteItems.length === 0` AND all dimension inputs are empty.

---

## 29 — CONCURRENT EDIT HANDLING

### 29.1 Scenario

Two users (or two browser tabs) open the same saved quote for editing via `?quoteId=`.

### 29.2 Strategy: Last-Write-Wins with Version Mismatch Detection

BoxCostPro uses **optimistic concurrency** — no user is blocked from editing, but conflicts are detected at save time.

**Mechanism:**

When a quote is loaded for editing, the frontend captures `currentVersionNo` (e.g., `2`).

When saving, the API call includes `"expectedVersionNo": 2`. The server checks the latest version in DB. If it is **higher** than `expectedVersionNo`, a conflict is detected.

**Conflict response:**
```json
HTTP 409 Conflict
{
  "error": "version_conflict",
  "message": "This quote was modified by another user while you were editing.",
  "latestVersionNo": 4
}
```

**Frontend on 409:**
- Do NOT discard the user's edits.
- Show a conflict resolution dialog:
  > *"This quote has been updated by another user (now at Version 4). Your changes have not been saved."*
  > Buttons: **[Save Anyway as Version 5]** | **[Reload Latest Version]** | **[Cancel]**
  - **Save Anyway**: re-submits with `forceCreate: true`.
  - **Reload Latest**: discards current edits, reloads version 4.
  - **Cancel**: keeps current edit state for manual review.

### 29.3 Soft Edit Lock

When a user opens a quote via `?quoteId=`:
- `POST /api/quotes/:id/lock` — sets `quotes.editingByUserId` + `editingLockedAt` timestamp.
- Other users loading the same quote see a yellow advisory banner:
  > *"[User] has been editing this quote since [time]. Edits may conflict."*
- Lock auto-expires after **30 minutes** of inactivity.
- Lock released on: successful save, page navigation (`beforeunload` fires `DELETE /api/quotes/:id/lock`), or admin override.

### 29.4 Non-Blocking Design

The soft lock is **advisory only** — it does not prevent a second user from editing. The version mismatch detection (§29.2) is the hard safety net that guarantees no silent data overwrite.

---

## 30 — RBAC — FRONTEND ROLE GUARD RULES

### 30.1 Source of Truth

The current user's role and plan are available from:
1. The session payload (decoded at login and stored in React context / Zustand store).
2. The `X-User-Role` and `X-Plan` headers on every authenticated API response.

Frontend must update the role store on every API response to catch server-side role changes (e.g., admin demoted while the app is open).

### 30.2 UI Guard Rules Per Role

| UI Element | Owner | Admin | Manager | Salesperson | Viewer |
|-----------|:-----:|:-----:|:-------:|:-----------:|:------:|
| Settings nav links (Masters, Profile, Team, Billing) | ✅ | ✅ | Hidden | Hidden | Hidden |
| "Save Quote" button | ✅ | ✅ | ✅ | ✅ | Hidden |
| "Delete Quote" menu item | ✅ | ✅ | ✅ | Own only | Hidden |
| "Send" button (email/WhatsApp) | ✅ | ✅ | ✅ | ✅ | Hidden |
| Bulk Upload button | ✅ | ✅ | ✅ | ✅ | Hidden |
| All quotes in Reports table | ✅ | ✅ | ✅ | Own only | ✅ |
| Edit Quote from Reports | ✅ | ✅ | ✅ | Own only | Hidden |
| Invite Members button | ✅ | ✅ | Hidden | Hidden | Hidden |
| Billing & Plans page | ✅ | Hidden | Hidden | Hidden | Hidden |
| Calculator (create) | ✅ | ✅ | ✅ | ✅ | View-only |

> **Hide, don't disable**: elements the user has no permission to use should not render at all, not render as grey/disabled. This prevents confusion and avoids revealing the existence of features the user cannot access.

### 30.3 Viewer Mode

When `role === 'viewer'`, the calculator renders in a read-only state:
- All input fields are `disabled` or rendered as static text.
- "Add to Quote", "Save Quote", "Send" buttons are not rendered.
- A persistent read-only banner is shown at the top: *"You have view-only access. Contact your admin to request edit permissions."*

### 30.4 Salesperson Scope Filter

When `role === 'salesperson'`, the Reports page filters to `createdBy === currentUserId` client-side. However, the **backend also enforces this** — `GET /api/v1/quotes` with a salesperson session automatically applies `WHERE created_by = :user_id`. Frontend filtering is a UX convenience, not a security boundary.

### 30.5 Role Change While App Is Open

If an admin changes a user's role while they have the app open:
1. The user's next API call returns a new `X-User-Role` header reflecting the new role.
2. The frontend detects a role change (new role !== stored role) and re-renders all gated UI.
3. If the role was reduced (e.g., admin → viewer), a toast notification is shown: *"Your access level has been updated by an admin."*

---

## 31 — SCALABILITY & BACKGROUND ARCHITECTURE

### 31.1 Background Job Queue

BoxCostPro uses **Celery** with Redis as the broker for all operations that must not block the HTTP request cycle:

| Task | Celery task name | Trigger | Retry policy |
|------|-----------------|---------|-------------|
| Bulk Excel processing | `process_bulk_upload` | POST /api/v1/bulk-upload | 3 retries, exp. backoff |
| PDF generation | `generate_quote_pdf` | Quote save or explicit request | 3 retries |
| Send quote email | `send_quote_email` | "Send" action | 3 retries, 60s delay |
| Send quote WhatsApp | `send_quote_whatsapp` | "Send" action | 2 retries |
| Quote expiry sweep | `expire_quotes_cron` | Celery Beat, every hour | No retry (idempotent) |
| Bulk job cleanup | `cleanup_expired_jobs` | Celery Beat, every hour | No retry |
| Invitation expiry cleanup | `cleanup_expired_invitations` | Celery Beat, daily | No retry |
| AI extraction job | `run_ai_extraction` | POST /api/v1/documents/:id/extract | 2 retries, 120s delay |
| Bulk AI costing job | `process_bulk_ai_costing` | POST /api/v1/bulk-jobs (ai source) | 3 retries, exp. backoff |
| Pattern sync (tenant→global) | `sync_patterns_to_global` | Celery Beat, nightly | No retry (anonymous only) |
| Follow-up send | `send_follow_up_message` | Celery Beat, every 30 min | 3 retries, 5 min delay |
| Price increase notification | `send_price_increase_notification` | POST /api/v1/price-increase/events/:id/send | 3 retries, 60s delay |
| Tally push | `push_to_tally` | POST /api/v1/tally/* | 2 retries, 30s delay |
| Job card generation | `generate_job_card` | Quote item accepted event | 1 retry |
| Spec sheet PDF generation | `generate_spec_sheet_pdf` | GET /api/v1/quotes/:id/spec-sheet | 2 retries |

**Worker setup (minimal):**
```bash
# Start worker
celery -A app.celery_app worker --loglevel=info --concurrency=4
# Start beat scheduler
celery -A app.celery_app beat --loglevel=info
```

### 31.2 Redis Responsibilities

| Purpose | Key pattern | TTL |
|---------|------------|-----|
| Session storage | `session:{session_id}` | 7 days rolling |
| Rate limit counters | `rl:{user_id}:{endpoint}` | Per tier (see §16.5) |
| Celery broker queue | `celery` (default) | N/A |
| Celery results backend | `celery-task-meta-*` | 24 hours |
| Edit lock (advisory) | `editlock:{quote_id}` | 30 minutes |

### 31.3 Horizontal Scaling Rules

| Component | Scaling strategy |
|-----------|------------------|
| FastAPI app | Stateless — scale horizontally behind a load balancer. Session in Redis, not in-process. |
| Celery workers | Scale independently from the web tier. Deploy on separate nodes for CPU-heavy PDF/Excel work. |
| PostgreSQL | Vertical scale first; add read replica for report queries when read traffic grows. |
| Redis | Redis Cluster or Redis Sentinel for HA in production. |
| Object storage | External (S3 / GCS / R2) — no in-container state. |

### 31.4 Caching Strategy

| Data | Cache location | TTL | Invalidation |
|------|---------------|-----|-------------|
| BF prices (per tenant) | Redis `bfprices:{tenant_id}` | 5 minutes | On POST /api/v1/paper-bf-prices |
| Flute settings (per tenant) | Redis `flute:{tenant_id}` | 5 minutes | On POST /api/v1/flute-settings |
| Business defaults (per tenant) | Redis `bizdefaults:{tenant_id}` | 5 minutes | On POST /api/v1/business-defaults |
| Company profiles (per tenant) | Redis `profiles:{tenant_id}` | 2 minutes | On any profile write |
| Rate memory (per tenant) | Redis `ratemem:{tenant_id}` | 1 minute | On any rate memory write |

> **Never cache quotes**. Quote data changes frequently and must always reflect the latest DB state.

### 31.5 Multi-Region Deployment Notes

For global deployments (India + US + EU):

1. **Database**: Single primary PostgreSQL in primary region; read replicas in remote regions for report queries.
2. **Tenant routing**: Use tenant's registered country to route to the nearest region's app tier. Quote calculation is compute-light (no region affinity required).
3. **Data residency**: Enterprise customers may require all data to stay in a specific region. Implement per-tenant `data_region` field in `tenants` table; enforce at application layer.
4. **Object storage**: Use separate S3 buckets per region with tenant-to-bucket mapping.
5. **CDN**: Serve the React frontend (static bundle) from a CDN edge (CloudFront / Cloudflare). The app shell is region-agnostic.

---

## §32 — DOCUMENT STORAGE FLOW [V3 New Module]

This module manages the lifecycle of raw documents (PDFs, email exports, screenshots, images) that are uploaded by the user for AI extraction or kept in the specification repository.

### 32.1 Document Categories

| Category | Description | Linked to |
|----------|-------------|----------|
| `spec_pdf` | Buyer/client specification PDF | party, quote |
| `email_export` | Exported email thread as PDF or .eml | party, quote |
| `screenshot` | Image screenshot of a specification | party, quote |
| `internal_drawing` | Internal engineering/design file | quote item |
| `price_list` | Competitor or supplier price list PDF | tenant |
| `other` | Uncategorised document | tenant |

### 32.2 File Upload Flow

1. User clicks **Upload Document** in the Document Repository panel (accessible from: calculator, Reports, party profile, or dedicated Documents page).
2. A file picker opens — accepts `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.eml`.
3. File is uploaded via `POST /api/v1/documents` (multipart). Server:
   - Validates MIME type and file size (max 25 MB).
   - Saves the binary to **object storage** (S3 / compatible) at path `{tenant_id}/documents/{uuid}.{ext}`.
   - Creates a `document_files` DB record.
   - Returns `{document_id, status: 'uploaded'}`.
4. The document is now available in the repository. The user can tag it to a party and/or quote.
5. If the user selects **"Extract Costing Data"**, the AI extraction flow (§33) begins.

### 32.3 Document Metadata

See `03-admin-flow-master.md §23` for the full `document_files` table DDL and governance rules.

### 32.4 Security Rules

- All document downloads go through a signed URL route (`GET /api/v1/documents/:id/download`). The server generates a time-limited pre-signed S3 URL (expiry: 15 minutes). **Never expose the raw S3 URL in API responses** — IDOR risk.
- File size limit enforced at server before writing to storage (not just at CDN/proxy layer).
- MIME type validated from file header bytes (using `python-magic`), not from client-supplied `Content-Type`.
- Object storage bucket must have **no public read** access. All access is through signed URL generation.

---

## §33 — AI EXTRACTION + REVIEW FLOW [V3 New Module]

This section describes the end-to-end flow for extracting costing data from a document using the AI engine, including the review step before costing runs.

### 33.1 AI Extraction Trigger Points

| Trigger | Source |
|---------|--------|
| Document uploaded → user clicks "Extract" | `POST /api/v1/documents/:id/extract` |
| Bulk AI job started on multiple documents | `POST /api/v1/bulk-jobs` with `source_type: 'ai_pdf'` / `'ai_email'` / `'ai_image'` |
| Single spec string pasted in AI input field | Inline extraction on calculator page |

### 33.2 Extraction Pipeline (Backend)

```
[Document binary or text]
        ↓
[1. Pre-processing]
   PDF → text (pdfminer); Image → OCR (tesseract / AWS Textract); Email → text strip
        ↓
[2. Pattern Matching]
   Try tenant-local pattern library first.
   If confidence < threshold (configurable, default 0.75) → fall back to LLM.
        ↓
[3. LLM Extraction (if needed)]
   Prompt: domain-specific corrugated packaging grammar + examples.
   Output: structured JSON of field→value + confidence per field.
        ↓
[4. Normalization]
   Apply §37 (DraftCostingRow) normalization rules.
   Map extracted fields to QuoteItem schema.
        ↓
[5. Validation]
   Apply BK01–BK04 + V01–V10 validations.
   Set row status: 'ready' | 'review' | 'blocked'.
        ↓
[6. Store DraftCostingRow records]
   Persist in DB. Return rows to frontend for review UI.
```

### 33.3 Review UI

After extraction, the user sees a **Draft Costing Review table** with:
- One row per extracted item
- Each row shows extracted fields, coloured by confidence tier: green (high) / amber (medium) / red (low)
- Cells with `confidence < 0.60` show a ⚠️ icon and are pre-focused for editing
- Row-level status badge: Ready / Review Required / Blocked
- Actions per row: **Edit** | **Accept** | **Remove**
- Batch actions: **Accept All Ready** | **Cost Ready Rows** | **Export Blocked Errors**

### 33.4 Flow After Review

1. User corrects or accepts flagged rows.
2. User clicks **"Cost Selected Rows"** → backend runs the authoritative F01–F23 formula chain on each `'ready'` row using live master data.
3. Successfully costed rows get `status = 'costed'` and `costing_result` populated.
4. User clicks **"Add to Quote"** → `POST /api/v1/bulk-jobs/:id/promote` with selected row IDs. Each costed row becomes a `QuoteItem` appended to the active quote.
5. Review panel closes. Quote item table refreshes.

### 33.5 Extraction Confidence Rules

See `01-formula-master.md §36` for the full AI Extraction Confidence Model. Summary:
- High (0.85–1.00): Auto-accepted, no review prompt.
- Medium (0.60–0.84): Pre-filled, user prompted to confirm.
- Low (0.00–0.59): Blocked; must be manually corrected before row can be costed.

---

## §34 — COMMON DRAFT COSTING ROWS MODEL [V3 New Module]

All bulk costing flows (Excel + AI) share a single `DraftCostingRow` data model. This ensures the review UI, costing engine, and promotion pipeline are identical regardless of how data entered the system.

For the full `DraftCostingRow` dataclass definition, see `01-formula-master.md §37`.

### 34.1 Shared Pipeline

```
Excel upload   ────────────────────────────────┐
                                               ↓
AI PDF extract ──→ [Normalization (§37.3)] ──→ [DraftCostingRow]
                                               ↓
AI email/image ────────────────────────────────┘
                                               ↓
                               [BK01–BK04 + V01–V10 validation]
                                               ↓
                               [Status: ready / review / blocked]
                                               ↓
                                    [User Review UI (§33.3)]
                                               ↓
                            [Authoritative F01–F23 costing engine]
                                               ↓
                                    [Promote → QuoteItem]  
```

### 34.2 DB Table: `bulk_import_jobs` [V3 Extension of existing `bulk_upload_jobs`]

The existing `bulk_upload_jobs` table (see `03-admin-flow-master.md §11`) is extended to support AI-sourced jobs:

```sql
ALTER TABLE bulk_upload_jobs
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'excel'
        CHECK (source_type IN ('excel', 'ai_pdf', 'ai_email', 'ai_image')),
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES document_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50),  -- e.g. "regex_v3_rsc", "llm_v1"
    ADD COLUMN IF NOT EXISTS draft_rows_jsonb JSONB;         -- full DraftCostingRow array
```

### 34.3 Promotion to QuoteItem

When a `DraftCostingRow` with `status = 'costed'` is promoted:
1. Create a new `QuoteItem` using the `costing_result` as the authoritative data.
2. Set `source_type` on the `QuoteItem` to the row's `source_type`.
3. Set `extraction_confidence` on the `QuoteItem` to the row's `overall_confidence`.
4. Set `formula_version = CURRENT_FORMULA_VERSION`.
5. Append to the current quote's item list.
6. The `DraftCostingRow` record is retained for audit but can be purged after 30 days (configurable).

---

## §35 — AI PATTERN LEARNING — USER-FACING NOTES [V3 New Module]

### 35.1 How Pattern Learning Works (User Perspective)

Every successful AI extraction creates a **tenant-local pattern** — a learned template for recognising specification strings from a particular customer or document format. Over time, the AI becomes more accurate for your specific buyers.

**What is stored in tenant-local patterns:**
- Regex/template structure of successfully extracted spec strings
- Mapped field assignments (e.g., first dimension group = L, second = W)
- Confidence deltas (how much a pattern improved over baseline)

**What is NOT stored:** No raw customer data, no box names, no prices, no party details.

### 35.2 Anonymized Global Pattern Learning

With user consent (configurable in Settings → AI Config), BoxCostPro can contribute **anonymized structural patterns** to a global pool shared across all tenants:
- Only abstract pattern structure is shared (regex / field-mapping template).
- No values (prices, dimensions, party names) are ever shared.
- Global patterns improve cold-start accuracy for new tenants.

### 35.3 UI: Pattern Acceptance Feedback

After a user manually corrects an AI-extracted field, a micro-feedback prompt appears:
> *"Was this field incorrectly extracted? [Yes — help improve] | [Not now]"*

If the user clicks "Yes — help improve", the correction is used to update the tenant-local pattern (not shared globally unless global learning is opted in).

### 35.4 Admin Controls

See `03-admin-flow-master.md §24` for full AI parsing configuration and pattern learning admin settings.

---

## §36 — REPORTS-TO-REQUOTE FLOW [V3 New Module]

This flow lets a user take items from an existing accepted/sent quote and use them as the starting point for a new quote, avoiding manual re-entry.

### 36.1 Trigger

From the Reports page → Quote detail view → action menu → **"Requote"** button.

Available when quote status is: `accepted`, `rejected`, `expired` (not `draft`).

### 36.2 Flow

1. User opens the requote dialog. Shows all quote items from the selected version with checkboxes.
2. User selects items to include in the new quote (default: all selected).
3. User can optionally set a new quantity per item before creating.
4. User clicks **"Create New Quote from Selected"**.
5. Backend:
   - Creates a new `quotes` row with `status = 'draft'`.
   - Clones the selected `quoteItemVersions.itemDataSnapshot` records into the new quote's item list.
   - Re-runs the **authoritative costing engine** on each cloned item using **current live master data** (not the snapshotted rates). This ensures the new quote reflects today's prices.
   - Returns the new `quote_id`.
6. Frontend redirects to the calculator with the new quote pre-loaded.
7. A toast appears: *"New quote created from [Source Quote Ref]. Prices recalculated with current master data."*

### 36.3 Source Attribution

The new quote's `metadata` JSONB stores:
```json
{ "requoted_from_quote_id": "uuid", "requoted_from_version": 3 }
```
This is shown as a breadcrumb in the Reports view: *"Requoted from Q-2025-0041 v3"*.

### 36.4 RBAC

| Role | Can Requote |
|------|------------|
| Owner / Admin / Manager | Any quote |
| Salesperson | Own quotes only |
| Viewer | ❌ |

---

## §37 — CLIENT-WISE PRICING & NEGOTIATION TIMELINE [V3 New Module]

### 37.1 Client-Wise Pricing Policies

A **Client Pricing Policy** (CCP) can be attached to a `party_profile`. When a quote is created for that party, the CCP pre-fills negotiation defaults.

| Policy Field | Description |
|-------------|-------------|
| `default_discount_pct` | Automatic % discount applied at quote creation for this client. 0 = no discount. |
| `minimum_sell_price_pct` | Minimum sell price as a % of `total_cost_per_box` — engine blocks saves below this floor. |
| `preferred_payment_terms` | Auto-populated payment terms string for this client's quotes. |
| `notes` | Free-text internal notes on this client's pricing relationship. |

See `03-admin-flow-master.md §28` for the `client_pricing_policies` table DDL.

### 37.2 Negotiation Timeline UI

In the quote item table (Reports view → Quote detail → item row), a **"Negotiation"** panel shows below each item when expanded. It contains the full negotiation event history (see `01-formula-master.md §35.3` for `NegotiationEvent` dataclass).

**Panel layout:**
```
Timeline of events (oldest → newest):
  Round 1 — [Date] — Offered: ₹12.50/box — by Arjun (Salesperson)
  Round 2 — [Date] — Counter: ₹11.80/box — by Client (noted by Manager)
  Round 3 — [Date] — Accepted: ₹12.00/box — confirmed by Admin

[Current final_billing_price: ₹12.00/box]
```

**Add Round** button: Opens a dialog to add a new `NegotiationEvent`. Fields: event type (Offer / Counter / Accept / Reject), price/box, optional note.

### 37.3 Negotiation RBAC

| Role | Add negotiation round | Accept price | View timeline |
|------|----------------------|--------------|--------------|
| Owner / Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ |
| Salesperson | ✅ (own quotes) | ❌ (must escalate) | ✅ |
| Viewer | ❌ | ❌ | ✅ |

### 37.4 Accepted Price Locking

When `event_type = 'accept'` is recorded:
- `QuoteItem.negotiated_price` is set to `price_offered`.
- `QuoteItem.final_billing_price` is recomputed as `negotiated_price`.
- A new `quote_version` snapshot is automatically created to capture the locked price.
- The negotiation timeline is sealed (no new rounds can be added to this item unless the price is unlocked by Admin/Owner).

---

## §38 — PRICE INCREASE WORKFLOW [V3 New Module]

This workflow handles rate revisions — when raw material (paper BF price) increases require updating previously accepted quote prices.

### 38.1 Trigger

From Reports → **"Price Increase"** action (visible to Owner / Admin / Manager only).

User selects a client (party) or a list of quote items.

### 38.2 Flow

1. User selects quote items for price increase review.
2. Frontend calls `POST /api/v1/price-increase/preview` with `{quote_item_ids: []}`.
3. Server recalculates each item with **current master data** (new BF prices). Returns:
   ```json
   [
     { "item_id": "uuid", "box_name": "Box A", "old_price": 12.50, "new_calculated_price": 14.20, "delta_pct": 13.6 }
   ]
   ```
4. User sees a **Price Increase Preview table**: columns for box name, old price, new calculated price, Δ%, proposed price (editable by user — defaults to `new_calculated_price`).
5. User can adjust `proposed_price` per item (e.g., absorb some increase to retain client).
6. User adds an optional reason note (e.g., *"BF 20 price up by ₹4/kg since March"*).
7. User clicks **"Save & Send Notification"** →
   - `POST /api/v1/price-increase/events` creates `PriceIncreaseEvent` records (see `01-formula-master.md §39.4`).
   - Background task `send_price_increase_notification` sends a formatted email/WhatsApp notification to the client with the old vs new price table.
8. Client's `final_billing_price` on future requotes will use `proposed_price`.

### 38.3 RBAC

| Role | View price increase UI | Create price increase | Approve & send |
|------|----------------------|-----------------------|---------------|
| Owner / Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ (submit for approval) |
| Salesperson / Viewer | ❌ | ❌ | ❌ |

---

## §39 — SALES AUTOMATION / FOLLOW-UP ENGINE [V3 New Module]

### 39.1 Purpose

Automate follow-up messages to clients for sent quotes that have not been responded to within a configurable period.

### 39.2 Follow-Up Rule Structure

Each follow-up automation rule specifies:

| Field | Description |
|-------|-------------|
| `quote_id` | The quote to follow up on |
| `channel` | `'whatsapp'` \| `'email'` |
| `interval_days` | Send follow-up every N days (e.g., 3) |
| `max_follow_ups` | Maximum number of follow-up messages (e.g., 3) |
| `stop_on` | Conditions to stop: `['accepted', 'rejected', 'manually_closed']` |
| `message_template_id` | UUID of the template to use (from Rich Editor — §40) |
| `ai_personalization` | Boolean — if true, LLM adds a personalized sentence to each follow-up |

### 39.3 Stopping Conditions

The follow-up engine stops automatically when **any** of the following occur:
- Quote status changes to `'accepted'` or `'rejected'`.
- `max_follow_ups` reached.
- User manually closes the automation (PATCH status = `'paused'`) or deletes it.
- Unsubscribe signal detected (email bounce / unsubscribe link clicked).

### 39.4 Celery Beat Behavior

The `send_follow_up_message` task runs every **30 minutes**:
1. Queries `follow_up_automations` for rules where: `status = 'active'` AND `next_send_at <= NOW()` AND `sent_count < max_follow_ups`.
2. For each matching rule: fetches quote data, renders the message template, sends via the configured channel.
3. Records a follow-up log entry in `follow_up_logs`.
4. Updates `next_send_at = NOW() + interval_days` and increments `sent_count`.
5. If `sent_count >= max_follow_ups`, sets `status = 'completed'`.

### 39.5 RBAC

| Role | Create follow-up | View logs | Pause/Delete |
|------|-----------------|-----------|-------------|
| Owner / Admin / Manager | ✅ | ✅ | ✅ |
| Salesperson | ✅ (own quotes) | Own logs | Own rules |
| Viewer | ❌ | ❌ | ❌ |

---

## §40 — RICH EDITOR / TEMPLATE MANAGEMENT [V3 New Module]

### 40.1 Purpose

A template management module lets users create and edit reusable message templates for:
- Quote follow-up emails / WhatsApp messages
- Price increase notifications
- Thank-you messages (for accepted quotes)
- General outreach templates

### 40.2 Editor Capabilities

- **Rich text editing**: bold, italic, bullet lists, table insertion (for item pricing tables).
- **Paste from local editor**: paste formatted content from Word/Notion/text editors; HTML is sanitized on paste.
- **HTML template input toggle**: users can switch to raw HTML mode for advanced templates (editor enforces an allowlist of HTML tags — see §40.4).
- **Variable insertion**: click to insert merge variables: `{{party_name}}`, `{{quote_ref}}`, `{{quote_total}}`, `{{salesperson_name}}`, `{{company_name}}`.
- **Preview**: render a live preview with sample merge values before saving.

### 40.3 Template Structure

```python
@dataclass
class MessageTemplate:
    id: str                          # UUID
    tenant_id: str
    name: str                        # e.g. "Follow-up Day 3"
    category: Literal['follow_up', 'price_increase', 'acceptance_thanks', 'general']
    channel: Literal['email', 'whatsapp', 'both']
    subject: Optional[str]           # email subject line (email/both only)
    body_html: str                   # HTML content (sanitized)
    variables_used: list[str]        # auto-extracted list of {{var}} tokens
    is_default: bool                 # one default per category per channel
    created_by: str                  # user_id
    created_at: str
    updated_at: str
```

### 40.4 Security: HTML Sanitization

All HTML stored in `body_html` must be sanitized using an allowlist before save:
- **Allowed tags**: `p`, `br`, `b`, `strong`, `i`, `em`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `a`, `img`, `h1`, `h2`, `h3`, `span`, `div`.
- **Blocked**: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, any `on*` event attributes.
- **Link sanitization**: all `href` values run through URL scheme validation — only `https://` and `mailto:` permitted.
- Python: use `bleach` library with the allowlist above. Never store raw unfiltered user HTML.

### 40.5 WhatsApp Templates

WhatsApp Business API requires pre-approved templates for outbound messaging. BoxCostPro stores the approved template name alongside the body for WhatsApp-type templates. The body is rendered locally but the API call uses the pre-approved template name.

---

## §41 — SPECIFICATION DOWNLOAD FLOW [V3 New Module]

### 41.1 Trigger

From the Reports page → Quote detail view → quote item row action menu → **"Download Spec Sheet"** button.

Or from the calculator quote item table → item action menu → **"Spec Sheet"**.

### 41.2 Flow

1. User clicks "Download Spec Sheet" for a quote item.
2. Frontend calls `GET /api/v1/quotes/:id/spec-sheet?item_id={item_id}`.
3. Server fetches the item's `quoteItemVersions.itemDataSnapshot`.
4. Server calls `generate_spec_sheet_data(snapshot)` to strip all pricing fields (see `01-formula-master.md §40.4`).
5. Celery task `generate_spec_sheet_pdf` renders the spec sheet PDF using the spec template.
6. Server responds with the PDF binary (`application/pdf`).
7. Frontend triggers a browser download: `spec-{quote_ref}-{box_name}.pdf`.

### 41.3 Spec Sheet Contents (No Pricing)

See `01-formula-master.md §40.2` for the full field-to-source mapping. Summary:
- Box identity (name, type, ply, flute)
- Dimensions (inner, sheet size, board thickness)
- Layer-wise paper (GSM / BF / shade per layer)
- Structural properties (BCT, BS, ECT)
- Print / lamination spec summary
- Order quantity and quote reference
- **No pricing fields**

---

## §42 — JOB CARD GENERATION FLOW [V3 New Module]

### 42.1 Trigger

Job cards are generated automatically when a quote item reaches `status = 'accepted'`. They can also be manually triggered from Reports → Quote detail → accepted item → **"Generate Job Card"**.

### 42.2 Flow

1. When a quote item is accepted (quote status transitions to `'accepted'`), Celery task `generate_job_card` fires.
2. Task creates a `job_cards` DB record from the `quoteItemVersions.itemDataSnapshot` (see `01-formula-master.md §38.2` for field mapping).
3. Job card is accessible via `GET /api/v1/quotes/:id/job-cards`.
4. PDF generation runs on the `generate_quote_pdf` task with `type = 'job_card'`.
5. Job card PDF is downloadable from Reports → Quote detail → "Job Cards" tab.

### 42.3 Job Card Key Fields

See `01-formula-master.md §38.2` for the complete field-source mapping table. The job card includes all production-spec fields but excludes negotiation history, source_type, and extraction_confidence.

### 42.4 RBAC

| Role | View job cards | Download PDF | Manually trigger |
|------|--------------|--------------|------------------|
| Owner / Admin / Manager | ✅ | ✅ | ✅ |
| Salesperson | Own quotes | Own quotes | Own quotes |
| Viewer | ✅ | ✅ | ❌ |

---

## §43 — QA REPORT GENERATION FLOW [V3 New Module]

### 43.1 Trigger

From Reports → Quote detail → accepted item job card → **"QA Report"** tab.

Or: stand-alone QA review entry point from a dedicated QA Reports nav section.

### 43.2 Flow

1. User opens the QA report for an accepted job card.
2. Frontend loads the QA report template (see `01-formula-master.md §38.3` for QA checklist field derivation).
3. Each check item shows: **Target value** (from spec) | **Measured value** (blank, filled by QA operator) | **Status** (Pass / Fail / N/A toggle).
4. User fills in measured values and sets pass/fail for each check.
5. On save: `PATCH /api/v1/quotes/:id/qa-reports/:jcid` with the filled values.
6. A QA report PDF can be generated via `GET /api/v1/quotes/:id/qa-reports/:jcid?format=pdf`.
7. QA status on the job card is updated to: `'passed'` / `'failed'` / `'partial'`.

### 43.3 QA Check Items

See `01-formula-master.md §38.3` for the complete QA checklist table (ply count, board thickness, GSM per layer, BCT, ECT, sheet size, quantity).

---

## §44 — TALLY EXPORT / PUSH FLOW [V3 New Module]

BoxCostPro integrates with **Tally ERP** to push party (ledger), product (stock item), and invoice (sales voucher) data directly into Tally.

### 44.1 Integration Method

Tally remote data entry uses **Tally XML / HTTP protocol** (Tally must be running on the client's machine or network with remote access enabled). BoxCostPro's backend sends HTTP POST requests to `http://{tally_host}:{port}/` with XML payloads.

Alternative for modern deployments: **Tally Connector API** (if available on the tenant's Tally version) — REST-based. BoxCostPro backend supports both; configured per-tenant in Settings → Tally Integration (§44.5).

### 44.2 Party (Ledger) Push

1. User selects one or more party profiles → **"Push to Tally as Ledger"**.
2. `POST /api/v1/tally/parties` with `{party_ids: []}`.
3. Server builds Tally XML:
   ```xml
   <ENVELOPE>
     <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
     <BODY>
       <IMPORTDATA>
         <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
         <REQUESTDATA>
           <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <LEDGER NAME="{party.company_name}" ACTION="Create">
               <ADDRESS>{party.address}</ADDRESS>
               <COUNTRYNAME>India</COUNTRYNAME>
               <GSTIN>{party.gst_number}</GSTIN>
             </LEDGER>
           </TALLYMESSAGE>
         </REQUESTDATA>
       </IMPORTDATA>
     </BODY>
   </ENVELOPE>
   ```
4. Response logged in `tally_push_log` (see `03-admin-flow-master.md §29` for table DDL).

### 44.3 Product (Stock Item) Push

Each accepted quote item maps to a Tally **Stock Item**:
- Stock item name: `{box_name}` or `{quote_ref}-{row_index}`
- Unit: `Nos` (numbers)
- Standard cost: `total_cost_per_box` (production cost)
- Standard selling price: `final_billing_price`

### 44.4 Invoice (Sales Voucher) Push

An accepted quote maps to a Tally **Sales Voucher**:
- Party ledger: mapped from `party_profile.company_name`
- Line items: each accepted `QuoteItem` → ledger entry with `final_billing_price × quantity`
- GST entries: split CGST + SGST or IGST depending on `business_defaults.igst_applicable`
- Invoice reference: `quote_versions.quote_number`

### 44.5 Tally Configuration

See `03-admin-flow-master.md §29` for Tally integration settings (host, port, protocol version, company name matching rules).

### 44.6 RBAC

| Role | Push to Tally | View Tally logs |
|------|--------------|----------------|
| Owner / Admin | ✅ | ✅ |
| Manager | ✅ | ✅ |
| Salesperson / Viewer | ❌ | ❌ |

---

## §45 — DEAL PIPELINE & QUOTE DELIVERY TRACKING [V3 New Module]

BoxCostPro layers a lightweight CRM pipeline on top of every sent quote, giving sales teams real-time visibility into where each deal stands.

### 45.1 Deal Stages

Every quote has a `pipeline_stage` column (added to the `quotes` table):

| Stage | Description | Trigger |
|-------|-------------|---------|
| `draft` | Quote created, not yet sent | Quote saved |
| `sent` | Quote delivered to client | Email sent / WA message dispatched |
| `opened` | Client opened the email | Tracking pixel fired |
| `viewed` | Client clicked a quote link | Click-through tracking |
| `responded` | Client replied or countered | Inbound email reply / WA reply webhook |
| `negotiating` | Active price negotiation underway | First `NegotiationEvent` added (§37) |
| `won` | Deal accepted, price locked | `QuoteItem.status = 'accepted'` |
| `lost` | Client declined or chose another | User marks Lost + reason |
| `expired` | `quote_valid_until` passed, not accepted | `check_quote_expiry` background task (§26) |

Stage transitions are append-only events in `quote_pipeline_events`:

```sql
CREATE TABLE quote_pipeline_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id      UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    from_stage    TEXT,
    to_stage      TEXT NOT NULL,
    triggered_by  TEXT NOT NULL,  -- 'system' | user_id
    reason        TEXT,           -- for lost/expired stages
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_qpe_quote ON quote_pipeline_events(quote_id);
CREATE INDEX idx_qpe_tenant_stage ON quote_pipeline_events(tenant_id, to_stage);
```

### 45.2 Email Delivery Tracking

When BoxCostPro sends a quote email, it embeds a **1×1 tracking pixel** and wraps all links through a redirect proxy.

**Tracking pixel (open event):**
- URL: `GET /api/v1/tracking/open/{tracking_token}`
- Response: 1×1 transparent GIF (`image/gif`)
- On hit: records `quote_delivery_events` row `{event_type: 'email_opened'}` + transitions `pipeline_stage` to `'opened'`
- `tracking_token`: HMAC-signed `{quote_id}|{recipient_email}|{sent_at_epoch}` — prevents forgery

**Click tracking:**
- All quote links in emails are replaced with: `GET /api/v1/tracking/click/{token}?url={encoded_target}`
- On hit: records `{event_type: 'email_link_clicked'}`, then 302-redirects to `url`
- Transition: `pipeline_stage` → `'viewed'`

**Privacy:**
- Tracking is enabled by default but can be disabled per-tenant: `Settings → Pipeline → Email tracking: Off`
- When disabled, no pixel or wrapped links are injected; quote emails send with raw links
- Unsubscribe link always included in the email footer regardless of tracking setting

### 45.3 WhatsApp Delivery Tracking

When the WhatsApp Business API is configured (§46), Meta sends status webhooks:

| WA status | Mapped to `event_type` | Stage transition |
|-----------|----------------------|-----------------|
| `sent` | `wa_sent` | `sent` |
| `delivered` | `wa_delivered` | `sent` (unchanged) |
| `read` | `wa_read` | `opened` |
| Reply from client | `wa_replied` | `responded` |

### 45.4 Quote Delivery Events Table

```sql
CREATE TABLE quote_delivery_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    event_type      TEXT NOT NULL,  -- email_sent | email_opened | email_link_clicked
                                    -- wa_sent | wa_delivered | wa_read | wa_replied
                                    -- follow_up_sent | price_increase_sent
    channel         TEXT NOT NULL,  -- 'email' | 'whatsapp'
    recipient_email TEXT,
    recipient_phone TEXT,
    tracking_token  TEXT,           -- for open/click lookups
    metadata        JSONB,          -- e.g. { "follow_up_number": 2, "template_id": "uuid" }
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_qde_quote ON quote_delivery_events(quote_id);
CREATE INDEX idx_qde_tenant_time ON quote_delivery_events(tenant_id, occurred_at DESC);
```

### 45.5 Activity Feed per Quote

In Reports → Quote detail, an **Activity** tab aggregates all events for a quote in a unified timeline:

```
Timeline (newest first):
  ● Follow-up #2 sent via Email              — 2 May 2026, 10:00 AM
  ○ Client opened the email                  — 1 May 2026, 3:45 PM
  ○ Client read the WhatsApp message         — 30 Apr 2026,  9:10 AM
  ● Follow-up #1 sent via WhatsApp           — 30 Apr 2026,  8:00 AM
  ● Quote sent via Email + WhatsApp          — 27 Apr 2026, 11:22 AM
  ● Quote created                            — 27 Apr 2026, 11:00 AM
```

Sources merged into the feed:
- `quote_delivery_events`
- `follow_up_logs`
- `negotiation_events`
- `quote_pipeline_events`

### 45.6 Pipeline Board (Kanban View)

Available from **Reports → Pipeline** (Owner/Admin/Manager). Shows all quotes as cards in stage columns.

| Column | Cards shown |
|--------|------------|
| Sent | `pipeline_stage IN ('sent', 'opened', 'viewed')` |
| Responded | `pipeline_stage = 'responded'` |
| Negotiating | `pipeline_stage = 'negotiating'` |
| Won | `pipeline_stage = 'won'` — last 30 days |
| Lost | `pipeline_stage = 'lost'` — last 30 days |

Card contents: party name, quote ref, total value, last activity timestamp, days in current stage (urgency indicator: `warning-500` if > 7 days in Sent without open).

### 45.7 Mark as Won / Lost

User can manually transition any quote to `won` or `lost`:

**Mark Lost flow:**
1. User clicks `[Mark as Lost]` overflow on a quote.
2. Bottom sheet (mobile) / modal (desktop): reason selector (configurable from Settings) + optional free-text note.
3. `PATCH /api/v1/quotes/:id` `{pipeline_stage: 'lost', loss_reason: '...', loss_note: '...'}`.
4. All active follow-up automations for this quote are auto-paused.
5. A `quote_pipeline_event` is recorded.

**Mark Won:** triggered automatically when any `QuoteItem` status → `'accepted'`, or manually for full-quote acceptance.

### 45.8 RBAC

| Role | View pipeline board | Mark Won/Lost | View activity feed |
|------|-------------------|--------------|-------------------|
| Owner / Admin | ✅ All | ✅ | ✅ All |
| Manager | ✅ All | ✅ | ✅ All |
| Salesperson | Own quotes only | Own quotes | Own quotes |
| Viewer | ✅ Read-only | ❌ | ✅ |

---

## §46 — PLATFORM-MANAGED WHATSAPP BUSINESS INTEGRATION [V3 Revised]

BoxCostPro operates a **shared WhatsApp Business Account (WABA)** at the platform level. A single Meta-approved phone number is used for all outbound messages. Tenants do **not** configure their own WABA — they subscribe to the WhatsApp messaging add-on, which the platform admin activates per tenant.

This architecture mirrors how leading WhatsApp API providers (AiSensy, Interakt, WATI) operate: the platform owns the WABA layer; individual accounts send through the shared infrastructure using pre-approved templates managed centrally.

### 46.1 Architecture Overview

```
Platform Layer (Admin-managed)
  ├── wa_platform_config      ← WABA credentials, phone_number_id, webhook secret
  ├── wa_templates            ← Template library (admin-created, Meta-approved)  §36
  └── wa_tenant_activations   ← Billing-gated activation per tenant              §34

Tenant Layer (Tenant-used)
  ├── Sends messages via platform WABA (no own WABA needed)
  ├── Picks from shared template library (only admin-published templates)
  └── Sees own message history in wa_message_log (tenant-scoped query)
```

`wa_platform_config` is a singleton table (one row per platform). All API calls use the platform's `phone_number_id` and `api_token`. Tenants have zero visibility into credentials.

### 46.2 DB Schema

```sql
-- Platform-level WABA config (singleton)
CREATE TABLE wa_platform_config (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id      TEXT NOT NULL,
    waba_id              TEXT NOT NULL,
    api_token_encrypted  TEXT NOT NULL,    -- AES-256-GCM, decrypted only at send time
    webhook_verify_token TEXT NOT NULL,
    webhook_secret       TEXT NOT NULL,    -- X-Hub-Signature-256 verification
    display_name         TEXT NOT NULL,    -- shown as sender name in WA messages
    opt_out_keywords     TEXT[] NOT NULL DEFAULT ARRAY['STOP','UNSUBSCRIBE','OPT OUT'],
    is_active            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-tenant WhatsApp add-on activation
CREATE TABLE wa_tenant_activations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL UNIQUE REFERENCES tenants(id),
    is_active      BOOLEAN NOT NULL DEFAULT FALSE,
    activated_by   UUID REFERENCES admin_users(id),
    activated_at   TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    monthly_quota  INTEGER,    -- NULL = unlimited
    notes          TEXT        -- admin notes (billing plan, reason, etc.)
);

-- All messages sent across all tenants
CREATE TABLE wa_message_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    quote_id        UUID REFERENCES quotes(id),
    template_id     UUID NOT NULL REFERENCES wa_templates(id),
    recipient_phone TEXT NOT NULL,   -- E.164
    wamid           TEXT,            -- Meta message ID (returned after send)
    status          TEXT NOT NULL DEFAULT 'queued',
                    -- 'queued'|'sent'|'delivered'|'read'|'failed'|'opted_out'
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    variables_used  JSONB,           -- snapshot of variable values at send time
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_msg_tenant ON wa_message_log(tenant_id, created_at DESC);
CREATE INDEX idx_wa_msg_wamid  ON wa_message_log(wamid) WHERE wamid IS NOT NULL;

-- Platform-wide opt-out registry
CREATE TABLE wa_optouts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        TEXT NOT NULL UNIQUE,  -- E.164; platform-wide (not per-tenant)
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_by TEXT NOT NULL DEFAULT 'STOP_keyword'
                 -- 'STOP_keyword' | 'admin_import' | 'manual'
);
```

### 46.3 Tenant Activation Pre-flight Checks

Every outbound WA send runs these checks server-side before calling the Meta API:

```python
def wa_activation_check(tenant_id: UUID, recipient_phone: str) -> tuple[bool, str]:
    config = get_wa_platform_config()
    if not config or not config.is_active:
        return False, "WA_NOT_CONFIGURED"

    activation = db.query(WATenantActivation).filter_by(tenant_id=tenant_id).first()
    if not activation or not activation.is_active:
        return False, "TENANT_NOT_ACTIVATED"

    if activation.monthly_quota:
        sent_this_month = count_messages_this_month(tenant_id)
        if sent_this_month >= activation.monthly_quota:
            return False, "QUOTA_EXCEEDED"

    if db.query(WAOptout).filter_by(phone=recipient_phone).first():
        return False, "RECIPIENT_OPTED_OUT"

    return True, "OK"
```

Frontend behaviour per failure reason:

| Reason | UI Response |
|--------|-------------|
| `WA_NOT_CONFIGURED` | WhatsApp option hidden entirely |
| `TENANT_NOT_ACTIVATED` | WA button locked; tooltip: "Activate WhatsApp add-on to send" |
| `QUOTA_EXCEEDED` | Toast: "Monthly message limit reached"; wa.me fallback offered |
| `RECIPIENT_OPTED_OUT` | Warning inline: "This contact has opted out of WhatsApp messages" |

### 46.4 Sending a Quote via Platform WABA

1. User opens quote → **Send** → **WhatsApp** tab → picks a template from the published library (§36).
2. Preview panel shows the rendered template with auto-filled variables.
3. User optionally overrides any variable value in the preview step.
4. Frontend calls `POST /api/v1/quotes/:id/send`:
   ```json
   {
     "channel": "whatsapp",
     "recipient_phone": "919876543210",
     "template_id": "uuid",
     "variable_overrides": {}
   }
   ```
5. Backend resolves variables from quote context (§36.4), merges any overrides, then calls Meta Cloud API:
   ```
   POST https://graph.facebook.com/v18.0/{platform_phone_number_id}/messages
   Authorization: Bearer {platform_api_token_decrypted}
   {
     "messaging_product": "whatsapp",
     "to": "919876543210",
     "type": "template",
     "template": {
       "name": "quote_notification_v2",
       "language": { "code": "en_IN" },
       "components": [
         {
           "type": "header",
           "parameters": [{ "type": "text", "text": "Sharma Packaging Pvt Ltd" }]
         },
         {
           "type": "body",
           "parameters": [
             { "type": "text", "text": "QT-2024-0091" },
             { "type": "text", "text": "₹48,500" },
             { "type": "text", "text": "15 May 2026" }
           ]
         }
       ]
     }
   }
   ```
6. On success: `wa_message_log` row inserted with `wamid` and `status = 'sent'`.
7. `quote_delivery_events` row inserted (`event_type: 'wa_sent'`).
8. `quote_pipeline_events` records stage transition to `'sent'` if not already past that stage.

### 46.5 WA Delivery Status Webhook

Meta POSTs delivery events to `POST /api/v1/webhooks/whatsapp` (platform-level, routing to correct tenant by `wamid`):

```json
{
  "entry": [{
    "id": "{waba_id}",
    "changes": [{
      "value": {
        "statuses": [{
          "id": "wamid.HBgN91987654321",
          "status": "read",
          "timestamp": "1746100000",
          "recipient_id": "919876543210",
          "conversation": { "id": "conv_abc", "origin": { "type": "utility" } }
        }]
      }
    }]
  }]
}
```

Platform webhook handler:
1. Verifies `X-Hub-Signature-256` using `wa_platform_config.webhook_secret`.
2. Looks up `wa_message_log` by `wamid` to identify tenant + quote.
3. Updates `wa_message_log.status`, `delivered_at` or `read_at`.
4. Inserts into `quote_delivery_events` with `tenant_id` from the message log row.
5. Triggers pipeline stage advancement if applicable (§45 rules).

### 46.6 Inbound Reply Routing

When a client replies via WhatsApp, Meta POSTs `messages[]` to the same webhook:

1. Handler looks up `wa_message_log` by `from_phone` — finds most recent outbound `wamid` to identify tenant + quote.
2. Stores reply text in `quote_delivery_events.metadata->>'reply_text'` (plaintext only).
3. Advances `pipeline_stage` → `'responded'`.
4. Pauses active follow-up automation for the quote.
5. Sends in-app notification to assigned salesperson: *"[PartyName] replied to quote [QuoteRef] on WhatsApp."*

**Edge case:** If the same phone number appears across multiple tenants (rare in B2B), the most recently active `wa_message_log` row wins for routing.

### 46.7 Link Fallback Mode

If the tenant's WA add-on is not activated, quota is exceeded, or the platform API is unconfigured:

- System generates a `wa.me` deep link: `https://wa.me/{phone}?text={url_encoded_message}`
- Pre-filled message is the rendered template body with variables substituted
- User taps the link on their device to open WhatsApp and send manually
- No delivery/read tracking in fallback mode; follow-up automation degrades to salesperson task reminders (in-app notifications)

### 46.8 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Manager | Salesperson | Viewer |
|--------|----------------|--------------------|---------|-------------|--------|
| Configure platform WABA | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activate WA for tenant | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit templates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Send WA message (if activated) | N/A | ✅ | ✅ | Own quotes | ❌ |
| View message history | N/A | ✅ | ✅ | Own quotes | ✅ |
| Platform-wide analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tenant-own analytics | N/A | ✅ | ✅ | ❌ | ❌ |

---

## §47 — MULTI-ACCOUNTING SOFTWARE INTEGRATION [V3 New Module]

Beyond Tally (§44), BoxCostPro supports exporting invoices and ledgers to multiple accounting platforms.

### 47.1 Supported Integrations

| Software | Method | Auth |
|----------|--------|------|
| **Tally ERP / Prime** | XML over HTTP (§44) | None (local network) |
| **Zoho Books** | REST API | OAuth 2.0 |
| **QuickBooks India** | REST API | OAuth 2.0 |
| **Busy Accounting** | XML file export (download + import) | None |
| **Marg ERP** | CSV file export | None |
| **Generic Webhook** | JSON POST to user-configured URL | Bearer token / HMAC |
| **Generic CSV** | CSV file download | None |

A tenant can have **at most one active integration per software** but can switch integrations. Only one integration can be set as `auto_push = true` (push on quote acceptance) per tenant.

### 47.2 Common Export Data Model

All integrations use the same canonical data model, then transform it per software:

```python
@dataclass
class AccountingExportPayload:
    export_id: str                    # UUID
    tenant_id: str
    quote_id: str
    quote_ref: str                    # e.g. "Q-2026-0042"
    invoice_date: str                 # ISO 8601
    due_date: Optional[str]
    currency: str = "INR"

    party: AccountingParty
    line_items: list[AccountingLineItem]
    tax_summary: AccountingTaxSummary
    totals: AccountingTotals
    notes: Optional[str]

@dataclass
class AccountingParty:
    name: str                         # company_name
    gstin: Optional[str]
    address: Optional[str]
    email: Optional[str]
    phone: Optional[str]

@dataclass
class AccountingLineItem:
    description: str                  # box_name + spec string
    hsn_sac: str                      # from business_defaults.hsn_code
    quantity: int
    unit: str = "Nos"
    unit_price: float                 # final_billing_price (per box)
    line_total: float                 # unit_price × quantity
    discount_pct: Optional[float]
    taxable_amount: float

@dataclass
class AccountingTaxSummary:
    tax_type: Literal['igst', 'cgst_sgst']
    tax_rate_pct: float               # e.g. 18.0
    igst_amount: Optional[float]
    cgst_amount: Optional[float]
    sgst_amount: Optional[float]

@dataclass
class AccountingTotals:
    subtotal: float
    tax_amount: float
    round_off: float
    grand_total: float
```

### 47.3 Zoho Books Integration

**Setup:** OAuth 2.0 PKCE flow from Settings → Integrations → Zoho Books. Tokens stored encrypted in `accounting_integrations.credentials_encrypted`.

**Invoice push:**
```
POST https://www.zohoapis.in/books/v3/invoices?organization_id={org_id}
Authorization: Zoho-oauthtoken {access_token}
Content-Type: application/json
{
  "customer_name": "{party.name}",
  "line_items": [
    {
      "description": "{line_item.description}",
      "quantity": {line_item.quantity},
      "rate": {line_item.unit_price},
      "tax_id": "{zoho_tax_id_mapped}"
    }
  ],
  "reference_number": "{quote_ref}",
  "notes": "{notes}"
}
```

**Contact sync (party push):** `POST /contacts` to create or `GET /contacts?search_text={name}` then `PUT /contacts/{id}` to update.

**Token refresh:** Access tokens expire after 1 hour. BoxCostPro background worker refreshes using `refresh_token` before each push. If refresh fails → sends in-app notification to Owner/Admin.

### 47.4 QuickBooks India Integration

**Setup:** OAuth 2.0 from Settings → Integrations → QuickBooks. Uses Intuit's India sandbox for testing.

**Invoice push:**
```
POST https://quickbooks.api.intuit.com/v3/company/{realm_id}/invoice
{
  "CustomerRef": { "name": "{party.name}" },
  "Line": [
    {
      "DetailType": "SalesItemLineDetail",
      "Amount": {line_total},
      "SalesItemLineDetail": {
        "ItemRef": { "name": "{description}" },
        "Qty": {quantity},
        "UnitPrice": {unit_price}
      }
    }
  ]
}
```

**Limitation:** QuickBooks India does not natively support HSN/SAC codes in the standard API; BoxCostPro appends HSN to the line item `Description` field as a workaround.

### 47.5 Busy Accounting Integration

Busy does not offer a REST API. BoxCostPro generates a **Busy-compatible XML import file**.

**Flow:**
1. User selects one or more accepted quotes → **"Export to Busy XML"**.
2. `POST /api/v1/accounting/busy/export` with `{quote_ids: []}`.
3. Server generates `busy_vouchers.xml` conforming to Busy's XML import schema.
4. Response: file download (`application/xml`).
5. User imports the file manually in Busy: `Import → Vouchers → Sales`.

**Sample XML structure:**
```xml
<BusyData>
  <Vouchers>
    <Voucher VType="Sales" VDate="{date}" VRef="{quote_ref}">
      <Party>{party.name}</Party>
      <Items>
        <Item Name="{description}" Qty="{qty}" Unit="Nos" Rate="{unit_price}" Disc="0"/>
      </Items>
      <TaxEntries>
        <Entry LedgerName="Output CGST" Amount="{cgst}"/>
        <Entry LedgerName="Output SGST" Amount="{sgst}"/>
      </TaxEntries>
    </Voucher>
  </Vouchers>
</BusyData>
```

### 47.6 Generic CSV Export

For Marg ERP and any other software without direct API:

`GET /api/v1/accounting/csv/export?quote_ids={csv_of_ids}` → returns a CSV file with columns:

```
invoice_date, invoice_ref, party_name, gstin, box_description, hsn_sac, qty, unit, rate, discount_pct, taxable_amount, tax_type, cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, subtotal, grand_total
```

Column names are configurable from Settings → Integrations → CSV → Column mapping (rename columns to match target software's import template).

### 47.7 Generic JSON Webhook

For custom ERPs or middleware:

```
POST {user_configured_url}
Authorization: Bearer {user_configured_token}
Content-Type: application/json
X-BoxCostPro-Signature: HMAC-SHA256(payload, webhook_secret)

{ ...AccountingExportPayload as JSON... }
```

BoxCostPro expects a `200 OK` response. On failure (non-2xx or timeout), it retries with exponential backoff (3 attempts, 5 min / 15 min / 60 min intervals). Failed pushes visible in Settings → Integrations → Webhook → Push log.

### 47.8 Push History Log

All accounting push attempts (all integration types) are logged in `accounting_push_log`:

```sql
CREATE TABLE accounting_push_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    quote_id        UUID NOT NULL REFERENCES quotes(id),
    integration     TEXT NOT NULL,  -- 'tally' | 'zoho' | 'quickbooks' | 'busy' | 'marg' | 'webhook' | 'csv'
    status          TEXT NOT NULL,  -- 'success' | 'failed' | 'pending' | 'skipped'
    error_message   TEXT,
    request_payload JSONB,
    response_body   JSONB,
    pushed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pushed_by       UUID REFERENCES users(id)  -- NULL if auto-push
);
CREATE INDEX idx_apl_tenant ON accounting_push_log(tenant_id, pushed_at DESC);
CREATE INDEX idx_apl_quote ON accounting_push_log(quote_id);
```

### 47.9 Auto-Push Configuration

When `auto_push = true` for an integration:
- Triggered by `QuoteItem.status → 'accepted'` event.
- Celery task `auto_push_to_accounting` fires: builds `AccountingExportPayload`, sends to configured integration.
- If push fails: in-app notification to Owner/Admin; quote is **not** blocked from being accepted.
- Manual re-push available from Reports → Quote detail → **"Push to [Software]"** button.

### 47.10 RBAC

| Role | View push log | Manual push | Configure integration |
|------|--------------|-------------|----------------------|
| Owner / Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ |
| Salesperson / Viewer | ❌ | ❌ | ❌ |

---

## 48 — WHATSAPP OTP AUTHENTICATION [V3 New Module]

### 48.1 Overview

BoxCostPro offers WhatsApp as a **primary authentication channel** for both login and signup. Instead of a password or email OTP, users receive a 6-digit OTP via WhatsApp message. This leverages the platform-managed WABA (§46) and Meta's `AUTHENTICATION` template category — which has the lowest per-message cost and highest delivery priority.

WhatsApp auth is **platform-wide** (not tenant-gated). It is enabled or disabled by the platform admin (§38) and applies uniformly across all tenants.

Architecture overview:
```
User enters phone          Redis wa_otp:{phone}
  └─► POST /api/v1/auth/wa/send-otp
          │
          ├─► Check wa_auth_settings.enabled (platform flag)
          ├─► Rate limit check (3 OTPs / 10 min per phone)
          ├─► Generate OTP (CSPRNG 6-digit)
          ├─► Store HMAC(OTP + phone + nonce) in Redis, TTL = 5 min
          └─► Send via Meta Cloud API (AUTHENTICATION template)
                                                        │
                                              WhatsApp message to user
                                                        │
User enters OTP ◄────────────────────────────────────────
  └─► POST /api/v1/auth/wa/verify-otp
          │
          ├─► Validate HMAC, check TTL, check attempt count (max 5)
          ├─► Lookup user by phone → session issued
          └─► Respond 200 {session_token, user, tenant}
```

### 48.2 DB Schema

```sql
-- Runtime OTP state lives in Redis (TTL-native). DB only stores audit trail.

CREATE TABLE wa_auth_settings (
    id              SERIAL PRIMARY KEY,               -- always 1 (singleton)
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    require_phone_verified BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_to_email      BOOLEAN NOT NULL DEFAULT TRUE,
    max_daily_otps_per_user INTEGER NOT NULL DEFAULT 10,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      UUID REFERENCES users(id)
);

CREATE TABLE wa_otp_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           TEXT NOT NULL,                   -- E.164 format
    user_id         UUID REFERENCES users(id),       -- NULL if phone not found (signup attempt)
    tenant_id       UUID REFERENCES tenants(id),
    purpose         TEXT NOT NULL,                   -- 'login' | 'signup' | 'phone_verify'
    status          TEXT NOT NULL,                   -- 'sent'|'verified'|'expired'|'failed'|'blocked'
    attempt_count   SMALLINT NOT NULL DEFAULT 0,     -- verification attempts made
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at     TIMESTAMPTZ
);
CREATE INDEX idx_wa_otp_log_phone ON wa_otp_log(phone, created_at DESC);
CREATE INDEX idx_wa_otp_log_user  ON wa_otp_log(user_id, created_at DESC);
```

**Redis key structure:**
```
wa_otp:{phone}:{nonce}  →  HMAC(OTP + phone + nonce)   TTL: 300s
wa_otp_rate:{phone}     →  send attempt count            TTL: 600s
wa_otp_attempts:{phone}:{nonce}  →  verify attempt count  TTL: 300s
```

### 48.3 OTP Generation & Delivery

**Endpoint:** `POST /api/v1/auth/wa/send-otp`

```json
Request:  { "phone": "+919876543210", "purpose": "login" }
Response: { "nonce": "abc123xyz", "expires_in": 300, "masked_phone": "+91 98765 ****10" }
```

Backend logic:
1. Normalize phone to E.164 via `phonenumbers` library; reject invalid format (400).
2. Check `wa_auth_settings.enabled`; if false → 503 `WA_AUTH_DISABLED`.
3. Check `wa_otp_rate:{phone}` in Redis — if ≥ 3 → 429 `RATE_LIMIT` with `retry_after` header.
4. Generate 6-digit OTP via `secrets.randbelow(900000) + 100000` (CSPRNG, never `random`).
5. Generate 16-byte nonce (`secrets.token_hex(8)`).
6. Compute `hmac_val = HMAC-SHA256(key=OTP_SECRET, msg=f"{otp}:{phone}:{nonce}")`.
7. Store `wa_otp:{phone}:{nonce}` = `hmac_val` with TTL 300s.
8. Increment `wa_otp_rate:{phone}` with TTL 600s.
9. Send via Meta Cloud API using `AUTHENTICATION` template:

```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "otp_login_v1",
    "language": { "code": "en" },
    "components": [{
      "type": "body",
      "parameters": [{ "type": "text", "text": "847291" }]
    }, {
      "type": "button",
      "sub_type": "url",
      "index": "0",
      "parameters": [{ "type": "text", "text": "847291" }]
    }]
  }
}
```

10. On Meta API success: insert `wa_otp_log` row (`status = 'sent'`); return nonce to client.
11. On Meta API failure: 502 `WA_DELIVERY_FAILED`; if `wa_auth_settings.fallback_to_email = TRUE`, include `"fallback": "email"` in response body so the frontend can offer email OTP automatically.

**OTP template design** (`otp_login_v1` — pre-created in platform template library):
```
Your BoxCostPro login code is *847291*
This code expires in 5 minutes. Do not share it.

[Copy Code]   ← URL button copies OTP to clipboard via deep link
```

### 48.4 Login via WhatsApp OTP — Full Flow

**Endpoint:** `POST /api/v1/auth/wa/verify-otp`

```json
Request:  { "phone": "+919876543210", "nonce": "abc123xyz", "otp": "847291", "purpose": "login" }
Response: { "session_token": "...", "user": {...}, "tenant": {...} }
```

Backend logic:
1. Validate `otp` is exactly 6 digits; reject otherwise.
2. Fetch `wa_otp:{phone}:{nonce}` from Redis; if missing → 400 `OTP_EXPIRED`.
3. Check `wa_otp_attempts:{phone}:{nonce}`; if ≥ 5 → 429 `MAX_ATTEMPTS`; delete OTP key (invalidate).
4. Compute expected HMAC; compare with stored value using `hmac.compare_digest` (constant-time). If mismatch: increment attempt counter; 400 `INVALID_OTP`.
5. On match: delete OTP key and attempt key from Redis.
6. Lookup `users` by E.164 phone; if not found → 404 `USER_NOT_FOUND` (with hint: signup).
7. If user found but `phone_verified = FALSE` → update `phone_verified = TRUE`.
8. Issue session: same session flow as password login — set `HttpOnly; Secure; SameSite=Strict` cookie.
9. Update `wa_otp_log` row: `status = 'verified'`, `verified_at = now()`, `attempt_count`.
10. Return `200 { session_token, user, tenant }`.

**Session issued is identical** to a password session — same RBAC, same 7-day rolling TTL. No secondary authentication required.

### 48.5 Signup via WhatsApp Flow

**Endpoint:** `POST /api/v1/auth/wa/signup`

```json
Request: {
  "phone": "+919876543210",
  "full_name": "Rahul Sharma",
  "company_name": "Sharma Packaging Pvt Ltd",
  "email": "rahul@sharma.in",      ← optional at signup; can be added later
  "referral_code": "..."           ← optional
}
```

Flow:
1. Validate phone (E.164, not already registered).
2. Validate company_name (non-empty, max 100 chars).
3. Check email uniqueness if provided.
4. Send OTP via same `send-otp` flow with `purpose = 'signup'`.
5. Return `{ nonce, expires_in, masked_phone }`.

**Phone OTP verify for signup:** `POST /api/v1/auth/wa/verify-otp` with `purpose = 'signup'`:
- Same OTP validation as §48.4.
- After successful verify:
  1. Create `tenants` row.
  2. Create `users` row (`role = 'owner'`, `phone_verified = TRUE`).
  3. Apply default plan (Starter / trial).
  4. Trigger onboarding welcome message via WhatsApp (UTILITY template — separate from auth template).
  5. Issue session; return `200 { session_token, user, tenant, is_new: true }`.

**Edge case — phone already exists with `purpose = 'signup'`:** return 409 `PHONE_ALREADY_REGISTERED` → frontend routes to login flow.

### 48.6 Phone Verification for Existing Users

Existing users who registered via email/password can link and verify their WhatsApp number:

**Endpoint:** `POST /api/v1/auth/wa/verify-phone`
- Same OTP flow; purpose = `'phone_verify'`.
- On success: `users.phone = {phone}`, `users.phone_verified = TRUE`.
- Once verified, user can use WA OTP to log in.

### 48.7 Security Controls

| Control | Implementation |
|---------|----------------|
| OTP entropy | `secrets.randbelow(900000) + 100000` — 900,000 possible values |
| HMAC storage | `HMAC-SHA256(OTP + phone + nonce)` — OTP never stored plaintext |
| Constant-time compare | `hmac.compare_digest()` — prevents timing attacks |
| Rate limit: send | 3 OTPs per phone per 10 minutes (Redis counter, TTL 600s) |
| Rate limit: verify | 5 attempts per nonce before key invalidation |
| OTP TTL | 300 seconds (5 minutes) |
| Nonce invalidation | Key deleted immediately after successful verify |
| IP-based rate limit | 10 OTPs per IP per 10 minutes (nginx / API gateway layer) |
| Daily cap | `wa_auth_settings.max_daily_otps_per_user` (default 10) checked in `wa_otp_log` |
| Audit trail | All OTP events (sent/verified/failed/blocked) logged in `wa_otp_log` |
| No enumeration | Both "phone not found" and "user found" paths return same HTTP 400 shape with nonce; user status NOT disclosed to unauthenticated caller (except after verify success) |

### 48.8 Fallback Mechanism

When WA OTP delivery fails or user chooses "Use email instead":

1. `send-otp` response includes `"fallback": "email"` flag (when `fallback_to_email = TRUE`).
2. Frontend shows "Didn't receive it? Send via email" link.
3. `POST /api/v1/auth/email/send-otp` generates a separate OTP, sends to user's registered email.
4. Same Redis-backed verification flow — separate key namespace `email_otp:{email}:{nonce}`.
5. Verified email OTP issues identical session.

### 48.9 RBAC

| Action | Unauthenticated | Any Authenticated User | Platform Admin |
|--------|-----------------|----------------------|----------------|
| Send OTP (login/signup) | ✅ | N/A | N/A |
| Verify OTP | ✅ | N/A | N/A |
| Verify/link own phone | N/A | ✅ | ✅ |
| View own WA OTP log | N/A | ✅ (own entries) | ✅ (all) |
| Enable/disable WA auth globally | ❌ | ❌ | ✅ |
| View OTP audit log | ❌ | ❌ | ✅ |

---

*End of 02-system-flow-master.md*
*Next: [03-admin-flow-master.md](./03-admin-flow-master.md) — Admin panel and master settings flows*
