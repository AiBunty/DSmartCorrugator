"""
BoxCostPro Formula Engine — F01 through F23
All formulas are authoritative server-side implementations.
The TypeScript client engine must stay in sync with these.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# § Constants
# ─────────────────────────────────────────────────────────────────────────────

# Flute factors and heights (mm) — overridable from DB flute_settings
FLUTE_DEFAULTS: dict[str, dict] = {
    "A": {"factor": 1.55, "height_mm": 4.8},
    "B": {"factor": 1.35, "height_mm": 2.5},
    "C": {"factor": 1.45, "height_mm": 3.6},
    "E": {"factor": 1.25, "height_mm": 1.2},
    "F": {"factor": 1.20, "height_mm": 0.8},
}

# Glue flap defaults by ply count
GLUE_FLAP_DEFAULTS: dict[int, float] = {1: 50, 3: 45, 5: 50, 7: 60, 9: 70}

# Deckle allowance defaults by ply count
DECKLE_ALLOWANCE_DEFAULTS: dict[int, float] = {1: 30, 3: 25, 5: 30, 7: 35, 9: 40}

# Board thickness by ply (mm) — used for OD→ID conversion (F05) and BCT fallback
PLY_THICKNESS: dict[int, float] = {1: 0.45, 3: 3.0, 5: 5.0, 7: 7.0, 9: 11.0}

# For RSC additional-flap logic (F01)
MAX_LENGTH_THRESHOLD = 1000  # mm

# McKee constant (F12)
MCKEE_CONSTANT = 5.87

# BF valid options
BF_OPTIONS = {14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40}

# Default seed BF prices (used in seeding logic; not authoritative in engine)
DEFAULT_BF_SEED_PRICES = {
    14: 32, 16: 34, 18: 36, 20: 38, 22: 42,
    24: 46, 25: 48, 28: 54, 30: 58, 32: 62,
    35: 70, 40: 80,
}


# ─────────────────────────────────────────────────────────────────────────────
# § Data classes (inputs)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FluteConfig:
    """Resolved per-flute constants (from DB or defaults)."""
    factor: float
    height_mm: float


@dataclass
class LayerSpec:
    """Specification for a single board layer (liner or fluting)."""
    role: str           # 'liner' | 'fluting'
    gsm: int
    bf: int
    shade: str
    reel_size_m: float  # reel width in metres (used for F06 layer weight)
    # Resolved rate (must be filled before calling cost formulas)
    rate: Optional[float] = None  # None = unresolved → blocks cost calculation


@dataclass
class RSCInputs:
    """All inputs for an RSC (Regular Slotted Container) calculation."""
    # Inner dimensions in mm
    length_mm: float
    width_mm: float
    height_mm: float

    ply: int
    combination: str            # e.g. "BCB" — chars map to flute types
    layers: list[LayerSpec]     # ordered from outer to inner

    quantity: int = 1000
    markup_pct: float = 15.0
    conversion_cost_per_kg: float = 15.0
    gst_pct: float = 5.0
    transport_charge: float = 0.0

    # Optional overrides (None = use defaults)
    glue_flap_mm: Optional[float] = None
    deckle_allowance_mm: Optional[float] = None

    # Add-on costs
    printing_cost_per_box: float = 0.0
    lamination_cost_per_box: float = 0.0
    die_cost_per_box: float = 0.0
    punching_cost_per_box: float = 0.0
    varnish_cost_per_box: float = 0.0

    # Flute configs (resolved from DB or defaults)
    flute_configs: dict[str, FluteConfig] = field(default_factory=dict)


@dataclass
class SheetInputs:
    """Inputs for a flat-sheet (non-RSC) calculation."""
    length_mm: float
    width_mm: float
    ply: int
    combination: str
    layers: list[LayerSpec]
    quantity: int = 1000
    markup_pct: float = 15.0
    conversion_cost_per_kg: float = 15.0
    sheet_allowance_mm: float = 25.0
    flute_configs: dict[str, FluteConfig] = field(default_factory=dict)
    printing_cost_per_box: float = 0.0
    lamination_cost_per_box: float = 0.0
    die_cost_per_box: float = 0.0
    punching_cost_per_box: float = 0.0
    varnish_cost_per_box: float = 0.0


@dataclass
class FormulaResult:
    """Complete output from a formula run."""
    # Sheet dimensions
    sheet_length_mm: float
    sheet_width_mm: float

    # Weight
    sheet_weight_kg: float

    # Strength
    burst_factor: float
    ect_value: float
    bct_value: Optional[float]
    board_thickness_mm: float

    # Costs
    paper_cost: float
    printing_cost: float
    lamination_cost: float
    die_cost: float
    punching_cost: float
    varnish_cost: float
    conversion_cost: float
    total_cost_per_box: float

    # Totals for a quote (populated separately)
    subtotal: float = 0.0
    transport_charge: float = 0.0
    subtotal_with_transport: float = 0.0
    gst_amount: float = 0.0
    round_off: float = 0.0
    grand_total: float = 0.0

    # Errors — non-empty means the result is partial / unreliable
    errors: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# § F01 – RSC Sheet Length
# ─────────────────────────────────────────────────────────────────────────────

def f01_rsc_sheet_length(
    length_mm: float,
    width_mm: float,
    ply: int,
    glue_flap_mm: Optional[float] = None,
) -> float:
    """
    F01: RSC Sheet Length = 2×(L+W) + GlueFlap
    If computed length > MAX_LENGTH_THRESHOLD, add 10% of threshold as extra flap.
    """
    gf = glue_flap_mm if glue_flap_mm is not None else GLUE_FLAP_DEFAULTS.get(ply, 45)
    sheet_len = 2 * (length_mm + width_mm) + gf
    if sheet_len > MAX_LENGTH_THRESHOLD:
        sheet_len += MAX_LENGTH_THRESHOLD * 0.10
    return sheet_len


# ─────────────────────────────────────────────────────────────────────────────
# § F02 – RSC Sheet Width
# ─────────────────────────────────────────────────────────────────────────────

def f02_rsc_sheet_width(
    width_mm: float,
    height_mm: float,
    ply: int,
    deckle_allowance_mm: Optional[float] = None,
) -> float:
    """F02: RSC Sheet Width = W + H + DeckleAllowance"""
    da = deckle_allowance_mm if deckle_allowance_mm is not None else DECKLE_ALLOWANCE_DEFAULTS.get(ply, 25)
    return width_mm + height_mm + da


# ─────────────────────────────────────────────────────────────────────────────
# § F03 – Flat Sheet Length
# ─────────────────────────────────────────────────────────────────────────────

def f03_flat_sheet_length(length_mm: float, sheet_allowance_mm: float = 25.0) -> float:
    """F03: Flat Sheet Length = L + SheetAllowance"""
    return length_mm + sheet_allowance_mm


# ─────────────────────────────────────────────────────────────────────────────
# § F04 – Flat Sheet Width
# ─────────────────────────────────────────────────────────────────────────────

def f04_flat_sheet_width(width_mm: float, sheet_allowance_mm: float = 25.0) -> float:
    """F04: Flat Sheet Width = W + SheetAllowance"""
    return width_mm + sheet_allowance_mm


# ─────────────────────────────────────────────────────────────────────────────
# § F05 – OD to ID conversion
# ─────────────────────────────────────────────────────────────────────────────

def f05_od_to_id(
    od_length: float,
    od_width: float,
    od_height: float,
    ply: int,
    board_thickness_mm: Optional[float] = None,
) -> tuple[float, float, float]:
    """
    F05: Convert outer dimensions to inner dimensions.
    Uses PLY_THICKNESS as thickness proxy unless calculated board_thickness provided.
    L_inner = L_od - 2t, W_inner = W_od - 2t, H_inner = H_od - t
    """
    t = board_thickness_mm if board_thickness_mm is not None else PLY_THICKNESS.get(ply, 3.0)
    return od_length - 2 * t, od_width - 2 * t, od_height - t


# ─────────────────────────────────────────────────────────────────────────────
# § F06 – Layer Weight (kg)
# ─────────────────────────────────────────────────────────────────────────────

def f06_layer_weight_kg(
    gsm: int,
    fluting_factor: float,  # 1.0 for liners
    reel_size_m: float,
    sheet_length_mm: float,
) -> float:
    """
    F06: LayerWeight(kg) = (GSM × flutingFactor × reelSize_m × sheetLength_m) / 1,000,000
    For liners, flutingFactor = 1.0.
    """
    sheet_length_m = sheet_length_mm / 1000.0
    return (gsm * fluting_factor * reel_size_m * sheet_length_m) / 1_000_000


# ─────────────────────────────────────────────────────────────────────────────
# § F07 – Sheet Weight (kg)
# ─────────────────────────────────────────────────────────────────────────────

def f07_sheet_weight_kg(
    sheet_length_mm: float,
    sheet_width_mm: float,
    layers: list[LayerSpec],
    flute_configs: dict[str, FluteConfig],
    combination: str,
) -> float:
    """
    F07: SheetWeight(kg) = (SheetLength_mm × SheetWidth_mm × ΣWeightedGSM) / 10^9
    WeightedGSM for a liner layer = GSM (factor 1.0)
    WeightedGSM for a fluting layer = GSM × fluteConfig.factor
    """
    flute_chars = _extract_flute_chars(combination)
    flute_iter = iter(flute_chars)

    weighted_gsm_sum = 0.0
    for layer in layers:
        if layer.role == "liner":
            weighted_gsm_sum += layer.gsm
        else:
            fc = _next_flute_config(flute_configs, flute_iter, layer)
            weighted_gsm_sum += layer.gsm * fc.factor

    return (sheet_length_mm * sheet_width_mm * weighted_gsm_sum) / 1e9


# ─────────────────────────────────────────────────────────────────────────────
# § F08 – Paper Rate
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PaperRateLookup:
    bf: int
    shade: str
    gsm: int
    bf_base_price: float        # from paper_bf_prices
    gsm_adjustment: float       # from paper_pricing_rules
    shade_premium: float        # from shade_premiums
    market_adjustment: float    # from paper_pricing_rules
    rate: float                 # sum of all components
    found: bool = True


def f08_paper_rate(
    bf: int,
    shade: str,
    gsm: int,
    bf_prices: dict[int, float],         # {bf_value: base_price}
    shade_premiums: dict[str, float],    # {shade_code: premium}
    pricing_rules: list[dict],           # sorted by rule_order
) -> PaperRateLookup:
    """
    F08: Paper Rate = bfBasePrice + gsmAdjustment + shadePremium + marketAdjustment
    BLOCKS with found=False if no BF price exists — never silently use ₹0.
    """
    if bf not in bf_prices:
        return PaperRateLookup(
            bf=bf, shade=shade, gsm=gsm,
            bf_base_price=0, gsm_adjustment=0,
            shade_premium=0, market_adjustment=0,
            rate=0, found=False,
        )

    bf_base = bf_prices[bf]
    shade_premium = shade_premiums.get(shade, 0.0)
    gsm_adjustment = 0.0
    market_adjustment = 0.0

    # Apply first matching pricing rule (sorted by rule_order ascending)
    for rule in pricing_rules:
        if not rule.get("is_active", True):
            continue
        # Strictly less than low_gsm_limit → low adjustment
        # Strictly greater than high_gsm_limit → high adjustment
        # In range → market adjustment only
        if gsm < rule["low_gsm_limit"]:
            gsm_adjustment = rule["low_gsm_adjustment"]
            market_adjustment = rule["market_adjustment"]
            break
        elif gsm > rule["high_gsm_limit"]:
            gsm_adjustment = rule["high_gsm_adjustment"]
            market_adjustment = rule["market_adjustment"]
            break
        else:
            market_adjustment = rule["market_adjustment"]
            break

    rate = bf_base + gsm_adjustment + shade_premium + market_adjustment
    return PaperRateLookup(
        bf=bf, shade=shade, gsm=gsm,
        bf_base_price=bf_base, gsm_adjustment=gsm_adjustment,
        shade_premium=shade_premium, market_adjustment=market_adjustment,
        rate=rate, found=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# § F09 – Paper Cost
# ─────────────────────────────────────────────────────────────────────────────

def f09_paper_cost(
    sheet_weight_kg: float,
    layers: list[LayerSpec],
) -> tuple[float, bool]:
    """
    F09: PaperCost = SheetWeight × WeightedAvgRate
    Returns (cost, ok). ok=False if any layer has no resolved rate (blocks save).
    """
    total_gsm = sum(l.gsm for l in layers)
    if total_gsm == 0:
        return 0.0, False

    for layer in layers:
        if layer.rate is None:
            return 0.0, False

    weighted_rate = sum(l.gsm * l.rate for l in layers) / total_gsm
    return sheet_weight_kg * weighted_rate, True


# ─────────────────────────────────────────────────────────────────────────────
# § F10 – Burst Factor (BS)
# ─────────────────────────────────────────────────────────────────────────────

def f10_burst_factor(
    layers: list[LayerSpec],
    combination: str,
    flute_configs: dict[str, FluteConfig],
) -> float:
    """
    F10: BS = Σ(GSM×BF/1000) for liners + Σ(GSM×BF/2000) for flutes
    """
    flute_chars = _extract_flute_chars(combination)
    flute_iter = iter(flute_chars)

    bs = 0.0
    for layer in layers:
        if layer.role == "liner":
            bs += (layer.gsm * layer.bf) / 1000.0
        else:
            _next_flute_config(flute_configs, flute_iter, layer)  # advance iterator
            bs += (layer.gsm * layer.bf) / 2000.0
    return bs


# ─────────────────────────────────────────────────────────────────────────────
# § F11 – ECT
# ─────────────────────────────────────────────────────────────────────────────

def f11_ect(
    layers: list[LayerSpec],
    combination: str,
    flute_configs: dict[str, FluteConfig],
) -> float:
    """
    F11: ECT = Σ rctValue for liners + Σ(rctValue × flutingFactor) for flutes
    rctValue for a layer = GSM × BF / 1000 (same scale as BS numerator)
    """
    flute_chars = _extract_flute_chars(combination)
    flute_iter = iter(flute_chars)

    ect = 0.0
    for layer in layers:
        rct = (layer.gsm * layer.bf) / 1000.0
        if layer.role == "liner":
            ect += rct
        else:
            fc = _next_flute_config(flute_configs, flute_iter, layer)
            ect += rct * fc.factor
    return ect


# ─────────────────────────────────────────────────────────────────────────────
# § F12 – BCT (McKee formula)
# ─────────────────────────────────────────────────────────────────────────────

def f12_bct(
    ect: float,
    board_thickness_mm: float,
    box_length_mm: float,
    box_width_mm: float,
) -> float:
    """
    F12: BCT = 5.87 × ECT × √((boardThickness/10) × boxPerimeter_cm)
    boxPerimeter_cm = 2 × (L_cm + W_cm) where L, W are box outer dims in cm
    """
    board_thickness_cm = board_thickness_mm / 10.0
    perimeter_cm = 2 * ((box_length_mm / 10.0) + (box_width_mm / 10.0))
    return MCKEE_CONSTANT * ect * math.sqrt(board_thickness_cm * perimeter_cm)


# ─────────────────────────────────────────────────────────────────────────────
# § F13 – Board Thickness
# ─────────────────────────────────────────────────────────────────────────────

def f13_board_thickness(
    combination: str,
    ply: int,
    flute_configs: dict[str, FluteConfig],
) -> float:
    """
    F13: boardThickness = Σ fluteHeight per flute char in combination string.
    Fallback = PLY_THICKNESS[ply] if no flute chars found.
    """
    flute_chars = _extract_flute_chars(combination)
    if not flute_chars:
        return PLY_THICKNESS.get(ply, 3.0)

    thickness = 0.0
    for fc_char in flute_chars:
        fc = flute_configs.get(fc_char)
        if fc:
            thickness += fc.height_mm
        else:
            default = FLUTE_DEFAULTS.get(fc_char)
            if default:
                thickness += default["height_mm"]
    return thickness if thickness > 0 else PLY_THICKNESS.get(ply, 3.0)


# ─────────────────────────────────────────────────────────────────────────────
# § F14 – Printing Cost
# ─────────────────────────────────────────────────────────────────────────────

def f14_printing_cost(
    cost_per_print: float,
    plate_cost: float,
    quantity: int,
    moq: int = 0,
    moq_enabled: bool = False,
) -> float:
    """
    F14: PrintingCostPerBox = CostPerPrint + (PlateCost / Qty)
    MOQ penalty when enabled and Qty < MOQ:
    PrintingCostPerBox += CostPerPrint × (MOQ − Qty) / Qty
    """
    if quantity <= 0:
        return 0.0
    cost = cost_per_print + plate_cost / quantity
    if moq_enabled and moq > 0 and quantity < moq:
        cost += (cost_per_print * (moq - quantity)) / quantity
    return cost


# ─────────────────────────────────────────────────────────────────────────────
# § F15 – Lamination Cost
# ─────────────────────────────────────────────────────────────────────────────

def f15_lamination_cost(
    sheet_length_mm: float,
    sheet_width_mm: float,
    lamination_rate: float,
) -> float:
    """
    F15: LaminationCost = (SheetLen_in × SheetWid_in × LaminationRate) / 100
    Dimensions converted from mm to inches (÷25.4).
    """
    sheet_len_in = sheet_length_mm / 25.4
    sheet_wid_in = sheet_width_mm / 25.4
    return (sheet_len_in * sheet_wid_in * lamination_rate) / 100.0


# ─────────────────────────────────────────────────────────────────────────────
# § F16 – Die Cost
# ─────────────────────────────────────────────────────────────────────────────

def f16_die_cost(die_development_charge: float, quantity: int) -> float:
    """F16: DieCost = DieDevelopmentCharge / Qty"""
    return die_development_charge / quantity if quantity > 0 else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# § F17 – Punching and Varnish Cost (flat rates)
# ─────────────────────────────────────────────────────────────────────────────

def f17_punching_cost(punching_rate: float) -> float:
    """F17: PunchingCost = punchingRate (flat per box)"""
    return punching_rate


def f17_varnish_cost(varnish_rate: float) -> float:
    """F17: VarnishCost = varnishRate (flat per box)"""
    return varnish_rate


# ─────────────────────────────────────────────────────────────────────────────
# § F18 – Conversion Cost
# ─────────────────────────────────────────────────────────────────────────────

def f18_conversion_cost(
    sheet_weight_kg: float,
    conversion_cost_per_kg: float,
) -> float:
    """F18: ConversionCost = SheetWeight × ConversionCostPerKg"""
    return sheet_weight_kg * conversion_cost_per_kg


# ─────────────────────────────────────────────────────────────────────────────
# § F19 – Total Cost Per Box
# ─────────────────────────────────────────────────────────────────────────────

def f19_total_cost_per_box(
    paper_cost: float,
    printing_cost: float,
    lamination_cost: float,
    die_cost: float,
    punching_cost: float,
    varnish_cost: float,
    markup_pct: float,
    conversion_cost: float,
) -> float:
    """
    F19: TotalCostPerBox = (PaperCost + AddOns) × (1 + Markup/100) + ConversionCost
    ConversionCost is added AFTER markup, not inside it.
    """
    add_ons = printing_cost + lamination_cost + die_cost + punching_cost + varnish_cost
    return (paper_cost + add_ons) * (1 + markup_pct / 100.0) + conversion_cost


# ─────────────────────────────────────────────────────────────────────────────
# § F20 – Subtotal
# ─────────────────────────────────────────────────────────────────────────────

def f20_subtotal(items: list[dict]) -> float:
    """
    F20: Subtotal = Σ(finalCostPerBox_i × qty_i) for selected items only.
    Each dict must have keys: final_cost_per_box, quantity, selected.
    """
    return sum(
        item["final_cost_per_box"] * item["quantity"]
        for item in items
        if item.get("selected", True)
    )


# ─────────────────────────────────────────────────────────────────────────────
# § F18B – Subtotal with Transport
# ─────────────────────────────────────────────────────────────────────────────

def f18b_subtotal_with_transport(subtotal: float, transport_charge: float) -> float:
    """F18B: SubtotalWithTransport = Subtotal + TransportCharge"""
    return subtotal + transport_charge


# ─────────────────────────────────────────────────────────────────────────────
# § F21 – GST Amount
# ─────────────────────────────────────────────────────────────────────────────

def f21_gst_amount(subtotal_with_transport: float, gst_pct: float) -> float:
    """F21: GSTAmount = SubtotalWithTransport × (gstPercent / 100)"""
    return subtotal_with_transport * (gst_pct / 100.0)


# ─────────────────────────────────────────────────────────────────────────────
# § F22 – Round Off
# ─────────────────────────────────────────────────────────────────────────────

def f22_round_off(subtotal_with_transport: float, gst_amount: float) -> float:
    """
    F22: RoundOff = round(SubtotalWithTransport + GSTAmount)
                   − (SubtotalWithTransport + GSTAmount)
    Positive round-off means the amount was rounded up; negative means rounded down.
    """
    total_before_round = subtotal_with_transport + gst_amount
    return round(total_before_round) - total_before_round


# ─────────────────────────────────────────────────────────────────────────────
# § F23 – Grand Total
# ─────────────────────────────────────────────────────────────────────────────

def f23_grand_total(
    subtotal_with_transport: float,
    gst_amount: float,
    round_off: float,
) -> float:
    """F23: GrandTotal = SubtotalWithTransport + GSTAmount ± RoundOff"""
    return subtotal_with_transport + gst_amount + round_off


# ─────────────────────────────────────────────────────────────────────────────
# § High-level orchestrators
# ─────────────────────────────────────────────────────────────────────────────

def calculate_rsc(
    inp: RSCInputs,
    bf_prices: dict[int, float],
    shade_premiums: dict[str, float],
    pricing_rules: list[dict],
    box_length_mm: Optional[float] = None,  # for BCT; None = skip BCT
    box_width_mm: Optional[float] = None,
) -> FormulaResult:
    """
    Orchestrate F01–F23 for an RSC quote item.
    Returns a FormulaResult with errors[] populated if any blocking condition occurs.
    """
    errors: list[str] = []

    # Resolve flute configs (merge defaults with tenant overrides)
    flute_configs = _build_flute_configs(inp.flute_configs)

    # F01, F02
    sheet_len = f01_rsc_sheet_length(
        inp.length_mm, inp.width_mm, inp.ply, inp.glue_flap_mm
    )
    sheet_wid = f02_rsc_sheet_width(
        inp.width_mm, inp.height_mm, inp.ply, inp.deckle_allowance_mm
    )

    # F13 board thickness
    board_t = f13_board_thickness(inp.combination, inp.ply, flute_configs)

    # F07 sheet weight
    sheet_weight = f07_sheet_weight_kg(
        sheet_len, sheet_wid, inp.layers, flute_configs, inp.combination
    )

    # Resolve paper rates for each layer (F08)
    for layer in inp.layers:
        result = f08_paper_rate(
            layer.bf, layer.shade, layer.gsm,
            bf_prices, shade_premiums, pricing_rules,
        )
        if not result.found:
            errors.append(
                f"No BF price found for BF{layer.bf}. "
                "Please configure paper prices before saving."
            )
            layer.rate = None
        else:
            layer.rate = result.rate

    # F09 paper cost — blocks if any rate missing
    paper_cost, paper_ok = f09_paper_cost(sheet_weight, inp.layers)
    if not paper_ok:
        errors.append(
            "Cannot compute paper cost: one or more layers have unresolved paper rates."
        )

    # F10, F11
    bs = f10_burst_factor(inp.layers, inp.combination, flute_configs)
    ect = f11_ect(inp.layers, inp.combination, flute_configs)

    # F12 BCT (only if box dims available)
    bct: Optional[float] = None
    if box_length_mm is not None and box_width_mm is not None:
        bct = f12_bct(ect, board_t, box_length_mm, box_width_mm)

    # F14 printing (use pre-computed add-on from inputs)
    printing = inp.printing_cost_per_box
    lamination = inp.lamination_cost_per_box
    die = inp.die_cost_per_box
    punching = inp.punching_cost_per_box
    varnish = inp.varnish_cost_per_box

    # F18 conversion
    conversion = f18_conversion_cost(sheet_weight, inp.conversion_cost_per_kg)

    # F19 total cost per box
    total_per_box = f19_total_cost_per_box(
        paper_cost, printing, lamination, die, punching, varnish,
        inp.markup_pct, conversion,
    )

    return FormulaResult(
        sheet_length_mm=sheet_len,
        sheet_width_mm=sheet_wid,
        sheet_weight_kg=sheet_weight,
        burst_factor=bs,
        ect_value=ect,
        bct_value=bct,
        board_thickness_mm=board_t,
        paper_cost=paper_cost,
        printing_cost=printing,
        lamination_cost=lamination,
        die_cost=die,
        punching_cost=punching,
        varnish_cost=varnish,
        conversion_cost=conversion,
        total_cost_per_box=total_per_box,
        errors=errors,
    )


def calculate_quote_totals(
    items: list[dict],
    gst_pct: float,
    transport_charge: float,
) -> dict:
    """
    Orchestrate F20, F18B, F21, F22, F23 for a full quote.
    items: list of dicts with keys: final_cost_per_box, quantity, selected.
    Returns dict with all total fields.
    """
    subtotal = f20_subtotal(items)
    subtotal_with_transport = f18b_subtotal_with_transport(subtotal, transport_charge)
    gst_amount = f21_gst_amount(subtotal_with_transport, gst_pct)
    round_off = f22_round_off(subtotal_with_transport, gst_amount)
    grand_total = f23_grand_total(subtotal_with_transport, gst_amount, round_off)

    return {
        "subtotal": subtotal,
        "transport_charge": transport_charge,
        "subtotal_with_transport": subtotal_with_transport,
        "gst_pct": gst_pct,
        "gst_amount": gst_amount,
        "round_off": round_off,
        "grand_total": grand_total,
    }


# ─────────────────────────────────────────────────────────────────────────────
# § Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_flute_chars(combination: str) -> list[str]:
    """Extract flute characters from combination string (uppercase non-liner chars).
    Liners are implicit; flute chars are the uppercase letters between liners.
    Convention: 'BCB' → flute chars = ['B'] (index 1 in the string).
    Odd-index positions in the combination string are flute chars.
    """
    # For a combination like "BCBCB" (5-ply), odd indices are flutes
    # For "BCB" (3-ply), index 1 is flute
    # For "B" (1-ply), no flutes
    return [c for i, c in enumerate(combination.upper()) if i % 2 == 1]


def _next_flute_config(
    flute_configs: dict[str, FluteConfig],
    flute_iter,
    layer: LayerSpec,
) -> FluteConfig:
    """Get the next flute config from the iterator for a fluting layer."""
    try:
        fc_char = next(flute_iter)
        fc = flute_configs.get(fc_char)
        if fc:
            return fc
    except StopIteration:
        pass
    # Fallback to defaults using layer attributes or first available
    default = FLUTE_DEFAULTS.get("C", {"factor": 1.45, "height_mm": 3.6})
    return FluteConfig(factor=default["factor"], height_mm=default["height_mm"])


def _build_flute_configs(overrides: dict[str, FluteConfig]) -> dict[str, FluteConfig]:
    """Merge tenant overrides with global defaults."""
    configs: dict[str, FluteConfig] = {}
    for flute_type, default in FLUTE_DEFAULTS.items():
        if flute_type in overrides:
            configs[flute_type] = overrides[flute_type]
        else:
            configs[flute_type] = FluteConfig(
                factor=default["factor"],
                height_mm=default["height_mm"],
            )
    return configs
