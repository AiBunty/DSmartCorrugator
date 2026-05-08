# System Flow Gap Audit — `02-system-flow-master.md` (All 44 Sections)

> **Audit date:** Generated against current codebase (post email/mobile/GSTIN patch, post F14 MOQ formula patch).
> **Legend:** ✅ Implemented · ⚠️ Partially implemented · ❌ Not implemented · 🔲 V3 — planned, not in scope yet

---

## Summary Counts

| Status | Sections |
|--------|----------|
| ✅ Implemented | 8 |
| ⚠️ Partial | 13 |
| ❌ Not implemented (V1/V2 scope) | 10 |
| 🔲 V3 planned | 13 |

---

## Section-by-Section Audit

### §1 — Onboarding Gate ⚠️ Partial

**What the spec requires:**
- Login/Register gate before any app access.
- First-time company profile completeness gate on the calculator page (blocks Add to Quote if profile incomplete).
- Multi-profile selector at calculator top.

**What is implemented:**
- ✅ `LoginPage.tsx`, `RegisterPage.tsx`, `auth.py` — auth gate works.
- ✅ `GET /settings/company` endpoint exists. Calculator reads company profile.
- ❌ Profile completeness gate on calculator is not confirmed — no `isProfileComplete` check found in `QuoteDetailPage.tsx`.
- ❌ Multi-company profile selector (choosing between profiles) not found.

**Gap:** Profile completeness guard and multi-profile selector are missing.

---

### §2 — Calculator Page Structure ✅ Implemented

**What the spec requires:** Two-panel layout (input left, live preview right), RSC/Sheet tabs, header fields, quote item table, save button.

**What is implemented:**
- ✅ `QuoteDetailPage.tsx` has RSC/Sheet tab, left/right panel structure, quote items table, save.
- ✅ Box name, description, quantity, ply, flute combination, layer table all present.

**Gap:** None at structural level. Individual flows have sub-gaps (see §3–§14).

---

### §3 — Input Fields ⚠️ Partial

**What the spec requires:**
- RSC: L/W/H + glue flap + deckle allowance + max length threshold.
- Sheet: L/W + sheet allowance + optional box dims (§6.3).
- Global: input unit (mm/cm/inches), ID/OD mode, ply, flute combination, conversion cost.
- Layer fields per layer (GSM, BF, shade, rate, RCT, priceOverride).
- Quote header: party, email, mobile, payment terms, delivery days, transport charge, transport remark.

**What is implemented:**
- ✅ RSC dimensions, sheet dimensions, ply, flute, conversion cost present.
- ✅ Quote header fields including email, mobile, GSTIN (recently patched).
- ✅ Layer fields (GSM, BF, shade, rate, RCT, priceOverride) present.
- ✅ Input unit selector (mm/cm/inches) present.
- ❌ `ID/OD` measurement mode selector not found in current UI state.
- ❌ Glue flap, deckle allowance, max length threshold fields not confirmed present.
- ❌ Optional sheet box dims (§6.3 — `boxDimLength`, `boxDimWidth`, `boxDimHeight`) not found.

**Gap:** ID/OD mode, glue flap/deckle/maxLength inputs, and optional sheet box dimensions are missing or unconfirmed.

---

### §4 — Live Preview Computation Model ⚠️ Partial

**What the spec requires:**
- 200ms debounced re-computation on every input change.
- Batch state updates (single tick on ply change).
- `CalculationResult` interface including `costBasis`, `bctBasis` (V2 fields).

**What is implemented:**
- ✅ Client-side formula engine in `frontend/src/lib/formulas/engine.ts`.
- ✅ `cost_basis` is set on items (`cost_basis: boxType` in QuoteDetailPage.tsx line 653).
- ❌ Debounce (200ms) behavior not confirmed in `QuoteDetailPage.tsx`.
- ❌ `bct_basis` field on `CalculationResult` not confirmed present on client side.

**Gap:** Debounce implementation and `bct_basis` from `CalculationResult` need verification.

---

### §5 — RSC Tab Full Flow ✅ Implemented

**What the spec requires:** RSC tab with ply/flute/ID-OD/unit selectors, L/W/H entry, internal `calculateRSC()` sequence F01–F13.

