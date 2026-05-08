import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Mail, MessageCircle, Sparkles } from "lucide-react";
import api from "../lib/api";
import RichHtmlEditor from "../components/RichHtmlEditor";
import type {
  AiDraftResponse,
  PartyProfile,
  QuoteDetailPayload,
  QuoteVersionDetailPayload,
  SaveQuoteRequest,
  SaveQuoteResponse,
  LayerSpec,
  MessageTemplate,
  SignatureSettings,
} from "../types";
import { calculateQuoteTotals, calculateRSC, GLUE_FLAP_DEFAULTS, DECKLE_ALLOWANCE_DEFAULTS } from "../lib/formulas/engine";
import { cn, formatCurrency, getAxiosErrorMessage } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

type LineItemForm = {
  id?: string;
  box_name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  quantity: number;
  ply: number;
  combination: string;
  markup_pct: number;
  conversion_cost_per_kg: number;
  layer_specs: LayerSpec[];
  cost_per_print: number;
  plate_cost: number;
  print_moq: number;
  moq_enabled: boolean;
  lamination_rate: number;
  die_development_charge: number;
  punching_cost_per_box: number;
  varnish_cost_per_box: number;
  selected?: boolean;
};

type QuoteItemComputed = {
  item: LineItemForm;
  result: ReturnType<typeof calculateRSC>;
  negotiationMode?: "none" | "discount_pct" | "fixed_price";
  negotiationValue?: number;
  negotiationReason?: string;
  negotiatedPrice?: number;
};

type BoxType = "rsc" | "sheet";
type DimensionUnit = "mm" | "cm" | "inch";
type DraftChannel = "email" | "whatsapp";

const FLUTE_TYPES = ["A", "B", "C", "E", "F"] as const;
const PLY_OPTIONS = [3, 5, 7, 9] as const;
const BF_OPTIONS = [14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40] as const;
const FLUTE_FACTOR_MAP: Record<string, number> = {
  A: 1.55,
  B: 1.35,
  C: 1.45,
  E: 1.25,
  F: 1.2,
};
const DEFAULT_SHADE_OPTIONS = ["K", "T", "SCF", "RCF", "KRA", "WKL", "WTT"];

const EMPTY_ITEM: LineItemForm = {
  box_name: "RSC Box",
  length_mm: 300,
  width_mm: 200,
  height_mm: 150,
  quantity: 1000,
  ply: 5,
  combination: "BC",
  markup_pct: 15,
  conversion_cost_per_kg: 15,
  layer_specs: [
    { role: "liner", gsm: 180, bf: 22, shade: "K", rate: 0, rct_value: 5, price_override: false },
    { role: "flute", gsm: 150, bf: 20, shade: "SCF", rate: 0, rct_value: 5, price_override: false },
    { role: "liner", gsm: 180, bf: 22, shade: "K", rate: 0, rct_value: 5, price_override: false },
    { role: "flute", gsm: 150, bf: 20, shade: "SCF", rate: 0, rct_value: 5, price_override: false },
    { role: "liner", gsm: 180, bf: 22, shade: "K", rate: 0, rct_value: 5, price_override: false },
  ],
  cost_per_print: 0,
  plate_cost: 0,
  print_moq: 0,
  moq_enabled: false,
  lamination_rate: 0,
  die_development_charge: 0,
  punching_cost_per_box: 0,
  varnish_cost_per_box: 0,
  selected: true,
};

function fluteLayerCountForPly(ply: number): number {
  return Math.max(1, Math.floor((ply - 1) / 2));
}

function generateFluteCombinations(ply: number): string[] {
  const targetLen = fluteLayerCountForPly(ply);
  const out: string[] = [];

  const build = (prefix: string) => {
    if (prefix.length === targetLen) {
      out.push(prefix);
      return;
    }
    for (const ft of FLUTE_TYPES) {
      build(prefix + ft);
    }
  };

  build("");
  return out;
}

function createLayerSpecsForPly(ply: number): LayerSpec[] {
  const layers: LayerSpec[] = [];
  for (let idx = 0; idx < ply; idx += 1) {
    const isFlute = idx % 2 === 1;
    layers.push({
      role: isFlute ? "flute" : "liner",
      gsm: isFlute ? 150 : 180,
      bf: isFlute ? 20 : 22,
      shade: isFlute ? "SCF" : "K",
      reel_size_m: 1,
      rate: 0,
      rct_value: 5,
      price_override: false,
    });
  }
  return layers;
}

function fromMm(mmValue: number, unit: DimensionUnit): number {
  if (unit === "cm") {
    return mmValue / 10;
  }
  if (unit === "inch") {
    return mmValue / 25.4;
  }
  return mmValue;
}

function toMm(value: number, unit: DimensionUnit): number {
  if (unit === "cm") {
    return value * 10;
  }
  if (unit === "inch") {
    return value * 25.4;
  }
  return value;
}

function htmlToPlainText(value: string): string {
  if (!value) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function plainTextToHtml(value: string): string {
  if (!value.trim()) return "";
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function defaultDraftState() {
  return {
    prompt: "Draft a polished quote message with a concise summary, commercial tone, and a clear call to action.",
    templateId: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    styledPreview: "",
    signatureOverride: "",
    variables: [] as string[],
  };
}

function cloneLineItem(item: LineItemForm): LineItemForm {
  return {
    ...item,
    layer_specs: item.layer_specs.map((layer) => ({ ...layer })),
  };
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBulkCsv(content: string): Array<Partial<LineItemForm>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const rows: Array<Partial<LineItemForm>> = [];

  for (let idx = 1; idx < lines.length; idx += 1) {
    const parts = lines[idx].split(",").map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = parts[headerIndex] ?? "";
    });

    const rowPrintMoq = parseNumber(row.print_moq, 0);
    rows.push({
      box_name: row.box_name || `Item ${idx}`,
      length_mm: parseNumber(row.length_mm, 0),
      width_mm: parseNumber(row.width_mm, 0),
      height_mm: parseNumber(row.height_mm, 0),
      quantity: parseNumber(row.quantity, 0),
      ply: parseNumber(row.ply, 5),
      combination: row.combination || "BC",
      markup_pct: parseNumber(row.markup_pct, 15),
      conversion_cost_per_kg: parseNumber(row.conversion_cost_per_kg, 15),
      cost_per_print: parseNumber(row.cost_per_print, 0),
      plate_cost: parseNumber(row.plate_cost, 0),
      print_moq: rowPrintMoq,
      moq_enabled: row.moq_enabled ? parseBoolean(row.moq_enabled) : rowPrintMoq > 0,
      lamination_rate: parseNumber(row.lamination_rate, 0),
      die_development_charge: parseNumber(row.die_development_charge, 0),
      punching_cost_per_box: parseNumber(row.punching_cost_per_box, 0),
      varnish_cost_per_box: parseNumber(row.varnish_cost_per_box, 0),
      selected: true,
    });
  }

  return rows;
}

