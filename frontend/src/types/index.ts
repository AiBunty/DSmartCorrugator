// Central TypeScript type definitions mirroring Python models

export type UserRole = "owner" | "admin" | "manager" | "salesperson" | "viewer";
export type TenantPlan = "starter" | "professional" | "enterprise";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "archived";

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  display_name: string;
  plan: TenantPlan;
  currency_code: string;
  locale: string;
}

// ── Paper Pricing ────────────────────────────────────────────────────────────

export interface PaperBfPrice {
  id: string;
  tenant_id: string;
  bf_value: number;
  base_price: number;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShadePremium {
  id: string;
  tenant_id: string;
  shade_code: string;
  shade_label: string | null;
  premium: number;
  created_at: string;
  updated_at: string;
}

export interface FluteSetting {
  id: string;
  tenant_id: string;
  flute_type: string;
  fluting_factor: number;
  flute_height_mm: number;
  is_active: boolean;
}

export interface PaperPricingRule {
  id: string;
  tenant_id: string;
  rule_order: number;
  low_gsm_limit: number | null;
  high_gsm_limit: number | null;
  low_gsm_adjustment: number;
  high_gsm_adjustment: number;
  market_adjustment: number;
  is_active: boolean;
}

// ── Parties ──────────────────────────────────────────────────────────────────

export interface PartyProfile {
  id: string;
  tenant_id: string;
  person_name: string;
  company_name: string | null;
  mobile: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ── Quote Items ──────────────────────────────────────────────────────────────

export interface LayerSpec {
  role: "liner" | "flute";
  gsm: number;
  bf: number;
  shade: string;
  reel_size_m?: number;
  rate?: number;
  rct_value?: number;
  price_override?: boolean;
}

export interface QuoteItemInput {
  box_name?: string;
  description?: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  dimension_type: "inner" | "outer";
  quantity: number;
  ply: number;
  combination: string;
  layers: LayerSpec[];
  markup_pct: number;
  conversion_cost_per_kg: number;
  printing_cost_per_box?: number;
  lamination_cost_per_box?: number;
  die_cost_per_box?: number;
  punching_cost_per_box?: number;
  varnish_cost_per_box?: number;
  sort_order?: number;
  group_id?: string;
  selected?: boolean;
  negotiation_mode?: "none" | "fixed_price" | "discount_pct";
  negotiated_price?: number;
  negotiation_reason?: string;
}

export interface QuoteItem extends QuoteItemInput {
  id: string;
  version_id: string;
  tenant_id: string;
  sheet_length_mm: number | null;
  sheet_width_mm: number | null;
  sheet_weight_kg: number | null;
  burst_factor: number | null;
  ect_value: number | null;
  bct_value: number | null;
  board_thickness_mm: number | null;
  paper_cost: number | null;
  final_cost_per_box: number | null;
  cost_breakdown: Record<string, number> | null;
}

// ── Quotes ───────────────────────────────────────────────────────────────────

export interface Quote {
  id: string;
  tenant_id: string;
  party_id: string | null;
  party: PartyProfile | null;
  created_by: string | null;
  quote_no: string;
  status: QuoteStatus;
  pipeline_stage: string | null;
  current_version_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteListItem {
  id: string;
  quote_no: string;
  status: QuoteStatus;
  pipeline_stage: string | null;
  party_name: string | null;
  company_name: string | null;
  created_at: string;
}

export interface QuoteDetailVersionSummary {
  id: string;
  version_number: number;
  created_at: string;
  grand_total: number;
  item_count: number;
  is_locked?: boolean;
}

export interface QuoteDetailPayload {
  id: string;
  quote_no: string;
  status: QuoteStatus;
  pipeline_stage: string | null;
  party: {
    id: string;
    person_name: string;
    company_name: string | null;
    email: string | null;
    mobile: string | null;
    gstin: string | null;
  } | null;
  versions: QuoteDetailVersionSummary[];
  current_version_id: string | null;
  has_financial_docs: boolean;
  created_at: string;
}

export interface QuoteVersionDetailPayload {
  id: string;
  version_number: number;
  created_at: string;
  gst_pct: number;
  transport_charge: number;
  subtotal: number;
  grand_total: number;
  is_locked: boolean;
  items: Array<{
    id: string;
    box_name: string | null;
    cost_basis: "rsc" | "sheet";
    length_mm: number;
    width_mm: number;
    height_mm: number;
    quantity: number;
    ply: number;
    combination: string;
    layer_specs: LayerSpec[];
    markup_pct: number;
    conversion_cost_per_kg: number;
    printing_cost_per_box: number;
    lamination_cost_per_box: number;
    die_cost_per_box: number;
    punching_cost_per_box: number;
    varnish_cost_per_box: number;
    selected: boolean;
    negotiation_mode?: "none" | "fixed_price" | "discount_pct";
    negotiated_price?: number | null;
  }>;
}

export interface SaveQuoteRequest {
  party_id: string;
  items: Array<{
    box_name?: string;
    description?: string;
    cost_basis: string;
    length_mm: number;
    width_mm: number;
    height_mm: number;
    dimension_type: string;
    quantity: number;
    ply: number;
    combination: string;
    layer_specs: LayerSpec[];
    markup_pct: number;
    conversion_cost_per_kg: number;
    printing_cost_per_box: number;
    lamination_cost_per_box: number;
    die_cost_per_box: number;
    punching_cost_per_box: number;
    varnish_cost_per_box: number;
    selected: boolean;
    group_id?: string;
    box_length?: number;
    box_width?: number;
    box_height?: number;
    bct_basis?: string;
    negotiation_mode: string;
    original_price: number;
    negotiated_price?: number;
    negotiation_reason?: string;
  }>;
  gst_pct: number;
  transport_charge: number;
  payment_terms?: string;
  delivery_terms?: string;
  other_terms?: string;
  validity_days: number;
  internal_notes?: string;
}

export interface SaveQuoteResponse {
  version_id: string;
  version_number: number;
  grand_total: number;
  subtotal: number;
  gst_amount: number;
  round_off: number;
}

export interface QuoteVersion {
  id: string;
  quote_id: string;
  tenant_id: string;
  version_number: number;
  created_by: string | null;
  gst_pct: number;
  transport_charge: number;
  subtotal: number | null;
  subtotal_with_transport: number | null;
  gst_amount: number | null;
  round_off: number | null;
  grand_total: number | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  other_terms: string | null;
  validity_days: number;
  items: QuoteItem[];
  created_at: string;
}

export interface QuoteDetail extends Quote {
  versions: QuoteVersion[];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface BusinessDefaults {
  id: string;
  tenant_id: string;
  default_markup_pct: number;
  default_conversion_cost_per_kg: number;
  default_gst_pct: number;
  default_currency_code: string;
  default_quantity: number;
  default_validity_days: number;
  quote_number_prefix: string;
  quote_number_next: number;
}

export interface UserQuoteTerm {
  id: string;
  tenant_id: string;
  payment_terms: string | null;
  delivery_terms: string | null;
  other_terms: string | null;
}

export interface CompanyProfile {
  id: string;
  tenant_id: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  logo_s3_key: string | null;
  bank_details: Record<string, string> | null;
}

export interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  use_tls: boolean;
  from_email: string;
  from_name: string;
  is_configured: boolean;
}

export interface AiProviderSettings {
  provider_name: string;
  model_name: string;
  is_enabled: boolean;
  is_configured: boolean;
}

export interface SignatureSettings {
  email_signature_html: string | null;
  whatsapp_signature_text: string | null;
  email_signature_label: string | null;
  whatsapp_signature_label: string | null;
}

export type MessageTemplateChannel = "email" | "whatsapp";

export interface MessageTemplate {
  id: string;
  name: string;
  channel: MessageTemplateChannel;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  variables: string[];
  is_default: boolean;
  source_preset_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplatePreset {
  key: string;
  name: string;
  subject: string | null;
  body_html: string | null;
}

export interface OutputFieldSettings {
  show_paper_cost: boolean;
  show_conversion_cost: boolean;
  show_sheet_weight: boolean;
  show_printing_cost: boolean;
  show_lamination_cost: boolean;
  show_die_cost: boolean;
  show_punching_cost: boolean;
  show_varnish_cost: boolean;
}

export interface AiDraftQuoteContextItem {
  box_name: string | null;
  description: string | null;
  quantity: number;
  ply: number;
  combination: string;
  sheet_length_mm: number;
  sheet_width_mm: number;
  final_cost_per_box: number;
}

export interface AiDraftQuoteContext {
  quote: {
    id: string;
    quote_no: string;
    status: string;
  };
  party: Record<string, string | number | null>;
  company: Record<string, string | number | null>;
  version: {
    id: string;
    version_number: number;
    grand_total: number;
    subtotal: number;
    gst_amount: number;
    validity_days: number;
    payment_terms: string | null;
    delivery_terms: string | null;
    other_terms: string | null;
    items: AiDraftQuoteContextItem[];
  };
}

export interface AiDraftResponse {
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  styled_preview: string | null;
  variables: string[];
  quote_context: AiDraftQuoteContext;
}

// ── Team ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  membership_id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_suspended: boolean;
  joined_at: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  expires_at: string;
  created_at: string;
}

// ── API Response Wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}