**What is implemented:**
- ✅ RSC tab with L/W/H inputs, ply, flute combination, layer table.
- ✅ Formula engine runs F01–F14+ for RSC path.
- ⚠️ ID/OD adjustment (step 4 in `calculateRSC`) and `maxLengthThreshold` expansion (step 5) are unconfirmed — tied to gaps in §3.

**Gap:** ID/OD and max length threshold calculation path depend on §3 input gaps.

---

### §6 — Sheet Tab Full Flow ⚠️ Partial

**What the spec requires:**
- Sheet tab: L/W (no height), sheet allowance, no ID/OD.
- §6.3: Optional box dims panel (collapsed by default) for BCT + quote display.
- Validation: all-or-nothing rule for box dims (S01); inline error, disable Add to Quote.
- BCT hidden when dims absent; shown when all three present.
- §6.4: API error states for BF price not found, session expired, save failure.

**What is implemented:**
- ✅ Sheet tab with L/W and layer table.
- ✅ `cost_basis: "sheet"` wired on save.
- ❌ Optional box dims panel (`boxDimLength/Width/Height` states) not found.
- ❌ All-or-nothing validation (S01) not implemented.
- ❌ Conditional BCT visibility based on box dims not implemented.
- ⚠️ §6.4 error states: session expiry redirect (401) is partially handled by auth middleware. BF price not found banner and save failure toast not confirmed.

**Gap:** Entire §6.3 optional box dims flow is missing. S01 validation missing. BCT conditional display missing.

---

### §7 — Layer Management ⚠️ Partial

**What the spec requires:**
- Layer table with per-row: GSM, BF (liners)/fluting factor (flutes), shade, rate, RCT, pin/override toggle, copy-down button.
- Ply change → confirmation modal with Cancel / Reset / Undo options + `previousLayersSnapshot`.
- Rate auto-fill from BF prices for non-overridden layers.
- Manual rate override: `priceOverride = true`, BF engine skipped.
- Copy Layer Down button.
- Layer edit dialog.
- Flute factor / height loading from `GET /flute-settings`.

**What is implemented:**
- ✅ Layer table with GSM, BF, shade, rate, RCT, priceOverride per layer.
- ✅ Rate auto-fill from BF prices present.
- ✅ Flute settings loaded from `GET /paper/flute-settings`.
- ❌ Ply change confirmation modal (`previousLayersSnapshot`, Cancel/Reset/Undo dialog) not found.
- ❌ Copy-down button not confirmed.
- ❌ Layer edit dialog (separate dialog per layer) not confirmed.

**Gap:** Ply change confirmation modal and previousLayersSnapshot missing. Copy-down and layer edit dialog unconfirmed.

---

### §8 — Manufacturing Add-On Costs ✅ Implemented

**What the spec requires:**
- Printing (with MOQ + `moqEnabled` toggle), lamination, die, punching, varnish toggles.
- Each toggle drives cost contribution via F14–F18.
- `moqEnabled` stored on `QuoteItem`.

**What is implemented:**
- ✅ All five add-on toggles with correct state variables.
- ✅ Printing fields: `costPerPrint`, `plateCost`, `printMoq`, `moqEnabled`.
- ✅ Backend `f14_printing_cost` fixed to use `moq_enabled` boolean + proportional penalty (recently patched).
- ✅ Lamination, die, punching, varnish fields present.

**Gap:** None for §8. MOQ fix confirmed complete.

---

### §9 — Quantity and Per-Box Output ✅ Implemented

**What the spec requires:** Output panel showing sheet L/W, board thickness, sheet weight, BS, ECT, BCT, paper cost, printing/lamination/conversion cost, total cost/box, total value.

**What is implemented:**
- ✅ All outputs computed via formula engine and displayed in the right panel.
- ⚠️ BCT conditional display (Sheet mode, only when box dims provided) not implemented — tied to §6.3 gap.

**Gap:** BCT conditional display tied to missing §6.3 box dims.

---

### §10 — Party Profile Management ✅ Implemented

**What the spec requires:** Select party, create/edit/delete party with person name, company, mobile, email, GSTIN, address. Party snapshot on quote save.

**What is implemented:**
- ✅ `GET/POST/PATCH /quotes/parties` endpoints present.
- ✅ Frontend party select dropdown, create form with all fields including email, mobile, GSTIN (recently patched).
- ✅ `party_snapshot` column in `QuoteVersion` model.
- ⚠️ PATCH (edit party) and DELETE party UI flows not confirmed in calculator page.
- ⚠️ `party_snapshot` is in the model but whether the save path actually populates it from the live party record needs verification.

