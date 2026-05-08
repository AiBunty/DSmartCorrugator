/**
 * BoxCostPro Formula Engine — TypeScript client-side implementation (F01–F23).
 * Mirrors backend/app/formulas/engine.py exactly.
 * Used for 200ms-debounced live preview. Server is authoritative at save time.
 */

// ── Constants ──────────────────────────────────────────────────────────────

export const GLUE_FLAP_DEFAULTS: Record<string, number> = {
  RSC: 35,
  HSC: 35,
  FOL: 0,
  TELE: 0,
  BLISS: 0,
};

export const DECKLE_ALLOWANCE_DEFAULTS: Record<string, number> = {
  RSC: 10,
  HSC: 10,
  FOL: 8,
  TELE: 8,
  BLISS: 8,
};

export const PLY_THICKNESS: Record<number, number> = {
  3: 3.5,
  5: 6.0,
  7: 9.0,
};

export const MAX_LENGTH_THRESHOLD = 1000; // mm
export const MCKEE_CONSTANT = 5.87;

export interface FluteConfig {
  factor: number;
  height_mm: number;
}

export const DEFAULT_FLUTE_CONFIGS: Record<string, FluteConfig> = {
  A: { factor: 1.55, height_mm: 4.8 },
  B: { factor: 1.35, height_mm: 2.5 },
  C: { factor: 1.45, height_mm: 3.6 },
  E: { factor: 1.25, height_mm: 1.2 },
  F: { factor: 1.20, height_mm: 0.8 },
};

// ── Input / Output Types ───────────────────────────────────────────────────

export interface LayerSpec {
  role: "liner" | "flute";
  gsm: number;
  bf: number;
  shade: string;
  reel_size_m?: number;
}

export interface RSCInputs {
  length_mm: number;
  width_mm: number;
  height_mm: number;
  ply: number;
  combination: string;         // e.g. "BC", "A", "E"
  layers: LayerSpec[];
  quantity: number;
  markup_pct: number;
  conversion_cost_per_kg: number;
  /** "inner" (default) or "od" / "outer" — applies F05 OD→ID before sheet calculation */
  dimension_type?: string;
  /** Override glue-flap (mm). Defaults to GLUE_FLAP_DEFAULTS.RSC = 35. */
  glue_flap_mm?: number;
  /** Override deckle allowance (mm). Defaults to DECKLE_ALLOWANCE_DEFAULTS.RSC = 10. */
  deckle_allowance_mm?: number;
  cost_per_print?: number;
  plate_cost?: number;
  print_moq?: number;
  moq_enabled?: boolean;
  lamination_rate?: number;
  die_development_charge?: number;
  printing_cost_per_box?: number;
  lamination_cost_per_box?: number;
  die_cost_per_box?: number;
  punching_cost_per_box?: number;
  varnish_cost_per_box?: number;
  flute_configs?: Record<string, FluteConfig>;
  /** Custom lamination area length in mm. If > 0, this overrides sheet length for F15. */
  lamination_custom_l_mm?: number;
  /** Custom lamination area width in mm. If > 0, this overrides sheet width for F15. */
  lamination_custom_w_mm?: number;
}

export interface PricingRule {
  rule_order: number;
  low_gsm_limit: number | null;
  high_gsm_limit: number | null;
  low_gsm_adjustment: number;
  high_gsm_adjustment: number;
  market_adjustment: number;
  is_active: boolean;
}

export interface FormulaResult {
  sheet_length_mm: number;
  sheet_width_mm: number;
  sheet_weight_kg: number;
  burst_factor: number;
  ect_value: number;
  bct_value: number;
  board_thickness_mm: number;
  paper_cost: number;
  printing_cost: number;
  lamination_cost: number;
  die_cost: number;
  punching_cost: number;
  varnish_cost: number;
  conversion_cost: number;
  total_cost_per_box: number;
  errors: string[];
}

// ── F01: RSC Sheet Length ───────────────────────────────────────────────────

