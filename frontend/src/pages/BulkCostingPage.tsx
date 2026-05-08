import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Trash2, Upload, RefreshCw, Calculator, Mail, Layers, X, MessageCircle, Printer, Copy, ChevronsDown } from "lucide-react";
import api from "../lib/api";
import { calculateRSC } from "../lib/formulas/engine";
import { cn, formatCurrency } from "../lib/utils";
import type { LayerSpec, PartyProfile } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type PrintingType = "none" | "flexo" | "offset";

type BulkRow = {
  id: string;
  cost_basis: "rsc" | "sheet";
  box_name: string;
  sku_code: string;
  hsn_code: string;
  uom: "Nos" | "Sheet";
  length_mm: number;
  width_mm: number;
  height_mm: number;
  quantity: number;
  ply: number;
  combination: string;
  layer_specs: LayerSpec[];
  markup_pct: number;
  gst_pct: number;
  conversion_cost_per_kg: number;
  printing_type: PrintingType;
  cost_per_print: number;
  plate_cost: number;
  print_moq: number;
  moq_enabled: boolean;
  lamination_rate: number;
  lamination_custom_l_mm: number;
  lamination_custom_w_mm: number;
  die_development_charge: number;
  punching_cost_per_box: number;
  varnish_cost_per_box: number;
};

type ComputedResult = ReturnType<typeof calculateRSC>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseNum(v: string, fallback = 0): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

const FLUTE_TYPES = ["A", "B", "C", "E", "F"] as const;
const PLY_OPTIONS = [3, 5, 7, 9] as const;
function fluteCount(ply: number) {
  return Math.max(1, Math.floor((ply - 1) / 2));
}

function combosForPly(ply: number): string[] {
  const len = fluteCount(ply);
  const out: string[] = [];
  const build = (prefix: string) => {
    if (prefix.length === len) { out.push(prefix); return; }
    for (const f of FLUTE_TYPES) build(prefix + f);
  };
  build("");
  return out;
}

/**
 * Smart layer defaults:
 * - Layer 0 (top/outer liner): Golden Kraft BF=22, shade=K
 * - Flute layers: BF=20, shade=SCF
 * - Inner liners: BF=18, shade=N (natural)
 */
function defaultLayerSpecs(ply: number, bfValues?: number[]): LayerSpec[] {
  const findBF = (target: number) => {
    if (!bfValues?.length) return target;
    return bfValues.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );
  };
  return Array.from({ length: ply }, (_, i) => {
    const isFlute = i % 2 === 1;
    const isTopLiner = i === 0;
    if (isFlute) {
      return { role: "flute" as const, gsm: 150, bf: findBF(20), shade: "SCF", reel_size_m: 1, rate: 0, rct_value: 5, price_override: false };
    }
    if (isTopLiner) {
      return { role: "liner" as const, gsm: 180, bf: findBF(22), shade: "K", reel_size_m: 1, rate: 0, rct_value: 5, price_override: false };
    }
    return { role: "liner" as const, gsm: 150, bf: findBF(18), shade: "N", reel_size_m: 1, rate: 0, rct_value: 5, price_override: false };
  });
}