**Gap:** Edit/delete party UI confirmation needed. Verify snapshot population at save time.

---

### §11 — Add to Quote Flow ⚠️ Partial

**What the spec requires:**
- Prerequisites: party selected, result ≠ null, BF prices loaded, flute settings loaded, company profile loaded.
- Loading guard (prevents ₹0-cost ghost items).
- Sets `cost_basis`, `bct_basis`, `box_length/width/height`, `group_id: null`.
- Reset form after add (dims, box name, mfg toggles).

**What is implemented:**
- ✅ Party-required check before add.
- ✅ `cost_basis` set on item.
- ✅ Form reset after add (confirmed in prior session).
- ❌ Loading guard for BF prices / flute settings / company profile loads not confirmed.
- ❌ `bct_basis` not set on item build (tied to §6.3 gap).
- ❌ `group_id: null` default not confirmed in add path (though model has `group_id` field).

**Gap:** Loading guard prerequisites and bct_basis wiring missing.

---

### §12 — Quote Item Table Operations ⚠️ Partial

**What the spec requires:**
- Display columns including Box Size (conditional), BCT (conditional), group label.
- Column visibility flags per item.
- Item actions: select, edit (§12.4), negotiate (§13), remove, toggle visibility.
- **§12.5 Grouped Items:** Group Selected button, GroupDialog, group header row, collapse/expand, subtotal from group total.

**What is implemented:**
- ✅ Quote item table with select, edit, remove actions.
- ✅ `negotiation_mode` on QuoteItem model.
- ✅ `group_id` column on `QuoteItem` model.
- ⚠️ Column visibility flags per item (showPaperSpec, showBS, etc.) — model may have these but UI toggle not confirmed.
- ❌ **§12.5 Grouped Items entirely not implemented:** no Group Selected button, no GroupDialog, no group header row, no group subtotal logic.
- ❌ BCT / Box Size conditional columns not implemented (tied to §6.3).

**Gap:** §12.5 grouped items flow is a complete V2 gap. Conditional BCT/BoxSize columns missing.

---

### §13 — Negotiation Flow ⚠️ Partial

**What the spec requires:** Per-item negotiation dialog with modes: none / percentage discount / fixed price. Stores `negotiationMode`, `negotiationValue`, `originalPrice`, `negotiatedPrice`.

**What is implemented:**
- ✅ `negotiation_mode`, `original_price`, `negotiated_price` on `QuoteItem` model.
- ✅ `negotiation_mode: "none"` set at item creation (line 678).
- ❌ Negotiation dialog UI (modal with mode selector, value input, confirm) not confirmed present in `QuoteDetailPage.tsx`.
- ❌ Negotiation value input and recalculation on confirm not confirmed.

**Gap:** Negotiation dialog UI needs to be built or confirmed.

---

### §14 — Save Quote Full Flow ✅ Implemented

**What the spec requires:** Pre-save validation (items > 0, party/company, terms, delivery), localStorage persist of terms, `POST /quotes` with full payload, server-side quoteNo generation, version 1 created, success toast.

**What is implemented:**
- ✅ `POST /quotes/` endpoint with validation exists.
- ✅ QuoteVersion creation with version_number in save path.
- ✅ `quoteNo` generation (sequential Q-YEAR-SEQ pattern).
- ✅ localStorage persistence of payment/delivery terms.
- ⚠️ Pre-save validation on the frontend (items count, terms non-empty) not confirmed in UI — only backend validates.

**Gap:** Frontend pre-save toast errors (before API call) need verification.

---

### §15 — Quote Versioning ⚠️ Partial

**What the spec requires:**
- `quoteVersions` table with `isArchived`, `isLocked` flags.
- `GET /quotes/:id/versions` — version history list.
- `POST /quotes/:id/restore/:versionNumber` — restore old version.
- Version history dialog in UI.
- Re-save creates new version, old versions archived.