export function f01_rsc_sheet_length(
  L: number,
  W: number,
  glue_flap: number = GLUE_FLAP_DEFAULTS.RSC
): number {
  const base = 2 * (L + W) + glue_flap;
  if (base > MAX_LENGTH_THRESHOLD) {
    return base + 0.1 * MAX_LENGTH_THRESHOLD;
  }
  return base;
}

// ── F02: RSC Sheet Width ────────────────────────────────────────────────────

export function f02_rsc_sheet_width(
  W: number,
  H: number,
  deckle_allowance: number = DECKLE_ALLOWANCE_DEFAULTS.RSC
): number {
  return W + H + deckle_allowance;
}

// ── F03: Sheet Length (generic) ─────────────────────────────────────────────

export function f03_sheet_length(L: number, W: number, glue_flap: number): number {
  return f01_rsc_sheet_length(L, W, glue_flap);
}

// ── F04: Sheet Width (generic) ──────────────────────────────────────────────

export function f04_sheet_width(W: number, H: number, deckle: number): number {
  return W + H + deckle;
}

// ── F05: OD → ID dimension conversion ──────────────────────────────────────

export function f05_od_to_id(
  L_od: number,
  W_od: number,
  H_od: number,
  ply: number
): { L: number; W: number; H: number } {
  const t = PLY_THICKNESS[ply] ?? 3.5;
  return {
    L: L_od - 2 * t,
    W: W_od - 2 * t,
    H: H_od - t,
  };
}

// ── F06: Layer GSM weighted sum ─────────────────────────────────────────────

export function f06_weighted_gsm(
  layers: LayerSpec[],
  flute_configs: Record<string, FluteConfig>
): number {
  let total = 0;
  for (const layer of layers) {
    if (layer.role === "liner") {
      total += layer.gsm;
    } else {
      // Flute — use combination character to find factor
      const cfg = _get_flute_config(layer, flute_configs);
      total += layer.gsm * cfg.factor;
    }
  }
  return total;
}

// ── F07: Sheet Weight ────────────────────────────────────────────────────────

export function f07_sheet_weight(
  sheet_length_mm: number,
  sheet_width_mm: number,
  weighted_gsm: number
): number {
  return (sheet_length_mm * sheet_width_mm * weighted_gsm) / 1_000_000_000;
}

// ── F08: Paper Rate Lookup ──────────────────────────────────────────────────

export interface RateLookupResult {
  rate: number | null;
  found: boolean;
  error?: string;
}

export function f08_paper_rate(
  gsm: number,
  bf: number,
  shade: string,
  bf_prices: Record<number, number>,
  shade_premiums: Record<string, number>,
  pricing_rules: PricingRule[]
): RateLookupResult {
  const base = bf_prices[bf];
  if (base === undefined) {
    return {
      rate: null,
      found: false,
      error: `No price found for BF ${bf}`,
    };
  }

  let adjustment = 0;
  const active_rules = pricing_rules.filter((r) => r.is_active);
  for (const rule of active_rules) {
    const low = rule.low_gsm_limit;
    const high = rule.high_gsm_limit;
    if (low !== null && gsm < low) {
      adjustment += rule.low_gsm_adjustment;
    } else if (high !== null && gsm >= high) {
      adjustment += rule.high_gsm_adjustment;
    }
    adjustment += rule.market_adjustment;
  }

  const shade_premium = shade_premiums[shade.toUpperCase()] ?? 0;
  return {
    rate: base + adjustment + shade_premium,
    found: true,
  };
}

// ── F09: Paper Cost Per Box ──────────────────────────────────────────────────

export interface PaperCostResult {
  cost: number | null;
  error?: string;
}