export default function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromReports = searchParams.get("from") === "reports";
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isViewer = user?.role === "viewer";

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [newPartyMobile, setNewPartyMobile] = useState("");
  const [newPartyGstin, setNewPartyGstin] = useState("");

  const [item, setItem] = useState<LineItemForm>(EMPTY_ITEM);
  const [quoteItems, setQuoteItems] = useState<QuoteItemComputed[]>([]);
  const [boxType, setBoxType] = useState<BoxType>("rsc");
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>("mm");
  const [dimensionType, setDimensionType] = useState<"inner" | "od">("inner");

  // G01: Optional box dims for BCT
  const [boxDimLength, setBoxDimLength] = useState(0);
  const [boxDimWidth, setBoxDimWidth] = useState(0);
  const [boxDimHeight, setBoxDimHeight] = useState(0);
  const [showBoxDimPanel, setShowBoxDimPanel] = useState(false);

  // G03: Advanced RSC settings (glue flap / deckle)
  const [glueFlapMm, setGlueFlapMm] = useState(GLUE_FLAP_DEFAULTS.RSC);
  const [deckleAllowanceMm, setDeckleAllowanceMm] = useState(DECKLE_ALLOWANCE_DEFAULTS.RSC);
  const [showAdvancedRsc, setShowAdvancedRsc] = useState(false);
  const [laminationUnit, setLaminationUnit] = useState<DimensionUnit>("mm");
  const [laminationCustomL, setLaminationCustomL] = useState(0);
  const [laminationCustomW, setLaminationCustomW] = useState(0);

  const [gstPct, setGstPct] = useState(5);
  const [transportCharge, setTransportCharge] = useState(0);
  const [draftChannel, setDraftChannel] = useState<DraftChannel>("email");
  const [emailDraft, setEmailDraft] = useState(defaultDraftState);
  const [whatsAppDraft, setWhatsAppDraft] = useState(defaultDraftState);

  const [saveError, setSaveError] = useState("");
  const [bulkImportError, setBulkImportError] = useState("");
  const [hydratedVersionId, setHydratedVersionId] = useState<string | null>(null);

  // G11: Nav guard
  const isDirtyRef = useRef(false);
  const [showNavModal, setShowNavModal] = useState(false);
  const pendingNavFnRef = useRef<(() => void) | null>(null);

  // G12: Ply change confirmation
  const [showPlyModal, setShowPlyModal] = useState(false);
  const [pendingPly, setPendingPly] = useState<number | null>(null);
  const [previousLayersSnapshot, setPreviousLayersSnapshot] = useState<LayerSpec[] | null>(null);
  void previousLayersSnapshot; // available for future undo support

  // G13: Negotiation dialog
  const [negotiationItemId, setNegotiationItemId] = useState<string | null>(null);
  const [negotiationMode, setNegotiationMode] = useState<"none" | "discount_pct" | "fixed_price">("none");
  const [negotiationValue, setNegotiationValue] = useState(0);
  const [negotiationReason, setNegotiationReason] = useState("");

  // G08: Restore confirmation
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<number | null>(null);
  const restoreMutation = useMutation({
    mutationFn: (versionNumber: number) =>
      api.post(`/quotes/${quoteId}/restore/${versionNumber}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      setShowRestoreConfirm(null);
    },
  });

  // G11: mark dirty when items are added
  useEffect(() => {
    isDirtyRef.current = quoteItems.length > 0;
  }, [quoteItems]);

  // G11: browser-level beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const quoteQuery = useQuery({
    queryKey: ["quote", quoteId],
    enabled: Boolean(quoteId),
    queryFn: () => api.get<QuoteDetailPayload>(`/quotes/${quoteId}`).then((r) => r.data),
  });

  const currentVersionQuery = useQuery({
    queryKey: ["quote-version-detail", quoteId, quoteQuery.data?.current_version_id],
    enabled: Boolean(quoteId && quoteQuery.data?.current_version_id),
    queryFn: async () => {
      const currentVersion = quoteQuery.data?.versions.find(
        (version) => version.id === quoteQuery.data?.current_version_id
      );
      if (!currentVersion) {
        return null;
      }
      return api
        .get<QuoteVersionDetailPayload>(`/quotes/${quoteId}/versions/${currentVersion.version_number}`)
        .then((response) => response.data);
    },
  });

  const partiesQuery = useQuery({
    queryKey: ["quote-parties"],
    queryFn: () => api.get<PartyProfile[]>("/quotes/parties").then((r) => r.data),
  });

  const pricesQuery = useQuery({
    queryKey: ["paper", "bf-prices"],
    queryFn: () => api.get<Array<{ bf_value: number; base_price: number }>>("/paper/bf-prices").then((r) => r.data),
  });

  const shadesQuery = useQuery({
    queryKey: ["paper", "shade-premiums"],
    queryFn: () => api.get<Array<{ shade_code: string; premium: number }>>("/paper/shade-premiums").then((r) => r.data),
  });

  const rulesQuery = useQuery({
    queryKey: ["paper", "pricing-rules"],
    queryFn: () => api.get<Array<Record<string, unknown>>>("/paper/pricing-rules").then((r) => r.data),
    retry: false,
  });

  const templatesQuery = useQuery({
    queryKey: ["settings", "templates", "quote-compose"],
    queryFn: async () => {
      const [emailResponse, whatsappResponse] = await Promise.all([
        api.get<MessageTemplate[]>("/settings/templates?channel=email"),
        api.get<MessageTemplate[]>("/settings/templates?channel=whatsapp"),
      ]);
      return {
        email: emailResponse.data,
        whatsapp: whatsappResponse.data,
      };
    },
  });

  const signaturesQuery = useQuery({
    queryKey: ["settings", "signatures", "quote-compose"],
    queryFn: () => api.get<SignatureSettings>("/settings/signatures").then((response) => response.data),
  });

  const createPartyMutation = useMutation({
    mutationFn: (payload: {
      person_name: string;
      company_name?: string;
      email?: string;
      mobile?: string;
      gstin?: string;
    }) =>
      api.post<{ id: string }>("/quotes/parties", payload).then((r) => r.data),
    onSuccess: (data) => {
      setSelectedPartyId(data.id);
      setNewPartyName("");
      setNewCompanyName("");
      setNewPartyEmail("");
      setNewPartyMobile("");
      setNewPartyGstin("");
      queryClient.invalidateQueries({ queryKey: ["quote-parties"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SaveQuoteRequest) =>
      api.post<SaveQuoteResponse>(`/quotes/${quoteId}/save`, payload).then((r) => r.data),
    onSuccess: () => {
      setSaveError("");
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (error) => {
      setSaveError(getAxiosErrorMessage(error, "Failed to save quote version"));
    },
  });

  const aiDraftMutation = useMutation({
    mutationFn: (payload: { channel: DraftChannel; prompt: string; signature_override?: string }) =>
      api.post<AiDraftResponse>("/settings/ai-draft", {
        quote_id: quoteId,
        channel: payload.channel,
        prompt: payload.prompt,
        signature_override: payload.signature_override || undefined,
      }).then((response) => response.data),
    onSuccess: (data, variables) => {
      const nextState = {
        prompt: variables.prompt,
        templateId: "",
        subject: data.subject ?? "",
        bodyHtml: data.body_html ?? plainTextToHtml(data.body_text ?? ""),
        bodyText: data.body_text ?? htmlToPlainText(data.body_html ?? ""),
        styledPreview: data.styled_preview ?? data.body_html ?? data.body_text ?? "",
        signatureOverride: variables.signature_override ?? "",
        variables: data.variables,
      };
      if (variables.channel === "email") {
        setEmailDraft(nextState);
      } else {
        setWhatsAppDraft(nextState);
      }
    },
  });

  const combinationOptions = useMemo(
    () => generateFluteCombinations(item.ply),
    [item.ply]
  );

  useEffect(() => {
    if (!combinationOptions.includes(item.combination)) {
      setItem((prev) => ({
        ...prev,
        combination: combinationOptions[0],
      }));
    }
  }, [combinationOptions, item.combination]);

  const bfPrices = useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of pricesQuery.data ?? []) {
      map[row.bf_value] = row.base_price;
    }
    return map;
  }, [pricesQuery.data]);

  const shadePremiums = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of shadesQuery.data ?? []) {
      map[row.shade_code] = row.premium;
    }
    return map;
  }, [shadesQuery.data]);

  const shadeOptions = useMemo(() => {
    const fromApi = Object.keys(shadePremiums).filter(Boolean);
    return Array.from(new Set([...DEFAULT_SHADE_OPTIONS, ...fromApi]));
  }, [shadePremiums]);

  const resolveLayerRate = (layer: LayerSpec): number | null => {
    const basePrice = bfPrices[layer.bf];
    if (basePrice === undefined) {
      return null;
    }
    const premium = shadePremiums[layer.shade.toUpperCase()] ?? 0;
    return basePrice + premium;
  };

  useEffect(() => {
    setItem((prev) => {
      let changed = false;
      const nextLayers = prev.layer_specs.map((layer) => {
        if (layer.price_override) {
          return layer;
        }
        const nextRate = resolveLayerRate(layer);
        if (nextRate === null || layer.rate === nextRate) {
          return layer;
        }
        changed = true;
        return {
          ...layer,
          rate: nextRate,
        };
      });
      if (!changed) {
        return prev;
      }
      return {
        ...prev,
        layer_specs: nextLayers,
      };
    });
  }, [bfPrices, shadePremiums]);

  useEffect(() => {
    if (quoteQuery.data?.party?.id && !selectedPartyId) {
      setSelectedPartyId(quoteQuery.data.party.id);
    }
  }, [quoteQuery.data?.party?.id, selectedPartyId]);

  useEffect(() => {
    setHydratedVersionId(null);
    setQuoteItems([]);
  }, [quoteId]);

  useEffect(() => {
    const version = currentVersionQuery.data;
    if (!version || hydratedVersionId === version.id) {
      return;
    }

    const hydratedItems: QuoteItemComputed[] = version.items.map((savedItem) => {
      const layers = Array.isArray(savedItem.layer_specs) && savedItem.layer_specs.length
        ? savedItem.layer_specs
        : createLayerSpecsForPly(savedItem.ply);
      const normalizedItem: LineItemForm = {
        id: savedItem.id,
        box_name: savedItem.box_name || "Box",
        length_mm: savedItem.length_mm,
        width_mm: savedItem.width_mm,
        height_mm: savedItem.height_mm,
        quantity: savedItem.quantity,
        ply: savedItem.ply,
        combination: savedItem.combination,
        markup_pct: savedItem.markup_pct,
        conversion_cost_per_kg: savedItem.conversion_cost_per_kg,
        layer_specs: layers,
        cost_per_print: savedItem.printing_cost_per_box,
        plate_cost: 0,
        print_moq: 0,
        moq_enabled: false,
        lamination_rate: 0,
        die_development_charge: savedItem.die_cost_per_box,
        punching_cost_per_box: savedItem.punching_cost_per_box,
        varnish_cost_per_box: savedItem.varnish_cost_per_box,
        selected: savedItem.selected !== false,
      };

      const calculatedResult = calculateRSC(
        {
          ...normalizedItem,
          height_mm: savedItem.cost_basis === "sheet" ? 0 : normalizedItem.height_mm,
          layers: normalizedItem.layer_specs,
          dimension_type: "inner",
        },
        bfPrices,
        shadePremiums,
        (rulesQuery.data as never[]) ?? []
      );

      return {
        item: normalizedItem,
        result: calculatedResult,
        negotiationMode: savedItem.negotiation_mode,
        negotiationValue: savedItem.negotiated_price ?? undefined,
        negotiatedPrice: savedItem.negotiated_price ?? undefined,
      };
    });

    setQuoteItems(hydratedItems);
    setGstPct(version.gst_pct);
    setTransportCharge(version.transport_charge);
    setHydratedVersionId(version.id);
  }, [currentVersionQuery.data, hydratedVersionId, bfPrices, shadePremiums, rulesQuery.data]);

  const computed = useMemo(() => {
    // G01: determine effective box dims for BCT (use dedicated panel when boxType === "sheet")
    const bctL = boxType === "rsc" ? item.length_mm : boxDimLength;
    const bctW = boxType === "rsc" ? item.width_mm : boxDimWidth;
    const laminationCustomLMm = laminationCustomL > 0 ? toMm(laminationCustomL, laminationUnit) : 0;
    const laminationCustomWMm = laminationCustomW > 0 ? toMm(laminationCustomW, laminationUnit) : 0;

    const result = calculateRSC(
      {
        ...item,
        height_mm: boxType === "sheet" ? 0 : item.height_mm,
        layers: item.layer_specs,
        dimension_type: dimensionType,     // G02
        glue_flap_mm: glueFlapMm,          // G03
        deckle_allowance_mm: deckleAllowanceMm, // G03
        lamination_custom_l_mm: laminationCustomLMm > 0 ? laminationCustomLMm : undefined,
        lamination_custom_w_mm: laminationCustomWMm > 0 ? laminationCustomWMm : undefined,
      },
      bfPrices,
      shadePremiums,
      (rulesQuery.data as never[]) ?? [],
      bctL > 0 ? bctL : undefined,         // G01
      bctW > 0 ? bctW : undefined          // G01
    );

    const totals = calculateQuoteTotals(
      quoteItems.map((entry) => {
        const basePrice = entry.result.total_cost_per_box;
        const effective = entry.negotiationMode === "discount_pct"
          ? basePrice * (1 - (entry.negotiationValue ?? 0) / 100)
          : entry.negotiationMode === "fixed_price"
          ? (entry.negotiationValue ?? basePrice)
          : basePrice;
        return {
          final_cost_per_box: effective,
          quantity: entry.item.quantity,
          selected: entry.item.selected !== false,
        };
      }),
      gstPct,
      transportCharge
    );

    return { result, totals };
  }, [item, quoteItems, boxType, dimensionType, glueFlapMm, deckleAllowanceMm, laminationCustomL, laminationCustomW, laminationUnit, boxDimLength, boxDimWidth, bfPrices, shadePremiums, rulesQuery.data, gstPct, transportCharge]);

  const layerRequirements = useMemo(() => {
    const sheetAreaM2 = (computed.result.sheet_length_mm * computed.result.sheet_width_mm) / 1_000_000;
    let fluteIdx = 0;
    return item.layer_specs.map((layer, index) => {
      const fluteType = layer.role === "flute" ? item.combination[fluteIdx++] ?? "B" : "-";
      const flutingFactor = layer.role === "flute" ? (FLUTE_FACTOR_MAP[fluteType] ?? 1.35) : 1;
      const requiredKg = (sheetAreaM2 * layer.gsm * flutingFactor) / 1000;
      const autoRate = resolveLayerRate(layer);
      const effectiveRate = layer.price_override
        ? (layer.rate ?? autoRate ?? 0)
        : (autoRate ?? layer.rate ?? 0);
      return {
        index,
        layerNo: index + 1,
        layerType: layer.role,
        fluteType,
        gsm: layer.gsm,
        bf: layer.bf,
        shade: layer.shade,
        rate: effectiveRate,
        autoRate,
        requiredKg,
        paperCost: requiredKg * effectiveRate,
      };
    });
  }, [computed.result.sheet_length_mm, computed.result.sheet_width_mm, item.layer_specs, item.combination, bfPrices, shadePremiums]);

  const emailTemplates = templatesQuery.data?.email ?? [];
  const whatsappTemplates = templatesQuery.data?.whatsapp ?? [];

  useEffect(() => {
    if (!signaturesQuery.data) return;
    setEmailDraft((current) => {
      if (current.signatureOverride) return current;
      return {
        ...current,
        signatureOverride: signaturesQuery.data.email_signature_html ?? "",
      };
    });
    setWhatsAppDraft((current) => {
      if (current.signatureOverride) return current;
      return {
        ...current,
        signatureOverride: signaturesQuery.data.whatsapp_signature_text ?? "",
      };
    });
  }, [signaturesQuery.data]);

  const applyTemplate = (channel: DraftChannel, templateId: string) => {
    const sourceList = channel === "email" ? emailTemplates : whatsappTemplates;
    const template = sourceList.find((entry) => entry.id === templateId);
    if (!template) {
      if (channel === "email") {
        setEmailDraft((current) => ({ ...current, templateId: "" }));
      } else {
        setWhatsAppDraft((current) => ({ ...current, templateId: "" }));
      }
      return;
    }

    const nextState = {
      prompt: channel === "email"
        ? "Draft a polished quote email using the selected template tone and structure."
        : "Draft a polished WhatsApp quote message using the selected template tone and structure.",
      templateId,
      subject: template.subject ?? "",
      bodyHtml: template.body_html ?? plainTextToHtml(template.body_text ?? ""),
      bodyText: template.body_text ?? htmlToPlainText(template.body_html ?? ""),
      styledPreview: template.body_html ?? template.body_text ?? "",
      signatureOverride:
        channel === "email"
          ? (signaturesQuery.data?.email_signature_html ?? "")
          : (signaturesQuery.data?.whatsapp_signature_text ?? ""),
      variables: template.variables,
    };

    if (channel === "email") {
      setEmailDraft(nextState);
    } else {
      setWhatsAppDraft(nextState);
    }
  };

  const buildComputedItem = (sourceItem: LineItemForm): QuoteItemComputed => {
    const normalizedItem = cloneLineItem(sourceItem);
    const bctL = boxType === "rsc" ? normalizedItem.length_mm : boxDimLength;
    const bctW = boxType === "rsc" ? normalizedItem.width_mm : boxDimWidth;
    const laminationCustomLMm = laminationCustomL > 0 ? toMm(laminationCustomL, laminationUnit) : 0;
    const laminationCustomWMm = laminationCustomW > 0 ? toMm(laminationCustomW, laminationUnit) : 0;
    const result = calculateRSC(
      {
        ...normalizedItem,
        height_mm: boxType === "sheet" ? 0 : normalizedItem.height_mm,
        layers: normalizedItem.layer_specs,
        dimension_type: dimensionType,
        glue_flap_mm: glueFlapMm,
        deckle_allowance_mm: deckleAllowanceMm,
        lamination_custom_l_mm: laminationCustomLMm > 0 ? laminationCustomLMm : undefined,
        lamination_custom_w_mm: laminationCustomWMm > 0 ? laminationCustomWMm : undefined,
      },
      bfPrices,
      shadePremiums,
      (rulesQuery.data as never[]) ?? [],
      bctL > 0 ? bctL : undefined,
      bctW > 0 ? bctW : undefined
    );

    return {
      item: {
        ...normalizedItem,
        id: normalizedItem.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        selected: normalizedItem.selected !== false,
      },
      result,
    };
  };

  const addCurrentItemToQuote = () => {
    // G04: loading guard
    if (pricesQuery.isLoading || shadesQuery.isLoading || rulesQuery.isLoading) {
      setSaveError("Paper rates are still loading. Please wait a moment.");
      return;
    }
    if (!item.quantity || item.quantity <= 0) {
      setSaveError("Quantity must be greater than 0 before adding an item.");
      return;
    }
    const computedItem = buildComputedItem(item);
    if (computedItem.result.errors.length > 0) {
      setSaveError(`Cannot add item: ${computedItem.result.errors.join(", ")}`);
      return;
    }
    setSaveError("");
    setQuoteItems((prev) => [...prev, computedItem]);
  };

  const handleBulkImport = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseBulkCsv(text);
      if (!rows.length) {
        setBulkImportError("CSV has no data rows to import.");
        return;
      }

      const imported: QuoteItemComputed[] = [];
      for (const row of rows) {
        const ply = Number(row.ply ?? EMPTY_ITEM.ply);
        const combinationOptionsForPly = generateFluteCombinations(ply);
        const merged: LineItemForm = {
          ...cloneLineItem(EMPTY_ITEM),
          ...row,
          ply,
          combination: row.combination && combinationOptionsForPly.includes(row.combination)
            ? row.combination
            : combinationOptionsForPly[0],
          layer_specs: createLayerSpecsForPly(ply),
          selected: row.selected !== false,
        };
        const computedItem = buildComputedItem(merged);
        if (computedItem.result.errors.length === 0) {
          imported.push(computedItem);
        }
      }

      if (!imported.length) {
        setBulkImportError("No valid rows found. Check required columns and paper rates.");
        return;
      }

      setQuoteItems((prev) => [...prev, ...imported]);
      setBulkImportError("");
      setSaveError("");
    } catch {
      setBulkImportError("Failed to parse CSV file.");
    }
  };

  const submitSave = async () => {
    if (!selectedPartyId) {
      setSaveError("Select or create a party before saving");
      return;
    }
    // G09: pre-save toast when no items added
    if (quoteItems.length === 0) {
      setSaveError("Add at least one item before saving.");
      return;
    }

    const itemsToSave = quoteItems.length > 0
      ? quoteItems
      : [buildComputedItem(item)];

    const payload: SaveQuoteRequest = {
      party_id: selectedPartyId,
      items: itemsToSave.map((entry) => {
          const bctL = boxType === "rsc" ? entry.item.length_mm : boxDimLength;
          const bctW = boxType === "rsc" ? entry.item.width_mm : boxDimWidth;
          const bctH = boxType === "rsc" ? entry.item.height_mm : boxDimHeight;
          const basePrice = entry.result.total_cost_per_box;
          const negotiatedFinalPrice = entry.negotiationMode === "discount_pct"
            ? basePrice * (1 - (entry.negotiationValue ?? 0) / 100)
            : entry.negotiationMode === "fixed_price"
            ? (entry.negotiationValue ?? basePrice)
            : basePrice;
          return {
            box_name: entry.item.box_name,
            description: "",
            cost_basis: boxType,
            length_mm: entry.item.length_mm,
            width_mm: entry.item.width_mm,
            height_mm: boxType === "sheet" ? 0 : entry.item.height_mm,
            dimension_type: dimensionType,    // G02, G05
            box_length: bctL,               // G01
            box_width: bctW,                  // G01
            box_height: bctH,                 // G01
            quantity: entry.item.quantity,
            ply: entry.item.ply,
            combination: entry.item.combination,
            bct_basis: entry.result.bct_value > 0 ? "mckee" : "none", // G05
            layer_specs: entry.item.layer_specs.map((layer) => ({
              role: layer.role,
              gsm: Number(layer.gsm),
              bf: Number(layer.bf),
              shade: layer.shade,
              reel_size_m: layer.reel_size_m ?? 1,
              rate: layer.rate,
              rct_value: layer.rct_value,
            })),
            markup_pct: entry.item.markup_pct,
            conversion_cost_per_kg: entry.item.conversion_cost_per_kg,
            printing_cost_per_box: entry.result.printing_cost,
            lamination_cost_per_box: entry.result.lamination_cost,
            die_cost_per_box: entry.result.die_cost,
            punching_cost_per_box: entry.result.punching_cost,
            varnish_cost_per_box: entry.result.varnish_cost,
            selected: entry.item.selected !== false,
            negotiation_mode: entry.negotiationMode ?? "none",   // G13
            original_price: basePrice,
            negotiated_price: negotiatedFinalPrice,
            negotiation_reason: entry.negotiationReason ?? "",
          };
        }),
      gst_pct: gstPct,
      transport_charge: transportCharge,
      validity_days: 30,
    };

    saveMutation.mutate(payload);
  };

  if (quoteQuery.isLoading || (Boolean(quoteQuery.data?.current_version_id) && currentVersionQuery.isLoading)) {
    return <div className="text-sm text-muted-foreground">Loading quote...</div>;
  }

  if (quoteQuery.isError || (Boolean(quoteQuery.data?.current_version_id) && currentVersionQuery.isError) || !quoteQuery.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Unable to load quote details.</p>
        <button
          onClick={() => navigate("/quotes")}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to Quotes
        </button>
      </div>
    );
  }

  const currency = user?.currency_code ?? "INR";
  const unitSuffix = dimensionUnit === "inch" ? "in" : dimensionUnit;
  const lengthDisplay = fromMm(item.length_mm, dimensionUnit);
  const widthDisplay = fromMm(item.width_mm, dimensionUnit);
  const heightDisplay = fromMm(item.height_mm, dimensionUnit);

  return (
    <div className="space-y-6">
      {/* G15: back-to-reports banner */}
      {fromReports ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
          >
            ← Back to Reports
          </button>
          <span className="text-muted-foreground">Opened from reports view — editing this quote.</span>
        </div>
      ) : null}

      {/* G14: viewer read-only banner */}
      {isViewer ? (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          You have viewer access. This quote is read-only.
        </div>
      ) : null}

      {/* G11: unsaved nav modal */}
      {showNavModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl w-80 space-y-4">
            <h3 className="font-semibold">Unsaved items</h3>
            <p className="text-sm text-muted-foreground">
              You have unsaved quote items. Leave and discard them?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => setShowNavModal(false)}
              >
                Stay
              </button>
              <button
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground"
                onClick={() => {
                  setShowNavModal(false);
                  pendingNavFnRef.current?.();
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* G12: ply change confirmation modal */}
      {showPlyModal && pendingPly !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl w-80 space-y-4">
            <h3 className="font-semibold">Change Ply to {pendingPly}?</h3>
            <p className="text-sm text-muted-foreground">
              Changing ply will reset all layer specifications (GSM, BF, shade, rate) for the current item.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => { setShowPlyModal(false); setPendingPly(null); }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  const nextPly = pendingPly;
                  const combos = generateFluteCombinations(nextPly);
                  setItem((prev) => ({
                    ...prev,
                    ply: nextPly,
                    combination: combos[0],
                    layer_specs: createLayerSpecsForPly(nextPly),
                  }));
                  setShowPlyModal(false);
                  setPendingPly(null);
                }}
              >
                Change
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* G13: Negotiation dialog */}
      {negotiationItemId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl w-96 space-y-4">
            <h3 className="font-semibold">Negotiate Price</h3>
            {(() => {
              const entry = quoteItems.find((e) => e.item.id === negotiationItemId);
              const basePrice = entry?.result.total_cost_per_box ?? 0;
              return (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Base price: {formatCurrency(basePrice, user?.currency_code ?? "INR")}</p>
                  <label className="text-sm">
                    Mode
                    <select
                      value={negotiationMode}
                      onChange={(e) => setNegotiationMode(e.target.value as typeof negotiationMode)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">No adjustment</option>
                      <option value="discount_pct">Discount %</option>
                      <option value="fixed_price">Fixed price</option>
                    </select>
                  </label>
                  {negotiationMode !== "none" ? (
                    <label className="text-sm">
                      {negotiationMode === "discount_pct" ? "Discount %" : "Fixed price"}
                      <input
                        type="number"
                        value={negotiationValue}
                        onChange={(e) => setNegotiationValue(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      {negotiationMode === "discount_pct" ? (
                        <span className="text-xs text-muted-foreground">
                          Effective: {formatCurrency(basePrice * (1 - negotiationValue / 100), user?.currency_code ?? "INR")}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <label className="text-sm">
                    Reason (optional)
                    <input
                      value={negotiationReason}
                      onChange={(e) => setNegotiationReason(e.target.value)}
                      placeholder="e.g. Loyal customer, bulk order"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              );
            })()}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => { setNegotiationItemId(null); setNegotiationMode("none"); setNegotiationValue(0); setNegotiationReason(""); }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  setQuoteItems((prev) => prev.map((e) => {
                    if (e.item.id !== negotiationItemId) return e;
                    return {
                      ...e,
                      negotiationMode,
                      negotiationValue,
                      negotiationReason,
                    };
                  }));
                  setNegotiationItemId(null);
                  setNegotiationMode("none");
                  setNegotiationValue(0);
                  setNegotiationReason("");
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{quoteQuery.data.quote_no}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            Status: {quoteQuery.data.status}
          </p>
        </div>
        {/* G14: hide save button for viewer */}
        {!isViewer ? (
          <button
            onClick={submitSave}
            disabled={saveMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving..." : "Save Version"}
          </button>
        ) : null}
      </div>

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold">Party</h2>
          <div className="space-y-2">
            <label className="text-sm">Select existing party</label>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select party...</option>
              {(partiesQuery.data ?? []).map((party) => (
                <option key={party.id} value={party.id}>
                  {party.person_name} {party.company_name ? `(${party.company_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium">Or create new party</p>
            <input
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              placeholder="Person name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Company name (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={newPartyEmail}
              onChange={(e) => setNewPartyEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={newPartyMobile}
              onChange={(e) => setNewPartyMobile(e.target.value)}
              placeholder="Mobile (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={newPartyGstin}
              onChange={(e) => setNewPartyGstin(e.target.value.toUpperCase())}
              placeholder="GSTIN (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() =>
                createPartyMutation.mutate({
                  person_name: newPartyName,
                  company_name: newCompanyName || undefined,
                  email: newPartyEmail || undefined,
                  mobile: newPartyMobile || undefined,
                  gstin: newPartyGstin || undefined,
                })
              }
              disabled={createPartyMutation.isPending || !newPartyName.trim()}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
            >
              {createPartyMutation.isPending ? "Creating..." : "Create Party"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold">Calculator Inputs</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Box Type
              <select
                value={boxType}
                onChange={(e) => {
                  const nextType = e.target.value as BoxType;
                  setBoxType(nextType);
                  setItem((prev) => ({
                    ...prev,
                    box_name: nextType === "rsc" ? "RSC Box" : "Sheet Size",
                  }));
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="rsc">RSC Box</option>
                <option value="sheet">Sheet Size</option>
              </select>
            </label>
            <label className="text-sm">
              Dimension Unit
              <select
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as DimensionUnit)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="inch">inch</option>
              </select>
            </label>
            {/* G02: ID/OD mode selector */}
            <label className="text-sm col-span-2">
              Dimension Mode
              <select
                value={dimensionType}
                onChange={(e) => setDimensionType(e.target.value as "inner" | "od")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="inner">Inner Dimensions (ID)</option>
                <option value="od">Outer Dimensions (OD) — auto-converts to ID</option>
              </select>
            </label>
            <label className="text-sm col-span-2">
              Box Name
              <input
                value={item.box_name}
                onChange={(e) => setItem((prev) => ({ ...prev, box_name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <NumberField
              label={`${boxType === "sheet" ? "Sheet Length" : "Length"} (${unitSuffix})`}
              value={lengthDisplay}
              onChange={(v) => setItem((p) => ({ ...p, length_mm: toMm(v, dimensionUnit) }))}
            />
            <NumberField
              label={`${boxType === "sheet" ? "Sheet Width" : "Width"} (${unitSuffix})`}
              value={widthDisplay}
              onChange={(v) => setItem((p) => ({ ...p, width_mm: toMm(v, dimensionUnit) }))}
            />
            {boxType === "rsc" ? (
              <NumberField
                label={`Height (${unitSuffix})`}
                value={heightDisplay}
                onChange={(v) => setItem((p) => ({ ...p, height_mm: toMm(v, dimensionUnit) }))}
              />
            ) : (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3">
                Sheet mode uses only length and width for costing inputs.
              </div>
            )}
            <NumberField label="Quantity" value={item.quantity} onChange={(v) => setItem((p) => ({ ...p, quantity: v }))} />
            <label className="text-sm">
              Ply
              <select
                value={item.ply}
                onChange={(e) => {
                  const nextPly = Number(e.target.value);
                  if (nextPly === item.ply) return;
                  // G12: show confirmation modal before resetting layers
                  setPreviousLayersSnapshot(item.layer_specs);
                  setPendingPly(nextPly);
                  setShowPlyModal(true);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PLY_OPTIONS.map((ply) => (
                  <option key={ply} value={ply}>
                    {ply} Ply
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Combination
              <select
                value={item.combination}
                onChange={(e) => setItem((p) => ({ ...p, combination: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {combinationOptions.map((combo) => (
                  <option key={combo} value={combo}>
                    {combo}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Markup %" value={item.markup_pct} onChange={(v) => setItem((p) => ({ ...p, markup_pct: v }))} />
            <NumberField
              label="Conversion ₹/kg"
              value={item.conversion_cost_per_kg}
              onChange={(v) => setItem((p) => ({ ...p, conversion_cost_per_kg: v }))}
            />
            {/* ── Fixed Add-on Costs Table ───────────────────────── */}
            <div className="col-span-2 rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Cost Item</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Input</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">₹ / box</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* Printing Cost/Box */}
                  <tr>
                    <td className="px-3 py-2 align-middle font-medium">Printing Cost/Box</td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.cost_per_print}
                        onChange={(e) => setItem((p) => ({ ...p, cost_per_print: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle whitespace-nowrap text-xs font-semibold text-primary">
                      {`≈ ${formatCurrency(computed.result.printing_cost, currency)}/box`}
                    </td>
                  </tr>

                  {/* Printing Plate Cost */}
                  <tr>
                    <td className="px-3 py-2 align-middle font-medium">Printing Plate Cost</td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.plate_cost}
                        onChange={(e) => setItem((p) => ({ ...p, plate_cost: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle text-xs text-muted-foreground">—</td>
                  </tr>

                  {/* Printing MOQ */}
                  <tr>
                    <td className="px-3 py-2 align-top font-medium">
                      <div>Printing MOQ</div>
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs font-normal text-foreground">
                        <input
                          type="checkbox"
                          checked={item.moq_enabled}
                          onChange={(e) => setItem((p) => ({ ...p, moq_enabled: e.target.checked }))}
                        />
                        Apply penalty
                      </label>
                      <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">Applies to printing only</p>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.print_moq}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setItem((p) => ({ ...p, print_moq: v, moq_enabled: v > 0 ? true : p.moq_enabled }));
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle text-xs text-muted-foreground">—</td>
                  </tr>

                  {/* Lamination Rate + Custom Area */}
                  <tr>
                    <td className="px-3 py-2 align-top font-medium">
                      <div>Lamination Rate</div>
                      <div className="text-xs font-normal text-muted-foreground">per 100 sq.in</div>
                      <div className="text-[10px] font-normal text-muted-foreground mt-0.5">(L″ × W″ × rate) / 100</div>
                    </td>
                    <td className="px-3 py-2 align-top space-y-3">
                      <input
                        type="number"
                        value={item.lamination_rate}
                        onChange={(e) => setItem((p) => ({ ...p, lamination_rate: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                      {/* Custom lamination area — always visible */}
                      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Custom Lamination Area</p>
                          {(laminationCustomL > 0 || laminationCustomW > 0) && (
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground underline hover:text-foreground"
                              onClick={() => { setLaminationCustomL(0); setLaminationCustomW(0); }}
                            >
                              Reset to sheet size
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Sheet size: {computed.result.sheet_length_mm.toFixed(1)} × {computed.result.sheet_width_mm.toFixed(1)} mm
                          {" — "}leave blank to use full sheet
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Unit</span>
                          <select
                            value={laminationUnit}
                            onChange={(e) => setLaminationUnit(e.target.value as DimensionUnit)}
                            className="rounded border border-input bg-background px-2 py-1 text-xs"
                          >
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="inch">inch</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs">
                            Length ({laminationUnit})
                            <input
                              type="number"
                              value={laminationCustomL || ""}
                              placeholder={`${fromMm(computed.result.sheet_length_mm, laminationUnit).toFixed(1)}`}
                              onChange={(e) => setLaminationCustomL(Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="text-xs">
                            Width ({laminationUnit})
                            <input
                              type="number"
                              value={laminationCustomW || ""}
                              placeholder={`${fromMm(computed.result.sheet_width_mm, laminationUnit).toFixed(1)}`}
                              onChange={(e) => setLaminationCustomW(Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            />
                          </label>
                        </div>
                        {laminationCustomL > 0 && laminationCustomW > 0 ? (
                          <p className="text-[10px] font-medium text-primary">
                            Using {(toMm(laminationCustomL, laminationUnit) / 25.4).toFixed(2)}″ × {(toMm(laminationCustomW, laminationUnit) / 25.4).toFixed(2)}″ for calculation
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top whitespace-nowrap text-xs font-semibold text-primary">
                      {`≈ ${formatCurrency(computed.result.lamination_cost, currency)}/box`}
                    </td>
                  </tr>

                  {/* Die Development Charge */}
                  <tr>
                    <td className="px-3 py-2 align-middle font-medium">Die Development Charge</td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.die_development_charge}
                        onChange={(e) => setItem((p) => ({ ...p, die_development_charge: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle whitespace-nowrap text-xs font-semibold text-primary">
                      {`≈ ${formatCurrency(computed.result.die_cost, currency)}/box`}
                    </td>
                  </tr>

                  {/* Punching */}
                  <tr>
                    <td className="px-3 py-2 align-middle font-medium">Punching ₹/box</td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.punching_cost_per_box}
                        onChange={(e) => setItem((p) => ({ ...p, punching_cost_per_box: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle whitespace-nowrap text-xs font-semibold text-primary">
                      {`≈ ${formatCurrency(computed.result.punching_cost, currency)}/box`}
                    </td>
                  </tr>

                  {/* Varnish */}
                  <tr>
                    <td className="px-3 py-2 align-middle font-medium">Varnish ₹/box</td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="number"
                        value={item.varnish_cost_per_box}
                        onChange={(e) => setItem((p) => ({ ...p, varnish_cost_per_box: Number(e.target.value) }))}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle whitespace-nowrap text-xs font-semibold text-primary">
                      {`≈ ${formatCurrency(computed.result.varnish_cost, currency)}/box`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <NumberField label="GST %" value={gstPct} onChange={setGstPct} />
            <NumberField label="Transport" value={transportCharge} onChange={setTransportCharge} />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={addCurrentItemToQuote}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Add Item To Quote
            </button>
            <label className="text-sm">
              Bulk Import CSV
              <input
                type="file"
                accept=".csv"
                className="mt-1 block text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleBulkImport(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              CSV columns: box_name,length_mm,width_mm,height_mm,quantity,ply,combination,markup_pct,conversion_cost_per_kg,cost_per_print,plate_cost,print_moq,moq_enabled,lamination_rate,die_development_charge,punching_cost_per_box,varnish_cost_per_box
            </p>
          </div>
          {bulkImportError ? <p className="text-sm text-destructive">{bulkImportError}</p> : null}

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Layer Inputs (GSM, BF, Shade, Rate)</h3>
            <LayerInputsTable
              layers={item.layer_specs}
              combination={item.combination}
              bfOptions={BF_OPTIONS}
              shadeOptions={shadeOptions}
              onLayerChange={(layerIndex, patch) => {
                setItem((prev) => ({
                  ...prev,
                  layer_specs: prev.layer_specs.map((layer, idx) => {
                    if (idx !== layerIndex) {
                      return layer;
                    }
                    return {
                      ...layer,
                      ...patch,
                    };
                  }),
                }));
              }}
            />
          </div>

          {/* G01: Optional BCT box dimensions panel */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowBoxDimPanel((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showBoxDimPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {boxType === "sheet" ? "Box dimensions for BCT (optional)" : "BCT override dimensions (optional)"}
            </button>
            {showBoxDimPanel ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <NumberField label={`Box L (${unitSuffix})`} value={fromMm(boxDimLength, dimensionUnit)} onChange={(v) => setBoxDimLength(toMm(v, dimensionUnit))} />
                <NumberField label={`Box W (${unitSuffix})`} value={fromMm(boxDimWidth, dimensionUnit)} onChange={(v) => setBoxDimWidth(toMm(v, dimensionUnit))} />
                <NumberField label={`Box H (${unitSuffix})`} value={fromMm(boxDimHeight, dimensionUnit)} onChange={(v) => setBoxDimHeight(toMm(v, dimensionUnit))} />
              </div>
            ) : null}
          </div>

          {/* G03: Advanced RSC settings (glue flap + deckle allowance) */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedRsc((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showAdvancedRsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Advanced RSC settings
            </button>
            {showAdvancedRsc ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberField label="Glue Flap (mm)" value={glueFlapMm} onChange={setGlueFlapMm} />
                <NumberField label="Deckle Allowance (mm)" value={deckleAllowanceMm} onChange={setDeckleAllowanceMm} />
                <p className="col-span-2 text-xs text-muted-foreground">
                  Defaults: Glue Flap = {GLUE_FLAP_DEFAULTS.RSC} mm, Deckle Allowance = {DECKLE_ALLOWANCE_DEFAULTS.RSC} mm.
                  Changing these affects sheet length/width calculations.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Quote Items</h2>
          <p className="text-sm text-muted-foreground">{quoteItems.length} item(s) added</p>
        </div>
        {quoteItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items added yet. Use Add Item To Quote or Bulk Import CSV.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Include</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Base Cost</th>
                  <th className="px-3 py-2 text-left">Negotiated</th>
                  <th className="px-3 py-2 text-left">Line Total</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quoteItems.map((entry) => (
                  <tr key={entry.item.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={entry.item.selected !== false}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setQuoteItems((prev) => prev.map((candidate) => {
                            if (candidate.item.id !== entry.item.id) return candidate;
                            return {
                              ...candidate,
                              item: {
                                ...candidate.item,
                                selected: checked,
                              },
                            };
                          }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">{entry.item.box_name}</td>
                    <td className="px-3 py-2">{entry.item.quantity}</td>
                    <td className="px-3 py-2">{formatCurrency(entry.result.total_cost_per_box, currency)}</td>
                    <td className="px-3 py-2">
                      {entry.negotiationMode && entry.negotiationMode !== "none" ? (
                        <span className="text-green-700 font-medium">
                          {entry.negotiationMode === "discount_pct"
                            ? formatCurrency(entry.result.total_cost_per_box * (1 - (entry.negotiationValue ?? 0) / 100), currency)
                            : formatCurrency(entry.negotiationValue ?? entry.result.total_cost_per_box, currency)}
                          {" "}
                          <span className="text-xs text-muted-foreground">
                            ({entry.negotiationMode === "discount_pct" ? `-${entry.negotiationValue}%` : "fixed"})
                          </span>
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(
                        (entry.negotiationMode === "discount_pct"
                          ? entry.result.total_cost_per_box * (1 - (entry.negotiationValue ?? 0) / 100)
                          : entry.negotiationMode === "fixed_price"
                          ? (entry.negotiationValue ?? entry.result.total_cost_per_box)
                          : entry.result.total_cost_per_box) * entry.item.quantity,
                        currency
                      )}
                    </td>
                    <td className="px-3 py-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => {
                          setNegotiationItemId(entry.item.id ?? null);
                          setNegotiationMode(entry.negotiationMode ?? "none");
                          setNegotiationValue(entry.negotiationValue ?? 0);
                          setNegotiationReason(entry.negotiationReason ?? "");
                        }}
                      >
                        Negotiate
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => setQuoteItems((prev) => prev.filter((candidate) => candidate.item.id !== entry.item.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold">Live Cost Preview</h2>
        {computed.result.errors.length > 0 ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {computed.result.errors.join(", ")}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Metric label="Sheet Length" value={`${computed.result.sheet_length_mm.toFixed(2)} mm`} />
          <Metric label="Sheet Width" value={`${computed.result.sheet_width_mm.toFixed(2)} mm`} />
          <Metric label="Sheet Weight" value={`${computed.result.sheet_weight_kg.toFixed(4)} kg`} />
          <Metric label="Burst Factor (BF)" value={computed.result.burst_factor.toFixed(2)} />
          <Metric label="ECT" value={computed.result.ect_value.toFixed(2)} />
          <Metric label="BCT" value={computed.result.bct_value > 0 ? computed.result.bct_value.toFixed(2) : "—  (provide box dims to compute)"} />
          <Metric label="Board Thickness" value={`${computed.result.board_thickness_mm.toFixed(2)} mm`} />
          <Metric label="Paper Cost / Box" value={formatCurrency(computed.result.paper_cost, currency)} />
          <Metric label="Printing Cost / Box" value={formatCurrency(computed.result.printing_cost, currency)} />
          <Metric label="Lamination Cost / Box" value={formatCurrency(computed.result.lamination_cost, currency)} />
          <Metric label="Punching Cost / Box" value={formatCurrency(computed.result.punching_cost, currency)} />
          <Metric label="Die Cost / Box" value={formatCurrency(computed.result.die_cost, currency)} />
          <Metric label="Varnish Cost / Box" value={formatCurrency(computed.result.varnish_cost, currency)} />
          <Metric label="Conversion Cost / Box" value={formatCurrency(computed.result.conversion_cost, currency)} />
          <Metric label="Final Cost / Box" value={formatCurrency(computed.result.total_cost_per_box, currency)} />
          <Metric label="Subtotal" value={formatCurrency(computed.totals.subtotal, currency)} />
          <Metric label="GST Amount" value={formatCurrency(computed.totals.gst_amount, currency)} />
          <Metric label="Grand Total" value={formatCurrency(computed.totals.grand_total, currency)} />
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">Paper Required by Layer</h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Layer</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">GSM</th>
                  <th className="px-3 py-2 text-left">BF</th>
                  <th className="px-3 py-2 text-left">Rate</th>
                  <th className="px-3 py-2 text-left">Required (kg)</th>
                  <th className="px-3 py-2 text-left">Layer Paper Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {layerRequirements.map((row) => (
                  <tr key={row.index}>
                    <td className="px-3 py-2">L{row.layerNo}</td>
                    <td className="px-3 py-2 capitalize">{row.layerType}{row.layerType === "flute" ? `-${row.fluteType}` : ""}</td>
                    <td className="px-3 py-2">{row.gsm}</td>
                    <td className="px-3 py-2">{row.bf}</td>
                    <td className="px-3 py-2">{row.rate.toFixed(2)}</td>
                    <td className="px-3 py-2">{row.requiredKg.toFixed(4)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.paperCost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Saved Versions</h2>
        {quoteQuery.data.versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions saved yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {quoteQuery.data.versions.map((version) => {
              const isCurrentVersion = version.id === quoteQuery.data.current_version_id;
              return (
              <div key={version.id} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">V{version.version_number}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(version.created_at).toLocaleDateString()}
                  </span>
                  {isCurrentVersion ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">Current</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatCurrency(version.grand_total, currency)}</span>
                  {/* G08: restore button */}
                  {!isViewer && !isCurrentVersion ? (
                    showRestoreConfirm === version.version_number ? (
                      <div className="flex gap-1">
                        <button
                          className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(version.version_number)}
                        >
                          {restoreMutation.isPending ? "Restoring..." : "Confirm"}
                        </button>
                        <button
                          className="rounded-md border border-border px-2 py-1 text-xs"
                          onClick={() => setShowRestoreConfirm(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        onClick={() => setShowRestoreConfirm(version.version_number)}
                      >
                        Restore
                      </button>
                    )
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">AI Quote Composer</h2>
            <p className="text-sm text-muted-foreground">
              Generate channel-specific drafts from the latest saved quote version, then edit before sending.
            </p>
          </div>
          <div className="flex gap-2 rounded-lg border border-border p-1">
            {([
              { id: "email", label: "Email", icon: Mail },
              { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDraftChannel(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  draftChannel === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {quoteQuery.data.versions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Save at least one quote version before generating AI drafts.
          </div>
        ) : draftChannel === "email" ? (
          <DraftComposerCard
            channel="email"
            quoteNo={quoteQuery.data.quote_no}
            draft={emailDraft}
            templates={emailTemplates}
            aiPending={aiDraftMutation.isPending}
            aiError={draftChannel === "email" ? getAxiosErrorMessage(aiDraftMutation.error, "") : ""}
            onPromptChange={(prompt) => setEmailDraft((current) => ({ ...current, prompt }))}
            onTemplateSelect={(templateId) => applyTemplate("email", templateId)}
            onSubjectChange={(subject) => setEmailDraft((current) => ({ ...current, subject }))}
            onBodyHtmlChange={(bodyHtml) => setEmailDraft((current) => ({
              ...current,
              bodyHtml,
              bodyText: htmlToPlainText(bodyHtml),
              styledPreview: bodyHtml,
            }))}
            onSignatureOverrideChange={(signatureOverride) => setEmailDraft((current) => ({ ...current, signatureOverride }))}
            onGenerate={() => aiDraftMutation.mutate({
              channel: "email",
              prompt: emailDraft.prompt,
              signature_override: emailDraft.signatureOverride,
            })}
          />
        ) : (
          <DraftComposerCard
            channel="whatsapp"
            quoteNo={quoteQuery.data.quote_no}
            draft={whatsAppDraft}
            templates={whatsappTemplates}
            aiPending={aiDraftMutation.isPending}
            aiError={draftChannel === "whatsapp" ? getAxiosErrorMessage(aiDraftMutation.error, "") : ""}
            onPromptChange={(prompt) => setWhatsAppDraft((current) => ({ ...current, prompt }))}
            onTemplateSelect={(templateId) => applyTemplate("whatsapp", templateId)}
            onSubjectChange={() => undefined}
            onBodyHtmlChange={(bodyHtml) => setWhatsAppDraft((current) => ({
              ...current,
              bodyHtml,
              bodyText: htmlToPlainText(bodyHtml),
              styledPreview: bodyHtml,
            }))}
            onSignatureOverrideChange={(signatureOverride) => setWhatsAppDraft((current) => ({ ...current, signatureOverride }))}
            onGenerate={() => {
              // G17: WhatsApp 10-digit mobile validation
              const party = (partiesQuery.data ?? []).find((p) => p.id === selectedPartyId);
              const mobile = party?.mobile?.replace(/\D/g, "") ?? "";
              if (mobile.length !== 10) {
                setSaveError("WhatsApp requires a valid 10-digit mobile number for the selected party.");
                return;
              }
              aiDraftMutation.mutate({
                channel: "whatsapp",
                prompt: whatsAppDraft.prompt,
                signature_override: whatsAppDraft.signatureOverride,
              });
            }}
          />
        )}
      </section>
    </div>
  );
}

function DraftComposerCard({
  channel,
  quoteNo,
  draft,
  templates,
  aiPending,
  aiError,
  onPromptChange,
  onTemplateSelect,
  onSubjectChange,
  onBodyHtmlChange,
  onSignatureOverrideChange,
  onGenerate,
}: {
  channel: DraftChannel;
  quoteNo: string;
  draft: ReturnType<typeof defaultDraftState>;
  templates: MessageTemplate[];
  aiPending: boolean;
  aiError: string;
  onPromptChange: (prompt: string) => void;
  onTemplateSelect: (templateId: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyHtmlChange: (html: string) => void;
  onSignatureOverrideChange: (signature: string) => void;
  onGenerate: () => void;
}) {
  const plainTextPreview = htmlToPlainText(draft.bodyHtml);

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <h3 className="font-medium">Draft Controls</h3>
          <div className="space-y-1">
            <label className="text-sm font-medium">Base template</label>
            <select
              value={draft.templateId}
              onChange={(event) => onTemplateSelect(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Start from scratch</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">AI prompt</label>
            <textarea
              rows={6}
              value={draft.prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={channel === "email"
                ? "Mention tone, table requirements, CTA, and whether to use emoji or pricing emphasis."
                : "Mention tone, emoji use, brevity, CTA, and formatting emphasis for WhatsApp."}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Per-quote signature override</label>
            {channel === "email" ? (
              <RichHtmlEditor
                value={draft.signatureOverride}
                onChange={onSignatureOverrideChange}
                placeholder="Override the default email signature for this quote only."
                minHeightClassName="min-h-[150px]"
              />
            ) : (
              <textarea
                rows={6}
                value={draft.signatureOverride}
                onChange={(event) => onSignatureOverrideChange(event.target.value)}
                placeholder="Regards, Ventura Packagers"
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={aiPending || !draft.prompt.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {aiPending ? "Generating..." : `Generate ${channel === "email" ? "Email" : "WhatsApp"} Draft`}
          </button>
          {aiError ? <p className="text-sm text-destructive">{aiError}</p> : null}
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <h3 className="font-medium">Detected Variables</h3>
          <div className="flex flex-wrap gap-2">
            {draft.variables.length ? draft.variables.map((variable) => (
              <span key={variable} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {`{{${variable}}}`}
              </span>
            )) : <span className="text-xs text-muted-foreground">No merge variables detected yet.</span>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
          <div>
            <h3 className="font-medium">Compose for {quoteNo}</h3>
            <p className="text-sm text-muted-foreground">
              Edit the generated draft before copying it into your delivery workflow.
            </p>
          </div>
          {channel === "email" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <input
                value={draft.subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          <RichHtmlEditor
            value={draft.bodyHtml}
            onChange={onBodyHtmlChange}
            placeholder={channel === "email"
              ? "AI output will appear here, and you can keep editing it."
              : "Styled WhatsApp draft will appear here. The send-safe plain text is shown below."}
            minHeightClassName="min-h-[280px]"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <h3 className="font-medium">Styled Preview</h3>
            <div
              className="min-h-[160px] rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm"
              dangerouslySetInnerHTML={{ __html: draft.styledPreview || draft.bodyHtml || "<p class='text-muted-foreground'>Draft preview will appear here.</p>" }}
            />
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <h3 className="font-medium">{channel === "email" ? "Plain-text fallback" : "Send-safe output"}</h3>
            <div className="min-h-[160px] whitespace-pre-wrap rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm">
              {plainTextPreview || "Plain-text output will appear here."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerInputsTable({
  layers,
  combination,
  bfOptions,
  shadeOptions,
  onLayerChange,
}: {
  layers: LayerSpec[];
  combination: string;
  bfOptions: readonly number[];
  shadeOptions: string[];
  onLayerChange: (layerIndex: number, patch: Partial<LayerSpec>) => void;
}) {
  let fluteIdx = 0;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Layer</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">GSM</th>
            <th className="px-3 py-2 text-left">BF</th>
            <th className="px-3 py-2 text-left">Shade</th>
            <th className="px-3 py-2 text-left">Rate</th>
            <th className="px-3 py-2 text-left">Manual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {layers.map((layer, index) => {
            const fluteType = layer.role === "flute" ? (combination[fluteIdx++] ?? "B") : null;
            return (
              <tr key={`${layer.role}-${index}`}>
                <td className="px-3 py-2">L{index + 1}</td>
                <td className="px-3 py-2 capitalize">{layer.role}{fluteType ? `-${fluteType}` : ""}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={layer.gsm}
                    onChange={(event) => onLayerChange(index, { gsm: Number(event.target.value) })}
                    className="w-20 rounded-md border border-input bg-background px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={layer.bf}
                    onChange={(event) => onLayerChange(index, { bf: Number(event.target.value) })}
                    className="w-20 rounded-md border border-input bg-background px-2 py-1"
                  >
                    {bfOptions.map((bf) => (
                      <option key={bf} value={bf}>
                        {bf}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={layer.shade}
                    onChange={(event) => onLayerChange(index, { shade: event.target.value })}
                    className="w-28 rounded-md border border-input bg-background px-2 py-1"
                  >
                    {shadeOptions.map((shade) => (
                      <option key={shade} value={shade}>
                        {shade}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={layer.rate ?? 0}
                    onChange={(event) => onLayerChange(index, { rate: Number(event.target.value) })}
                    className="w-24 rounded-md border border-input bg-background px-2 py-1"
                    disabled={!layer.price_override}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(layer.price_override)}
                    onChange={(event) => onLayerChange(index, { price_override: event.target.checked })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