**What is implemented:**
- ✅ `QuoteVersion` model with `version_number` exists.
- ✅ `POST /quotes/:id/save` endpoint creates new version (version increment logic present).
- ❌ `GET /quotes/:id/versions` endpoint not found in `quotes.py`.
- ❌ `POST /quotes/:id/restore/:versionNumber` not found.
- ❌ `isArchived` / `isLocked` columns not found on `QuoteVersion` model.
- ❌ Version history dialog in `ReportsPage.tsx` or `QuoteDetailPage.tsx` not confirmed.

**Gap:** Version history endpoint, restore endpoint, isArchived/isLocked flags, and version history UI all missing.

---

### §16 — Edit Quote from Reports ⚠️ Partial

**What the spec requires:**
- Navigate to `/calculator?quoteId={id}&from=reports&state={encoded}`.
- Load single quote via `GET /quotes/:id` (not all quotes).
- Edit mode yellow banner ("Quote Preview Mode").
- "Back to Reports" restores filter state from URL param.
- Optimistic concurrency: `expectedVersionNo` on save, handle 409.

**What is implemented:**
- ✅ `GET /quotes/{quote_id}` endpoint exists and returns versions + items.
- ✅ `ReportsPage.tsx` has a drill-down path.
- ❌ `?quoteId=` URL param handling in `QuoteDetailPage.tsx` not confirmed (no `urlParams.quoteId` found in grep).
- ❌ Edit mode banner not found.
- ❌ `expectedVersionNo` / 409 concurrency handling not implemented.
- ❌ Return-to-reports state restoration not confirmed.

**Gap:** Full edit-from-reports navigation flow is missing from the frontend.

---

### §17 — Send Quote via WhatsApp/Email ⚠️ Partial

**What the spec requires:**
- Message dialog with WhatsApp/Email tabs.
- WhatsApp: generate plain-text message, pre-fill in editable textarea, open `wa.me` link.
- Email: generate HTML body, send via `POST /settings/send-email` or SMTP.
- Column visibility flags applied to message generation.
- Mobile validation before WhatsApp button enabled.
- Grouped items rendered as single commercial line in output.

**What is implemented:**
- ✅ `draftChannel`, `emailDraft`, `whatsAppDraft` state present in `QuoteDetailPage.tsx`.
- ✅ Frontend message dialog UI (draftChannel tabs visible at line 1366/1380).
- ✅ `POST /settings/ai-draft` endpoint exists (AI-assisted drafting).
- ⚠️ `wa.me` link generation: likely present but WhatsApp button validation against 10-digit mobile not confirmed.
- ❌ Actual `POST /api/send-email` send endpoint not found — `settings.py` has `/email` settings GET/PUT but not a send action.
- ❌ Message generation using column visibility flags not confirmed.
- ❌ Grouped items suppression logic in message generator not implemented (tied to §12.5 gap).

**Gap:** Email send API endpoint missing. Mobile validation for WhatsApp not confirmed. Column-aware message generation and grouped items rendering not implemented.

---

### §18 — Bulk Upload via Excel ❌ Not Implemented

**What the spec requires:**
- "Bulk Upload" button + file picker.
- `POST /api/bulk-upload` multipart → returns `{jobId, totalRows}`.
- Poll `GET /api/bulk-upload/jobs/:jobId/status` with progress bar.
- Server-side row-by-row costing with F01–F23 authoritative engine.
- `GET /api/bulk-upload/jobs/:jobId/results` → items appended to quote.
- Per-row error reporting; error CSV download.
- `bulk_upload_jobs` table.

**What is implemented:**
- ❌ No `/bulk-upload` endpoint in `quotes.py` or any backend file.
- ⚠️ A client-side CSV parser (`parseBulkCsv`) exists in `QuoteDetailPage.tsx` line 200 — this is a basic frontend-only CSV import that does not use the spec's server-side async pipeline.

**Gap:** Entire server-side async bulk upload pipeline is missing. Client CSV parser is not equivalent.

---

### §19 — Box Specification History ❌ Not Implemented

**What the spec requires:**
- `box_specifications` and `box_spec_versions` tables.
- `GET /api/box-specifications`, `GET /api/box-specifications/:id/versions`.
- `POST /api/box-specifications/:id/restore/:versionNumber`.

**What is implemented:**
- ❌ No `/box-specifications` endpoint found.
- ❌ No DB tables for box spec history found.

**Gap:** Entirely not implemented.

---

### §20 — Company Profile (Read-only in Calculator) ✅ Implemented