export function f09_paper_cost(
  layers: LayerSpec[],
  sheet_weight_kg: number,
  bf_prices: Record<number, number>,
  shade_premiums: Record<string, number>,
  pricing_rules: PricingRule[]
): PaperCostResult {
  let total_rate = 0;
  // Weighted rate = weighted_gsm_fraction × rate per layer
  // Simple: sum of (layer_gsm_fraction × layer_rate) × sheet_weight × 1000
  // But we calculate a single blended rate based on GSM contribution
  let total_gsm = 0;
  for (const layer of layers) {
    total_gsm += layer.gsm; // simplified — liner direct, flute already adjusted in weight
  }

  for (const layer of layers) {
    const result = f08_paper_rate(
      layer.gsm, layer.bf, layer.shade,
      bf_prices, shade_premiums, pricing_rules
    );
    if (!result.found || result.rate === null) {
      return { cost: null, error: result.error ?? `Rate not found for layer GSM=${layer.gsm} BF=${layer.bf}` };
    }
    // Weighted contribution
    total_rate += result.rate * (layer.gsm / (total_gsm || 1));
  }

  return { cost: sheet_weight_kg * total_rate };
}

// ── F10: Burst Factor ────────────────────────────────────────────────────────

export function f10_burst_factor(layers: LayerSpec[]): number {
  let bf_sum = 0;
  for (const layer of layers) {
    if (layer.role === "liner") {
      bf_sum += (layer.gsm * layer.bf) / 1000;
    } else {
      bf_sum += (layer.gsm * layer.bf) / 2000;
    }
  }
  return bf_sum;
}

// ── F11: ECT ─────────────────────────────────────────────────────────────────

const ECT_FLUTE_FACTORS: Record<string, number> = {
  A: 0.72, B: 0.69, C: 0.70, E: 0.62, F: 0.58,
};

export function f11_ect(layers: LayerSpec[]): number {
  let ect = 0;
  for (const layer of layers) {
    if (layer.role === "liner") {
      ect += Math.sqrt(layer.gsm * layer.bf) / 10;
    } else {
      const factor = ECT_FLUTE_FACTORS["C"]; // default; refine per combination
      ect += (Math.sqrt(layer.gsm * layer.bf) / 10) * factor;
    }
  }
  return ect;
}

// ── F12: BCT ──────────────────────────────────────────────────────────────────

export function f12_bct(
  ect: number,
  board_thickness_mm: number,
  box_length_mm: number,
  box_width_mm: number
): number {
  const perimeter_cm = (2 * (box_length_mm + box_width_mm)) / 10;
  return MCKEE_CONSTANT * ect * Math.sqrt((board_thickness_mm / 10) * perimeter_cm);
}

// ── F13: Board Thickness ──────────────────────────────────────────────────────

export function f13_board_thickness(
  combination: string,
  flute_configs: Record<string, FluteConfig>
): number {
  const LINER_THICKNESS = 0.3; // mm per liner face
  const liners = _count_liners(combination);
  const flutes = _extract_flute_chars(combination);
  let thickness = liners * LINER_THICKNESS;
  for (const ft of flutes) {
    thickness += (flute_configs[ft] ?? DEFAULT_FLUTE_CONFIGS[ft] ?? DEFAULT_FLUTE_CONFIGS.B).height_mm;
  }
  return thickness;
}

// ── F14: Printing Cost ───────────────────────────────────────────────────────

export function f14_printing_cost(
  cost_per_print: number,
  plate_cost: number,
  quantity: number,
  moq = 0,
  moq_enabled = false
): number {
  if (quantity <= 0) return 0;
  let cost = cost_per_print + (plate_cost / quantity);
  if (moq_enabled && moq > 0 && quantity < moq) {
    cost += (cost_per_print * (moq - quantity)) / quantity;
  }
  return cost;
}

// ── F15: Lamination Cost ─────────────────────────────────────────────────────

export function f15_lamination_cost(
  sheet_length_mm: number,
  sheet_width_mm: number,
  lamination_rate: number
): number {
  if (lamination_rate <= 0) return 0;
  const sheet_len_in = sheet_length_mm / 25.4;
  const sheet_wid_in = sheet_width_mm / 25.4;
  return (sheet_len_in * sheet_wid_in * lamination_rate) / 100;
}

// ── F16: Die Cost ────────────────────────────────────────────────────────────

export function f16_die_cost(die_development_charge: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return die_development_charge / quantity;
}

// ── F17: Punching Cost ───────────────────────────────────────────────────────