function triggerBulkPdf(
  rows: BulkRow[],
  computed: ReturnType<typeof calculateRSC>[],
  party: PartyProfile | null,
  companyName: string
) {
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const validPairs = rows.map((r, i) => ({ row: r, result: computed[i] })).filter((p) => p.result && p.result.errors.length === 0);
  const itemRows = validPairs.map((p, i) => {
    const r = p.row;
    const res = p.result;
    const amount = res.total_cost_per_box * r.quantity;
    return `<tr><td>${i + 1}</td><td>${r.box_name}</td><td>${r.sku_code || "-"}</td><td>${r.hsn_code}</td><td>${r.ply}Ply ${r.combination}</td><td>${r.length_mm}\u00d7${r.width_mm}\u00d7${r.height_mm}</td><td style="text-align:right">${r.quantity.toLocaleString()}</td><td style="text-align:right">${formatCurrency(res.total_cost_per_box, "INR")}</td><td style="text-align:right">${formatCurrency(amount, "INR")}</td></tr>`;
  }).join("");
  const grandTotal = validPairs.reduce((s, p) => s + p.result.total_cost_per_box * p.row.quantity, 0);
  const gstPct = rows[0]?.gst_pct ?? 18;
  const gstAmount = (grandTotal * gstPct) / 100;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Bulk Costing \u2014 ${date}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:24px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #1a73e8;padding-bottom:12px}.company-name{font-size:18px;font-weight:700;color:#1a73e8}.meta{text-align:right;font-size:10px;color:#555}.party-box{background:#f5f8ff;border:1px solid #d0dff8;border-radius:6px;padding:10px 14px;margin-bottom:14px}table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}th{background:#1a73e8;color:white;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #e8ecf0}tr:nth-child(even) td{background:#f7f9fc}.totals{margin-left:auto;width:280px;font-size:11px}.grand{font-weight:700;background:#1a73e8;color:white}.footer{margin-top:24px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e8ecf0;padding-top:10px}@media print{body{padding:0}}</style></head><body><div class="header"><div><div class="company-name">${companyName}</div><div style="font-size:10px;color:#555;margin-top:2px">Bulk Costing Quotation</div></div><div class="meta"><div>Date: ${date}</div>${party ? `<div>Party: ${party.person_name}${party.company_name ? ` / ${party.company_name}` : ""}</div>` : ""}</div></div>${party ? `<div class="party-box"><div style="font-size:9px;text-transform:uppercase;color:#888;letter-spacing:0.5px">Bill To</div><div style="font-size:13px;font-weight:600">${party.person_name}${party.company_name ? ` (${party.company_name})` : ""}</div>${party.gstin ? `<div style="font-size:10px;color:#555">GSTIN: ${party.gstin}</div>` : ""}</div>` : ""}<table><thead><tr><th>#</th><th>Box Name</th><th>SKU</th><th>HSN</th><th>Spec</th><th>L\u00d7W\u00d7H (mm)</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="totals"><table><tr><td>Sub Total</td><td style="text-align:right">${formatCurrency(grandTotal, "INR")}</td></tr><tr><td>GST @ ${gstPct}%</td><td style="text-align:right">${formatCurrency(gstAmount, "INR")}</td></tr><tr class="grand"><td>Grand Total</td><td style="text-align:right">${formatCurrency(grandTotal + gstAmount, "INR")}</td></tr></table></div><div class="footer">Computer-generated quotation. Prices are indicative. | BoxCostPro</div></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

const DEFAULT_ROW: Omit<BulkRow, "id"> = {
  cost_basis: "rsc",
  box_name: "New Box",
  sku_code: "",
  hsn_code: "4819",
  uom: "Nos",
  length_mm: 300,
  width_mm: 200,
  height_mm: 150,
  quantity: 1000,
  ply: 5,
  combination: "BC",
  layer_specs: defaultLayerSpecs(5),
  markup_pct: 15,
  gst_pct: 18,
  conversion_cost_per_kg: 15,
  printing_type: "none",
  cost_per_print: 0,
  plate_cost: 0,
  print_moq: 0,
  moq_enabled: false,
  lamination_rate: 0,
  lamination_custom_l_mm: 0,
  lamination_custom_w_mm: 0,
  die_development_charge: 0,
  punching_cost_per_box: 0,
  varnish_cost_per_box: 0,
};

const CSV_COLUMNS = [
  "cost_basis", "box_name", "sku_code", "hsn_code", "uom",
  "length_mm", "width_mm", "height_mm", "quantity",
  "ply", "combination", "markup_pct", "gst_pct", "conversion_cost_per_kg",
  "printing_type", "cost_per_print", "plate_cost", "print_moq", "moq_enabled",
  "lamination_rate", "lamination_custom_l_mm", "lamination_custom_w_mm", "die_development_charge", "punching_cost_per_box", "varnish_cost_per_box",
] as const;

function rowsToCsv(rows: BulkRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((r) =>
    CSV_COLUMNS.map((col) => String(r[col as keyof BulkRow])).join(",")
  );
  return [header, ...lines].join("\r\n");
}

function parseCsvToRows(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim());
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = parts[i] ?? ""; });
    const moqVal = parseNum(rec.print_moq, 0);
    const ply = parseNum(rec.ply, 5);
    const costBasis = rec.cost_basis === "sheet" ? "sheet" : "rsc";
    const combos = combosForPly(ply);
    const combination = rec.combination && combos.includes(rec.combination) ? rec.combination : combos[0];
    const printingType: PrintingType = rec.printing_type === "flexo" ? "flexo" : rec.printing_type === "offset" ? "offset" : "none";
    return {
      id: uid(),
      cost_basis: costBasis,
      box_name: rec.box_name || `Item ${idx + 1}`,
      sku_code: rec.sku_code || "",
      hsn_code: rec.hsn_code || "4819",
      uom: rec.uom === "Sheet" ? "Sheet" : "Nos",
      length_mm: parseNum(rec.length_mm, 300),
      width_mm: parseNum(rec.width_mm, 200),
      height_mm: costBasis === "sheet" ? 0 : parseNum(rec.height_mm, 150),
      quantity: parseNum(rec.quantity, 1000),
      ply,
      combination,
      layer_specs: defaultLayerSpecs(ply),
      markup_pct: parseNum(rec.markup_pct, 15),
      gst_pct: parseNum(rec.gst_pct, 18),
      conversion_cost_per_kg: parseNum(rec.conversion_cost_per_kg, 15),
      printing_type: printingType,
      cost_per_print: parseNum(rec.cost_per_print, 0),
      plate_cost: parseNum(rec.plate_cost, 0),
      print_moq: moqVal,
      moq_enabled: rec.moq_enabled === "true" || (rec.moq_enabled === "" && moqVal > 0),
      lamination_rate: parseNum(rec.lamination_rate, 0),
      lamination_custom_l_mm: parseNum(rec.lamination_custom_l_mm, 0),
      lamination_custom_w_mm: parseNum(rec.lamination_custom_w_mm, 0),
      die_development_charge: parseNum(rec.die_development_charge, 0),
      punching_cost_per_box: parseNum(rec.punching_cost_per_box, 0),
      varnish_cost_per_box: parseNum(rec.varnish_cost_per_box, 0),
    };
  });
}

// ── Cell component ────────────────────────────────────────────────────────────