**What the spec requires:** Calculator reads company profile from `GET /api/company-profiles` for quote header, message generation, and profile completeness gate.

**What is implemented:**
- ✅ `GET /settings/company` endpoint exists.
- ✅ Calculator fetches and uses company profile.
- ⚠️ Profile completeness gate not confirmed (see §1 gap).

**Gap:** Profile completeness gate (§1 gap).

---

### §21 — Rate Memory ❌ Not Implemented

**What the spec requires:**
- `rate_memory` table with key = `"{bfValue}|{shade}"`.
- `GET /api/rate-memory` on mount.
- `POST /api/rate-memory` on manual rate override.
- Master Price Update prompt when manual rate differs from BF master.

**What is implemented:**
- ❌ No `/rate-memory` endpoint found.
- ❌ No `rate_memory` table in models.

**Gap:** Entirely not implemented.

---

### §22 — API Endpoints Reference ⚠️ Partial

**What is implemented vs. required:**

| Endpoint | Required | Status |
|----------|---------|--------|
| `GET /api/company-profiles` | §22.1 | ✅ (`/settings/company`) |
| `GET /api/business-defaults` | §22.1 | ✅ (`/settings/defaults`) |
| `GET /api/party-profiles` | §22.1 | ✅ (`/quotes/parties`) |
| `GET /api/paper-bf-prices` | §22.1 | ✅ (`/paper/bf-prices`) |
| `GET /api/shade-premiums` | §22.1 | ✅ (`/paper/shade-premiums`) |
| `GET /api/flute-settings` | §22.1 | ✅ (`/paper/flute-settings`) |
| `GET /api/rate-memory` | §22.1 | ❌ Missing |
| `GET /api/box-specifications` | §22.1 | ❌ Missing |
| `GET /api/quotes/:id` | §22.1 | ✅ |
| `POST /api/quotes` | §22.2 | ✅ |
| `PATCH /api/party-profiles/:id` | §22.2 | ✅ |
| `DELETE /api/party-profiles/:id` | §22.2 | ❌ No DELETE endpoint in quotes.py |
| `POST /api/rate-memory` | §22.2 | ❌ Missing |
| `POST /api/bulk-upload` | §22.2 | ❌ Missing |
| `GET/DELETE /api/quotes/:id/lock` | §22.2 | ❌ Missing |
| `GET /api/quotes/:id/pdf` | §25 | ❌ Missing |
| `POST /api/send-email` | §17 | ❌ Missing |
| `GET /api/paper-pricing-rules` | §22.1 | ❌ Not found |
| `GET /api/settings` (PLY_THICKNESS map) | §22.1 | ⚠️ Partial via `/settings/defaults` |

**Gap:** ~8 V1/V2 endpoints missing. See above table.

---

### §23 — State Machine / Quote Status ✅ Implemented

**What the spec requires:** Statuses: `draft → sent → accepted/rejected`, `expired` from cron, transitions via `PATCH /quotes/:id/status`.

**What is implemented:**
- ✅ `PATCH /quotes/{quote_id}/status` endpoint with valid status set.
- ✅ `REPORT_STATUSES = {"draft", "sent", "accepted", "rejected", "expired", "archived"}` defined.
- ⚠️ Transition guards (e.g., accepted quotes cannot auto-expire) need verification in the PATCH handler.

**Gap:** Transition guards need audit in the status endpoint logic.

---

### §24 — Data Immutability and Snapshot Rules ✅ Implemented

**What the spec requires:** `party_snapshot`, `paper_prices_snapshot`, flute factor snapshots, terms snapshot in `QuoteVersion`. `itemDataSnapshot` JSONB in `QuoteItemVersions`.

**What is implemented:**
- ✅ `party_snapshot`, `paper_prices_snapshot` columns on `QuoteVersion` model.
- ✅ `flute_factor_a/b/c/e/f` snapshotted on `QuoteVersion`.
- ✅ `layer_specs`, `cost_breakdown` JSONB on `QuoteItem`.
- ⚠️ Spec uses `quoteItemVersions.itemDataSnapshot` as a full JSONB blob; current model stores individual fields rather than a single `item_data_snapshot`. This is functionally equivalent but differs from spec convention.
- ⚠️ Save path snapshot population (actually copying party data → `party_snapshot` at save time) needs code-level verification in `POST /quotes/`.