export function f17_punching_cost(cost_per_box: number): number {
  return cost_per_box;
}

// ── F17B: Varnish Cost ───────────────────────────────────────────────────────

export function f17b_varnish_cost(cost_per_box: number): number {
  return cost_per_box;
}

// ── F18: Conversion Cost ──────────────────────────────────────────────────────

export function f18_conversion_cost(
  sheet_weight_kg: number,
  cost_per_kg: number
): number {
  return sheet_weight_kg * cost_per_kg;
}

// ── F19: Total Cost Per Box ──────────────────────────────────────────────────

export function f19_total_cost_per_box(
  paper_cost: number,
  printing_cost: number,
  lamination_cost: number,
  die_cost: number,
  punching_cost: number,
  varnish_cost: number,
  conversion_cost: number,
  markup_pct: number
): number {
  const add_ons = printing_cost + lamination_cost + die_cost + punching_cost + varnish_cost;
  // Conversion applied AFTER markup
  return (paper_cost + add_ons) * (1 + markup_pct / 100) + conversion_cost;
}

// ── F20: Subtotal ────────────────────────────────────────────────────────────

export function f20_subtotal(
  items: Array<{ final_cost_per_box: number; quantity: number; selected: boolean }>
): number {
  let total = 0;
  for (const item of items) {
    if (item.selected) {
      total += item.final_cost_per_box * item.quantity;
    }
  }
  return total;
}

// ── F21: Transport Charge ────────────────────────────────────────────────────

export function f21_subtotal_with_transport(
  subtotal: number,
  transport_charge: number
): number {
  return subtotal + transport_charge;
}

// ── F22: GST ─────────────────────────────────────────────────────────────────

export function f22_gst(
  subtotal_with_transport: number,
  gst_pct: number
): number {
  return (subtotal_with_transport * gst_pct) / 100;
}

// ── F23: Grand Total (with round-off) ────────────────────────────────────────