function EditCell({
  value,
  onChange,
  type = "number",
  min,
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
  min?: number;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded ${className}`}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BulkCostingPage() {
  const [rows, setRows] = useState<BulkRow[]>([{ id: uid(), ...DEFAULT_ROW }]);
  const [importError, setImportError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [editingLayersRowId, setEditingLayersRowId] = useState<string | null>(null);
  const [activeOutdraft, setActiveOutdraft] = useState<"none" | "email" | "whatsapp">("none");
  const [emailDraft, setEmailDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [waDraft, setWaDraft] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Paper data queries (same as QuoteDetailPage) ──
  const pricesQuery = useQuery<Array<{ bf_value: number; base_price: number }>>({
    queryKey: ["paper", "bf-prices"],
    queryFn: () => api.get("/paper/bf-prices").then((r) => r.data),
  });
  const shadesQuery = useQuery<Array<{ shade_code: string; premium: number }>>({
    queryKey: ["paper", "shade-premiums"],
    queryFn: () => api.get("/paper/shade-premiums").then((r) => r.data),
  });
  const rulesQuery = useQuery({
    queryKey: ["paper", "pricing-rules"],
    queryFn: () => api.get("/paper/pricing-rules").then((r) => r.data),
  });

  const bfPrices = useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of pricesQuery.data ?? []) map[row.bf_value] = row.base_price;
    return map;
  }, [pricesQuery.data]);

  const shadePremiums = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of shadesQuery.data ?? []) map[row.shade_code.toUpperCase()] = row.premium;
    return map;
  }, [shadesQuery.data]);

  const pricingRules = (rulesQuery.data as never[]) ?? [];

  // Sorted BF values for dropdown (from paper settings)
  const availableBFs = useMemo(
    () => (pricesQuery.data ?? []).map((r) => r.bf_value).sort((a, b) => a - b),
    [pricesQuery.data]
  );
  // Shade records for dropdown
  const availableShades = useMemo(() => shadesQuery.data ?? [], [shadesQuery.data]);

  const partiesQuery = useQuery<PartyProfile[]>({
    queryKey: ["quote-parties"],
    queryFn: () => api.get("/quotes/parties").then((r) => r.data),
  });

  const selectedParty = useMemo(
    () => (partiesQuery.data ?? []).find((party) => party.id === selectedPartyId) ?? null,
    [partiesQuery.data, selectedPartyId]
  );

  // Company profile for PDF/email branding
  const companyQuery = useQuery<{ company_name: string | null; phone: string | null; email: string | null; address: string | null; gstin: string | null }>({
    queryKey: ["settings", "company"],
    queryFn: () => api.get("/settings/company").then((r) => r.data),
  });
  const companyName = companyQuery.data?.company_name ?? "BoxCostPro";

  // Signature settings for email/WhatsApp footers
  const sigQuery = useQuery<{ whatsapp_signature_text: string | null; email_signature_html: string | null }>({
    queryKey: ["settings", "signatures"],
    queryFn: () => api.get("/settings/signatures").then((r) => r.data),
  });

  // ── Compute all rows ──
  const computed = useMemo<ComputedResult[]>(() => {
    return rows.map((row) => {
      const layers = row.layer_specs.length ? row.layer_specs : defaultLayerSpecs(row.ply, availableBFs);
      return calculateRSC(
        {
          length_mm: row.length_mm,
          width_mm: row.width_mm,
          height_mm: row.cost_basis === "sheet" ? 0 : row.height_mm,
          quantity: row.quantity,
          ply: row.ply,
          combination: row.combination,
          layers: row.layer_specs.length ? row.layer_specs : layers,
          markup_pct: row.markup_pct,
          conversion_cost_per_kg: row.conversion_cost_per_kg,
          cost_per_print: row.printing_type === "none" ? 0 : row.cost_per_print,
          plate_cost: row.printing_type === "none" ? 0 : row.plate_cost,
          print_moq: row.print_moq,
          moq_enabled: row.moq_enabled,
          lamination_rate: row.lamination_rate,
          lamination_custom_l_mm: row.lamination_custom_l_mm > 0 ? row.lamination_custom_l_mm : undefined,
          lamination_custom_w_mm: row.lamination_custom_w_mm > 0 ? row.lamination_custom_w_mm : undefined,
          die_development_charge: row.die_development_charge,
          punching_cost_per_box: row.punching_cost_per_box,
          varnish_cost_per_box: row.varnish_cost_per_box,
        },
        bfPrices,
        shadePremiums,
        pricingRules
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, bfPrices, shadePremiums, pricingRules]);

  // ── Row mutation helpers ──
  const updateRow = (id: string, patch: Partial<BulkRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        // Auto-fix combination when ply changes
        if (patch.ply !== undefined) {
          const combos = combosForPly(patch.ply);
          if (!combos.includes(updated.combination)) updated.combination = combos[0];
          updated.layer_specs = defaultLayerSpecs(patch.ply, availableBFs);
        }
        if (patch.cost_basis !== undefined && patch.cost_basis === "sheet") {
          updated.height_mm = 0;
          updated.uom = "Sheet";
        }
        if (patch.cost_basis !== undefined && patch.cost_basis === "rsc" && updated.uom === "Sheet") {
          updated.uom = "Nos";
          if (updated.height_mm <= 0) updated.height_mm = 150;
        }
        // Auto-enable MOQ
        if (patch.print_moq !== undefined && patch.print_moq > 0) {
          updated.moq_enabled = true;
        }
        return updated;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, { id: uid(), ...DEFAULT_ROW, layer_specs: defaultLayerSpecs(5, availableBFs) }]);

  const deleteRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const duplicateRow = (id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: uid(), box_name: prev[idx].box_name + " (copy)" };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const clearAll = () => setRows([{ id: uid(), ...DEFAULT_ROW, layer_specs: defaultLayerSpecs(5, availableBFs) }]);

  const requirePartySelection = (intent: string): boolean => {
    if (selectedPartyId) return true;
    setActionError(`Select party before ${intent}.`);
    return false;
  };

  // ── CSV export ──
  const handleExport = () => {
    if (!requirePartySelection("export")) return;
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-costing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionError("");
  };

  const handleDownloadSample = () => {
    const sampleRows: BulkRow[] = [
      {
        id: uid(),
        ...DEFAULT_ROW,
        box_name: "Sample RSC Box",
        sku_code: "BOX-RSC-001",
        hsn_code: "4819",
        cost_basis: "rsc",
        uom: "Nos",
        lamination_rate: 0.5,
        lamination_custom_l_mm: 250,
        lamination_custom_w_mm: 180,
      },
      {
        id: uid(),
        ...DEFAULT_ROW,
        box_name: "Sample Sheet Item",
        sku_code: "SHEET-001",
        hsn_code: "4808",
        cost_basis: "sheet",
        uom: "Sheet",
        length_mm: 1200,
        width_mm: 900,
        height_mm: 0,
        lamination_rate: 0.5,
        lamination_custom_l_mm: 0,
        lamination_custom_w_mm: 0,
      },
    ];
    const csv = [
      "# BULK COSTING SAMPLE TEMPLATE - INPUT GUIDE",
      "# Fill one row per item. Keep the first non-comment row as exact headers.",
      "# cost_basis: rsc or sheet",
      "# uom: Nos or Sheet",
      "# dimensions in mm. For sheet mode, keep height_mm as 0.",
      "# lamination_rate is per 100 sq.in. Optional custom area: lamination_custom_l_mm and lamination_custom_w_mm.",
      "# If custom lamination fields are 0, sheet size is used automatically.",
      "# moq_enabled: true/false",
      "# sku_code and hsn_code are accounting-ready fields.",
      rowsToCsv(sampleRows),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-costing-sample-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── CSV import ──
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsvToRows(text);
      if (!parsed.length) {
        setImportError("CSV has no valid rows.");
        return;
      }
      setRows((prev) => [...prev, ...parsed]);
      setImportError("");
      setActionError("");
    } catch {
      setImportError("Failed to parse CSV.");
    }
  };

  const updateLayer = (rowId: string, layerIndex: number, patch: Partial<LayerSpec>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextLayers = row.layer_specs.map((layer, index) =>
          index === layerIndex ? { ...layer, ...patch } : layer
        );
        return { ...row, layer_specs: nextLayers };
      })
    );
  };

  const resetLayersForRow = (rowId: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, layer_specs: defaultLayerSpecs(row.ply, availableBFs) } : row))
    );
  };

  /** Copy the spec from layerIndex down to all same-role layers below it */
  const copyLayerDown = (rowId: string, layerIndex: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const source = row.layer_specs[layerIndex];
        if (!source) return row;
        const nextLayers = row.layer_specs.map((layer, idx) => {
          if (idx <= layerIndex) return layer;
          if (layer.role !== source.role) return layer;
          return { ...layer, gsm: source.gsm, bf: source.bf, shade: source.shade, rate: source.rate, rct_value: source.rct_value };
        });
        return { ...row, layer_specs: nextLayers };
      })
    );
  };

  const handleDraftEmail = () => {
    if (!requirePartySelection("drafting email")) return;
    const validPairs = rows
      .map((row, index) => ({ row, result: computed[index] }))
      .filter((entry) => entry.result && entry.result.errors.length === 0);
    if (!validPairs.length) {
      setActionError("Add at least one valid row before drafting email.");
      return;
    }
    const quoteDate = new Date().toLocaleDateString("en-IN");
    const subTotal = validPairs.reduce((sum, entry) => sum + entry.result.total_cost_per_box * entry.row.quantity, 0);
    const gstPct = rows[0]?.gst_pct ?? 18;
    const gstAmt = (subTotal * gstPct) / 100;
    const grandTotal = subTotal + gstAmt;
    const itemLines = validPairs.map((entry, idx) => {
      const r = entry.row;
      const unit = entry.result.total_cost_per_box;
      return `${String(idx + 1).padStart(2, " ")}. ${r.box_name.padEnd(25)} | ${r.ply}Ply ${r.combination.padEnd(4)} | ${r.length_mm}×${r.width_mm}×${r.height_mm}mm | Qty: ${String(r.quantity.toLocaleString()).padStart(7)} ${r.uom} | SKU: ${r.sku_code || "—"} | HSN: ${r.hsn_code} | ${formatCurrency(unit, "INR")}/box | Amount: ${formatCurrency(unit * r.quantity, "INR")}`;
    }).join("\n");
    const sig = sigQuery.data?.email_signature_html
      ? "\n\n---\n" + sigQuery.data.email_signature_html.replace(/<[^>]+>/g, "")
      : `\n\nWarm regards,\n${companyName}`;
    const subject = `Packaging Quotation for ${selectedParty?.person_name ?? "Customer"} | ${quoteDate} | ${companyName}`;
    const body = `Dear ${selectedParty?.person_name ?? "Customer"},\n\nGreetings from ${companyName}!\n\nPlease find enclosed our packaging quotation for your kind review.\n\n─────────────────────────────────────────────────────────────\nBULK PACKAGING QUOTATION — ${quoteDate}\nParty: ${selectedParty?.person_name ?? ""}${selectedParty?.company_name ? ` (${selectedParty.company_name})` : ""}\n─────────────────────────────────────────────────────────────\n\n${itemLines}\n\n─────────────────────────────────────────────────────────────\nSUMMARY\n─────────────────────────────────────────────────────────────\n  Sub Total        : ${formatCurrency(subTotal, "INR")}\n  GST @ ${gstPct}%         : ${formatCurrency(gstAmt, "INR")}\n  Grand Total      : ${formatCurrency(grandTotal, "INR")}\n─────────────────────────────────────────────────────────────\n\nWe hope this meets your expectations. Happy to discuss any adjustments.${sig}`;
    setEmailDraft({ to: selectedParty?.email ?? "", subject, body });
    setActiveOutdraft("email");
    setActionError("");
  };

  const handleDraftWhatsApp = () => {
    if (!requirePartySelection("drafting WhatsApp message")) return;
    const validPairs = rows
      .map((row, index) => ({ row, result: computed[index] }))
      .filter((entry) => entry.result && entry.result.errors.length === 0);
    if (!validPairs.length) { setActionError("Add at least one valid row."); return; }
    const quoteDate = new Date().toLocaleDateString("en-IN");
    const subTotal = validPairs.reduce((sum, entry) => sum + entry.result.total_cost_per_box * entry.row.quantity, 0);
    const gstPct = rows[0]?.gst_pct ?? 18;
    const gstAmt = (subTotal * gstPct) / 100;
    const grandTotal = subTotal + gstAmt;
    const itemLines = validPairs.map((entry, idx) => {
      const r = entry.row;
      const unit = entry.result.total_cost_per_box;
      return `${idx + 1}. *${r.box_name}* — ${r.ply}Ply ${r.combination} | ${r.length_mm}×${r.width_mm}×${r.height_mm}mm\n   Qty: ${r.quantity.toLocaleString()} ${r.uom} @ ${formatCurrency(unit, "INR")}/box\n   HSN: ${r.hsn_code}${r.sku_code ? ` | SKU: ${r.sku_code}` : ""}`;
    }).join("\n\n");
    const sig = sigQuery.data?.whatsapp_signature_text
      ? "\n\n" + sigQuery.data.whatsapp_signature_text
      : `\n\nRegards,\n${companyName}`;
    const draft = `🔹 *Packaging Quotation* — ${quoteDate}\n*Party:* ${selectedParty?.person_name ?? ""}${selectedParty?.company_name ? ` (${selectedParty.company_name})` : ""}\n\n${itemLines}\n\n─────────────────────\n💰 *Sub Total:* ${formatCurrency(subTotal, "INR")}\n🏷️ *GST @ ${gstPct}%:* ${formatCurrency(gstAmt, "INR")}\n✅ *Grand Total:* ${formatCurrency(grandTotal, "INR")}\n─────────────────────\n_Prices are indicative. Valid for 7 days._${sig}`;
    setWaDraft(draft);
    setActiveOutdraft("whatsapp");
    setActionError("");
  };

  const copyWaToClipboard = async () => {
    try { await navigator.clipboard.writeText(waDraft); setWaCopied(true); setTimeout(() => setWaCopied(false), 2500); } catch { /* ignore */ }
  };

  const openWhatsApp = () => {
    const mobile = selectedParty?.mobile?.replace(/\D/g, "") ?? "";
    const url = mobile ? `https://wa.me/${mobile}?text=${encodeURIComponent(waDraft)}` : `https://wa.me/?text=${encodeURIComponent(waDraft)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── Summary totals ──
  const totals = useMemo(() => {
    const valid = computed.filter((c) => c.errors.length === 0);
    return {
      rows: valid.length,
      totalBoxes: rows.reduce((s, r) => s + r.quantity, 0),
      avgCost: valid.length
        ? valid.reduce((s, c) => s + c.total_cost_per_box, 0) / valid.length
        : 0,
      minCost: valid.length ? Math.min(...valid.map((c) => c.total_cost_per_box)) : 0,
      maxCost: valid.length ? Math.max(...valid.map((c) => c.total_cost_per_box)) : 0,
    };
  }, [computed, rows]);

  const isLoading = pricesQuery.isLoading || shadesQuery.isLoading || rulesQuery.isLoading;
  const editingRow = rows.find((row) => row.id === editingLayersRowId) ?? null;

  // ── Column definitions ──
  // Editable columns (label, key, width hint)
  const INPUT_COLS = [
    { label: "Box Name", key: "box_name", type: "text", w: "min-w-[120px]" },
    { label: "SKU", key: "sku_code", type: "text", w: "min-w-[110px]" },
    { label: "HSN", key: "hsn_code", type: "text", w: "min-w-[92px]" },
    { label: "UOM", key: "uom", type: "text", w: "min-w-[76px]" },
    { label: "L (mm)", key: "length_mm", type: "number", w: "min-w-[70px]" },
    { label: "W (mm)", key: "width_mm", type: "number", w: "min-w-[70px]" },
    { label: "H (mm)", key: "height_mm", type: "number", w: "min-w-[70px]" },
    { label: "Qty", key: "quantity", type: "number", w: "min-w-[70px]" },
    { label: "Markup%", key: "markup_pct", type: "number", w: "min-w-[72px]" },
    { label: "GST%", key: "gst_pct", type: "number", w: "min-w-[70px]" },
    { label: "Conv ₹/kg", key: "conversion_cost_per_kg", type: "number", w: "min-w-[80px]" },
    { label: "Print ₹/box", key: "cost_per_print", type: "number", w: "min-w-[80px]" },
    { label: "Plate ₹", key: "plate_cost", type: "number", w: "min-w-[72px]" },
    { label: "MOQ", key: "print_moq", type: "number", w: "min-w-[65px]" },
    { label: "Lam Rate", key: "lamination_rate", type: "number", w: "min-w-[78px]" },
    { label: "Lam L (mm)", key: "lamination_custom_l_mm", type: "number", w: "min-w-[84px]" },
    { label: "Lam W (mm)", key: "lamination_custom_w_mm", type: "number", w: "min-w-[84px]" },
    { label: "Die ₹", key: "die_development_charge", type: "number", w: "min-w-[65px]" },
    { label: "Punch ₹/box", key: "punching_cost_per_box", type: "number", w: "min-w-[80px]" },
    { label: "Varnish ₹/box", key: "varnish_cost_per_box", type: "number", w: "min-w-[88px]" },
  ] as const;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Bulk Costing</h1>
          <p className="text-sm text-muted-foreground">
            Excel-style sheet with RSC/Sheet mode, party mapping, and accounting-ready fields
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLoading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading paper rates…
            </span>
          )}
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Sample Template
          </button>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Row
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
            <Upload className="h-4 w-4" /> Import CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleDraftEmail}
            className="inline-flex items-center gap-1.5 rounded-l-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Mail className="h-4 w-4" /> Email Draft
          </button>
          <button
            type="button"
            onClick={handleDraftWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-r-md border border-l-0 border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => { if (requirePartySelection("PDF")) triggerBulkPdf(rows, computed, selectedParty, companyName); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> PDF / Print
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Party for this bulk costing</label>
          <select
            value={selectedPartyId}
            onChange={(e) => {
              setSelectedPartyId(e.target.value);
              setActionError("");
            }}
            className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select party...</option>
            {(partiesQuery.data ?? []).map((party) => (
              <option key={party.id} value={party.id}>
                {party.person_name}{party.company_name ? ` (${party.company_name})` : ""}
              </option>
            ))}
          </select>
          {selectedParty ? (
            <span className="text-xs text-muted-foreground">
              Email: {selectedParty.email || "Not available"}
            </span>
          ) : (
            <span className="text-xs text-amber-600">Required before Export, Email and WhatsApp Draft</span>
          )}
        </div>
      </div>

      {importError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {importError}
        </p>
      )}

      {actionError && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {actionError}
        </p>
      )}

      {/* ── Email draft panel ── */}
      {activeOutdraft === "email" && emailDraft && (
        <section className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Quotation Email Draft</h2>
            <button type="button" onClick={() => { setEmailDraft(null); setActiveOutdraft("none"); }} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="text-sm">
              To
              <input value={emailDraft.to} onChange={(e) => setEmailDraft((prev) => prev ? { ...prev, to: e.target.value } : prev)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              Subject
              <input value={emailDraft.subject} onChange={(e) => setEmailDraft((prev) => prev ? { ...prev, subject: e.target.value } : prev)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="text-sm block">
            Body
            <textarea value={emailDraft.body} onChange={(e) => setEmailDraft((prev) => prev ? { ...prev, body: e.target.value } : prev)} rows={12} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" />
          </label>
          <div className="flex gap-2">
            {emailDraft.to && (
              <a href={`mailto:${emailDraft.to}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90" target="_blank" rel="noopener noreferrer">
                <Mail className="h-4 w-4" /> Open in Mail Client
              </a>
            )}
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`To: ${emailDraft.to}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`); } catch {/**/} }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Copy className="h-4 w-4" /> Copy to Clipboard
            </button>
          </div>
        </section>
      )}

      {/* ── WhatsApp draft panel ── */}
      {activeOutdraft === "whatsapp" && (
        <section className="rounded-md border border-green-200 bg-green-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-green-800"><MessageCircle className="h-4 w-4" /> WhatsApp Draft</h2>
            <button type="button" onClick={() => setActiveOutdraft("none")} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <textarea
            value={waDraft}
            onChange={(e) => setWaDraft(e.target.value)}
            rows={14}
            className="w-full rounded-md border border-green-300 bg-white px-3 py-2 font-mono text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={openWhatsApp} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
              <MessageCircle className="h-4 w-4" /> Send via WhatsApp
            </button>
            <button type="button" onClick={copyWaToClipboard} className={cn("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent", waCopied ? "border-green-400 bg-green-50 text-green-700" : "border-border bg-background")}>
              <Copy className="h-4 w-4" /> {waCopied ? "Copied!" : "Copy Text"}
            </button>
          </div>
        </section>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 rounded-md border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Rows: <strong className="text-foreground">{rows.length}</strong>
        </span>
        <span className="text-muted-foreground">
          Valid: <strong className="text-foreground">{totals.rows}</strong>
        </span>
        <span className="text-muted-foreground">
          Total Boxes: <strong className="text-foreground">{totals.totalBoxes.toLocaleString()}</strong>
        </span>
        <span className="text-muted-foreground">
          Avg Cost/Box: <strong className="text-primary">{formatCurrency(totals.avgCost, "INR")}</strong>
        </span>
        <span className="text-muted-foreground">
          Min: <strong className="text-green-600">{formatCurrency(totals.minCost, "INR")}</strong>
        </span>
        <span className="text-muted-foreground">
          Max: <strong className="text-orange-500">{formatCurrency(totals.maxCost, "INR")}</strong>
        </span>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/80 px-2 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
              <th className="min-w-[85px] px-2 py-2 text-left font-semibold text-muted-foreground">Type</th>
              {/* Ply & Combo */}
              <th className="min-w-[60px] px-2 py-2 text-left font-semibold text-muted-foreground">Ply</th>
              <th className="min-w-[80px] px-2 py-2 text-left font-semibold text-muted-foreground">Combo</th>
              <th className="min-w-[90px] px-2 py-2 text-center font-semibold text-muted-foreground">Layers</th>
              <th className="min-w-[90px] px-2 py-2 text-left font-semibold text-muted-foreground">Print Type</th>
              {/* Input columns */}
              {INPUT_COLS.map((col) => (
                <th key={col.key} className={`${col.w} px-2 py-2 text-left font-semibold text-muted-foreground`}>
                  {col.label}
                </th>
              ))}
              {/* MOQ checkbox */}
              <th className="min-w-[60px] px-2 py-2 text-center font-semibold text-muted-foreground">MOQ✓</th>
              {/* Computed output columns */}
              <th className="min-w-[88px] px-2 py-2 text-right font-semibold text-blue-600 bg-blue-50/40">Paper ₹/box</th>
              <th className="min-w-[80px] px-2 py-2 text-right font-semibold text-blue-600 bg-blue-50/40">Print ₹</th>
              <th className="min-w-[80px] px-2 py-2 text-right font-semibold text-blue-600 bg-blue-50/40">Lam ₹</th>
              <th className="min-w-[80px] px-2 py-2 text-right font-semibold text-blue-600 bg-blue-50/40">Conv ₹</th>
              <th className="min-w-[96px] px-2 py-2 text-right font-semibold text-emerald-700 bg-emerald-50/40">Total ₹/box</th>
              {/* Actions */}
              <th className="sticky right-0 z-10 bg-muted/80 w-16 px-2 py-2 text-center font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const result = computed[rowIdx];
              const hasError = result?.errors && result.errors.length > 0;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${hasError ? "bg-red-50/30" : ""}`}
                >
                  {/* Row number */}
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 text-center text-muted-foreground font-medium">
                    {rowIdx + 1}
                  </td>

                  {/* Ply selector */}
                  <td className="px-1 py-1">
                    <select
                      value={row.cost_basis}
                      onChange={(e) => updateRow(row.id, { cost_basis: e.target.value as "rsc" | "sheet" })}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="rsc">RSC Box</option>
                      <option value="sheet">Sheet Size</option>
                    </select>
                  </td>

                  {/* Ply selector */}
                  <td className="px-1 py-1">
                    <select
                      value={row.ply}
                      onChange={(e) => updateRow(row.id, { ply: Number(e.target.value) })}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {PLY_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p} Ply</option>
                      ))}
                    </select>
                  </td>

                  {/* Combination selector */}
                  <td className="px-1 py-1">
                    <select
                      value={row.combination}
                      onChange={(e) => updateRow(row.id, { combination: e.target.value })}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {combosForPly(row.ply).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setEditingLayersRowId(row.id)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
                    >
                      <Layers className="h-3 w-3" />
                      {row.layer_specs.length} rows
                    </button>
                  </td>

                  {/* Print Type selector */}
                  <td className="px-1 py-1">
                    <select
                      value={row.printing_type}
                      onChange={(e) => updateRow(row.id, { printing_type: e.target.value as PrintingType })}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="none">None</option>
                      <option value="flexo">Flexo</option>
                      <option value="offset">Offset</option>
                    </select>
                  </td>

                  {/* Editable input columns */}
                  {INPUT_COLS.map((col) => (
                    <td key={col.key} className="border-l border-border/30 px-1 py-1">
                      {col.key === "uom" ? (
                        <select
                          value={row.uom}
                          onChange={(e) => updateRow(row.id, { uom: e.target.value as "Nos" | "Sheet" })}
                          className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="Nos">Nos</option>
                          <option value="Sheet">Sheet</option>
                        </select>
                      ) : (
                        <EditCell
                          type={col.type as "text" | "number"}
                          value={row[col.key as keyof BulkRow] as string | number}
                          className={row.cost_basis === "sheet" && col.key === "height_mm" ? "opacity-50" : ""}
                          onChange={(v) =>
                            updateRow(row.id, {
                              [col.key]:
                                col.key === "height_mm" && row.cost_basis === "sheet"
                                  ? 0
                                  : col.type === "number"
                                  ? parseNum(v)
                                  : v,
                            } as Partial<BulkRow>)
                          }
                        />
                      )}
                    </td>
                  ))}

                  {/* MOQ penalty checkbox */}
                  <td className="px-2 py-1 text-center border-l border-border/30">
                    <input
                      type="checkbox"
                      checked={row.moq_enabled}
                      onChange={(e) => updateRow(row.id, { moq_enabled: e.target.checked })}
                      title="Apply MOQ penalty (printing only)"
                    />
                  </td>

                  {/* ── Computed columns (read-only, blue tinted) ── */}
                  <td className="bg-blue-50/20 px-2 py-1 text-right font-medium text-blue-700 border-l border-blue-200/40">
                    {hasError ? (
                      <span className="text-red-500" title={result.errors.join("; ")}>Err</span>
                    ) : (
                      formatCurrency(result.paper_cost, "INR")
                    )}
                  </td>
                  <td className="bg-blue-50/20 px-2 py-1 text-right text-blue-600">
                    {hasError ? "—" : formatCurrency(result.printing_cost, "INR")}
                  </td>
                  <td className="bg-blue-50/20 px-2 py-1 text-right text-blue-600">
                    {hasError ? "—" : formatCurrency(result.lamination_cost, "INR")}
                  </td>
                  <td className="bg-blue-50/20 px-2 py-1 text-right text-blue-600">
                    {hasError ? "—" : formatCurrency(result.conversion_cost, "INR")}
                  </td>
                  <td className={`px-2 py-1 text-right font-semibold border-l-2 ${hasError ? "bg-red-50/40 text-red-600 border-red-300/40" : "bg-emerald-50/30 text-emerald-700 border-emerald-300/40"}`}>
                    {hasError ? (
                      <span title={result.errors.join("; ")}>Error</span>
                    ) : (
                      formatCurrency(result.total_cost_per_box, "INR")
                    )}
                  </td>

                  {/* Actions */}
                  <td className="sticky right-0 z-10 bg-card px-1 py-1 text-center border-l border-border/30">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title="Duplicate row"
                        onClick={() => duplicateRow(row.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete row"
                        onClick={() => deleteRow(row.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals footer */}
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="sticky left-0 bg-muted/40 px-2 py-2" />
                  <td colSpan={6 + INPUT_COLS.length + 1} className="px-2 py-2 text-xs text-muted-foreground">
                  <Calculator className="inline h-3.5 w-3.5 mr-1" />
                  {rows.length} rows · {totals.rows} computed
                </td>
                <td className="bg-blue-50/30 px-2 py-2 text-right text-xs text-blue-700 font-medium">
                  {formatCurrency(
                    computed.filter((c) => !c.errors.length).reduce((s, c) => s + c.paper_cost, 0) / Math.max(totals.rows, 1),
                    "INR"
                  )}
                  <span className="text-muted-foreground font-normal"> avg</span>
                </td>
                <td className="bg-blue-50/30 px-2 py-2 text-right" />
                <td className="bg-blue-50/30 px-2 py-2 text-right" />
                <td className="bg-blue-50/30 px-2 py-2 text-right" />
                <td className="bg-emerald-50/30 px-2 py-2 text-right text-emerald-700">
                  {formatCurrency(totals.avgCost, "INR")}
                  <span className="text-muted-foreground font-normal text-[10px]"> avg</span>
                </td>
                <td className="sticky right-0 bg-muted/40" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* CSV format hint */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">CSV Import Format</summary>
        <p className="mt-1 font-mono break-all pl-2">
          {CSV_COLUMNS.join(",")}
        </p>
        <p className="mt-1 pl-2">
          Tip: Download Sample Template for a ready-to-use file with RSC and Sheet rows.
        </p>
        <p className="mt-1 pl-2">
          The sample includes guidance rows starting with #. These are ignored automatically during CSV import.
        </p>
      </details>

      {editingRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-lg border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Paper Layer Input — {editingRow.box_name}</h3>
              <button type="button" onClick={() => setEditingLayersRowId(null)} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Layer 1 = Outer (Top Liner). Odd layers = Flutes. Layer {editingRow.ply} = Inner Liner.
              Smart defaults: Top Liner → Golden Kraft BF=22, Flutes → SCF BF=20, Inner Liners → Natural BF=18.
              Use <strong>Copy↓</strong> to propagate a row&apos;s spec to same-role layers below.
            </p>
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Role</th>
                    <th className="px-2 py-2 text-left">GSM</th>
                    <th className="min-w-[90px] px-2 py-2 text-left">BF</th>
                    <th className="min-w-[110px] px-2 py-2 text-left">Shade</th>
                    <th className="px-2 py-2 text-left">Rate ₹/kg</th>
                    <th className="px-2 py-2 text-left">RCT</th>
                    <th className="px-2 py-2 text-center">Override</th>
                    <th className="px-2 py-2 text-center">Copy↓</th>
                  </tr>
                </thead>
                <tbody>
                  {editingRow.layer_specs.map((layer, idx) => (
                    <tr key={`${editingRow.id}-${idx}`} className="border-b border-border/50">
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <select value={layer.role} onChange={(e) => updateLayer(editingRow.id, idx, { role: e.target.value as "liner" | "flute" })} className="w-full rounded border border-input bg-background px-2 py-1">
                          <option value="liner">Liner</option>
                          <option value="flute">Flute</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <EditCell value={layer.gsm} onChange={(v) => updateLayer(editingRow.id, idx, { gsm: parseNum(v, 0) })} />
                      </td>
                      <td className="px-2 py-1">
                        {availableBFs.length > 0 ? (
                          <select value={layer.bf} onChange={(e) => updateLayer(editingRow.id, idx, { bf: Number(e.target.value) })} className="w-full rounded border border-input bg-background px-2 py-1">
                            {availableBFs.map((bf) => <option key={bf} value={bf}>BF {bf}</option>)}
                          </select>
                        ) : (
                          <EditCell value={layer.bf} onChange={(v) => updateLayer(editingRow.id, idx, { bf: parseNum(v, 0) })} />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {availableShades.length > 0 ? (
                          <select value={layer.shade} onChange={(e) => updateLayer(editingRow.id, idx, { shade: e.target.value })} className="w-full rounded border border-input bg-background px-2 py-1">
                            {availableShades.map((s) => <option key={s.shade_code} value={s.shade_code}>{s.shade_code}{(s as { shade_label?: string }).shade_label ? ` — ${(s as { shade_label?: string }).shade_label}` : ""}</option>)}
                          </select>
                        ) : (
                          <EditCell type="text" value={layer.shade} onChange={(v) => updateLayer(editingRow.id, idx, { shade: v.toUpperCase() })} />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <EditCell value={layer.rate ?? 0} onChange={(v) => updateLayer(editingRow.id, idx, { rate: parseNum(v, 0) })} />
                      </td>
                      <td className="px-2 py-1">
                        <EditCell value={layer.rct_value ?? 0} onChange={(v) => updateLayer(editingRow.id, idx, { rct_value: parseNum(v, 0) })} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={Boolean(layer.price_override)} onChange={(e) => updateLayer(editingRow.id, idx, { price_override: e.target.checked })} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button type="button" title="Copy spec to same-role layers below" onClick={() => copyLayerDown(editingRow.id, idx)} className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent">
                          <ChevronsDown className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => resetLayersForRow(editingRow.id)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                Reset to Smart Defaults
              </button>
              <button type="button" onClick={() => setEditingLayersRowId(null)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