**Gap:** Verify save path actually populates `party_snapshot` from live party at save time.

---

### §25 — PDF / Document Generation ❌ Not Implemented

**What the spec requires:**
- `GET /api/quotes/:id/pdf?type=quote|challan|invoice`.
- Three document types: Quote PDF, Delivery Challan, Tax Invoice.
- Reads from immutable snapshots only.
- Security: logo SSRF prevention, box name HTML escaping.

**What is implemented:**
- ❌ No `/pdf` endpoint.
- ❌ No PDF generation library (WeasyPrint / pdfkit / reportlab) found.

**Gap:** Entirely not implemented. High business-impact gap.

---

### §26 — Quote Expiry Automation ❌ Not Implemented

**What the spec requires:**
- Daily cron at 00:05 UTC: `UPDATE quotes SET status='expired' WHERE status IN ('draft','sent') AND valid_until < CURRENT_DATE`.
- APScheduler or Celery Beat task.
- `valid_until` field on `quoteVersions`, default 30 days.

**What is implemented:**
- ❌ No scheduler (APScheduler or Celery Beat) found.
- ❌ `valid_until` / `validity_days` is on `QuoteVersion` model (`validity_days: int`) — column exists but the expiry sweep job does not.

**Gap:** Cron job / scheduled expiry sweep missing. `validity_days` column exists — only the automation is absent.

---

### §27 — Security Notes ⚠️ Partial

**What the spec requires:**
1. OAuth `state` parameter must be HMAC-signed.
2. WhatsApp `wa.me` mobile validated against `/^[0-9]{10}$/`.
3. Box name HTML-escaped before email body.
4. Logo URL must not be fetched server-side (SSRF).

**What is implemented:**
- ⚠️ GSTIN auto-uppercase added in UI (unrelated but security-adjacent).
- ❌ OAuth state HMAC signing: not confirmed in `auth.py`.
- ❌ WhatsApp mobile validation (10-digit guard before building `wa.me` URL) not confirmed.
- ❌ HTML escaping of box name in email body: email send not yet implemented (§17 gap), so this is also blocked.
- ❌ Logo SSRF prevention: PDF not yet implemented (§25 gap), so also blocked.

**Gap:** Items 1 and 2 are actionable now. Items 3 and 4 depend on unimplemented features.

---

### §28 — Unsaved Data / Navigation Guard ❌ Not Implemented

**What the spec requires:**
- `isDirty` state = any quote items OR non-empty dimension OR non-empty box name.
- `beforeunload` event listener when dirty.
- React Router navigation block with "Stay / Leave Anyway" modal.

**What is implemented:**
- ❌ No `isDirty` state variable found in `QuoteDetailPage.tsx`.
- ❌ No `beforeunload` handler found.
- ❌ No router navigation guard found.

**Gap:** Entirely not implemented. Users can accidentally lose unsaved items.

---

### §29 — Concurrent Edit Handling ❌ Not Implemented

**What the spec requires:**
- `expectedVersionNo` on save → 409 Conflict if version mismatch.
- Conflict resolution dialog (Save Anyway / Reload Latest / Cancel).
- Soft edit lock: `POST/DELETE/GET /quotes/:id/lock`.
- Advisory banner when another user holds lock.
- Lock auto-expires 30 min, Redis key `editlock:{quote_id}`.

**What is implemented:**
- ❌ No `/quotes/:id/lock` endpoints.
- ❌ No `editing_by_user_id` / `editing_locked_at` columns on `Quote` model.
- ❌ No `expectedVersionNo` in save payload.
- ❌ No 409 handling in frontend.

**Gap:** Entirely not implemented.

---

### §30 — RBAC Frontend Role Guard ⚠️ Partial

**What the spec requires:**
- Role from Zustand session store. UI elements hidden (not disabled) per role table.
- Settings nav hidden for non-admin. Save button hidden for viewer. Delete own-only for salesperson.
- Viewer read-only banner.
- Role change detection from `X-User-Role` response header.

**What is implemented:**
- ✅ Zustand auth store exists (confirmed from prior sessions).
- ✅ `team.py` exists (role management backend).
- ❌ Role-based UI hiding in `QuoteDetailPage.tsx` not confirmed — no `role === 'viewer'` checks found in grep.
- ❌ Viewer read-only banner not confirmed.
- ❌ `X-User-Role` header detection and role re-sync on API response not confirmed.