export function f23_grand_total(
  subtotal_with_transport: number,
  gst_amount: number
): { round_off: number; grand_total: number } {
  const raw = subtotal_with_transport + gst_amount;
  const rounded = Math.round(raw);
  return {
    round_off: rounded - raw,
    grand_total: rounded,
  };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export function calculateRSC(
  inputs: RSCInputs,
  bf_prices: Record<number, number>,
  shade_premiums: Record<string, number>,
  pricing_rules: PricingRule[],
  box_length_mm?: number,
  box_width_mm?: number
): FormulaResult {
  const errors: string[] = [];
  const flute_cfgs = inputs.flute_configs ?? DEFAULT_FLUTE_CONFIGS;

  // Resolve inner dimensions (apply F05 when dimension_type is OD)
  let L = inputs.length_mm;
  let W = inputs.width_mm;
  let H = inputs.height_mm;
  if (inputs.dimension_type === "od" || inputs.dimension_type === "outer") {
    const id = f05_od_to_id(L, W, H, inputs.ply);
    L = id.L;
    W = id.W;
    H = id.H;
  }

  // F01 / F02 — use caller-supplied glue flap / deckle or defaults
  const glue_flap = inputs.glue_flap_mm ?? GLUE_FLAP_DEFAULTS.RSC;
  const deckle_allowance = inputs.deckle_allowance_mm ?? DECKLE_ALLOWANCE_DEFAULTS.RSC;
  const sheet_length = f01_rsc_sheet_length(L, W, glue_flap);
  const sheet_width = f02_rsc_sheet_width(W, H, deckle_allowance);

  // F06 + F07
  const weighted_gsm = f06_weighted_gsm(inputs.layers, flute_cfgs);
  const sheet_weight = f07_sheet_weight(sheet_length, sheet_width, weighted_gsm);

  // F09 — blocking
  const paper_cost_result = f09_paper_cost(
    inputs.layers, sheet_weight, bf_prices, shade_premiums, pricing_rules
  );
  if (paper_cost_result.cost === null) {
    errors.push(paper_cost_result.error ?? "Paper cost unavailable");
  }

  const paper_cost = paper_cost_result.cost ?? 0;

  // F10 / F11 / F13
  const burst_factor = f10_burst_factor(inputs.layers);
  const ect_value = f11_ect(inputs.layers);
  const board_thickness = f13_board_thickness(inputs.combination, flute_cfgs);

  // F12: BCT requires box dimensions
  let bct_value = 0;
  if (box_length_mm && box_width_mm) {
    bct_value = f12_bct(ect_value, board_thickness, box_length_mm, box_width_mm);
  }

  // F14–F17B
  const printing_cost =
    inputs.printing_cost_per_box ??
    f14_printing_cost(
      inputs.cost_per_print ?? 0,
      inputs.plate_cost ?? 0,
      inputs.quantity,
      inputs.print_moq ?? 0,
      Boolean(inputs.moq_enabled)
    );
  const lamination_length_mm =
    inputs.lamination_custom_l_mm && inputs.lamination_custom_l_mm > 0
      ? inputs.lamination_custom_l_mm
      : sheet_length;
  const lamination_width_mm =
    inputs.lamination_custom_w_mm && inputs.lamination_custom_w_mm > 0
      ? inputs.lamination_custom_w_mm
      : sheet_width;
  const lamination_cost =
    inputs.lamination_cost_per_box ??
    f15_lamination_cost(lamination_length_mm, lamination_width_mm, inputs.lamination_rate ?? 0);
  const die_cost =
    inputs.die_cost_per_box ??
    f16_die_cost(inputs.die_development_charge ?? 0, inputs.quantity);
  const punching_cost = f17_punching_cost(inputs.punching_cost_per_box ?? 0);
  const varnish_cost = f17b_varnish_cost(inputs.varnish_cost_per_box ?? 0);

  // F18
  const conversion_cost = f18_conversion_cost(sheet_weight, inputs.conversion_cost_per_kg);

  // F19
  const total_cost_per_box = f19_total_cost_per_box(
    paper_cost, printing_cost, lamination_cost, die_cost, punching_cost,
    varnish_cost, conversion_cost, inputs.markup_pct
  );

  return {
    sheet_length_mm: sheet_length,
    sheet_width_mm: sheet_width,
    sheet_weight_kg: sheet_weight,
    burst_factor,
    ect_value,
    bct_value,
    board_thickness_mm: board_thickness,
    paper_cost,
    printing_cost,
    lamination_cost,
    die_cost,
    punching_cost,
    varnish_cost,
    conversion_cost,
    total_cost_per_box: errors.length > 0 ? 0 : total_cost_per_box,
    errors,
  };
}

export function calculateQuoteTotals(
  items: Array<{ final_cost_per_box: number; quantity: number; selected: boolean }>,
  gst_pct: number,
  transport_charge: number
): {
  subtotal: number;
  subtotal_with_transport: number;
  gst_amount: number;
  round_off: number;
  grand_total: number;
} {
  const subtotal = f20_subtotal(items);
  const subtotal_with_transport = f21_subtotal_with_transport(subtotal, transport_charge);
  const gst_amount = f22_gst(subtotal_with_transport, gst_pct);
  const { round_off, grand_total } = f23_grand_total(subtotal_with_transport, gst_amount);
  return { subtotal, subtotal_with_transport, gst_amount, round_off, grand_total };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function _extract_flute_chars(combination: string): string[] {
  return combination.split("").filter((c) => ["A", "B", "C", "E", "F"].includes(c));
}

function _count_liners(combination: string): number {
  // Liners = flutes + 1 (each flute sandwiched between two liners, minus shared)
  const flutes = _extract_flute_chars(combination);
  return flutes.length + 1;
}

function _get_flute_config(_layer: LayerSpec, flute_configs: Record<string, FluteConfig>): FluteConfig {
  // Layer role="flute" — need to identify which flute type.
  // This is a simplification; in practice the combination string provides the type.
  // Fallback to B.
  return flute_configs["B"] ?? DEFAULT_FLUTE_CONFIGS.B;
}
