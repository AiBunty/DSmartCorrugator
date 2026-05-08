# 03 — ADMIN FLOW MASTER REFERENCE
## BoxCostPro — Admin Panel, Settings, and Master Data Management

> **Purpose**: Complete reference for all admin/settings panels, their DB tables, API routes, and validation rules.
> A Python/FastAPI backend can implement every admin endpoint from this document without the original source code.

---

## INDEX

1. [Admin Panel Architecture](#1-admin-panel-architecture)
   - [1.1 RBAC Permission Matrix (includes group actions [V2])](#11-architecture-multi-user-role-based-access-control)
2. [Authentication and Access Control](#2-authentication-and-access-control)
3. [Masters Page — Paper Master Tab](#3-masters-page-paper-master-tab)
4. [Masters Page — Flute Settings Tab](#4-masters-page-flute-settings-tab)
5. [Masters Page — Tax & Business Defaults Tab](#5-masters-page-tax--business-defaults-tab)
6. [Masters Page — Quote Terms Tab](#6-masters-page-quote-terms-tab)
7. [Masters Page — Email Settings Tab](#7-masters-page-email-settings-tab)
8. [Company Profile Management](#8-company-profile-management)
9. [User Management](#9-user-management)
10. [Reports Page](#10-reports-page)
11. [DB Schema: Admin-Relevant Tables](#11-db-schema-admin-relevant-tables)
12. [API Endpoints: Admin Routes](#12-api-endpoints-admin-routes)
13. [Cascading Effects of Admin Changes](#13-cascading-effects-of-admin-changes)
14. [Seeding and Initialization](#14-seeding-and-initialization)
15. [Audit Log](#15-audit-log)
    - [15.3 Group events added to audit log [V2]](#153-admin-actions-that-write-to-audit_log)
16. [Platform Admin API Key — Security & Rotation](#16-platform-admin-api-key--security--rotation)
17. [Admin Input Validation Rules](#17-admin-input-validation-rules)
18. [Delete Rules for Master Data](#18-delete-rules-for-master-data)
19. [Multi-Currency & Localization](#19-multi-currency--localization)
20. [Team & Invitation Flow](#20-team--invitation-flow)
21. [Subscription Plans & Feature Gating](#21-subscription-plans--feature-gating)
22. [Grouped Quote Items: Admin, PDF & Output Rules [V2]](#22--grouped-quote-items-admin-pdf--output-rules-v2-addition)
23. [Document/File Storage Governance](#23-documentfile-storage-governance) [V3]
24. [AI Parsing Configuration + Pattern Learning Admin](#24-ai-parsing-configuration--pattern-learning-admin) [V3]
25. [Bulk Import Configuration](#25-bulk-import-configuration) [V3]
26. [Template Management](#26-template-management) [V3]
27. [Email Automation Settings](#27-email-automation-settings) [V3]
28. [Client-Wise Pricing Policies](#28-client-wise-pricing-policies) [V3]
29. [Tally Integration Settings](#29-tally-integration-settings) [V3]
30. [Spec/Job Card/QA Template Controls](#30-specjob-cardqa-template-controls) [V3]
31. [Privacy and Anonymization Rules for Pattern Learning](#31-privacy-and-anonymization-rules-for-pattern-learning) [V3]
32. [Sales Tool Positioning](#32-sales-tool-positioning) [V3]

---

## 1 — ADMIN PANEL ARCHITECTURE

### 1.1 Architecture: Multi-User, Role-Based Access Control

BoxCostPro uses a **5-role RBAC model** built for team-based SaaS deployments globally. Each tenant (business account) can have multiple users, each assigned a single role. This design supports a single owner-operated shop and a large enterprise with regional sales teams equally well.

#### The 5 Roles

| Role | Code | Description |
|------|------|-------------|
| **Owner** | `owner` | Auto-assigned at signup. Full access including billing and account deletion. Exactly one per tenant; cannot be removed or demoted. |
| **Admin** | `admin` | Full settings access + user/team management. Cannot manage billing or delete the account. |
| **Manager** | `manager` | Full quote lifecycle for all team quotes, read-only settings access, full reports. Cannot edit master data or settings. |
| **Salesperson** | `salesperson` | Create, edit, and send their own quotes. View their own reports only. No settings access. |
| **Viewer** | `viewer` | Read-only access to all quotes and reports within the tenant. Cannot create, edit, or delete. |

> **Platform Admin** (separate, `ADMIN_API_KEY`-protected backend role): creates tenants, manages subscriptions, and performs emergency overrides. This is not a user-facing role and never appears in the product UI.

#### Permission Matrix

| Feature Area | Owner | Admin | Manager | Salesperson | Viewer |
|-------------|:-----:|:-----:|:-------:|:-----------:|:------:|
| Create & edit quotes | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Delete quotes | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Send quotes (email / WhatsApp) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bulk upload Excel | ✅ | ✅ | ✅ | ✅ | ❌ |
| View all quotes in tenant | ✅ | ✅ | ✅ | Own only | ✅ |
| View all reports | ✅ | ✅ | ✅ | Own only | ✅ |
| Master data (BF, GSM, flute) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Business defaults & tax | ✅ | ✅ | ❌ | ❌ | ❌ |
| Currency & locale settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Company profile management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Email & SMTP settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Team / user management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Subscription & billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Account deletion | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Create quote item group** [V2] | ✅ | ✅ | ✅ (any) | ✅ (own quotes) | ❌ |
| **Dissolve (ungroup) item group** [V2] | ✅ | ✅ | ✅ (any) | ✅ (own quotes) | ❌ |
| **Edit group name / code** [V2] | ✅ | ✅ | ✅ (any) | ✅ (own quotes) | ❌ |
| **View grouped items** [V2] | ✅ | ✅ | ✅ | ✅ | ✅ (read-only) |
| **Upload / manage documents** [V3] | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Trigger AI extraction** [V3] | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View bulk AI costing jobs** [V3] | ✅ | ✅ | ✅ | Own only | ❌ |
| **Add negotiation round** [V3] | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| **Accept / lock negotiated price** [V3] | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create / manage follow-up rules** [V3] | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| **Create price increase events** [V3] | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Download spec sheet** [V3] | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View / download job card** [V3] | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Push to Tally** [V3] | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Configure AI patterns / learning** [V3] | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage message templates** [V3] | ✅ | ✅ | ✅ | ❌ | ❌ |

### 1.2 Settings Navigation

Settings pages are accessible from the main nav. Role-gated sections shown in brackets:

```
Settings
├── Masters                  ← [Owner, Admin] only
│   ├── Paper Master         ← BF prices, GSM rules, shade premiums
│   ├── Flute Settings       ← Flute factor and height per type
│   ├── Tax & Business       ← GST rate, currency, locale, timezone, markup, column visibility
│   ├── Quote Terms          ← Default payment / delivery terms
│   └── Email Settings       ← SMTP / OAuth2 config
├── Account Profile          ← Company profile + logo  [Owner, Admin]
├── Team & Users             ← Invite members, assign roles, suspend / remove  [Owner, Admin]
├── AI & Extraction          ← [Owner, Admin]  [V3]
│   ├── AI Configuration     ← confidence thresholds, model settings
│   └── Pattern Learning     ← tenant-local patterns, global opt-in
├── Automation               ← [Owner, Admin]  [V3]
│   ├── Email/WA Templates   ← rich editor for message templates
│   └── Follow-Up Rules      ← automation settings
├── Integrations             ← [Owner, Admin]  [V3]
│   └── Tally Settings       ← host, port, protocol
├── Client Pricing           ← [Owner, Admin, Manager]  [V3]
│   └── Client Policies      ← per-party pricing policies
└── Billing & Plans          ← Subscription tier, usage, invoices  [Owner only]
```

The frontend **hides** (not merely disables) menu items the current user's role does not permit. The user's role is embedded in the session payload and returned in the `X-User-Role` response header on every authenticated response.

### 1.3 Multi-Tenant Isolation

Every table row has `tenant_id` (UUID). Tenant isolation is enforced at **two independent layers**:

**Layer 1 — Application layer**: Every query includes `WHERE tenant_id = :current_tenant_id`. The RBAC middleware extracts `tenant_id` from the session and attaches it to the request context. Service functions receive it as an explicit parameter and must always pass it to every query — it is never inferred globally.

**Layer 2 — PostgreSQL Row Level Security (RLS)**: RLS policies are enabled on all tenant-scoped tables as a defence-in-depth safeguard. Even if application code omits a WHERE clause (developer oversight), the database rejects cross-tenant reads and writes.

```sql
-- Enable RLS and create policy on every tenant-scoped table (example shown for paper_bf_prices)
ALTER TABLE paper_bf_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON paper_bf_prices
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- The application sets this at the start of every request (in middleware, before any query):
-- SET LOCAL app.tenant_id = '<tenant-uuid>';
```

> **Developer rule**: All DB connections must call `SET LOCAL app.tenant_id = ?` at the connection level before any query executes. This is enforced in a FastAPI middleware (`set_tenant_context`) that runs after session validation. Never skip it.

---

## 2 — AUTHENTICATION AND ACCESS CONTROL

*Source: `server/auth.ts`, `server/adminAuth.ts`*

### 2.1 Session Auth (User Settings)

All settings endpoints require the user to be authenticated via the session cookie.

Standard middleware applied:
```python
# Every settings route requires:
requireAuth(req, res, next)
# Extracts tenant_id from session, attaches to req
```

### 2.2 Admin API Auth (Platform)

Platform-level admin endpoints (not user-facing settings) use:
```
Authorization: Bearer <ADMIN_API_KEY>
```
Where `ADMIN_API_KEY` is an environment variable. These endpoints allow platform ops to:
- View all tenants
- Create new accounts
- Reset passwords
- Force-seed master data

### 2.3 Protected Routes

User-facing settings routes (`/api/paper-bf-prices`, `/api/shade-premiums`, etc.) are protected by session auth only — no special admin flag needed beyond being the account owner.

Platform admin routes are prefixed `/api/admin/` and require the `ADMIN_API_KEY` bearer token.

### 2.4 Session Store

The Python/FastAPI backend requires a server-side session store. **Redis is the recommended backend** for production.

| Store | When to use | Notes |
|-------|------------|-------|
| **Redis** | Production | Fast, supports TTL natively, horizontal scaling |
| PostgreSQL sessions | Small deployments | Slower; add `sessions` table with `id`, `data JSONB`, `expires_at`; requires periodic cleanup job |
| In-memory | Development only | Lost on server restart; never use in production |

**Session TTL**: 7 days (rolling). Any authenticated request resets the expiry.

**Session fields stored:**
```python
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "email": "user@example.com",
  "role": "owner|admin|manager|salesperson|viewer",
  "display_name": "string",
  "plan": "starter|professional|enterprise",
  "currency_code": "INR",          # tenant's configured currency (ISO 4217)
  "locale": "en-IN",               # tenant's locale for number/date formatting
  "created_at": "ISO timestamp",
  "last_active_at": "ISO timestamp"
}
```

**Expiry handling**: On any request where `last_active_at + 7 days < now`, invalidate the session and return `401`. Frontend redirects to login.

### 2.5 RBAC Middleware (FastAPI)

All routes use dependency injection to enforce role requirements:

```python
from fastapi import Depends, HTTPException
from typing import Tuple

ROLE_HIERARCHY = {
    "owner":       5,
    "admin":       4,
    "manager":     3,
    "salesperson": 2,
    "viewer":      1,
}

def require_role(*allowed_roles: str):
    """Dependency: raises HTTP 403 if session role is not in allowed_roles."""
    async def _check(session: dict = Depends(get_session)) -> dict:
        if session.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{session.get('role')}' is not permitted. Required: {list(allowed_roles)}"
            )
        return session
    return _check

def require_own_or_role(resource_owner_id: str, *elevated_roles: str, session: dict):
    """Allow if resource belongs to current user, OR user has an elevated role."""
    if session["role"] in elevated_roles or resource_owner_id == session["user_id"]:
        return
    raise HTTPException(status_code=403, detail="Access denied: not resource owner and insufficient role")
```

**Applying to routes:**

```python
# Settings endpoints — owner and admin only
@router.post("/api/v1/paper-bf-prices")
async def save_bf_prices(session=Depends(require_role("owner", "admin"))):
    ...

# Quote creation — all roles except viewer
@router.post("/api/v1/quotes")
async def create_quote(session=Depends(require_role("owner", "admin", "manager", "salesperson"))):
    ...

# View a quote — owners/admins/managers see all; salesperson restricted to own;
# viewers see all (read-only)
@router.get("/api/v1/quotes/{quote_id}")
async def get_quote(quote_id: str, session: dict = Depends(get_session)):
    quote = await fetch_quote(quote_id, tenant_id=session["tenant_id"])
    if session["role"] == "salesperson" and quote.created_by != session["user_id"]:
        raise HTTPException(status_code=403, detail="Salesperson can only view their own quotes")
    return quote
```

**Every authenticated response includes RBAC context headers:**
```
X-User-Role: manager
X-Tenant-Id: <uuid>
X-Plan: professional
```

These headers allow the frontend to update its role-aware UI without an extra API call after login.

---

## 3 — MASTERS PAGE — PAPER MASTER TAB

*DB tables: `paper_bf_prices`, `shade_premiums`, `paper_pricing_rules`*

### 3.1 BF Prices Sub-section

**Purpose**: Set the base price (₹/Kg) for each BF (Burst Factor) value. These are the foundation of all paper cost calculations.

**BF Options (fixed list — 12 values):**
```
14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40
```
> **Source truth**: Verified from `paper-setup.tsx` `BF_OPTIONS` constant in the reference implementation.

**DB Table: `paper_bf_prices`**
| Column | Type | Constraint |
|--------|------|-----------|
| id | uuid | PK, gen_random_uuid() |
| tenant_id | uuid | FK, NOT NULL |
| bf | integer | NOT NULL |
| base_price | real | NOT NULL |
| step_increment | real | NOT NULL DEFAULT 0 |
| updated_at | timestamp | auto-managed |

One row per BF value per tenant. Unique constraint: `(tenant_id, bf)`.

`step_increment`: per-tenant BF interpolation slope (₹ per BF unit). When a paper uses a BF not in the standard list, the calculator interpolates the rate from adjacent BF rows using these slope values. See §6 of `01-formula-master.md` for the full algorithm.

**UI Behavior:**
- Grid showing all BF values (14–40) with editable price and step_increment per row.
- "Save All" button saves the entire grid in one call.
- Shows current price per BF and allows inline editing.

**Server-Side Validation (POST /api/paper-bf-prices):**
- `bf` must be one of the 12 canonical values: `[14,16,18,20,22,24,25,28,30,32,35,40]`. Reject any BF not in this list with HTTP 422.
- `base_price` must be `> 0`. Reject zero/negative: *"Base price for BF [X] must be greater than zero."*
- `step_increment` must be `>= 0`.
- All 12 BF rows must be present per save. Partial saves are rejected.

**API Endpoints:**
| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/paper-bf-prices` | GET | — | `[{id, bf, basePrice, stepIncrement, updatedAt}]` |
| `/api/paper-bf-prices` | POST | `[{bf, basePrice, stepIncrement}]` | `{success: true, count: N}` |
| `/api/paper-bf-prices/init-defaults` | POST | — | Seeds 12 rows with default prices and step increments |

**Default BF Prices (used in `init-defaults`):**
```
BF 14 → ₹32.00/Kg   step_increment: 0
BF 16 → ₹34.00/Kg   step_increment: +1
BF 18 → ₹36.00/Kg   step_increment: +1
BF 20 → ₹38.00/Kg   step_increment: +1
BF 22 → ₹42.00/Kg   step_increment: +2
BF 24 → ₹46.00/Kg   step_increment: +2
BF 25 → ₹48.00/Kg   step_increment: +2
BF 28 → ₹54.00/Kg   step_increment: +6
BF 30 → ₹58.00/Kg   step_increment: +2
BF 32 → ₹62.00/Kg   step_increment: +2
BF 35 → ₹70.00/Kg   step_increment: +8
BF 40 → ₹80.00/Kg   step_increment: +10
```
(These are seed defaults. Operators update them to current market rates.)

---

### 3.2 GSM Adjustment Rules Sub-section

**Purpose**: Apply +/- price adjustments to paper rates for very low or very high GSM paper.

**DB Table: `paper_pricing_rules`**
| Column | Type | Default |
|--------|------|---------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| low_gsm_limit | integer | 101 |
| low_gsm_adjustment | real | 1 |
| high_gsm_limit | integer | 201 |
| high_gsm_adjustment | real | 1 |
| market_adjustment | real | 0 |
| paper_setup_completed | boolean | false |

One row per tenant. If no row exists, defaults above are used.

**Meaning of Fields:**
- `lowGsmLimit`: Papers with GSM < this value get `lowGsmAdjustment` added to rate (₹/Kg).
  - e.g., `lowGsmLimit=100`, `lowGsmAdjustment=2`: paper with GSM 80 costs BF_rate + 2
- `highGsmLimit`: Papers with GSM > this value get `highGsmAdjustment` added to rate.
  - e.g., `highGsmLimit=200`, `highGsmAdjustment=1.5`: paper with GSM 250 costs BF_rate + 1.5
- `marketAdjustment`: Global add-on to ALL paper rates regardless of GSM.
  - Range: typically -5 to +10; can be negative (discount).
- `paperSetupCompleted`: A flag used to track whether the user has completed the paper setup wizard.

**How Used in Rate Calculation:**
```python
def calculate_paper_rate(bf, gsm, shade, bf_prices, shade_premiums, rules):
    base_price = bf_prices[bf]
    
    # GSM-based adjustment
    if gsm < rules.low_gsm_limit:
        base_price += rules.low_gsm_adjustment
    elif gsm > rules.high_gsm_limit:
        base_price += rules.high_gsm_adjustment
    
    # Market adjustment  
    base_price += rules.market_adjustment
    
    # Shade premium
    shade_premium = shade_premiums.get(shade, 0)
    base_price += shade_premium
    
    return base_price
```

**Server-Side Validation (POST /api/paper-pricing-rules):**
- `low_gsm_limit` must be `< high_gsm_limit`. If inverted, reject HTTP 422: *"Low GSM limit must be less than High GSM limit."*
- `low_gsm_limit` must be in `[50, 200]`; `high_gsm_limit` must be in `[100, 400]`.
- `market_adjustment` must be in `[-20.0, +20.0]`.

**API Endpoints:**
| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/paper-pricing-rules` | GET | — | `{lowGsmLimit, lowGsmAdjustment, highGsmLimit, highGsmAdjustment, marketAdjustment, paperSetupCompleted}` |
| `/api/paper-pricing-rules` | POST | Any subset of fields | Updated `PaperPricingRules` object |

**Live Preview in Admin UI:**
The Paper Master tab has a live preview calculator:
- User enters a test BF, GSM, and Shade.
- The calculated rate is shown instantly client-side using the formula above.
- Used to validate that the settings produce the expected price.

---

### 3.3 Shade Premiums Sub-section

**Purpose**: Add per-shade surcharges on top of BF base price.

**DB Table: `shade_premiums`**
| Column | Type | Constraint |
|--------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| shade | varchar(100) | NOT NULL |
| premium | real | NOT NULL (₹/Kg) |
| created_at | timestamp | |

One row per shade name per tenant. Unique constraint: `(tenant_id, shade)`.

**Default Paper Shades (11 canonical shades — from `DEFAULT_PAPER_SHADES`, verified against `schema.ts`):**

| Shade Name | Code | Category | Typical Premium |
|-----------|------|----------|-----------------|
| Kraft/Natural | KRA | kraft | 0 (base reference) |
| Testliner | TST | liner | small positive |
| Virgin Kraft Liner | VKL | liner | moderate positive |
| White Kraft Liner | WKL | liner | moderate positive |
| White Top Testliner | WTT | liner | positive |
| Duplex Grey Back (LWC) | LWC | duplex | varies |
| Duplex Grey Back (HWC) | HWC | duplex | varies |
| Semi Chemical Fluting | SCF | flute | 0 or negative |
| Recycled Fluting | RCF | flute | 0 or negative |
| Bagasse (Agro based) | BAG | kraft | small positive |
| Golden Kraft | GOL | kraft | moderate positive |

> **Important**: The `shade` column in `shade_premiums` stores the **full shade name** (e.g., `"Kraft/Natural"`). The code (e.g., `KRA`) is used in the UI and in `QuoteItem` layer objects for brevity; the database always stores the full name string.

**UI Behavior:**
- Table with all shades and editable premium column.
- User can add custom shade names.
- Negative premiums are allowed (e.g., fluting paper at -2 ₹/Kg discount).

**API Endpoints:**
| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/shade-premiums` | GET | — | `[{id, shade, premium}]` |
| `/api/shade-premiums` | POST | `[{shade, premium}]` | `{success: true, count: N}` |
| `/api/shade-premiums/init-defaults` | POST | — | Seeds default shades with 0 premium |

---

## 4 — MASTERS PAGE — FLUTE SETTINGS TAB

*DB table: `flute_settings`*

### 4.1 Purpose

Flute settings define the physical properties of each corrugation type. These values are used in:
- Board thickness calculation
- Layer weight calculation
- ECT calculation

### 4.2 DB Table: `flute_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| flute_type | varchar(10) | 'A', 'B', 'C', 'E', 'F' |
| fluting_factor | real | Corrugation multiplier (> 1.0) |
| flute_height_mm | real | Height of corrugation in mm |
| updated_at | timestamp | |

One row per flute type per tenant. Unique constraint: `(tenant_id, flute_type)`.

### 4.3 Default Values

| Flute Type | Fluting Factor | Flute Height (mm) | Notes |
|-----------|---------------|------------------|-------|
| A | 1.55 | 4.8 | Large, fragile goods |
| B | 1.35 | 2.5 | General purpose; most common |
| C | 1.45 | 3.6 | Shipping cartons |
| E | 1.25 | 1.2 | Fine corrugation; print-friendly |
| F | 1.20 | 0.8 | Micro-flute; cosmetics packaging |

> **Source truth**: These values match the `DEFAULT_FLUTING` constants in `FlutingSettings.tsx` of the reference implementation. The "Reset to Defaults" endpoint must restore exactly these values.

### 4.4 UI Behavior

- Table showing A/B/C/E/F rows with editable `flutingFactor` and `fluteHeightMm`.
- "Reset to Defaults" button restores all values to the table above.
- Changes are saved immediately on blur (no separate save button) OR via an explicit "Save" button — depends on implementation.

### 4.5 How Changes Affect Calculations

When flute settings change:
1. **Board thickness changes** — height values feed into `calculateBoardThicknessFromFlutes`.
2. **Layer weight changes** — fluting factor changes the effective paper length per unit area.
3. **ECT changes** — ECT uses fluting factor per layer.
4. **BCT changes** — BCT depends on ECT and board thickness.

**CRITICAL**: Changes do NOT retroactively affect saved quotes. Saved quotes snapshot the flute values at save time (see §24 of `02-system-flow-master.md`).

**On new quotes**: The next time the calculator loads, it fetches updated flute settings. The live preview immediately reflects the new values.

### 4.6 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/flute-settings` | GET | — | `[{id, fluteType, flutingFactor, fluteHeightMm}]` |
| `/api/flute-settings` | POST | `[{fluteType, flutingFactor, fluteHeightMm}]` | `{success: true}` |
| `/api/flute-settings/reset-defaults` | POST | — | Resets to default values above |

---

## 5 — MASTERS PAGE — TAX & BUSINESS DEFAULTS TAB

*DB table: `business_defaults`*

### 5.1 DB Table: `business_defaults`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK, unique | One row per tenant |
| default_gst_percent | real | 5 | Applied to all new quotes |
| gst_registered | boolean | false | If false: no GST on quotes |
| gst_number | varchar(15) | null | GSTIN for display on documents |
| igst_applicable | boolean | false | Use IGST instead of CGST+SGST |
| round_off_enabled | boolean | false | Round grand total to nearest ₹ |
| show_column_box_size | boolean | true | WhatsApp/email column visibility |
| show_column_board | boolean | true | |
| show_column_flute | boolean | true | |
| show_column_paper | boolean | true | |
| show_column_printing | boolean | true | |
| show_column_lamination | boolean | true | |
| show_column_varnish | boolean | true | |
| show_column_weight | boolean | true | |
| conversion_cost_per_kg | real | 15 | Default box manufacturing cost (₹/Kg) — labour + machine overhead; applied to all new quotes |
| default_markup_percent | real | 15 | Default selling price markup (%) applied to cost price on new quotes |
| currency_code | char(3) | 'INR' | ISO 4217 currency code |
| currency_symbol | varchar(5) | '₹' | Display symbol |
| locale | varchar(20) | 'en-IN' | BCP-47 locale for number/date formatting |
| timezone | varchar(60) | 'Asia/Kolkata' | IANA timezone |
| dimension_unit | varchar(6) | 'mm' | Input unit preference: `mm`, `cm`, or `inch` (engine always receives mm) |

### 5.2 GST Fields

**`defaultGstPercent`** — applied to every new quote. Stored on the quote version at save time. Changing this does NOT affect already-saved quotes.

**`gstRegistered`** — if `false`, the GST block (tax amount line) is hidden from all quote summaries and messages. The `taxAmount` is not added to grand total.

**`igstApplicable`** — for inter-state supplies. When `true`, the quote shows:
- IGST column (single integrated tax rate)
Instead of:
- CGST + SGST columns (split 50/50 within-state)

This is a display flag only; it does not change the tax amount calculation.

**`roundOffEnabled`** — when `true`, `grandTotal` is rounded to the nearest integer:
```python
if round_off_enabled:
    round_off_amount = round(grand_total) - grand_total
    final_grand_total = round(grand_total)
else:
    final_grand_total = grand_total
```

### 5.3 Column Visibility Flags

These 8 boolean flags control whether a given column appears in:
1. Calculator quote item table preview
2. WhatsApp message format
3. Email message format
4. PDF output (if implemented)

They are a **system-default** setting. Per-item overrides (`showPaperSpec`, etc.) take priority for individual items.

### 5.4 UI Behavior

- Form with toggle switches for all boolean fields.
- Numeric input for GST percent (0–28% typical range).
- Text input for GST number (validated: 15-char GSTIN format).
- Numeric input for **Conversion Cost (₹/Kg)** — default box manufacturing cost (labour + overhead); pre-filled on every new quote.
- Numeric input for **Default Markup %** — applied as `sellingPrice = costPrice × (1 + markupPercent / 100)` on new quotes.
- "Save" button — single call to `/api/business-defaults`.
- Changes take effect on next calculator load (React Query cache invalidation).

### 5.5 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/business-defaults` | GET | — | `BusinessDefaults` object |
| `/api/business-defaults` | POST | Any subset of fields | Updated `BusinessDefaults` |

**Response shape:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "defaultGstPercent": 18,
  "gstRegistered": true,
  "igstApplicable": false,
  "roundOffEnabled": true,
  "showColumnBoxSize": true,
  "showColumnBoard": true,
  "showColumnFlute": true,
  "showColumnPaper": true,
  "showColumnPrinting": true,
  "showColumnLamination": false,
  "showColumnVarnish": false,
  "showColumnWeight": true,
  "conversionCostPerKg": 15,
  "defaultMarkupPercent": 15
}
```

---

## 6 — MASTERS PAGE — QUOTE TERMS TAB

*DB table: `user_quote_terms`*

### 6.1 Purpose

Pre-populate the calculator's payment terms and delivery terms fields. Users can override these per quote.

### 6.2 DB Table: `user_quote_terms`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK, unique | One row per tenant |
| validity_days | integer | 7 | Quote validity period |
| default_delivery_text | text | null | e.g., "Within 7–10 working days" |
| default_payment_type | varchar(20) | 'advance' | 'advance' or 'credit' |
| default_credit_days | integer | null | e.g., 30 (only if type = 'credit') |

### 6.3 How Values Flow to Calculator

When the calculator loads, if `paymentTerms` and `deliveryDays` are empty in localStorage:
1. Reads `user_quote_terms` from API (or localStorage fallback).
2. Pre-populates `paymentTerms` and `deliveryDays` inputs.

Once a user edits and saves a quote, those values are written to localStorage and used for subsequent quotes.

### 6.4 Validity Days

`validityDays` determines:
- The "Valid until" date shown on quotes = `createdAt + validityDays`
- When a quote's status should auto-change to `expired` (if the backend has a cron job)

### 6.5 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/quote-terms` | GET | — | `UserQuoteTerms` object |
| `/api/quote-terms` | POST | Subset of fields | Updated `UserQuoteTerms` |

---

## 7 — MASTERS PAGE — EMAIL SETTINGS TAB

*DB table: `user_email_settings`*

### 7.1 Purpose

Configure outbound email delivery. Two supported modes:
- **SMTP**: Any email provider (Gmail SMTP, SendGrid, Mailgun, etc.)
- **OAuth**: Google OAuth (allows sending from Google account without password)

### 7.2 DB Table: `user_email_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK, unique |
| smtp_host | varchar(200) | e.g., `smtp.gmail.com` |
| smtp_port | integer | 587 (TLS) or 465 (SSL) |
| smtp_secure | boolean | true = SSL, false = TLS/STARTTLS |
| smtp_username | varchar(200) | Email address |
| smtp_password | text | **stored encrypted** |
| oauth_provider | varchar(50) | `'google'` |
| oauth_access_token | text | **stored encrypted** |
| oauth_refresh_token | text | **stored encrypted** |
| oauth_token_expires_at | timestamp | For auto-refresh |
| is_verified | boolean | Test email passed |
| is_active | boolean | Active config |
| updated_at | timestamp | |

### 7.3 SMTP Config

UI fields:
- Host (text)
- Port (number; presets: 587, 465, 25)
- Security: "TLS (STARTTLS)" / "SSL"
- SMTP Username (email address)
- SMTP Password (masked input)

**Save**: `POST /api/email-settings` with `{type: "smtp", ...fields}`

**Verify**: `POST /api/email-settings/verify` — sends a test email to the configured username. Sets `is_verified = true` on success.

### 7.4 Password Encryption

Passwords and OAuth tokens are encrypted at rest using AES-256 (or the platform's encryption key). They are never returned in plaintext from the API. A masked placeholder (`"••••••••"`) is shown in the UI; user must re-enter to change.

### 7.5 OAuth Config (Google)

Handled via an OAuth consent flow:
1. User clicks "Connect Google Account".
2. Redirect to `/api/auth/google/email` → Google OAuth consent.
3. Callback at `/api/auth/google/email/callback` → stores access + refresh tokens.
4. `is_verified = true` automatically.

### 7.6 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/email-settings` | GET | — | Email settings (password masked) |
| `/api/email-settings` | POST | `{type, ...smtpFields or oauthFields}` | Updated settings |
| `/api/email-settings/verify` | POST | Optional `{to: email}` | `{success: bool, error?: string}` |
| `/api/auth/google/email` | GET | — | Redirect to Google OAuth |

---

## 8 — COMPANY PROFILE MANAGEMENT

*DB table: `company_profiles`*

### 8.1 Purpose

Company profiles represent the **seller** (the account owner's business). Used in:
- Quote headers (company name, address, GST, logo)
- Legal documents (invoices, purchase orders)
- WhatsApp/email message letterhead

### 8.2 DB Table: `company_profiles`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| company_name | varchar(200) | Required |
| owner_name | varchar(200) | Required |
| email | varchar(200) | Required |
| phone | varchar(20) | Required |
| gst_no | varchar(15) | GSTIN; auto-derives state_code + pan_no |
| pan_no | varchar(10) | Auto-derived from gst_no chars 3-12 |
| state_code | varchar(2) | Auto-derived from gst_no chars 1-2 |
| address1 | text | Street address |
| address2 | text | Area / locality |
| city | varchar(100) | |
| state | varchar(100) | |
| pincode | varchar(10) | |
| country | varchar(100) | Default "India" |
| website | varchar(300) | |
| logo_url | text | Max 100KB recommended |
| payment_terms | text | Default payment terms text |
| delivery_time | text | Default delivery time text |
| is_default | boolean | Default: first profile |
| has_financial_docs | boolean | Lock flag: see §8.5 |
| created_at | timestamp | |
| updated_at | timestamp | |

### 8.3 Creating a Profile

`POST /api/company-profiles`

Required fields: `companyName`, `ownerName`, `email`, `phone`.

First profile created automatically has `isDefault = true`.

### 8.4 GSTIN Auto-Derivation

When `gstNo` is entered:
```python
gstin = "27AABCF1234C1Z5"   # example
state_code = gstin[0:2]     # "27" = Maharashtra
pan_no = gstin[2:12]        # "AABCF1234C"
```
These are auto-populated in the UI when the user types the GSTIN.

### 8.5 Lock Flag: `hasFinancialDocs`

Once the first quote is saved using a company profile, `hasFinancialDocs` is set to `true` **in the same DB transaction as the quote save** — the flag update and the `quote_versions` INSERT are committed atomically so no partial state (quote saved but flag not set, or vice versa) is possible. This locks the following fields from further editing:
- `companyName`
- `gstNo`
- `panNo`
- `stateCode`

These legal fields cannot be changed after financial documents have been issued. Other fields (address, phone, email, logo) remain editable.

### 8.6 Multi-Profile Support

Multiple profiles can exist per tenant (e.g., different GST entities or divisions).

- Only one can be `isDefault = true`.
- The calculator lets users switch profiles per quote.
- `PATCH /api/company-profiles/:id/set-default` — sets new default and unsets old.

### 8.7 Logo Upload

`POST /api/v1/company-profiles/:id/logo`

| Property | Requirement |
|----------|-------------|
| Method | Multipart form (`Content-Type: multipart/form-data`) |
| Max file size | 1 MB server-enforced; client soft-warns at 500 KB |
| Accepted formats | PNG, JPG, WEBP, SVG |
| Storage backend | **S3-compatible object storage** (AWS S3, Google Cloud Storage, Cloudflare R2, or self-hosted MinIO) |
| `logo_url` value | Public HTTPS URL: `https://cdn.example.com/logos/{tenant_id}/{uuid}.png` |
| Old file handling | Previous logo deleted from object storage before new URL is committed |

**Upload flow:**
1. Validate MIME type server-side by reading magic bytes (first 8 bytes), not just trusting `Content-Type`.
2. Generate a new UUID filename for the object.
3. Upload to bucket path `logos/{tenant_id}/{uuid}.{ext}` with `Content-Disposition: inline`.
4. Write public URL to `company_profiles.logo_url`.
5. Delete old object from storage if a previous `logo_url` existed.
6. Return `{"logoUrl": "https://..."}` to client.

> **Never store images as base64 in the database.** Base64 in TEXT columns inflates row size ~33%, bloats backups and WAL, and degrades query performance on any SELECT that fetches the profile row.

### 8.8 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/company-profiles` | GET | — | `CompanyProfile[]` |
| `/api/company-profiles` | POST | Profile fields | Created `CompanyProfile` |
| `/api/company-profiles/:id` | PATCH | Partial fields | Updated `CompanyProfile` |
| `/api/company-profiles/:id` | DELETE | — | `{success: true}` |
| `/api/company-profiles/:id/set-default` | PATCH | — | Sets profile as default |
| `/api/company-profiles/:id/logo` | POST | Multipart | `{logoUrl: string}` |

---

## 9 — USER MANAGEMENT & TEAM

*Tables: `users`, `tenant_memberships`, `invitations`*

### 9.1 User Identity Model

Each person has one **`users`** record identified by email. A user can hold membership in multiple tenants with different roles in each (e.g. an accountant who manages two companies). Each membership is one row in `tenant_memberships(user_id, tenant_id, role)`.

### 9.2 Owner Bootstrap

When a new tenant is provisioned:
1. A `users` row is created (email + bcrypt password).
2. A `tenant_memberships` row is inserted with `role = 'owner'`.
3. A `tenants` row is created (company name, plan, currency defaults).

The Owner role cannot be removed, transferred via API, or demoted. Transfer of ownership requires a platform admin action.

### 9.3 Invitation Flow

See §20 for the complete detailed flow. Summary:

1. Owner or Admin calls `POST /api/v1/team/invite` with `{email, role}`.
2. Backend creates an `invitations` row: random 32-byte hex token (stored as SHA-256 hash), 48-hour TTL.
3. Invitation email sent via the tenant's configured SMTP or SendGrid fallback.
4. Invitee opens link → `GET /api/v1/auth/accept-invite?token=<raw-token>`.
5. If the email address has no `users` record yet → show registration form. If it does → show confirmation.
6. On submit → `POST /api/v1/auth/accept-invite` → creates `users` row (if new) + `tenant_memberships` row.
7. Invitation row deleted; invitee is logged in immediately.

### 9.4 Role Assignment & Changes

`PATCH /api/v1/team/members/:userId/role`  — body: `{"role": "manager"}`

| Rule | Detail |
|------|--------|
| Who can call | Owner and Admin only |
| Cannot change | The Owner's role (immutable) |
| Cannot elevate above own | Admin cannot promote someone to Owner |
| Effect | Updates `tenant_memberships.role`; session is invalidated for the affected user on next request |

### 9.5 Suspending & Removing Members

| Action | Endpoint | Rules |
|--------|----------|-------|
| Suspend | `PATCH /api/v1/team/members/:userId/suspend` | Sets `is_suspended = true`. User receives 401 on next request. Owner/Admin only. Cannot suspend the Owner. |
| Reactivate | `PATCH /api/v1/team/members/:userId/reactivate` | Clears suspension. |
| Remove | `DELETE /api/v1/team/members/:userId` | Deletes `tenant_memberships` row. Quotes created by the user remain (`created_by` FK → `SET NULL`). Cannot remove the Owner. |

### 9.6 Password Management

`POST /api/v1/users/change-password`

Body:
```json
{
  "currentPassword": "...",
  "newPassword": "..."
}
```

Validation:
- `currentPassword` must match stored bcrypt hash
- `newPassword` ≥ 10 characters, at least 1 uppercase letter, 1 digit, 1 special character
- Passwords must not match
- Rate limited: 5 attempts per 15 minutes per user (see §16.5)

### 9.7 Profile Fields

`GET /api/v1/users/profile` — returns name, email, role, locale, timezone (never password hash)

`PATCH /api/v1/users/profile` — update `displayName`, `phone`, `preferredLocale`, `timezone`

> Email changes require a dedicated verification flow: `POST /api/v1/users/change-email` sends OTP to the new address; `POST /api/v1/users/confirm-email-change` completes the change after OTP validation.

### 9.8 API Endpoints

| Endpoint | Method | Required Role | Description |
|----------|--------|--------------|-------------|
| `/api/v1/team/members` | GET | Admin+ | List all tenant members with roles and status |
| `/api/v1/team/invite` | POST | Admin+ | Send invitation email |
| `/api/v1/team/invitations` | GET | Admin+ | List pending invitations |
| `/api/v1/team/invitations/:id` | DELETE | Admin+ | Cancel a pending invitation |
| `/api/v1/team/members/:userId/role` | PATCH | Admin+ | Change a member's role |
| `/api/v1/team/members/:userId/suspend` | PATCH | Admin+ | Suspend a member |
| `/api/v1/team/members/:userId/reactivate` | PATCH | Admin+ | Reactivate a suspended member |
| `/api/v1/team/members/:userId` | DELETE | Admin+ | Remove a member from the tenant |
| `/api/v1/users/profile` | GET | Any | Get current user's own profile |
| `/api/v1/users/profile` | PATCH | Any | Update own display name, locale, timezone |
| `/api/v1/users/change-password` | POST | Any | Change own password |
| `/api/v1/users/change-email` | POST | Any | Initiate email change (sends OTP) |
| `/api/v1/users/confirm-email-change` | POST | Any | Confirm email change via OTP |
| `/api/v1/auth/accept-invite` | GET | Public | Resolve invitation token → redirect |
| `/api/v1/auth/accept-invite` | POST | Public | Complete invitation acceptance |

---

## 10 — REPORTS PAGE

*Route: `/reports`*

### 10.1 Purpose

View, search, filter, and manage all saved quotes.

### 10.2 Available Filters

| Filter | Field | Notes |
|--------|-------|-------|
| Search | Full-text | Matches: partyName, companyName, quoteNo, boxName |
| Party / Company | `partyId` | Dropdown filter |
| Status | `status` | draft / sent / accepted / rejected / expired |
| Date range | `startDate`, `endDate` | Based on `createdAt` |
| Box size | `boxSize` | Text filter on dimensions |

### 10.3 Reports Table Columns

| Column | Notes |
|--------|-------|
| Quote No | Q-2025-XXXX |
| Date | Creation date |
| Party/Company | From partyName or customerCompany |
| Items | Count of quote items |
| Total | Grand total (₹) |
| Status | Colored badge |
| Actions | View, Edit, Send, Delete, Mark as... |

### 10.4 Quote Actions from Reports

| Action | Navigation |
|--------|-----------|
| Edit | `/calculator?quoteId={id}&from=reports&state={encoded}` |
| View | Opens a read-only preview panel |
| Send WhatsApp | Direct WhatsApp link with pre-built message |
| Send Email | Opens email compose modal |
| Delete | `DELETE /api/quotes/:id` (requires confirmation) |
| Mark as Accepted | `PATCH /api/quotes/:id/status` — `{status: "accepted"}` |
| Mark as Rejected | `PATCH /api/quotes/:id/status` — `{status: "rejected"}` |
| Mark as Sent | `PATCH /api/quotes/:id/status` — `{status: "sent"}` |

### 10.5 Filter State Preservation

When the user navigates from Reports → Calculator (edit) → back:
- The filter state is encoded in the URL: `/calculator?...&state=base64(filterState)`
- `filterState` includes: `{ tab, partyFilter, searchText, startDate, endDate, page }`
- On "Back to Reports", the encoded state is decoded and the Reports page restores the exact filter view

### 10.6 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|---------|
| `/api/quotes` | GET | query params | `Quote[]` with pagination |
| `/api/quotes?include=items` | GET | — | `QuoteWithItems[]` |
| `/api/quotes/:id` | GET | — | Single `QuoteWithItems` |
| `/api/quotes/:id` | DELETE | — | `{success: true}` |
| `/api/quotes/:id/status` | PATCH | `{status}` | Updated quote |

### 10.7 Pagination

All list endpoints that can return more than 25 rows use **offset-based pagination**.

**Strategy:** offset-based (simple, no cursor complexity needed at expected scale)

**Request parameters:**

| Param | Type | Default | Max | Notes |
|-------|------|---------|-----|-------|
| `page` | integer | 1 | — | 1-indexed |
| `pageSize` | integer | 25 | 100 | clamped server-side |

**Response envelope (all paginated endpoints):**

```json
{
  "data": [...],
  "total": 142,
  "page": 1,
  "pageSize": 25,
  "totalPages": 6
}
```

**Endpoints that paginate:** `/api/quotes`, `/api/admin/tenants` (platform), report data endpoints.

**DB indexes supporting pagination queries:**

```sql
-- Full-text search on quotes (tenant-scoped)
CREATE INDEX idx_quotes_tenant_status ON quotes(tenant_id, status);
CREATE INDEX idx_quotes_tenant_created ON quotes(tenant_id, created_at DESC);

-- GIN index for party name search (if using pg_trgm)
CREATE INDEX idx_quotes_party_trgm ON quotes USING GIN (party_name gin_trgm_ops);
```

> **Note:** Add `pg_trgm` extension once (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) to enable trigram GIN index.

---

## 11 — DB SCHEMA: ADMIN-RELEVANT TABLES

### Complete Table List (Admin/Settings scope)

```sql
-- Paper pricing foundation
CREATE TABLE paper_bf_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bf INTEGER NOT NULL,
    base_price REAL NOT NULL,
    step_increment REAL NOT NULL DEFAULT 0,   -- BF interpolation slope (₹/BF unit); per-tenant override
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, bf)
);

CREATE TABLE shade_premiums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    shade VARCHAR(100) NOT NULL,
    premium REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, shade)
);

CREATE TABLE paper_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    low_gsm_limit INTEGER NOT NULL DEFAULT 101,
    low_gsm_adjustment REAL NOT NULL DEFAULT 1,
    high_gsm_limit INTEGER NOT NULL DEFAULT 201,
    high_gsm_adjustment REAL NOT NULL DEFAULT 1,
    market_adjustment REAL NOT NULL DEFAULT 0,
    paper_setup_completed BOOLEAN NOT NULL DEFAULT false
);

-- Flute configuration
CREATE TABLE flute_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    flute_type VARCHAR(10) NOT NULL,
    fluting_factor REAL NOT NULL,
    flute_height_mm REAL NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, flute_type)
);

-- Business defaults
CREATE TABLE business_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    default_gst_percent REAL NOT NULL DEFAULT 5,
    gst_registered BOOLEAN NOT NULL DEFAULT false,
    gst_number VARCHAR(15),
    igst_applicable BOOLEAN NOT NULL DEFAULT false,
    round_off_enabled BOOLEAN NOT NULL DEFAULT false,
    show_column_box_size BOOLEAN NOT NULL DEFAULT true,
    show_column_board BOOLEAN NOT NULL DEFAULT true,
    show_column_flute BOOLEAN NOT NULL DEFAULT true,
    show_column_paper BOOLEAN NOT NULL DEFAULT true,
    show_column_printing BOOLEAN NOT NULL DEFAULT true,
    show_column_lamination BOOLEAN NOT NULL DEFAULT true,
    show_column_varnish BOOLEAN NOT NULL DEFAULT true,
    show_column_weight BOOLEAN NOT NULL DEFAULT true,
    conversion_cost_per_kg REAL NOT NULL DEFAULT 15,       -- default box manufacturing cost (LCU/Kg)
    default_markup_percent REAL NOT NULL DEFAULT 15,        -- default selling price markup %
    -- Localisation & currency (world-class, globally scalable)
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',           -- ISO 4217: INR, USD, EUR, GBP, AED, SGD, ...
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '\u20b9',       -- display symbol: ₹, $, €, £, AED, ...
    locale VARCHAR(20) NOT NULL DEFAULT 'en-IN',            -- BCP-47 locale for number/date formatting
    timezone VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',   -- IANA timezone for expiry/cron calculations
    dimension_unit VARCHAR(6) NOT NULL DEFAULT 'mm'         -- input unit preference: mm | cm | inch
        CHECK (dimension_unit IN ('mm', 'cm', 'inch'))
);

-- Quote terms defaults
CREATE TABLE user_quote_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    validity_days INTEGER NOT NULL DEFAULT 7,
    default_delivery_text TEXT,
    default_payment_type VARCHAR(20) NOT NULL DEFAULT 'advance',
    default_credit_days INTEGER
);

-- Email settings
CREATE TABLE user_email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    smtp_host VARCHAR(200),
    smtp_port INTEGER,
    smtp_secure BOOLEAN,
    smtp_username VARCHAR(200),
    smtp_password TEXT,                    -- AES-256 encrypted
    oauth_provider VARCHAR(50),
    oauth_access_token TEXT,               -- AES-256 encrypted
    oauth_refresh_token TEXT,              -- AES-256 encrypted
    oauth_token_expires_at TIMESTAMP,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company profile
CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    gst_no VARCHAR(15),
    pan_no VARCHAR(10),
    state_code VARCHAR(2),
    address1 TEXT,
    address2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    website VARCHAR(300),
    logo_url TEXT,
    payment_terms TEXT,
    delivery_time TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    has_financial_docs BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate memory
CREATE TABLE rate_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bf_value INTEGER NOT NULL,
    shade VARCHAR(100) NOT NULL,
    rate REAL NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, bf_value, shade)
);

-- App settings (plyThicknessMap overrides)
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    app_title VARCHAR(200),
    ply_thickness_map JSONB         -- e.g. {"3": 3.5, "5": 5.0, "7": 7.0}
);

-- Bulk upload jobs (server-side async processing)
CREATE TABLE bulk_upload_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | processing | complete | failed
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    result_jsonb JSONB,   -- array of QuoteItem on completion
    errors_jsonb JSONB,   -- array of {rowNumber, boxName, errorCode, message}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_bulk_jobs_tenant_created ON bulk_upload_jobs (tenant_id, created_at DESC);
CREATE INDEX idx_bulk_jobs_expires ON bulk_upload_jobs (expires_at) WHERE status = 'complete';

-- =========================================================
-- MULTI-USER & RBAC TABLES
-- =========================================================

-- Global user identity (email is globally unique across all tenants)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                    -- bcrypt, cost factor ≥ 12
    display_name VARCHAR(200) NOT NULL DEFAULT '',
    phone VARCHAR(20),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    is_globally_suspended BOOLEAN NOT NULL DEFAULT false,  -- platform-level ban
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- Links a user to a tenant with a role
CREATE TABLE tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','manager','salesperson','viewer')),
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    preferred_locale VARCHAR(20),                   -- overrides tenant locale for this user
    timezone VARCHAR(60),                           -- overrides tenant timezone for this user
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant ON tenant_memberships (tenant_id);
CREATE INDEX idx_memberships_user ON tenant_memberships (user_id);

-- Pending invitations (token stored as SHA-256 hash, never raw)
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    email VARCHAR(254) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','manager','salesperson','viewer')),
    token_hash TEXT NOT NULL UNIQUE,               -- SHA-256 of raw token sent in email link
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- now() + 48 hours
    accepted_at TIMESTAMP WITH TIME ZONE,          -- set when invite is accepted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)                       -- one pending invite per email per tenant
);

CREATE INDEX idx_invitations_token ON invitations (token_hash);
CREATE INDEX idx_invitations_expires ON invitations (expires_at) WHERE accepted_at IS NULL;

-- =========================================================
-- SOFT-DELETE SUPPORT
-- =========================================================
-- The following tables support soft deletes (records are marked deleted, not physically removed).
-- All queries must add: WHERE deleted_at IS NULL
-- Hard delete (GDPR erasure) is handled via a platform admin action that removes the row.

-- Add deleted_at to quotes (if not already present)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_quotes_deleted ON quotes (tenant_id) WHERE deleted_at IS NULL;

-- Add soft-delete to party_profiles
ALTER TABLE party_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_party_active ON party_profiles (tenant_id) WHERE deleted_at IS NULL;

-- =========================================================
-- V3 DB TABLES
-- =========================================================

-- [V3 Addition] Document repository — stores metadata for spec files, client briefs, vendor sheets
CREATE TABLE document_files (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    category            VARCHAR(50) NOT NULL DEFAULT 'specification'
                            CHECK (category IN ('specification','sample_approval','client_brief','vendor_sheet','other')),
    original_filename   VARCHAR(500) NOT NULL,
    storage_key         TEXT NOT NULL UNIQUE,       -- S3 / object-store object key
    mime_type           VARCHAR(100) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    linked_party_id     UUID REFERENCES party_profiles(id) ON DELETE SET NULL,
    linked_quote_id     UUID REFERENCES quotes(id) ON DELETE SET NULL,
    checksum_sha256     TEXT,
    deleted_at          TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_doc_files_tenant ON document_files (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_files_party  ON document_files (linked_party_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_files_quote  ON document_files (linked_quote_id) WHERE deleted_at IS NULL;

-- [V3 Addition] Rich HTML message templates — defined before follow_up_automations (FK dependency)
CREATE TABLE message_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    channel         VARCHAR(20) NOT NULL DEFAULT 'email'
                        CHECK (channel IN ('email','whatsapp','both')),
    subject         VARCHAR(500),           -- email channel only
    body_html       TEXT NOT NULL,          -- bleach-sanitized HTML (see §26.6)
    variables       JSONB,                  -- {{variable}} names found in body
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_msg_templates_tenant ON message_templates (tenant_id);
CREATE UNIQUE INDEX idx_msg_templates_default ON message_templates (tenant_id, channel) WHERE is_default = true;

-- [V3 Addition] Draft costing rows — shared pipeline for Excel bulk and AI bulk sources
CREATE TABLE draft_costing_rows (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bulk_job_id             UUID REFERENCES bulk_upload_jobs(id) ON DELETE CASCADE,
    source                  VARCHAR(30) NOT NULL
                                CHECK (source IN ('excel','ai_pdf','ai_email','ai_screenshot')),
    source_file_key         TEXT,           -- document_files.storage_key of the source document
    raw_input               JSONB NOT NULL,
    normalized_input        JSONB,
    costing_output          JSONB,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','normalizing','costing','review','approved','rejected')),
    extraction_confidence   NUMERIC(4,3),   -- NULL for Excel (deterministic); 0.000–1.000 for AI
    review_notes            TEXT,
    promoted_item_id        UUID REFERENCES quote_items(id) ON DELETE SET NULL,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_draft_rows_tenant_status ON draft_costing_rows (tenant_id, status);
CREATE INDEX idx_draft_rows_job ON draft_costing_rows (bulk_job_id);

-- [V3 Addition] Immutable ledger of negotiation rounds per quote item
CREATE TABLE negotiation_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    quote_item_id   UUID NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
    round_number    SMALLINT NOT NULL,
    offered_price   NUMERIC(12,2) NOT NULL,
    client_response VARCHAR(20) CHECK (client_response IN ('accepted','countered','rejected','pending')),
    counter_price   NUMERIC(12,2),
    notes           TEXT,
    recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_neg_events_item  ON negotiation_events (quote_item_id);
CREATE INDEX idx_neg_events_quote ON negotiation_events (quote_id);

-- [V3 Addition] Per-party pricing policy overrides
CREATE TABLE client_pricing_policies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    party_id                UUID NOT NULL REFERENCES party_profiles(id) ON DELETE CASCADE,
    default_markup_percent  NUMERIC(5,2),
    discount_percent        NUMERIC(5,2) NOT NULL DEFAULT 0,
    price_floor_enabled     BOOLEAN NOT NULL DEFAULT false,
    price_floor_per_box     NUMERIC(12,4),
    notes                   TEXT,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, party_id)
);

CREATE INDEX idx_ccp_party ON client_pricing_policies (party_id);

-- [V3 Addition] Batch price increase events (requote + notify workflow)
CREATE TABLE price_increase_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    increase_percent        NUMERIC(5,2),
    affected_party_ids      UUID[],
    affected_quote_ids      UUID[],
    preview_snapshot        JSONB,
    status                  VARCHAR(25) NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','sent','partially_accepted','closed')),
    notification_sent_at    TIMESTAMP WITH TIME ZONE,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pie_tenant_status ON price_increase_events (tenant_id, status);

-- [V3 Addition] Follow-up automation rules
CREATE TABLE follow_up_automations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    trigger_type    VARCHAR(30) NOT NULL
                        CHECK (trigger_type IN ('quote_sent','quote_opened','no_response','custom_date')),
    delay_days      SMALLINT NOT NULL DEFAULT 3,
    max_follow_ups  SMALLINT NOT NULL DEFAULT 3,
    channel         VARCHAR(20) NOT NULL DEFAULT 'email'
                        CHECK (channel IN ('email','whatsapp','both')),
    template_id     UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    scope           VARCHAR(20) NOT NULL DEFAULT 'per_quote'
                        CHECK (scope IN ('per_quote','per_party','global')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    stop_on_reply   BOOLEAN NOT NULL DEFAULT true,
    stop_on_accept  BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fua_tenant_active ON follow_up_automations (tenant_id) WHERE is_active = true;

-- [V3 Addition] Log of each follow-up message sent
CREATE TABLE follow_up_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    automation_id       UUID REFERENCES follow_up_automations(id) ON DELETE SET NULL,
    quote_id            UUID REFERENCES quotes(id) ON DELETE SET NULL,
    party_id            UUID REFERENCES party_profiles(id) ON DELETE SET NULL,
    channel             VARCHAR(20) NOT NULL,
    follow_up_number    SMALLINT NOT NULL,
    message_snapshot    TEXT,
    sent_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_status     VARCHAR(20) NOT NULL DEFAULT 'sent'
                            CHECK (delivery_status IN ('sent','delivered','failed','bounced'))
);

CREATE INDEX idx_flog_quote  ON follow_up_logs (quote_id);
CREATE INDEX idx_flog_tenant ON follow_up_logs (tenant_id, sent_at DESC);

-- [V3 Addition] Generated job cards (production floor PDFs)
CREATE TABLE job_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    quote_item_id   UUID REFERENCES quote_items(id) ON DELETE SET NULL,
    version_number  SMALLINT NOT NULL DEFAULT 1,
    storage_key     TEXT NOT NULL,
    generated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_cards_quote ON job_cards (quote_id);

-- [V3 Addition] Generated QA inspection reports
CREATE TABLE qa_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    quote_item_id   UUID REFERENCES quote_items(id) ON DELETE SET NULL,
    version_number  SMALLINT NOT NULL DEFAULT 1,
    storage_key     TEXT NOT NULL,
    generated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_qa_reports_quote ON qa_reports (quote_id);

-- [V3 Addition] Per-tenant Tally ERP integration configuration
CREATE TABLE tally_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    host            VARCHAR(253) NOT NULL DEFAULT 'localhost',
    port            INTEGER NOT NULL DEFAULT 9000,
    protocol        VARCHAR(5) NOT NULL DEFAULT 'http' CHECK (protocol IN ('http','https')),
    company_name    VARCHAR(255),
    is_enabled      BOOLEAN NOT NULL DEFAULT false,
    last_sync_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [V3 Addition] Audit log for all Tally push operations
CREATE TABLE tally_push_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    push_type       VARCHAR(30) NOT NULL
                        CHECK (push_type IN ('party','product','invoice','ledger')),
    reference_id    UUID,
    tally_name      TEXT,
    request_xml     TEXT,
    response_body   TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','success','failed')),
    pushed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    pushed_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tally_log_tenant ON tally_push_log (tenant_id, pushed_at DESC);
CREATE INDEX idx_tally_log_ref    ON tally_push_log (reference_id);

-- [V3 Addition] Per-tenant AI extraction configuration (1-row per tenant)
CREATE TABLE ai_config (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    confidence_auto_accept  NUMERIC(4,3) NOT NULL DEFAULT 0.850,
    confidence_review_min   NUMERIC(4,3) NOT NULL DEFAULT 0.600,
    model_provider          VARCHAR(50) NOT NULL DEFAULT 'openai',
    model_name              VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    global_pattern_opt_in   BOOLEAN NOT NULL DEFAULT false,
    max_rows_per_job        SMALLINT NOT NULL DEFAULT 500,
    draft_retention_days    SMALLINT NOT NULL DEFAULT 30,
    updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [V3 Addition] Extraction pattern library (tenant-local + anonymized global pool)
CREATE TABLE ai_pattern_library (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = global / anonymized
    field_name      VARCHAR(100) NOT NULL,
    input_pattern   TEXT NOT NULL,
    canonical_value TEXT NOT NULL,
    confidence      NUMERIC(4,3) NOT NULL,
    source_count    INTEGER NOT NULL DEFAULT 1,
    is_global       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_patterns_field  ON ai_pattern_library (field_name, is_global);
CREATE INDEX idx_ai_patterns_tenant ON ai_pattern_library (tenant_id) WHERE tenant_id IS NOT NULL;

---

## 12 — API ENDPOINTS: ADMIN ROUTES

### 12.1 Complete Admin Endpoint List

> **API versioning**: All user-facing endpoints are prefixed `/api/v1/`. Legacy unversioned routes (`/api/...`) remain active during the migration window but are deprecated. New development must use `/api/v1/` only.

| Endpoint | Method | Required Role | Description |
|----------|--------|------|-------------|
| `/api/v1/paper-bf-prices` | GET | Admin+ | Get all BF prices |
| `/api/v1/paper-bf-prices` | POST | Admin+ | Save/update all BF prices |
| `/api/v1/paper-bf-prices/init-defaults` | POST | Admin+ | Seed default prices |
| `/api/v1/shade-premiums` | GET | Admin+ | Get all shade premiums |
| `/api/v1/shade-premiums` | POST | Admin+ | Save/update all shade premiums |
| `/api/v1/shade-premiums/init-defaults` | POST | Admin+ | Seed default shades |
| `/api/v1/paper-pricing-rules` | GET | Admin+ | Get GSM rules |
| `/api/v1/paper-pricing-rules` | POST | Admin+ | Update GSM rules |
| `/api/v1/flute-settings` | GET | Admin+ | Get flute config |
| `/api/v1/flute-settings` | POST | Admin+ | Update flute config |
| `/api/v1/flute-settings/reset-defaults` | POST | Admin+ | Reset to defaults |
| `/api/v1/business-defaults` | GET | Admin+ | Get business defaults (incl. currency, locale) |
| `/api/v1/business-defaults` | POST | Admin+ | Update business defaults |
| `/api/v1/quote-terms` | GET | Admin+ | Get quote terms |
| `/api/v1/quote-terms` | POST | Admin+ | Update quote terms |
| `/api/v1/email-settings` | GET | Admin+ | Get email settings (masked) |
| `/api/v1/email-settings` | POST | Admin+ | Save SMTP or OAuth2 config |
| `/api/v1/email-settings/verify` | POST | Admin+ | Send test email |
| `/api/v1/company-profiles` | GET | Admin+ | Get all company profiles |
| `/api/v1/company-profiles` | POST | Admin+ | Create company profile |
| `/api/v1/company-profiles/:id` | PATCH | Admin+ | Update company profile |
| `/api/v1/company-profiles/:id` | DELETE | Admin+ | Delete company profile |
| `/api/v1/company-profiles/:id/set-default` | PATCH | Admin+ | Set as default |
| `/api/v1/company-profiles/:id/logo` | POST | Admin+ | Upload logo (to object storage) |
| `/api/v1/rate-memory` | GET | Any | Get rate memory cache |
| `/api/v1/rate-memory` | POST | Any | Save rate memory entry |
| `/api/v1/settings` | GET | Admin+ | Get app settings |
| `/api/v1/settings` | POST | Admin+ | Update app settings |
| `/api/v1/master-impact` | GET | Admin+ | Pre-save impact count (see §13.10) |
| `/api/v1/bulk-upload/jobs` | GET | Manager+ | List bulk upload jobs for tenant |
| `/api/v1/bulk-upload/jobs/:jobId/retry` | POST | Manager+ | Re-queue a failed bulk job |
| `/api/v1/team/members` | GET | Admin+ | List all team members |
| `/api/v1/team/invite` | POST | Admin+ | Send invitation email |
| `/api/v1/team/invitations` | GET | Admin+ | List pending invitations |
| `/api/v1/team/invitations/:id` | DELETE | Admin+ | Cancel pending invitation |
| `/api/v1/team/members/:userId/role` | PATCH | Admin+ | Change member role |
| `/api/v1/team/members/:userId/suspend` | PATCH | Admin+ | Suspend member |
| `/api/v1/team/members/:userId/reactivate` | PATCH | Admin+ | Reactivate member |
| `/api/v1/team/members/:userId` | DELETE | Admin+ | Remove member from tenant |
| `/api/v1/users/profile` | GET | Any | Own user profile |
| `/api/v1/users/profile` | PATCH | Any | Update own profile |
| `/api/v1/users/change-password` | POST | Any | Change own password |
| `/api/v1/admin/tenants` | GET | Platform | List all tenants |
| `/api/v1/admin/tenants` | POST | Platform | Create new tenant |
| `/api/v1/admin/tenants/:id/rollback-master` | POST | Platform | Emergency master data rollback |

### 12.2 Platform Admin Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/tenants` | GET | Admin API Key | List all tenants |
| `/api/admin/tenants` | POST | Admin API Key | Create new tenant |
| `/api/admin/tenants/:id` | GET | Admin API Key | Get tenant details |
| `/api/admin/tenants/:id/seed` | POST | Admin API Key | Seed master data for tenant |
| `/api/admin/users` | GET | Admin API Key | List all users |
| `/api/admin/users/:id/reset-password` | POST | Admin API Key | Force reset password |

---

## 13 — CASCADING EFFECTS OF ADMIN CHANGES

This section documents what happens **downstream** when an admin changes each setting. This is critical for Python backend implementation.

### 13.1 BF Price Change

| Scope | Effect |
|-------|--------|
| Live calculator | Next open → auto-sync updates all layer rates that are not manually overridden |
| Existing quotes | NO effect — saving a quote snapshots the price used at save time |
| Rate memory | NOT updated automatically — rate memory only updates when user manually enters |

### 13.2 Shade Premium Change

Same as BF Price Change — calculator auto-syncs, saved quotes unaffected.

### 13.3 GSM Rule Change

Same pattern. Auto-syncs on next calculator load.

### 13.4 Flute Settings Change

| Scope | Effect |
|-------|--------|
| Live calculator | All sheet size, ECT, BCT, thickness calculations change immediately |
| New quotes | Use new flute values |
| Existing saved quotes | NO effect — flute snapshot in `quoteVersions` preserves original values |

### 13.5 GST Percent Change

| Scope | Effect |
|-------|--------|
| Live calculator | Tax calculation updates on next load |
| New quotes | Use new GST percent |
| Existing quotes | NO effect — GST percent is stored on each `quoteVersions` row |

### 13.6 `roundOffEnabled` Change

Takes effect on next page load. Affects all future quote totals.

### 13.7 Column Visibility Change

Takes effect immediately on next WhatsApp/email message generation. Does NOT affect past sent messages.

### 13.8 Company Profile Edit

| Field | Lock status | Effect |
|-------|------------|--------|
| `companyName` | Locked if `hasFinancialDocs = true` | If unlocked: changes all future quote headers |
| `email`, `phone`, `address` | Always editable | Changes future documents |
| Logo | Always editable | Changes future quote logos |
| Legal fields (`gstNo`, `panNo`) | Locked | Cannot change after first quote |

### 13.9 Summary Table — Admin Change Impact

| Setting | New Quotes | Saved Quotes | Live Layout |
|---------|-----------|-------------|-------------|
| BF prices | Changed | Unchanged | Auto-sync |
| Shade premiums | Changed | Unchanged | Auto-sync |
| GSM rules | Changed | Unchanged | Auto-sync |
| Flute factors | Changed | Unchanged (snapshot) | Immediate |
| GST percent | Changed | Unchanged (snapshot) | Immediate |
| Round-off | Changed | Unchanged | Next load |
| Column flags | Changed | Unchanged | Next message |
| Company profile | Changed | Unchanged | Next load |

### 13.10 Impact Analysis — Pre-Save Warning

Before the admin saves any pricing change (BF prices, flute settings, GSM rules), the UI calls:

```
GET /api/master-impact?tables=paper_bf_prices,flute_settings
```

The server counts quotes that are **open in an active session** (i.e., `quotes` rows with `status = 'draft'` modified within the last 24 hours) for the current tenant:

```python
result = db.execute("""
    SELECT COUNT(*) AS draft_count
    FROM quotes
    WHERE tenant_id = :tenant_id
      AND status = 'draft'
      AND updated_at > NOW() - INTERVAL '24 hours'
""", {"tenant_id": tenant_id}).scalar()
```

**Response:**
```json
{ "affectedDraftQuotes": 3 }
```

**UI behavior:**
- If `affectedDraftQuotes > 0`, a yellow banner is shown on the Save button:
  > *"3 draft quote(s) are currently open. They will pick up this new pricing on their next load. Saved quotes are unaffected."*
- If `affectedDraftQuotes == 0`, the banner is hidden.
- The banner is **read-only and non-blocking** — admin can save regardless.

---

## 14 — SEEDING AND INITIALIZATION

### 14.1 When a New Tenant is Created

The following seed operations are performed automatically (or via `POST /api/admin/tenants/:id/seed`):

1. **Flute settings**: Insert default values for all 5 types (A, B, C, E, F)
2. **Paper shades**: Insert `DEFAULT_PAPER_SHADES` with 0 premium each
3. **Business defaults**: Insert single row with all defaults
4. **Quote terms**: Insert single row with defaults

### 14.2 Deferred Seeding

The following are NOT auto-seeded — user must trigger them manually from Settings:

- **BF prices**: User runs "Initialize Defaults" in Paper Master → calls `POST /api/paper-bf-prices/init-defaults`
- **Company profile**: User fills in full form in Account Profile
- **Email settings**: User configures SMTP or OAuth

### 14.3 Seeding Check in Calculator

On calculator load, if `paper_bf_prices` has no rows → calculator shows a warning banner prompting the user to configure Paper Master pricing before attempting to cost boxes.

### 14.4 `paperSetupCompleted` Flag

In `paper_pricing_rules.paperSetupCompleted`:
- `false` (default): Paper master setup banner shown in calculator
- `true`: Banner hidden; calculator assumes pricing is ready

### 14.5 Python Backend Seed Implementation

```python
def seed_new_tenant(tenant_id: str, db: Session):
    # 1. Flute settings
    defaults = [
        # Source truth: FlutingSettings.tsx DEFAULT_FLUTING constants
        ("A", 1.55, 4.8),
        ("B", 1.35, 2.5),
        ("C", 1.45, 3.6),
        ("E", 1.25, 1.2),
        ("F", 1.20, 0.8),
    ]
    for flute_type, factor, height in defaults:
        db.execute("""
            INSERT INTO flute_settings (tenant_id, flute_type, fluting_factor, flute_height_mm)
            VALUES (:tenant_id, :flute_type, :factor, :height)
            ON CONFLICT (tenant_id, flute_type) DO NOTHING
        """, {"tenant_id": tenant_id, "flute_type": flute_type, "factor": factor, "height": height})
    
    # 2. Shade premiums
    default_shades = [
        # 11 canonical shades — verified from schema.ts DEFAULT_PAPER_SHADES
        "Kraft/Natural",           # KRA
        "Testliner",               # TST
        "Virgin Kraft Liner",      # VKL
        "White Kraft Liner",       # WKL
        "White Top Testliner",     # WTT
        "Duplex Grey Back (LWC)",  # LWC
        "Duplex Grey Back (HWC)",  # HWC
        "Semi Chemical Fluting",   # SCF
        "Recycled Fluting",        # RCF
        "Bagasse (Agro based)",    # BAG
        "Golden Kraft",            # GOL
    ]
    for shade in default_shades:
        db.execute("""
            INSERT INTO shade_premiums (tenant_id, shade, premium)
            VALUES (:tenant_id, :shade, 0)
            ON CONFLICT (tenant_id, shade) DO NOTHING
        """, {"tenant_id": tenant_id, "shade": shade})
    
    # 3. Business defaults
    db.execute("""
        INSERT INTO business_defaults (tenant_id)
        VALUES (:tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING
    """, {"tenant_id": tenant_id})
    
    # 4. Quote terms
    db.execute("""
        INSERT INTO user_quote_terms (tenant_id)
        VALUES (:tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING
    """, {"tenant_id": tenant_id})
    
    db.commit()
```

---

---

## 15 — AUDIT LOG

*DB table: `audit_log`*

### 15.1 Purpose

Record every admin change to master data tables so the operator can trace who changed what and when. Required for debugging pricing anomalies and supporting multi-user rollout.

### 15.2 DB Table: `audit_log`

```sql
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    table_name  VARCHAR(100) NOT NULL,  -- e.g. 'paper_bf_prices', 'flute_settings'
    operation   VARCHAR(10)  NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
    record_id   UUID,                   -- PK of the affected row (NULL for bulk ops)
    old_value   JSONB,                  -- row state before change (NULL for INSERT)
    new_value   JSONB,                  -- row state after change (NULL for DELETE)
    changed_by  UUID REFERENCES users(id),
    changed_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_at ON audit_log (tenant_id, changed_at DESC);
```

### 15.3 Admin Actions That Write to audit_log

| Action | table_name | operation |
|--------|------------|-----------|
| BF price saved | `paper_bf_prices` | UPDATE |
| BF init-defaults triggered | `paper_bf_prices` | INSERT (bulk) |
| Shade premium saved | `shade_premiums` | UPDATE |
| Shade init-defaults triggered | `shade_premiums` | INSERT (bulk) |
| GSM rule changed | `paper_pricing_rules` | UPDATE |
| Flute settings saved | `flute_settings` | UPDATE |
| Flute reset-defaults triggered | `flute_settings` | UPDATE (bulk) |
| Business defaults saved | `business_defaults` | UPDATE |
| GST percent changed | `business_defaults` | UPDATE |
| Company profile created / edited | `company_profiles` | INSERT / UPDATE |
| **Quote item group created** [V2] | `quote_item_groups` | INSERT |
| **Quote item group dissolved** [V2] | `quote_item_groups` | DELETE |
| **Quote item group name/code edited** [V2] | `quote_item_groups` | UPDATE |
| **Grouped item price edited** [V2] | `quote_items` | UPDATE (with `group_id` in payload) |
| AI extraction job created [V3] | `bulk_upload_jobs` | INSERT |
| AI field manually corrected [V3] | `draft_costing_rows` | UPDATE |
| Negotiation round added [V3] | `negotiation_events` | INSERT |
| Negotiated price accepted [V3] | `quote_items` | UPDATE (`negotiated_price` field set) |
| Price increase event created [V3] | `price_increase_events` | INSERT |
| Price increase notification sent [V3] | `price_increase_events` | UPDATE |
| Follow-up rule created [V3] | `follow_up_automations` | INSERT |
| Follow-up message sent [V3] | `follow_up_logs` | INSERT |
| Job card generated [V3] | `job_cards` | INSERT |
| Tally push executed [V3] | `tally_push_log` | INSERT |
| Document uploaded [V3] | `document_files` | INSERT |
| Message template created / edited [V3] | `message_templates` | INSERT / UPDATE |

> **Note on group audit payload**: For group creation, `new_value` must include `group_id`, `group_name`, `group_code`, and `member_item_ids`. For dissolution, `old_value` must capture the same fields before deletion. This enables full audit trail reconstruction if a disputed pricing event involves a grouped item set.

### 15.4 Python Backend Audit Helper

```python
def write_audit(db, tenant_id, table_name, operation, record_id, old_val, new_val, user_id):
    db.execute("""
        INSERT INTO audit_log
            (tenant_id, table_name, operation, record_id, old_value, new_value, changed_by)
        VALUES
            (:tenant_id, :table, :op, :rid, :old, :new, :uid)
    """, {
        "tenant_id": tenant_id, "table": table_name, "op": operation,
        "rid": record_id, "old": old_val, "new": new_val, "uid": user_id
    })
```

Call `write_audit` inside the same DB transaction as the data change so the log is always in sync.

### 15.5 Master Data Rollback via audit_log

There is no dedicated rollback UI, but any pricing change can be undone using the audit log's `old_value` JSONB.

**Python rollback helper (platform admin use only):**
```python
def rollback_last_change(db, tenant_id: str, table_name: str):
    """
    Read the most recent audit_log entry for this table and
    re-apply old_value to restore the previous state.
    """
    row = db.execute("""
        SELECT id, operation, record_id, old_value
        FROM audit_log
        WHERE tenant_id = :tid AND table_name = :table
        ORDER BY changed_at DESC
        LIMIT 1
    """, {"tid": tenant_id, "table": table_name}).fetchone()

    if not row or row.old_value is None:
        raise ValueError("No rollback data available")

    # For UPDATE: restore old column values to the affected row
    # For INSERT: delete the inserted row
    # For bulk ops: record_id is NULL; old_value contains the full array
    ...
```

**Important**: Rollback via this helper is an **emergency safeguard** only — accessible through the platform admin API (`POST /api/admin/tenants/:id/rollback-master`), not through the user-facing settings UI.

---

## 16 — PLATFORM ADMIN API KEY — SECURITY & ROTATION

*Applies to: `ADMIN_API_KEY` environment variable used in §12.2 platform admin endpoints.*

### 16.1 Storage

- Stored only as an environment variable (`ADMIN_API_KEY`). Never committed to source control.
- Not stored in the database. Verification is a constant-time string comparison against the env value.
- Minimum recommended length: 32 random bytes (hex-encoded = 64 chars).

### 16.2 Request Verification

```python
import hmac

def verify_admin_key(provided: str) -> bool:
    expected = os.environ.get("ADMIN_API_KEY", "")
    # Constant-time compare prevents timing attacks
    return hmac.compare_digest(provided, expected)
```

### 16.3 Rotation Procedure

1. Generate a new key: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Update the environment variable on all server instances / deployment config.
3. Do **not** update the old key in any code path — there is no grace period needed since this key is not issued to end-users.
4. Restart the server process to pick up the new env value.
5. Confirm all `POST /api/admin/*` calls succeed with the new key before decommissioning the old one.

### 16.4 Key Expiry Recommendation

- Rotate at minimum every 90 days for production.
- Rotate immediately if the key is ever logged, exposed in a stack trace, or a team member with access leaves.
- Consider storing the key in a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) and injecting at runtime rather than hardcoding in deployment manifests.

### 16.5 Rate Limiting

To prevent brute-force attacks and accidental bulk API abuse, all admin endpoints are rate-limited.

**Rate limit tiers:**

| Endpoint group | Limit | Window | Action on breach |
|---------------|-------|--------|------------------|
| `POST /api/users/change-password` | 5 requests | 15 minutes | HTTP 429 + lock account for 30 min |
| `POST /api/admin/*` (API key routes) | 30 requests | 1 minute | HTTP 429 |
| All other settings writes (`POST /api/paper-bf-prices`, etc.) | 60 requests | 1 minute | HTTP 429 |
| Read endpoints (`GET /api/*`) | 300 requests | 1 minute | HTTP 429 |

**Python implementation (using `slowapi` / `redis`):**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")

@router.post("/users/change-password")
@limiter.limit("5/15minutes")
async def change_password(request: Request, ...):
    ...
```

**Rate limit response headers** (always returned):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1712000000
```

---

## 17 — ADMIN INPUT VALIDATION RULES

All validation failures return `HTTP 422 Unprocessable Entity` with body:
```json
{ "error": "<code>", "message": "<human-readable description>" }
```

### 17.1 BF Price Validation

| Rule | Code | Message |
|------|------|---------|
| `bf` must be in canonical list `[14,16,18,20,22,24,25,28,30,32,35,40]` | `BF_INVALID` | *"BF [X] is not in the canonical BF list."* |
| `base_price > 0` | `BF_PRICE_ZERO` | *"Base price for BF [X] must be greater than zero."* |
| `step_increment >= 0` | `BF_STEP_NEGATIVE` | *"Step increment for BF [X] cannot be negative."* |
| All 12 BF rows must be present | `BF_INCOMPLETE` | *"All 12 BF values must be included in each save."* |

### 17.2 GSM Rules Validation

| Rule | Code | Message |
|------|------|---------|
| `low_gsm_limit < high_gsm_limit` | `GSM_RANGE_INVERTED` | *"Low GSM limit must be less than High GSM limit."* |
| `low_gsm_limit` in `[50, 200]` | `GSM_LOW_OUT_OF_RANGE` | *"Low GSM limit must be between 50 and 200."* |
| `high_gsm_limit` in `[100, 400]` | `GSM_HIGH_OUT_OF_RANGE` | *"High GSM limit must be between 100 and 400."* |
| `market_adjustment` in `[-20, +20]` | `MARKET_ADJ_OUT_OF_RANGE` | *"Market adjustment must be between -20 and +20."* |

### 17.3 Shade Premium Validation

| Rule | Code | Message |
|------|------|---------|
| `shade` must not be empty string | `SHADE_EMPTY` | *"Shade name cannot be empty."* |
| `shade` max 100 chars | `SHADE_TOO_LONG` | *"Shade name must be 100 characters or fewer."* |
| `premium` in `[-50, +50]` | `PREMIUM_OUT_OF_RANGE` | *"Shade premium must be between -50 and +50 ₹/Kg."* |
| Duplicate `shade` for same tenant | `SHADE_DUPLICATE` | *"Shade name '[X]' already exists."* |

### 17.4 Flute Settings Validation

| Rule | Code | Message |
|------|------|---------|
| `flute_type` must be in `['A','B','C','E','F']` | `FLUTE_INVALID_TYPE` | *"Invalid flute type '[X]'."* |
| `fluting_factor` in `[1.0, 2.5]` | `FLUTE_FACTOR_OUT_OF_RANGE` | *"Fluting factor must be between 1.0 and 2.5."* |
| `flute_height_mm` in `[0.3, 10.0]` | `FLUTE_HEIGHT_OUT_OF_RANGE` | *"Flute height must be between 0.3 mm and 10.0 mm."* |

### 17.5 Business Defaults Validation

| Rule | Code | Message |
|------|------|---------|
| `default_gst_percent` in `[0, 28]` | `GST_OUT_OF_RANGE` | *"GST percent must be between 0 and 28."* |
| `gst_number` when provided: 15-char GSTIN format `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` | `GSTIN_INVALID` | *"Invalid GSTIN format."* |
| `conversion_cost_per_kg > 0` | `CONVERSION_COST_ZERO` | *"Conversion cost must be greater than zero."* |
| `default_markup_percent` in `[0, 200]` | `MARKUP_OUT_OF_RANGE` | *"Markup percent must be between 0 and 200."* |

---

## 18 — DELETE RULES FOR MASTER DATA

### 18.1 Core Principle

Master data deletion does **not** break saved quotes (all quotes snapshot their pricing at save time). However, deletion affects the **live calculator** and future quotes. Each delete endpoint enforces the following rules.

### 18.2 Shade Premium Delete

`DELETE /api/shade-premiums/:id`

| Check | Action |
|-------|--------|
| Shade is one of the 11 canonical shades | **Block delete** — HTTP 409: *"Cannot delete a canonical shade. You can set its premium to 0 instead."* |
| Shade is a custom (user-added) shade | **Allow delete**. No calculator impact check — saved quotes are unaffected (snapshotted). |

### 18.3 BF Price Delete

Individual BF rows are **not deletable**. The BF table is always exactly 12 rows per tenant (written as a full grid on each save). To "remove" a BF, the admin sets its `base_price` to `0` — which is then blocked by validation (§17.1). In effect, BF prices cannot be deleted, only updated.

### 18.4 Flute Settings Delete

Individual flute type rows are **not deletable**. Flute settings always contain exactly 5 rows (A/B/C/E/F). Use "Reset to Defaults" to restore values.

### 18.5 Company Profile Delete

`DELETE /api/company-profiles/:id`

| Check | Action |
|-------|--------|
| `hasFinancialDocs = true` | **Block delete** — HTTP 409: *"Cannot delete a company profile that has been used in saved quotes."* |
| Profile is `isDefault = true` | **Block delete** — HTTP 409: *"Cannot delete the default company profile. Set another profile as default first."* |
| No financial docs, not default | **Allow delete** |

### 18.6 Party Profile Delete

`DELETE /api/party-profiles/:id`

- Always allowed. Party data is snapshotted in `quoteVersions.partySnapshot` — deleting the party record does not affect saved quotes.
- The `partyId` FK on existing `quotes` rows is set to `NULL` (ON DELETE SET NULL) to avoid orphaned FK constraint violations.

### 18.7 Rate Memory Delete

`DELETE /api/rate-memory/:id` — always allowed. Rate memory is a user convenience cache with no FK constraints.

---

## 19 — MULTI-CURRENCY & LOCALIZATION

### 19.1 Design Principle

The BoxCostPro formula engine is **currency-agnostic**. All monetary values are computed in **Local Currency Units (LCU)** — whatever the tenant has configured. Formulas F01–F23 produce the same arithmetic regardless of currency; only the display symbol and number formatting differ.

A tenant in India sees ₹ with Indian number formatting (`1,23,456.78`). A tenant in the UAE sees AED (`123,456.78`). The same formula runs identically.

### 19.2 Currency Configuration

Stored in `business_defaults` per tenant:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `currency_code` | CHAR(3) | `INR` | ISO 4217 (INR, USD, EUR, GBP, AED, SGD, MYR, ...) |
| `currency_symbol` | VARCHAR(5) | `₹` | Display symbol; examples: ₹ $ € £ AED |
| `locale` | VARCHAR(20) | `en-IN` | BCP-47 locale for number & date formatting |
| `timezone` | VARCHAR(60) | `Asia/Kolkata` | IANA timezone for expiry calculations and reports |

**Supported locales (launch targets):**

| Market | Locale | Currency | Symbol | Number format example |
|--------|--------|----------|--------|-----------------------|
| India | `en-IN` | INR | ₹ | ₹1,23,456.78 |
| USA / Canada | `en-US` | USD | $ | $123,456.78 |
| UK | `en-GB` | GBP | £ | £123,456.78 |
| UAE | `en-AE` | AED | AED | AED 123,456.78 |
| Singapore | `en-SG` | SGD | S$ | S$123,456.78 |
| EU (Germany) | `de-DE` | EUR | € | 123.456,78 € |
| Malaysia | `en-MY` | MYR | RM | RM 123,456.78 |

### 19.3 Formatting Rules

**Backend**: always stores raw float values. Never formats for display.

**Frontend / PDF**: uses the Intl.NumberFormat API (JS) or `babel.numbers.format_currency()` (Python PDF pipeline) with the tenant's `locale` and `currency_code`.

```javascript
// Frontend formatting (React)
const formatCurrency = (amount, currencyCode, locale) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
// e.g. formatCurrency(12345.6, 'INR', 'en-IN') → "₹12,345.60"
// e.g. formatCurrency(12345.6, 'USD', 'en-US') → "$12,345.60"
```

### 19.4 Currency Rate Conversion

**Phase 1 scope**: No real-time FX conversion. A tenant operating in USD enters prices in USD; the system stores and displays USD throughout. Switching `currency_code` does not convert existing price records — it only changes the display symbol. Document this clearly in the onboarding UI: *"Select the currency you quote and invoice in. Changing this later will not convert existing prices."*

**Phase 2 roadmap** (post-launch): External FX rate feed (e.g. Open Exchange Rates), multi-currency quote output, automatic conversion for reporting.

### 19.5 Schema Changes for Multi-Currency

```sql
-- Already in business_defaults (see §11)
--   currency_code CHAR(3) NOT NULL DEFAULT 'INR'
--   currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹'
--   locale VARCHAR(20) NOT NULL DEFAULT 'en-IN'
--   timezone VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata'

-- Tenant bootstrap: set currency during signup based on country selection
-- All price columns (base_price, rate, premium, etc.) are already REAL (float) — no migration needed
```

### 19.6 Timezone Use Cases

- **Quote expiry**: `expires_at = created_at + validity_days` must be evaluated in the tenant's timezone.
- **Cron job for bulk job cleanup**: runs at `00:00` in tenant's timezone.
- **Report date bucketing**: daily/monthly reports group by date in tenant's timezone.
- **Audit log timestamps**: stored as UTC in DB; displayed in tenant's timezone in UI.

Python timezone handling:
```python
from zoneinfo import ZoneInfo
from datetime import datetime, timezone

# Store everything in UTC:
now_utc = datetime.now(timezone.utc)

# Display in tenant timezone:
tenant_tz = ZoneInfo(session["locale_timezone"])  # e.g. "Asia/Kolkata"
display_time = now_utc.astimezone(tenant_tz)
```

---

## 20 — TEAM & INVITATION FLOW

### 20.1 Invite a New Member

**Actor**: Owner or Admin  
**Trigger**: Settings → Team & Users → **Invite Member** button

1. **UI**: Show modal: Email address field + Role dropdown (Admin, Manager, Salesperson, Viewer — Owner not selectable).
2. **Client** calls `POST /api/v1/team/invite` body: `{email, role}`.
3. **Server** validates:
   - Role not `owner`
   - Email not already an active member of this tenant
   - Email not already pending an invitation for this tenant
   - Inviter's plan allows additional members (see §21.3)
4. **Server** generates `raw_token = secrets.token_hex(32)`, stores `token_hash = SHA256(raw_token)`, sets `expires_at = now() + 48h`.
5. **Server** sends invitation email using tenant's SMTP (or platform SendGrid fallback):
   - Subject: *"You've been invited to join [CompanyName] on BoxCostPro"*
   - Body: role, inviter name, accept link: `https://app.boxcostpro.com/accept-invite?token=<raw_token>`
6. **Response** `201 Created`: `{invitationId, email, role, expiresAt}`.

### 20.2 Accept an Invitation

**From email link**: `GET /api/v1/auth/accept-invite?token=<raw_token>`

1. Server hashes the raw token and looks up `invitations WHERE token_hash = SHA256(:token) AND accepted_at IS NULL AND expires_at > now()`.
2. If not found → `404` ("Invitation expired or not found"). Frontend shows friendly error.
3. If found:
   - **New user** (email has no `users` row): redirect to `/register?invite=<token>` — show name + password fields only (email pre-filled, not editable).
   - **Existing user** (email has a `users` row): redirect to `/login?invite=<token>` — after login, proceed to step 4.
4. **On form submit** `POST /api/v1/auth/accept-invite`:
   - Create `users` row if new (bcrypt password, email_verified = true because they received the invite email).
   - Create `tenant_memberships(user_id, tenant_id, role, invited_by)` row.
   - Mark `invitations.accepted_at = now()`.
   - Create session for the new user.
   - Redirect to `/` (calculator page).

### 20.3 Invitation Status & Management

**List pending invitations**: `GET /api/v1/team/invitations`

Response:
```json
[
  {
    "id": "uuid",
    "email": "colleague@company.com",
    "role": "salesperson",
    "invitedBy": "Owner Name",
    "expiresAt": "2026-04-12T10:30:00Z",
    "status": "pending"
  }
]
```

**Cancel invitation**: `DELETE /api/v1/team/invitations/:id` — deletes the row. If the link is clicked after cancellation, user sees "Invitation not found."

**Resend invitation**: `POST /api/v1/team/invitations/:id/resend` — generates a new token (invalidates old), resets `expires_at + 48h`, resends email.

### 20.4 Team Member List View

`GET /api/v1/team/members`

Response:
```json
[
  {
    "userId": "uuid",
    "email": "owner@company.com",
    "displayName": "Owner Name",
    "role": "owner",
    "isSuspended": false,
    "joinedAt": "2026-01-10T00:00:00Z",
    "lastActiveAt": "2026-04-10T09:15:00Z"
  }
]
```

The UI shows: avatar/initials, name, email, role badge, last active, action menu (Change Role / Suspend / Remove — each gated by the rules in §9.4–§9.5).

### 20.5 Security Constraints

| Rule | Reason |
|------|--------|
| Token stored as SHA-256 hash | Raw token never in DB; database breach exposes no usable tokens |
| 48-hour TTL | Short window limits phishing window |
| `UNIQUE(tenant_id, email)` on invitations | Prevents duplicate invite spam |
| Token is single-use | `accepted_at` set on use; any subsequent access returns 404 |
| Role cannot be `owner` in invitation | Owner is established only at tenant creation |
| Admin cannot invite above own role | Prevents privilege escalation via invitation |

---

## 21 — SUBSCRIPTION PLANS & FEATURE GATING

### 21.1 Plan Tiers

| Plan | Price model | Target customer |
|------|-------------|-----------------|
| **Starter** | Free or low fixed price | Solo operator, owner-only, max 1 user |
| **Professional** | Per-user or flat monthly | SME with a small team (2–10 users) |
| **Enterprise** | Custom / annual contract | Large sales teams, API access, custom branding |

> Pricing is managed outside BoxCostPro (Stripe / LemonSqueezy). The app only stores `tenants.plan` and reads feature gates from it.

### 21.2 Plan Features Matrix

| Feature | Starter | Professional | Enterprise |
|---------|:-------:|:------------:|:----------:|
| Max team members | 1 (owner) | 10 | Unlimited |
| Quotes per month | 50 | Unlimited | Unlimited |
| Bulk upload (Excel) | ❌ | ✅ | ✅ |
| PDF generation | ✅ | ✅ | ✅ |
| White-label / custom domain | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |
| Audit log retention | 30 days | 1 year | Unlimited |
| Report export (CSV/Excel) | ❌ | ✅ | ✅ |
| Custom quote terms templates | 1 | 5 | Unlimited |
| AI extraction (PDF / email / screenshot) [V3] | ❌ | ✅ | ✅ |
| Bulk AI costing [V3] | ❌ | ✅ | ✅ |
| Follow-up automation [V3] | ❌ | ✅ | ✅ |
| Pattern learning — global opt-in [V3] | ❌ | ✅ | ✅ |
| Document repository storage [V3] | 100 MB | 5 GB | Unlimited |
| Tally integration [V3] | ❌ | ❌ | ✅ |
| Negotiation timeline [V3] | ✅ | ✅ | ✅ |
| Job card & QA report [V3] | ✅ | ✅ | ✅ |
| Message templates [V3] | 2 | 20 | Unlimited |

### 21.3 Feature Gate Implementation

Feature gates are checked in the FastAPI service layer, not the DB layer:

```python
PLAN_FEATURES = {
    "starter": {
        "max_team_members": 1,
        "bulk_upload": False,
        "report_export": False,
        "api_access": False,
        # V3 features
        "ai_extraction": False,
        "bulk_ai_costing": False,
        "follow_up_automation": False,
        "pattern_learning_global": False,
        "tally_integration": False,
        "document_storage_mb": 100,
        "message_templates_max": 2,
    },
    "professional": {
        "max_team_members": 10,
        "bulk_upload": True,
        "report_export": True,
        "api_access": False,
        # V3 features
        "ai_extraction": True,
        "bulk_ai_costing": True,
        "follow_up_automation": True,
        "pattern_learning_global": True,
        "tally_integration": False,
        "document_storage_mb": 5120,
        "message_templates_max": 20,
    },
    "enterprise": {
        "max_team_members": None,   # None = unlimited
        "bulk_upload": True,
        "report_export": True,
        "api_access": True,
        # V3 features
        "ai_extraction": True,
        "bulk_ai_costing": True,
        "follow_up_automation": True,
        "pattern_learning_global": True,
        "tally_integration": True,
        "document_storage_mb": -1,  # -1 = unlimited
        "message_templates_max": -1,  # -1 = unlimited
    },
}

def require_feature(feature: str):
    """Dependency: raises HTTP 402 if the tenant's plan does not include the feature."""
    async def _check(session: dict = Depends(get_session)) -> dict:
        plan = session.get("plan", "starter")
        if not PLAN_FEATURES.get(plan, {}).get(feature, False):
            raise HTTPException(
                status_code=402,
                detail=f"Feature '{feature}' is not available on the {plan} plan. Upgrade to access it."
            )
        return session
    return _check

# Usage example — bulk upload requires 'professional' or higher:
@router.post("/api/v1/bulk-upload")
async def bulk_upload(
    session=Depends(require_role("owner","admin","manager","salesperson")),
    _feature=Depends(require_feature("bulk_upload"))
):
    ...
```

### 21.4 Tenant Plan Schema

```sql
-- tenants table must include plan tracking
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    plan VARCHAR(20) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    plan_expires_at TIMESTAMP WITH TIME ZONE;      -- NULL = never expires (lifetime / enterprise)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    stripe_customer_id VARCHAR(100);               -- for billing integration
```

### 21.5 Plan Enforcement Rules

1. **Invite check**: Before `POST /api/v1/team/invite`, count existing active memberships. If `count >= PLAN_FEATURES[plan].max_team_members` → HTTP 402.
2. **Bulk upload check**: Gate on `require_feature("bulk_upload")`.
3. **Plan displayed in UI**: Settings → Billing & Plans shows current plan, usage stats, upgrade CTA.
4. **Grace period**: On plan downgrade (e.g., Professional → Starter), existing team members are not immediately removed. A 30-day grace period shows a warning banner; after 30 days, members exceeding the Starter limit are suspended (not deleted).

### 21.6 Observability & Health

Every Python/FastAPI deployment must expose:

```
GET /health   → 200 {"status": "ok", "db": "connected", "redis": "connected"}
GET /ready    → 200 {"status": "ready"}   OR 503 if migrations pending
GET /metrics  → Prometheus text format (via prometheus-fastapi-instrumentator)
```

**OpenTelemetry tracing** (recommended for Enterprise):
- Use `opentelemetry-sdk` + `opentelemetry-instrumentation-fastapi`
- Export to OTLP (Jaeger, Grafana Tempo, or Datadog)
- Trace every inbound request with `tenant_id` and `user_id` as span attributes
- Create child spans for DB queries and object storage calls

---

## 22 — GROUPED QUOTE ITEMS: ADMIN, PDF & OUTPUT RULES [V2 Addition]

This section covers admin-visible and output-layer rules for grouped quote items. For the operator-facing creation/ungroup flow, see `02-system-flow-master.md §12.5`. For the formula and validation rules, see `01-formula-master.md §34`.

### 22.1 Reports Page — Display of Grouped Items

In the Reports table:
- Quotes that contain one or more `QuoteItemGroup` records show a group icon (🗂) indicator next to the "Items" count.
- The "Items" column count returns the number of **member items** (individual boxes), not group header count.
- The Grand Total still reflects the correct `group_total_sell_price` sums.

### 22.2 PDF Template — Grouped Commercial Line [V2 Addition]

#### 22.2.1 Customer-Facing PDF (sent to buyer)

- Each active `QuoteItemGroup` renders as a **single combined line item row** in the items table.
- The row shows:
  - `group_name` as the item description
  - `group_code` (if set) as a reference code  
  - `group_total_sell_price` as the line total
  - Quantity: the common quantity shared by all members (V1 constraint)
- **Individual member item rows are not shown** in the customer-facing PDF.

#### 22.2.2 Internal / Full-Detail PDF (operator save / audit copy)

- A second optional PDF format shows all member items expanded under each group header, with individual per-box prices.
- This format is for internal records only and must be clearly watermarked: *"INTERNAL — NOT FOR CUSTOMER"*.

#### 22.2.3 Sheet Mode — Conditional "Box Size" Column in PDF

| Item state | "Box Size" column in PDF |
|-----------|--------------------------|
| RSC item | Always shown (L×W×H inner mm) |
| Sheet item, no box dims | Column **omitted** for this row |
| Sheet item, box dims present | Column shown with `box_length × box_width × box_height (mm)` and label *(die-cut finished size)* |

The PDF generator must check `item.box_length` (non-null) to decide whether to render the Box Size cell for Sheet-type items. Do not render an empty cell; omit the column entirely if none of the items on the quote have box dims, to avoid a blank column.

#### 22.2.4 BCT in PDF

- BCT row is included in the specifications block of the PDF only when `item.bct_basis = 'box'`.
- For RSC items: BCT always shown.
- For Sheet items without optional box dims: BCT row omitted.

### 22.3 WhatsApp / Email — Grouped Output

WhatsApp and email message generation follows the same commercial line rule as PDF (§22.2.1):
- Group → single combined line with `group_name` and `group_total_sell_price`.
- Individual members suppressed from customer message.
- See `02-system-flow-master.md §17.6` for message generator logic.

### 22.4 DB Schema: `quote_item_groups` Table [V2 Addition]

```sql
CREATE TABLE quote_item_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    quote_version_id UUID REFERENCES quote_versions(id) ON DELETE SET NULL,
    group_name      VARCHAR(255) NOT NULL,
    group_code      VARCHAR(50),
    member_item_ids UUID[] NOT NULL,   -- ordered array of quote_item IDs
    group_total_sell_price NUMERIC(12, 2) NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_qig_quote_id ON quote_item_groups(quote_id);
CREATE INDEX idx_qig_tenant_id ON quote_item_groups(tenant_id);
```

> **Snapshot rule**: When a `quote_version` is created, the `quote_item_groups` records are cloned into a `group_snapshot` JSONB column on `quote_versions` for immutable version history. The live `quote_item_groups` rows remain mutable until the next version snapshot.

---

## 23 — DOCUMENT/FILE STORAGE GOVERNANCE [V3 New Module]

### 23.1 Purpose

The document repository stores specification PDFs, client briefs, sample approvals, vendor sheets, and other reference files linked to a tenant's parties or quotes.

### 23.2 DB Table

DDL in §11 — `document_files`.

### 23.3 File Categories

| Category code | Display name | Typical use |
|---------------|--------------|-------------|
| `specification` | Specification / Brief | Box specification PDFs from buyer |
| `sample_approval` | Sample Approval | Signed sample approval letters |
| `client_brief` | Client Brief | RFQ documents, buyer-provided briefs |
| `vendor_sheet` | Vendor Sheet | Board vendor data sheets (paper specs) |
| `other` | Other | Any other reference document |

### 23.4 Storage Rules

| Rule | Detail |
|------|--------|
| Storage backend | S3-compatible object store. `storage_key` is the object key in the configured bucket. |
| Signed URL access | All file reads return a pre-signed URL valid for **15 minutes**. The raw S3 key is never exposed to the client. |
| Max file size | 20 MB per file |
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Checksum | SHA-256 computed server-side before storage; stored in `document_files.checksum_sha256` |
| Soft delete | `deleted_at` timestamp — metadata retained for audit; object purged from storage after 7 days |

### 23.5 Per-Plan Storage Quotas

| Plan | Storage quota | Enforcement |
|------|---------------|-------------|
| Starter | 100 MB | Sum `size_bytes WHERE deleted_at IS NULL` for tenant. Block upload if new file would exceed quota. |
| Professional | 5 GB | Same |
| Enterprise | Unlimited | No quota check |

### 23.6 Retention Policy

- Soft-deleted files: purged from object store after 7 days.
- Hard delete (GDPR erasure): platform admin `DELETE /api/admin/tenants/:id/documents` erases all document objects and rows instantly.

---

## 24 — AI PARSING CONFIGURATION + PATTERN LEARNING ADMIN [V3 New Module]

### 24.1 DB Tables

- `ai_config` — per-tenant AI configuration (DDL in §11)
- `ai_pattern_library` — tenant-local and global extraction patterns (DDL in §11)

### 24.2 Admin UI Controls

| Setting | Field | Default | Validation |
|---------|-------|---------|------------|
| Auto-accept confidence threshold | `confidence_auto_accept` | 0.850 | `[0.700, 1.000]` |
| Review minimum threshold | `confidence_review_min` | 0.600 | `[0.300, confidence_auto_accept)` |
| AI model provider | `model_provider` | `openai` | free text; validated at extraction time |
| AI model name | `model_name` | `gpt-4o` | free text |
| Global pattern opt-in | `global_pattern_opt_in` | `false` | boolean toggle |
| Max rows per job | `max_rows_per_job` | 500 | `[10, 2000]` |
| Draft retention days | `draft_retention_days` | 30 | `[7, 365]` |

### 24.3 Pattern Learning Mechanics

1. When a user manually corrects an AI-extracted field in the review UI, the correction is recorded as a pattern entry in `ai_pattern_library` (tenant-local row).
2. If `global_pattern_opt_in = true`, anonymized pattern entries (no company names, party names, or pricing data) are periodically synced to the global pool via the `sync_patterns_to_global` Celery task (see `02-system-flow-master.md §31.1`).
3. Global patterns improve extraction accuracy for all tenants that have opted in.
4. Tenant-local patterns always take precedence over global patterns.

### 24.4 Admin Pattern Management

| Action | Endpoint | Description |
|--------|----------|-------------|
| View tenant patterns | `GET /api/v1/ai/patterns` | List all tenant-local pattern entries |
| Delete a pattern | `DELETE /api/v1/ai/patterns/:id` | Remove incorrect pattern manually |
| Preview sync queue | `GET /api/v1/ai/patterns/sync-queue` | Preview what would be shared globally |
| Toggle global opt-in | `PATCH /api/v1/ai/config` | Update `global_pattern_opt_in` |

---

## 25 — BULK IMPORT CONFIGURATION [V3 New Module]

### 25.1 Overview

Bulk import settings (max rows per job, confidence thresholds, draft row retention) are managed in the `ai_config` table (§24), since Excel bulk and AI bulk share the same draft costing pipeline.

### 25.2 Excel Bulk vs AI Bulk Differences

| Aspect | Excel Bulk | AI Bulk (PDF / email / screenshot) |
|--------|------------|------------------------------------|
| Source ingestion | Parse `.xlsx` row by row | AI model extracts structured data from unstructured input |
| Confidence field | N/A (deterministic parse) | `extraction_confidence` populated from AI response |
| Normalization | Mandatory dimension string parse; BF/shade lookup | Same normalization applied after AI output |
| Draft status on create | `'normalizing'` → `'costing'` (automated) | `'pending'` → `'costing'` → `'review'` (confidence gate) |
| Review step | Optional (only if validation errors exist) | Mandatory for medium-confidence rows |

### 25.3 Job Status Map (applies to `bulk_upload_jobs.status`)

| Status | Meaning |
|--------|---------|
| `queued` | Job accepted; Celery task not yet started |
| `processing` | Celery task running normalization + costing |
| `review` | All rows costed; awaiting user review / approval |
| `completed` | All rows approved and promoted to quote items |
| `partial` | Some rows approved; others rejected; job closed |
| `failed` | Job-level error (e.g., parse failure on entire file) |

---

## 26 — TEMPLATE MANAGEMENT [V3 New Module]

### 26.1 DB Table

`message_templates` — DDL in §11.

### 26.2 Channel Rules

| Channel | `subject` | `body_html` | Notes |
|---------|-----------|-------------|-------|
| `email` | Required | Full HTML (bleach allowlist) | For follow-up emails and price increase notifications |
| `whatsapp` | Not used | Plain text only (HTML stripped on render) | WhatsApp Business API does not support HTML |
| `both` | Optional | HTML stored; plain text generated by tag-stripping on WA send | Serves both channels |

### 26.3 Plan Limits

| Plan | Max templates (per channel) |
|------|-----------------------------|
| Starter | 2 |
| Professional | 20 |
| Enterprise | Unlimited |

### 26.4 Default Templates (Seeded at Tenant Creation)

Two default templates are seeded at signup:
1. **Quote Follow-Up (email)** — Professional follow-up after quote sent (3-day interval default).
2. **Price Increase Notice (email)** — Formal notification of revised pricing.

These are marked `is_default = true` and cannot be deleted; they can only be edited.

### 26.5 Template Variables

Templates support Handlebars-style variables: `{{party_name}}`, `{{quote_number}}`, `{{valid_until}}`, `{{salesperson_name}}`, `{{company_name}}`. The render engine substitutes these at send time from the quote context.

### 26.6 HTML Sanitization (bleach allowlist)

```
Allowed tags:    p, br, strong, em, u, h1–h4, ul, ol, li, table, thead, tbody, tr, th, td, a, img
Allowed attrs:   href (on a)  |  src (on img, must be HTTPS)
                 style: color, font-weight, text-align, padding, margin ONLY
Blocked always:  script, iframe, form, input, object, embed
```

All other tags/attributes are stripped on save. Never allow `script`, `iframe`, `form`, or `input` tags.

---

## 27 — EMAIL AUTOMATION SETTINGS [V3 New Module]

### 27.1 Overview

Follow-up automation rules (stored in `follow_up_automations`) work in conjunction with email settings (§7) and message templates (§26). This section covers the admin control surface specific to automation.

### 27.2 Admin UI — Automation Rules List

| Column | Description |
|--------|-------------|
| Name | Free text rule name |
| Trigger | `quote_sent` / `quote_opened` / `no_response` / `custom_date` |
| Delay | Days after trigger before first follow-up |
| Max follow-ups | Maximum follow-up messages in this sequence |
| Channel | Email / WhatsApp / Both |
| Template | Linked `message_templates.name` |
| Scope | `per_quote` / `per_party` / `global` |
| Active | Toggle (pauses rule without deleting it) |
| Stopping conditions | Reply received → stop; Quote accepted → stop |

### 27.3 WhatsApp Business API Notes

- WhatsApp Business API requires pre-registered template IDs for out-of-24-hour-window messages.
- Admin must register the template body with Meta's WhatsApp Business Manager separately. The `message_templates.body_html` stores the local copy.
- Within a 24-hour session window (customer recently messaged first), free-form messages are allowed.
- The `send_follow_up_message` Celery task handles channel routing: email → SMTP; WhatsApp → WA HTTP API.

### 27.4 Automation Stopping Conditions

| Condition | Behaviour |
|-----------|-----------|
| `stop_on_reply = true` | Celery task checks for reply on the email thread; stops the sequence if a reply is detected |
| `stop_on_accept = true` | If quote status changes to `accepted`, the sequence halts |
| Max follow-ups reached | Sequence ends naturally; `follow_up_logs` final entry records this |
| Manual pause | Admin sets `is_active = false` on the rule |
| Rule deleted | All pending follow-ups for this rule are cancelled |

---

## 28 — CLIENT-WISE PRICING POLICIES [V3 New Module]

### 28.1 DB Table

`client_pricing_policies` — DDL in §11.

### 28.2 Admin UI

Accessible under **Settings → Client Pricing → Client Policies** (`Manager+` role).

| Field | Description |
|-------|-------------|
| Party (client) | Select from tenant's `party_profiles` |
| Default markup % | Override the global markup for this client (blank = use global) |
| Discount % | Additional discount applied on top of the costed price |
| Price floor per box | Minimum sell price — costing engine warns if final price is below this |
| Notes | Optional internal notes (not shown to client) |

### 28.3 Price Resolution Order

When calculating the final sell price for a quote item:

1. Start with `costing_result.cost_per_box` (from the formula engine)
2. Apply `client_pricing_policies.default_markup_percent` if set (else use `business_defaults.default_markup_percent`)
3. Apply `client_pricing_policies.discount_percent`
4. Result → `final_cost_per_box`
5. If `negotiation_events` has an accepted round: `final_billing_price = negotiated_price`
6. Else: `final_billing_price = final_cost_per_box`
7. If `final_billing_price < price_floor_per_box` (when enabled): **warn** salesperson — do not block save

### 28.4 Precedence Summary

```
Global markup  <  Client markup override  <  Negotiated price (accepted)  >  Price floor check
```

---

## 29 — TALLY INTEGRATION SETTINGS [V3 New Module]

### 29.1 DB Table

`tally_settings` — DDL in §11.

### 29.2 Admin UI

Accessible under **Settings → Integrations → Tally Settings** (`Admin+` role).

| Field | Description |
|-------|-------------|
| Host | Hostname or IP of the Tally Prime / Tally ERP machine |
| Port | TCP port Tally listens on (default: 9000) |
| Protocol | `http` or `https` |
| Company name | Tally company name as it appears in the app (must match exactly) |
| Enabled | Toggle to enable / disable all Tally pushes for this tenant |

### 29.3 Connection Test

`POST /api/v1/tally/test-connection` — sends a minimal XML request to Tally and returns:
```json
{ "status": "ok" }
// or
{ "status": "error", "message": "Connection refused at 192.168.1.100:9000" }
```

### 29.4 Tally XML Protocol Reference

See `02-system-flow-master.md §44` for the full Tally push flow and XML format.

> **Security note**: Tally is an on-premise system. The BoxCostPro backend must be on the same LAN (or have secure network access) as the Tally machine. Never configure a publicly accessible Tally endpoint.

---

## 30 — SPEC/JOB CARD/QA TEMPLATE CONTROLS [V3 New Module]

### 30.1 Overview

Spec sheets, job cards, and QA reports are generated as PDFs from quote item data. Admin controls configure per-tenant template preferences and watermark settings.

### 30.2 Template Configuration

Stored in `app_settings.settings` JSONB under the key `pdf_templates`:

```json
{
  "pdf_templates": {
    "spec_sheet": {
      "template_name": "default",
      "show_pricing": false,
      "watermark": null
    },
    "job_card": {
      "template_name": "default",
      "watermark": "PRODUCTION COPY"
    },
    "qa_report": {
      "template_name": "default",
      "watermark": "QA INTERNAL"
    }
  }
}
```

### 30.3 Watermark Rules

| Document | Default watermark | Notes |
|----------|------------------|-------|
| Spec sheet | None | Sent to clients and factory — no watermark by default |
| Job card | `PRODUCTION COPY` | For production floor use |
| QA report | `QA INTERNAL` | Internal quality check — not shared with client |
| Internal full-detail PDF (§22.2.2) | `INTERNAL — NOT FOR CUSTOMER` | Always watermarked; not configurable |

### 30.4 Show Pricing on Spec Sheet

Spec sheets **never include pricing** by default (see `01-formula-master.md §40` — pricing exclusion rule). The `show_pricing` toggle must remain `false` unless the tenant owner explicitly enables it.

---

## 31 — PRIVACY AND ANONYMIZATION RULES FOR PATTERN LEARNING [V3 New Module]

### 31.1 Design Principle

Pattern learning syncs anonymized *structure patterns only* — never raw quote data, party names, pricing figures, or any personally identifiable information.

### 31.2 What Is Anonymized Before Global Sync

| Data type | Treatment |
|-----------|-----------|
| Column header text / field labels | Passed through (structure only) |
| Party names (buyer / supplier) | **STRIPPED** — never included in global patterns |
| Box dimensions (L × W × H) | Passed through (product specs, non-identifying) |
| BF / GSM values | Passed through (non-identifying product specs) |
| Pricing values | **STRIPPED** |
| Quantity / order size | **STRIPPED** |
| Tenant ID (source) | Replaced with an anonymized salt — source tenant is not recoverable |
| File name / source document name | **STRIPPED** |

### 31.3 Opt-In Mechanics

1. Default: `global_pattern_opt_in = false` — all patterns are tenant-local only.
2. Admin can toggle opt-in from **Settings → AI & Extraction → Pattern Learning**.
3. On toggle-on: a confirmation dialog shows the exact data types that will be shared (§31.2 table), requiring explicit acknowledgement.
4. Toggle-off takes effect immediately: no further patterns are queued for global sync. Already-synced patterns remain in the global pool anonymously.

### 31.4 GDPR Notes

- Tenant-local `ai_pattern_library` rows are deleted on tenant account deletion (CASCADE from `tenants.id`).
- Global patterns (`tenant_id IS NULL`) are not tied to any tenant and cannot be reverse-attributed; no GDPR deletion obligation applies.
- If a tenant requests erasure and had enabled global opt-in, the platform admin should note that patterns already contributed to the global pool cannot be recalled (standard anonymized data exclusion under GDPR Article 11).

---

## 32 — SALES TOOL POSITIONING [V3 New Module]

### 32.1 Overview

BoxCostPro V3 is positioned as both a **costing tool** and a **sales tool**. This section defines the feature grouping by user persona for UI navigation and onboarding.

### 32.2 Feature Groups by Persona

| Feature | Primary persona | Secondary persona |
|---------|----------------|-------------------|
| Box cost calculator | Estimator / Owner | Salesperson |
| Quote creation | Salesperson | Estimator |
| Bulk Excel costing | Estimator | — |
| AI bulk costing (PDF / email / screenshot) | Salesperson | Estimator |
| Negotiation timeline | Salesperson | Manager |
| Price increase workflow | Owner / Manager | — |
| Follow-up automation | Salesperson | Owner |
| Reports | Manager / Owner | Salesperson (own) |
| Document repository | Salesperson | Estimator |
| Spec sheet / Job card / QA report | Estimator | Salesperson |
| Tally push | Owner / Accountant | — |
| Template management | Owner / Admin | Salesperson |
| Client-wise pricing | Manager / Owner | Salesperson |

### 32.3 Onboarding Persona Selection

During tenant onboarding, the system asks: *"How does your team primarily use BoxCostPro?"*

| Answer | Recommended setup |
|--------|-------------------|
| "We quote boxes for our clients" | Enable: negotiation, follow-ups, AI costing, client pricing |
| "We make boxes and need production documents" | Enable: spec sheets, job cards, QA reports, Tally |
| "We do both" | Enable all features |

This selection pre-configures the default visible sidebar modules (stored in `app_settings.settings`). Admin can always reconfigure from Settings.

---

## 33 — DEAL PIPELINE SETTINGS [V3 New Module]

### 33.1 Overview

The Deal Pipeline module adds CRM-lite tracking to every sent quote (§45 of 02-system-flow-master.md). Admin controls for the pipeline live under **Settings → Pipeline**.

### 33.2 DB: Pipeline Configuration

Pipeline config is stored in the existing `app_settings` JSONB `settings` column under the key `"pipeline"`:

```json
{
  "pipeline": {
    "email_tracking_enabled": true,
    "auto_mark_expired_as_lost": false,
    "lost_reasons": ["Price too high", "Went with competitor", "No response", "Project cancelled", "Other"],
    "stage_display_names": {
      "draft": "Draft",
      "sent": "Sent",
      "opened": "Opened",
      "responded": "Replied",
      "negotiating": "Negotiating",
      "won": "Won",
      "lost": "Lost",
      "expired": "Expired"
    },
    "inactivity_alert_days": 7
  }
}
```

### 33.3 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/pipeline/settings` | Read pipeline config |
| `PATCH` | `/api/v1/admin/pipeline/settings` | Update pipeline config |
| `GET` | `/api/v1/quotes/pipeline` | Paginated pipeline board data (all stages) |
| `PATCH` | `/api/v1/quotes/:id/pipeline-stage` | Manually transition stage (Owner/Admin/Manager) |
| `GET` | `/api/v1/quotes/:id/activity-feed` | Activity feed for one quote |
| `GET` | `/api/v1/reports/pipeline/analytics` | Win rate, avg days to close, stage funnel |

### 33.4 Email Tracking Privacy

- `email_tracking_enabled`: when `false`, the tracking pixel and click-wrap links are NOT injected into outgoing emails.
- Emails still include an unsubscribe footer link regardless of this setting.
- Per-recipient opt-out: if a recipient clicks "Unsubscribe from tracking" (separate from email unsubscribe), their email is added to `email_tracking_optouts` and all future emails to them are sent without pixel.

```sql
CREATE TABLE email_tracking_optouts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    email       TEXT NOT NULL,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_eto_tenant_email ON email_tracking_optouts(tenant_id, email);
```

### 33.5 Loss Reasons

Admin can configure the list of selectable loss reasons (default list in §33.2). Custom reasons can be added/removed. Stored as an ordered array; UI presents them as a radio group + "Other (free text)" option. Loss reasons appear in Reports analytics to surface patterns.

### 33.6 Inactivity Alerts

When a quote has been in the `sent` stage for more than `inactivity_alert_days` without any delivery event:
- Celery beat task `check_pipeline_inactivity` (daily) finds stale quotes.
- In-app notification dispatched to the quote's assigned salesperson (and their manager).
- Quote card on the Pipeline board shows an amber urgency ring.

### 33.7 Pipeline Analytics

`GET /api/v1/reports/pipeline/analytics` returns:

```json
{
  "period_days": 30,
  "total_quotes_sent": 48,
  "won": 22,
  "lost": 10,
  "in_progress": 16,
  "win_rate_pct": 45.8,
  "avg_days_to_close_won": 8.3,
  "avg_deal_value_won": 142000,
  "stage_funnel": {
    "sent": 48, "opened": 38, "responded": 24, "negotiating": 18, "won": 22, "lost": 10
  },
  "lost_reason_breakdown": {
    "Price too high": 4,
    "Went with competitor": 3,
    "No response": 2,
    "Other": 1
  }
}
```

### 33.8 RBAC

| Role | View pipeline settings | Edit settings | View analytics |
|------|----------------------|--------------|---------------|
| Owner / Admin | ✅ | ✅ | ✅ |
| Manager | ✅ (read-only) | ❌ | ✅ |
| Salesperson / Viewer | ❌ | ❌ | ❌ |

---

## 34 — WHATSAPP PLATFORM SETUP & TENANT ACTIVATION [V3 Revised]

### 34.1 Overview

The platform admin is the sole owner of the WhatsApp Business Account (WABA) used by BoxCostPro. Tenants do not configure their own WABA — they purchase the WhatsApp add-on, and the admin activates it for their account. All configuration lives in **Platform Admin → WhatsApp** (not per-tenant Settings). See §46 (02-system-flow-master.md) for the sending flow; see §36 for template management; see §37 for analytics.

### 34.2 Platform WABA Setup

Admin navigates to **Platform Admin → WhatsApp → Configuration**:

1. Enters **Phone Number ID** and **WhatsApp Business Account ID** (both from Meta Business Suite → Business Settings → WhatsApp Accounts).
2. Enters the permanent **API Token** (System User token, not Page token).
3. Clicks **[Test Connection]** → backend calls `GET https://graph.facebook.com/v18.0/{phone_number_id}` to verify.
4. On success: status badge turns `Connected (✓)`, `wa_platform_config.is_active = TRUE`.
5. **Webhook URL** is displayed (read-only): `https://platform.boxcostpro.com/api/v1/webhooks/whatsapp` — admin copies into Meta Business Suite → Webhooks.
6. **Webhook Verify Token** auto-generated and displayed once; admin pastes into Meta Business Suite webhook config.

**API endpoint:** `PUT /api/v1/platform-admin/wa/config`

Fields stored in `wa_platform_config`:
- `phone_number_id`, `waba_id`, `api_token_encrypted` (AES-256-GCM), `webhook_verify_token`, `webhook_secret`, `display_name`, `opt_out_keywords[]`

The raw API token is never returned to the frontend after saving. The "Test Connection" endpoint decrypts it server-side and validates with Meta.

### 34.3 Webhook Verification (Meta Handshake)

When the admin saves the webhook URL in Meta Business Suite, Meta sends:
```
GET /api/v1/webhooks/whatsapp
  ?hub.mode=subscribe
  &hub.challenge=RANDOM_NONCE
  &hub.verify_token={verify_token}
```

Handler checks `hub.verify_token` against `wa_platform_config.webhook_verify_token`, then returns `hub.challenge` as plain text. Meta confirms the webhook as verified. This must succeed before any event payloads flow.

### 34.4 Tenant Activation Management

Admin navigates to **Platform Admin → WhatsApp → Tenant Activations**:

A table lists all tenants with columns:
`Tenant Name | Plan | WA Status | Monthly Quota | Messages This Month | Activated On | Actions`

**Activate a tenant:**
1. Admin clicks **[Activate]** for a tenant → modal opens.
2. Sets monthly quota (optional; leave blank for unlimited).
3. Adds optional internal notes (e.g., "Paid for Basic WA plan").
4. Clicks **[Confirm Activation]** → `wa_tenant_activations` row upserted with `is_active = TRUE`.

**Deactivate a tenant:**
1. Admin clicks **[Deactivate]** → confirmation modal.
2. `wa_tenant_activations.is_active = FALSE`, `deactivated_at = NOW()`.
3. Tenant's pending queued messages are not sent. In-progress messages already handed to Meta are not recalled.

**API endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/platform-admin/wa/tenants` | List all tenant activation rows |
| `PUT` | `/api/v1/platform-admin/wa/tenants/:tenant_id` | Activate / update quota |
| `DELETE` | `/api/v1/platform-admin/wa/tenants/:tenant_id` | Deactivate |

**RBAC:** Platform Admin only. Tenant users have no access to this endpoint.

### 34.5 Monthly Quota Management

If `wa_tenant_activations.monthly_quota` is set:
- Celery beat job `check_wa_quotas` runs nightly; sends in-app notification to tenant admin when 80% and 100% of quota is reached.
- When quota is reached, further WA sends return `QUOTA_EXCEEDED` (§46.3); tenant sees the fallback wa.me option.
- Quota resets at the start of each calendar month (first day, 00:00 UTC).
- Message count for quota is `COUNT(wa_message_log)` where `tenant_id = :id AND status != 'queued' AND created_at >= first_of_month`.

### 34.6 Platform Opt-Out Registry

Admin can view and manage the platform-wide `wa_optouts` table at **Platform Admin → WhatsApp → Opt-out Registry**:

- View list of opted-out phone numbers (last 4 digits shown; full E.164 on hover for Admin only)
- Manually add a number (e.g., pre-migration import)
- Remove a number if the contact requests re-subscription
- Export as CSV
- Bulk import from CSV

**API endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/platform-admin/wa/optouts` | List all opt-outs |
| `POST` | `/api/v1/platform-admin/wa/optouts` | Add phone to opt-out list |
| `DELETE` | `/api/v1/platform-admin/wa/optouts/:phone` | Remove from opt-out list |
| `POST` | `/api/v1/platform-admin/wa/optouts/import` | Bulk CSV import |

### 34.7 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Tenant Other |
|--------|----------------|--------------------|--------------|
| Configure WABA credentials | ✅ | ❌ | ❌ |
| Activate/deactivate tenant | ✅ | ❌ | ❌ |
| View tenant activation list | ✅ | ❌ | ❌ |
| Manage platform opt-out list | ✅ | ❌ | ❌ |
| View own WA add-on status | N/A | ✅ | ✅ |

---

## 35 — MULTI-ACCOUNTING INTEGRATION SETTINGS [V3 New Module]

### 35.1 Overview

Lives under **Settings → Integrations** (sub-tab per integration type). Each integration has its own `accounting_integrations` row:

```sql
CREATE TABLE accounting_integrations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    integration_type      TEXT NOT NULL,  -- 'zoho' | 'quickbooks' | 'busy' | 'marg' | 'webhook' | 'csv'
    is_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
    auto_push             BOOLEAN NOT NULL DEFAULT FALSE,
    credentials_encrypted JSONB,          -- OAuth tokens, API keys — AES-256-GCM encrypted
    config                JSONB,          -- integration-specific config (see §35.3)
    last_push_at          TIMESTAMPTZ,
    last_push_status      TEXT,           -- 'success' | 'failed' | 'never'
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_ai_tenant_type ON accounting_integrations(tenant_id, integration_type);
```

### 35.2 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/integrations` | List all integration configs for tenant |
| `GET` | `/api/v1/admin/integrations/:type` | Get one integration config |
| `PUT` | `/api/v1/admin/integrations/:type` | Create or update config |
| `DELETE` | `/api/v1/admin/integrations/:type` | Disconnect integration |
| `POST` | `/api/v1/admin/integrations/:type/test` | Test connection |
| `POST` | `/api/v1/admin/integrations/:type/oauth/authorize` | Start OAuth flow |
| `GET` | `/api/v1/admin/integrations/:type/oauth/callback` | OAuth callback handler |
| `GET` | `/api/v1/admin/integrations/push-log` | Paginated push history (all types) |

### 35.3 Integration-Specific Config

**Zoho Books (`config` JSONB):**
```json
{
  "organization_id": "60027012345",
  "default_sales_account": "Sales",
  "default_payment_terms": "Net 30",
  "party_ledger_group": "Sundry Debtors",
  "refresh_token_expiry": "2027-01-01T00:00:00Z"
}
```

**QuickBooks (`config` JSONB):**
```json
{
  "realm_id": "123146257",
  "sandbox_mode": false,
  "default_income_account": "Sales of Product Income",
  "default_tax_code": "TAX"
}
```

**Generic Webhook (`config` JSONB):**
```json
{
  "url": "https://erp.mycompany.com/hooks/invoice",
  "auth_type": "bearer",
  "auth_token_encrypted": "...",
  "hmac_secret_encrypted": "...",
  "retry_on_failure": true,
  "max_retries": 3,
  "timeout_seconds": 15
}
```

**Generic CSV (`config` JSONB):**
```json
{
  "column_mapping": {
    "invoice_date": "Bill Date",
    "party_name": "Customer Name",
    "grand_total": "Total Amount"
  },
  "date_format": "DD/MM/YYYY",
  "decimal_separator": ".",
  "include_header_row": true
}
```

### 35.4 OAuth Token Management

For Zoho and QuickBooks:
- Tokens stored in `credentials_encrypted` (AES-256-GCM, per-tenant encryption key).
- Access token TTL: 1 hour (Zoho) / 1 hour (QB). Refresh token TTL: 365 days.
- Background Celery task `refresh_oauth_tokens` runs every 55 minutes, refreshes all expiring tokens proactively.
- If refresh fails (expired refresh token): integration status set to `'reconnect_required'`, in-app notification to Owner/Admin.

### 35.5 Auto-Push Rules

Only one integration may have `auto_push = true` per tenant. Setting a second integration to `auto_push = true` automatically sets the previous one to `false` (enforced by DB trigger or API logic).

Auto-push is triggered by the `QuoteAccepted` event (§47.9 of 02-system-flow-master.md). For CSV and Busy (file-based) integrations, `auto_push = true` is not allowed — these are manual download-only.

### 35.6 Push Log Governance

- Push log entries retained for **180 days**.
- `request_payload` and `response_body` are stored in `accounting_push_log.request_payload` JSONB.
- Sensitive fields (API tokens, secrets) are **never** written to the push log — only the final transformed payload.
- Push log is accessible to Owner/Admin/Manager (read-only).

### 35.7 Delete / Disconnect

On `DELETE /api/v1/admin/integrations/:type`:
1. `accounting_integrations` row is soft-deleted (`is_enabled = false`) — push history is retained.
2. OAuth tokens are cleared from `credentials_encrypted`.
3. For Zoho/QB: backend also calls the provider's token revocation endpoint (best-effort; non-blocking).
4. Any pending Celery tasks for this integration are cancelled.

---

## 36 — WHATSAPP TEMPLATE MANAGEMENT [V3 New Module]

### 36.1 Overview

All WhatsApp message templates are created and managed exclusively by the **platform admin**. Tenants cannot create or modify templates. Approved templates are published to a shared library; tenants see only the templates the admin has made available. This ensures all templates are Meta-approved before any tenant can use them and maintains brand/compliance consistency.

### 36.2 Template DB Schema

```sql
CREATE TABLE wa_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,         -- snake_case Meta template name
    display_name        TEXT NOT NULL,         -- human-friendly label shown to tenants
    language_code       TEXT NOT NULL DEFAULT 'en_IN',
    category            TEXT NOT NULL,         -- 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    status              TEXT NOT NULL DEFAULT 'draft',
                        -- 'draft'|'pending_approval'|'approved'|'rejected'|'paused'|'disabled'
    meta_template_id    TEXT,                  -- numeric ID returned by Meta after submission
    rejection_reason    TEXT,
    header_type         TEXT DEFAULT 'NONE',   -- 'NONE'|'TEXT'|'IMAGE'|'VIDEO'|'DOCUMENT'
    header_content      TEXT,                  -- static text or public media URL
    body_text           TEXT NOT NULL,         -- with {{1}}, {{2}} variable placeholders
    footer_text         TEXT,
    buttons             JSONB,                 -- see §36.5 button schema
    variable_map        JSONB NOT NULL DEFAULT '{}',  -- see §36.4
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    availability        TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'selected'
    availability_config JSONB,                 -- {"tenant_ids": ["uuid1"]}
    use_count           INTEGER NOT NULL DEFAULT 0,
    submitted_at        TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_wa_template_name_lang ON wa_templates(name, language_code);
```

### 36.3 Template Categories

| Category | Typical Use | Cost Tier (Meta) |
|----------|-------------|-----------------|
| `UTILITY` | Quote notification, follow-up, payment reminder | Lower |
| `MARKETING` | Price increase notice, promotional messages | Higher |
| `AUTHENTICATION` | OTP / verification codes | Lowest |

**Default templates to create at platform setup:**
- `quote_notification_v1` → `UTILITY` — sent when a quote is shared with a client
- `followup_reminder_v1` → `UTILITY` — follow-up automation message
- `price_increase_notice_v1` → `MARKETING` — price revision letter notification
- `payment_reminder_v1` → `UTILITY` — gentle payment reminder post-acceptance

### 36.4 Template Variable System

Meta requires numbered variables `{{1}}`, `{{2}}` in template body text. BoxCostPro maps each to a named alias and a source field from quote/party/tenant context:

```json
{
  "1": { "alias": "party_name",        "source": "quote.party.name" },
  "2": { "alias": "quote_ref",         "source": "quote.ref" },
  "3": { "alias": "total_amount",      "source": "quote.grand_total_formatted" },
  "4": { "alias": "valid_until",       "source": "quote.valid_until_formatted" },
  "5": { "alias": "salesperson_name",  "source": "quote.created_by.full_name" },
  "6": { "alias": "company_name",      "source": "tenant.company_name" },
  "7": { "alias": "quote_public_link", "source": "quote.public_link" }
}
```

Available source namespaces:

| Namespace | Fields |
|-----------|--------|
| `quote.*` | `ref`, `grand_total_formatted`, `valid_until_formatted`, `items_summary`, `public_link`, `created_by.full_name`, `created_at_formatted` |
| `party.*` | `name`, `contact_person`, `phone`, `email`, `city` |
| `tenant.*` | `company_name`, `phone`, `email`, `city` |
| `custom` | Admin sets a static `default_value`; tenant can override at send time |

At send time: `resolve_variables(template, quote)` iterates the `variable_map`, resolves each source path against live quote data, and returns a `{var_num: value}` dict passed to the Meta API payload.

### 36.5 Template Button Schema

```json
[
  { "type": "QUICK_REPLY", "text": "View Quote" },
  {
    "type": "URL",
    "text": "Open Quote Portal",
    "url": "https://boxcostpro.com/q/{{1}}",
    "url_variable": "1"
  },
  {
    "type": "PHONE_NUMBER",
    "text": "Call Us",
    "phone_number": "+91XXXXXXXXXX"
  }
]
```

Constraints (Meta policy): max 3 buttons total; max 2 URL buttons; only 1 URL button may have a dynamic variable; Quick Reply text max 25 chars.

### 36.6 Template Creation Workflow (Admin)

1. **Platform Admin → WhatsApp → Templates → [+ New Template]**
2. Fill: display name, Meta template name (snake_case, no spaces), language, category.
3. Build template components in the visual builder (§29.2 UI spec).
4. Define variable mappings in the variable panel — pick each `{{N}}` alias and source field.
5. **[Save as Draft]** → `wa_templates` row with `status = 'draft'`.
6. Preview with a sample quote stub to verify variable substitution.
7. **[Submit to Meta]** → §36.7.

### 36.7 Meta Submission & Approval Sync

**Submit:** `POST /api/v1/platform-admin/wa/templates/:id/submit`
- Validates `status IN ('draft', 'rejected')`.
- Builds and POSTs Meta API payload to `https://graph.facebook.com/v18.0/{waba_id}/message_templates`.
- Stores returned `meta_template_id`; sets `status = 'pending_approval'`.

**Sync:** `POST /api/v1/platform-admin/wa/templates/sync`
- Polls Meta for all template statuses; updates `status`, `rejection_reason`, `approved_at`.
- Also auto-triggered by Meta's `template_status_update` webhook event.

**Approval webhook event (inbound from Meta):**
```json
{ "field": "message_template_status_update",
  "value": { "event": "APPROVED", "message_template_name": "quote_notification_v2", "message_template_language": "en_IN" } }
```
Handler: updates `wa_templates.status = 'approved'`; sends in-app notification to platform admin.

### 36.8 Template Versioning

Meta templates are immutable once approved. To revise:
1. **[Duplicate & Edit]** — creates new row with name suffix incremented (e.g., `_v3`).
2. Old template continues serving existing sends while new version awaits approval.
3. After new version is approved, admin clicks **[Set as Default]** for its context.
4. Old template set to `disabled` — retained for `wa_message_log` history reference; no new sends.

### 36.9 Publishing & Availability

- `is_published = FALSE` → admin draft; invisible to all tenants.
- `is_published = TRUE` + `availability = 'all'` → all activated tenants can use it.
- `is_published = TRUE` + `availability = 'selected'` → only `availability_config.tenant_ids` can use it.

### 36.10 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/platform-admin/wa/templates` | List all templates |
| `POST` | `/api/v1/platform-admin/wa/templates` | Create draft |
| `GET` | `/api/v1/platform-admin/wa/templates/:id` | Get detail |
| `PUT` | `/api/v1/platform-admin/wa/templates/:id` | Update draft |
| `DELETE` | `/api/v1/platform-admin/wa/templates/:id` | Delete draft |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/submit` | Submit to Meta |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/duplicate` | Duplicate for versioning |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/publish` | Publish approved template |
| `POST` | `/api/v1/platform-admin/wa/templates/sync` | Sync status from Meta |
| `GET` | `/api/v1/wa/templates` | Published templates visible to tenant |

### 36.11 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Tenant Other |
|--------|----------------|--------------------|--------------|
| Create / edit / delete templates | ✅ | ❌ | ❌ |
| Submit to Meta / sync status | ✅ | ❌ | ❌ |
| Publish / restrict availability | ✅ | ❌ | ❌ |
| View published template library | ✅ | ✅ (if WA activated) | ✅ (if WA activated) |
| Use template in send flow | N/A | ✅ | Role-dependent |

---

## 37 — WHATSAPP ANALYTICS [V3 New Module]

### 37.1 Platform-Wide Dashboard (Admin)

Location: **Platform Admin → WhatsApp → Analytics**

**Top row — 4 KPI cards:**

| Card | Metric | Secondary |
|------|--------|-----------|
| Sent | `COUNT(wa_message_log) WHERE status != 'queued'` | Δ% vs previous period |
| Delivered | `COUNT WHERE status IN ('delivered','read')` | Delivery rate % |
| Read | `COUNT WHERE status = 'read'` | Read rate % |
| Failed | `COUNT WHERE status = 'failed'` | Failure rate % |

Each card shows a 7-day sparkline (Recharts `AreaChart`, `brand-300` fill, 40px tall).

**Delivery funnel:**
```
Sent ──► Delivered ──► Read ──► Replied
100%       87.3%       61.2%     8.4%
```
Rendered as `FunnelChart` (Recharts). Clicking a stage filters the raw message log table.

**Template performance table:**

| Template | Category | Sent | Delivered % | Read % | CTA Click % | Status |
|----------|----------|------|-------------|--------|-------------|--------|
| Quote Notification V2 | UTILITY | 1,204 | 92% | 68% | 34% | Approved |

Sortable by any column. "CTA Click %" only for templates with URL buttons.

**Tenant consumption (horizontal bar chart):** top 10 tenants by message count.

Full paginated table below: `Tenant | Sent | Delivered % | Read % | Quota | Quota Used % | Activated`

**Time-of-day read-rate heatmap:**
- 7×24 grid (Mon–Sun × 00–23 hours)
- Cell colour intensity = average read rate during that slot
- Hover tooltip: exact read rate + sample count
- Helps identify optimal send times

### 37.2 Tenant-Level Analytics (Tenant Admin View)

Location: **Settings → WhatsApp → Analytics**

Same KPI cards and template breakdown, scoped to tenant's own `wa_message_log`. Includes:
- 30-day daily volume line chart (Recharts `LineChart`)
- Template performance table (tenant-filtered)
- Link from each row: "See quote messages" → quote detail → Messages tab (§30.2)

### 37.3 Analytics API

```
GET /api/v1/platform-admin/wa/analytics?period=30d[&tenant_id=uuid]
GET /api/v1/wa/analytics?period=30d   (tenant-scoped, own data only)
```

Response schema:
```json
{
  "period": { "from": "2026-04-05", "to": "2026-05-04" },
  "kpis": {
    "sent": 2340, "delivered": 2041, "read": 1430, "failed": 87,
    "delivery_rate": 87.2, "read_rate": 61.1, "failure_rate": 3.7
  },
  "funnel": { "sent": 2340, "delivered": 2041, "read": 1430, "replied": 197 },
  "templates": [
    {
      "template_id": "uuid", "display_name": "Quote Notification V2",
      "sent": 1800, "delivered": 1620, "read": 1200, "cta_clicked": 480,
      "delivery_rate": 90.0, "read_rate": 66.7, "cta_rate": 26.7
    }
  ],
  "daily_volume": [
    { "date": "2026-05-01", "sent": 78, "delivered": 68, "read": 47 }
  ],
  "tenant_breakdown": [
    { "tenant_id": "uuid", "tenant_name": "Sharma Packaging", "sent": 234, "quota": 500 }
  ]
}
```

### 37.4 Message Log Export

`GET /api/v1/platform-admin/wa/analytics/export?format=csv&period=30d`

Platform admin CSV columns: `date`, `tenant_name`, `template_name`, `recipient_phone` (last 4 masked), `quote_ref`, `status`, `sent_at`, `delivered_at`, `read_at`, `error_message`

Tenant admin CSV: same columns minus `tenant_name`; full `recipient_phone` visible (own data).

### 37.5 Data Retention

- `wa_message_log`: 365 days live, then moved to `wa_message_log_archive`.
- Daily aggregate snapshots stored indefinitely in `wa_analytics_daily_snapshots` (`date`, `tenant_id` nullable, `template_id` nullable, `sent`, `delivered`, `read`, `failed`). Computed by nightly Celery beat task.

### 37.6 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Manager | Salesperson |
|--------|----------------|--------------------|---------|-------------|
| Platform-wide analytics | ✅ | ❌ | ❌ | ❌ |
| Tenant-own analytics | N/A | ✅ | ✅ | ❌ |
| Per-quote message history | N/A | ✅ | ✅ | Own quotes |
| Export message log | ✅ (all) | ✅ (own) | ✅ (own) | ❌ |
| Time-of-day heatmap | ✅ | ✅ | ❌ | ❌ |

---

## 36 — WHATSAPP TEMPLATE MANAGEMENT [V3 New Module]

### 36.1 Overview

All WhatsApp message templates are created and managed exclusively by the **platform admin**. Tenants cannot create or modify templates. Approved templates are published to a shared library; tenants see only the templates the admin has made available. This ensures all templates are Meta-approved before any tenant can use them and maintains brand/compliance consistency.

### 36.2 Template DB Schema

```sql
CREATE TABLE wa_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,         -- snake_case Meta template name
    display_name        TEXT NOT NULL,         -- human-friendly label shown to tenants
    language_code       TEXT NOT NULL DEFAULT 'en_IN',
    category            TEXT NOT NULL,         -- 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    status              TEXT NOT NULL DEFAULT 'draft',
                        -- 'draft'|'pending_approval'|'approved'|'rejected'|'paused'|'disabled'
    meta_template_id    TEXT,                  -- numeric ID returned by Meta after submission
    rejection_reason    TEXT,
    header_type         TEXT DEFAULT 'NONE',   -- 'NONE'|'TEXT'|'IMAGE'|'VIDEO'|'DOCUMENT'
    header_content      TEXT,                  -- static text or public media URL
    body_text           TEXT NOT NULL,         -- with {{1}}, {{2}} variable placeholders
    footer_text         TEXT,
    buttons             JSONB,                 -- see §36.5 button schema
    variable_map        JSONB NOT NULL DEFAULT '{}',  -- see §36.4
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    availability        TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'selected'
    availability_config JSONB,                 -- {"tenant_ids": ["uuid1"]}
    use_count           INTEGER NOT NULL DEFAULT 0,
    submitted_at        TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_wa_template_name_lang ON wa_templates(name, language_code);
```

### 36.3 Template Categories

| Category | Typical Use | Cost Tier (Meta) |
|----------|-------------|-----------------|
| `UTILITY` | Quote notification, follow-up, payment reminder | Lower |
| `MARKETING` | Price increase notice, promotional messages | Higher |
| `AUTHENTICATION` | OTP / verification codes | Lowest |

**Default templates to create at platform setup:**
- `quote_notification_v1` → `UTILITY` — sent when a quote is shared with a client
- `followup_reminder_v1` → `UTILITY` — follow-up automation message
- `price_increase_notice_v1` → `MARKETING` — price revision letter notification
- `payment_reminder_v1` → `UTILITY` — gentle payment reminder post-acceptance

### 36.4 Template Variable System

Meta requires numbered variables `{{1}}`, `{{2}}` in template body text. BoxCostPro maps each to a named alias and a source field from quote/party/tenant context:

```json
{
  "1": { "alias": "party_name",        "source": "quote.party.name" },
  "2": { "alias": "quote_ref",         "source": "quote.ref" },
  "3": { "alias": "total_amount",      "source": "quote.grand_total_formatted" },
  "4": { "alias": "valid_until",       "source": "quote.valid_until_formatted" },
  "5": { "alias": "salesperson_name",  "source": "quote.created_by.full_name" },
  "6": { "alias": "company_name",      "source": "tenant.company_name" },
  "7": { "alias": "quote_public_link", "source": "quote.public_link" }
}
```

Available source namespaces:

| Namespace | Fields |
|-----------|--------|
| `quote.*` | `ref`, `grand_total_formatted`, `valid_until_formatted`, `items_summary`, `public_link`, `created_by.full_name`, `created_at_formatted` |
| `party.*` | `name`, `contact_person`, `phone`, `email`, `city` |
| `tenant.*` | `company_name`, `phone`, `email`, `city` |
| `custom` | Admin sets a static `default_value`; tenant can override at send time |

At send time: `resolve_variables(template, quote)` iterates the `variable_map`, resolves each source path against live quote data, and returns a `{var_num: value}` dict passed to the Meta API payload.

### 36.5 Template Button Schema

```json
[
  { "type": "QUICK_REPLY", "text": "View Quote" },
  {
    "type": "URL",
    "text": "Open Quote Portal",
    "url": "https://boxcostpro.com/q/{{1}}",
    "url_variable": "1"
  },
  {
    "type": "PHONE_NUMBER",
    "text": "Call Us",
    "phone_number": "+91XXXXXXXXXX"
  }
]
```

Constraints (Meta policy): max 3 buttons total; max 2 URL buttons; only 1 URL button may have a dynamic variable; Quick Reply text max 25 chars.

### 36.6 Template Creation Workflow (Admin)

1. **Platform Admin → WhatsApp → Templates → [+ New Template]**
2. Fill: display name, Meta template name (snake_case, no spaces), language, category.
3. Build template components in the visual builder (§29.2 UI spec).
4. Define variable mappings in the variable panel — pick each `{{N}}` alias and source field.
5. **[Save as Draft]** → `wa_templates` row with `status = 'draft'`.
6. Preview with a sample quote stub to verify variable substitution.
7. **[Submit to Meta]** → §36.7.

### 36.7 Meta Submission & Approval Sync

**Submit:** `POST /api/v1/platform-admin/wa/templates/:id/submit`
- Validates `status IN ('draft', 'rejected')`.
- Builds and POSTs Meta API payload to `https://graph.facebook.com/v18.0/{waba_id}/message_templates`.
- Stores returned `meta_template_id`; sets `status = 'pending_approval'`.

**Sync:** `POST /api/v1/platform-admin/wa/templates/sync`
- Polls Meta for all template statuses; updates `status`, `rejection_reason`, `approved_at`.
- Also auto-triggered by Meta's `template_status_update` webhook event.

**Approval webhook event (inbound from Meta):**
```json
{ "field": "message_template_status_update",
  "value": { "event": "APPROVED", "message_template_name": "quote_notification_v2", "message_template_language": "en_IN" } }
```
Handler: updates `wa_templates.status = 'approved'`; sends in-app notification to platform admin.

### 36.8 Template Versioning

Meta templates are immutable once approved. To revise:
1. **[Duplicate & Edit]** — creates new row with name suffix incremented (e.g., `_v3`).
2. Old template continues serving existing sends while new version awaits approval.
3. After new version is approved, admin clicks **[Set as Default]** for its context.
4. Old template set to `disabled` — retained for `wa_message_log` history reference; no new sends.

### 36.9 Publishing & Availability

- `is_published = FALSE` → admin draft; invisible to all tenants.
- `is_published = TRUE` + `availability = 'all'` → all activated tenants can use it.
- `is_published = TRUE` + `availability = 'selected'` → only `availability_config.tenant_ids` can use it.

### 36.10 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/platform-admin/wa/templates` | List all templates |
| `POST` | `/api/v1/platform-admin/wa/templates` | Create draft |
| `GET` | `/api/v1/platform-admin/wa/templates/:id` | Get detail |
| `PUT` | `/api/v1/platform-admin/wa/templates/:id` | Update draft |
| `DELETE` | `/api/v1/platform-admin/wa/templates/:id` | Delete draft |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/submit` | Submit to Meta |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/duplicate` | Duplicate for versioning |
| `POST` | `/api/v1/platform-admin/wa/templates/:id/publish` | Publish approved template |
| `POST` | `/api/v1/platform-admin/wa/templates/sync` | Sync status from Meta |
| `GET` | `/api/v1/wa/templates` | Published templates visible to tenant |

### 36.11 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Tenant Other |
|--------|----------------|--------------------|--------------|
| Create / edit / delete templates | ✅ | ❌ | ❌ |
| Submit to Meta / sync status | ✅ | ❌ | ❌ |
| Publish / restrict availability | ✅ | ❌ | ❌ |
| View published template library | ✅ | ✅ (if WA activated) | ✅ (if WA activated) |
| Use template in send flow | N/A | ✅ | Role-dependent |

---

## 37 — WHATSAPP ANALYTICS [V3 New Module]

### 37.1 Platform-Wide Dashboard (Admin)

Location: **Platform Admin → WhatsApp → Analytics**

**Top row — 4 KPI cards:**

| Card | Metric | Secondary |
|------|--------|-----------|
| Sent | `COUNT(wa_message_log) WHERE status != 'queued'` | Δ% vs previous period |
| Delivered | `COUNT WHERE status IN ('delivered','read')` | Delivery rate % |
| Read | `COUNT WHERE status = 'read'` | Read rate % |
| Failed | `COUNT WHERE status = 'failed'` | Failure rate % |

Each card shows a 7-day sparkline (Recharts `AreaChart`, `brand-300` fill, 40px tall).

**Delivery funnel:**
```
Sent ──► Delivered ──► Read ──► Replied
100%       87.3%       61.2%     8.4%
```
Rendered as `FunnelChart` (Recharts). Clicking a stage filters the raw message log table.

**Template performance table:**

| Template | Category | Sent | Delivered % | Read % | CTA Click % | Status |
|----------|----------|------|-------------|--------|-------------|--------|
| Quote Notification V2 | UTILITY | 1,204 | 92% | 68% | 34% | Approved |

Sortable by any column. "CTA Click %" only for templates with URL buttons.

**Tenant consumption (horizontal bar chart):** top 10 tenants by message count.

Full paginated table below: `Tenant | Sent | Delivered % | Read % | Quota | Quota Used % | Activated`

**Time-of-day read-rate heatmap:**
- 7×24 grid (Mon–Sun × 00–23 hours)
- Cell colour intensity = average read rate during that slot
- Hover tooltip: exact read rate + sample count
- Helps identify optimal send times

### 37.2 Tenant-Level Analytics (Tenant Admin View)

Location: **Settings → WhatsApp → Analytics**

Same KPI cards and template breakdown, scoped to tenant's own `wa_message_log`. Includes:
- 30-day daily volume line chart (Recharts `LineChart`)
- Template performance table (tenant-filtered)
- Link from each row: "See quote messages" → quote detail → Messages tab (§30.2)

### 37.3 Analytics API

```
GET /api/v1/platform-admin/wa/analytics?period=30d[&tenant_id=uuid]
GET /api/v1/wa/analytics?period=30d   (tenant-scoped, own data only)
```

Response schema:
```json
{
  "period": { "from": "2026-04-05", "to": "2026-05-04" },
  "kpis": {
    "sent": 2340, "delivered": 2041, "read": 1430, "failed": 87,
    "delivery_rate": 87.2, "read_rate": 61.1, "failure_rate": 3.7
  },
  "funnel": { "sent": 2340, "delivered": 2041, "read": 1430, "replied": 197 },
  "templates": [
    {
      "template_id": "uuid", "display_name": "Quote Notification V2",
      "sent": 1800, "delivered": 1620, "read": 1200, "cta_clicked": 480,
      "delivery_rate": 90.0, "read_rate": 66.7, "cta_rate": 26.7
    }
  ],
  "daily_volume": [
    { "date": "2026-05-01", "sent": 78, "delivered": 68, "read": 47 }
  ],
  "tenant_breakdown": [
    { "tenant_id": "uuid", "tenant_name": "Sharma Packaging", "sent": 234, "quota": 500 }
  ]
}
```

### 37.4 Message Log Export

`GET /api/v1/platform-admin/wa/analytics/export?format=csv&period=30d`

Platform admin CSV columns: `date`, `tenant_name`, `template_name`, `recipient_phone` (last 4 masked), `quote_ref`, `status`, `sent_at`, `delivered_at`, `read_at`, `error_message`

Tenant admin CSV: same columns minus `tenant_name`; full `recipient_phone` visible (own data).

### 37.5 Data Retention

- `wa_message_log`: 365 days live, then moved to `wa_message_log_archive`.
- Daily aggregate snapshots stored indefinitely in `wa_analytics_daily_snapshots` (`date`, `tenant_id` nullable, `template_id` nullable, `sent`, `delivered`, `read`, `failed`). Computed by nightly Celery beat task.

### 37.6 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Manager | Salesperson |
|--------|----------------|--------------------|---------|-------------|
| Platform-wide analytics | ✅ | ❌ | ❌ | ❌ |
| Tenant-own analytics | N/A | ✅ | ✅ | ❌ |
| Per-quote message history | N/A | ✅ | ✅ | Own quotes |
| Export message log | ✅ (all) | ✅ (own) | ✅ (own) | ❌ |
| Time-of-day heatmap | ✅ | ✅ | ❌ | ❌ |

---

## 38 — WHATSAPP OTP AUTHENTICATION — ADMIN CONTROLS [V3 New Module]

### 38.1 Overview

Platform admin controls whether WhatsApp OTP login and signup are available system-wide. Settings are stored in `wa_auth_settings` (singleton — see §48.2). This section covers the admin UI and management flows.

### 38.2 Platform Admin → WhatsApp → Authentication Settings

```
┌───────────────────────────────────────────────────────────────────┐
│  WhatsApp OTP Authentication                                      │
├───────────────────────────────────────────────────────────────────┤
│  Enable WA OTP Login               [●──] ON                      │
│  Allow WA Signup (new tenants)     [●──] ON                      │
│  Fallback to email OTP if WA fails [●──] ON                      │
│  Require phone verified to use WA  [●──] ON                      │
│  Max OTPs per user per day         [ 10      ]                    │
├───────────────────────────────────────────────────────────────────┤
│  OTP Template                                                     │
│  ● otp_login_v1  (en)   Status: Approved   [View Template]       │
│  ○ otp_login_v2  (en)   Status: Draft      (not yet approved)    │
├───────────────────────────────────────────────────────────────────┤
│                                        [Save Settings]            │
└───────────────────────────────────────────────────────────────────┘
```

**Toggle behaviour:**
- **Enable WA OTP Login**: if turned OFF, `POST /api/v1/auth/wa/send-otp` returns 503 `WA_AUTH_DISABLED`. Login page still shows WA option greyed out with "Currently unavailable".
- **Allow WA Signup**: can be OFF independently — allows existing users to log in via WA but blocks new signups via WA.
- **OTP Template selector**: only AUTHENTICATION-category templates with `status = 'approved'` appear. Must select one active template — disabling all results in validation error on Save.

### 38.3 OTP Audit Log

Location: **Platform Admin → WhatsApp → Authentication → OTP Log**

```
WhatsApp OTP Log   [Period: Today ▾]  [Status: All ▾]  [Export CSV]

[Search by phone or user...]

┌─────────────────────────────────────────────────────────────────────────────┐
│ Time           │ Phone              │ User/Tenant          │ Purpose  │ Status   │ Attempts │
├─────────────────────────────────────────────────────────────────────────────┤
│ 14:32:05       │ +91 98765 ****10  │ Rahul / Sharma Pack. │ login    │ ✓ Verified │ 1 │
│ 14:28:11       │ +91 98765 ****10  │ Rahul / Sharma Pack. │ login    │ ✗ Expired  │ 0 │
│ 14:15:40       │ +91 77777 ****22  │ (New signup)         │ signup   │ ✓ Verified │ 2 │
│ 13:55:01       │ +91 99999 ****88  │ Unknown              │ login    │ ✗ Failed   │ 5 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Status badges:**
- `✓ Verified` → `success-700` / `success-100`
- `✗ Expired` → `neutral-500` / `neutral-100`
- `✗ Failed` → `error-700` / `error-100`
- `⊘ Blocked` → `error-900` / `error-50` (rate limited — 5 attempts exceeded)
- `◌ Sent` → `info-700` / `info-100` (OTP sent, not yet verified)

Columns: Time, masked phone (last 4 digits visible), User+Tenant (linked), Purpose (login/signup/phone_verify), Status, Attempts, IP address (hover tooltip shows full IP).

**[Export CSV]**: downloads `wa_otp_log` filtered by period/status. Phone numbers are partially masked in export (last 4 digits only) for privacy compliance.

### 38.4 AUTHENTICATION Template Management

The OTP template (`otp_login_v1`) is created and managed in the Template Library (§36) with `category = 'AUTHENTICATION'`. This category:
- Has separate Meta approval queue (usually faster than MARKETING).
- Cannot have marketing content — Meta strictly enforces.
- Lower per-message cost than UTILITY/MARKETING.
- Button `sub_type = 'url'` with `{{1}}` variable used for one-tap copy.

**Required template variables:**
```
{{1}}  →  otp_code  →  source: 'generated'  (6-digit OTP, not from quote/party)
```

The `variable_map` for auth templates uses `source: 'generated'` — a special source type that tells the backend this variable is injected by the auth service at send time, not resolved from quote/party context.

**Platform admin creates this template once at setup** (Setup Wizard Step 7). If none exists, WA OTP auth cannot be enabled.

### 38.5 Rate Limit Monitoring

Location: **Platform Admin → WhatsApp → Authentication → Rate Limits**

```
Current Rate Limit Status (last 10 min)

Phones rate-limited (>3 OTPs/10min):  3
IPs rate-limited (>10 OTPs/10min):    1

[View blocked phones]  [View blocked IPs]  [Clear specific block ▾]
```

**[Clear specific block]**: admin can manually clear a Redis rate-limit key for a specific phone if a legitimate user is locked out (e.g., multiple retries due to delivery delay). Requires entering the phone number + a reason note (audit logged).

### 38.6 RBAC

| Action | Platform Admin | Tenant Owner/Admin | Other |
|--------|----------------|--------------------|-------|
| Enable/disable WA OTP login globally | ✅ | ❌ | ❌ |
| Configure OTP template | ✅ | ❌ | ❌ |
| View OTP audit log (all users) | ✅ | ❌ | ❌ |
| View own OTP audit log | N/A | ✅ | ✅ |
| Clear rate limit blocks | ✅ | ❌ | ❌ |
| Export OTP log | ✅ | ❌ | ❌ |

---

*End of 03-admin-flow-master.md*
*All three reference documents are complete and updated to V3.*
*See also: [01-formula-master.md](./01-formula-master.md) | [02-system-flow-master.md](./02-system-flow-master.md)*