**Gap:** Frontend role-gating UI rules not implemented or verified. Backend role enforcement (salesperson own-only filtering in `GET /quotes`) needs audit.

---

### §31 — Scalability / Background Architecture ❌ Not Implemented

**What the spec requires:**
- Celery with Redis broker for PDF generation, email send, bulk upload processing, quote expiry cron, AI jobs, follow-up sends.
- Redis for sessions, rate limiting, edit locks, BF price caching.
- Celery Beat for cron jobs.

**What is implemented:**
- ✅ Redis client exists (`redis_client.py`) — likely used for sessions.
- ❌ No Celery app, no `celery_app.py`, no tasks module found.
- ❌ No Celery Beat configuration.
- ❌ All async operations (PDF, email, bulk upload) would block the HTTP thread without Celery.

**Gap:** Entire background job queue architecture is missing. This is a pre-requisite for PDF, bulk upload, and email send features.

---

### §32 — Document Storage 🔲 V3 Planned

Full document upload/storage module for PDFs, emails, images. Requires MinIO/S3 integration, `document_files` table, signed URL downloads.

**Status:** Not implemented. MinIO service is in `docker-compose.yml` — infrastructure present, application layer absent.

---

### §33 — AI Extraction + Review Flow 🔲 V3 Planned

AI-powered extraction of costing data from uploaded PDFs/emails/images, with review UI and confidence-tiered field coloring.

**Status:** `POST /settings/ai-draft` endpoint exists (AI text drafting), but full AI costing extraction pipeline is not implemented.

---

### §34 — Common Draft Costing Rows Model 🔲 V3 Planned

Shared `DraftCostingRow` model normalizing all bulk inputs (Excel + AI) into a single pipeline.

**Status:** Not implemented.

---

### §35 — AI Pattern Learning 🔲 V3 Planned

Tenant-local extraction pattern library, anonymized global pool, micro-feedback UI.

**Status:** Not implemented.

---

### §36 — Reports-to-Requote Flow 🔲 V3 Planned

Clone items from accepted/rejected/expired quote into new draft, re-run authoritative costing with current master data.

**Status:** Not implemented.

---

### §37 — Client-Wise Pricing & Negotiation Timeline 🔲 V3 Planned

`ClientPricingPolicy` per party, negotiation event timeline in Reports quote detail, RBAC on adding/accepting rounds.

**Status:** Not implemented. `NegotiationEvent` model not found.

---

### §38 — Price Increase Workflow 🔲 V3 Planned

Recalculate accepted quote items with new BF prices, show Δ%, send price increase notification to client.

**Status:** Not implemented.

---

### §39 — Sales Automation / Follow-Up Engine 🔲 V3 Planned

Celery Beat follow-up task, per-quote automation rules, stop conditions, WA/email channels.

**Status:** Not implemented. Depends on §31 (Celery) gap.

---

### §40 — Rich Editor / Template Management 🔲 V3 Planned

WYSIWYG template editor for follow-up, price increase, acceptance messages. Merge variable insertion, HTML sanitization.

**Status:** `GET/POST/PATCH/DELETE /settings/templates` endpoints exist. Template model scaffolded. But rich editor UI (WYSIWYG) not confirmed built in `SettingsPage.tsx`.

---

### §41 — Specification Download Flow 🔲 V3 Planned

Generate spec sheet PDF (no pricing) per quote item. Celery task. Pricing-stripped output.

**Status:** Not implemented. Depends on §25 (PDF) and §31 (Celery) gaps.

---

### §42 — Job Card Generation 🔲 V3 Planned

Auto-generate job cards when quote item is accepted. `job_cards` table. PDF download.

**Status:** Not implemented.

---

### §43 — QA Report Generation 🔲 V3 Planned

QA checklist per job card, fill measured values, pass/fail, QA report PDF.

**Status:** Not implemented.

---

### §44 — Tally Export / Push 🔲 V3 Planned

Push parties, stock items, and sales vouchers to Tally ERP via XML/HTTP.

**Status:** Not implemented.

---

## Prioritized Gap Backlog (V1/V2 Scope Only)

### Priority 1 — Calculator Correctness Gaps (blocking correct quotes)

| ID | Gap | Section |
|----|-----|---------|
| G01 | Optional sheet box dims panel (`boxDimLength/Width/Height`) + S01 validation + BCT conditional display | §6.3 |
| G02 | ID/OD measurement mode selector + F05 conversion in `calculateRSC` | §3 / §5 |
| G03 | Glue flap, deckle allowance, max length threshold inputs in RSC tab | §3 |
| G04 | Loading guard (prerequisites: BF prices, flute, company profile loaded before Add to Quote) | §11 |
| G05 | `bct_basis` wired through from CalculationResult to item payload | §11 |

### Priority 2 — Save & Version Flows (data integrity)

| ID | Gap | Section |
|----|-----|---------|
| G06 | Verify `party_snapshot` actually populated at save time in `POST /quotes/` | §24 |
| G07 | `isArchived` / `isLocked` columns on QuoteVersion; `GET /quotes/:id/versions` endpoint | §15 |
| G08 | `POST /quotes/:id/restore/:versionNumber` endpoint + version history dialog | §15 |
| G09 | Frontend pre-save toast validation (items count, terms non-empty) | §14 |
| G10 | `DELETE /quotes/parties/:id` endpoint | §22 |

### Priority 3 — UX Safety & Role Guards

| ID | Gap | Section |
|----|-----|---------|
| G11 | `beforeunload` nav guard + React Router block with Stay/Leave modal | §28 |
| G12 | Ply change confirmation modal + previousLayersSnapshot + Undo | §7 |
| G13 | Negotiation dialog UI (mode selector, value input, recalculate on confirm) | §13 |
| G14 | Frontend RBAC UI hiding per role (viewer banner, salesperson own-only, settings nav guard) | §30 |
| G15 | Edit-from-reports `?quoteId=` URL param handling, edit mode banner, return-to-reports state | §16 |

### Priority 4 — Delivery & Infrastructure

| ID | Gap | Section |
|----|-----|---------|
| G16 | Email send API endpoint (`POST /quotes/:id/send-email`) | §17 |
| G17 | WhatsApp mobile 10-digit validation before `wa.me` link | §17 / §27 |
| G18 | Rate memory endpoints (`GET/POST /rate-memory`) + Master Price Update prompt | §21 |
| G19 | Quote expiry cron job (APScheduler or Celery Beat) | §26 |
| G20 | PDF generation endpoint + template (`GET /quotes/:id/pdf`) | §25 |

### Priority 5 — Company Profile & Multi-Profile

| ID | Gap | Section |
|----|-----|---------|
| G21 | Profile completeness gate on calculator (block if no company profile) | §1 |
| G22 | Multi-company profile selector on calculator top | §1 / §20 |

---

## V2 Feature Gaps (full builds, not patches)

| ID | Feature | Section | Notes |
|----|---------|---------|-------|
| V201 | Grouped Quote Items (§12.5) full flow | §12.5 | Group dialog, header row, group subtotal, ungroup, RBAC |
| V202 | Box Specification History | §19 | DB tables + endpoints + UI |
| V203 | Server-side Async Bulk Upload (Excel → items) | §18 | Job queue required; client CSV parser is not compliant |
| V204 | Concurrent Edit Handling (soft lock + 409 versioning) | §29 | `/lock` endpoints + frontend conflict dialog |

---

## V3 Feature Gaps (not in current sprint scope)

Sections §32–§44 + §45: Document Storage, AI Extraction, AI Pattern Learning, Requote Flow, Client Pricing, Price Increase, Follow-Up Engine, Templates (endpoints scaffolded), Spec Sheet PDF, Job Cards, QA Reports, Tally Export, Deal Pipeline.

> MinIO is already in `docker-compose.yml`. Template CRUD endpoints scaffolded in `settings.py`. These two V3 items have head-start infrastructure.


## Suggested Report Tabs
1. Party-wise
- Filters: party, date range, status
- Metrics: quote count, accepted count, rejection count, conversion rate

2. Date-wise
- Daily and monthly views
- Metrics: quote volume and status split

3. Salesperson-wise
- Quotes created, sent, accepted, total accepted value

4. Quote Funnel
- Draft to sent to accepted/rejected path and drop-off

5. Product/Board Mix
- Ply mix, flute mix, common combinations, average quantity

## Immediate Next Implementation Target
- Backend formula branching for Sheet mode and optional box-dim BCT policy.
